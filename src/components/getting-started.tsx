import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Sparkles, X } from "lucide-react";

const DISMISS_KEY = "cupid.gettingStarted.dismissed";

export function GettingStarted() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const { data: counts } = useQuery({
    queryKey: ["onboarding-counts"],
    queryFn: async () => {
      const [emps, clients, tasks, payments] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_archived", false),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("id", { count: "exact", head: true }),
      ]);
      return {
        employees: emps.count ?? 0,
        clients: clients.count ?? 0,
        tasks: tasks.count ?? 0,
        payments: payments.count ?? 0,
      };
    },
  });

  if (dismissed || !counts) return null;

  // 1 admin + 3 seeded employees = 4. Treat anything beyond seeds as "added their own".
  const steps = [
    { done: counts.employees > 4, label: "Add or review your team", to: "/employees" as const },
    { done: counts.clients > 0, label: "Add your first client", to: "/clients" as const },
    { done: counts.tasks > 0, label: "Create your first task", to: "/tasks" as const },
    { done: counts.payments > 0, label: "Log a payment record", to: "/payments" as const },
  ];
  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="card-soft p-5 sm:p-6 mb-6 relative overflow-hidden">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss getting started"
        className="absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent shrink-0">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-base sm:text-lg">Welcome to Cupid Digital</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            A few quick steps to get your studio set up. Check them off as you go.
          </p>
        </div>
      </div>
      <ul className="mt-4 grid sm:grid-cols-2 gap-2">
        {steps.map((s) => (
          <li key={s.label}>
            <Link
              to={s.to}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-3 hover:bg-secondary transition-colors"
            >
              {s.done ? (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" aria-hidden />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
              )}
              <span className={`text-sm ${s.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                {s.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={dismiss}>Hide this</Button>
      </div>
    </div>
  );
}
