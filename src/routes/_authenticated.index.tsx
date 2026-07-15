import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin-dashboard";
import { EmployeeDay } from "@/components/employee-day";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

function Home() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  return isAdmin ? <AdminDashboard /> : <EmployeeDay />;
}
