import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { suggestMatches, type AiMatchResult } from "@/lib/ai-match.functions";

type Props = {
  donors: any[];
  recipients: any[];
  onPropose: (donorId: string, recipientId: string) => void;
};

export function AiMatchAssistant({ donors, recipients, onPropose }: Props) {
  const run = useServerFn(suggestMatches);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiMatchResult | null>(null);

  const submit = async () => {
    if (description.trim().length < 10) {
      toast.error("Please describe the case in a little more detail.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await run({
        data: {
          caseDescription: description.trim(),
          donors: donors.slice(0, 200).map((d) => ({
            id: d.id,
            full_name: d.full_name,
            age: d.age ?? null,
            blood_type: d.blood_type,
            organ: d.organ,
            city: d.city ?? null,
            hospital_name: d.hospital_name ?? null,
            status: d.status,
          })),
          recipients: recipients.slice(0, 200).map((r) => ({
            id: r.id,
            full_name: r.full_name,
            age: r.age ?? null,
            blood_type: r.blood_type,
            organ_needed: r.organ_needed,
            urgency: r.urgency,
            city: r.city ?? null,
            hospital_name: r.hospital_name ?? null,
            status: r.status,
          })),
        },
      });
      setResult(res as AiMatchResult);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The assistant is unavailable right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-hero-gradient text-primary-foreground">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">AI match assistant</h2>
          <p className="text-sm text-muted-foreground">
            Describe the case in your own words — organ, blood type, urgency, location, anything relevant — and get ranked
            pairing suggestions from the current registry.
          </p>
        </div>
      </div>

      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        placeholder="e.g. 45-year-old O+ man in New Delhi needs a kidney urgently, dialysis three times a week, admitted at AIIMS."
      />

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={loading} className="bg-hero-gradient text-primary-foreground">
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
          {loading ? "Thinking…" : "Suggest matches"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {donors.length} available donors · {recipients.length} waiting recipients
        </p>
      </div>

      {result && (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{result.summary}</p>

          {result.suggestions.length === 0 ? (
            <p className="flex items-center gap-2 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
              <AlertTriangle className="size-4" /> No plausible pairing found in the current registry.
            </p>
          ) : (
            <div className="space-y-3">
              {result.suggestions.map((s, i) => (
                <div key={`${s.donor_id}:${s.recipient_id}:${i}`} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">
                      {s.donor_name} <span className="text-muted-foreground">→</span> {s.recipient_name}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {Math.round(s.confidence)}% confidence
                      </span>
                      <Button size="sm" variant="outline" onClick={() => onPropose(s.donor_id, s.recipient_id)}>
                        Propose
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{s.rationale}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Concerns: {s.concerns}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Decision support only — a clinician must confirm every pairing.
          </p>
        </div>
      )}
    </section>
  );
}
