import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "@tanstack/react-router";

export function NotificationBell() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: items } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user || !isAdmin) return;

    // Clean up any stale channel from StrictMode double-mount
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ch = supabase
      .channel("notifications:" + user.id + ":" + crypto.randomUUID())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      if (channelRef.current === ch) channelRef.current = null;
    };
  }, [user, isAdmin, qc]);

  if (!isAdmin) return null;

  const unread = (items ?? []).filter((n) => !n.is_read).length;

  const markRead = async (id: string, link?: string | null) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user!.id] });
    if (link) navigate({ to: link });
  };

  const markAll = async () => {
    await supabase.from("notifications").update({ is_read: true }).eq("recipient_id", user!.id).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications", user!.id] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-medium text-sm">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll} className="h-7 text-xs">
              <Check className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {(items ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up 🎉</div>
          ) : (
            (items ?? []).map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id, n.link)}
                className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 ${!n.is_read ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
