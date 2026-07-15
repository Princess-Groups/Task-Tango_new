import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageShell, StatCard } from "./page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, ListTodo, PlayCircle, StopCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export function EmployeeDay() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: attendance } = useQuery({
    queryKey: ["my-attendance", today, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", user!.id)
        .eq("work_date", today)
        .maybeSingle();
      return data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["my-tasks-today", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, clients(name)")
        .eq("assigned_to", user!.id)
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const clockIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("attendance").insert({
        employee_id: user!.id,
        work_date: today,
        login_time: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clocked in — have a great day!");
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      if (!attendance) throw new Error("No active session");
      const { error } = await supabase
        .from("attendance")
        .update({ logout_time: new Date().toISOString() })
        .eq("id", attendance.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Day ended — well done!");
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (tasks ?? []).filter((t) => t.status !== "completed");
  const done = (tasks ?? []).filter((t) => t.status === "completed");

  return (
    <PageShell>
      <PageHeader
        title={`Hi ${profile?.full_name?.split(" ")[0] ?? ""} 👋`}
        description={format(new Date(), "EEEE, MMMM d")}
      />

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 md:col-span-1 brand-gradient text-primary-foreground border-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-90">Attendance</div>
              <div className="mt-1 font-display font-bold text-xl">
                {attendance?.logout_time
                  ? "Day Completed"
                  : attendance
                  ? "Clocked In"
                  : "Not started"}
              </div>
              {attendance?.login_time && (
                <div className="text-sm opacity-90 mt-1">
                  In · {format(new Date(attendance.login_time), "h:mm a")}
                  {attendance.logout_time && (
                    <> · Out · {format(new Date(attendance.logout_time), "h:mm a")}</>
                  )}
                </div>
              )}
              {attendance?.total_hours && (
                <div className="text-sm opacity-90">
                  Worked · {attendance.total_hours}h
                </div>
              )}
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            {!attendance && (
              <Button
                variant="secondary"
                onClick={() => clockIn.mutate()}
                disabled={clockIn.isPending}
              >
                {clockIn.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1.5" />}
                Start Work
              </Button>
            )}
            {attendance && !attendance.logout_time && (
              <Button
                variant="secondary"
                onClick={() => clockOut.mutate()}
                disabled={clockOut.isPending}
              >
                {clockOut.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <StopCircle className="h-4 w-4 mr-1.5" />}
                End Work
              </Button>
            )}
          </div>
        </Card>
        <StatCard label="Pending Tasks" value={pending.length} icon={<ListTodo className="h-5 w-5" />} accent="warning" />
        <StatCard label="Completed Today" value={done.filter(t => t.completed_at && t.completed_at.startsWith(today)).length} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
      </div>

      <div className="card-soft p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold">Today's Tasks</h3>
          <Link to="/my-tasks" className="text-sm text-primary hover:underline">View all →</Link>
        </div>
        {pending.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-success" />
            All caught up. Nice work.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pending.slice(0, 8).map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {(t as { clients?: { name: string } | null }).clients?.name ?? "—"}
                    {t.due_date && <> · Due {format(new Date(t.due_date), "MMM d")}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge value={t.priority} />
                  <StatusBadge value={t.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}

export function PriorityBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    urgent: "bg-destructive/15 text-destructive border-destructive/30",
    high: "bg-warning/15 text-warning border-warning/30",
    medium: "bg-accent/40 text-accent-foreground border-accent",
    low: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={map[value] ?? ""}>
      {value}
    </Badge>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    completed: "bg-success/15 text-success border-success/30",
    in_progress: "bg-primary/10 text-primary border-primary/30",
    pending: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={map[value] ?? ""}>
      <Clock className="h-3 w-3 mr-1" />
      {value.replace("_", " ")}
    </Badge>
  );
}
