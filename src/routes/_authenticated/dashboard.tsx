import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/external/client";
import { Users, HeartPulse, Radio, Activity, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · LifeLink" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [stats, setStats] = useState({ donors: 0, recipients: 0, matches: 0, transplants: 0 });
  const [urgent, setUrgent] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [d, r, m, h, u] = await Promise.all([
        supabase.from("donors").select("*", { count: "exact", head: true }).eq("status", "available"),
        supabase.from("recipients").select("*", { count: "exact", head: true }).eq("status", "waiting"),
        supabase.from("matches").select("*", { count: "exact", head: true }),
        supabase.from("donation_history").select("*", { count: "exact", head: true }),
        supabase.from("recipients").select("*").eq("urgency", "critical").eq("status", "waiting").limit(5),
      ]);
      setStats({
        donors: d.count ?? 0,
        recipients: r.count ?? 0,
        matches: m.count ?? 0,
        transplants: h.count ?? 0,
      });
      setUrgent(u.data ?? []);
    };
    load();
    const ch = supabase
      .channel("dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "donors" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "recipients" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Live overview</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users />} label="Available donors" value={stats.donors} href="/donors" tint="primary" />
        <StatCard icon={<HeartPulse />} label="Waiting recipients" value={stats.recipients} href="/recipients" tint="accent" />
        <StatCard icon={<Radio />} label="Active matches" value={stats.matches} href="/matches" tint="primary" />
        <StatCard icon={<Activity />} label="Transplants completed" value={stats.transplants} href="/history" tint="success" />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">Critical recipients</h2>
            <p className="text-sm text-muted-foreground">Patients whose need is time-sensitive.</p>
          </div>
          <Link to="/recipients" className="text-sm font-medium text-primary hover:underline">View all →</Link>
        </div>
        {urgent.length === 0 ? (
          <p className="rounded-lg bg-muted p-6 text-sm text-muted-foreground">No critical cases right now.</p>
        ) : (
          <ul className="divide-y divide-border">
            {urgent.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{r.full_name} <span className="text-muted-foreground font-normal">· {r.city}</span></p>
                  <p className="text-xs text-muted-foreground">Needs {r.organ_needed.replace("_", " ")} · Blood {r.blood_type}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                  <span className="size-1.5 rounded-full bg-destructive" /> Critical
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, href, tint }: { icon: React.ReactNode; label: string; value: number; href: string; tint: "primary" | "accent" | "success" }) {
  const tintCls = tint === "accent" ? "bg-accent/10 text-accent" : tint === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary";
  return (
    <Link to={href} className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow">
      <div className="flex items-center justify-between">
        <div className={`grid size-10 place-items-center rounded-lg ${tintCls}`}>{icon}</div>
        <ArrowRight className="size-4 opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="mt-4 font-display text-4xl font-semibold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Link>
  );
}
