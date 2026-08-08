# Next session — start here

Handoff from the differentiation-programme session (2026-08-05 → 08-07).
Written to be read cold: you should not need the previous conversation.

**Current focus: App Store launch.** Anything that does not serve v1 shipping is
parked. Hands-free is live and is the headline differentiator.

---

## 1. Do these first

### 1.1 Device-test hands-free before submitting — **highest priority**

`HANDSFREE_ENABLED = true` in `config/app.ts`. It was switched on deliberately
without a hardware pass, so this is outstanding, not optional.

Untested on a real device:

- Audio routing after a lesson speaking exercise → hands-free session
  (the earpiece bug this session fixed; verify the fix actually holds)
- Background playback with the screen locked
- Incoming call → pause → resume at the start of the current item
- Navigation prompt ducks the session rather than being blocked by it
- The endpointer in real road noise (`lib/vad.ts` — the thresholds are guesses)
- Bluetooth car audio: prompt audible **and** the mic still captures
- Airplane mode mid-session → buffer carries → writes flush on reconnect
- VoiceOver on `app/(app)/practice/handsfree.tsx`
- One real commute, phone in pocket, never touched

**Escape hatch:** set `HANDSFREE_ENABLED = false`. That removes the Practice-tab
entry point and nothing else — the audio-session refactor and review-queue fixes
are not gated by it and stay live either way.

Audio bugs are the category App Review actually stumbles into. A session that
holds the microphone or plays out of the earpiece reads as a rejection, not a
bug report.

### 1.2 File the CarPlay entitlement

`com.apple.developer.carplay-audio`, from the Apple Developer account. Multi-week
lead time, granted case-by-case. Blocks nothing today; gates the whole
lock-screen/CarPlay phase later. The lead time is the entire cost of filing early.

### 1.3 Tell the parallel session to stay off four files

A second Claude session has been working in this same tree. It overwrote
uncommitted work once and broke the build. The collision points:

```
lib/supabase-queries.ts
types/index.ts
lib/grading.ts
hooks/useReviewQueue.ts
```

If you are running two sessions again, split by file and commit often.

---

## 2. State of the tree

At handoff there was **one unpushed commit** (`ce42ba2`) and **13 uncommitted
files** — all belonging to the parallel session, mid-flight pricing/trial work
(`docs/strategy/pricing-spec.md`, `components/subscription/`,
`lib/trial-timeline.test.ts`, `lib/plans.ts`, `hooks/useHearts.ts`). Check
whether that landed before assuming the tree is clean.

**Verification baseline:** typecheck clean, 0 lint errors, 422 tests across 23
suites. Keep it there — `npm run check` is the gate.

---

## 3. What is live

| Area | State |
|---|---|
| Hands-free commute mode (Phase A) | Live, untested on device |
| Onboarding mode choice (Adult vs Gamified) | Live |
| Adult mode | Live |
| CEFR proficiency report | Live |
| Listening & speaking exercises (9,504) | Live |
| Niche tracks | **Parked — v2** |
| Hands-free lock screen / CarPlay (Phase B/C) | Not started |
| Spoken CEFR exam | Designed, not built |
| Hands-free analytics (W3 T13) | Not built — last ticket |

### Migrations applied to production this session

- **052** `adult_mode` on `user_profiles`
- **055** listening/speaking exercise generation (9,504 rows)
- **059** `handsfree_sessions` + `review_logs.client_log_id`

All three verified by querying production afterwards. No new advisor warnings.

---

## 4. Hands-free: where the code lives

The organising principle: **every decision lives in a pure, tested module**
because development happens with no iOS simulator. The hook is deliberately
dumb. If you find yourself adding an `if` to the hook that is not about
performing I/O, it belongs in the reducer where it can be tested.

```
lib/handsfree-session.ts     the reducer — the deliverable (41 tests)
lib/vad.ts                   endpointer: when did the learner stop talking
lib/audio-session.ts         SOLE owner of Audio.setAudioModeAsync
lib/handsfree-commands.ts    "skip" / "repeat" / "pause" vs a real answer
lib/handsfree-grading.ts     grades, or declines to when confidence is low
lib/handsfree-budget.ts      voice-minute arithmetic (see §5)
lib/tts-cache.ts             on-device audio cache
lib/handsfree-phrases.ts     fixed spoken lines — a COST control, not copy
hooks/useVoiceTurn.ts        one mic turn
hooks/useHandsFreeSession.ts the only impure part
app/(app)/practice/handsfree.tsx   the eyes-free screen
```

### Invariants that must not be broken

1. **An aborted listen never scores a card.** Road noise must not demote
   material the learner knows. Enforced structurally — only a graded answer
   reaches the outbox.
2. **Only the first attempt is scored.** A replay teaches; it does not re-grade.
   SM-2 asks whether recall was unaided, and that does not change on the retry.
3. **Paused time is excluded from the session clock**, and resume restarts the
   current item rather than dropping into mid-sentence.
4. **Nothing on the screen may be required to advance the session.** If it
   cannot run untouched, the feature has failed its own premise.
5. **`lib/audio-session.ts` is the only place that may call
   `setAudioModeAsync`.** Four calls remain in `components/chat/ChatInput.tsx`
   and `app/(app)/chat/index.tsx` — migrate them when that voice work settles.

---

## 5. Two numbers that are guesses

Both are commented as such in the source. Neither can be tuned without field
data from real journeys, which is what the unbuilt analytics ticket would supply.

- `HANDSFREE_MIN_CONFIDENCE = 0.55` (`lib/handsfree-grading.ts`) — below this,
  an answer is re-asked rather than graded.
- `speechMarginDb: 12` (`lib/vad.ts`) — dB above the measured noise floor that
  counts as speech.

Also note the confidence gate is **currently inert by design**:
`supabase/functions/transcribe/index.ts` requests Whisper's `verbose_json` and
then discards `no_speech_prob` and `avg_logprob`. Until those are surfaced,
confidence degrades to a neutral value above the threshold. Surfacing them turns
the gate on with no other change.

**Voice quota is a correctness constraint, not an optimisation.** `tts` charges
one voice-minute per *uncached* generation; caps are starter 5 / basic 10 /
premium 20 / vip 30. A 20-minute session needs more generations than any tier
allows. What makes it viable is that cache hits are free twice over — `tts`
returns cached clips *before* checking quota, and the device cache avoids the
request entirely. Do not add per-card feedback wording to
`lib/handsfree-phrases.ts`; every distinct string is a separate billed
generation.

---

## 6. Known, unfixed

- **Content bug:** the card `"Good evening" → "Buenas tardes"` is a
  mistranslation — that is "good afternoon". `"Good night" → "Buenas noches"` is
  correct, so the deck has no right answer for "Good evening". Content, not code.
- **Dead code:** `components/ui/StatsBar.tsx` and
  `components/stats-bar/StatsBar.tsx` are both unimported. Flagged, not deleted.
- **Dead code:** `scripts/content-pipeline/generators/generate-exercises.ts`
  writes columns that do not exist on `exercises` (`exercise_type`, `language`;
  the real column is `type`). It has never successfully written a row — do not
  copy its shape.
- **Lesson length:** adding the listening/speaking content took lessons from 8.9
  to 14.8 exercises on average, max 16. `.claude/rules/learning.md` says 10–15,
  so a few lessons sit one over.

---

## 7. Parked — do not build

`docs/specs/niche-tracks.md` carries a parked banner. Nothing was implemented,
so resuming costs nothing. Three decisions are open before it does:

1. Healthcare track pricing tier (`basic` $9.99 vs `premium` $19.99) — a one-row
   change now, painful after launch.
2. One active track per language, or several. "Unlimited tracks" is a natural
   premium differentiator that one-per-`basic` gives away.
3. The ~$4–5.5k subject-matter review budget, spent before any revenue.

One correction already folded into the spec: **the third launch track cannot be
Interview English.** English is not a selectable target language and no English
course exists, so that track has no host language. See §9.1 of the spec.

---

## 8. Strategy context, in one paragraph

Live voice chat is **table stakes** — Duolingo, Babbel, Busuu, Speak and Langua
all shipped it, so differentiating there is a race decided by ad budget.
Hands-free was the strong idea and was previously unbacked: the app declared
background audio but had no eyes-free session at all. Pimsleur owns audio-first
commuting but its content is scripted tape; nobody owns *adaptive tutor +
eyes-free*. The professional-feel angle is real positioning but was contradicted
by the app having rebuilt Duolingo's exact mechanics — adult mode resolves that,
and is now the first thing a new learner chooses. Two further differentiators
came out of the research and are only partly built: **proof of proficiency** (the
loudest complaint about Duolingo is 1,000-day streaks with no conversational
ability, and nobody sells evidence) and **career-specific verticals** (parked).

Full session report, including the bugs found and how everything was verified:
`docs/specs/handsfree-mode.md` for the feature, and the session artifact at
<https://claude.ai/code/artifact/27592075-3655-4510-8856-8f220d1d90de>.
