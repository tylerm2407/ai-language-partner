# AGENTS.md — Fluenci (Language Learning App)

## 0. Quick Start
```bash
cd C:\dev\Languageapp
```
Run this first — all build/test/expo commands must run from the project root.

---

## 1. Project Overview
Fluenci is an AI-powered language-learning app: lessons, SM-2 spaced repetition, AI chat/voice tutoring, graded reading and writing, gamification (XP, hearts, streaks), and a B2B school system (organizations → classrooms → assignments) targeting university pilots. Pre-launch; App Store submission is the current goal.

The most important constraints:
1. Every AI interaction passes through the content-safety + CEFR level-check pipeline (`supabase/functions/_shared/validated-generate.ts`).
2. The client is untrusted — anything with economic or competitive meaning (XP, hearts, streaks, quotas, subscription tier) is written server-side (guarded RPC or service-role edge function), never by direct client table writes.
3. All AI API keys live in Supabase Edge Function secrets — never in the client.

## 2. Stack & Architecture
- **App:** Expo SDK 54, React Native 0.81 (new architecture), expo-router v6, NativeWind, Zustand. TypeScript strict.
- **Backend:** Supabase — Postgres with RLS, Auth, Storage, Deno edge functions. Stripe for payments. Sentry for crashes.

```
app/(public)   auth, onboarding (placement test)
app/(app)      learner: learn / review / practice / chat / reading / writing / news / profile
app/(teacher)  B2B: classes / assignments / grading / admin / audit-log
components/    UI by domain (ui/, lesson/, chat/, reading/, gamification/, school/, avatar/)
hooks/         data-fetching + feature hooks
stores/        Zustand stores (useAppStore, useSchoolStore, useAnimationStore)
lib/           domain logic: srs.ts (SM-2), grading.ts, hearts.ts, levels.ts,
               supabase-queries.ts (ALL db access — keep new queries in domain sections)
config/        theme.ts (design tokens — see DESIGN.md), app.ts
supabase/
  migrations/  SQL migrations (see §5 — prod history does NOT match these files)
  functions/   Deno edge functions; _shared/ has auth, validation, content-safety,
               level-checker, validated-generate, plan-limits
scripts/       content pipeline (Tatoeba, Gutenberg, frequency lists)
```

## 3. Commands
```bash
npm run typecheck     # tsc --noEmit (strict; must pass)
npm run lint          # eslint (flat config, eslint-config-expo)
npm test              # jest (jest-expo preset) — frontend unit tests only
npm run test:functions  # deno test for supabase/functions (requires Deno installed)
npm start             # expo dev server
```
Edge functions deploy via `npx supabase functions deploy <name>` or the Supabase MCP tools.

## 4. Rules
- TypeScript strict; no `any` in app code. Type DB rows in `types/index.ts`.
- Design system: see `.Codex/rules/design.md` → `DESIGN.md` is canonical (dark theme, tokens in `config/theme.ts`).
- Learning domain (SM-2 formulas, lesson structure, grading): `.Codex/rules/learning.md`. Do not change SRS/scoring logic without updating its tests.
- Mobile UI (safe areas, accessibility, gestures, performance): `.Codex/rules/mobile-ui.md`.
- New DB queries go through `lib/supabase-queries.ts` in the matching domain section; user-growable tables always query with `.limit()` or `.range()`.
- Edge functions: always authenticate via `_shared/auth.ts`, validate input via `_shared/validation.ts`, generate AI content via `_shared/validated-generate.ts`, cap tokens and input length.
- Never write gamification columns (`total_xp`, `xp_level`, `hearts`, `max_hearts`, `last_heart_lost_at`, `streak`, `longest_streak`, `streak_freezes`, `league_tier`, `streak_shield_*`) by direct table update — a DB trigger blocks it. Use the RPCs: `increment_xp`, `spend_heart`, `sync_hearts`, `update_streak`, `use_streak_freeze`, `set_streak_shield`, `sync_level`.

## 5. Database — READ BEFORE TOUCHING
- **The production Supabase project (`ngqpsuixmumdnqbqxjxv`) is SHARED with other NovaWealth apps** (CostClarity and others). `user_profiles` contains columns from multiple apps. Never run `supabase db reset` or `db push` against it. Never drop/alter tables you don't recognize — they may belong to another app.
- Prod migration history uses auto-generated timestamps (applied via dashboard/MCP), so the numbered files in `supabase/migrations/` are a *record of intent*, not the applied history. Apply schema changes via the Supabase MCP `apply_migration` tool (or dashboard) **and** mirror the SQL as a new numbered file in `supabase/migrations/`.
- RLS is mandatory on every new table. For permission helpers use `SECURITY DEFINER` functions with `SET search_path = public` and a caller guard (`auth.uid()` check) — see migrations 024/025/031 for the pattern.

## 6. Error Handling & Testing
- No bare/swallowed catches: surface errors to the UI (error state + retry) or rethrow. Returning `[]` on failure hides outages.
- LLM calls: retry then fall back to pre-authored content (`validated-generate.ts` does this — use it).
- Frontend tests: jest + jest-expo, colocated `*.test.ts`. Edge function tests: `deno test`, colocated in `supabase/functions/`.
- A task is not done until `npm run typecheck`, `npm run lint`, and `npm test` all pass.

## 7. What NOT To Do
- Don't put business logic in screens — it goes in `lib/` or edge functions.
- Don't bypass the content-safety pipeline for any user-visible AI output.
- Don't add dependencies casually — this ships in an app binary; check size and maintenance.
- Don't expose model/system prompts in UI or logs.
- Don't change scoring/CEFR thresholds without updating tests and `.Codex/rules/learning.md`.
