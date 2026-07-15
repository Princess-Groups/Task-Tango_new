import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { PriorityBadge, StatusBadge } from "@/components/employee-day";
import { EmptyState } from "@/components/empty-state";
import { ListTodo, AlertCircle } from "lucide-react";
import { categoryLabel } from "@/lib/task-categories";

export const Route = createFileRoute("/_authenticated/my-tasks")({
  component: MyTasksPage,
});

const reasons = [
  "Waiting for client assets",
  "Internet issue",
  "System issue",
  "Revision pending",
  "Personal leave",
  "Other",
];

const frequencyLabel: Record<string, string> = {
  daily: "Daily",
  every_other_day: "Every Other Day",
  weekly: "Weekly",
  monthly: "Monthly",
  one_time: "One-time",
};

function MyTasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [reasonOpen, setReasonOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const { data: tasks } = useQuery({
    queryKey: ["my-tasks-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, clients(name)")
        .eq("assigned_to", user!.id)
        .order("due_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, incomplete_reason }: { id: string; status: "pending" | "in_progress" | "completed"; incomplete_reason?: string | null }) => {
      const payload: {
        status: "pending" | "in_progress" | "completed";
        completed_at?: string | null;
        incomplete_reason?: string | null;
      } = { status };
      if (status === "completed") {
        payload.completed_at = new Date().toISOString();
        payload.incomplete_reason = null;
      } else if (incomplete_reason !== undefined) {
        payload.incomplete_reason = incomplete_reason;
      }
      const { error } = await supabase.from("tasks").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["my-tasks-all"] });
      qc.invalidateQueries({ queryKey: ["my-tasks-today"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitReason = () => {
    if (!reasonOpen) return;
    const text = reason === "Other" ? customReason.trim() : reason;
    if (!text) {
      toast.error("Reason is required");
      return;
    }
    updateStatus.mutate({ id: reasonOpen, status: "in_progress", incomplete_reason: text });
    setReasonOpen(null);
    setReason("");
    setCustomReason("");
  };

  const filtered = (tasks ?? []).filter((t) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return t.status !== "completed";
    return t.status === statusFilter;
  });

  const today = new Date();

  return (
    <PageShell>
      <PageHeader
        title="My Tasks"
        description="Anything unfinished stays here until you mark it complete."
        actions={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-3">
        {filtered.map((t) => {
          const c = (t as { clients?: { name: string } | null }).clients;
          const originalDue = t.original_due_date ?? t.due_date;
          const isCarryOver =
            t.status !== "completed" &&
            originalDue !== null &&
            differenceInCalendarDays(today, parseISO(originalDue)) > 0;
          return (
            <div key={t.id} className={`card-soft p-4 sm:p-5 ${isCarryOver ? "border-warning/50 bg-warning/5" : ""}`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{t.title}</h3>
                    <Badge variant="outline" className="bg-secondary/60 text-xs">
                      {categoryLabel(t.category, t.category_other)}
                    </Badge>
                    <PriorityBadge value={t.priority} />
                    <StatusBadge value={t.status} />
                    {isCarryOver && (
                      <Badge variant="outline" className="bg-warning/15 text-warning-foreground border-warning/40 text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Pending from {format(parseISO(originalDue!), "MMM d")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {c?.name ?? "—"}
                    {t.due_date && <> · Due {format(parseISO(t.due_date), "MMM d")}</>}
                    <> · {frequencyLabel[t.frequency] ?? t.frequency}</>
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-2">{t.description}</p>}
                  {t.incomplete_reason && (
                    <p className="text-xs mt-2 p-2 rounded bg-warning/10 text-warning-foreground border border-warning/30">
                      Reason: {t.incomplete_reason}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {t.status !== "completed" && (
                    <>
                      {t.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: t.id, status: "in_progress" })}>
                          Start
                        </Button>
                      )}
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: t.id, status: "completed" })}>
                        Mark Complete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setReasonOpen(t.id); setReason(t.incomplete_reason ?? ""); }}>
                        Add Reason
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <EmptyState
            icon={ListTodo}
            title={(tasks ?? []).length === 0 ? "No tasks assigned to you yet" : "Nothing matches this filter"}
            description={
              (tasks ?? []).length === 0
                ? "When your admin assigns work, it will show up here. Until then, enjoy the calm."
                : "Try switching to a different status."
            }
          />
        )}
      </div>

      <Dialog open={!!reasonOpen} onOpenChange={(o) => !o && setReasonOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reason for not completing</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {reason === "Other" && (
              <div>
                <Label className="text-xs">Please specify</Label>
                <Textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)} rows={3} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submitReason}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
