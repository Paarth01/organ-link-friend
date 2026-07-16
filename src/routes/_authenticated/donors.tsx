import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BLOOD_TYPES, ORGANS, organLabel } from "@/lib/organ";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, User, Trash2 } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/donors")({
  head: () => ({ meta: [{ title: "Donors · LifeLink" }] }),
  component: DonorsPage,
});

const donorSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  age: z.number().int().min(1).max(119),
  blood_type: z.enum(BLOOD_TYPES),
  organ: z.enum(ORGANS),
  city: z.string().trim().min(1).max(100),
  hospital_name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  medical_notes: z.string().trim().max(1000).optional(),
});

function DonorsPage() {
  const { user } = useAuth();
  const [donors, setDonors] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("donors").select("*").order("created_at", { ascending: false });
      setDonors(data ?? []);
    };
    load();
    const ch = supabase.channel("donors-list").on("postgres_changes", { event: "*", schema: "public", table: "donors" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const remove = async (id: string) => {
    const { error } = await supabase.from("donors").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Donor removed");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-accent">Registry</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Donors</h1>
          <p className="mt-2 text-muted-foreground">Registered organ donors across the network.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-hero-gradient text-primary-foreground shadow-soft hover:opacity-95">
              <Plus className="mr-2 size-4" /> Register donor
            </Button>
          </DialogTrigger>
          <DonorForm onDone={() => setOpen(false)} userId={user?.id} />
        </Dialog>
      </div>

      {donors.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {donors.map((d) => (
            <article key={d.id} className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:shadow-glow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><User className="size-5" /></div>
                  <div>
                    <h3 className="font-semibold">{d.full_name}</h3>
                    <p className="text-xs text-muted-foreground">Age {d.age} · {d.city}</p>
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Organ</dt><dd className="font-medium">{organLabel(d.organ)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Blood type</dt><dd className="font-medium">{d.blood_type}</dd></div>
                {d.hospital_name && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Hospital</dt><dd className="font-medium">{d.hospital_name}</dd></div>}
              </dl>
              {user && d.user_id === user.id && (
                <button onClick={() => remove(d.id)} className="mt-4 inline-flex items-center gap-1 text-xs text-destructive opacity-0 transition group-hover:opacity-100">
                  <Trash2 className="size-3" /> Remove
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-16 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-xl bg-secondary text-primary"><User className="size-6" /></div>
      <p className="mt-4 font-display text-xl">No donors yet</p>
      <p className="mt-1 text-sm text-muted-foreground">Register the first donor to activate the network.</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: "bg-success/10 text-success",
    matched: "bg-warning/20 text-warning-foreground",
    donated: "bg-primary/10 text-primary",
    withdrawn: "bg-muted text-muted-foreground",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] ?? "bg-muted"}`}>{status}</span>;
}

function DonorForm({ onDone, userId }: { onDone: () => void; userId?: string }) {
  const [f, setF] = useState<any>({ full_name: "", age: "", blood_type: "", organ: "", city: "", hospital_name: "", phone: "", medical_notes: "" });
  const [loading, setLoading] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    try {
      const parsed = donorSchema.parse({ ...f, age: Number(f.age) });
      const { error } = await supabase.from("donors").insert({ ...parsed, user_id: userId });
      if (error) throw error;
      toast.success("Donor registered");
      onDone();
    } catch (err) {
      toast.error(err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid input" : (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Register a donor</DialogTitle>
      </DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></div>
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
            <Select value={f.organ} onValueChange={(v) => setF({ ...f, organ: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{ORGANS.map((o) => <SelectItem key={o} value={o}>{organLabel(o)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>City</Label><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required /></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        </div>
        <div><Label>Hospital</Label><Input value={f.hospital_name} onChange={(e) => setF({ ...f, hospital_name: e.target.value })} /></div>
        <div><Label>Notes</Label><Textarea value={f.medical_notes} onChange={(e) => setF({ ...f, medical_notes: e.target.value })} rows={3} /></div>
        <DialogFooter>
          <Button type="submit" disabled={loading} className="bg-hero-gradient text-primary-foreground">{loading ? "Saving…" : "Register donor"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
