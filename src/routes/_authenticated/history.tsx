import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { organLabel } from "@/lib/organ";
import { format } from "date-fns";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History · LifeLink" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("donation_history").select("*").order("completed_at", { ascending: false }).then(({ data }) => setRows(data ?? []));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Archive</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Donation history</h1>
        <p className="mt-2 text-muted-foreground">A complete, permanent record of transplants coordinated through LifeLink.</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground"><Activity className="size-6" /></div>
          <p className="mt-4 font-display text-xl">No transplants yet</p>
          <p className="text-sm text-muted-foreground">Completed matches will appear here.</p>
        </div>
      ) : (
        <ol className="relative space-y-6 border-l-2 border-border pl-8">
          {rows.map((r) => (
            <li key={r.id} className="relative">
              <span className="absolute -left-[41px] top-1 grid size-8 place-items-center rounded-full bg-hero-gradient text-primary-foreground shadow-glow">
                <Activity className="size-4" />
              </span>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {r.donor_name} <span className="text-muted-foreground">→</span> {r.recipient_name}
                  </p>
                  <span className="text-xs text-muted-foreground">{format(new Date(r.completed_at), "PP")}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {organLabel(r.organ)}{r.hospital_name ? ` · ${r.hospital_name}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
