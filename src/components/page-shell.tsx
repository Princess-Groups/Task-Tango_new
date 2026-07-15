import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: "primary" | "accent" | "warning" | "success" | "destructive";
}) {
  const ring = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/40 text-accent-foreground",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/10 text-destructive",
  }[accent ?? "primary"];

  return (
    <div className="card-soft p-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        <div className="mt-1 text-2xl font-display font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </div>
      {icon && (
        <div className={cn("h-10 w-10 rounded-lg grid place-items-center shrink-0", ring)}>
          {icon}
        </div>
      )}
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="p-4 sm:p-8 max-w-[1400px] mx-auto">{children}</div>;
}
