# Gym Planner

Personal strength tracking app with long-horizon forecasts. PWA-first; native
port to Expo is deferred until weekly use is proven.

See the full approved plan at `~/.claude/plans/i-need-your-help-playful-sunset.md`.

---

## Stack

- **App**: Next.js 15 (App Router) + TypeScript strict + Tailwind v4
- **State**: TanStack Query v5 + IndexedDB persistence (to be added next)
- **DB/Auth**: Supabase (Postgres + magic-link auth) — not yet wired
- **Validation**: Zod (single source of truth for runtime + AI tool schemas)
- **Tests**: Vitest (forecast math)
- **Hosting**: Vercel (free tier)

## Repo layout

```
.
├── apps/
│   └── web/                       # Next.js 15 PWA
│       ├── app/                   # Routes (App Router)
│       ├── next.config.ts
│       ├── postcss.config.mjs     # Tailwind v4
│       └── tsconfig.json
├── packages/
│   └── core/                      # Portable TS — schemas + forecast math
│       └── src/
│           ├── schemas/           # Zod schemas (matches DB + AI tool inputs)
│           └── forecast/          # Epley 1RM, curves, computeTargetForSession
├── supabase/
│   ├── migrations/0001_init.sql   # Full schema (RLS on)
│   └── seed.sql                   # ~55 common exercises
├── package.json                   # pnpm workspace root
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

`packages/core` is the portability boundary. When/if we port to Expo it carries
over verbatim; only `apps/web` (UI) gets re-implemented as `apps/mobile`.

## Run

```bash
# install
pnpm install

# unit tests for the forecast math
pnpm --filter @gym-planner/core test

# typecheck everything
pnpm typecheck

# dev server (Next.js)
pnpm dev
# open http://localhost:3000
```

The home page shows a smoke-test forecast computation. When you change the
forecast math, the number updates on save.

## Supabase setup (next-session checklist)

1. Create a Supabase project at https://supabase.com (free tier).
2. Install the CLI: `brew install supabase/tap/supabase`.
3. From the repo root:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push                # applies supabase/migrations/0001_init.sql
   psql "<connection-string>" -f supabase/seed.sql
   ```
4. Copy `.env.example` → `apps/web/.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```
5. Generate TS types from the live DB:
   ```bash
   supabase gen typescript --linked > packages/core/src/db.types.ts
   ```

## Deploy to Vercel (next-session checklist)

```bash
# one-time
npm i -g vercel
vercel link               # picks/creates the project

# every deploy
vercel --prod
```

Set the same two env vars in the Vercel project settings.

## Install as a PWA on iPhone

Once deployed:

1. Open the Vercel URL in Safari on the iPhone.
2. Tap the Share button → **Add to Home Screen**.
3. The app launches in standalone mode with no Safari chrome.

PWA shell (Serwist service worker, manifest, icons) lands in a later session.

## v0 next steps (in order — reshaped by 3-persona review, 2026-07-01)

The persona review moved three things: the session runner is the centerpiece
(pre-filled forecast weights, not just a logger), a thin manual circuit slice
ships in v0 (it was deferred; it's one of the three core pillars), and the
forecast-vs-actual chart ships in v0 (forecasting without the payoff chart is
data entry).

- [x] Supabase client (`@supabase/ssr`) + magic-link auth + route middleware
- [ ] Apply migration + seed to the Supabase project (SQL editor or CLI)
- [ ] App shell: bottom tab nav (Home / Programs / Circuits / Progress)
- [ ] Home: Today card (next day + forecast-prescribed top sets), key-lift
      on/off-track strip, body-weight quick-add + sparkline
- [ ] Programs: list / create / day builder (exercise search, set×rep steppers)
- [ ] Forecast builder: baseline as weight×reps (auto-e1RM), 12w/24w targets,
      ramp preview chart
- [ ] Session runner: sets pre-filled from forecast curve (fallback: last
      session), one-tap logging, auto rest timer, "last session" inline,
      wake lock, local buffer so a dead zone can't lose a set
- [ ] Circuits v0 (manual): builder → versioned spec, full-screen player
      (huge countdown, work/rest colors, auto-advance, transition seconds),
      15-second post-workout confirm-log
- [ ] Progress: per-exercise forecast-vs-actual e1RM chart (best non-warmup
      set ≤10 reps, one point/session) with on/off-track badge; body-weight
      trend (raw dots + 7-day average)
- [ ] PWA shell (Serwist, manifest, icons)
- [ ] Deploy to Vercel + install on iPhone

## v0.5 (right after)

- [ ] AI circuit generation + "make it harder" edits (Claude API against
      `CircuitSpecV1`, validated with auto-repair retry)
- [ ] AI chart requests (chart-spec JSON → the same SVG renderer)
- [ ] TanStack Query + IndexedDB persistence for real offline

## Forecast math notes

- v0 curve: linear interpolation between anchors `[baseline, ...targets]`.
- v0 metric: `1rm` only (baseline/target values are 1RM kg).
- Epley formula for e1RM. Working weight = inverseEpley(e1RM, target_reps),
  rounded to 2.5 kg.
- `packages/core/src/forecast/curves.ts` exports `Curve` so new strategies
  (log, stepped) plug in without touching call sites.

## Recurring costs

- Supabase free tier · Vercel free tier · Sentry free tier
- Claude API (v1+): ~$1–5/mo with prompt caching on
- Apple Developer Program: $0 (deferred until validation)
