import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageShell, StatCard } from "./page-shell";
import { Users, Briefcase, ListChecks, CheckCircle2, AlertTriangle, Wallet, TrendingUp, Clock, Timer, CalendarClock } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Legend,
} from "recharts";
import { format, startOfMonth, subDays, eachDayOfInterval } from "date-fns";
import { GettingStarted } from "./getting-started";
import { Progress } from "@/components/ui/progress";

export function AdminDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const { data: stats } = useQuery({
    queryKey: ["admin", "stats", today],
    queryFn: async () => {
      const [
        emps,
        clientsActive,
        clientsTotal,
        tasksTotal,
        tasksPending,
        tasksOverdue,
        tasksDoneToday,
        tasksAssignedToday,
        tasksDoneMonth,
        attToday,
        lateToday,
        lateMonth,
        payPending,
        payOverdue,
        revenueMonth,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_archived", false),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "completed"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "completed").lt("due_date", today),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", `${today}T00:00:00`),
        supabase.from("tasks").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00`),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", `${monthStart}T00:00:00`),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("work_date", today),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("work_date", today).eq("is_late", true),
        supabase.from("attendance").select("id", { count: "exact", head: true }).gte("work_date", monthStart).eq("is_late", true),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "overdue"),
        supabase.from("payments").select("amount_paid").gte("updated_at", `${monthStart}T00:00:00`),
      ]);

      const revenue = (revenueMonth.data ?? []).reduce(
        (sum, p) => sum + Number(p.amount_paid ?? 0),
        0,
      );

      return {
        employees: emps.count ?? 0,
        clientsActive: clientsActive.count ?? 0,
        clientsTotal: clientsTotal.count ?? 0,
        tasksTotal: tasksTotal.count ?? 0,
        pendingTasks: tasksPending.count ?? 0,
        overdueTasks: tasksOverdue.count ?? 0,
        doneToday: tasksDoneToday.count ?? 0,
        assignedToday: tasksAssignedToday.count ?? 0,
        doneMonth: tasksDoneMonth.count ?? 0,
        activeToday: attToday.count ?? 0,
        lateToday: lateToday.count ?? 0,
        lateMonth: lateMonth.count ?? 0,
        payPending: payPending.count ?? 0,
        payOverdue: payOverdue.count ?? 0,
        revenue,
      };
    },
  });

  const { data: attendanceTrend } = useQuery({
    queryKey: ["admin", "attendance-trend"],
    queryFn: async () => {
      const start = subDays(new Date(), 13);
      const { data } = await supabase
        .from("attendance")
        .select("work_date, total_hours, employee_id")
        .gte("work_date", format(start, "yyyy-MM-dd"));
      const days = eachDayOfInterval({ start, end: new Date() });
      return days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const rows = (data ?? []).filter((r) => r.work_date === key);
        return {
          date: format(d, "MMM d"),
          present: new Set(rows.map((r) => r.employee_id)).size,
          hours: rows.reduce((s, r) => s + Number(r.total_hours ?? 0), 0),
        };
      });
    },
  });

  const { data: taskBreakdown } = useQuery({
    queryKey: ["admin", "task-breakdown"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("status");
      const counts = { pending: 0, in_progress: 0, completed: 0 };
      (data ?? []).forEach((t) => {
        counts[t.status as keyof typeof counts]++;
      });
      return [
        { name: "Pending", value: counts.pending, color: "var(--color-chart-4)" },
        { name: "In Progress", value: counts.in_progress, color: "var(--color-chart-2)" },
        { name: "Completed", value: counts.completed, color: "var(--color-chart-1)" },
      ];
    },
  });

  const { data: performance } = useQuery({
    queryKey: ["admin", "performance"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true);
      const { data: tasks } = await supabase
        .from("tasks")
        .select("assigned_to, status")
        .gte("created_at", `${monthStart}T00:00:00`);
      return (profiles ?? []).map((p) => {
        const mine = (tasks ?? []).filter((t) => t.assigned_to === p.id);
        const completed = mine.filter((t) => t.status === "completed").length;
        const pending = mine.filter((t) => t.status !== "completed").length;
        const total = mine.length;
        return {
          id: p.id,
          fullName: p.full_name,
          name: p.full_name.split(" ")[0],
          completed,
          pending,
          total,
          rate: total ? Math.round((completed / total) * 100) : 0,
        };
      });
    },
  });

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description={`Today is ${format(new Date(), "EEEE, MMMM d")}. Here's your studio at a glance.`}
      />

      <GettingStarted />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Employees" value={stats?.employees ?? "—"} icon={<Users className="h-5 w-5" />} accent="primary" />
        <StatCard label="Active Today" value={stats?.activeToday ?? "—"} icon={<Clock className="h-5 w-5" />} accent="accent" hint="Clocked in" />
        <StatCard label="Active Clients" value={stats?.clientsActive ?? "—"} icon={<Briefcase className="h-5 w-5" />} accent="primary" hint={`${stats?.clientsTotal ?? 0} total`} />
        <StatCard label="Total Tasks" value={stats?.tasksTotal ?? "—"} icon={<ListChecks className="h-5 w-5" />} accent="primary" />
        <StatCard label="Pending Tasks" value={stats?.pendingTasks ?? "—"} icon={<Timer className="h-5 w-5" />} accent="warning" />
        <StatCard label="Overdue Tasks" value={stats?.overdueTasks ?? "—"} icon={<AlertTriangle className="h-5 w-5" />} accent="destructive" />
        <StatCard label="Assigned Today" value={stats?.assignedToday ?? "—"} icon={<CalendarClock className="h-5 w-5" />} accent="accent" />
        <StatCard label="Completed Today" value={stats?.doneToday ?? "—"} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Completed This Month" value={stats?.doneMonth ?? "—"} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Late Today" value={stats?.lateToday ?? "—"} icon={<AlertTriangle className="h-5 w-5" />} accent="warning" />
        <StatCard label="Late This Month" value={stats?.lateMonth ?? "—"} icon={<AlertTriangle className="h-5 w-5" />} accent="warning" />
        <StatCard label="Revenue (MTD)" value={`₹${(stats?.revenue ?? 0).toLocaleString("en-IN")}`} icon={<Wallet className="h-5 w-5" />} accent="primary" hint={`${stats?.payOverdue ?? 0} overdue · ${stats?.payPending ?? 0} pending`} />
      </div>

      {/* Employee progress bars */}
      <div className="card-soft p-5 mt-6">
        <h3 className="font-display font-semibold mb-4">Employee task progress · this month</h3>
        {(performance ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No employee task data yet.</p>
        ) : (
          <div className="space-y-4">
            {(performance ?? []).map((p) => (
              <div key={p.id}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-medium">{p.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.completed}/{p.total} · {p.rate}%
                  </span>
                </div>
                <Progress value={p.rate} className="h-2" />
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span>✓ {p.completed} done</span>
                  <span>⏳ {p.pending} pending</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <div className="card-soft p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold">Attendance · last 14 days</h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="present" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 3 }} name="Employees Present" />
                <Line type="monotone" dataKey="hours" stroke="var(--color-chart-3)" strokeWidth={2} dot={{ r: 2 }} name="Total Hours" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-soft p-5">
          <h3 className="font-display font-semibold mb-3">Task Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={taskBreakdown ?? []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {(taskBreakdown ?? []).map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-soft p-5 lg:col-span-3">
          <h3 className="font-display font-semibold mb-3">Employee Performance — this month</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performance ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="completed" stackId="a" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} name="Completed" />
                <Bar dataKey="pending" stackId="a" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
