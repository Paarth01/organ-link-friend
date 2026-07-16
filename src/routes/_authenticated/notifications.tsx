import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";
import { Bell, BellOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · LifeLink" }] }),
  component: NotifPage,
});

function NotifPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setItems(data ?? []);
    };
    load();
    const ch = supabase.channel("notifs").on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const markRead = async (id: string) => { await supabase.from("notifications").update({ read: true }).eq("id", id); };
  const markAll = async () => { if (!user) return; await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false); };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-accent">Inbox</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Notifications</h1>
        </div>
        {items.some((i) => !i.read) && (
          <Button variant="outline" size="sm" onClick={markAll}><Check className="mr-1 size-4" /> Mark all read</Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground"><BellOff className="size-6" /></div>
          <p className="mt-4 font-display text-xl">No notifications</p>
          <p className="text-sm text-muted-foreground">You're all caught up.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-2xl border p-4 transition ${n.read ? "border-border bg-card" : "border-primary/30 bg-primary/5 shadow-soft"}`}
              onClick={() => !n.read && markRead(n.id)}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 grid size-9 place-items-center rounded-full ${n.read ? "bg-muted text-muted-foreground" : "bg-hero-gradient text-primary-foreground"}`}>
                  <Bell className="size-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{n.title}</p>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                  {n.link && (
                    <Link to={n.link} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Open →</Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
