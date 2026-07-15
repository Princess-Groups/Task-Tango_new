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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { Plus, Trash2, ListChecks, Pencil } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { format } from "date-fns";
import { PriorityBadge, StatusBadge } from "@/components/employee-day";
import type { Database } from "@/integrations/supabase/types";
import { TASK_CATEGORIES, categoryLabel, type TaskCategory } from "@/lib/task-categories";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksAdminPage,
});

type FormState = {
  title: string;
  description: string;
  client_id: string;
  assigned_to: string;
  priority: string;
  frequency: string;
  category: TaskCategory;
  category_other: string;
  due_date: string;
};

const empty: FormState = {
  title: "", description: "", client_id: "", assigned_to: "",
  priority: "medium", frequency: "daily",
  category: "other", category_other: "",
  due_date: format(new Date(), "yyyy-MM-dd"),
};

const frequencyLabel: Record<Database["public"]["Enums"]["task_frequency"], string> = {
  daily: "Daily",
  every_other_day: "Every Other Day",
  weekly: "Weekly",
  monthly: "Monthly",
  one_time: "One-time",
};

function TasksAdminPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmp, setFilterEmp] = useState<string>("all");
  const [filterCat, setFilterCat] = useState<string>("all");

  const { data: tasks } = useQuery({
    queryKey: ["admin-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, clients(name), profiles!tasks_assigned_to_fkey(full_name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-active"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("is_archived", false);
      return data ?? [];
    },
  });
  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").eq("is_active", true);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        client_id: form.client_id || null,
        assigned_to: form.assigned_to || null,
        priority: form.priority as "low" | "medium" | "high" | "urgent",
        frequency: form.frequency as Database["public"]["Enums"]["task_frequency"],
        category: form.category,
        category_other: form.category === "other" ? (form.category_other || null) : null,
        due_date: form.due_date || null,
      };
      if (editingId) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tasks")
          .insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Task updated" : "Task created");
      setOpen(false);
      setEditingId(null);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task deleted");
      qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditingId(null); setForm(empty); setOpen(true); };
  const openEdit = (t: NonNullable<typeof tasks>[number]) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description ?? "",
      client_id: t.client_id ?? "",
      assigned_to: t.assigned_to ?? "",
      priority: t.priority,
      frequency: t.frequency,
      category: t.category ?? "other",
      category_other: t.category_other ?? "",
      due_date: t.due_date ?? format(new Date(), "yyyy-MM-dd"),
    });
    setOpen(true);
  };

  const filtered = (tasks ?? []).filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterEmp !== "all" && t.assigned_to !== filterEmp) return false;
    if (filterCat !== "all" && t.category !== filterCat) return false;
    return true;
  });

  if (!isAdmin) return <PageShell><PageHeader title="Forbidden" /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title="Tasks"
        description="Create and assign work. Employees update status from their dashboards."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> New Task</Button>}
      />

      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEmp} onValueChange={setFilterEmp}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {TASK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={(tasks ?? []).length === 0 ? "No tasks yet" : "No tasks match these filters"}
          description={
            (tasks ?? []).length === 0
              ? "Create your first task and assign it to a teammate. They'll see it on their My Day screen."
              : "Try a different status, employee, or category to see more."
          }
          action={(tasks ?? []).length === 0 ? { label: "New Task", onClick: openNew, icon: Plus } : undefined}
        />
      ) : (
        <div className="card-soft overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const c = (t as { clients?: { name: string } | null }).clients;
                const p = (t as { profiles?: { full_name: string } | null }).profiles;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{frequencyLabel[t.frequency]}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-secondary/60">
                        {categoryLabel(t.category, t.category_other)}
                      </Badge>
                    </TableCell>
                    <TableCell>{c?.name ?? "—"}</TableCell>
                    <TableCell>{p?.full_name ?? "—"}</TableCell>
                    <TableCell>{t.due_date ? format(new Date(t.due_date), "MMM d") : "—"}</TableCell>
                    <TableCell><PriorityBadge value={t.priority} /></TableCell>
                    <TableCell><StatusBadge value={t.status} /></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete "${t.title}"?`)) del.mutate(t.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(empty); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingId ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3 py-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Edit Reel #12" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as TaskCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Client</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.category === "other" && (
              <div className="sm:col-span-2">
                <Label className="text-xs">Custom category label</Label>
                <Input value={form.category_other} onChange={(e) => setForm({ ...form, category_other: e.target.value })} placeholder="e.g. Photography" />
              </div>
            )}
            <div>
              <Label className="text-xs">Assigned to *</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="every_other_day">Every Other Day</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.title || !form.assigned_to || (form.category === "other" && !form.category_other)}
            >
              {editingId ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
