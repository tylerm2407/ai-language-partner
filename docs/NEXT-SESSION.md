# Next session — start here

Handoff covering six sessions: the differentiation programme
(2026-08-05 → 08-07), the positioning/UI-review session (2026-08-07), the
palette session (2026-08-07), the app-code session that closed out §3 and §4
(2026-08-08), the content audit (2026-08-08 → 08-09, §12), and the
store/monitoring session that created the IAP products (2026-08-08 → 08-11, §5).
Written to be read cold: you should not need the previous conversation.

**Current focus: App Store launch.** Anything that does not serve v1 shipping is
parked. Hands-free is the headline differentiator.

**Blocked on Apple as of 2026-08-11:** the Paid Apps Agreement is *Pending User
Info → processing*, quoted at up to 24h. Until it reads **Active**, StoreKit
returns zero products, so the paywall shows "we couldn't load plans right now"
no matter how correct everything downstream is. Nothing to fix in code — see §5
before debugging any paywall symptom.

**Tree state at handoff: clean and pushed.**
Baseline: typecheck clean, 0 lint errors (14 warnings, all pre-existing),
446 tests across 25 suites. `npm run check` is the gate — keep it green.

**Nothing in the UI has been verified on a device.** `npm run check` proves the
tree compiles and the logic tests pass; there are no visual or snapshot tests in
this project, so every contrast figure in `DESIGN.md` is computed arithmetic and
no screen has been looked at since the palette churn. This got *more* true on
2026-08-08: ten screens had layout changes and the post-signup route changed.
See §1.4 and §1.5. It got more true again on 2026-08-11: `app/(app)/plans.tsx`
is a brand-new screen that has never rendered on a device, and it cannot until
the agreement in the callout above clears.

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

**2026-08-08 is the one time this worked.** Two sessions ran with an explicit
split — one owned `supabase/`, `scripts/` and all SQL, the other owned app code
— and neither touched the other's files or lost work. What made the difference
was that the split was stated up front and *named the files*, not the topics,
and that each side committed per task rather than at the end. `git add <dir>`
rather than `git add -A` is the other half of it: the app session staged its own
paths every time and never picked up the migrations sitting dirty beside them.

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

Since 2026-08-08 there is a second list, and it is longer. Ten screens had
container fixes for Dynamic Type (§3.3) and the post-signup route now lands in a
lesson (§4). None of it has been seen. The highest-value single pass is
**Settings → Accessibility → Display & Text Size → Larger Text at maximum**,
then walk onboarding → first lesson → Home → Learn → paywall.

### 1.5 There is no way to test a screen in this repo

`npm test` is jest with `jest-expo`, and every one of the 24 suites is a pure
logic test. There is **no `@testing-library/react-native`**, no
`react-test-renderer` usage, no snapshot tests. Nothing renders a component.

This is not a gap to fill casually — it is a dependency and a CI-time decision —
but you have to know it before you plan work, because it changes what "done"
can mean:

- Anything that lives only in a component is unverifiable. On 2026-08-08 the
  audio-mode fix (§3.1) was given a pure seam — `playbackModeFor` /
  `recordingModeFor` in `lib/audio-session.ts` — purely so the choice a screen
  makes could be asserted at all. That is the pattern to copy: push the decision
  into a module, leave the I/O in the component.
- Where even that is not possible, prefer a **structural** test. `lib/audio-session.test.ts`
  ends with a grep gate that reads `app/ components/ hooks/ lib/` off disk and
  fails if anything but that module names `setAudioModeAsync`. It cost eight
  lines and it enforces an invariant that four separate sessions had drifted
  past.
- The placement-test auto-advance and the new inline error states therefore
  have **no** test coverage. That was deliberate, not an oversight.

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
| Dynamic Type caps on the four type primitives | Live (§3.3) |
| `lib/error-copy.ts` + inline errors on 3 screens | Live (§3.2) |
| Placement test auto-advances; signup lands in a lesson | Live, **unseen on device** (§4) |
| Onboarding 'motivation' step | **Deleted** 2026-08-08 (§4) |
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
paywall was done on 2026-08-07. Items 1–4 shipped in `76eb1ef`. §3.1 and §3.2
shipped on 2026-08-08 (`286bc24`, `638b1db`, `d797878`, `98d82f0`). What is
left is design work, not mechanical work — see §3.5.

### 3.1 ~~Four `setAudioModeAsync` calls~~ — done, and now gated

All four migrated to named modes. `lib/audio-session.test.ts` carries a grep
gate that reads the tree off disk and fails if anything but that module names
`setAudioModeAsync`, so this cannot drift back silently. Three error/teardown
paths that were leaving the session in a recording mode were fixed at the same
time, including one that held the mic after leaving chat.

**Do not "simplify" `playbackModeFor` / `recordingModeFor` back into inline
ternaries at the call sites.** They exist because nothing in this repo can
render a component (§1.5); they are the only reason the choice is testable.

### 3.2 Error copy — pattern built, three screens converted, the rest are not

`lib/error-copy.ts` is the data-loading sibling of `lib/auth-errors.ts`: same
three rules (network classified first, raw message never echoed, every branch
says what to do next), plus it reads `PostgrestError` objects, which are not
`Error` instances — the auth-errors shape would have classified every Supabase
query failure as unknown. `lib/error-copy.test.ts` mirrors the auth tests
including the assertion that a Postgres string cannot reach a user.

Converted: `learn/index.tsx` (4 sites → inline errors with retry),
`learn/reading/book/[bookId].tsx` (3), `chat/index.tsx` (1). Both silent-swallow
catches are gone: Home's weekly stats and `news/[date].tsx` now state the
failure instead of rendering a plausible empty state. `useNotifications.ts` is
still correct and still untouched.

**Still to do:** roughly 18 further `Alert.alert('Error', …)` sites across the
teacher screens, `profile/`, `practice/` and the writing flow. The module and
the `InlineError` component in `learn/index.tsx` are the templates.

One thing that pass found, worth knowing: `book/[bookId].tsx` was rendering
`err.message` straight into the UI. Assume there are others — grep for
`setError(.*message` before trusting an error screen.

### 3.3 Dynamic Type — the old text here was **wrong**, read this before acting

The previous handoff said raw `<Text>` with inline sizes "does not scale with
Dynamic Type". **That is false, and it nearly bought a 899-call-site refactor.**
React Native's `allowFontScaling` defaults to true and nothing in this tree
overrides it — verified, zero occurrences of `allowFontScaling` or
`maxFontSizeMultiplier` anywhere before 2026-08-08. `hooks/useDisplayScale.ts`
had it right in its own doc comment the whole time.

The real defect is the opposite one: text scales and its **container does not**,
so at the accessibility sizes (up to 310%) rows clip, collide and truncate. That
is what App Review's Larger Text pass actually catches.

What shipped:

- `maxFontSizeMultiplier` on the four primitives in `components/ui/Text.tsx` —
  Heading 1.4, Body 1.6, Caption 1.6, Hero 1.3, each overridable by a caller.
  Body and Caption previously had no cap at all. Reasoning is in that file.
- Container fixes on ten screens: rows that wrap instead of overflowing,
  `height` → `minHeight` on the learn CEFR pill and its count badge, `flex-1`
  on the paywall feature labels, one `numberOfLines` dropped, chat header
  buttons `h-9` → `min-h-9`.
- `auth.tsx` and `learn/review.tsx` were `justify-center` with no `ScrollView` —
  taller than a small phone at large sizes with nowhere to overflow. Both now
  scroll; identical at normal sizes.

Nothing to fix on `profile/index.tsx`, `learn/[lessonId].tsx` or
`practice/handsfree.tsx` — the last was already `minHeight` throughout.

### 3.4 Design-system drift — still a scoping decision

`DESIGN.md` mandates typography primitives, `<TactileButton>` and `<Surface>`.
The tree runs ~899 raw `<Text>` against 69 primitives, 241 raw `<Pressable>`
against 6, and 55 `<GradientBackground>` against 1. This is honestly recorded in
`DESIGN.md` rather than silently false.

With §3.3 understood, this is now a *consistency* problem rather than an
accessibility one, which drops its launch priority considerably. The one real
accessibility cost left is that a raw `<Text>` carries no `maxFontSizeMultiplier`,
so it scales to 310% unbounded — which matters in fixed-size containers and
nowhere else.

### 3.5 Five layout calls that need a designer, not a refactor

Found during the §3.3 pass and deliberately not "fixed", because each is a
visual decision and the palette/layout is settled (§2.1):

1. **Chat header row** — chevron, title, timer chip, Live Voice button and mic
   toggle in one row. Over-subscribed at large type; the title just truncates
   harder. Wrapping or restacking it is a design change.
2. **`practice/handsfree.tsx` status text** — hero-size raw `<Text>` inside a
   `flex: 1` box, so it is uncapped and will clip at the largest sizes. Strings
   are short ("Listening…") so the risk is low, but capping it trades away
   glanceability on the one screen built for glancing.
3. **`learn/review.tsx` rating buttons** — four columns, two-line labels.
   "Struggled" at 1.6× in a quarter-width column wraps to three lines. It
   scrolls rather than clipping now, but 2×2 would read far better.
4. **`useDisplayScale` stacks on top of Dynamic Type** for Heading and Hero, so
   maximum effective heading growth is 1.1 × 1.4 ≈ 1.54, not 1.4. Decide whether
   the cap should absorb the device scale.
5. **Profile identity name** keeps `numberOfLines={1}`. Truncating a name is
   conventional, but at 1.4× it truncates early. Left as-is on purpose.

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

**The friction actually worth removing** was the ~32 taps to the first teaching
moment. All three fixes shipped 2026-08-08 (`02fca0b`), none touching the
account model:

1. **Placement test auto-advances** 250ms after a selection — the first nine
   questions cost one tap instead of two. The last question keeps its explicit
   "See my level" button, because auto-advancing into the result screen moves
   the learner without a tap at the exact moment of the payoff. **Under
   `useMotion().shouldReduce` the manual "Next" stays** rather than using a
   zero-delay jump: an unrequested screen change is what that setting asks us
   not to do, and a 0ms advance would also hide the correct/incorrect reveal
   the learner just earned. Skip is unchanged.
2. **Signup lands in the first lesson**, not on Home. Home is pushed underneath
   it so `LessonRunner`'s `router.back()` exit still has somewhere to go — a
   bare `replace` into the lesson would have trapped the learner there. An
   unresolvable curriculum falls back to Home. `resolveFirstLessonId` composes
   `fetchCourses` → `fetchUnits` → `fetchLessons` rather than adding a query:
   a single-query version needs a three-level sort across embedded PostgREST
   resources, which cannot be verified without the DB and can silently return
   the wrong lesson.
3. **The 'motivation' step was deleted, not made skippable.** See below.

### The onboarding 'motivation' step is gone — do not reinstate it blind

Verified by grep before acting: nothing reads `useAppStore.motivation`, and
nothing reads `profile.motivationReason` either. The step wrote to a store slot
*and* a DB column that have no consumers anywhere in the app. Making it
skippable would have saved one tap; deleting it removed a whole step.

Preserved deliberately, so reinstating is a UI change and never a migration:
`user_profiles.motivation_reason`, the `MotivationReason` type, and the
`upsertProfile` mapping all still exist. Removed: the step, the store slot, and
the field on the `PendingOnboarding` draft.

**The draft schema version was deliberately NOT bumped.** `isValidPending`
checks only `version` and `startedAt` and ignores unknown keys, so drafts
written by shipped builds still load with the now-removed `motivation` key
present. Bumping would have discarded every in-flight draft inside the 7-day
TTL — including learners one tap from signing up. There is a test locking this.

**The open question this leaves you:** `motivation_reason` is now never written,
so the "why are you here" signal is gone and cannot be backfilled. If you want
it, the cheap version is one optional question *after* signup, off the critical
path — not a step back in the funnel.

---

## 5. Pricing — products now created and live (2026-08-11)

### 5.0 What exists in App Store Connect and RevenueCat

Created via the App Store Connect and RevenueCat v2 APIs, not the dashboards.
All six are **READY_TO_SUBMIT**, priced in **175 territories**, each with a
**7-day free trial**. Group `22298451` ("Fluenci"), app `6761507250`.

| Product ID | Price | Group level |
|---|---|---|
| `fluenci_vip_yearly` | $299.99 | 1 |
| `fluenci_vip_monthly` | $29.99 | 1 |
| `fluenci_premium_yearly` | $199.99 | 2 |
| `fluenci_premium_monthly` | $19.99 | 2 |
| `fluenci_basic_yearly` | $99.99 | 3 |
| `fluenci_basic_monthly` | $9.99 | 3 |

Annuals are 10x monthly — two months free, 17% off, which is what the paywall's
SAVE badge computes from live store prices.

RevenueCat project `proje68552f1`, App Store app `appb3cdaeee84`
(bundle `com.fluenci.app`, ASC API key + subscription key configured). Offering
`default` is Current with six packages; entitlements `basic`/`premium`/`vip`
each carry their two products.

**These match today's four-tier model, NOT the Free/Plus/Pro collapse specced
below.** Store product IDs are immutable — the collapse would need six new
products, not renames. Decide the model before creating anything else.

### 5.1 Two obligations that are easy to forget

1. **The App Store review screenshot on all six products is a placeholder** — a
   1242x2208 letterboxed shot of the Home screen, uploaded only to move the
   products out of `MISSING_METADATA`. A reviewer seeing Home where the purchase
   UI should be is a rejection. Replace with a real paywall screenshot before
   submitting.
2. **The Stripe secret key needs rotating.** A setup script matched
   `STRIPE_SECRET_KEY` on its `sk_` prefix and sent it to RevenueCat's API as a
   bearer token. Rejected with 401, nothing created, but it reached a third
   party's request logs. Roll it in Stripe, then update `.env` *and* the Supabase
   function secret of the same name.

### 5.2 Three API traps, all of which cost a cycle here

- **Availability before prices.** A subscription rejects prices and offers with
  "an error occurred while processing the pricing information" until
  `subscriptionAvailabilities` exists. The message names pricing and is wrong.
- **Price every available territory.** 175 territories with one USA price leaves
  the product `MISSING_METADATA` with nothing indicating which field is missing.
  Use `/v1/subscriptionPricePoints/{id}/equalizations` to map the base point
  across the other 174, then POST a `subscriptionPrices` each.
- **IAP review screenshots take a narrower dimension list than App Store
  screenshots.** 1024x1024 and a native 1170x2532 iPhone shot were both rejected
  `IMAGE_INCORRECT_DIMENSIONS`. 1242x2208 is accepted.

### 5.3 The repricing spec

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

1. **New App Store Connect products are still needed** — `fluenci_plus_annual`,
   `fluenci_plus_monthly`, `fluenci_pro_annual`, `fluenci_pro_monthly`, 14-day
   trial on the annuals only. The six four-tier products in §5.0 already exist
   and cannot be renamed into these; product IDs are immutable. They can live
   alongside in the same group and exist unused, so this is additive — but it
   doubles the catalogue, so settle the model before creating them. The scripts
   that created the current six are reusable; §5.2 lists the traps.
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
   `setAudioModeAsync`.** As of 2026-08-08 this holds — zero calls elsewhere —
   and it is enforced by a grep gate in `lib/audio-session.test.ts` rather than
   by review. If that test fails, do not add your file to its allow-list; add a
   mode to `audio-session.ts` instead. See §3.1.

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

- ~~**Content bug:** the card `"Good evening" → "Buenas tardes"`~~ — **fixed
  2026-08-08**, along with a great deal more that a full audit turned up.
  Migrations 060–066 (see §12). The one-card framing was wrong: it was 9 wrong
  meanings across 6 languages, 5 corrupted strings, 13 unanswerable
  multiple-choice questions and 549 malformed fill-blanks.
- ~~`supabase/seed.sql` is stale~~ — **fixed 2026-08-08 at the source.** It had
  been reproducing defects that migration 049 fixed in production on 2026-07-20,
  and predated the generator by four columns. Both `supabase/generate_seed.py`
  and the regenerated `seed.sql` are now correct. See §12.
  - Still true, and deliberate: seed.sql does **not** contain migration 055's
    9,504 listening/speaking rows, because those were inserted by a migration,
    not authored in the generator. `db reset` runs migrations before seed, so
    they arrive via 055. Do not add them to the generator.
- **Dead code:** `scripts/content-pipeline/generators/generate-exercises.ts`
  writes columns that do not exist on `exercises` (`exercise_type`, `language`;
  the real column is `type`). It has never successfully written a row — do not
  copy its shape.
- **Lesson length:** adding the listening/speaking content took lessons from 8.9
  to 14.8 exercises on average, max 16. `.claude/rules/learning.md` says 10–15,
  so a few lessons sit one over.
- ~~**`useAppStore.motivation`** has no reader~~ — **removed 2026-08-08**, along
  with the onboarding step that wrote it. See §4.
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

---

## 12. Content audit — 2026-08-08 (migrations 060–066, applied to production)

The deck is a 352-concept × 9-language matrix (3,168 cards, 23,976 exercises),
which makes it fully auditable by cross-checking rather than sampling. What the
sweep found, and what each migration fixed:

| # | Class | Fixed |
|---|---|---|
| 060 | Wrong meaning + corrupted characters | es/pt "Good evening" cluster; 5 corrupted strings (ko 식은 죄 먹기 → 죽, ko 정곱 → 정곡, ja 訤弁 → 詭弁, plus stale ko/zh cards) |
| 061 | Idioms and false friends | 8 wrong meanings (incl. fr "Excité", fr "Bon matin", es/pt "on cloud nine" → *distracted*), 5 literal calques |
| 062 | Polysemy | 13 unanswerable multiple-choice rows; free-text now accepts every meaning the deck teaches |
| 063 | Register and consistency | Korean adjective forms unified; 형/언니 → 형제/자매; ru Gerund; pt Bedroom/Room; "someones" typo |
| 064 | Structure | 549 fill-blanks whose blank was the entire answer |
| 065 | Follow-up | fr Hello → *Salut*, so Bonjour stops meaning two things at once |
| 066 | Register + regression | ko 당신 → 네; rebuilt `metadata.tiles` / `error_sentence` that 060–063 left stale (§12.2) |

**The root cause of most of it: migration 049 declared "Scope: exercises table
only".** It fixed defects in `exercises` and left the matching `cards` rows
carrying the old text, so the deck taught one thing on the card and graded
another in the exercise. Every card/exercise contradiction in this audit traced
back to that. **A content fix must update both tables.**

049 also got Spanish backwards: it treated "Buenas tardes" as correct for "Good
evening" and *deleted* "Buenas noches" from `accepted_answers`. Learners typing
the correct Spanish were marked wrong from 2026-07-20 until 060 reverted it.

**Two judgement calls that a native speaker should still confirm** — both are
safer than what they replaced, neither introduces a new meaning error:
the ja/ko idiom replacements in 061 Group B, and the Korean register
normalisation in 063 §1.

A review sheet covering all nine open items — every affected row with its old
and new form, the reasoning, and a place to record a verdict — is published at
**https://claude.ai/code/artifact/012acbe3-a78f-4ac9-9f5d-361ab6f7ba5d**
(private; share it from the page's share menu). It needs about 15 minutes of a
Korean speaker's time, less for the single ja and pt items. The open question
for Korean adjectives is one line: should the card for "Cheap" show 싸다 or 싼?
Whichever way it goes, it is a one-line change in `generate_seed.py` plus one
migration — the deck is already internally consistent, which was the expensive
part.

### 12.1 The generator was the real source — fix it there, not in seed.sql

`supabase/seed.sql` is auto-generated by **`supabase/generate_seed.py`**, which
holds the vocabulary as `("English","Target")` tuples. Patching the generated
file would be silently undone by the next regeneration, so the corrections went
into the generator and `seed.sql` was rebuilt from it.

The generator had **four structural bugs**, each of which had been producing
defects that were then hand-patched downstream:

1. **`multiple_choice` used target-language distractors.** The question is
   "what does X mean in English?", but options were built from `p[1]` while
   `correct_answer` was English — so the correct answer was not among its own
   options. Migration 049 hand-fixed 79 such rows; the generator kept emitting
   them.
2. **`fill_blank` assumed Latin script.** `if len(tgt) > 3` meant every 2–3
   character CJK word fell through to a prompt of `_____ (Gloss)` — the blank
   was the whole answer. 549 rows, 500 of them ja/ko/zh.
3. **`fill_blank` left a leading space in the answer.** Splitting "Buenas
   tardes" at the midpoint gave the answer `" tardes"`, so a learner had to type
   a leading space to be graded correct.
4. **`error_correction` sometimes introduced no error.** It substituted a fixed
   `x` at index 2, which is a no-op when the word already has an `x` there —
   "Puxar a perna de alguém" shipped as its own unaltered answer.

Regenerating produces a large diff because the committed `seed.sql` also
predated four columns the generator now emits (`skill_type`, `subskill`,
`response_mode`, `source_type`). All four exist in the production schema; the
file was simply never rebuilt after they were added.

**seed.sql is not row-for-row identical to production, and does not need to be.**
It never was. It is a dev fixture whose job is to produce *correct* content.

**Before committing a regenerated seed.sql**, run the checker:

```bash
python supabase/generate_seed.py
python supabase/verify_seed.py      # exits non-zero on any failure
```

`supabase/verify_seed.py` runs the same checks that were used against
production: no retired content, no mojibake (the PS 5.1 trap in §2.2), no
fill-blank without a stem, no multiple-choice missing its own answer, no
duplicate options, no whitespace-padded answers. Each check has been confirmed
to actually fire by injecting the corresponding fault into a copy of the file —
if you add a check, do the same, or you have added a line that can only pass.

### 12.2 A content fix is not finished when the text columns are right

Migrations 060–063 updated `prompt` and `correct_answer` and stopped there. Two
exercise types keep a **second copy of the answer inside `metadata`**, and those
copies were left holding the old text:

| Type | Field | What broke |
|---|---|---|
| `sentence_construction` | `metadata.tiles` | The draggable word tiles still spelled the previous phrase, so 11 exercises could not be solved at all — the tiles and the expected answer disagreed. |
| `error_correction` | `metadata.error_sentence` | The deliberately-corrupted sentence still referenced the old wording. |

066 repaired both. The tile repair is written as a **general** statement rather
than 11 hand-written updates, so re-running it catches anything a future content
edit leaves behind:

```sql
UPDATE exercises
SET metadata = jsonb_set(metadata, '{tiles}', to_jsonb(string_to_array(correct_answer, ' ')))
WHERE type = 'sentence_construction' AND metadata ? 'tiles'
  AND replace(array_to_string(ARRAY(SELECT jsonb_array_elements_text(metadata->'tiles')), ''), ' ', '')
      <> replace(correct_answer, ' ', '');
```

The lesson generalises: **a string replacement across text columns is not
sufficient on `exercises`.** Anything touching content must also consider
`metadata`, `options`, and `accepted_answers`. There is a separate grammar
exercise set (uuid ids, not `aabbccdd%`) that uses a different prompt format —
scope metadata repairs by id so it is not caught up in them.

**Verification queries are inlined at the bottom of each migration file.** All
return zero against production as of 2026-08-08. Useful ones to re-run after any
future content change:

```sql
-- an option set containing two correct answers
-- a fill_blank whose blank is the whole answer
-- a multiple_choice whose correct answer is not among its options
```
