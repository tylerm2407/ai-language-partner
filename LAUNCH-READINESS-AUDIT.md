# Fluenci — Production Launch Readiness Audit

**Date:** 2026-07-23
**Method:** 5-model blind council (Claude fable / opus / sonnet / haiku + OpenAI gpt-5.6-sol via Codex) each independently audited the codebase, followed by direct verification of every disputed high-severity finding against the actual source. Cross-referenced with a 3-track web-research pass (App Store/Play rules, Supabase/Stripe/RevenueCat production docs, Expo/Sentry client docs).
**Scope:** `C:\dev\Languageapp` — caches, queues, queries, database/RLS, error handling, offline, payments, quotas, crash reporting, performance, launch config. **No new features** — production quality only.

---

## Verdict: **NO-GO** as configured today → **GO within ~2 days** once the P0s are cleared

The engineering is genuinely production-grade in the hard places: the gamification lockdown trigger, atomic quota consumption, offline write-queue with idempotency/dead-lettering, SWR read cache, webhook signature verification, and the LLM safety+fallback pipeline are all well-built and were confirmed by every council member. Typecheck, lint, and 133/133 unit tests pass.

What blocks launch is **not** missing features — it's four launch-config/security holes that are individually fatal (dead purchases, resettable paid-API quota, an unguarded AI output path, blind crash reporting) plus a cluster of billing/data-integrity bugs. All are fixable in days.

> **One caveat repeated by multiple auditors and it matters:** production Supabase (`ngqpsuixmumdnqbqxjxv`) is **shared with other NovaWealth apps**, and the migration files are a "record of intent," not applied history (CLAUDE.md §5). Several findings below are **verified in the migration source** but their live status depends on prod drift. Every SQL finding marked ⚠️ must be re-checked against live `pg_policy` / `pg_proc` / grants before you trust it either way.

---

## P0 — Launch blockers (verified in source)

### P0-1 · Production build ships placeholder RevenueCat keys → purchases dead, $0 revenue
`eas.json` `production.env` (and `preview`) still contains literal `appl_REPLACE_WITH_REVENUECAT_IOS_PUBLIC_KEY` / `goog_REPLACE_WITH_REVENUECAT_ANDROID_PUBLIC_KEY` (`eas.json:37-38`). `isPurchasesAvailable()` treats any non-empty string as valid (`lib/purchases.ts:48-52`) and configures the SDK with the junk key, so the paywall renders enabled but every offerings fetch and purchase fails. It "works" only in the dev profile, which has a real `test_` key — so this fails **only in the store binary**.
**Fix:** paste the real public keys (or wire EAS env vars) before the production build. Then run full sandbox purchase + restore tests.
*Found by: fable, codex. Verified.*

### P0-2 · Any authenticated user can reset their own AI quota → unlimited paid-LLM abuse ⚠️
Migration 004 created `CREATE POLICY "Users can manage own daily usage" ON public.daily_usage FOR ALL USING (auth.uid() = user_id)` (`004_security_and_scalability.sql:96`). **No later migration ever drops it** (confirmed by searching all 49 migrations). Migration 036 locked the `increment_daily_usage` *RPC* to `service_role`, but the direct-table `FOR ALL` policy still lets the client run `UPDATE daily_usage SET text_messages = 0, voice_minutes = 0, …` through PostgREST and wipe its own counters. This defeats the entire server-side quota system — the atomic `consume_daily_quota` is meaningless if the row it reads is client-resettable. This is the real cost-exposure hole on your most expensive endpoints.
**Fix:** `DROP POLICY "Users can manage own daily usage"` and replace with a **SELECT-only** owner policy; all writes already go through service-role RPCs. Ship as a new numbered migration + apply via MCP.
*Found by: codex only. Verified in source; confirm the policy is live in prod.*

### P0-3 · Live voice bypasses the mandatory safety + CEFR pipeline ⚠️
`voice-proxy/index.ts` opens a WebSocket straight to Gemini Live (`:223`) and forwards every model message to the client verbatim — `geminiWs.onmessage = (event) => clientWs.send(event.data)` (`:261-265`) — with no `generateValidated`, no `validateContentSafety`, no level check. This directly violates the codebase's stated #1 constraint (CLAUDE.md §1: *every AI interaction passes through content-safety + CEFR*). It is also the exact surface Apple 1.2 and Google Play's generative-AI policy scrutinize (see Launch-Gate §A).
**Fix:** this is real-time audio, so full pre-validation is hard — at minimum run transcribed model output through the safety check and enforce a server-built system prompt with safety instructions (the setup message is already server-built at `:233`, good). Decide explicitly what moderation the streaming path gets before launch; "none" is not shippable for an AI chat app under Play policy.
*Found by: codex only. Verified.*

### P0-4 · Crash reporting is silently OFF in production
`Sentry.init({ … enabled: !__DEV__ && !!SENTRY_DSN })` (`app/_layout.tsx:30-36`) — but `EXPO_PUBLIC_SENTRY_DSN` is **absent from every profile in `eas.json`** (it exists only in `.env.example`). Production binary → no DSN → Sentry disabled → you launch blind, and the offline queue's dead-letter reports (`lib/offline-queue.ts`) go nowhere.
**Fix:** add the DSN to `eas.json` production env (it is not a secret) *or* confirm it's set as an EAS account-level env var, and verify source-map upload has `SENTRY_AUTH_TOKEN`. **Verify against the actual build artifact**, not the repo — an EAS dashboard secret would satisfy this without appearing in the file.
*Found by: fable, codex. Verified missing from repo config.*

---

## P1 — Fix before submission or within launch week

### Payments & subscription integrity

- **P1-1 · Stripe webhook never records cancellation.** `stripe-webhook/index.ts` contains **zero** references to `cancel_at_period_end` (grep confirmed). A user who cancels via Stripe keeps `cancelAtPeriodEnd: false` in the app and never sees "cancels on <date>." The RevenueCat webhook *does* handle this correctly (`revenuecat-webhook/index.ts:130-133`). Since iOS uses RevenueCat/StoreKit, this bites only the Stripe/web rail — P1, not P0. **Fix:** add `cancel_at_period_end: subscription.cancel_at_period_end` to the `.update()` payload in `handleSubscriptionUpdated`. *(sonnet — verified)*
- **P1-2 · `determineTier` silently downgrades on unknown price ID.** A misconfigured `STRIPE_*_PRICE_ID` makes every new subscriber fall to `starter` with only a `console.warn` — customer pays, gets nothing, no alert. **Fix:** `Sentry.captureMessage` + return non-2xx so Stripe retries. *(sonnet, fable — verified pattern)*
- **P1-3 · RevenueCat `BILLING_ISSUE` immediately revokes access.** It's in `INACTIVE_EVENTS` → tier forced to `starter`, but BILLING_ISSUE fires at the *start* of a billing problem while the store grace period may still entitle the user. Classic "I paid and got downgraded" 1-star. **Fix:** let `EXPIRATION` do the downgrade; treat BILLING_ISSUE as a flag only. Confirm your RC grace-period setting. *(codex)*
- **P1-4 · Purchase success shown before entitlement confirmed.** Paywall announces success after the RC purchase even if the webhook-backed refresh failed, and the refresh error is swallowed (`stores/useAppStore.ts:61-67`). Use the immediate RC `CustomerInfo` / an entitlement listener to gate the success UI. *(codex)*
- **P1-5 · Two payment rails, last-writer-wins.** Stripe and RevenueCat webhooks both upsert the same `subscriptions` row on `user_id` with no `provider` column or ordering guard → state can flap. Record the provider and never let one rail downgrade the other's active row. *(fable, codex)*
- **RevenueCat only retries webhooks 5 times (5/10/20/40/80 min) then stops** vs Stripe's 3 days ([RevenueCat docs](https://www.revenuecat.com/docs/integrations/webhooks)). A brief endpoint outage at launch **permanently loses** entitlement updates. **Build a reconciliation job** that polls RC customer-info as a backstop. *(research — MUST)*

### Data integrity & account lifecycle

- **P1-6 · `delete-account` is unsafe and billing-incomplete.** It deletes rows table-by-table but **continues on per-table failure** and deletes the auth user anyway (`delete-account/index.ts:49-62`) → orphaned data; it **never cancels Stripe/RevenueCat**, so billing continues after deletion; and because auth is shared across NovaWealth apps, deleting the shared identity may damage other apps. **Fix:** wrap in a transaction (fail closed), cancel billing first, and confirm complete deletion. This is also a GDPR/App Store 5.1.1(v) requirement. *(opus, sonnet, haiku, codex — 4/5, verified)*
- **P1-7 · Transient profile-load failure dumps existing users into onboarding (data-overwrite).** `fetchProfile` failure resolves `profile:null` (`stores/useAppStore.ts:35-54`); `_layout.tsx:110-118` marks data loaded anyway; the route guard reads `!profile` and redirects to the placement test (`:149-151`), which can overwrite `level`/profile. The profile is deliberately not cached (gamification), so any network blip at cold start hits this — and a flaky-network reviewer will hit it too. **Fix:** render the store's `error` state with a retry instead of routing to onboarding when `error != null`. *(fable, codex — verified path)*
- **P1-8 · Account switch can leak prior-user state.** Bootstrap uses a single `dataLoaded` boolean, not keyed by user id, and resets only when the session goes null (`_layout.tsx:110-118`). A direct A→B user swap can leave A's profile/subscription/stats visible while RC/Sentry identify B. **Fix:** key cached global state by user id; reset on any uid change. *(codex)*

### Learning-flow correctness

- **P1-9 · Reading "add to review" is broken by a cards-RLS conflict.** ⚠️ `addCardFromAnnotation` does a **client-side** `cards` insert (`lib/supabase-queries.ts:1350`) for annotations without a linked `card_id`, but migration `042_cards_rls_and_search_path.sql` dropped the client insert policy ("no client INSERT path is needed"), and `027` had restricted inserts to teachers/admins. The error is swallowed (`hooks/useReadingPassage.ts` returns null), so the word silently never saves. **Fix:** route card creation through a service-role edge function (matches the untrusted-client doctrine) *or*, if seed annotations always carry `card_id`, delete the dead branch — verify against seed data first. Also surface the swallowed error. *(opus, sonnet, codex — 3/5, verified)*
- **P1-10 · Reading completion can double-award XP.** Completion and the **non-idempotent** `addXp` are separate ops, and the retry guard resets on any error (`app/(app)/learn/reading/book/[bookId].tsx:141-159`). A lost response after XP commit re-awards on retry. **Fix:** route through the offline queue's idempotent `xp-award` path (the machinery already exists — migration 046). *(sonnet, codex)*

### Economic / leaderboard integrity (XP only — no dollar cost, but real for leagues)

- **P1-11 · XP is self-awardable.** ⚠️ `increment_xp` caps a single call at 1–500 and checks the caller (`036_gamification_lockdown.sql:117-145`) — good — but nothing stops an authenticated client calling it in a loop, and **daily-challenge bonus is replayable**: the client writes `all_completed`/`bonus_xp_claimed`/`challenge_streak` directly via `upsertDailyChallenges` (`lib/supabase-queries.ts:1126-1148`, RLS allows owner writes), so it can set completed + high streak, call `claim_daily_challenge_bonus` (043) for up to 200 XP, then reset `bonus_xp_claimed=false` and repeat. **Fix:** stop the client writing gamification-relevant challenge columns — compute completion server-side, or RLS-restrict those columns so only the RPC path sets them. *(codex — verified mechanism)*

### Cost controls on AI endpoints

- **P1-12 · `ai-chat` skips input validation.** Imports nothing from `_shared/validation.ts`; per-message byte length is uncapped (a 500 KB message goes straight into the Anthropic call, `ai-chat/index.ts:229`) and `topic` is interpolated raw into the system prompt (`:350-351`) — cost-abuse + prompt-injection surface, and a CLAUDE.md §4 violation. **Fix:** cap each message (~2 000 chars), `sanitizeText(topic)`, validate language/level enums. *(fable, codex)*
- **P1-13 · `get-hint` is unmetered.** Authenticated and cached (good), but **no burst limit and no quota**, and the cache key includes a client-supplied, unvalidated `exerciseType` — loop random values to force cache misses → unbounded Haiku calls + unbounded `hint_cache` growth. **Fix:** validate `exerciseType` against the enum + add `checkBurstLimit`. *(fable, haiku, codex)* — Note: `generate-story` was flagged by one member as unmetered; **that is false** — it correctly calls `consume_daily_quota('stories_generated')` (`generate-story/index.ts:65`).
- **P1-14 · Voice/turn paths use read-then-check quota (TOCTOU).** `tts` and `analyze-turn` read usage then increment after the paid call rather than using atomic `consume_daily_quota`; concurrent requests overshoot by a few units. Bounded by tier caps and burst limits, so P1/P2, but architecturally inconsistent. *(opus, sonnet, fable, codex)*

### Database & migrations

- **P1-15 · Missing `.limit()` on user-growable queries** (violates CLAUDE.md §4): teacher `fetchClassroomAssignments` / `fetchAssignmentSubmissions` / `fetchTeacherClassrooms`, `fetchCardsByLanguageAndLevel`, chat transcript, gradebook export. Gradebook export can silently truncate at PostgREST's row cap. **Fix:** add `.limit()`/`.range()`. *(sonnet, codex — verified)*
- **P1-16 · Migration drift is a standing hazard.** ⚠️ Duplicate numbers (two `020_*`, two `027_*`); `035_schema_reconciliation.sql` documents prod was already found missing 9 migrations once; `039_remove_foreign_app_objects.sql` drops cross-app objects with `CASCADE`. Client RPCs depend on 036/037/046/048 — a missing `increment_xp_idempotent` breaks all offline replay. **Fix before submission:** reconcile live prod schema/grants/policies against migrations 036-049; renumber the duplicates. *(opus, sonnet, fable, codex — verified)*
- **P1-17 · `lesson_completions` has no table definition in repo migrations** despite hot reads/writes — verify it (and the `correction_log (user_id, short_label, created_at)` index) exist in prod. *(sonnet, codex)*

### Backend launch config (from research — Supabase official production checklist)

- **P1-18 · Custom SMTP is mandatory.** Supabase's built-in auth email is rate-limited to **~2 emails/hour** — a launch killer. Configure SendGrid/SES and raise the new-user email rate limit before any announcement. ([Supabase going-to-prod](https://supabase.com/docs/guides/deployment/going-into-prod)) *(research — MUST)*
- **P1-19 · Run both Security and Performance Advisors** in the dashboard and clear/accept every finding. On a **shared** project this is doubly important — one app's missing RLS exposes the others. Also set auth rate limits and enable PITR/backups. *(research — MUST)*
- **P1-20 · Wrap `auth.uid()` as `(select auth.uid())` in RLS policies** so it evaluates once per query, not per row (the `auth_rls_initplan` advisor lint) — real perf at scale. *(research — SHOULD)*

---

## P2 — Post-launch hardening

- `FlatList` used where `.claude/rules/mobile-ui.md` mandates `FlashList` (chat, practice, teacher screens); `@shopify/flash-list` isn't even installed. Bounded/paged lists make this tolerable at launch scale. *(all members)*
- No client-side fetch timeout / AbortController in `lib/ai.ts` — a hung edge call spins forever. Research recommends 60–120 s LLM timeouts + streaming. *(fable, research)*
- No OTA update channel configured (`expo-updates` present but no `updates.url`/`runtimeVersion`) — you lose your fastest hotfix path while App Store review takes days. Configure EAS Update + rehearse `eas update:rollback`. *(fable, research — SHOULD)*
- `translation_cache` / `hint_cache` have no TTL/cleanup; `generate-content` distractors aren't cached. *(sonnet, codex)*
- `tracesSampleRate: 0.2` hardcoded; `userInterfaceStyle: "light"` in `app.json` contradicts the dark theme; voice JWT passed in the WebSocket query string (log-exposure risk); 15 lint warnings incl. dead `mapReviewLog`. *(various)*
- **Correction:** React-hook-dependency lint warnings were flagged by one member as a P0 — they are **P2** cleanup, not a launch blocker.

---

## Launch Gates from platform/research (not in code — checklist items)

### §A App Store & Google Play (submission blockers)
- **MUST** In-app **account deletion** with full data deletion (5.1.1(v)) — you have the function; fix P1-6 so it actually completes and cancels billing.
- **MUST** Paywall shows, **in the binary**, subscription title/length/price + functional Privacy Policy and Terms links; visible **Restore Purchases**; IAP products submitted "Ready to Submit." If paywalls are remote (RC), keep a static fallback — reviewers reject "info missing from binary." ([Apple guidelines](https://developer.apple.com/app-store/review/guidelines/), [RC rejections](https://www.revenuecat.com/docs/test-and-launch/app-store-rejections))
- **MUST** Disclose third-party AI data sharing and get permission (Apple 5.1.2(i)) — you send user text/voice to Anthropic/OpenAI/Google. Complete the **new AI-chatbot age-rating questionnaire** (expect 13+). ([Apple news](https://developer.apple.com/news/?id=ks775ehf))
- **MUST (Google Play)** Generative-AI apps must include **in-app reporting/flagging of offensive AI output** and use it to improve filtering — this is a concrete **build item** for chat/writing/voice that Apple doesn't formally require. ([Play AI-content policy](https://support.google.com/googleplay/android-developer/answer/13985936))
- **MUST** App Privacy labels / Play Data-safety form must declare data collected by **third-party SDKs** (RevenueCat, Sentry, Supabase); functional Privacy Policy link in-app and in store metadata. On iOS, don't ship a Stripe web-checkout button for digital subscriptions (Apple IAP rule). ([Apple privacy](https://developer.apple.com/app-store/app-privacy-details/))

### §B Webhook reliability (research)
- **MUST** Store processed `event.id` with a UNIQUE constraint (Stripe + RC are at-least-once) and short-circuit duplicates; never rely on event ordering — fetch current object state. Return 2xx fast. ([Stripe webhooks](https://docs.stripe.com/webhooks))
- **MUST** Test full sandbox purchase/restore; treat TestFlight sandbox purchases as production for entitlement access. ([RC sandbox](https://www.revenuecat.com/docs/test-and-launch/sandbox))

### §C Edge functions / observability (research)
- Design within hard limits (150 s idle timeout, 400 s wall clock, **2 s CPU**, 256 MB) — long LLM calls are fine (I/O doesn't count as CPU) but must stream/respond before 150 s. Rate-limit AI endpoints at the function layer (Supabase's recipe is Upstash Redis keyed to user id). ([Edge limits](https://supabase.com/docs/guides/functions/limits), [rate limiting](https://supabase.com/docs/guides/functions/examples/rate-limiting))
- Upload Sentry source maps after every `eas update`; keep `release`/`dist`/`environment` identical between native config and `Sentry.init`. Target ≥99.5% crash-free sessions. ([Expo+Sentry](https://docs.expo.dev/guides/using-sentry/))

---

## Council leaderboard

For a **factual** audit, I replaced the usual anonymized peer-ranking stage with **direct source verification** of every disputed high-severity claim — stronger evidence than model opinion. Ranking is by verified accuracy and severity of what each member found.

| Rank | Model | What set it apart |
|------|-------|-------------------|
| 1 | **gpt-5.6-sol (Codex)** | Found all four security/cost P0s the others missed (quota reset, voice safety bypass, XP replay, key placeholders) — every one verified true. Deepest, most skeptical, correctly caveated prod-drift. |
| 2 | **sonnet** | Only member to catch the Stripe `cancel_at_period_end` bug (verified); thorough delete-account and query-limit findings; clean severity table. |
| 3 | **fable** | Caught both config P0s (RC keys + Sentry) and the onboarding data-loss path; the only member that actually ran typecheck/lint/tests for evidence. |
| 4 | **opus** | Solid and correct (cards RLS, migration dups) but leaned "conditional GO" and missed the client-trust security holes. |
| 5 | **haiku** | Good strengths inventory, but had a **false P0** (generate-story "unmetered" — it isn't) and overstated lint warnings as P0. |

*Cross-vendor council: 4 Claude models share some correlated bias; the OpenAI member breaking from the pack on the security findings is exactly why it's in the council.*

---

## Bottom line — the pre-submission punch list

**Do these 4 (P0) — hours of work, then you can submit:**
1. Real RevenueCat production keys in `eas.json` → sandbox purchase/restore test.
2. Drop the `daily_usage` owner `FOR ALL` write policy → SELECT-only (stops quota reset).
3. Give the live-voice path real safety/moderation (at minimum a moderated server prompt + output safety check).
4. Wire the Sentry DSN into the production build and verify crashes report.

**Then confirm before the binary ships (P1, ~1-2 days):**
5. Reconcile live prod schema/grants against migrations 036-049; renumber duplicate migrations.
6. Fix `delete-account` (transactional + cancel billing) and the profile-failure→onboarding redirect.
7. Stripe `cancel_at_period_end`; RevenueCat reconciliation job + BILLING_ISSUE grace handling.
8. Custom SMTP; run Supabase Security + Performance advisors.
9. Add in-app AI-output reporting (Google Play requirement) and complete Apple AI age-rating + privacy disclosures.

**Week one:** input caps on `ai-chat`, meter `get-hint`, `.limit()` the unbounded queries, XP-replay lockdown, FlashList migration, OTA channel.

Clear P0-1 through P0-4 and items 5-6, and this is a **GO**. The foundation is strong — you're fixing a short list of sharp edges, not rebuilding anything.
