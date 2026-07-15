import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageShell, StatCard } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { Plus, Wallet, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

const empty = {
  client_id: "", package_amount: "0", payment_frequency: "monthly",
  due_date: format(new Date(), "yyyy-MM-dd"), next_due_date: "",
  amount_paid: "0", pending_amount: "0", status: "pending", notes: "",
};

function PaymentsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const { data: payments } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, clients(name, company_name)")
        .order("due_date", { ascending: true });
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

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({
        client_id: form.client_id,
        package_amount: Number(form.package_amount),
        payment_frequency: form.payment_frequency,
        due_date: form.due_date || null,
        next_due_date: form.next_due_date || null,
        amount_paid: Number(form.amount_paid),
        pending_amount: Number(form.pending_amount),
        status: form.status as "paid" | "pending" | "overdue" | "partially_paid",
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setOpen(false);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "paid" | "pending" | "overdue" | "partially_paid" }) => {
      const { error } = await supabase.from("payments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });

  const totals = (payments ?? []).reduce(
    (acc, p) => {
      acc.paid += Number(p.amount_paid ?? 0);
      acc.pending += Number(p.pending_amount ?? 0);
      if (p.status === "overdue") acc.overdueCount++;
      return acc;
    },
    { paid: 0, pending: 0, overdueCount: 0 },
  );

  if (!isAdmin) return <PageShell><PageHeader title="Forbidden" /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title="Payments"
        description="Track client invoices, pending amounts, and overdue dues."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New Payment</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
              <div className="grid sm:grid-cols-2 gap-3 py-2">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Client *</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>{(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Field label="Package Amount"><Input type="number" value={form.package_amount} onChange={(e) => setForm({ ...form, package_amount: e.target.value })} /></Field>
                <Field label="Frequency">
                  <Select value={form.payment_frequency} onValueChange={(v) => setForm({ ...form, payment_frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="one_time">One-time</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Due Date"><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
                <Field label="Next Due Date"><Input type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} /></Field>
                <Field label="Amount Paid"><Input type="number" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} /></Field>
                <Field label="Pending"><Input type="number" value={form.pending_amount} onChange={(e) => setForm({ ...form, pending_amount: e.target.value })} /></Field>
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partially_paid">Partially Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending || !form.client_id}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Received" value={`₹${totals.paid.toLocaleString("en-IN")}`} icon={<Wallet className="h-5 w-5" />} accent="success" />
        <StatCard label="Pending" value={`₹${totals.pending.toLocaleString("en-IN")}`} icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label="Overdue Clients" value={totals.overdueCount} icon={<AlertTriangle className="h-5 w-5" />} accent="destructive" />
        <StatCard label="Total Records" value={payments?.length ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="primary" />
      </div>

      {(payments ?? []).length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No payment records yet"
          description="Track what each client owes and when. Add a record per cycle to keep revenue and overdue alerts up to date."
          action={{ label: "Add Payment", onClick: () => setOpen(true), icon: Plus }}
        />
      ) : (
        <div className="card-soft overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments ?? []).map((p) => {
                const c = (p as { clients?: { name: string } | null }).clients;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{c?.name ?? "—"}</TableCell>
                    <TableCell>₹{Number(p.package_amount).toLocaleString("en-IN")}</TableCell>
                    <TableCell>₹{Number(p.amount_paid).toLocaleString("en-IN")}</TableCell>
                    <TableCell>₹{Number(p.pending_amount).toLocaleString("en-IN")}</TableCell>
                    <TableCell>{p.due_date ? format(new Date(p.due_date), "MMM d") : "—"}</TableCell>
                    <TableCell>
                      <Select value={p.status} onValueChange={(v) => updateStatus.mutate({ id: p.id, status: v as "paid" | "pending" | "overdue" | "partially_paid" })}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="partially_paid">Partially Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
