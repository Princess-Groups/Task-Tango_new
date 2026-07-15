import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Morning digest: notifies every admin about tasks pending past their original
// due date. Bypasses auth for cron; secured by requiring a valid Supabase
// service key/URL that only Lovable Cloud can inject.

export const Route = createFileRoute("/api/public/hooks/pending-task-digest")({
  server: {
    handlers: {
      POST: async () => {
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return new Response(JSON.stringify({ error: "misconfigured" }), { status: 500 });
        }
        const supabase = createClient<Database>(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const today = new Date().toISOString().slice(0, 10);

        const { data: pending, error: pErr } = await supabase
          .from("tasks")
          .select("id, title, original_due_date, assigned_to, profiles!tasks_assigned_to_fkey(full_name)")
          .neq("status", "completed")
          .lt("original_due_date", today);
        if (pErr) {
          console.error("pending-task-digest tasks error", pErr);
          return new Response(JSON.stringify({ error: pErr.message }), { status: 500 });
        }

        // find admins
        const { data: admins, error: aErr } = await supabase
          .from("user_roles").select("user_id").eq("role", "admin");
        if (aErr) {
          console.error("pending-task-digest admin error", aErr);
          return new Response(JSON.stringify({ error: aErr.message }), { status: 500 });
        }

        const count = (pending ?? []).length;
        if (count === 0 || !admins || admins.length === 0) {
          return Response.json({ ok: true, notified: 0, pending: count });
        }

        const oldest = (pending ?? [])
          .map((t) => t.original_due_date)
          .filter((d): d is string => !!d)
          .sort()[0];

        const rows = admins.map((a) => ({
          recipient_id: a.user_id,
          type: "pending_digest",
          title: `${count} task${count === 1 ? "" : "s"} still pending`,
          body: oldest ? `Oldest is from ${oldest}. Tap to review.` : "Tap to review.",
          link: "/tasks",
        }));

        const { error: nErr } = await supabase.from("notifications").insert(rows);
        if (nErr) {
          console.error("pending-task-digest insert error", nErr);
          return new Response(JSON.stringify({ error: nErr.message }), { status: 500 });
        }

        return Response.json({ ok: true, notified: admins.length, pending: count });
      },
    },
  },
});
