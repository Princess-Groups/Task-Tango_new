import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/employee-day";
import { Badge } from "@/components/ui/badge";
import { Target, AlertCircle } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { categoryLabel } from "@/lib/task-categories";

export const Route = createFileRoute("/_authenticated/my-targets")({
  component: MyTargetsPage,
});

function MyTargetsPage() {
  const { user } = useAuth();

  const { data: tasks } = useQuery({
    queryKey: ["my-monthly-targets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, clients(name)")
        .eq("assigned_to", user!.id)
        .eq("frequency", "monthly")
        .order("due_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  const groups: Record<string, typeof tasks> = {};
  (tasks ?? []).forEach((t) => {
    const d = t.due_date ?? t.created_at;
    const key = format(parseISO(d), "MMMM yyyy");
    (groups[key] ||= []).push(t);
  });
  const groupKeys = Object.keys(groups);

  const total = (tasks ?? []).length;
  const done = (tasks ?? []).filter((t) => t.status === "completed").length;
  const today = new Date();

  return (
    <PageShell>
      <PageHeader
        title="Monthly Targets"
        description={
          total === 0
            ? "Your monthly client targets will appear here once your admin assigns them."
            : `${done} of ${total} completed this view — keep going!`
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={Target}
          title="No monthly targets yet"
          description="When your admin adds a monthly client task to you, it will show up here grouped by month."
        />
      ) : (
        <div className="space-y-6">
          {groupKeys.map((month) => (
            <div key={month}>
              <h3 className="font-display font-semibold text-lg mb-2">{month}</h3>
              <div className="grid gap-3">
                {groups[month]!.map((t) => {
                  const c = (t as { clients?: { name: string } | null }).clients;
                  const originalDue = t.original_due_date ?? t.due_date;
                  const isCarryOver =
                    t.status !== "completed" &&
                    originalDue !== null &&
                    differenceInCalendarDays(today, parseISO(originalDue)) > 0;
                  return (
                    <div key={t.id} className={`card-soft p-4 ${isCarryOver ? "border-warning/50 bg-warning/5" : ""}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium">{t.title}</h4>
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
                            {t.due_date && <> · Due {format(parseISO(t.due_date), "MMM d, yyyy")}</>}
                          </div>
                          {t.description && (
                            <p className="text-sm text-muted-foreground mt-2">{t.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
