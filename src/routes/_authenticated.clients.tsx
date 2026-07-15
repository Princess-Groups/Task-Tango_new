import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { Plus, Archive, ArchiveRestore, Briefcase } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { format, addMonths, addDays, differenceInDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

const empty = {
  name: "", company_name: "", contact_person: "", phone: "", email: "",
  project_type: "", assigned_employee_id: "", start_date: format(new Date(), "yyyy-MM-dd"),
  monthly_deliverables: "", notes: "",
};

function ClientsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["clients", showArchived],
    queryFn: async () => {
      const q = supabase
        .from("clients")
        .select("*, profiles(full_name, username)")
        .order("created_at", { ascending: false });
      if (!showArchived) q.eq("is_archived", false);
      const { data } = await q;
      return data ?? [];
    },
  });
  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        assigned_employee_id: form.assigned_employee_id || null,
      };
      if (editingId) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
      setEditingId(null);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async ({ id, is_archived }: { id: string; is_archived: boolean }) => {
      const { error } = await supabase.from("clients").update({ is_archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });

  const openNew = () => { setEditingId(null); setForm(empty); setOpen(true); };
  const openEdit = (c: NonNullable<typeof clients>[number]) => {
    setEditingId(c.id);
    setForm({
      name: c.name ?? "", company_name: c.company_name ?? "", contact_person: c.contact_person ?? "",
      phone: c.phone ?? "", email: c.email ?? "", project_type: c.project_type ?? "",
      assigned_employee_id: c.assigned_employee_id ?? "",
      start_date: c.start_date ?? format(new Date(), "yyyy-MM-dd"),
      monthly_deliverables: c.monthly_deliverables ?? "", notes: c.notes ?? "",
    });
    setOpen(true);
  };

  if (!isAdmin) return <PageShell><PageHeader title="Forbidden" /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        description="Each client has its own monthly cycle anchored to their start date."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> Add Client</Button>
          </>
        }
      />

      {(clients ?? []).length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={showArchived ? "No archived clients" : "Add your first client"}
          description={
            showArchived
              ? "Archived clients will appear here."
              : "Clients are the heart of your studio. Add one to start tracking deliverables, cycles, and payments."
          }
          action={!showArchived ? { label: "Add Client", onClick: openNew, icon: Plus } : undefined}
        />
      ) : (
        <div className="card-soft overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(clients ?? []).map((c) => {
                const cycle = computeCycle(c.start_date);
                const prof = (c as { profiles?: { full_name: string } | null }).profiles;
                return (
                  <TableRow key={c.id} className={c.is_archived ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.company_name}</div>
                    </TableCell>
                    <TableCell>{c.project_type ?? "—"}</TableCell>
                    <TableCell>{prof?.full_name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell>
                      <div className="text-sm">{format(cycle.start, "MMM d")} → {format(cycle.end, "MMM d")}</div>
                      <div className="text-xs text-muted-foreground">{cycle.daysLeft} days left in cycle</div>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => archive.mutate({ id: c.id, is_archived: !c.is_archived })}>
                        {c.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Client" : "New Client"}</DialogTitle>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3 py-2">
            <Field label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Company"><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Field>
            <Field label="Contact Person"><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Project Type"><Input value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} placeholder="Video Editing / Reels…" /></Field>
            <Field label="Assigned Employee">
              <Select value={form.assigned_employee_id} onValueChange={(v) => setForm({ ...form, assigned_employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Start Date"><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
            <Field label="Monthly Deliverables" className="sm:col-span-2"><Textarea rows={2} value={form.monthly_deliverables} onChange={(e) => setForm({ ...form, monthly_deliverables: e.target.value })} placeholder="e.g. 8 reels, 4 thumbnails, 2 long-form edits" /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * Anchor billing cycle on client start_date.
 * Cycle length is 1 calendar month (e.g. 15 Jul → 14 Aug).
 */
function computeCycle(startDate: string) {
  const start = new Date(startDate + "T00:00:00");
  const now = new Date();
  let cycleStart = new Date(start);
  while (addMonths(cycleStart, 1) <= now) cycleStart = addMonths(cycleStart, 1);
  const cycleEnd = addDays(addMonths(cycleStart, 1), -1);
  return { start: cycleStart, end: cycleEnd, daysLeft: Math.max(0, differenceInDays(cycleEnd, now)) };
}
