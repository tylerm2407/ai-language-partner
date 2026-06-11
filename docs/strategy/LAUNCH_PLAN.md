# Fluenci — 1-Week Launch Plan

**Date:** 2026-05-02
**Ship Target:** 2026-05-09
**Status:** NOT READY — 19 critical blockers, 44 high-severity issues

6 parallel audits were run across the entire codebase. This document is the synthesized result: every issue found, prioritized into a day-by-day execution plan.

---

## The Honest Picture

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 19 | App crashes, App Store rejection, broken core features, security holes |
| HIGH | 44 | Degraded UX, race conditions, data loss, missing enforcement |
| MEDIUM | 30+ | Noticeable bugs, inconsistencies, accessibility gaps |
| LOW | 15+ | Polish, dead code, cosmetic issues |

The app **will crash on the home screen and profile screen** right now due to missing module imports. The writing grading and story generation edge functions **will not boot** due to a broken import. Voice conversation **produces no audio on iOS**. Stripe checkout **will get rejected by Apple**. There is no privacy policy, no account deletion, and no crash reporting.

This is fixable in a week, but only if you triage ruthlessly. Below is the plan.

---

## Day-by-Day Execution Plan

### Day 1 (May 3) — Stop the Bleeding: Crashes & Broken Imports

**Goal:** The app opens without crashing on every screen.

| # | Issue | File | Fix |
|---|-------|------|-----|
| 1 | Missing `useUnitProgressTiles` module crashes home screen | `app/(app)/index.tsx:26` | Create the module or remove the import and replace with inline logic |
| 2 | Missing `BecomeTeacherSheet` module crashes profile screen | `app/(app)/profile/index.tsx:24` | Create the module or remove the import and conditionally render nothing |
| 3 | `validateContentSafety` import doesn't exist — crashes `grade-writing` and `generate-story` | `grade-writing/index.ts:12`, `validated-generate.ts:19` | Align the import to match `content-safety.ts` actual exports (`validateContent`) |
| 4 | `lesson.unitId` passed as `courseId` to `markLessonComplete` — all lesson completion broken | `[lessonId].tsx:89` | Resolve correct `courseId` from the unit→course relation |
| 5 | `error.message` on `unknown` typed catch — swallowed errors in edge functions | `generate-content/index.ts:241`, `get-hint/index.ts:69` | Guard with `error instanceof Error ? error.message : String(error)` |
| 6 | Invalid Expo Router paths break review navigation | `review/index.tsx:166`, `top-mistakes.tsx:124` | Fix paths to match file-system route map |

**Verification:** Open every tab (Home, Learn, Review, Chat, Profile). Complete one lesson. Grade one writing submission. Generate one story. All must not crash.

---

### Day 2 (May 4) — Voice Pipeline: Make It Actually Work

**Goal:** Voice conversation works end-to-end on both iOS and Android.

| # | Issue | File | Fix |
|---|-------|------|-----|
| 7 | Gemini Live `audio/pcm` data URI is silent on iOS | `useGeminiLive.ts:81` | Convert PCM to WAV by prepending a 44-byte WAV header before creating the data URI |
| 8 | `File.base64()` not awaited — hold-to-talk broken on Android | `useAudioRecorder.ts:76`, `ChatInput.tsx:39` | Add `await` to the `file.base64()` call |
| 9 | `Audio.Sound` leak in ElevenLabs TTS path | `chat/index.tsx:317-357` | Track sounds in a ref, unload on unmount and before creating new ones |
| 10 | `score-pronunciation` has no authentication | `score-pronunciation/index.ts:62` | Add `getAuthenticatedUser()` call, use authenticated `userId` |
| 11 | Voice proxy leaks interval/session on Gemini WS failure | `voice-proxy/index.ts:220-253` | Guard interval creation, clean up Gemini WS in all error paths |
| 12 | Module-level `Audio.Sound` cache in ChatBubble never evicted | `ChatBubble.tsx:56` | Move cache to component scope or add size limit + cleanup |
| 13 | Double-counting voice minutes (proxy ticks + client report) | `useGeminiLive.ts:149`, `voice-proxy/index.ts:232` | Remove client-side minute reporting — proxy already handles it |
| 14 | Wrong icon (`car-outline`) on Live Voice button | `chat/index.tsx:691` | Change to `mic-outline` or `radio-outline` |
| 15 | Missing CORS headers on `transcribe` and `score-pronunciation` | `transcribe/index.ts:84`, `score-pronunciation/index.ts:88` | Import and apply `corsHeaders` from `_shared/cors.ts` |

**Verification:** Record voice → hear AI response on both iOS and Android. Pronunciation scoring returns a score. No crashes after 5 minutes of conversation.

---

### Day 3 (May 5) — Security & Payments: Don't Get Hacked or Rejected

**Goal:** Auth is secure, payments work, secrets are rotated.

| # | Issue | File | Fix |
|---|-------|------|-----|
| 16 | `create-checkout` has NO authentication | `create-checkout/index.ts:29` | Add `getAuthenticatedUser()`, verify `body.userId === authedUser.id` |
| 17 | Subscription tier name mismatch (`premium` vs `pro` vs `basic`) | Multiple migrations + webhook + plan-limits | Pick ONE canonical set and align everywhere. Recommended: `free`, `basic`, `premium`, `vip` |
| 18 | `CRON_SECRET_KEY` = literal string `"cron"` | `.env:13` | Rotate to a 32-byte random hex value |
| 19 | `determineTier()` defaults unknown price IDs to `basic` (free upgrade) | `stripe-webhook/index.ts:148` | Change default to `'free'` |
| 20 | Students can self-enroll in any classroom without invite code | Migration 021 RLS policy | Add `WITH CHECK` requiring valid `invite_code` match |
| 21 | Students can update their own `auto_score` and `ai_feedback` | Migration 021 RLS policy | Restrict student UPDATE policy to only `status`, `started_at`, `submitted_at` |
| 22 | `increment_xp` / `increment_daily_usage` SECURITY DEFINER with no caller check | Migration 004 | Add `IF p_user_id != auth.uid() THEN RAISE EXCEPTION` |
| 23 | Remove `console.log` of Supabase URL + key prefix | `lib/supabase.ts:18-25` | Delete or gate behind `__DEV__` |
| 24 | Rotate all API keys (Stripe live, Anthropic, OpenAI, ElevenLabs, Google) | `.env` | Revoke and reissue every key in the file |

**Verification:** Try calling `create-checkout` without auth token — must get 401. Try enrolling in a class without invite code — must fail. Verify Stripe webhook processes a test event correctly.

---

### Day 4 (May 6) — App Store Blockers: Apple & Google Requirements

**Goal:** The app can be submitted without guaranteed rejection.

| # | Issue | File | Fix |
|---|-------|------|-----|
| 25 | No Privacy Policy URL or in-app screen | Nowhere in app | Write a privacy policy, host it, add URL to `app.json`, add in-app link on profile screen |
| 26 | No Account Deletion flow (Apple requirement since June 2022) | Profile screen | Add "Delete Account" option that calls `supabase.auth.admin.deleteUser()` with confirmation |
| 27 | Subscriptions via Stripe web checkout violates App Store Guideline 3.1.1 | `lib/stripe.ts`, subscription screen | **For iOS:** Integrate RevenueCat or StoreKit for in-app purchases. **For Android:** Stripe web checkout is allowed but Google Play Billing is recommended. **Minimum viable:** Remove subscription purchase from iOS build entirely for v1 (make it free tier only on iOS, sell via web) |
| 28 | No Google Play submit config in `eas.json` | `eas.json` | Add `android.submit` block with `serviceAccountKeyPath` for Google Play |
| 29 | No crash reporting (Sentry/Crashlytics) | Not installed | `npx expo install @sentry/react-native`, configure in `app/_layout.tsx` |
| 30 | No `expo-updates` for OTA emergency fixes | Not installed | `npx expo install expo-updates`, configure update URL in `app.json` |
| 31 | ErrorBoundary missing on `(public)` and `(teacher)` layouts | `app/(public)/_layout.tsx`, `app/(teacher)/_layout.tsx` | Wrap with `<ErrorBoundary>` |
| 32 | No Android FCM configuration for push notifications | `eas.json` | Add `google-services.json` and reference in `eas.json` |

**Critical decision on #27:** RevenueCat integration is 2-3 days of work. If you can't do it in time, **launch iOS as free-only** and sell subscriptions through your website. Add IAP in a v1.1 update. This is the safest path to not get rejected.

---

### Day 5 (May 7) — Reading, Writing & Learning Pipeline Polish

**Goal:** Core learning features work correctly and feel better than Duolingo.

| # | Issue | File | Fix |
|---|-------|------|-----|
| 33 | Word-tap tooltip opens and immediately closes on iOS (press conflict) | `ReadingPassageViewer.tsx:108-116` | Use `stopPropagation()` on word press handler or restructure dismissal |
| 34 | Multi-word book annotations never match (tokenizer splits by word) | `BookReader.tsx:331-365` | Implement sliding-window phrase matching in `renderAnnotatedWords` |
| 35 | Writing score delta displays wrong on retry attempts | `[promptId].tsx:93-103`, `WritingFeedbackView.tsx:20` | Normalize score paths — pick one 0-100 or 0-1 representation |
| 36 | Hardcoded fallback scores (50/50/50) when grading JSON parse fails | `grade-writing/index.ts:167-188` | Retry the grading call or return explicit "grading failed" state |
| 37 | White text on light green/yellow backgrounds in feedback view (illegible) | `WritingFeedbackView.tsx:94,109` | Change text color to dark (`#166534` on green, `#854D0E` on yellow) |
| 38 | SM-2 ease factor incorrectly modified on failed review | `lib/srs.ts:14-32` | Skip EF update when `rating < 3` per SM-2 spec |
| 39 | CEFR filter not passed to `fetchReadingPassagesByCourse` | `learn/index.tsx:113` | Pass `profile?.level` as second argument |
| 40 | `CEFR_LABELS` incomplete (no C1/C2) and wrong labels | `learn/index.tsx:29-34` | Fix to: A1=Beginner, A2=Elementary, B1=Intermediate, B2=Upper-Intermediate, C1=Advanced, C2=Mastery |
| 41 | `max_tokens: 1024` too low for multi-exercise generation | `generate-content/index.ts:196` | Raise to 2048 for exercise generation tasks |
| 42 | `completeReading` has no error handling — silent progress loss | `useReadingPassage.ts:96` | Wrap in try/catch, surface error to user |

---

### Day 6 (May 8) — Gamification, Hearts, Streaks, Onboarding

**Goal:** All gamification loops work correctly. New users have a smooth first experience.

| # | Issue | File | Fix |
|---|-------|------|-----|
| 43 | Level-up modal fires on every cold open for level 2+ users | `useLevel.ts:22` | Initialize `prevLevelRef` to current computed level, not `1` |
| 44 | No heart check on home screen "Start a Lesson" button | `index.tsx:172-185` | Add `canPlay` check before navigation, show OutOfHeartsModal |
| 45 | Streak auto-repair fires repeatedly with parallel unguarded DB mutations | `useStreakProtection.ts:22-41` | Add `isRepairing` ref guard, await mutations sequentially |
| 46 | `today` never updates over midnight — challenges stale | `useDailyChallenges.ts:14` | Recompute `today` on interval or use `AppState` focus listener |
| 47 | `DailyChallenges` component ignores `useDailyChallenges` hook — bonus XP never claimed | `DailyChallenges.tsx:30-58` | Wire component to use the hook, or at minimum call `claimBonusXp` |
| 48 | Placement test falls back to Spanish for unsupported languages | `PlacementTest.tsx:148` | Show "Placement test not available" and default to A1 for unsupported languages |
| 49 | Stale `dailyStats` snapshot in achievement check | `[lessonId].tsx:96` | Call `useAppStore.getState()` after `addStats` resolves |
| 50 | Rapid double-tap on review rating submits same card twice | `review/index.tsx:38-61` | Add `isSubmitting` ref guard |
| 51 | Race between `loseHeart` optimistic update and interval poll | `useHearts.ts:52-63` | Use functional `setProfile(prev => ...)` update pattern |
| 52 | Incomplete `useEffect` deps in `useLevel` — stale user on DB write | `useLevel.ts:43` | Add `user?.id`, `profile?.xpLevel`, `profile?.leagueTier` to deps |

---

### Day 7 (May 9) — Final Verification & Submission

**Goal:** Build, test end-to-end, submit to stores.

| Task | Details |
|------|---------|
| Full end-to-end walkthrough | New user: onboard → placement test → first lesson → review → writing → reading → voice chat → profile |
| Test on real devices | iPhone (recent) + Android device. Not just simulator. |
| Build production binaries | `eas build --platform all --profile production` |
| Verify Stripe webhook | Process a test subscription creation event end-to-end |
| Verify push notifications | Send a test push on both platforms |
| Submit to App Store | `eas submit --platform ios --profile production` |
| Submit to Google Play | `eas submit --platform android --profile production` |
| Monitor Sentry | Watch for crashes in first hours |

---

## Issues Deferred to v1.1 (Ship Without These)

These are real issues but will not block launch or cause App Store rejection:

| Issue | Why Defer |
|-------|-----------|
| Content safety filter is English-only (9 languages unfiltered) | Low risk at launch scale; add multilingual patterns post-launch |
| AI conversation history stored in plaintext (FERPA) | Acceptable for pilot; encrypt before Bryant deployment |
| CORS wildcard (`*`) on edge functions | Acceptable for mobile-only app; tighten when web client launches |
| `nativeLanguage` hardcoded to `'en'` | Most initial users will be English speakers |
| Silent sign-up on login failure (email enumeration) | Low risk at launch scale |
| Analytics stubs (no events tracked) | Ship crash reporting (Sentry) first; add analytics in v1.1 |
| Teacher UI uses old design components | Teachers won't use v1.0; this is a Bryant Phase 2 feature |
| No universal links / associated domains | Basic `fluenci://` scheme works; add HTTPS links later |
| No app version checking / force update | `expo-updates` handles OTA; add force-update in v1.1 |
| Placement test `correctIndex` pattern is gameable | Shuffle options post-launch |
| Reading annotations don't match multi-word phrases | Single-word tooltip works; phrase matching in v1.1 |
| Voice proxy double-minute billing | Overcharges are refundable; fix accounting in v1.1 |

---

## The iOS Subscription Decision

This is the hardest call. Apple requires in-app purchases for digital content sold inside iOS apps (Guideline 3.1.1). Your options:

### Option A: Launch iOS as Free-Only (Recommended for 1 week)
- Remove the subscription purchase button from iOS builds
- All iOS users get the free tier
- Sell subscriptions through your website (`fluenci.com/subscribe`)
- Add RevenueCat/StoreKit in v1.1 (2-3 weeks post-launch)
- **Risk:** No iOS revenue at launch, but no rejection risk

### Option B: Integrate RevenueCat Now
- Install `react-native-purchases`
- Configure products in App Store Connect and RevenueCat dashboard
- Replace Stripe checkout with RevenueCat on iOS, keep Stripe on Android/web
- **Risk:** 2-3 days of work, tight for a 1-week timeline

### Option C: Submit With Stripe and Hope
- **Risk:** Guaranteed rejection. Do not do this.

**Recommendation:** Option A. Ship free on iOS, sell subscriptions on web. Add IAP in the first update. Getting live on the App Store is more important than monetizing day one.

---

## Required Environment Variables / Services Before Launch

| Service | What You Need | Status |
|---------|--------------|--------|
| Apple Developer Account | Active membership, bundle ID registered | Verify |
| Google Play Console | Developer account, app listing created | Verify |
| Supabase | Production project, all migrations applied | Verify |
| Stripe | Webhook endpoint configured, products created | Verify |
| Anthropic | API key with billing | Rotate key |
| ElevenLabs | API key with billing | Rotate key |
| Google AI | API key for Gemini | Rotate key |
| Sentry | Create project, get DSN | Set up Day 4 |
| EAS | Project linked, submit profiles configured | Verify |
| Privacy Policy | Hosted URL | Write Day 4 |

---

## Final Word

19 critical issues sounds bad, but most are 15-60 minute fixes (wrong imports, missing `await`, bad function signatures). The two biggest time sinks are:

1. **iOS subscription decision** — if you go free-only on iOS, this is a 30-minute change. If you integrate RevenueCat, it's 2-3 days.
2. **Voice pipeline on iOS** — the PCM→WAV conversion and audio cleanup will take a focused half-day.

Everything else is surgical. You have the skills to ship this in a week if you follow this plan and don't get distracted by medium/low issues. Fix the criticals, fix the highs that affect core learning, defer everything else to v1.1.

Ship it.
