import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HeartPulse, ShieldCheck, Radio, Users, Activity, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import heroImg from "@/assets/hero-lifelink.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LifeLink — Bridging donors, recipients, and hospitals" },
      { name: "description", content: "LifeLink is a real-time organ donation platform that connects donors with recipients through hospitals. Faster matching, transparent tracking, more lives saved." },
      { property: "og:title", content: "LifeLink — Bridging donors, recipients, and hospitals" },
      { property: "og:description", content: "Real-time organ donation & matching platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-hero-gradient opacity-[0.06]" />
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="relative inline-flex size-2">
                <span className="pulse-dot absolute inline-flex size-full rounded-full text-accent" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              Real-time donor matching
            </span>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Every second<br />
              <span className="italic text-primary">a life</span> waits.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              LifeLink connects organ donors, recipients, and hospitals in a single transparent
              network — so the right match reaches the right patient, faster.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-hero-gradient text-primary-foreground shadow-glow hover:opacity-95">
                <Link to="/auth">
                  Join LifeLink <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how">How it works</a>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-6 max-w-md">
              <Stat n="24/7" label="Realtime sync" />
              <Stat n="8" label="Organ types" />
              <Stat n="RLS" label="Audit-safe" />
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-hero-gradient opacity-30 blur-3xl" />
            <img
              src={heroImg}
              alt="Two silhouetted profiles connected by a glowing heart, symbolizing organ donation"
              width={1600}
              height={1000}
              className="w-full rounded-3xl object-cover shadow-glow"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-14 max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">How LifeLink works</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            A network built for the moments that matter.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Feature icon={<Users />} title="Register in minutes" body="Donors and recipients create secure profiles with organ, blood type, and hospital." />
          <Feature icon={<Radio />} title="Realtime matching" body="Compatible pairs surface instantly across all connected hospitals — no waiting on emails." />
          <Feature icon={<HeartPulse />} title="Transparent tracking" body="Every match and transplant is logged and auditable, from proposal to completion." />
          <Feature icon={<ShieldCheck />} title="Secure by design" body="Row-level security scopes every record to the user, hospital, or admin who owns it." />
          <Feature icon={<Activity />} title="Urgency-aware" body="Critical recipients rise to the top so care teams see what needs attention now." />
          <Feature icon={<Sparkles />} title="Donation history" body="A complete, permanent record of the lives your network has helped save." />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-hero-gradient p-12 text-primary-foreground shadow-glow sm:p-16">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Be the reason someone gets a second chance.
            </h2>
            <p className="mt-4 text-lg opacity-90">
              Join hospitals and thousands of registered donors making transplants faster and fairer.
            </p>
            <Button asChild size="lg" className="mt-8 bg-background text-foreground hover:bg-background/90">
              <Link to="/auth">Create your account <ArrowRight className="ml-2 size-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HeartPulse className="size-4 text-accent" /> LifeLink · Organ donation network
          </div>
          <p className="text-xs text-muted-foreground">Not medical advice. For research & coordination.</p>
        </div>
      </footer>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl font-semibold text-foreground">{n}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow">
      <div className="grid size-11 place-items-center rounded-xl bg-secondary text-primary transition group-hover:bg-hero-gradient group-hover:text-primary-foreground">
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
