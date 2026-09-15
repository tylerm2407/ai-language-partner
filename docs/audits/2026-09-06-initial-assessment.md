# Fluenci audit — first read-only assessment

September 6, 2026. Status: **in progress; not a release sign-off**.

Reviewed checkout: `/Users/tylermoore/Fluenci_Main/ai-language-partner`. Baseline HEAD: `0cbe1042836bef9f4220512e1258fa35967879e7`. Review included working-tree files, not just that commit. Tutor and navigation implementation continued changing during the review. Initial/end status, selected source snapshots, SHA-256 hashes, test logs, dependency results, and a local reproduction harness are saved under `evidence/`. No app source was changed, no fixes were applied, and no production attack traffic, account deletion, payments, migrations, or deployment was performed.

The strongest immediate priorities are billing integrity, shared-backend isolation, reproducible database configuration, and the boundary between trusted learning evidence and client-supplied rewards. A framework rewrite is not justified by what has been reviewed.

## Evidence and validation

| Check | Result at time of execution |
|---|---|
| TypeScript | Passed |
| ESLint | 0 errors, 61 warnings |
| App unit tests | 81 suites; 1,191 tests passed |
| Edge-function tests | 510 passed, 0 failed |
| npm audit, omitting devDependencies | 43 affected-package entries: 2 critical, 17 high, 22 moderate, 2 low |
| Limited tracked-file secret-pattern scan | No matches for selected private-key, Stripe-live, OpenAI-project, GitHub-token, or Supabase-secret patterns |
| Local adverse-path reproduction | Confirmed checkout customer misassociation and webhook retry loss using actual transpiled handlers with synthetic services |

The secret scan is not a full history scan or proof that secrets were never exposed. npm counts include transitive build tools and inherited advisories; they are not 43 demonstrated mobile vulnerabilities. Test passes apply to the code present during those runs, not later tutor additions. The local harness mocks authentication as successful and external services; it verifies handler behavior after authentication, not deployed network reachability.

## Findings to address before release

### F01 — High: checkout chooses a Stripe customer using untrusted email

Evidence: `supabase/functions/create-checkout/index.ts:58`, `:78`. The handler checks that the submitted user ID matches the verified caller, but then finds a Stripe customer using the request body's email. It does not bind that customer to the authenticated identity.

Local reproduction: authenticate a synthetic caller, submit a different synthetic email, return that email's existing customer from the mock Stripe API. The handler creates checkout for `cus_other_user` with the caller's Supabase ID in metadata and returns 200.

Impact: billing/customer ownership can be mixed between accounts. Exact information displayed by hosted checkout and payment-method behavior still require Stripe test-mode validation; no unauthorized charge or disclosure was demonstrated.

Fix: store an authoritative user-to-customer mapping and use it for checkout; derive email from verified account data only. Check ownership before reusing a customer. Restrict return URLs to approved destinations. Verify user A cannot select user B's customer by changing request fields.

### F02 — High: failed purchase processing permanently consumes its retry key

Evidence: `supabase/functions/revenuecat-webhook/index.ts:133`, `:220`. Redis claims the event ID for 24 hours before the entitlement write. A database failure returns 500 without releasing the claim; the retry returns 200 as a duplicate.

Local reproduction: first delivery returned 500; database recovered; retry returned `{ok:true,duplicate:true}`. Only one database write was attempted and no entitlement existed.

Impact: a customer can pay and never receive server-authorized access. This occurs when Redis deduplication is configured and the database write fails. RevenueCat retries reuse event IDs and stop retrying successful responses. [RevenueCat webhook behavior](https://www.revenuecat.com/docs/integrations/webhooks).

Fix: durable transactional event processing, or a recoverable processing lease plus a completion record. Never treat a started operation as completed. Test transient database failure, retries, concurrent delivery, and process death after claiming an event.

### F03 — High: restored/transferred subscriptions do not reconcile both accounts

Evidence: `supabase/functions/revenuecat-webhook/tier.ts:59`; handler requires `app_user_id` before event classification. TRANSFER is deliberately ignored and its `transferred_from`/`transferred_to` identities are not processed.

Impact: if RevenueCat permits transfers, the source account may retain backend access and the receiving account may not acquire backend access. Local classification returns no action for TRANSFER. An actual sandbox restore is still required.

Fix: reconcile current provider entitlements for affected source/destination identities, including aliases where appropriate. Test restoration across two Fluenci accounts on one store account. [RevenueCat transfer fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields).

### F04 — Medium: billing issues are treated as immediate entitlement expiration

Evidence: `supabase/functions/revenuecat-webhook/tier.ts:54`. BILLING_ISSUE always becomes starter/inactive; the classifier cannot inspect grace-period state. SUBSCRIPTION_PAUSED also immediately revokes access.

Impact: a subscriber still entitled under a grace period can lose server access. Severity depends on store/provider configuration. The local classifier confirms the downgrade; a real grace-period lifecycle remains untested.

Fix: synchronize authoritative active entitlements and expiration/grace information rather than translating every payment problem into revocation. [RevenueCat billing and grace-period guidance](https://www.revenuecat.com/docs/subscription-guidance/how-grace-periods-work).

### F05 — High, deployment verification needed: learners can mint XP through public authenticated RPCs

Evidence: migrations `036_gamification_lockdown.sql:117` and `046_idempotent_xp.sql:43`, `:98`. The documented RPC permits arbitrary self-awards of 1–500 XP. The idempotent version validates only amount and key length; a learner can supply a new key for each award. Neither proves a lesson/review was completed.

Impact: server-side writes alone do not make rewards authoritative. If deployed as recorded, a modified client can manufacture levels and league standing and grow the event ledger. This is supported by SQL inspection, not a live exploit; repository instructions explicitly warn that production differs from these files.

Fix: award rewards from validated completion evidence with server-computed amounts and unique activity identities. Restrict generic award RPCs to the service role. Preserve legitimate offline progress with an evidence/reconciliation protocol. Check live grants and function bodies read-only before deciding exact changes.

### F06 — High architectural risk: shared identity/database plus global account deletion

Evidence: AGENTS.md states the production Supabase project is shared with other NovaWealth apps and `user_profiles` has multi-app columns. Every EAS build profile targets that project. `delete-account/index.ts:220` deletes the global Supabase Auth user.

Impact: deleting a Fluenci account can affect another app if the same auth identity is used there; exact cross-app effects depend on actual foreign keys and account reuse. Development can also modify production data and generate production costs. No deletion was tested.

Fix: establish a dedicated Fluenci staging project and a deliberate production app boundary. Prefer a dedicated Fluenci production project before public scale, with a planned migration of identities/data/integrations. If identity sharing is intentional, use app-specific memberships and deletion semantics rather than deleting a shared identity blindly. Verify all cross-app dependencies first.

### F07 — Medium: deletion cancels billing before checking whether deletion is allowed

Evidence: `delete-account/index.ts:89` cancels Stripe subscription; `:115` checks organization ownership afterward and may refuse deletion. Earlier successful mutations are also followed by later error messages saying nothing was deleted.

Impact: an organization owner can receive an account-deletion failure after billing has already been canceled. Partial cleanup is not atomic despite reassuring error copy.

Fix: perform non-mutating eligibility checks first, then execute a resumable deletion workflow that records each completed stage. Report partial progress accurately. Test each failure point with an organization owner and a subscriber.

### F08 — High for a multilingual/minor audience: moderation coverage is overstated

Evidence: `_shared/content-safety.ts` uses regexes; its async validator only wraps them. Violence/sexual/minor checks are primarily English. Language is accepted by the wrapper but does not select a comprehensive language-aware policy. Existing generation callers found by search do not provide a learner age.

Local reproduction: `Je vais te tuer.` is marked safe; `We are studying suicide prevention.` is blocked. This demonstrates both a false negative and a false positive in the actual validator, not a successful model jailbreak or proof that the model will generate either sentence.

Fix: define supported ages, contextual multilingual safety rules, moderation coverage, and response policy. Add adversarial evaluations by language and age group. Ensure validated output is checked before display/audio emission. Review the changing tutor implementation separately; do not assume this finding proves its new safety layer is identical.

### F09 — High launch-readiness gap: privacy documents do not describe the implemented product

Evidence: `docs/privacy_policy.md:59` says payments are entirely Stripe; the subprocessor table omits RevenueCat, Sentry, PostHog, and Fish Audio despite integrations in code. It describes OpenAI as transcription-only while avatars use OpenAI image editing. Voice retention wording differs between the policy and `lib/ai-consent.ts`.

Impact: disclosures, consent copy, and operating practices cannot all be inferred to match. This finding concerns repository documents; the published policy and App Store Connect declarations have not been compared. Claimed DPAs and retention jobs were not verified.

Fix: build a data inventory by feature, provider, payload, retention, consent, and deletion mechanism; update the published policy and store declarations from verified facts. Apple's rules require disclosure of third-party personal-data sharing, including AI, and explicit permission. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

### F10 — High operational risk: migration files cannot reproduce the deployed schema

Evidence: AGENTS.md explicitly calls migrations a record of intent. Migration 104 is comments about changed production limits, not executable SQL. Other recent migrations also refer to production as authoritative.

Impact: tests can pass while live RLS, grants, constraints, quota behavior, or recovery procedures differ. A fresh environment and disaster recovery cannot be trusted to reproduce production from this repository alone.

Fix: inventory live schema/grants/functions without modifying them, create an audited baseline, then maintain executable ordered migrations and drift checks. Rehearse restore and staging creation. Never run reset/push against the shared production project.

## Additional findings and follow-ups

- **Subscription listener leak:** `lib/purchases.ts:305` treats `addCustomerInfoUpdateListener` as returning an unsubscribe function. Installed SDK declaration returns void and provides `removeCustomerInfoUpdateListener(callback)` separately. Cleanup is therefore a no-op. Store the callback and remove it explicitly; test repeated mount/unmount and account changes.
- **Out-of-order entitlements:** local replay of an old RENEWAL after expiration writes premium/active with a past expiration. This is inconsistent state, but the latest inspected `get_effective_limits` checks period expiration, so this reproduction does **not** prove a paid-feature bypass. Use authoritative reconciliation and atomic event ordering; also test tier changes with unchanged expiration and concurrent deliveries.
- **Voice-cost concurrency:** transcribe and voice TTS read usage, call paid providers, then charge usage. The TTS source acknowledges the race. Reserve a bounded budget atomically and settle actual duration afterward; measure concurrent overage on staging. No load test was run.
- **Session storage:** Supabase refresh/access sessions persist in AsyncStorage. Assess migration to Keychain-backed storage and actual device backup/storage behavior. This is local-device hardening, not evidence of remote account takeover.
- **Dependency triage:** the two critical npm package entries are shell-quote (via react-devtools-core) and tar (via Expo CLI). These paths primarily concern developer/build tooling; mobile attack reachability has not been established. Review all advisories, patch compatible versions first, and validate any Expo upgrade deliberately. Do not blindly apply audit force-fixes.
- **Privacy manifest:** native `NSPrivacyCollectedDataTypes` is empty. Inspect the aggregate release archive and App Store disclosures against SDK/runtime behavior; this file alone does not establish a false App Store privacy label.
- **School authorization:** inspected handlers do check organization membership/classroom ownership in multiple sensitive paths. This is positive evidence, not a completed tenant-isolation test. Actual RLS, all roles, exports, dropped enrollment, and cross-classroom reads remain to test.

## Architecture assessment

Keep Expo/React Native and Supabase for now. They are not themselves evidence of a scaling problem. The app already has useful module boundaries, shared auth/validation, private avatar storage, atomic counters for many features, offline replay logic, subscription integration, and CI.

Prioritize five structural improvements:

1. Isolate environments and clarify ownership of auth identities and user data.
2. Build one durable entitlement reconciliation path with transactional webhook processing and repair tooling.
3. Make learning rewards derive from validated activity, not arbitrary client values.
4. Treat AI calls as measured operations with reservation, timeout, fallback, moderation, and cost reporting.
5. Split the 3,713-line query module into cohesive domains behind stable interfaces, after security invariants are covered.

Avoid speculative microservices or a full rewrite before evidence demands them. For global scale, measure database latency, cache hit rates, provider throughput, cost per completed lesson, and actual retained usage first. Production capacity and margins have not been established in this phase.

## Learning/product assessment boundaries

The app contains SRS, graded exercises, CEFR progression, chat corrections, reading, pronunciation, and goal tracks, with substantial unit tests. That does not establish educational effectiveness. The generation pipeline documents level checks as warn-only. Full analysis requires a representative content corpus per language/level, exercise ambiguity and grading review, audio quality checks, and learner outcomes rather than XP alone.

Evaluate onboarding-to-first-lesson completion, day/week retention, spaced-review adherence, delayed recall, speaking improvement, paid retention, and cost per retained learner. No live PostHog data has been queried yet. Follow the supplied CLI guide/skill-discovery instructions before doing so.

## Remaining audit work

- Review the finished tutor/navigation changes against a stable revision and rerun affected checks.
- Read deployed Supabase schema, RLS, grants, function/config versions, storage policies, and auth settings; use synthetic staging accounts for cross-user and role tests.
- Run Simulator user journeys with screenshot evidence: onboarding, permissions/consent, lesson completion, interruptions, offline replay, account changes, purchase/restore, and accessibility.
- Validate purchases and webhook adversity in store/Stripe sandbox with isolated data.
- Inspect release archive, signing, native privacy aggregation, App Store Connect configuration, public privacy/terms URLs, reviewer access, and actual device behavior.
- Audit content accuracy, licensing/provenance, CEFR fit, learning outcomes, age policy, and abuse handling.
- Review production observability, backups, recovery, vendor configuration, quotas, unit economics, and performance under controlled load.
- Complete historical secret scanning and dependency reachability review.

No public-launch approval is issued. Findings above justify fixes and further verification even though existing automated tests pass.
