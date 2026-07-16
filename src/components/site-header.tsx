import { Link, useRouter } from "@tanstack/react-router";
import { HeartPulse, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const { user } = useAuth();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("notif-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-hero-gradient text-primary-foreground shadow-soft">
            <HeartPulse className="size-5" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">LifeLink</span>
        </Link>

        {user ? (
          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link to="/dashboard" className="rounded-md px-3 py-2 hover:bg-muted">Dashboard</Link>
            <Link to="/donors" className="rounded-md px-3 py-2 hover:bg-muted">Donors</Link>
            <Link to="/recipients" className="rounded-md px-3 py-2 hover:bg-muted">Recipients</Link>
            <Link to="/matches" className="rounded-md px-3 py-2 hover:bg-muted">Matches</Link>
            <Link to="/history" className="rounded-md px-3 py-2 hover:bg-muted">History</Link>
            <Link
              to="/notifications"
              className="relative ml-2 rounded-md p-2 hover:bg-muted"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 grid min-w-[1.1rem] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut} className="ml-2">
              <LogOut className="mr-1 size-4" /> Sign out
            </Button>
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Link to="/auth" className="text-sm font-medium hover:text-primary">Sign in</Link>
            <Button asChild size="sm" className="bg-hero-gradient text-primary-foreground shadow-soft hover:opacity-90">
              <Link to="/auth">Get started</Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}
