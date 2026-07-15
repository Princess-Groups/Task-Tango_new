import { createServerFn } from "@tanstack/react-start";

/**
 * Idempotent bootstrap: creates the admin and the three seed employees
 * if they don't exist yet. Safe to call from a public route — only
 * provisions the fixed known accounts.
 */
export const bootstrapAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  type Seed = {
    email: string;
    password: string;
    username: string;
    full_name: string;
    role: "admin" | "employee";
  };

  const seeds: Seed[] = [
    {
      email: "hrofficial@cupiddigital.local",
      password: "212130",
      username: "HROFFICIAL",
      full_name: "HR Official",
      role: "admin",
    },
    {
      email: "abi@cupiddigital.local",
      password: "Abi@2026",
      username: "abi",
      full_name: "Abi",
      role: "employee",
    },
    {
      email: "rishi@cupiddigital.local",
      password: "Rishi@2026",
      username: "rishi",
      full_name: "Rishi",
      role: "employee",
    },
    {
      email: "nami@cupiddigital.local",
      password: "Nami@2026",
      username: "nami",
      full_name: "Nami",
      role: "employee",
    },
  ];

  const results: Array<{ email: string; created: boolean }> = [];

  for (const seed of seeds) {
    // Check if profile by username already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", seed.username)
      .maybeSingle();

    if (existingProfile) {
      results.push({ email: seed.email, created: false });
      continue;
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: seed.email,
      password: seed.password,
      email_confirm: true,
      user_metadata: { username: seed.username, full_name: seed.full_name },
    });

    if (createErr || !created.user) {
      // user may already exist in auth but not profiles — try lookup
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === seed.email);
      if (!existing) {
        results.push({ email: seed.email, created: false });
        continue;
      }
      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: existing.id,
          username: seed.username,
          full_name: seed.full_name,
          email: seed.email,
        });
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: existing.id, role: seed.role });
      results.push({ email: seed.email, created: false });
      continue;
    }

    await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      username: seed.username,
      full_name: seed.full_name,
      email: seed.email,
    });
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: seed.role });

    results.push({ email: seed.email, created: true });
  }

  return { ok: true, results };
});

/**
 * Admin-only: create a new employee account with a temp password.
 */
export const createEmployeeAccount = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { username: string; full_name: string; password: string }) => data,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // verify caller is admin via bearer token in middleware would be ideal,
    // but we trust admin RLS - this fn is invoked from admin UI behind
    // the auth gate. We still re-check by reading the caller token.
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const auth = req?.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Unauthorized");
    const token = auth.slice(7);

    const { data: claimsData, error: claimsErr } = await supabaseAdmin.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) throw new Error("Unauthorized");
    const callerId = claimsData.claims.sub;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const email = `${data.username.toLowerCase()}@cupiddigital.local`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");

    await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      username: data.username,
      full_name: data.full_name,
      email,
    });
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "employee" });

    return { ok: true, userId: created.user.id, email };
  });
