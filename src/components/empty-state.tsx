import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondary,
  variant = "card",
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  secondary?: ReactNode;
  /** "card" wraps in card-soft styling; "bare" assumes the parent already has it */
  variant?: "card" | "bare";
}) {
  const ActionIcon = action?.icon;
  const inner = (
    <div className="flex flex-col items-center text-center px-6 py-14 sm:py-16">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-secondary mb-4 ring-1 ring-border">
        <Icon className="h-7 w-7 text-primary" aria-hidden />
      </div>
      <h3 className="font-display font-semibold text-lg text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {(action || secondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button onClick={action.onClick}>
              {ActionIcon && <ActionIcon className="h-4 w-4 mr-1.5" aria-hidden />}
              {action.label}
            </Button>
          )}
          {secondary}
        </div>
      )}
    </div>
  );
  return variant === "card" ? <div className="card-soft">{inner}</div> : inner;
}
