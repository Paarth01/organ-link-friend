# LifeLink 🫀

**A real-time organ donation & matching platform** — bridging donors, recipients, and hospitals through faster matching, transparent tracking, and AI-assisted decision support.

> Repository: [Paarth01/organlink-aid](https://github.com/Paarth01/organlink-aid)

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Matching Engine](#matching-engine)
- [AI Match Assistant](#ai-match-assistant)
- [Getting Started](#getting-started)
- [Database Setup](#database-setup)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Security Model](#security-model)
- [Roadmap](#roadmap)

---

## About

LifeLink connects organ **donors** with **recipients** through **hospital transplant coordinators**. Instead of waiting on phone calls and emails, compatible pairs surface instantly across the network — every match proposal is tracked through an auditable pipeline from proposal to completed transplant, and every donation is permanently recorded.

The platform is decision-support software: a clinician must always confirm every pairing before any medical action.

## Features

| Area | What you get |
|---|---|
| **Landing page** | Marketing hero with live feature overview |
| **Auth** | Email/password sign-up + sign-in, and "Continue with Google" OAuth. New sign-ups are logged in immediately and auto-provisioned with a profile and role |
| **Dashboard** | At-a-glance stats: available donors, waiting recipients, active matches, unread notifications |
| **Donor registry** | Register and browse donors with organ, blood type, age, city, hospital, and status |
| **Recipient registry** | Register and browse recipients with organ needed, blood type, urgency level (routine / urgent / critical), and status |
| **Matching** | Blood-type-aware (ABO) compatibility suggestions against the live registries, excluding pairs already in the pipeline |
| **Match pipeline** | `Proposed → Accepted → Completed` (or `Rejected`). Accepting a match marks both parties as matched; completing it records a permanent donation-history entry and flips the donor to *donated* and the recipient to *transplanted* |
| **AI Match Assistant** | Describe a donor–recipient case in plain language and get ranked, reasoned pairing suggestions with confidence scores, rationale, concerns, and a one-click Propose button |
| **Notifications** | Real-time in-app notification bell with unread badge — proposals, acceptances, completions, and critical-recipient alerts |
| **Donation history** | Permanent, auditable log of every completed transplant |
| **Realtime** | Donors, recipients, matches, and notifications all stream live over Supabase Realtime |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) v1 (React 19, SSR, server functions) |
| Routing | [TanStack Router](https://tanstack.com/router) (file-based) |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 (native `@theme` tokens, oklch colors) + shadcn/ui + Radix primitives |
| Fonts | Fraunces (display) + Inter (body) |
| State / data fetching | TanStack Query |
| Backend | Supabase (Postgres, Row-Level Security, Auth, Realtime) |
| AI | [AI SDK](https://sdk.vercel.ai) (`ai` + `@ai-sdk/openai`) via the Lovable AI Gateway (OpenAI `gpt-6-astra`, structured JSON output) |
| Notifications / toasts | Sonner |
| Validation | Zod |
| Language | TypeScript (strict) |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Browser (React 19 SPA + SSR shell)                  │
│  TanStack Router · TanStack Query · Tailwind v4      │
└──────────────┬───────────────────────┬───────────────┘
               │                       │
     Supabase JS client     createServerFn (typed RPC)
     (realtime + auth)                 │
               │                       │
┌──────────────▼───────────┐   ┌───────▼──────────────────┐
│  Supabase (Lovable Cloud │   │  Server functions        │
│  or your own project)    │   │  · suggestMatches (AI)   │
│  · Postgres + RLS        │   │    → Lovable AI Gateway  │
│  · Auth (email, Google)  │   │  · Zod-validated I/O     │
│  · Realtime channels     │   └──────────────────────────┘
└──────────────────────────┘
```

- **App-internal logic** runs through TanStack Start `createServerFn` (e.g. the AI match suggestion endpoint), never exposed to the client bundle.
- **All registry reads/writes** go straight from the browser to the database through a typed Supabase client, guarded by Row-Level Security.
- **Realtime** subscriptions keep the dashboard, registries, match list, and notification bell in sync without refreshes.

## Database Schema

Seven tables plus supporting enums. Roles live in a dedicated `user_roles` table (never on the profile) to prevent privilege escalation.

```
profiles ──┐
           │ (user_id)
donors ────┼──► matches ──► donation_history
recipients ┘        │
                    ▼
              notifications
user_roles (admin · hospital · donor · recipient · user)
```

### Enums

| Enum | Values |
|---|---|
| `app_role` | `admin`, `hospital`, `donor`, `recipient`, `user` |
| `blood_type` | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| `organ_type` | `kidney`, `liver`, `heart`, `lung`, `pancreas`, `cornea`, `bone_marrow`, `intestine` |
| `donor_status` | `available`, `matched`, `donated`, `withdrawn` |
| `recipient_status` | `waiting`, `matched`, `transplanted`, `cancelled` |
| `urgency_level` | `routine`, `urgent`, `critical` |
| `match_status` | `proposed`, `accepted`, `rejected`, `completed` |

### Tables

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | User profile, auto-created on sign-up by the `handle_new_user` trigger | `id` (= auth.users id), `full_name`, `phone`, `city`, `blood_type` |
| `user_roles` | Role assignments, one row per (user, role) | `user_id`, `role`, `UNIQUE(user_id, role)` |
| `donors` | Donor registry entries | `user_id`, `full_name`, `blood_type`, `organ`, `age`, `city`, `hospital`, `status` |
| `recipients` | Recipient registry entries | `user_id`, `full_name`, `blood_type`, `organ_needed`, `urgency`, `status` |
| `matches` | One row per proposed pairing | `donor_id`, `recipient_id`, `status`, `created_by`, `UNIQUE(donor_id, recipient_id)` |
| `notifications` | Per-user in-app notifications | `user_id`, `title`, `body`, `read` |
| `donation_history` | Permanent record of completed transplants | `match_id`, donor/recipient snapshot, `hospital`, `completed_at` |

Every table has **Row-Level Security enabled** with scoped policies (see [Security Model](#security-model)).

## Matching Engine

Compatibility is determined in `src/lib/organ.ts`:

1. **Organ match** — the donor's organ must equal the organ the recipient needs.
2. **ABO blood-type compatibility** — standard transplant rules: `O-` donates to everyone, `AB+` receives from everyone, otherwise group compatibility per direction.
3. **Pipeline de-duplication** — pairs already present in the `matches` table are excluded from suggestions.

The rule-based engine surfaces up to **20 candidate pairings** on the Matches page; urgency, geography (same city / same hospital) are weighted heuristics.

## AI Match Assistant

The **AI Match Assistant** on the Matches page lets a transplant coordinator describe a case in plain English (10–4,000 characters) and receive AI-ranked pairing suggestions.

- **Server function:** `src/lib/ai-match.functions.ts` (`suggestMatches`) — a Zod-validated, authenticated server function that sends the case description plus the current donor and recipient lists (up to 200 each) to the model.
- **Model:** OpenAI `gpt-6-astra` through the Lovable AI Gateway with structured JSON output (`Output.object` schema) and low reasoning effort.
- **Guardrails baked into the prompt:** the model may only reference IDs from the provided lists (exact copies), the organ must match, ABO compatibility must hold, higher urgency and closer geography are favoured, at most 5 pairings ranked best-first, and it must return an empty list with an explanation when nothing is plausible.
- **Output:** `{ summary, suggestions[] }` where each suggestion carries `confidence` (0–100), `rationale`, and `concerns`. Failed or invalid generations degrade to a friendly summary with zero suggestions.
- **One-click Propose:** every suggestion has a Propose button that writes the match straight to the database — optimistic UI, duplicate-pairing detection, and live notifications for all involved parties.

> ⚠️ **Decision support only** — the assistant never makes decisions; a clinician must confirm every pairing.

## Getting Started

### Prerequisites

- Node.js 20+ (or Bun)
- A Supabase project (Lovable Cloud, or your own)

### Local development

```sh
git clone https://github.com/Paarth01/organlink-aid
cd organlink-aid
npm install
npm run dev
```

The app runs at `http://localhost:5173` (Vite dev server).

### Environment variables

`.env` (auto-managed on Lovable):

```env
VITE_SUPABASE_URL=<your-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
VITE_SUPABASE_PROJECT_ID=<your-project-id>
```

The Supabase client lives in `src/integrations/external/client.ts` and points at whichever project these variables describe.

## Database Setup

Run the full setup script in your Supabase project's **SQL Editor** once:

1. **Sign up in the app first** (so the demo data can attach to your account).
2. Open your Supabase dashboard → **SQL Editor** → **New query**.
3. Paste the contents of `supabase/migrations/*.sql` (schema) — the combined schema + demo-data script is also provided as `lifelink-supabase-setup.sql` in the Lovable project.
4. Click **Run**. The script creates:
   - all enums, tables, grants, and RLS policies
   - the `has_role` security-definer helper
   - the `handle_new_user` trigger (auto-creates profile + `user` role on sign-up)
   - the `tg_set_updated_at` trigger
   - Realtime publication entries for `donors`, `recipients`, `matches`, `notifications`

### Enabling Google sign-in

In your Supabase dashboard: **Authentication → Providers → Google** → enable and paste your Google OAuth Client ID and Secret. Email sign-in works out of the box.

## Project Structure

```
src/
├── components/
│   ├── ai-match-assistant.tsx   # AI case-description form + ranked suggestions
│   ├── site-header.tsx          # Nav + realtime notification bell
│   └── ui/                      # shadcn/ui primitives
├── hooks/
│   └── use-auth.ts              # Session, profile, and role access
├── integrations/
│   ├── external/client.ts       # Typed Supabase browser client
│   └── supabase/                # Generated types + auth middleware
├── lib/
│   ├── ai-gateway.server.ts     # AI Gateway fetch wrapper (run-id forwarding)
│   ├── ai-match.functions.ts    # suggestMatches server function
│   ├── organ.ts                 # Organs, blood types, ABO compatibility, labels
│   └── utils.ts
├── routes/
│   ├── __root.tsx               # Root layout, fonts, Toaster
│   ├── index.tsx                # Landing page
│   ├── auth.tsx                 # Sign in / sign up
│   ├── _authenticated/          # Route-gated app pages
│   │   ├── route.tsx            # Auth gate + layout
│   │   ├── dashboard.tsx
│   │   ├── donors.tsx
│   │   ├── recipients.tsx
│   │   ├── matches.tsx          # Matching + AI assistant + pipeline
│   │   ├── notifications.tsx
│   │   └── history.tsx
│   └── sitemap[.]xml.ts
├── styles.css                   # Tailwind v4 theme tokens (deep teal + coral)
└── start.ts                     # Client middleware (attaches auth bearer token)
supabase/
└── migrations/                  # Schema + RLS + triggers + realtime
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build (prerender) |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (write) |

## Security Model

- **Roles are never stored on the profile.** `user_roles` is a dedicated table with a `UNIQUE(user_id, role)` constraint, checked server-side through the `has_role` security-definer function — avoiding both recursive RLS and client-side privilege escalation.
- **Row-Level Security on every table:**
  - *Profiles* — readable by any authenticated user, writable only by the owner.
  - *Donors / recipients* — readable by all authenticated users; insert only for your own records; update/delete only for the owner or an admin.
  - *Matches* — readable by all authenticated users; insert only by the creator; updates restricted to the creator or an involved party.
  - *Notifications* — strictly per-user read/update/delete; inserts limited to self or admins.
  - *Donation history* — insert limited to the involved parties or an admin.
- **Auto-provisioning** — a `handle_new_user` trigger creates a profile and a `user` role for every new auth account, so no account is ever un-roled.
- **Triggers are locked down** — `handle_new_user` and `tg_set_updated_at` run with fixed `search_path`.
- **AI endpoint** — authenticated server function with strict Zod input validation; the model is constrained to IDs from the provided lists and cannot invent patients.

## Roadmap

- [ ] Hospital-scoped accounts with per-hospital registries
- [ ] Multi-organ and paired-exchange (donor chains) matching
- [ ] HLA crossmatch integration
- [ ] Email / SMS notification delivery
- [ ] Admin console for role and case management

---

Built with [Lovable](https://lovable.dev). This code is yours — push to `main` and changes sync back into the Lovable editor.
