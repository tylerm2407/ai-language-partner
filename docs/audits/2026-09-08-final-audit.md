# Fluenci — Final Audit Report

**Delivered September 8, 2026. Testing stopped at the owner’s request. This is the final report of work performed, not a completed exhaustive audit or approval to launch.**

## Executive assessment

**Do not launch the audited state.** Confirmed issues affect authorization, private storage, academic integrity, rewards, billing reliability and public legal disclosures. The new tutor implementation also has material cost-control and settlement risks. No application fixes were made during this assessment.

Keep Expo/React Native and Supabase. A wholesale rewrite is not supported by the evidence. Prioritize server-controlled authorization and financial workflows, reproducible isolated environments, recovery capability and reliable learning/outcome measurement.

### Highest-priority findings

| Priority | Finding | Evidence strength |
|---|---|---|
| Before launch | Anonymous users can read private-bucket avatars | Live synthetic avatar downloaded anonymously and by an unrelated test learner |
| Before launch | Anonymous users can upload/delete podcast storage objects | Live harmless audit object uploaded and deleted anonymously |
| Before launch or disable schools | Students can insert forged grades; enrollment is not enforced | Enrolled and unenrolled test learners inserted 100-point graded submissions visible to test teacher |
| Before launch | Authenticated learners can award themselves XP without activity | Live test awarded one XP to the audit learner; cross-user XP attempts were blocked |
| Before launch | Billing customer selection and webhook retry handling are unsafe | Actual handlers tested locally against synthetic services |
| Before launch | Privacy and terms links return 404; disclosures omit implemented providers | Direct HTTP verification plus source/document comparison |
| Before tutor deployment | Provider session lifetime is not controlled by app budget; refunds race | Source/API contract analysis and actual-handler mocked adverse-path tests |
| Before launch | Recovery documentation promises PITR that is disabled | Live backup API confirmed daily backups and PITR disabled |

## Scope, limitations and evidence interpretation

Repository: `/Users/tylermoore/Fluenci_Main/ai-language-partner`. Review spanned September 6–8 and included ongoing uncommitted work. Initial baseline was `0cbe104`; later observed commits included `6d01579`, `e9396d2`, `cf22858`, and `b163e0e`. The app was changing while it was tested. Findings apply to the captured source/deployed configuration at their observation times and must be checked against the eventual release candidate.

This document consolidates all 24 numbered findings and additional observations from the two assessment phases. **Live** means a bounded request against audit-owned fixtures or a read-only configuration check. **Local reproduction** means actual application logic with mocked external services; it does not establish production exploitability by itself. **Source risk** and **untested** are not represented as proven incidents.

No existing person’s account, grades or stored files were targeted. No real payments, bulk traffic, production restore, migrations, deployment or application fixes were performed. The initial report was committed and pushed as `6d01579`; this consolidated report and sensitive operational evidence remain local. Passwords and API keys are not included here.

### Validation completed

- September 7 TypeScript passed; ESLint reported 0 errors and 62 warnings.
- 97 Jest suites / 1,611 tests passed; 653 Deno tests passed. These results do not certify later revisions.
- Live metadata inspection covered 63 public tables with RLS enabled, storage policies, selected grants/functions, triggers, foreign keys and backup configuration.
- Selected secret-pattern scanning covered 2,719 Git blobs across locally available refs and found no matches. This is not proof of absence of all secret types or deleted remote history.
- Initial dependency scan reported 43 affected-package entries, including two critical build-tool dependency entries. Reachability was not fully established; these are not 43 demonstrated mobile vulnerabilities.
- Three disposable app accounts were created; bounded authorization tests used only those accounts and a new audit school/class/assignment.
- Simulator sign-in and onboarding were exercised, and the eight-question Spanish trial reached 8/8 correct. The final save path, interruption recovery and final release build were not validated.
- PostHog source integration, event schema, health and recommendations were inspected. No valid growth, retention or revenue conclusion was established.

### Important updates that supersede earlier uncertainty

F05, F12, F13 and F14 were subsequently demonstrated through bounded live tests using only audit fixtures. Earlier wording within those findings saying no live reproduction had been attempted describes the first observation and is superseded by the live verification section below.

The initial statement that avatar storage was private based on its bucket flag was incomplete: the legacy permissive SELECT policy permits unauthorized reads. Account coupling across development/preview/production is confirmed; actual cross-app identity deletion effects remain conditional.

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


## Updates to earlier findings

**F05: upgrade confidence to live configuration confirmed.** Both `increment_xp` and `increment_xp_idempotent` are executable by `authenticated`, and their deployed bodies permit caller-selected self-awards of 1–500 XP without validated activity evidence. A fresh idempotency key permits another award. `upsert_daily_stats` similarly trusts bounded client increments; per-call caps do not establish that the activity happened. Evidence: `2026-09-07/evidence/live-functions.json`, `2026-09-07/evidence/callable-security-functions.json`. A subsequent live test awarded one XP only to the disposable audit learner, confirming the finding.

**F06: environment coupling is confirmed; cross-app deletion remains conditional.** Development, preview, and production EAS profiles all point to the same Supabase project. Repository instructions describe shared identities. The live catalog includes 47 auth-user foreign keys, but metadata alone does not prove another app currently shares a particular person's account. Establish actual ownership before changing deletion semantics or migrating identities.

**F09: public policy availability now verified as broken.** See F11 below. Repository privacy wording remains inconsistent with implemented providers.

**F10: deployed state captured, not yet reproducible.** The live inventory is useful evidence but is not a tested clean baseline, complete migration chain, or recovery procedure. Tutor functions were absent from deployment at inspection despite related schema being present. Monthly quota RPCs are no longer executable by anon/authenticated in the inspected grants, which is a positive correction already present in the user's work.

**Correction to the initial architecture description:** calling avatar storage private based only on bucket configuration was insufficient. A remaining permissive SELECT policy defeats the intended owner-only access rule; see F13.


## New findings

### F11 — High / launch blocker: both in-app legal URLs return 404

`config/app.ts:119–120`, `app.json` privacy URL, and profile legal links point to `https://fluenci.com/terms` and `/privacy`. Direct HTTP header requests at 14:03 UTC returned 404 for both. The nearby source comment also states that the domain is not controlled by the app owner. Evidence: `2026-09-07/evidence/legal-url-check.txt`.

Users and reviewers cannot read the promised documents. Publish accurate documents on a controlled domain, update every in-app and store destination, and test the final release build. Apple requires a privacy policy accessible from the app and store metadata; subscription disclosures also need review. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

### F12 — High: podcast upload/delete policies are granted to public roles

The live `storage.objects` policies named “Service role can upload podcast audio” and “Service role can delete podcast audio” use role `public` and check only `bucket_id = 'podcast-audio'`. Live anon/authenticated table grants include the corresponding operations. A policy name has no enforcement effect.

The authorization configuration permits untrusted callers to target this bucket for upload/delete rather than restricting operations to a backend service. Potential consequences include hosted-content abuse, storage/egress cost, and audio loss. Initially no upload/delete was attempted and a read-only anonymous metadata query found no visible selected-bucket objects. Later, authorized live tests demonstrated anonymous upload and deletion of a new harmless audit object; see live verification below. Evidence: `2026-09-07/evidence/live-schema.json`, `2026-09-07/evidence/live-permissions.json`, `2026-09-07/evidence/anonymous-access.json`.

Restrict mutations to the intended identities and paths, then prove anonymous and unrelated-user denial against disposable objects in an isolated environment. Test the Storage HTTP API as well as database policy behavior.

### F13 — High privacy risk: legacy avatar SELECT policy overrides owner-only intent

The avatars bucket is marked private, but “Avatars are publicly accessible” remains a permissive SELECT policy for `public` with only the bucket predicate. Adding an authenticated owner-only policy does not narrow another permissive policy; eligible policies combine with OR.

This leaves the authorization boundary broader than the intended per-user avatar access. Later authorized tests retrieved a synthetic audit avatar anonymously and as an unrelated learner. No real person's image was targeted. Evidence: `2026-09-07/evidence/live-schema.json`. Remove the legacy broad policy in the fix phase and test signed/authenticated reads, listing, and cross-user access using synthetic files.

### F14 — High: students can supply grading fields when inserting a submission

Live “Students can insert own submissions” checks only `student_id = auth.uid()`. Authenticated users have INSERT privilege. Grading columns such as `teacher_score`, `final_score`, `auto_score`, and `graded_at` are ordinary writable columns. The protective trigger is explicitly BEFORE UPDATE only; no equivalent INSERT guard appeared in the captured trigger inventory.

The policy therefore does not prevent a student from creating their own submission with prefilled grades. It also does not check enrollment or assignment eligibility; a valid foreign key is not a membership check. This was initially a live authorization-design finding. Later tests confirmed it by inserting forged grades only on a synthetic audit assignment. The live constraint inventory confirms only identity/relationship uniqueness, foreign keys and a status enumeration here; it supplies no grade-origin guard. The subsequent disposable student/teacher test confirmed this path, as detailed below. Evidence: `2026-09-07/evidence/live-schema.json`, `2026-09-07/evidence/live-permissions.json`; `2026-09-07/evidence/submission-constraints.json`; source baseline `supabase/migrations/021_school_system.sql:124` and `:427`.

Move trusted grading transitions behind a server-owned operation, protect both INSERT and UPDATE, and verify assignment membership and state. Test self-insert with forged scores, unrelated assignment IDs, dropped enrollment, and authorized teacher grading.

### F15 — High operational risk: recovery plan promises PITR that is disabled

`docs/business_continuity_plan.md:40`, `:53–55`, and several incident playbooks claim database recovery within one minute using PITR and a 30-day window. The live backup API returned `pitr_enabled: false` and daily completed backups from August 31 through September 7.

The available evidence supports daily backups, not the promised sub-minute data-loss bound. Recovery procedures that rely on PITR cannot be followed as written. The claimed storage versioning and quarterly restore exercises have not been demonstrated. Supabase database backups contain storage metadata, not the stored files themselves. [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups).

Choose and fund explicit recovery objectives, configure matching backups, maintain separate object recovery, and rehearse restoration into an isolated project. Preserve successful backup evidence as a positive control; do not describe the app as having no backups. Evidence: `2026-09-07/evidence/backups.json`.

### F16 — High, unreleased tutor: application budget does not enforce provider-session lifetime

`supabase/functions/tutor-session/start.ts` returns a Realtime client secret to the device. `turn.ts` reports termination decisions to the client. `end.ts` and the reaper settle the application ledger without a provider call ID or server-side hangup path found in the inspected implementation.

A modified client can ignore application heartbeat/termination instructions and may continue using a provider connection after application settlement. OpenAI documents that client secrets can create multiple sessions while valid, that session options can be overridden, and that secret expiry does not terminate sessions already created. This is why a short token TTL alone does not bound application spend. [OpenAI client-secret reference](https://developers.openai.com/api/reference/typescript/resources/realtime/subresources/client_secrets/methods/create).

The vendor supports server-side call termination, so the source assumption that there is no connection the server can close is not a sufficient architecture basis. [OpenAI hangup API](https://developers.openai.com/api/reference/python/resources/realtime/subresources/calls/methods/hangup).

Use an authoritative server-managed call lifecycle, provider usage accounting, bounded concurrency, and a kill mechanism tied to the actual vendor call. Verify with a capped sandbox test that ignores every client instruction and tries token reuse. This is an inference from source and documented API behavior; no paid exploit was run. The tutor endpoints were not deployed at inspection.

### F17 — High, unreleased tutor: a refused daily reservation refunds budget it never reserved

`start.ts:219` calls `refundBoth` after monthly reservation succeeds but daily reservation is refused. That refunds daily seconds as well as the monthly reservation, even though the daily debit did not occur.

The local actual-handler harness returned 429 while recording a daily refund of 1,200 seconds after `consume_daily_quota` returned false. Repeated denied attempts can replenish previously consumed daily allowance, subject to the actual caller/rate-limit and reservation state. Refund only successful reservations, ideally by a unique durable reservation record. Evidence: `2026-09-07/evidence/tutor-reproduce.cjs`, `2026-09-07/evidence/tutor-reproductions.jsonl`.

### F18 — High, unreleased tutor: concurrent end requests both refund the same reservation

`end.ts:98` refunds before the later conditional close, without first claiming settlement. Two requests can both read the open session and both refund. The final conditional close does not undo the first-stage duplicated money operations.

The local harness ran two concurrent actual-handler calls: both returned 200 and each refunded 589 seconds and 116 cents against the same synthetic session. Use one transactional settlement claim and idempotent ledger entries; coordinate the honest end path and reaper with the same protocol. Test concurrent ends, end/reaper races, provider timeouts and process death. Evidence: `2026-09-07/evidence/tutor-reproductions.jsonl`.

### F19 — Medium, unreleased tutor: failure recovery can lose refunds and learning records

`start.ts:369–370` and `end.ts:100–117` inspect rejected promises but do not inspect fulfilled Supabase results containing an `error`. Such failures can be silently treated as successful refunds. The reaper checks RPC errors, but its settlement claim and refunds are separate effects and need crash-safe recovery.

In `end.ts:157–185`, analysis failure is caught, the session is still closed, and the transcript is dropped even when closing reports an error. The comment promising reaper recovery is inconsistent with closing the row and deleting the retry input. Refund functions also select the current day/month rather than the original reservation period, so cross-midnight/month settlement requires explicit verification and correction.

Persist pending settlement/analysis state, preserve input until durable completion, and retry individual idempotent steps. These failure paths are source-confirmed; they were not all independently fault-injected.

### F20 — High integrity risk, unreleased tutor: authenticated transcript uploads are still client-authored

`turn.ts` accepts `learnerText` and `tutorText` from the request and stores them for later analysis. `end.ts` treats the accumulated server buffer as preferable to client-submitted end text, but authenticating the sender does not prove these words came from the actual audio session.

A modified client can skip output moderation calls or fabricate conversation evidence turn by turn. Safety events and downstream learning records therefore do not have the provenance the comments imply. Bind events to server-observed provider output, and clearly distinguish self-reported practice from validated learning evidence. This is source analysis, not a demonstrated model jailbreak or fabricated live learning record.

### F21 — Medium: gradebook CSV does not neutralize spreadsheet formulas

`lib/supabase-queries.ts:3467` escapes CSV delimiters but not formula-leading content. The actual export function, run with a synthetic learner named `=1+1`, emitted a row beginning with that formula unchanged. A teacher opening such an export in spreadsheet software may interpret learner-controlled text as a formula. This reproduction proves unsafe serialization, not code execution or data exfiltration.

Use a deliberate spreadsheet-safe export encoding for untrusted cells, covering formula prefixes, leading control characters and delimiter quoting. Verify in the spreadsheet applications the product supports. Evidence: `2026-09-07/evidence/csv-reproduce.cjs`, `2026-09-07/evidence/csv-reproduction.json`.

### F22 — Medium: analytics identity resets before auth restoration finishes

`hooks/useAuth.ts:35` begins with a null session and loading true. The identity effect in `app/_layout.tsx:128–140` immediately calls `resetAnalytics()` when session is null, without checking loading. This can reset a persisted anonymous identity on each cold start before the stored session is restored, fragmenting pre-signup attribution.

Stable authenticated IDs, one SDK initialization, bounded event names and explicit logout reset are positive controls. Gate logout/reset semantics on resolved authentication, then verify cold start, anonymous return, signup, logout and account switch in captured events. Source finding; a complete device identity trace remains unperformed.

### F23 — Medium: captured events cannot yet establish reliable signup, durable learning, or subscription revenue funnels

`signup_completed`, `subscription_started` and `subscription_cancelled` appear in the event contract without corresponding lifecycle emissions in inspected signup/billing paths. Client `purchase_completed` events lack authoritative renewal history and monetary properties. `app/(app)/learn/[lessonId].tsx:171–182` captures `lesson_completed` before persistence succeeds, so the event is not proof of durable completion. Onboarding completion is emitted for both draft/preauth and saved flows with different meanings.

Separate attempted, local, persisted and provider-confirmed outcomes. Capture authoritative subscription transitions from the reconciled backend, with a stable event identity and a reviewed property contract. Test the funnel with synthetic users before using it to guide growth spending.

PostHog project 590929 returned an active warning that authorized URLs are absent, and recommendations indicating error alerts and project/per-issue rate limits are disabled. These are configuration follow-ups, not proof that Sentry alerting is absent or that mobile capture is broken. Source-map and long-running-issue recommendations were still computing and are not failed checks. Evidence: `2026-09-07/evidence/posthog-health.json`, `2026-09-07/evidence/posthog-recommendations.json` (CLI text format despite filenames). The required CLI guide/skill workflow was followed; wizard ledger tools were unavailable, and no notebook was published.

### F24 — Medium: unsolicited deep links can replace the app session

`hooks/useAuthDeepLinks.ts:36–61` parses every incoming link and forwards a token pair to `supabase.auth.setSession` without an expected-route check or binding to a user-initiated authentication flow. Unknown token types are accepted. The actual hook callback, run with mocked authentication, forwarded synthetic tokens from `fluenci://unrelated-route` into session creation.

An attacker who persuades a learner to open a link containing the attacker's valid token pair may switch the learner into the attacker's account. The concern is session substitution and subsequent actions/data being associated with that account; this does not reveal the learner's original credentials or demonstrate takeover of their original account. Real OS dispatch, valid-token behavior and UI visibility need disposable-account verification.

Use an explicitly bound authentication flow, validate destinations and expected token types, and handle identity changes deliberately, including user-visible confirmation where appropriate for unsolicited cross-account links. A route allowlist alone does not bind a valid-looking link to the user's intent. Evidence: `2026-09-07/evidence/auth-link-reproduce.cjs`, `2026-09-07/evidence/auth-link-reproduction.json`.


## Authorized live tests with disposable accounts — September 7 follow-up

After the user explicitly authorized creation and testing, three dedicated accounts were created: learner A, learner B, and a teacher. A new audit-only school, classroom, and assignment were seeded. Admin credentials were used only to provision those fixtures; attack requests used ordinary learner or anonymous clients. No existing person's records were targeted.

Evidence: `2026-09-07/evidence/account-creation.jsonl`, `2026-09-07/evidence/live-owned-fixture-results.jsonl`. Credentials and fixture inventory are stored locally under `private/` with restrictive permissions and are excluded from the report/evidence export.

- **F05 reproduced live:** learner A awarded itself 1 XP without a lesson. Direct XP writes and awards to learner B were denied.
- **F12 reproduced live:** anonymous client uploaded a harmless 46-byte text fixture to podcast storage and deleted that same fixture successfully.
- **F13 reproduced live:** anonymous and unrelated learner B clients both downloaded learner A's synthetic 68-byte PNG from the private avatars bucket. The fixture was then removed.
- **F14 reproduced live:** both enrolled A and unenrolled B inserted their own submissions with `status=graded` and `final_score=100`. The test teacher's ordinary client saw both scores. This confirms both forged grading and missing enrollment enforcement for this path.
- **Positive controls:** learner A could neither read nor change B's profile, and could not read B's submission. B's profile was verified unchanged.

The temporary storage objects were removed. Test accounts and the school fixtures remain for continued UI and role tests; learner A retains the single audit XP point. This follow-up supersedes earlier statements that these specific live exploit paths had not been exercised. No app fixes, real payments, bulk traffic, or changes to existing users were made.

Payment preparation at this stage found only a live-mode Stripe secret. App Store Connect sign-in was subsequently completed, but tester creation failed validation; see the final sandbox status below. No payment transaction was performed.


## Simulator evidence and product observations

Saved screenshots are from one development build on iPhone 17 Pro. They do not establish release accessibility, iPad readiness, or authenticated feature quality.

1. Language selection: nine language options were available, Spanish selected. The development RevenueCat logout LogBox obscured the bottom action. This is a development observation; do not label it a shipped production overlay. `2026-09-07/evidence/simulator-01.png`.
2. Personal goal: optional prompt with a clear skip path and concrete example. No clipping was found in the saved screenshot. `2026-09-07/evidence/simulator-02.png`.
3. Starting level: five self-assessment choices, with “can do” descriptions and CEFR labels. Useful clarity; self-selection does not validate actual proficiency. `2026-09-07/evidence/simulator-03.png`.
4. Name/avatar: synthetic “Audit Learner” entered; initials rendered correctly. No account or personal photo created. `2026-09-07/evidence/simulator-04.png`.
5. Daily time: clear selectable durations and first-lesson CTA. `2026-09-07/evidence/simulator-05.png`.
6. Trial lesson: reached a Spanish greeting multiple-choice exercise without an account. The saved initial state includes progress, exit and answer choices. A deliberately wrong answer subsequently showed a retry prompt and an explicit reveal option; that later state was observed but not saved as a screenshot. `2026-09-07/evidence/simulator-06.png`.

The visual transition from bright mascot onboarding to a dark, very different lesson system is pronounced. Treat design consistency as a product question to evaluate with users, not an assumed functional defect. Full trial completion, interruption recovery, large text, VoiceOver, reduced motion and tablet layouts remain to test. The app later appeared at the welcome screen during ongoing development; no controlled reproduction establishes a progress-loss bug.

## Architecture and scaling assessment

Prioritize enforceable invariants over another framework:

- Entitlements: durable provider-event ledger, one reconciliation path, retry/repair tooling, clear ownership across Stripe and RevenueCat.
- AI spend: server-owned reservation IDs, atomic settlement, actual provider-call lifecycle control, usage attribution, concurrency caps and global emergency controls.
- Learning integrity: immutable activity evidence with server-derived rewards and explicit grading roles; do not treat arbitrary client increments as trusted evidence.
- Persistence: an audited reproducible schema baseline, ordered migrations, drift detection, isolated staging, and rehearsed database plus object restores.
- Code organization: split the growing query module by domain while preserving tested interfaces. No evidence currently requires microservices or replacement of React Native.
- Measurement: reliable activation, delayed recall, speaking improvement, paid retention and contribution margin. XP, self-selected CEFR labels, and unit-test counts cannot establish world-class learning outcomes.

Scale is not yet validated. Review pagination and default row caps (gradebook export currently requests all matching assignments/submissions without an explicit paginated export protocol), expensive RLS/query plans, pool pressure, cache stampedes, provider rate limits, regional latency and offline replay at realistic cohort sizes. CI currently runs on pull requests and pushes to master; a direct push to the active redesign branch is not itself covered by that push trigger. Confirm branch protections and a release-required check set.

## Learning quality and content rights

Source inspection confirms adaptive SRS, graded exercises and a shared generation/validation pipeline, but not effectiveness across nine languages. The written learning design includes promises that need empirical validation: balanced skills, appropriate difficulty, audio availability, helpful corrections and offline operation. Some generation level checks are documented as warn-only in the initial assessment.

A release evaluation set should cover every advertised language and offered level, script/diacritic handling, equivalent answers, ambiguous prompts, pronunciation feedback by accent, repeated hints, offensive-but-educational context, and model/provider failures. Use independently reviewed reference answers and human language expertise; do not ask the same generating model to be the sole judge of correctness.

The Tatoeba ingestion path retains dataset and item IDs but its raw item shape does not retain contributor/license fields. Reading screens do have an attribution path. These observations do not establish a licensing violation; verify actual shipped corpus provenance, attribution, territory-dependent book rights and audio rights before publication. No legal compliance certification or comprehensive corpus review is issued.


## Additional final observations

### Onboarding wording is inaccurate for already signed-in learners

After test-account sign-in, completing the trial led to copy asking the learner to create an account to keep the lesson. `app/(public)/onboarding.tsx:634` selects this wording based on whether a trial exists, without checking authenticated state. The save handler does have a signed-in branch. This is a confirmed copy/flow mismatch, not a demonstrated loss of persisted progress. The Simulator later returned to onboarding during ongoing development; no controlled interruption test established a data-loss defect.

### Apple submission prerequisites remain unresolved

The App Store Connect app list displayed an updated Developer Program License Agreement requiring Account Holder review and acceptance, and an EU trader-status notice. No agreement was accepted and no trader declaration or store metadata was changed. Fluenci was listed as Prepare for Submission. The complete Fluenci metadata, privacy declarations, subscription products and final uploaded archive were not inspected.

### Sandbox preparation did not reach payment testing

Apple sandbox tester creation was attempted after sign-in. The user approved an email alias, but Apple rejected it because the iCloud account-name portion exceeded 28 characters. A shorter alias was proposed; that tester was not successfully created before testing stopped. Local Stripe credentials were live-mode, and a Stripe test-mode key had not been provided at the last check. No Apple sandbox, Stripe test or real-money transaction was completed. RevenueCat restoration/grace/transfer behavior therefore remains unverified end to end.

## Work not completed

| Area | Outstanding validation |
|---|---|
| Payments | Apple/Stripe sandbox purchase, renewal, cancellation, grace period, restore, transfer and webhook failure/recovery |
| Final revision | Retest the chosen stable release candidate, including all tutor and UI changes |
| Account/security coverage | Remaining role transitions, dropped enrollments, exports, Apple login, recovery/deep links and other cross-user boundaries |
| Devices and accessibility | Real microphone/audio/Bluetooth interruptions, poor networks, offline replay, large text, VoiceOver, reduced motion, tablet layouts |
| Store submission | Final archive/signing, aggregate privacy manifest, App Store declarations, age ratings, reviewer access, subscription metadata and live legal pages |
| Recovery | Isolated database and object-storage restore drill; prove recovery times and acceptable data-loss bounds |
| Performance/cost | Bounded staging load tests, provider concurrency, actual cost per session and paid-user margins |
| Educational quality | Representative content corpus, independent language/level evaluation, grading ambiguity, accent feedback and delayed-learning outcomes |
| Content rights/privacy operations | Shipped corpus provenance and attribution, provider agreements/retention/deletion mechanisms and public disclosures |
| Observability/dependencies | Sentry/vendor alert delivery, source-map verification, dependency reachability and final security regression checks |

## Recommended fix order

1. Close storage, grading and reward authorization gaps; add focused regressions for the demonstrated boundaries.
2. Repair billing identity ownership and durable entitlement reconciliation. Validate every lifecycle in sandbox.
3. Make tutor session control and reservation/settlement authoritative and crash-safe before deployment.
4. Publish correct legal disclosures; complete Apple prerequisites and verify consent against actual provider behavior.
5. Establish isolated staging, reproducible schema/configuration and tested database/object recovery.
6. Resolve remaining auth, CSV, analytics and UI issues; validate content and the final release build.

This ordering is a recommendation, not authorization already exercised to implement fixes. No issue should be marked resolved until the fix and its relevant regression or operational check pass.

## Retained test fixtures and report locations

The three audit accounts and their synthetic school/class/assignment/submissions remain available for follow-up testing. Learner A retains one audit XP point. Temporary avatar and podcast objects were removed. The exact credential and fixture inventories are stored locally with restrictive permissions under `2026-09-07/private/`; do not publish that directory. The attempted Apple tester’s local credential record is only a prepared record, not evidence of successful account creation.

- Initial report: `2026-09-06/AUDIT.md`.
- Expanded working assessment: `2026-09-07/ASSESSMENT.md`.
- Source snapshots, logs and synthetic test results: the corresponding `2026-09-07/evidence/` folders.
- Key live results: `2026-09-07/evidence/live-owned-fixture-results.jsonl`.
- Trial completion screenshot: `2026-09-07/evidence/simulator-trial-complete.png`.

**Final status: reporting completed at the owner’s request; audit coverage remains partial; no public-launch sign-off issued.**
