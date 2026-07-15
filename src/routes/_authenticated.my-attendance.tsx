import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subDays } from "date-fns";
import { EmptyState } from "@/components/empty-state";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-attendance")({
  component: MyAttendancePage,
});

function MyAttendancePage() {
  const { user } = useAuth();

  const { data: rows } = useQuery({
    queryKey: ["my-attendance-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", user!.id)
        .gte("work_date", format(subDays(new Date(), 60), "yyyy-MM-dd"))
        .order("work_date", { ascending: false });
      return data ?? [];
    },
  });

  const total = (rows ?? []).reduce((s, r) => s + Number(r.total_hours ?? 0), 0);

  return (
    <PageShell>
      <PageHeader
        title="My Attendance"
        description={`Last 60 days · ${total.toFixed(1)} total hours`}
      />
      {(rows ?? []).length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No sessions yet"
          description="Head to My Day and tap Start Work to clock in. Your sessions will appear here."
        />
      ) : (
        <div className="card-soft overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Logout</TableHead>
                <TableHead>Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{format(new Date(r.work_date), "EEE, MMM d")}</TableCell>
                  <TableCell>{format(new Date(r.login_time), "h:mm a")}</TableCell>
                  <TableCell>{r.logout_time ? format(new Date(r.logout_time), "h:mm a") : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{r.total_hours ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

    </PageShell>
  );
}
