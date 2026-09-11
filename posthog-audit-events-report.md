# PostHog Event Capture Audit Report

## Summary

This audit covered the React Native client event wrapper and the live PostHog tenant through both correctness and cost-optimization lenses. Direct `posthog.capture()` checks passed by the skill's defined no-call-site path, native pageview volume is healthy, and one warning remains: development builds produced 84.79% of sampled `screen_viewed` traffic in the production project.

**Counts**

- **Errors**: 0 (must fix)
- **Warnings**: 1 (should fix)
- **Suggestions**: 0 (nice to have / cost savings)
- **Passes**: 6

**Problematic items**

| Severity | Area | Check | File | Details |
|----------|------|-------|------|---------|
| `warning` | Event Capture — Optimize | Environment pollution | — | `screen_viewed` had 184 explicitly development-build events out of 217 over seven days (84.79%); ambiguous null rows were excluded. |

## Recommended actions

1. **Event Capture — Optimize · Environment pollution** — Development builds are sending events to the production PostHog project. _Why it matters:_ 184 of 217 sampled screen views contaminate production funnels, retention, and dashboards while also consuming event volume. _Fix:_ Use separate project keys for production and non-production builds, and make production-key initialization fail closed for development builds; no specific code site can provision the separate tenant. See [PostHog's cost guidance](https://posthog.com/docs/product-analytics/cutting-costs).

## Full audit

### Event Capture

This area covers correctness and quality of direct `posthog.capture()` call sites: static names, consistent naming, duplicates, property bloat, and unsafe capture context. This project centralizes capture behind a typed provider wrapper, so the skill's direct-call checks followed their prescribed no-call-site skip path.

| Check | Status | File | Details |
|-------|--------|------|---------|
| Static event names | `pass` | — | Skip: no direct `posthog.capture` call sites detected. |
| Event naming standardization | `pass` | — | Skip: no direct `posthog.capture` call sites detected. |
| Duplicate events and bloat | `pass` | — | Skip: no direct `posthog.capture` call sites detected. |
| Event quality and context | `pass` | — | Skip: no direct `posthog.capture` call sites detected. |

### Assumptions and blind spots

The prescribed direct-call grep does not evaluate events emitted through `trackEvent()` and `AnalyticsProvider.capture()` in the project's wrapper, nor server-originated events. It does not prove runtime mount order, registration timing, or route gating. A pass here means the direct PostHog API surface is absent, not that every wrapper event has correct lifecycle semantics; those contracts require a separate application audit and live property-fill checks.

### Event Capture — Optimize

This area covers whether direct capture events are used downstream, whether web pageview defaults dominate volume, and whether non-production traffic leaks into the live tenant. Tenant queries were authenticated and read-only.

| Check | Status | File | Details |
|-------|--------|------|---------|
| Event usage coverage | `pass` | — | `{"captured_count":0,"captured_only":[],"heavily_used":[],"mcp_skipped":false}` |
| Pageview defaults | `pass` | `lib/analytics-posthog.ts:43` | `{"capture_pageview_setting":"unset","capture_pageleave_setting":"unset","pageview_share_pct":0,"recommendation":"keep","mcp_skipped":false}`; this is a native SDK, not a browser SDK. |
| Environment pollution | `warning` | — | `{"chosen_event":"screen_viewed","polluting_share_pct":84.79,"top_polluting_hosts":[],"top_polluting_app_versions":["1.0.0"],"top_polluting_libs":["posthog-react-native"],"recommendation":"use-separate-project-keys","mcp_skipped":false}` |

### Assumptions and blind spots

The usage rule only collects direct `posthog.capture()` names, so it does not measure downstream usage of wrapper-originated events even though the tenant contains them. Native events lack `$host`, and 20 sampled events had a null `isDevBuild`, so the 84.79% pollution share is a conservative lower-bound classification rather than a complete environment attribution. Development traffic could be intentional instrumentation testing, but it still shares production data and billing; verify separate-project routing, property fill rates, and saved insight/dashboard dependencies after remediation.

## About this audit

This audit ran the PostHog `audit-events` skill as a focused, read-only check of event capture health across **fix** and **optimize** lenses. Fix checks scan source; optimize checks additionally query the PostHog tenant read-only.

- `error` items break correctness now and should be fixed first.
- `warning` items cause data-quality problems or noticeably elevated cost.
- `suggestion` items are best-practice improvements or cost-saving opportunities.

The wizard ledger service was unavailable in this environment, so this report was rendered from the completed check results rather than `.posthog-audit-checks.json`. Re-run the PostHog event audit after separate environment keys are configured to confirm production isolation.
