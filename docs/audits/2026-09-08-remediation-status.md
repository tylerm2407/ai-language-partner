# Audit remediation status

**Audit:** [`2026-09-08-final-audit.md`](./2026-09-08-final-audit.md)

**Branch:** `fix/audit-remediation`

**Status date:** 2026-09-08

## Executive status

All source-controlled remediations for F01–F24 have been implemented and tested. The public legal pages are also deployed and verified. This branch is not, by itself, a production launch approval: the remaining gates require production credentials, account-owner configuration, deployment, or physical-device and payment-provider validation that cannot be truthfully established by repository tests.

| State | Meaning |
|---|---|
| Implemented | The source change is committed and automated checks pass. |
| Live verified | The production-facing result was directly checked after deployment. |
| Operational gate | A source safeguard exists, but an owner-controlled deployment or external verification is still required. |

## Finding-by-finding closure

| Finding | Remediation | Evidence | State |
|---|---|---|---|
| F01 | Checkout binds Stripe customer selection to the authenticated Supabase identity instead of request email. | `70ac60d`; checkout ownership tests | Implemented |
| F02 | RevenueCat events are claimed only after successful processing, with durable retry-safe state. | `3a872b3`; webhook unit tests | Implemented |
| F03 | RevenueCat transfer events reconcile both source and destination owners. | `5ab7e32`; transfer tests | Implemented |
| F04 | Billing warnings preserve access; entitlement expiry remains authoritative. | `f5a22e9`; lifecycle tests | Implemented |
| F05 | Client-awarded XP and replayable challenge awards are retired in favor of server-owned, evidence-bound awards. | `da01896`; database and client tests | Implemented; deploy and re-test grants in production |
| F06 | Build profiles now fail closed if non-production builds point at production Supabase; deletion performs a cross-product ownership preflight. | `24c0594`, `c7ff44e`; 5 build-environment tests | Operational gate: provision isolated non-production Supabase and populate EAS-scoped variables |
| F07 | Account deletion performs eligibility and billing preflight before irreversible work and remains resumable on partial provider failure. | `c7ff44e`; deletion function tests | Implemented; provider sandbox drill required |
| F08 | Generated content and authoring tools use multilingual deterministic and provider moderation with explicit failure behavior. | `2b177e2`, `bb60268`; moderation tests | Implemented |
| F09 | Privacy documentation now names the implemented processors and data flows. | `aa0a2e0`; deployed policy content check | Implemented; live policy verified |
| F10 | CI rebuilds the database from the migration chain and runs schema tests, preventing an unproven migration set from merging. | `75491ec`; workflow review | Implemented; first hosted CI rebuild remains a release gate |
| F11 | `/privacy` and `/terms` were deployed to `fluenciapp.com` and return HTTP 200 with security headers. | Vercel deployment `dpl_38Vj6psKHT9ki8Pe2YT87nTKaoth` | Live verified |
| F12 | Podcast storage policies no longer grant public upload or deletion. | `1fc4a0e`; policy tests | Implemented; deploy and re-run anonymous denial probe |
| F13 | The permissive legacy avatar read policy is removed; object access is owner-scoped. | `1fc4a0e`; policy tests | Implemented; deploy and re-run cross-user denial probe |
| F14 | Submission creation is server-owned, enrollment-checked, and excludes learner-authored grading fields. | `b264437`; submission tests | Implemented; deploy and re-run forged-grade probe |
| F15 | Recovery documents no longer claim disabled PITR or unverified storage recovery. | `88c276f`; documentation review | Operational gate: enable the chosen recovery service and complete a timed restore drill |
| F16 | Tutor provider sessions receive server-owned capabilities and hard provider-lifetime enforcement. | `26948d7`; tutor lifecycle tests | Implemented; deploy and load-test provider concurrency |
| F17 | Daily and monthly tutor reservations settle atomically without refunding an unreserved allowance. | `f24cb59`; reservation tests | Implemented |
| F18 | Tutor settlement is single-claim and concurrency-safe, preventing duplicate refunds. | `f24cb59`; concurrent settlement tests | Implemented |
| F19 | Tutor recovery settles economic state before bounded learning-analysis retries and retains recoverable transcripts. | `f24cb59`, `26948d7`; reaper tests | Implemented |
| F20 | Tutor transcript and lifecycle records are accepted only through server-issued capabilities. | `26948d7`; authorization tests | Implemented |
| F21 | Gradebook CSV cells neutralize spreadsheet formula prefixes. | `fd36a80`; CSV injection tests | Implemented |
| F22 | Analytics identity waits for auth restoration and resets only at a resolved anonymous boundary. | `fd36a80`; lifecycle tests | Implemented |
| F23 | Signup, onboarding, learning, and revenue events now represent durable authoritative outcomes; non-production telemetry fails closed without a separate key. | `87b3d39`; analytics tests and PostHog audit report | Implemented; deploy webhook secret and validate live funnel fill rates |
| F24 | Auth callbacks are accepted only for a locally initiated flow with matching state and purpose. | `b84a267`; deep-link tests | Implemented |

## Additional dependency remediation

Commit `2a61c81` updates Expo SDK 54-compatible patches and pins patched transitive releases for XML parsing, glob expansion, CSS processing, YAML parsing, HTTP/WebSocket clients, archive handling, DevTools shell quoting, and related tooling.

- Production-graph audit: **2 critical / 17 high / 44 total** before; **0 critical / 8 high / 32 total** after.
- The eight remaining high entries are npm's propagation of one `image-size` advisory through Metro and Expo. npm reports no patched `image-size` release and proposes Expo 57, a semver-major framework migration. The vulnerable parser is in local Metro build tooling, not an application endpoint or shipped runtime input surface. A framework-major upgrade was therefore not forced into this security patch.
- Expo's SDK dependency validator passes, with explicit exclusions for Sentry 8 and Worklets 0.5.2. Both packages declare peer compatibility with the installed React, React Native, and Expo versions.
- An iOS production bundle export completed successfully after resolution.

## Verification record

The final resolved graph passed:

- TypeScript: `tsc --noEmit`
- ESLint: 0 errors; 56 existing warnings
- Build environment policy: 5/5 tests
- Frontend: 102 suites, 1,700/1,700 tests; clean process exit
- Edge functions: 694/694 Deno tests
- Expo dependency validation: pass with the two documented exclusions
- iOS Metro production export: pass, 2,884 modules
- Public legal routes: HTTP 200 for `/privacy` and `/terms`

## Remaining production release gates

These are not code defects that can be safely inferred away. They must remain explicit release blockers until their evidence is attached:

1. Provision a genuinely isolated non-production Supabase project and EAS environment; prove preview/development builds cannot read or write production data.
2. Deploy the migrations and edge functions from this branch, configure required production secrets (including the PostHog server capture key), then repeat the F05/F12/F13/F14 live denial probes.
3. Run a clean migration rebuild in hosted CI and compare the resulting schema, policies, functions, and grants with production before promotion.
4. Enable and verify the selected database and object-storage recovery controls; perform a timed restore drill and record RPO/RTO evidence.
5. Complete RevenueCat and Stripe sandbox matrices for purchase, renewal, billing issue, cancellation, expiry, restore, transfer, webhook retry, and account deletion.
6. Complete physical-device, poor-network, audio-interruption, accessibility, crash-reporting/source-map, and store-review checks on the signed release candidate.
7. Complete owner-only App Store / Play Console items: agreements, tax/banking, EU trader status, privacy/data-safety forms, age rating, products, metadata, and reviewer credentials.

Launch sign-off should occur only after those seven evidence sets are complete.
