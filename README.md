# Fluenci

AI-powered language-learning app: lessons, SM-2 spaced repetition, AI chat and voice tutoring, graded reading and writing, gamification (XP / hearts / streaks), plus a B2B school system (organizations → classrooms → assignments) for university pilots.

**Stack:** Expo SDK 54 / React Native 0.81 (expo-router, NativeWind, Zustand) · Supabase (Postgres + RLS, Auth, Storage, Deno edge functions) · Stripe · Sentry · EAS Build.

## Setup

```bash
npm install
cp .env.example .env   # fill in Supabase URL + anon key
npm start              # expo dev server
```

## Commands

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript strict check (must pass) |
| `npm run lint` | ESLint (flat config, eslint-config-expo) |
| `npm test` | Frontend unit tests (jest-expo) |
| `npm run test:functions` | Edge function tests (requires [Deno](https://deno.land)) |
| `npm run check` | All three frontend checks |

CI (`.github/workflows/ci.yml`) runs all of the above on every push/PR.

## Architecture

See `CLAUDE.md` for the full map and rules. Short version:

- `app/` — expo-router screens in `(public)`, `(app)` (learner), `(teacher)` route groups
- `lib/` — domain logic; **all DB access goes through `lib/supabase-queries.ts`**
- `supabase/functions/` — Deno edge functions; all AI keys live here, never in the client
- `supabase/migrations/` — SQL migrations (see warning below)
- `DESIGN.md` — canonical design system (dark theme, tokens in `config/theme.ts`)

## ⚠️ Database warnings

- **The production Supabase project is shared with other NovaWealth apps.** Never run `supabase db reset` or `db push`. Never modify tables you don't recognize.
- Prod migration history is timestamp-based (applied via dashboard/MCP); the numbered files in `supabase/migrations/` are the record of intent. Apply changes via Supabase MCP `apply_migration` **and** mirror the SQL as a new numbered repo file.
- Gamification columns on `user_profiles` (XP, hearts, streaks, league) are server-managed — write only via the RPCs (`increment_xp`, `spend_heart`, `sync_hearts`, `update_streak`, `repair_streak_with_*`). A DB trigger blocks direct writes.

## Deploying edge functions

```bash
npx supabase functions deploy <name>
```
Functions that import `_shared/` modules bundle them at deploy time — redeploy dependents when a shared module changes.
