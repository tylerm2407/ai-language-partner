# Spec: Hands-Free Mode (Commute Learning)

**Status:** Draft — not implemented
**Owner:** Tyler
**Related:** `docs/specs/niche-tracks.md`, `DESIGN.md`, `.claude/rules/learning.md`, `.claude/rules/mobile-ui.md`

---

## 1. Goal

Let a learner run a complete, adaptive, **eyes-free** language session — listening, speaking, being corrected, and advancing their SRS queue — without looking at or touching the phone. Target contexts: driving commute, walking, gym, chores, dog walk.

### Why this is the differentiator

Pimsleur owns audio-first commute learning, but its content is **scripted tape**: the same 30 lessons for every learner, no adaptation, and no evaluation of what the learner actually said. Every AI-voice competitor (Speak, Langua, Babbel Speak, Busuu Conversations, Duolingo Max) requires the learner to **hold the phone and look at it**.

Nobody owns *adaptive AI tutor + eyes-free*. That intersection is defensible because it is a systems problem — audio session management, interruption handling, offline pre-fetch, remote-command surfaces, and an SRS queue that drives the audio — not a single API call that a competitor clones in a weekend.

### Non-goals

- Not a replacement for the on-screen lesson flow. Hands-free is a **second mode**, not the default.
- Not a live open-ended conversation. That is the existing voice chat feature (being rewritten separately onto Haiku cascade + fish.audio). Hands-free is a *structured drill session* that may later borrow that stack.
- Not a driving-navigation app. We never show maps, never take route input.

---

## 2. Current state — verified in repo

Read before planning; these are facts, not assumptions.

| Thing | State | File |
|---|---|---|
| Background audio entitlement | ✅ Already declared | `app.json` → `ios.infoPlist.UIBackgroundModes: ["audio"]` |
| Audio playback | One-shot only. Creates a `Sound`, plays, unloads. No queue, no now-playing metadata, no remote commands. | `hooks/useAudioPlayer.ts` (52 lines) |
| Audio recording | One-shot press-to-record. Sets `allowsRecordingIOS` + `playsInSilentModeIOS` on start; **never restores the mode after stopping**. | `hooks/useAudioRecorder.ts` (92 lines) |
| Audio library | `expo-av@16.0.8` on Expo SDK 54.0.33. `expo-audio` is **not** installed. | `package.json` |
| Lock screen / CarPlay / Android Auto | ❌ None. No `react-native-track-player`, no `react-native-carplay`, no custom native module. | `package.json` |
| SM-2 engine | ✅ Complete and pure — `calculateNextReview`, `sortReviewQueue`, `isDue`, `isLeech` | `lib/srs.ts` |
| Due-queue fetch | ✅ `fetchDueReviewItemsWithCards(userId, limit)` | `lib/supabase-queries.ts:314` |
| TTS / STT / scoring | ✅ `getTextToSpeech`, `transcribeAudio`, `scorePronunciation` | `lib/ai.ts` |
| Offline write queue | ✅ Exists, reusable for review submissions | `lib/offline-queue.ts` |
| Read cache | ✅ Exists | `lib/read-cache.ts` |
| Feature-flag pattern | ✅ `SCHOOL_ENABLED` — follow this shape | `config/app.ts` |

**Conclusion:** the *marketing claim* ("learn while you drive") is currently unbacked. Background audio is permitted by the manifest but nothing in the app produces a continuous, eyes-free session.

### Two known landmines

1. **Audio session ownership.** `useAudioRecorder.startRecording()` calls `Audio.setAudioModeAsync({ allowsRecordingIOS: true })` and never reverts it. On iOS this leaves the session in `PlayAndRecord`, which routes playback to the earpiece and drops output volume. In a screen-tap flow users don't notice; in a 20-minute driving session it is fatal. Hands-free mode must own the audio session explicitly and restore it on every transition.
2. **`expo-av` is legacy.** Expo is migrating to `expo-audio` / `expo-video`. Confirm the deprecation timeline for the SDK we ship on before committing more code to `expo-av`, and confirm whether `expo-av` and any new player library can coexist — two libraries both mutating `AVAudioSession` is a classic source of silent-playback bugs. **Do not skip this check.**

---

## 3. Interaction model

### Core principle

The session runs to completion with **zero required input**. Every control is optional and has at least two ways to trigger it: a physical/remote control and a spoken command. On-screen controls exist but are a fallback, sized for a glance, never required.

### The loop

```
  ┌─────────────────────────────────────────────────────────┐
  │  ANNOUNCE      "Card 3 of 20. Listen."                   │
  │  PROMPT        <TTS: target phrase or L1 cue>            │
  │  EARCON        short tone = "your turn"                  │
  │  LISTEN        record until silence or max window        │
  │  EVALUATE      transcribe → grade → SM-2 rating          │
  │  FEEDBACK      "Correct." / "Close — it's <phrase>."     │
  │  COMMIT        write review item + log (offline-safe)    │
  └──────────────────────────► next item ───────────────────┘
```

Step timings are configurable; defaults in §6.

### Controls

| Intent | Remote / hardware | Spoken command | On-screen |
|---|---|---|---|
| Pause / resume | Play-pause (headphone, wheel, lock screen) | "pause" | Full-width button |
| Repeat item | Previous track | "repeat", "again" | Full-width button |
| Skip item | Next track | "skip" | Full-width button |
| Slow down audio | — | "slower" | In settings |
| Reveal translation | — | "translate", "what does that mean" | Glance card |
| End session | — | "stop", "end session" | Full-width button |

Spoken commands are matched against the **already-transcribed utterance** in the LISTEN step. We do **not** run an always-on wake word — that would mean continuous streaming STT, which is expensive, battery-hostile, and a privacy story we don't want to defend. Command matching happens before answer grading: if the utterance matches a command pattern, it is treated as a command and not graded as an answer.

Command matching must be per-locale and must not swallow legitimate answers. Rule: an utterance is treated as a command only if it matches a command phrase **in the user's L1** and the current card's expected answer is not itself that phrase.

### Barge-in

The learner may start speaking during PROMPT playback. Recording therefore starts slightly before playback ends (configurable pre-roll). Requires simultaneous play + record — an iOS `PlayAndRecord` category with `defaultToSpeaker`. Confirm feasibility during the spike (§9); if it proves unreliable, ship v1 without barge-in and enable it later behind a flag.

---

## 4. Safety, legal, and App Store

This section is not optional and should be reviewed by Tyler before any marketing copy is written.

- **Framing.** Market the capability as **hands-free** — commute, walking, gym, chores. Do not build the App Store listing, screenshots, or primary tagline around *driving*. Same feature, larger addressable audience, and it avoids inviting driver-distraction scrutiny during review.
- **In-app disclaimer.** On first entry to hands-free mode, a one-time full-screen notice: *keep your eyes on the road; the app requires no interaction; pull over before touching the screen.* Persist acknowledgment. Do not repeat it every session.
- **No screen dependency.** If any step *requires* a tap to proceed, the mode has failed its own premise. Treat "session cannot advance without touch" as a release-blocking bug.
- **Notifications.** Suppress non-critical push during an active session — a banner is exactly the thing that pulls eyes to the phone.
- **Volume and ducking.** Respect system volume; duck rather than stop for navigation prompts (§6).

---

## 5. Platform surfaces — the hard part

This is where the native dependency decision lives. Three surfaces, escalating cost.

### 5.1 Background audio + eyes-free UI — **no new dependency**

Already possible today. `UIBackgroundModes: ["audio"]` is declared. With correct `setAudioModeAsync` handling (`staysActiveInBackground`, `playsInSilentModeIOS`, `interruptionModeIOS: DoNotMix` during prompts, ducking otherwise), a session continues when the app is backgrounded or the screen locks.

**What you do not get:** lock-screen artwork/title, lock-screen transport buttons, Control Center controls, headphone-button routing, Android Auto, CarPlay.

### 5.2 Lock screen + Control Center + Android Auto — **`react-native-track-player`**

`react-native-track-player` (RNTP) v4 provides background playback, `MPNowPlayingInfoCenter` metadata, `MPRemoteCommandCenter` remote commands, Android media notification + audio focus, and Android Auto surfacing.

**Costs and risks — all must be settled in the spike:**

- Native module → requires a custom dev build. Already fine: `expo-dev-client@~6.0.21` is installed.
- Needs an Expo config plugin (or manual native config). **Verify current Expo SDK 54 / RN 0.81 new-architecture compatibility before adopting** — do not assume.
- **Model mismatch.** RNTP is built around a queue of known tracks. A tutoring session is dynamic: generate TTS → play → record → grade → decide next. Mitigation: treat each generated prompt as a track appended to the RNTP queue, keep the *decision* logic in our own engine, and use RNTP purely as the playback + remote-control surface.
- **Audio-session contention.** RNTP and `expo-av` both configure `AVAudioSession`. Running both is the single largest technical risk in this spec. Preferred end state: RNTP owns *all* playback app-wide and `expo-av` is used only for recording (or recording moves to `expo-audio`). Do not ship a build where both libraries fight over the session.

### 5.3 CarPlay — **`react-native-carplay` + Apple entitlement**

CarPlay is **not** unlocked by RNTP alone. It needs CarPlay templates (`CPListTemplate`, `CPNowPlayingTemplate`) via `react-native-carplay` or a custom native scene, **and** the CarPlay entitlement.

**Blocking external dependency — Tyler only.** The entitlement (`com.apple.developer.carplay-audio`) is requested from Apple through the Developer account. Apple grants it case-by-case, historically to audio apps (music, podcast, audiobook). A language-learning app that plays continuous audio is a plausible fit but **not a guaranteed approval**, and the request has multi-week lead time. Nothing in Phase C can be built or tested until it is granted.

**Action:** file the CarPlay entitlement request now, in parallel with Phase A/B work, so the lead time overlaps development rather than following it.

Android Auto has no equivalent gate — it comes largely free with a correctly configured RNTP media service, though Play Store review of Auto-enabled apps has its own checklist.

---

## 6. Session engine — design

### Placement

The decision logic must be a **pure, dependency-free module** so it is testable on Windows with plain Jest, with no simulator, no native modules, and no network.

- `lib/handsfree-session.ts` — pure state machine. No React, no `expo-av`, no Supabase.
- `lib/handsfree-session.test.ts` — colocated Jest tests.
- `hooks/useHandsFreeSession.ts` — binds the engine to audio I/O, network, and persistence.
- `app/(app)/practice/handsfree.tsx` — the eyes-free screen.

This split is the whole testing strategy. See §9.

### Types (proposed)

```ts
export type HandsFreeStep =
  | { kind: 'announce'; text: string }
  | { kind: 'prompt'; cardId: string; text: string; lang: LanguageCode }
  | { kind: 'earcon'; tone: 'your_turn' | 'correct' | 'incorrect' }
  | { kind: 'listen'; cardId: string; maxMs: number }
  | { kind: 'feedback'; text: string; lang: LanguageCode }
  | { kind: 'summary'; text: string };

export type HandsFreePhase =
  | 'idle' | 'announcing' | 'prompting' | 'listening'
  | 'evaluating' | 'feedback' | 'paused' | 'ended';

export interface HandsFreeConfig {
  targetDurationMs: number;   // time-boxed, not count-boxed
  maxListenMs: number;        // default 8000
  silenceTimeoutMs: number;   // default 1800
  bargeInPreRollMs: number;   // default 0 (off) until spike proves it
  repeatOnFail: boolean;      // default true — failed item replays once
  speechRate: number;         // 0.75 – 1.0
}

export interface HandsFreeSessionState {
  phase: HandsFreePhase;
  queue: ReviewItemWithCard[];
  index: number;
  results: { cardId: string; rating: ReviewRating; transcript: string }[];
  startedAt: number;
  elapsedMs: number;
}
```

The engine exposes pure transitions — `start`, `advance`, `submitUtterance`, `pause`, `resume`, `skip`, `repeat`, `end` — each `(state, input) => nextState`. Every branch is unit-testable without touching a device.

### Time-boxing, not count-boxing

A commute is a duration, not a card count. The session is built for a target duration (default 20 min, user-selectable 5 / 10 / 20 / 30 / until-I-stop). The engine estimates per-item cost from measured step durations and stops adding items when the remaining budget is exhausted, then plays a summary.

### Queue construction

1. `fetchDueReviewItemsWithCards(userId, limit)` — SM-2 due items, the existing source of truth.
2. Sort with the existing `sortReviewQueue` (most overdue first, then hardest).
3. Filter to cards that are **speakable**: has target text, and audio is either cached or TTS-generatable.
4. Top up with new cards if the due queue underfills the time box, respecting `SRS_DEFAULTS.newCardsPerDay` and the existing `tryConsumeNewCardSlot()` guard.
5. Optional filter by active niche track once `niche-tracks.md` lands.

**Ratings from a hands-free session must feed the same SM-2 state as on-screen review.** This is the point of the feature — the commute genuinely advances the learner's queue. Use `calculateNextReview` unchanged and write via the existing `upsertReviewItem` / `insertReviewLog` path.

### Grading without a screen

- **Pronunciation / repeat-after-me cards** → `scorePronunciation` (`lib/ai.ts`).
- **Recall cards (L1 cue → L2 production)** → `transcribeAudio` then compare against the expected answer using the existing `lib/fuzzyMatch.ts` and `lib/grading.ts`, honoring the Levenshtein tolerances in `.claude/rules/learning.md` (≤1 for answers ≤4 chars, ≤2 otherwise).
- Map the score to a 0–5 `ReviewRating` and feed `calculateNextReview`.
- **Do not invent a new grading path.** Reuse `lib/grading.ts` so on-screen and hands-free grading cannot drift.

> ⚠️ `scorePronunciation` / `transcribeAudio` route through edge functions currently being rewritten (Gemini Live → Haiku cascade + fish.audio). The engine must depend on the **`lib/ai.ts` function signatures**, not on any provider detail, so the rewrite lands underneath it without touching this feature.

### Interruptions

| Event | Behavior |
|---|---|
| Phone call | Pause immediately; resume at the *start of the current item* when the call ends. Never resume mid-prompt. |
| Navigation prompt | Duck to ~20% for the prompt's duration, then restore. Do not pause. |
| Other app takes audio | Pause; resume on focus regain if within a grace window, else end and save progress. |
| Headphones unplugged / BT disconnect | Pause (matches every media app's expected behavior). |
| App backgrounded | Continue. This is the whole point. |
| Network lost | Continue from pre-fetched buffer (below); queue writes via `lib/offline-queue.ts`. |

### Offline pre-fetch — required, not optional

Commutes go through tunnels, garages, and dead zones. A session that stalls at a red light is worthless.

- Before the session starts, pre-generate and cache TTS for the first *N* items (default 5) and keep a rolling buffer of 3 ahead.
- Cache to disk keyed by `(cardId, voice, rate)`; reuse `lib/read-cache.ts` conventions.
- If the network drops, keep running on the buffer; degrade gracefully to recognition-only items (no fresh TTS needed) rather than stopping.
- Queue all review writes through `lib/offline-queue.ts` and flush on reconnect. **A commute must never lose SRS progress.**

---

## 7. Screen design

`app/(app)/practice/handsfree.tsx`. Rules from `DESIGN.md` and `.claude/rules/mobile-ui.md` apply — tokens only, no hard-coded values.

- Dark surface (`surface.base`), maximum contrast, no decorative motion.
- One enormous status line: what is happening right now ("Listening…", "Card 3 of 20").
- Three full-width controls, each ≥ 88pt tall (double the 44pt HIG minimum — this is a glance-only surface): **Repeat**, **Skip**, **Pause**. **End** sits lower, visually separated, so it is not hit by accident.
- No timers counting down, no XP animation, no streak pressure. This mode is where the "Adult mode" positioning is most visible — see build item #3.
- Full VoiceOver labels on every control; the entire screen must be operable without sight, which is the literal design goal anyway.
- Keep the screen awake while the session runs *if* the user is in a mount context; otherwise let it lock — audio continues either way.

---

## 8. Data model

Minimal. Reuse before adding.

- **Reuse:** `review_items`, `review_logs`, `daily_stats` — hands-free ratings are ordinary SM-2 reviews and must not be siloed.
- **Add:** one session row for analytics and for answering "does hands-free actually retain better?"

```sql
create table if not exists public.handsfree_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  planned_duration_ms integer not null,
  actual_duration_ms integer,
  items_attempted integer not null default 0,
  items_correct integer not null default 0,
  surface text not null default 'in_app'
    check (surface in ('in_app','lock_screen','carplay','android_auto')),
  ended_reason text
    check (ended_reason in ('completed','user_ended','interrupted','error')),
  created_at timestamptz not null default now()
);

alter table public.handsfree_sessions enable row level security;

create policy "own handsfree sessions select" on public.handsfree_sessions
  for select using (auth.uid() = user_id);
create policy "own handsfree sessions insert" on public.handsfree_sessions
  for insert with check (auth.uid() = user_id);
create policy "own handsfree sessions update" on public.handsfree_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists handsfree_sessions_user_started_idx
  on public.handsfree_sessions (user_id, started_at desc);
```

RLS is mandatory per `CLAUDE.md` §5. Apply via the Supabase MCP `apply_migration` **and** mirror as a numbered file in `supabase/migrations/`. Never `db push` against the shared production project.

Queries go in `lib/supabase-queries.ts` under a new `─── Hands-Free Sessions ───` section, `.limit()`-bounded per the project rule.

XP for a hands-free session must go through the existing `increment_xp` RPC — direct writes to gamification columns are blocked by a DB trigger (`CLAUDE.md` §4).

---

## 9. Testing strategy

Constraint: **development happens on Windows 11. There is no iOS simulator.** Any claim that "hands-free works" that is not backed by a device test is not a claim, it is a guess. Plan accordingly.

**Tier 1 — automated, runs on Windows today (must be green before merge):**
- `lib/handsfree-session.test.ts` — full state-machine coverage: every transition, time-box exhaustion, pause/resume, skip, repeat, correct/incorrect grading, command-vs-answer disambiguation, empty queue, network-loss path.
- Existing gates: `npm run typecheck`, `npm run lint`, `npm test`.

**Tier 2 — device only (Tyler, on hardware):**
- Screen locks mid-session → audio continues.
- Incoming call → pause → resume at item start.
- Navigation prompt → duck → restore.
- Bluetooth car audio: prompt audible, mic captures speech.
- Airplane mode mid-session → buffer carries → writes flush on reconnect.
- Battery drain over a real 30-minute session.
- Earpiece-vs-speaker routing after record→play transitions (the landmine in §2).

**Tier 3 — real-world:**
- One actual commute, start to finish, phone in pocket, no touching. If it cannot be completed without touching the phone, the feature is not done.

---

## 10. Phasing

Each phase is independently shippable and independently valuable.

### Phase A — Engine + eyes-free session *(no new dependencies)*
Pure engine, hook, screen, offline pre-fetch, audio-session correctness, interruption handling. Works with the app foregrounded or backgrounded, screen on or locked.
**Ships:** a real hands-free session. Makes the marketing claim honest.
**Verify:** Tier 1 green + Tier 2 device pass.

### Phase B — Lock screen + Android Auto *(adds `react-native-track-player`)*
Now-playing metadata, remote commands, media notification, Android Auto. Resolve the `expo-av` coexistence question first (§5.2) — that spike gates the phase.
**Ships:** control from the lock screen and the steering wheel.

### Phase C — CarPlay *(adds `react-native-carplay`; blocked on Apple entitlement)*
CarPlay list + now-playing templates. **Cannot start until the entitlement is granted.** File the request during Phase A.
**Ships:** the headline feature and a genuine moat.

### Recommended sequencing

Do **A** now. File the CarPlay entitlement request **now**, in parallel. Do **B** when the RNTP compatibility spike comes back clean. Do **C** when Apple approves.

---

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Apple denies the CarPlay entitlement | **High** — kills the headline claim | Phase A/B still deliver hands-free on lock screen + Android Auto. Market "hands-free", not "CarPlay", until approval is in hand. |
| RNTP × `expo-av` audio-session conflict | **High** — silent playback bugs | Spike before adopting. End state: one library owns playback. |
| STT accuracy in a moving car (road noise) | **High** — bad grading destroys trust | Bias grading lenient in hands-free; on low STT confidence, replay and re-ask rather than marking wrong. Never let a noisy road demote an SM-2 item the learner actually knew. |
| Latency per item (TTS + STT + grade) makes it feel dead | Medium | Pre-fetch aggressively; overlap generation of item *n+1* with playback of *n*; target < 700 ms between the learner finishing speaking and feedback starting. |
| Battery drain on a long commute | Medium | Measure in Tier 2. Screen off is the common case, which helps. |
| Voice stack rewrite in flight (Haiku cascade + fish.audio) | Medium | Depend only on `lib/ai.ts` signatures, never on provider internals. |
| `expo-av` deprecation | Medium | Confirm timeline before writing more `expo-av` code; migrating to `expo-audio` may be cheaper *before* Phase A than after. |
| Scope creep into full conversation | Medium | Hands-free is drills. Conversation is the separate chat feature. Keep the boundary. |

---

## 12. Open questions for Tyler

1. **File the CarPlay entitlement request now?** It has multi-week lead time and gates Phase C entirely. Nothing else blocks on the answer, so the cost of filing early is near zero.
2. **`expo-av` → `expo-audio` migration: before or after Phase A?** Before is more upfront work but avoids writing code twice. After risks a rewrite of the audio layer we are about to build.
3. **Is a new native dependency (`react-native-track-player`) acceptable?** `CLAUDE.md` §7 says don't add dependencies casually. Lock-screen control is not achievable without it or an equivalent custom native module.
4. **Barge-in in v1, or deferred?** It is the difference between "natural" and "walkie-talkie", but it is also the most likely source of audio-session bugs.
5. **Session length default** — 20 minutes assumed. Does that match the commute you are targeting?
6. **Free or paid?** Hands-free is the flagship differentiator. Paywalling it entirely blocks discovery of the thing that makes Fluenci worth paying for. Suggested: free with a daily time cap, unlimited on paid — but this interacts with `_shared/plan-limits.ts` and is a pricing decision, not an engineering one.
