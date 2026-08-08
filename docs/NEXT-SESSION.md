# Next session — start here

Handoff covering three sessions: the differentiation programme
(2026-08-05 → 08-07), the positioning/UI-review session (2026-08-07), and the
palette session (2026-08-07).
Written to be read cold: you should not need the previous conversation.

**Current focus: App Store launch.** Anything that does not serve v1 shipping is
parked. Hands-free is the headline differentiator.

**Tree state at handoff: clean and fully pushed** (`53673a3` on `master`).
Baseline: typecheck clean, 0 lint errors, 422 tests across 23 suites.
`npm run check` is the gate — keep it green.

**Nothing in the UI has been verified on a device.** `npm run check` proves the
tree compiles and the logic tests pass; there are no visual or snapshot tests in
this project, so every contrast figure in `DESIGN.md` is computed arithmetic and
no screen has been looked at since the palette churn. See §1.4.

---

## 1. Do these first

### 1.1 Device-test hands-free before submitting — **highest priority**

`HANDSFREE_ENABLED = true` in `config/app.ts`. Switched on deliberately without a
hardware pass, so this is outstanding, not optional.

> **The entry point moved, and this matters for testing.** Until `76eb1ef`,
> hands-free was **unreachable in the shipping app**. `practice/index.tsx:145` is
> the only navigation into `/practice/handsfree`, and nothing reached
> `practice/index.tsx` itself — the Practice tab is `href: null` in
> `app/(app)/_layout.tsx` and `FloatingTabBar.tsx` lists only
> `index / learn / chat / profile`. It is now launched from a **Home quick
> action** gated on `HANDSFREE_ENABLED`.
>
> Consequence: the feature has had **zero** real-world exercise. Treat the whole
> list below as untested, not just the audio parts. Do not delete
> `practice/index.tsx` as dead code — it looks orphaned and is load-bearing.

Untested on a real device:

- **The new Home → hands-free route itself**
- Audio routing after a lesson speaking exercise → hands-free session
  (the earpiece bug an earlier session fixed; verify the fix actually holds)
- Background playback with the screen locked
- Incoming call → pause → resume at the start of the current item
- Navigation prompt ducks the session rather than being blocked by it
- The endpointer in real road noise (`lib/vad.ts` — the thresholds are guesses)
- Bluetooth car audio: prompt audible **and** the mic still captures
- Airplane mode mid-session → buffer carries → writes flush on reconnect
- VoiceOver on `app/(app)/practice/handsfree.tsx`
- One real commute, phone in pocket, never touched

**Escape hatch:** set `HANDSFREE_ENABLED = false`. That now removes the **Home
quick action** (not a Practice tab — there isn't one) and nothing else. The
audio-session refactor and review-queue fixes are not gated by it and stay live.

Audio bugs are the category App Review actually stumbles into. A session that
holds the microphone or plays out of the earpiece reads as a rejection, not a
bug report.

### 1.2 File the CarPlay entitlement

`com.apple.developer.carplay-audio`, from the Apple Developer account. Multi-week
lead time, granted case-by-case. Blocks nothing today; gates the whole
lock-screen/CarPlay phase later. The lead time is the entire cost of filing early.

### 1.3 Run ONE session in this tree

Two Claude sessions ran concurrently across both handoffs. Cost so far: one
overwritten set of uncommitted work, one broken build, and **the theme rewritten
three times underneath an in-flight session** (indigo → Studio Graphite →
monochrome → back to indigo, inside a day). Historical collision points:

```
lib/supabase-queries.ts     types/index.ts
lib/grading.ts              hooks/useReviewQueue.ts
config/theme.ts             DESIGN.md
```

If you must run two, split strictly by file and commit often. `config/theme.ts`
and `DESIGN.md` should belong to exactly one session at a time.

**Three specific ways this went wrong, so you can recognise them:**

1. **Selecting files to revert by "everything dirty minus my list".** Scoping a
   `git checkout --` that way silently includes the *other* session's
   uncommitted work. It only survived because the other session had committed
   minutes earlier. Enumerate the exact paths you intend to discard.
2. **Restoring a shared doc wholesale.** `git checkout <ref> -- DESIGN.md`
   reverted another session's unrelated corrections to it (typeface roles, the
   anonymous-first-lesson record, the dead-code list). If you restore a file
   that more than one workstream edits, diff the two versions first and
   re-apply what was not yours.
3. **A palette committed inside someone else's feature commit.** `76eb1ef`
   bundles the monochrome palette with hands-free reconnection and dead-code
   deletion, so `git revert` on it was not available — the palette had to be
   restored *forward*. Keep palette changes in their own commit.

### 1.4 Look at the app before touching the UI further

The palette was rewritten three times in one day and reverted to where it
started. What that churn did *not* include is anyone opening the app. Two things
carried over from the experiments and have never been seen against indigo:

- the **flat pill CTA** (the Duolingo slab is gone — `TactileButton` presses with
  a 0.96 scale instead of a collapsing bottom edge)
- the **mono stats row** on Home, which replaced the streak/XP/hearts chips

Both were designed against a warm-gold and then a silver palette. They may or may
not still read well under indigo. This is a five-minute look, not a project.

---

## 2. What is live

| Area | State |
|---|---|
| Hands-free commute mode (Phase A) | Live, **untested on device**, reachable from Home |
| Indigo palette (`#4F46E5` CTAs, `#818CF8` accents, 3 drifting glow blobs) | Live — canonical. See §2.1 |
| Onboarding mode choice (Adult vs Gamified) | Live |
| Adult mode | Live |
| CEFR proficiency report | Live, surfaced high on Profile |
| Listening & speaking exercises (9,504) | Live |
| Hearts | Live as **feedback only** — they no longer gate lessons (§4) |
| Niche tracks | **Parked — v2** |
| Hands-free lock screen / CarPlay (Phase B/C) | Not started |
| Spoken CEFR exam | Designed, not built |
| Hands-free analytics (W3 T13) | Not built — last ticket |
| Tier restructure (Free/Plus/Pro) | **Specced, not built** (§5) |

### Migrations applied to production

- **052** `adult_mode` on `user_profiles`
- **055** listening/speaking exercise generation (9,504 rows)
- **059** `handsfree_sessions` + `review_logs.client_log_id`
- **053** `ai_content_reports` — in-app flagging of offensive AI output (required
  by Google Play's generative-AI policy)
- **054** revoked anon/PUBLIC execute on 8 `SECURITY DEFINER` functions
- **056** `api_cache` was `FOR ALL TO public USING (true)` — any signed-in user
  could reset their own burst rate-limit counters. Plus 9 byte-identical
  duplicate policies dropped.
- **057** `subscriptions` had a `FOR ALL` policy with no `WITH CHECK`, so any
  user could `set tier='vip'` on their own row and self-grant unlimited paid AI
- **058** scoped all 57 remaining policies to `TO authenticated`

All verified against production. No new advisor warnings.

### 2.1 The palette is settled — do not re-propose one

Indigo is canonical (`3a4bbb6`). Two alternatives shipped and were reverted after
review on device, so neither should be re-derived from scratch:

| Palette | Why it went | Why it came back |
|---|---|---|
| Studio Graphite + Ink & Brass (`8f8c687`) | Indigo read as generic "AI startup" | Professional but not engaging; mapping the old violets to category hues also introduced mauve/rose that read as stray purple |
| Monochrome, charcoal + silver (`76eb1ef`) | Brass not engaging; stray purple | Reverted by preference |

What survived both attempts is **structural, not chromatic**, and is still live:
the flat pill CTA (the Duolingo slab stays retired), the mascot-placement rule
(moments only, never Home or chat chrome), and the mono stats row on Home. See
DESIGN.md §What We Retired.

The mascot itself is still placeholder star geometry; a **dragon** is the planned
replacement, and `components/mascot/Mascot.tsx` carries the contrast constraints
it has to satisfy.

### 2.2 If a palette ever does change again — method, and four traps

Recorded because two of these were learned the expensive way.

**Method.** Do not hand-map colours. Mapping old hex → new hex by eye is what put
stray mauve and rose into the brass palette: several distinct source colours
collapsed onto one replacement, and category hues got invented along the way.
The reliable technique, used for the revert in `3a4bbb6`:

> Strip every colour literal from both the old and the new version of a file. If
> what remains is byte-identical, that file changed by colour alone and can be
> restored verbatim from git. 72 of 91 files qualified. Files that fail the test
> get positional substitution if their colour *counts* match, and hand work
> otherwise. Then re-audit the whole tree for any value outside the palette.

**Trap 1 — fill polarity.** Indigo is a *dark* fill carrying a white label.
Brass and silver were both *light* fills carrying near-black labels. Swapping
between the two families inverts `text.onPrimary` and silently breaks every
hard-coded `'#fff'` sitting on a primary background. There were eight such sites.

**Trap 2 — the disabled CTA.** `indigo.200` (`#C7D2FE`) is the disabled fill and
is very light. A white label on it is **1.4:1**. `ComprehensionQuestions` and
`WritingExercise` now use a dark indigo label on the disabled state only; the
enabled state is untouched white-on-`indigo.600`. This is a deliberate departure
from the pre-brass baseline, not drift.

Same category: `TactileButton` `danger` uses `error.dark`, not `error.base`. The
label is 17px bold — under the 14pt "large text" threshold — so it needs the full
4.5:1, and `error.base` only reaches 3.8:1.

**Trap 3 — the mascot eats light accents.** Every time the brand accent has been
a light colour, `Mascot.tsx` has been painted in it, dropping the ivory eyes to
2–3:1 and blanking the face. The file documents this; the dragon has to satisfy
it too.

**Trap 4 — PowerShell will corrupt the tree on a bulk edit.** In PS 5.1
`Get-Content -Raw` and `Set-Content` default to the **system ANSI codepage**, not
UTF-8. A sweep written that way turned every em-dash in 77 files into `â€”` and
had to be fully reverted. Read and write explicitly:

```powershell
$t = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($path, $t, (New-Object System.Text.UTF8Encoding($false)))
```

Then confirm with a grep for `â€` before committing.

**Read `launch-readiness.html` at the repo root before doing any launch work.**
It is the living punch list: 2 blockers left (RevenueCat production keys are
still placeholders in `eas.json`; `fluenci.com` is not a registered domain — it
redirects to a for-sale page that the binary links to as its privacy policy).
`CLAUDE.md` §5 carries the mandatory RLS policy shape — read it before writing
any new policy.

---

## 3. Outstanding from the UI review — ranked

A full read-only audit of UI, copy, gamification, credibility signals and the
paywall was done on 2026-08-07. Items 1–4 shipped in `76eb1ef`. These did not:

### 3.1 Four `setAudioModeAsync` calls outside `lib/audio-session.ts`

`app/(app)/chat/index.tsx:327` and `components/chat/ChatInput.tsx:121,202,259`.
Violates invariant 5 in §6. **This is the outstanding item with real App Review
exposure** — see §1.1 on why audio bugs are the rejection category. Migrate them
to the `audio-session` modes.

### 3.2 Error copy — 18 generic alerts, 40 "Failed to…" strings

`Alert.alert('Error', 'Failed to load reading passages.')` gives a user nothing
actionable. **The pattern to copy already exists**: `lib/auth-errors.ts` maps
errors to what-happened → why → what-next, checks network first so an offline
failure is not misreported as bad credentials, and never echoes a raw message
(there is a test asserting a Postgres error string cannot reach a user). The auth
path is done; `learn/index.tsx`, `learn/reading/book/[bookId].tsx` and
`chat/index.tsx` are not.

Also two silent-swallow catches that contradict `CLAUDE.md` §6:
`app/(app)/index.tsx` (weekly stats) and `news/[date].tsx`. The third, in
`useNotifications.ts`, is genuinely fine and correctly commented.

### 3.3 Design-system drift — needs a scoping decision, not a blind refactor

`DESIGN.md` mandates typography primitives, `<TactileButton>` and `<Surface>`.
The tree runs ~899 raw `<Text>` against 69 primitives, 241 raw `<Pressable>`
against 6, and 55 `<GradientBackground>` against 1. This is now honestly
recorded in `DESIGN.md` rather than silently false.

**The part that matters for launch:** raw `<Text>` with inline sizes does not
scale with Dynamic Type, which `.claude/rules/mobile-ui.md` requires and App
Review checks. Two competitors took unprompted review damage for exactly this
("text remains very small", "vastly shrunk the font with no option to adjust").
Do not attempt 899 call sites before launch — pick the ~10 highest-traffic
screens.

---

## 4. Decisions made — do not re-derive these

### Hearts no longer gate lessons

`canPlay` was removed from `useHearts` outright rather than left as a
permanently-true flag, and all three gate sites went with it. Hearts still count
down and display as accuracy feedback; running out interrupts nothing.
`OutOfHeartsModal` was deleted.

Why: Duolingo ran this experiment at ~50M DAU and reversed it in Feb 2026, giving
up roughly **$50M in 2026 bookings** to cut free-tier friction, with von Ahn
attributing the growth miss to it on the earnings call. Lockout is also the
mechanic behind the most common complaint in this category's negative reviews.

### Anonymous first lesson: not built, not planned

`DESIGN.md` used to list "first lesson playable anonymously" as shipped. It never
was. **Decision (2026-08-07): every learner gets an account.**

The pre-auth placement test already delivers the reciprocity payoff — a real CEFR
result before any email is asked for. Anonymous play would cost per-user rate
limiting on AI endpoints, a permanent anon hole in an otherwise clean
`TO authenticated` RLS posture (content tables are `FOR SELECT TO authenticated`
per `004_security_and_scalability.sql:52-72`, so it would need a production RLS
change), broken install attribution, and a second code path through
`LessonRunner`.

**The friction actually worth removing** is the ~32 taps to the first teaching
moment. Three cheap fixes, none touching the account model:

1. Auto-advance the placement test on selection — it needs select *then* "Next"
   for each of 10 questions, 20 taps where 10 would do.
2. Route straight into the first lesson after signup instead of dropping the
   learner on Home to find something to do.
3. Make onboarding step 2 (motivation) skippable in one tap; step 3 already is.

---

## 5. Pricing — specced, products not created

`docs/strategy/pricing-spec.md` is the full spec. Summary:

**Shipped already** (client-side honesty, works against current products):
`starter` renamed to **Free at $0** — it is what every non-subscriber gets and
has no Stripe key, but carried a $3.79 price, so a free user saw only priced
cards. Plus an explicit Free card, a trial timeline reading real StoreKit
intro-price data (so it cannot misstate the charge), and feature lists rewritten
to capability. "Unlimited hearts" removed everywhere — after §4 it would sell a
benefit that does not exist.

**Not built:** the collapse from four quota-metered tiers to Free / Plus / Pro
defined by capability. Blocked on two things:

1. **You create the App Store Connect products first** — `fluenci_plus_annual`,
   `fluenci_plus_monthly`, `fluenci_pro_annual`, `fluenci_pro_monthly`, one
   subscription group, 14-day trial on the annuals only. They take review time
   and can exist unused.
2. **Check the voice-cost maths before committing to the pools.** Current VIP is
   30 min/day = **900 min/month** worst case, which almost certainly does not
   survive $29.99. Voice is the dominant marginal cost. The spec proposes monthly
   pools instead of daily caps; compute the true all-in per-minute rate first and
   lower the pools rather than raising the price if it is above ~$0.015.

`PlanId` is threaded through the DB `tier` column, three separate `PLAN_LIMITS`
mirrors across two edge functions, and RevenueCat entitlements. Existing
`basic`/`premium`/`vip` subscribers must keep resolving — never downgrade a live
subscriber's limits. Migration sequence is in §5 of the spec.

---

## 6. Hands-free: where the code lives

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
lib/handsfree-budget.ts      voice-minute arithmetic (see §7)
lib/tts-cache.ts             on-device audio cache
lib/handsfree-phrases.ts     fixed spoken lines — a COST control, not copy
hooks/useVoiceTurn.ts        one mic turn
hooks/useHandsFreeSession.ts the only impure part
app/(app)/practice/handsfree.tsx   the eyes-free screen
app/(app)/practice/index.tsx       the ONLY route into handsfree — do not delete
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
   `setAudioModeAsync`.** Four calls remain — see §3.1.

---

## 7. Two numbers that are guesses

Both are commented as such in the source. Neither can be tuned without field
data from real journeys, which is what the unbuilt analytics ticket would supply.

- `HANDSFREE_MIN_CONFIDENCE = 0.55` (`lib/handsfree-grading.ts`) — below this,
  an answer is re-asked rather than graded.
- `speechMarginDb: 12` (`lib/vad.ts`) — dB above the measured noise floor that
  counts as speech.

The confidence gate is **currently inert by design**:
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
generation. (This interacts with §5 — the pool sizes there assume this.)

---

## 8. Known, unfixed

- **Content bug:** the card `"Good evening" → "Buenas tardes"` is a
  mistranslation — that is "good afternoon". `"Good night" → "Buenas noches"` is
  correct, so the deck has no right answer for "Good evening". It is **data, not
  code** — not in migrations or scripts, so it needs a DB edit.
- **Dead code:** `scripts/content-pipeline/generators/generate-exercises.ts`
  writes columns that do not exist on `exercises` (`exercise_type`, `language`;
  the real column is `type`). It has never successfully written a row — do not
  copy its shape.
- **Lesson length:** adding the listening/speaking content took lessons from 8.9
  to 14.8 exercises on average, max 16. `.claude/rules/learning.md` says 10–15,
  so a few lessons sit one over.
- **`useAppStore.motivation`** is written during onboarding and now has **no
  reader** — its only consumer was Home's `HeroHook`, deleted as dead code.
  Commented at both sites, left in place because motivation-aware copy is a live
  idea. Drop it from the store if that does not land.
- **`hooks/useHandsFreeSession.ts`** was importing a non-existent `./useVoiceTurn`
  and failing typecheck for several hours on 2026-08-07. It is clean now, but the
  fix came from a parallel session — worth a read.

### Dead code deleted in `76eb1ef` (do not go looking for these)

`app/(app)/review/` (whole subtree — unreachable, duplicated the live
`learn/review.tsx`), all of `components/stats-bar/`, `components/ui/StatsBar.tsx`,
`AnimatedGalaxy`, `ShinyText`, `StreakFireAnimation`, `HeroHook`,
`OutOfHeartsModal`. Each verified by real import statements first. Two ungated
infinite animations went with `stats-bar/`.

---

## 9. Parked — do not build

`docs/specs/niche-tracks.md` carries a parked banner. Nothing was implemented,
so resuming costs nothing. Three decisions are open before it does:

1. Healthcare track pricing tier — note this now depends on §5, since the tier
   names are changing.
2. One active track per language, or several. "Unlimited tracks" is a natural
   premium differentiator that one-per-tier gives away.
3. The ~$4–5.5k subject-matter review budget, spent before any revenue.

One correction already folded into the spec: **the third launch track cannot be
Interview English.** English is not a selectable target language and no English
course exists, so that track has no host language. See §9.1 of the spec.

---

## 10. Positioning — research done, marketing not written

`docs/strategy/positioning-2026.md` is the full report (competitive landscape,
retention evidence, professional-tone design research, and a code audit).
Headlines:

- **Do not lead with "AI-powered."** It is commoditised — every competitor ships
  AI conversation. A 767-user study found the label produced no trust or
  willingness-to-pay gain and sometimes *lowered* expectations; three independent
  2026 surveys show AI attribution reducing purchase intent. Lead with the
  outcome; AI is the mechanism.
- **Two defensible positions**, both validated against primary review text:
  (1) *"the tutor stays at your level and never teaches you something wrong"* —
  which is what the CEFR level-checker in `_shared/validated-generate.ts` already
  does, and is demonstrable in a screenshot; (2) *"honest pricing, no weekly
  plans, cancel in two taps"* — billing is ~50% of critical reviews across all
  nine competitors sampled.
- **Discarded after testing:** "our AI goes deeper" (overstated ~2.5×; the
  complaint appears mainly in competitor-owned blogs, not users' words) and
  "cross-session error memory" (**zero** of 85 sampled reviews asked for it).
- **Adult mode is the professional positioning**, already built, and was buried
  on step 8 of 9 in onboarding.

**Evidence caveat — read before building marketing on this.** Reddit was
inaccessible at the domain level through every route tried, and Trustpilot and
Google Play review text were unfetchable. All primary review data is **iOS-only**,
N=34 critical reviews ordered by Apple's "Most Helpful" — directions are solid,
percentages are not. Android billing complaints are probably *larger* than
measured (31% involuntary billing-failure churn vs 14% on iOS). An hour of manual
r/languagelearning reading would firm this up considerably.

The report also lists five widely-circulated stats that are **unsourced and must
not be cited** — including "streaks lifted retention 12%→55%" and "serif fonts
increase trust 40%".

---

## 11. Strategy context, in one paragraph

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

On channel: consumer subscriptions beat the B2B path to $10K MRR by a wide
margin. The 180 pre-provisioned `@bryant.edu` accounts are a **seeded roster, not
a landed pilot** — zero have ever signed in, and at 100% activation they are
~12% of the target. Run Bryant for the case study, route first contact through an
instructor rather than cold-emailing 180 students who never consented, and expire
the dormant credentials (they are a FERPA-review liability sitting in
`auth.users`). Full reasoning in `positioning-2026.md` §1.7.

Full feature report: `docs/specs/handsfree-mode.md`.
