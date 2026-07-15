import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { UserPlus, ShieldCheck, ShieldOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createEmployeeAccount } from "@/lib/bootstrap.functions";

export const Route = createFileRoute("/_authenticated/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", full_name: "", password: "" });
  const [editing, setEditing] = useState<{ id: string; full_name: string; email: string; is_active: boolean } | null>(null);

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles").select("*").order("created_at", { ascending: true });
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  const createMut = useMutation({
    mutationFn: () => createEmployeeAccount({ data: form }),
    onSuccess: () => {
      toast.success("Employee created");
      setOpen(false);
      setForm({ username: "", full_name: "", password: "" });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("profiles").update({
        full_name: editing.full_name,
        email: editing.email || null,
        is_active: editing.is_active,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  if (!isAdmin) return <PageShell><PageHeader title="Forbidden" /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title="Employees"
        description="Manage your team and access."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="h-4 w-4 mr-1.5" /> Add Employee</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Employee</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="abi" />
                </div>
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Abi Kumar" />
                </div>
                <div className="space-y-1.5">
                  <Label>Temporary Password</Label>
                  <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 chars" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.username || !form.password || !form.full_name}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="card-soft overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(employees ?? []).map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.full_name}</TableCell>
                <TableCell>@{e.username}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.email ?? "—"}</TableCell>
                <TableCell>
                  {e.roles.includes("admin") ? (
                    <Badge className="bg-primary/15 text-primary border-primary/30" variant="outline">Admin</Badge>
                  ) : (
                    <Badge variant="outline">Employee</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {e.is_active ? (
                    <Badge variant="outline" className="bg-success/15 text-success border-success/30">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setEditing({ id: e.id, full_name: e.full_name, email: e.email ?? "", is_active: e.is_active })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate({ id: e.id, is_active: !e.is_active })}>
                    {e.is_active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="active-toggle"
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="active-toggle" className="cursor-pointer">Active</Label>
              </div>
              <p className="text-xs text-muted-foreground">Username can't be changed after account creation.</p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
