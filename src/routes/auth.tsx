import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAccounts } from "@/lib/bootstrap.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, Eye, EyeOff, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Cupid Digital" }] }),
  component: AuthPage,
});

const quickUsers = [
  { username: "abi", name: "Abi", emoji: "🎨" },
  { username: "rishi", name: "Rishi", emoji: "🎬" },
  { username: "nami", name: "Nami", emoji: "✨" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bootstrapAccounts()
      .catch(() => null)
      .finally(() => setBootstrapping(false));
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const pickUser = (u: string) => {
    setUsername(u);
    setTimeout(() => pwRef.current?.focus(), 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setSubmitting(true);
    const email = username.includes("@")
      ? username
      : `${username.toLowerCase()}@cupiddigital.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("Wrong username or password. Please try again.");
      return;
    }
    const displayName = quickUsers.find((q) => q.username === username.toLowerCase())?.name
      ?? username.charAt(0).toUpperCase() + username.slice(1);
    toast.success(`Welcome back, ${displayName}! 👋`);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 brand-gradient text-primary-foreground">
        <div className="flex items-center gap-2 text-2xl font-display font-bold">
          <Sparkles className="h-7 w-7" />
          Cupid Digital
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-5xl font-display font-bold leading-tight">
            Run your creative studio without the chaos.
          </h1>
          <p className="text-lg opacity-90">
            Daily tasks, client deliverables, attendance, and payments — all in
            one calm green workspace.
          </p>
        </div>
        <p className="text-sm opacity-75">© Cupid Digital · Internal Use</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-2 text-xl font-display font-bold text-primary">
            <Sparkles className="h-6 w-6" /> Cupid Digital
          </div>
          <div>
            <h2 className="text-3xl font-display font-bold">Welcome back 👋</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tap your name to sign in quickly.
            </p>
          </div>

          {/* Quick pick chips */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              I am…
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {quickUsers.map((u) => {
                const active = username.toLowerCase() === u.username;
                return (
                  <button
                    type="button"
                    key={u.username}
                    onClick={() => pickUser(u.username)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border p-3 transition-all hover:shadow-sm hover:-translate-y-0.5",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    <div className="h-10 w-10 rounded-full grid place-items-center text-xl bg-secondary">
                      {u.emoji}
                    </div>
                    <div className="text-sm font-medium">{u.name}</div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => pickUser("HROFFICIAL")}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium transition-colors",
                username === "HROFFICIAL"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-dashed border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Shield className="h-4 w-4" /> Admin sign-in
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. abi"
                  autoComplete="username"
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  ref={pwRef}
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-base"
              disabled={submitting || bootstrapping}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign in
            </Button>
          </form>

          {bootstrapping && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center">
              <Loader2 className="h-3 w-3 animate-spin" /> Preparing accounts…
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
