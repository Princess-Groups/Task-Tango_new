import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageShell, StatCard } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Users, Briefcase, CalendarCheck, CalendarRange } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { exportToXlsx } from "@/lib/export-xlsx";
import { categoryLabel } from "@/lib/task-categories";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { isAdmin } = useAuth();
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [emp, setEmp] = useState("all");
  const [client, setClient] = useState("all");
  const [status, setStatus] = useState("all");

  const { data: employees } = useQuery({
    queryKey: ["report-employees"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").eq("is_active", true)).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["report-clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name").eq("is_archived", false)).data ?? [],
  });

  const { data: tasks } = useQuery({
    queryKey: ["report-tasks", from, to, emp, client, status],
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("*, clients(name), profiles!tasks_assigned_to_fkey(full_name)")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`);
      if (emp !== "all") q = q.eq("assigned_to", emp);
      if (client !== "all") q = q.eq("client_id", client);
      if (status !== "all") q = q.eq("status", status as "pending" | "in_progress" | "completed");
      const { data } = await q.order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ["report-attendance", from, to, emp],
    queryFn: async () => {
      let q = supabase
        .from("attendance")
        .select("*, profiles(full_name)")
        .gte("work_date", from)
        .lte("work_date", to);
      if (emp !== "all") q = q.eq("employee_id", emp);
      const { data } = await q.order("work_date", { ascending: false });
      return data ?? [];
    },
  });

  // Employee rollup
  const employeeReport = useMemo(() => {
    const list = employees ?? [];
    return list.map((e) => {
      const mine = (tasks ?? []).filter((t) => t.assigned_to === e.id);
      const done = mine.filter((t) => t.status === "completed").length;
      const pending = mine.filter((t) => t.status !== "completed").length;
      const total = mine.length;
      const productivity = total ? Math.round((done / total) * 100) : 0;
      const att = (attendance ?? []).filter((a) => a.employee_id === e.id);
      const hours = att.reduce((s, r) => s + Number(r.total_hours ?? 0), 0);
      const late = att.filter((a) => a.is_late).length;
      return {
        id: e.id,
        name: e.full_name,
        totalTasks: total,
        completed: done,
        pending,
        productivity,
        sessions: att.length,
        hours: Number(hours.toFixed(1)),
        lateDays: late,
      };
    });
  }, [employees, tasks, attendance]);

  const clientReport = useMemo(() => {
    const list = clients ?? [];
    return list.map((c) => {
      const mine = (tasks ?? []).filter((t) => t.client_id === c.id);
      const done = mine.filter((t) => t.status === "completed").length;
      const pending = mine.filter((t) => t.status !== "completed").length;
      const total = mine.length;
      return {
        id: c.id,
        name: c.name,
        totalTasks: total,
        completed: done,
        pending,
        completionRate: total ? Math.round((done / total) * 100) : 0,
      };
    });
  }, [clients, tasks]);

  const dailyReport = useMemo(() => {
    const map = new Map<string, { assigned: number; completed: number; pending: number }>();
    (tasks ?? []).forEach((t) => {
      const key = format(parseISO(t.created_at), "yyyy-MM-dd");
      const cur = map.get(key) ?? { assigned: 0, completed: 0, pending: 0 };
      cur.assigned++;
      if (t.status === "completed") cur.completed++;
      else cur.pending++;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, v]) => ({ date, ...v }));
  }, [tasks]);

  if (!isAdmin) return <PageShell><PageHeader title="Forbidden" /></PageShell>;

  const summary = {
    totalTasks: (tasks ?? []).length,
    completed: (tasks ?? []).filter((t) => t.status === "completed").length,
    pending: (tasks ?? []).filter((t) => t.status !== "completed").length,
    sessions: (attendance ?? []).length,
  };

  const exportEmployee = () =>
    exportToXlsx(`employee-report-${from}-to-${to}`, [
      { name: "Employees", rows: employeeReport.map((e) => ({
        Employee: e.name, "Total Tasks": e.totalTasks, Completed: e.completed,
        Pending: e.pending, "Productivity %": e.productivity,
        "Attendance Sessions": e.sessions, "Total Hours": e.hours, "Late Days": e.lateDays,
      })) },
    ]);

  const exportClient = () =>
    exportToXlsx(`client-report-${from}-to-${to}`, [
      { name: "Clients", rows: clientReport.map((c) => ({
        Client: c.name, "Total Tasks": c.totalTasks, Completed: c.completed,
        Pending: c.pending, "Completion %": c.completionRate,
      })) },
    ]);

  const exportDaily = () =>
    exportToXlsx(`daily-report-${from}-to-${to}`, [
      { name: "Daily", rows: dailyReport.map((d) => ({
        Date: d.date, Assigned: d.assigned, Completed: d.completed, Pending: d.pending,
      })) },
    ]);

  const exportMonthly = () => {
    const rows = (tasks ?? []).map((t) => {
      const c = (t as { clients?: { name: string } | null }).clients;
      const p = (t as { profiles?: { full_name: string } | null }).profiles;
      return {
        Title: t.title,
        Category: categoryLabel(t.category, t.category_other),
        Client: c?.name ?? "",
        Assignee: p?.full_name ?? "",
        Priority: t.priority,
        Status: t.status,
        Frequency: t.frequency,
        "Due Date": t.due_date ?? "",
        "Original Due": t.original_due_date ?? "",
        "Created": format(parseISO(t.created_at), "yyyy-MM-dd"),
      };
    });
    exportToXlsx(`monthly-report-${from}-to-${to}`, [
      { name: "Summary", rows: [{
        Range: `${from} → ${to}`,
        "Total Tasks": summary.totalTasks,
        Completed: summary.completed,
        Pending: summary.pending,
        "Attendance Sessions": summary.sessions,
      }] },
      { name: "Tasks", rows },
      { name: "By Employee", rows: employeeReport.map((e) => ({
        Employee: e.name, Total: e.totalTasks, Completed: e.completed,
        Pending: e.pending, "Productivity %": e.productivity, Hours: e.hours,
      })) },
    ]);
  };

  const quick = (days: number) => {
    setFrom(format(subDays(new Date(), days - 1), "yyyy-MM-dd"));
    setTo(format(new Date(), "yyyy-MM-dd"));
  };

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        description="Filter, review, and export employee, client, daily, and monthly performance."
      />

      {/* Filters */}
      <div className="card-soft p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Employee</Label>
            <Select value={emp} onValueChange={setEmp}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Client</Label>
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={() => quick(1)}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => quick(7)}>7d</Button>
            <Button variant="outline" size="sm" onClick={() => {
              setFrom(format(startOfMonth(new Date()), "yyyy-MM-dd"));
              setTo(format(endOfMonth(new Date()), "yyyy-MM-dd"));
            }}>Month</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Tasks" value={summary.totalTasks} icon={<FileSpreadsheet className="h-5 w-5" />} accent="primary" />
        <StatCard label="Completed" value={summary.completed} accent="success" />
        <StatCard label="Pending" value={summary.pending} accent="warning" />
        <StatCard label="Attendance sessions" value={summary.sessions} accent="accent" />
      </div>

      <Tabs defaultValue="employee">
        <TabsList className="mb-3">
          <TabsTrigger value="employee"><Users className="h-4 w-4 mr-1.5" />Employee</TabsTrigger>
          <TabsTrigger value="client"><Briefcase className="h-4 w-4 mr-1.5" />Client</TabsTrigger>
          <TabsTrigger value="daily"><CalendarCheck className="h-4 w-4 mr-1.5" />Daily</TabsTrigger>
          <TabsTrigger value="monthly"><CalendarRange className="h-4 w-4 mr-1.5" />Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value="employee">
          <ReportShell onExport={exportEmployee} title="Per employee performance">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead className="w-56">Productivity</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Late days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeReport.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.totalTasks}</TableCell>
                    <TableCell><Badge variant="outline" className="bg-success/15 text-success border-success/30">{e.completed}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">{e.pending}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={e.productivity} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-10 text-right">{e.productivity}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{e.hours}</TableCell>
                    <TableCell>{e.lateDays}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportShell>
        </TabsContent>

        <TabsContent value="client">
          <ReportShell onExport={exportClient} title="Per client task delivery">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead className="w-56">Completion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientReport.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.totalTasks}</TableCell>
                    <TableCell>{c.completed}</TableCell>
                    <TableCell>{c.pending}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={c.completionRate} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-10 text-right">{c.completionRate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportShell>
        </TabsContent>

        <TabsContent value="daily">
          <ReportShell onExport={exportDaily} title="Tasks created per day">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyReport.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell>{format(parseISO(d.date), "EEE, MMM d")}</TableCell>
                    <TableCell>{d.assigned}</TableCell>
                    <TableCell>{d.completed}</TableCell>
                    <TableCell>{d.pending}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportShell>
        </TabsContent>

        <TabsContent value="monthly">
          <ReportShell onExport={exportMonthly} title="Full monthly export (summary + tasks + per-employee)">
            <div className="p-4 text-sm text-muted-foreground">
              This export produces a multi-sheet workbook with a summary, every task, and per-employee totals for the selected range.
            </div>
          </ReportShell>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function ReportShell({
  title,
  onExport,
  children,
}: {
  title: string;
  onExport: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card-soft overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-display font-semibold">{title}</h3>
        <Button onClick={onExport} size="sm">
          <Download className="h-4 w-4 mr-1.5" /> Export Excel
        </Button>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
