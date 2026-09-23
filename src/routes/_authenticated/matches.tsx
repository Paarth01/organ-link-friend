import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/external/client";
import { useAuth } from "@/hooks/use-auth";
import { isCompatible, organLabel } from "@/lib/organ";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Radio, ArrowRightLeft, Check, X } from "lucide-react";
import { AiMatchAssistant } from "@/components/ai-match-assistant";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({
    meta: [
      { title: "Matches · LifeLink" },
      {
        name: "description",
        content:
          "Review compatible donor-recipient pairings, get AI-assisted match suggestions, and move cases from proposal to transplant.",
      },
      { property: "og:title", content: "Matches · LifeLink" },
      {
        property: "og:description",
        content: "AI-assisted donor-recipient matching and transplant coordination pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchesPage,
});

function MatchesPage() {
  const { user } = useAuth();
  const [donors, setDonors] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);

  const load = useCallback(async () => {
    const [d, r, m] = await Promise.all([
      supabase.from("donors").select("*").eq("status", "available"),
      supabase.from("recipients").select("*").eq("status", "waiting"),
      supabase.from("matches").select("*, donor:donor_id(*), recipient:recipient_id(*)").order("created_at", { ascending: false }),
    ]);
    setDonors(d.data ?? []);
    setRecipients(r.data ?? []);
    setMatches(m.data ?? []);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("mx")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "donors" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "recipients" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const suggestions = useMemo(() => {
    const proposedPairs = new Set(matches.map((m) => `${m.donor_id}:${m.recipient_id}`));
    const out: { donor: any; recipient: any }[] = [];
    for (const d of donors) {
      for (const r of recipients) {
        if (isCompatible(d, r) && !proposedPairs.has(`${d.id}:${r.id}`)) out.push({ donor: d, recipient: r });
      }
    }
    return out.slice(0, 20);
  }, [donors, recipients, matches]);

  const propose = async (donorId: string, recipientId: string) => {
    if (!user) return;
    const { error } = await supabase.from("matches").insert({ donor_id: donorId, recipient_id: recipientId, created_by: user.id, status: "proposed" });
    if (error) toast.error(error.message);
    else {
      toast.success("Match proposed");
      // notify donor + recipient owners
      const donor = donors.find((x) => x.id === donorId);
      const recip = recipients.find((x) => x.id === recipientId);
      if (donor?.user_id) await supabase.from("notifications").insert({ user_id: donor.user_id, title: "New match proposed", message: `A potential match has been proposed for ${donor.full_name}.`, link: "/matches" });
      if (recip?.user_id && recip.user_id !== donor?.user_id) await supabase.from("notifications").insert({ user_id: recip.user_id, title: "New match proposed", message: `A potential donor has been proposed for ${recip.full_name}.`, link: "/matches" });
    }
  };

  const updateStatus = async (m: any, status: "accepted" | "rejected" | "completed") => {
    const { error } = await supabase.from("matches").update({ status }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Match ${status}`);
    if (status === "completed" && m.donor && m.recipient) {
      // Record history + update donor/recipient status
      await Promise.all([
        supabase.from("donation_history").insert({
          match_id: m.id,
          donor_name: m.donor.full_name,
          recipient_name: m.recipient.full_name,
          organ: m.donor.organ,
          hospital_name: m.recipient.hospital_name ?? m.donor.hospital_name ?? null,
        }),
        supabase.from("donors").update({ status: "donated" }).eq("id", m.donor_id),
        supabase.from("recipients").update({ status: "transplanted" }).eq("id", m.recipient_id),
      ]);
    } else if (status === "accepted") {
      await Promise.all([
        supabase.from("donors").update({ status: "matched" }).eq("id", m.donor_id),
        supabase.from("recipients").update({ status: "matched" }).eq("id", m.recipient_id),
      ]);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Coordination</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Matches</h1>
      </div>

      <AiMatchAssistant donors={donors} recipients={recipients} onPropose={propose} />

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Compatible suggestions</h2>
        {suggestions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">No new compatible pairs.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {suggestions.map(({ donor, recipient }) => (
              <div key={`${donor.id}:${recipient.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-widest text-primary">Donor</p>
                  <p className="font-semibold">{donor.full_name}</p>
                  <p className="text-xs text-muted-foreground">{donor.blood_type} · {organLabel(donor.organ)}</p>
                </div>
                <ArrowRightLeft className="size-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-widest text-accent">Recipient</p>
                  <p className="font-semibold">{recipient.full_name}</p>
                  <p className="text-xs text-muted-foreground">{recipient.blood_type} · {recipient.urgency}</p>
                </div>
                <Button size="sm" onClick={() => propose(donor.id, recipient.id)} className="bg-hero-gradient text-primary-foreground">Propose</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Match pipeline</h2>
        {matches.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">No matches yet.</p>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <div key={m.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><Radio className="size-5" /></div>
                  <div>
                    <p className="font-medium">
                      {m.donor?.full_name ?? "—"} <span className="text-muted-foreground">→</span> {m.recipient?.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.donor && organLabel(m.donor.organ)} · {m.donor?.blood_type} → {m.recipient?.blood_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MatchBadge status={m.status} />
                  {m.status === "proposed" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(m, "accepted")}><Check className="mr-1 size-3" /> Accept</Button>
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(m, "rejected")}><X className="mr-1 size-3" /> Reject</Button>
                    </>
                  )}
                  {m.status === "accepted" && (
                    <Button size="sm" onClick={() => updateStatus(m, "completed")} className="bg-success text-success-foreground hover:opacity-90">Mark completed</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MatchBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    proposed: "bg-warning/20 text-warning-foreground",
    accepted: "bg-primary/10 text-primary",
    rejected: "bg-muted text-muted-foreground",
    completed: "bg-success/10 text-success",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${map[status]}`}>{status}</span>;
}
