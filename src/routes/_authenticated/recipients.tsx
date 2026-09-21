import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/external/client";
import { useAuth } from "@/hooks/use-auth";
import { BLOOD_TYPES, ORGANS, URGENCY, organLabel } from "@/lib/organ";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, HeartPulse, Trash2 } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/recipients")({
  head: () => ({ meta: [{ title: "Recipients · LifeLink" }] }),
  component: RecipientsPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  age: z.number().int().min(1).max(119),
  blood_type: z.enum(BLOOD_TYPES),
  organ_needed: z.enum(ORGANS),
  urgency: z.enum(URGENCY),
  city: z.string().trim().min(1).max(100),
  hospital_name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  medical_notes: z.string().trim().max(1000).optional(),
});

function RecipientsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("recipients").select("*").order("urgency", { ascending: false }).order("created_at", { ascending: false });
      // Sort critical > urgent > routine
      const rank: any = { critical: 0, urgent: 1, routine: 2 };
      setItems((data ?? []).sort((a, b) => rank[a.urgency] - rank[b.urgency]));
    };
    load();
    const ch = supabase.channel("recips").on("postgres_changes", { event: "*", schema: "public", table: "recipients" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const remove = async (id: string) => {
    const { error } = await supabase.from("recipients").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Recipient removed");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-accent">Registry</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Recipients</h1>
          <p className="mt-2 text-muted-foreground">Patients waiting for a transplant, ordered by urgency.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-hero-gradient text-primary-foreground shadow-soft hover:opacity-95">
              <Plus className="mr-2 size-4" /> Add recipient
            </Button>
          </DialogTrigger>
          <RecipForm onDone={() => setOpen(false)} userId={user?.id} />
        </Dialog>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-secondary text-accent"><HeartPulse className="size-6" /></div>
          <p className="mt-4 font-display text-xl">No recipients yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-4 text-left">Patient</th>
                <th className="p-4 text-left">Needs</th>
                <th className="p-4 text-left">Blood</th>
                <th className="p-4 text-left">Urgency</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="p-4">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">Age {r.age} · {r.city}</div>
                  </td>
                  <td className="p-4">{organLabel(r.organ_needed)}</td>
                  <td className="p-4 font-medium">{r.blood_type}</td>
                  <td className="p-4"><UrgencyBadge u={r.urgency} /></td>
                  <td className="p-4 capitalize text-muted-foreground">{r.status}</td>
                  <td className="p-4 text-right">
                    {user && r.user_id === user.id && (
                      <button onClick={() => remove(r.id)} className="text-destructive hover:opacity-80"><Trash2 className="size-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UrgencyBadge({ u }: { u: string }) {
  const map: Record<string, string> = {
    critical: "bg-destructive/10 text-destructive",
    urgent: "bg-warning/20 text-warning-foreground",
    routine: "bg-muted text-muted-foreground",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[u]}`}>{u}</span>;
}

function RecipForm({ onDone, userId }: { onDone: () => void; userId?: string }) {
  const [f, setF] = useState<any>({ full_name: "", age: "", blood_type: "", organ_needed: "", urgency: "routine", city: "", hospital_name: "", phone: "", medical_notes: "" });
  const [loading, setLoading] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    try {
      const parsed = schema.parse({ ...f, age: Number(f.age) });
      const { error } = await supabase.from("recipients").insert({ ...parsed, user_id: userId });
      if (error) throw error;
      toast.success("Recipient added");
      onDone();
    } catch (err) {
      toast.error(err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid input" : (err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle className="font-display text-2xl">Add a recipient</DialogTitle></DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div><Label>Patient name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Age</Label><Input type="number" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} required /></div>
          <div>
            <Label>Blood</Label>
            <Select value={f.blood_type} onValueChange={(v) => setF({ ...f, blood_type: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{BLOOD_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Organ</Label>
            <Select value={f.organ_needed} onValueChange={(v) => setF({ ...f, organ_needed: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{ORGANS.map((o) => <SelectItem key={o} value={o}>{organLabel(o)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Urgency</Label>
            <Select value={f.urgency} onValueChange={(v) => setF({ ...f, urgency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{URGENCY.map((u) => <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>City</Label><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Hospital</Label><Input value={f.hospital_name} onChange={(e) => setF({ ...f, hospital_name: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={f.medical_notes} onChange={(e) => setF({ ...f, medical_notes: e.target.value })} rows={3} /></div>
        <DialogFooter>
          <Button type="submit" disabled={loading} className="bg-hero-gradient text-primary-foreground">{loading ? "Saving…" : "Add recipient"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
