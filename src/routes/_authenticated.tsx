import { createFileRoute, Navigate, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2, LayoutDashboard, Users, Briefcase, ListChecks, Clock, Wallet, LogOut, Sparkles, CalendarCheck, Target, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notification-bell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

function AuthLayout() {
  const { loading, session, profile, role, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" />;

  const adminNav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/employees", label: "Employees", icon: Users },
    { to: "/clients", label: "Clients", icon: Briefcase },
    { to: "/tasks", label: "Tasks", icon: ListChecks },
    { to: "/attendance", label: "Attendance", icon: Clock },
    { to: "/payments", label: "Payments", icon: Wallet },
    { to: "/reports", label: "Reports", icon: BarChart3 },
  ];
  const empNav = [
    { to: "/", label: "My Day", icon: LayoutDashboard, exact: true },
    { to: "/my-tasks", label: "Daily Tasks", icon: ListChecks },
    { to: "/my-targets", label: "Monthly Targets", icon: Target },
    { to: "/my-attendance", label: "Attendance", icon: CalendarCheck },
  ];
  const nav = isAdmin ? adminNav : empNav;

  const handleSignOut = async () => {
    const name = profile?.full_name?.split(" ")[0];
    await signOut();
    toast.success(name ? `See you soon, ${name}! 👋` : "See you soon! 👋");
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 hidden md:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-5 flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg brand-gradient grid place-items-center text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display font-bold leading-tight">Cupid Digital</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {role ?? "—"}
            </div>
          </div>
        </div>
        <nav className="px-3 py-2 flex-1 space-y-1">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 space-y-2">
          <div className="px-2 py-1 flex items-center justify-between gap-2">
            <div className="text-sm min-w-0">
              <div className="font-medium truncate">{profile?.full_name ?? "User"}</div>
              <div className="text-xs text-muted-foreground truncate">@{profile?.username}</div>
            </div>
            <NotificationBell />
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {/* mobile top bar */}
        <div className="md:hidden flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2 font-display font-bold">
            <Sparkles className="h-5 w-5 text-primary" /> Cupid Digital
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="md:hidden flex overflow-x-auto gap-1 border-b border-border bg-card px-2 py-2">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-md text-xs font-medium",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <Outlet />
      </main>
    </div>
  );
}
