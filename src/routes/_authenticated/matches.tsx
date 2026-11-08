import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/external/client";
import { useAuth } from "@/hooks/use-auth";
import { isCompatible, organLabel } from "@/lib/organ";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Radio, ArrowRightLeft, Check, X } from "lucide-react";
import { AiMatchAssistant } from "@/components/ai-match-assistant";
import { canCompleteMatch, canConfirmMatch, hasAssignedHospital } from "@/lib/match-pipeline";

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
  const [hospitalAssignments, setHospitalAssignments] = useState<Record<string, string>>({});

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
  }, [load]);

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
    if (!user) {
      toast.error("Please sign in again to propose a match.");
      return;
    }

    // Resolve from the loaded lists, or fall back to the database (AI suggestions
    // may point at records that are no longer in the available/waiting lists).
    let donor = donors.find((x) => x.id === donorId) ?? null;
    let recipient = recipients.find((x) => x.id === recipientId) ?? null;
    if (!donor) donor = (await supabase.from("donors").select("*").eq("id", donorId).maybeSingle()).data;
    if (!recipient) recipient = (await supabase.from("recipients").select("*").eq("id", recipientId).maybeSingle()).data;
    if (!donor || !recipient) {
      toast.error("That donor or recipient no longer exists.");
      await load();
      return;
    }

    const { data: inserted, error } = await supabase
      .from("matches")
      .insert({ donor_id: donor.id, recipient_id: recipient.id, created_by: user.id, status: "proposed" })
      .select("*, donor:donor_id(*), recipient:recipient_id(*)")
      .single();

    if (error) {
      if (error.code === "23505") toast.error("That pairing has already been proposed.");
      else toast.error(error.message || "Could not save the match.");
      await load();
      return;
    }

    // Show it immediately, then reconcile with the database.
    setMatches((prev) => [inserted, ...prev.filter((m) => m.id !== inserted.id)]);
    toast.success(`Match proposed: ${donor.full_name} → ${recipient.full_name}`);

    const notification = {
      title: "New match proposed",
      message: `${donor.full_name} (${donor.blood_type}, ${organLabel(donor.organ)}) → ${recipient.full_name} (${recipient.blood_type}, ${recipient.urgency}).`,
      link: "/matches",
    };

    // Own notification first: it is always permitted, so the bell updates live.
    const { error: notifyError } = await supabase
      .from("notifications")
      .insert({ ...notification, user_id: user.id });
    if (notifyError) console.error("[matches] own notification insert failed", notifyError);

    // Notifying the other parties only succeeds for admins; ignore a permission error.
    const others = [donor.user_id, recipient.user_id].filter(
      (uid): uid is string => !!uid && uid !== user.id,
    );
    for (const uid of new Set(others)) {
      await supabase.from("notifications").insert({ ...notification, user_id: uid });
    }

    await load();
  };

  const confirmMatch = async (m: any) => {
    const hospital_name = (
      hospitalAssignments[m.id] ?? m.hospital_name ?? m.recipient?.hospital_name ?? m.donor?.hospital_name ?? ""
    ).trim();
    if (!hasAssignedHospital(hospital_name)) {
      toast.error("Assign a hospital before confirming this match.");
      return;
    }
    if (!canConfirmMatch(m.status, hospital_name, m.donor?.status ?? "", m.recipient?.status ?? "")) {
      toast.error("This donor or recipient is no longer available for confirmation.");
      await load();
      return;
    }

    const rpcClient = supabase as unknown as {
      rpc: (
        functionName: "confirm_match" | "reject_match",
        args: { p_match_id: string; p_hospital_name?: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await rpcClient.rpc("confirm_match", {
      p_match_id: m.id,
      p_hospital_name: hospital_name,
    });
    if (error) {
      toast.error(error.message || "Could not confirm this match.");
      await load();
      return;
    }

    toast.success(`Match confirmed at ${hospital_name}`);
    await load();
  };

  const rejectMatch = async (m: any) => {
    const rpcClient = supabase as unknown as {
      rpc: (
        functionName: "reject_match",
        args: { p_match_id: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await rpcClient.rpc("reject_match", { p_match_id: m.id });
    if (error) {
      toast.error(error.message || "Could not reject this match.");
      return;
    }
    toast.success("Match rejected");
    await load();
  };

  const completeMatch = async (m: any) => {
    if (!canCompleteMatch(m.status)) return;

    const rpcClient = supabase as unknown as {
      rpc: (
        functionName: "complete_match",
        args: { p_match_id: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await rpcClient.rpc("complete_match", { p_match_id: m.id });
    if (error) {
      toast.error(error.message || "Could not complete this match.");
      await load();
      return;
    }

    toast.success("Transplant completed and added to donation history.");
    await load();
  };

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Coordination</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Matches</h1>
      </div>

      <AiMatchAssistant
        donors={donors}
        recipients={recipients}
        excludedPairs={matches.map((m) => `${m.donor_id}:${m.recipient_id}`)}
        onPropose={propose}
      />

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
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`hospital-${m.id}`}>Assigned hospital</label>
                      <Input
                        id={`hospital-${m.id}`}
                        aria-label={`Assigned hospital for ${m.donor?.full_name ?? "donor"} and ${m.recipient?.full_name ?? "recipient"}`}
                        className="w-48"
                        placeholder="Assign hospital"
                        value={hospitalAssignments[m.id] ?? m.hospital_name ?? m.recipient?.hospital_name ?? m.donor?.hospital_name ?? ""}
                        onChange={(event) => setHospitalAssignments((current) => ({ ...current, [m.id]: event.target.value }))}
                      />
                      <Button size="sm" variant="outline" onClick={() => confirmMatch(m)}><Check className="mr-1 size-3" /> Confirm</Button>
                      <Button size="sm" variant="ghost" onClick={() => rejectMatch(m)}><X className="mr-1 size-3" /> Reject</Button>
                    </div>
                  )}
                  {canCompleteMatch(m.status) && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-muted-foreground">{m.hospital_name || "Hospital not assigned"}</span>
                      <Button size="sm" onClick={() => completeMatch(m)} className="bg-success text-success-foreground hover:opacity-90">Mark completed</Button>
                    </div>
                  )}
                  {m.status === "completed" && m.hospital_name && (
                    <span className="text-sm text-muted-foreground">Completed at {m.hospital_name}</span>
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
