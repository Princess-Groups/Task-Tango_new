import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { format, subDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Clock, Pencil } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

type EditRow = {
  id: string;
  work_date: string;
  login_time: string;  // HH:mm
  logout_time: string; // HH:mm or ""
};

function toLocalHM(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}
function combineDateTime(date: string, hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date(date + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function AttendancePage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [emp, setEmp] = useState<string>("all");
  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [lateOnly, setLateOnly] = useState(false);
  const [editing, setEditing] = useState<EditRow | null>(null);

  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["attendance", emp, from, to, lateOnly],
    queryFn: async () => {
      let q = supabase
        .from("attendance")
        .select("*, profiles(full_name, username)")
        .gte("work_date", from)
        .lte("work_date", to)
        .order("work_date", { ascending: false });
      if (emp !== "all") q = q.eq("employee_id", emp);
      if (lateOnly) q = q.eq("is_late", true);
      const { data } = await q;
      return data ?? [];
    },
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const payload: { login_time: string; logout_time: string | null } = {
        login_time: combineDateTime(editing.work_date, editing.login_time),
        logout_time: editing.logout_time ? combineDateTime(editing.work_date, editing.logout_time) : null,
      };
      const { error } = await supabase.from("attendance").update(payload).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalHours = (rows ?? []).reduce((s, r) => s + Number(r.total_hours ?? 0), 0);
  const lateCount = (rows ?? []).filter((r) => r.is_late).length;

  if (!isAdmin) return <PageShell><PageHeader title="Forbidden" /></PageShell>;

  return (
    <PageShell>
      <PageHeader title="Attendance" description="Late = login after 9:30 AM IST. Admin can edit any entry." />

      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={emp} onValueChange={setEmp}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        <Button variant={lateOnly ? "default" : "outline"} size="sm" onClick={() => setLateOnly(!lateOnly)}>
          {lateOnly ? "Showing late only" : "Late only"}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="bg-secondary">Total {totalHours.toFixed(1)} h</Badge>
          <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">{lateCount} late</Badge>
          <Badge variant="outline">{rows?.length ?? 0} sessions</Badge>
        </div>
      </div>

      {(rows ?? []).length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No attendance yet for this range"
          description="When employees clock in from their My Day screen, their sessions show up here. Try a wider date range or a different employee."
        />
      ) : (
        <div className="card-soft overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Late</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((r) => {
                const p = (r as { profiles?: { full_name: string } | null }).profiles;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{p?.full_name ?? "—"}</TableCell>
                    <TableCell>{format(new Date(r.work_date), "EEE, MMM d")}</TableCell>
                    <TableCell>{format(new Date(r.login_time), "h:mm a")}</TableCell>
                    <TableCell>{r.logout_time ? format(new Date(r.logout_time), "h:mm a") : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.total_hours ?? "—"}</TableCell>
                    <TableCell>
                      {r.is_late ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                          +{r.late_minutes}m
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-success/15 text-success border-success/30">On time</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => setEditing({
                          id: r.id,
                          work_date: r.work_date,
                          login_time: toLocalHM(r.login_time),
                          logout_time: toLocalHM(r.logout_time),
                        })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit attendance</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs">Date</Label>
                <Input value={editing.work_date} disabled />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Login time</Label>
                  <Input type="time" value={editing.login_time} onChange={(e) => setEditing({ ...editing, login_time: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Logout time</Label>
                  <Input type="time" value={editing.logout_time} onChange={(e) => setEditing({ ...editing, logout_time: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Late-login flag recalculates automatically.</p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending || !editing?.login_time}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
