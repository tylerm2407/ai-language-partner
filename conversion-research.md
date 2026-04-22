# Conversion Research — The Small Details That Move Free → Paid

**Companion reference doc** to `design-research.md`. Focused specifically on the tiny, often-invisible details that growth teams A/B-test obsessively: paywall choreography, price anchoring, activation-to-paywall timing, and the micro-interactions that compound into conversion lift.

Every claim is tagged by evidence strength so future-you can weight them correctly:

- **[R]** = **research-backed** (peer-reviewed or formally published study)
- **[I]** = **industry-observed** (vendor A/B data — RevenueCat, Superwall, Adapty, first-party growth blogs)
- **[F]** = **folklore** (widely repeated in PM/growth circles but weak primary source — treat as A/B hypothesis, not fact)

---

## Table of Contents

1. [Executive summary — the 10 highest-ROI moves](#executive-summary)
2. [Where money actually leaks in the funnel](#the-funnel)
3. [Paywall architecture & timing](#paywall-architecture)
4. [Price & plan psychology](#price-psychology)
5. [The small micro-interactions that compound](#micro-interactions)
6. [Copy that converts (with real numbers)](#copy-that-converts)
7. [Contextual triggers — "just-in-time" upgrades](#contextual-triggers)
8. [Invisible growth details people forget](#invisible-details)
9. [Regulatory / ethical boundaries you must not cross](#regulatory-boundaries)
10. [Language-learning-specific findings](#language-learning-specific)
11. [Prioritized intervention shortlist for Fluenci](#prioritized-shortlist)
12. [Sources](#sources)

---

## Executive Summary

Ranked by expected ROI for this app, cheapest-biggest-win first. Every item below has a research or industry citation in the body of this doc.

| # | Move | Expected lift | Evidence |
|---|---|---|---|
| 1 | **Delayed paywall** (post first-lesson-complete, Duolingo pattern) vs install-time hard paywall | 5–15pp in install-to-paid for skill-learning apps | [I] RevenueCat, Adapty benchmarks |
| 2 | **1-tap Apple Pay / StoreKit 2** IAP vs web checkout | +42% initial conversion, +43% trial starts | [I] RevenueCat |
| 3 | **Permission pre-prompt** for push — sell the benefit before iOS system modal fires | +180% opt-in in best-case | [I] Leanplum, CleverTap |
| 4 | **Pre-select annual** in plan picker + triple-frame the savings ("Save 43%" + "2 months free" + "$6.99/mo billed annually") | +70% annual revenue vs monthly-default | [I] Superwall |
| 5 | **Kill confirm-password**; magic links + Apple/Google autofill | +56% signup completion | [I] UX Movement |
| 6 | **PPP-localized pricing** in BR / IN / MX / ID / PH + translated paywall in L1 | Spotify India +92.6% over 4y at PPP price; Flo Health "hundreds of percent" YoY in Brazil | [I] RevenueCat |
| 7 | **Contextual paywalls** at point of need (AI-message cap, hearts out, streak about to break) | 2–4× over generic settings-page paywalls | [I] Superwall |
| 8 | **Microcopy on dismiss button** — "Maybe later" not "Cancel"; on submit — "Continue" not "Subscribe" | 10–45% documented range on single-word swaps | [I] $300M Button, Obama campaign |
| 9 | **Celebration animation + haptic + sound on lesson complete** — the retention → conversion flywheel | D1 retention lift ~15–20% in gamified apps; cascades to D30 paid | [I] StriveCloud, Duolingo teardowns |
| 10 | **Personalized paywall headline** echoing user's onboarding goal ("Reach conversational Spanish in 3 weeks based on your 15-min/day goal") | 10–30% lift range per Superwall tests | [I] Superwall, Babbel/Busuu in-product |

Ten more tier-below but worth doing: blinking streak fire near deadline, Blinkist-style "we'll remind you 2 days before billing" trial-timeline paywall (+23%), badges on tab icons (Zeigarnik effect, +88% open rate in best case), skeleton loaders > spinners, 3–5 course recommendations (not 30), time-of-day greeting ("Hi Tyler, ready for 5 minutes of Spanish?"), trial length = 7 days with day-5 push reminder, "Cancel anytime" beneath the CTA (+46% trial starts in one dataset), and App-Store-screenshot ↔ first-run match.

---

## The Funnel — Where Money Actually Leaks

Install-to-paid for subscription apps globally sits at **~1.7–2.5%** median (RevenueCat 2025 State of Subscription Apps) [I]. The five biggest funnel stages and typical drop-off rates:

| Stage | Typical drop-off | Primary levers |
|---|---|---|
| App Store impression → install | ~60–85% | Screenshots, ratings, app name, first-impression story |
| Install → first-session activation | ~40–70% | Onboarding length, permission prompts, default gate |
| Activation → paywall impression | ~20–40% | When you surface the prompt matters massively |
| Paywall view → CTA tap | **~75–90%** ← biggest leak | Price framing, plan layout, default selection, badges, trust copy |
| CTA tap → purchase confirm | ~30–50% | 1-tap checkout, localized price, payment method, error recovery |
| Purchase → D30 retention | highly variable | Onboarding → product usage, not covered here |

**The CTA-tap stage is where the paywall redesign dollars earn their highest return.** Adapty / RevenueCat both publish this breakdown — the button copy, plan card layout, and default pre-selection dominate conversion math.

---

## Paywall Architecture & Timing

### Timing: delayed vs hard

- **Duolingo pattern [I]:** first paywall after first-lesson-complete (~90 sec, 3 words). Grew MAU→paid from **3% → 8.8% (2020 → 2025)**.
- **Noom / Calm / Headspace pattern [I]:** install-time hard paywall (credit card up front, reverse trial). Works when the "aha" is conceptual (peace, weight loss) rather than skill-based.
- **Rule:** skill-learning apps (language, music, code) should **delay** the paywall to post-aha; wellness/outcome apps often succeed with hard paywalls because the motivation is already internal.

### Onboarding paywall choreography (progressive disclosure)

Best-in-class mobile paywalls layer 2–4 screens instead of one dense page. Superwall's 2025 benchmark data shows multi-page paywalls outperform single-page in most verticals [I]. The Blinkist / Duolingo / Masterclass template:

1. **Screen 1: Value promise + social proof** (outcome headline, user count, star rating)
2. **Screen 2: Trial timeline** (calendar: today = free, day 5 = reminder, day 7 = charge)
3. **Screen 3: Plan picker + CTA** (plans with pre-selected annual, single CTA, "Cancel anytime" beneath)

Blinkist reported **+23% trial conversions, +4% trial retention, –55% complaints, and +1,200% push-reminder opt-in (6% → 74%)** after adopting this transparent-timeline choreography [I].

### Contextual paywalls — 2–4× generic

Superwall and Adapty data show **contextual paywalls convert 2–4× higher than generic settings-page upsells** [I]. The mechanism is simple: the user has already demonstrated willingness-to-pay by hitting the limit.

Best trigger moments for a language app:

- **AI message cap** (5 free messages/day in Free → "Upgrade for unlimited")
- **Hearts depletion** ("You're out of hearts. Unlimited with Premium.")
- **Streak-at-risk** (last 4 hours of the day, streak not yet extended → "Save your streak with a Streak Freeze")
- **Review-queue overflow** ("30+ cards due today. Power through faster with Premium AI review?")
- **Listening exercise replay cap**
- **No-mistakes-mode** (perfect-lesson badge gated to Premium)

**Never trigger at random.** Context is the paywall's most valuable asset.

### Paywall funnel drop-offs — where to optimize

Per Adapty 2024 + RevenueCat 2025 [I]:

- Paywall view → CTA tap: **10–25%**
- CTA tap → StoreKit sheet presented: near 100%
- StoreKit sheet → purchase confirmed: **50–70%**

**The paywall-view → CTA-tap stage is where ~80% of A/B-testable conversion lift lives.**

---

## Price & Plan Psychology

### Decoy effect and 3-plan layouts [R]

Ariely's 1982 **Economist subscription experiment** is the canonical study: removing a dominated decoy plan flipped bundle adoption **84% → 32%**. When a clearly inferior option sits next to the target plan, users anchor to the target.

- Works: **Monthly ($12.99) / Annual ($83.99 ≈ $6.99/mo) / Family ($119.99/yr)** — Family anchors individual-annual as the "smart" choice.
- Fails: when the decoy is obviously filler. Users detect it and trust drops.

Duolingo Super (current pricing) uses exactly this 3-tier structure; Duolingo Max is then the fourth tier driving ARPU up 6% YoY per their 2024 filings [I].

### Pre-selecting annual = single biggest plan-picker lever

Superwall reports **+70% annual revenue increase when annual is pre-selected vs monthly default** [I]. Apple's App Store Guideline 3.1.2 now rejects **toggle paywalls that obscure which plan will be purchased**, so the modern pattern is **two visually-distinct plan cards, annual pre-selected with visible "SAVE 43%" badge**, not a toggle [I].

### Triple-frame annual savings

Three framings in parallel beat any single framing:

- **Percentage:** "Save 43%"
- **Per-unit:** "$6.99/mo billed annually"
- **Gift:** "2 months free"

Why all three? Because different users anchor on different scales (some are percentage-literate, some compare to a monthly mental price, some respond to "free" language).

### Left-digit / charm pricing ($9.99 vs $10.00) [R]

- Manning & Sprott 2009 (JCR): pen A at $2.00 vs pen B at $3.99 → 44% chose the pricier; at $1.99 vs $4.00 → only 18% did. **Large flip.**
- Troll et al. 2024 meta-analysis (k=69, N=40,541): "just-below" prices produce a **statistically significant but small** lift, Hedges' g = 0.13 (CI 0.01–0.25).
- **Null finding:** a 2022 online replication failed to reproduce the effect.

**Synthesis:** left-digit works modestly for value-positioning but **hurts** premium positioning. For Fluenci:
- Monthly: **$9.99** (discount-framing OK here)
- Annual: **$83.88 or $84** (round numbers signal premium quality on the aspirational plan)

### Free-trial length: counterintuitively, 7 days wins

Per RevenueCat State of Subscription Apps 2025 [I]:

- Trials of **17–32 days convert at 45.7% median**; trials **<4 days convert at 25.5%** — ~1.7× lift for longer trials.
- **But** 84% of 3-day trial cancellations happen on day 0–1 (users pre-emptively cancel to avoid forgetting).
- Industry trend: **46.5% of 2025 trials are ≤4 days** — the market is shrinking despite the conversion penalty, because short trials reduce "free-ride" abuse.

**Recommended for Fluenci:** **7-day trial with a day-5 "trial ending soon" push notification**. Long enough for habit to form (Duolingo's own data shows 7-day users are 3.6× more likely to complete a course); short enough to limit abuse.

### Risk reversal copy beneath the CTA

- Stormy.ai: adding **"No Commitment, Cancel Anytime"** near the CTA drove **+46% trial starts, +30% trial conversions** [I].
- Blinkist's transparent calendar + "we'll remind you 2 days before billing" paywall: **+23% trial conversions, push opt-in 6% → 74%** [I].

The mechanic: explicit loss-reversal lowers the perceived risk of the commitment.

### PPP-localized pricing = single biggest international-revenue lever

- **Spotify India:** priced at ~$1.45/mo vs $10.99 US → **+92.6%** user growth over 4 years [I]
- **Flo Health Brazil:** "hundreds of percent" YoY after price cut [I]
- **Pocket Trains:** doubled revenue in PPP-localized markets [I]
- **SaaS dataset:** 11% MoM growth with true market localization [I]
- **Tier-3 country 50% cut:** +73% conversion (0.79% → 1.37%)

Apple's auto-localization pegs to **exchange rate + round-up** — it does not reflect purchasing power. Build manual pricing tiers for BRL, INR, MXN, IDR, PHP, and at minimum 3 PPP tiers (OECD / mid-income / low-income).

---

## The Small Micro-Interactions That Compound

These don't close the sale individually, but they compound into trust and retention that *does* convert.

### Haptic feedback on key moments [R, I]

- Racat et al. 2026 (*Int'l J. of Consumer Studies*): haptic on "add to cart" in AR shopping apps **increases trust and purchase intent** (moderated by Need for Touch).
- Seaborn & Antle 2011 synthesis: adding haptic feedback drives **~40% perceived-quality lift, +35% task-response speed, +23% memory retention** (when paired with visual).
- Mobile gaming: haptic-on users show **higher retention and higher first-IAP rate** per industry vendor data.

For Fluenci: haptic on correct answer (`Haptics.notificationAsync(Success)`), lesson complete (`.impactAsync(Heavy)`), subscribe-tap (`.impactAsync(Light)`). Already implemented in `TactileButton` — extend to every primary action surface.

### 3D slab button [I, F]

Duolingo's canonical pattern. No published A/B with hard numbers on generic 3D buttons, but:

- Every Duolingo teardown (925 Studios, Growth.design, Orizon) identifies the slab-collapse-on-press as central to their engagement feel [I].
- LogRocket research on button states: visible pressed state reduces "did my tap register?" uncertainty, raises tap-completion rate on noisy networks.

Already implemented in `<TactileButton>`. Extend to every CTA across the app.

### Celebration animation → D1 retention → D30 conversion [R, I]

- Paschmann et al. 2025 (*Journal of Marketing Research*): gamification mechanics drive mobile-app engagement [R].
- StriveCloud meta-analysis: gamified apps see **+15–20% D30 retention**; brands using gamification improve retention **~22% on average** [I].
- Global D1 benchmark ≈ 26%; small deltas here cascade massively into subscription LTV.

The full conversion cascade: celebration → dopamine → D1 return → habit formation → day-7 streak → paywall impression → conversion. Every link is industry-observed; the end-to-end attribution is hard to isolate but the mechanism is well-supported.

Already implemented in `<CelebrationOverlay>`. Fire it on every lesson complete, not just perfect ones.

### Sound design [I]

Duolingo extensively A/B-tests its sound design; **80% of Duolingo users cite gamification (including sound) as why they enjoy it** per ChoiceHacking analysis [I]. Correct-ding, incorrect-bonk, lesson-complete fanfare each trigger dopamine pathways tied to reward learning.

Recommended sound set for Fluenci: correct (~200ms pleasant ding), incorrect (gentle bop, never punitive), lesson-complete (1–2s rising fanfare), level-up (bigger fanfare, rare). Respect iOS silent switch via `Audio.setAudioModeAsync`.

### Skeleton loading states vs blank [I, R — mixed]

- Industry: left-to-right shimmer perceived **~50% faster** than spinner, load times identical (Shefali.dev).
- Cloudinary 2020 study: animated skeleton roughly **doubled perceived performance** vs spinner.
- Conflicting [R] study (2017, N=136): skeletons actually performed worst on measured perception metrics — users guessed longer waits.

**Synthesis:** skeleton screens are the norm in modern mobile UX and likely net-positive, but the effect isn't huge. Keep skeletons **under 1 second of visibility**; beyond that they become noise. Left-to-right shimmer (Facebook pattern) > pulse.

### Default selection bias [R]

The single strongest nudge in behavioral economics:

- **Johnson & Goldstein 2003 (*Science*):** organ donation rates **42% (opt-in default) vs 82% (opt-out default)** — a ~2× swing from the default alone. Applied to subscriptions: pre-selecting the annual plan is the textbook nudge.
- Thaler & Sunstein *Nudge* (2008) formalizes choice architecture.

Ethical flag: strong defaults on *paid tiers* edge into dark-pattern territory under EU law (DSA). Safer pattern: pre-select annual but make switching to monthly one tap (same screen, obvious).

### Tab-bar badges [R, I]

- Hayward et al. 2022 (*PLOS ONE*): badges produce large increase in app-icon clicks vs no badge [R].
- WebEngage: apps using badges see **up to +88% higher open rate** [I] — treat as best-case.
- Mechanism is the Zeigarnik effect: unresolved tasks consume attention until closed.

**Warning:** runaway badge counts ("999+") trigger the reverse effect — users uninstall. Cap numbers or use dots.

For Fluenci: badge on Review tab when cards are due; badge on Assignments tab when graded; badge on Profile tab when achievement unlocked. Never show on Home (always current).

### Empty states as CTAs [R]

- Nielsen Norman Group: empty-state screens are **high-information surfaces**; they're not filler.
- Eleken: user stay/leave decisions are disproportionately shaped in the first **3–7 days**; empty screens in that window spike abandonment if silent.

**Pattern:** "No reviews yet" → "**Start your first lesson — we'll queue up reviews tomorrow**" with a CTA. Single action, single line, never a dead end.

### App Store screenshots ↔ first-run onboarding match [I]

- Apps running quarterly screenshot tests with keyword-aware captions see **+20–30% conversion** (ASO Mobile).
- SplitMetrics: **56% of app screenshots fail to illustrate product value** — missing CTAs, social proof, key outcomes.
- If screenshots promise Feature X and first-run shows Feature Y, **D1 retention + uninstall spike direct**.

**Rule:** whatever is in screenshot 1 must appear in the first 60 seconds of first-run. Refresh screenshots when the product reshapes materially.

---

## Copy That Converts (With Real Numbers)

Microcopy — the one- or two-word labels on buttons and forms — moves conversion more than any other cheap lever.

### Famous one-word / one-phrase swaps

| Change | Result | Source |
|---|---|---|
| "Sign Up" → "Learn More" | +40.6% signups (~$60M incremental donations) | Obama 2008 campaign [I] |
| "Register" → "Continue" (+ reassurance text) | +45% purchases (~$300M annualized) | Jared Spool "$300M Button" [I] |
| "Sign up" → "Get started" | 10–30% range in multiple A/Bs | CXL, Copyhackers [I] |
| Apple Podcasts "Subscribe" → "Follow" | "Meaningful behavioral change" at scale | Apple platform [O] |
| E-commerce: adding "view bundle" above CTA | +17.18% conversions | Danish e-com A/B [I] |
| Yoast checkout: adding "no additional costs" + "continue shopping" link | +11.3% conversions | CXL microcopy study [I] |
| Blinkist paywall rewrite (Continue vs Start Free Trial) | +23% trial conversions | Growth.design [I] |

### Voice to use at each funnel stage

From teardowns across Growth.design, Mobbin, Reforge:

- **Teaser banner:** curiosity, low-commitment. **"Unlock unlimited conversations"** not "Buy Premium"
- **Paywall headline:** **outcome-focused** ("Speak Spanish confidently in 3 months"), never feature-focused ("Premium features")
- **Plan card:** concrete + comparative ("**$6.99/mo billed annually — save 43%**"), never abstract ("Basic / Pro / Premium" alone)
- **CTA button:** commitment-reduction. **"Try 7 days free"** or **"Continue"** always beats "Subscribe" or "Buy Now"
- **Dismiss button:** softer tone. **"Maybe later"** > "Cancel" > "No thanks"
- **Beneath CTA:** risk reversal. **"Cancel anytime. We'll remind you 2 days before billing."**

### What never to say

- "**Limited time**" when the offer isn't actually limited — FTC Section 5 dark-pattern violation
- "**Only X left**" when supply isn't genuinely scarce — same
- "**Most Popular**" on a plan that isn't actually the most-chosen — deceptive per FTC 2024 guidance
- "**Buy now**" on a trial CTA — creates commitment dissonance; use "Start free trial"
- **Guilt or fake-sad mascot copy** ("We're disappointed you didn't subscribe") — Duolingo can pull this off because of humor; anyone else triggers uninstalls

---

## Contextual Triggers — "Just-In-Time" Upgrades

The psychological foundation: **Kahneman & Tversky 1979 Prospect Theory [R]**: losses loom roughly 2× larger than equivalent gains. When paired with the aha-moment + endowment effect, contextual upgrade prompts work.

### The four highest-leverage trigger moments

| Trigger | Mechanic | Expected impact |
|---|---|---|
| **Streak at risk** (last 4 hours of day, not yet extended) | Loss aversion — user built 12-day streak, doesn't want to lose it | 2–4× conversion vs random paywall [I] |
| **AI message cap hit** | Endowed progress — mid-conversation with AI, wants to finish | Contextual — user has demonstrated willingness-to-pay |
| **Hearts depleted** | Frustration + reciprocity (offer unlimited hearts) | Duolingo's canonical upsell moment |
| **Review queue overflow** (30+ cards due) | Competence vs effort — user wants to power through, Premium speeds it up | Reforge-documented pattern |

### The "invested user" rule

RevenueCat State of Subscription Apps: **users who return on day 7 convert at several-multiples the rate of day-1 users** [I]. Implications:

- The **first** paywall impression is a **seed**, not a close.
- The **3rd–7th** paywall impression (users who returned, invested, built streak) is where the real conversion happens.
- Don't front-load aggressive CTAs — they burn the chance.

### Exit-intent / abandonment recovery on mobile

Mobile doesn't have true web-style exit-intent (no mouse cursor). Substitute:

- Paywall dismissed → fire a **local notification 2–24h later tied to a usage event** ("You earned 50 XP — unlock 2× XP with Premium").
- Show a **different paywall variant** on the next impression (annual-focused after monthly-focused was dismissed). Superwall's 2025 best practice [I].

### Social / peer pressure conversion

- Cialdini social proof principle [R].
- Duolingo Leaderboards + Friend Streaks — industry-observed growth levers per Jorge Mazal's Reforge essay [I].
- Strava Premium: leaderboard badges visible to friends [I].

**Within-network > testimonials** for most subscription categories — friends' behavior is more persuasive than unknown reviewers. No rigorously published language-learning A/B on this; tag as industry-observed hypothesis.

---

## Invisible Growth Details People Forget

### 1-tap Apple Pay / StoreKit 2 checkout

**The biggest quantified lever in this whole doc.** RevenueCat published direct A/B: **IAP-only paywall +42% initial conversion, +43% trial starts** vs. web-only — same product, same users [I]. JTBD-style paywall optimization hits **+169% free-to-paid in best cases**; Smart Tales hit **+72% FTPP** per RevenueCat case studies [I].

For Fluenci: use `SubscriptionStoreView` (iOS 17+) with Paywall Builder offering objects. Face ID + Apple Pay confirms in a single gesture. **No web fallback** unless there's a concrete reason.

### Permission pre-prompt before iOS system ask

- Leanplum (now CleverTap): push pre-permissions → **+182% push opt-in** [I].
- Branch + AppsFlyer: delaying the ask to 7 days post-install, after the user has seen value, raises opt-in rates substantially [I].
- **Critical:** iOS only fires the real system prompt **once**. If the user denies, they must open Settings to re-enable. Never fire cold; always pre-prime with an in-app modal that sells the benefit first.

### Password form details

- UX Movement: killing the **confirm-password field** + adding a visibility toggle → **+56.3% signup completion** [I].
- Baymard: up to **19% checkout abandonment from password reset issues**; **75% won't complete a purchase** if they hit a mid-checkout password recovery [I].
- Google's web.dev sign-in best practices: support `autocomplete="new-password"`, iCloud Keychain autofill, Apple/Google Password Manager.

**Best for Fluenci:** magic-link signup (Supabase Auth native) or Sign-in-with-Apple. Eliminate the password entirely if possible.

### Onboarding form length (oversimplified wisdom)

- "Fewer fields = more conversions" is **too simple.**
- Unbounce: conversions bottom out at **4 fields**; adding meaningful/fun fields can increase conversions.
- Real case: 9 → 6 fields caused **−14% conversion**; re-adding 9 fields with clear optional markers + personality copy yielded **+19%** vs the 6-field version [I].
- Expedia removed one "Company" field → **+$12M/year** [I].

**Rule:** required fields only = {native language, target language, daily goal}. Age, referral source, why-you're-learning → post-activation. Abandonment hurts activation which compounds into never-paid.

### Personalized welcome back

- Chatway: personalized welcomes lift engagement **~40%** vs static greetings [I].
- McKinsey: personalization generally lifts revenue **5–15%**, marketing efficiency 10–30% [I].

**For Fluenci:** "Hi Tyler, ready for 5 minutes of Spanish?" beats "Welcome back." Use recent-lesson context ("Pick up where you left off: Verbs of motion") for higher-leverage personalization than name injection alone.

### Reducing choice paralysis

- **Iyengar & Lepper 2000 jam study [R]:** 24-jam display → 60% stopped, **3% bought**; 6-jam display → 40% stopped, **30% bought**. ~10× conversion difference from reducing choice.
- Schwartz *The Paradox of Choice* (2004) — book-length treatment [R].
- Office-supply retailer reduced SKU options per category → sales **increased** across all categories [I].

**Applied to Fluenci's course picker:** show **top 3–5 recommended** based on native language + popularity; hide the long tail behind "See all languages." Duolingo uses this pattern with 40+ languages.

### Time-of-day context cues

- Movable Ink: real-time contextual elements (time, location, weather) reliably lift conversion; best-case lifts in personalized experiences hit **+202%** [I].
- Specific "Good morning" A/B tests: **not published**. Treat as low-cost polish, not a big leverage point.

### Loading speed — myth vs truth

- Amazon 2006: "every 100ms of added latency cost ~1% in sales" — **real claim, 20 years old, from an employee talk**. Directionally correct, overstated when applied to native-app startup.
- Google mobile web: 0.1s speed boost → **+8.4% conversion, +9.1% add-to-cart**; 1s → 3s load → **+32% bounce** [I].
- 70% of mobile app users will abandon a slow-loading app [I].

**Myth flag:** the exact "1% per 100ms" coefficient is mobile-web e-commerce data applied outside its original domain. Direction is correct; coefficient is folklore.

**For Fluenci:** target TTI < 2s on cold start; prefetch next lesson's audio during current lesson; use skeleton shimmer for lesson loads. Measure impact on D1 retention, not directly on conversion.

### Font choice on paywall [thin evidence]

No clean published A/B on sans vs serif paywall fonts. Refero.design paywall gallery observation: premium apps (NYT, FT, Masterclass) lean editorial/serif to signal authority; fitness/gaming use bold sans.

**Don't change font just for the paywall** — creates brand inconsistency. Instead, **bump type scale** (paywall headings one tier larger) and **raise contrast** (pure white, not secondary gray). Easier wins with zero brand-inconsistency risk.

---

## Regulatory / Ethical Boundaries

The cost of crossing these lines has risen sharply since 2022. **Do not** A/B-test dark patterns — the short-term conversion gain is dominated by long-term regulatory and trust risk.

### FTC dark-pattern enforcement (US)

- **FTC 2022 guidance** + **"Bringing Dark Patterns to Light"** (2022) specifically calls out:
  - Fake countdown timers / "limited time" copy when not actually limited
  - Subscription traps and pre-checked boxes
  - Obscured cancellation flows
- **Click-to-Cancel rule** finalized Oct 2024; **vacated by 8th Circuit July 2025** on procedural grounds — **but ROSCA and Section 5 enforcement continues.** Treat as active law.
- Epic Games $520M settlement — sets precedent for monetary-loss dark-pattern enforcement.

### EU regulatory stack

- **Digital Services Act (DSA) Art. 25:** prohibits dark patterns on platforms. Fines up to **4% of global revenue**.
- **Omnibus Directive:** bans fake scarcity, false reviews, asymmetric cancellation.
- **Consumer Rights Directive:** 14-day cooling-off for distance contracts.

### App Store (Apple)

- **Guideline 3.1.2:** requires clear disclosure of subscription terms **before purchase**. Apple now rejects toggle paywalls that hide the annual commitment.
- **Reduced Motion Evaluation Criteria:** apps with "multi-axis motion, multi-speed motion, spinning, or vortex effects" must provide a reduced alternative.
- **Guideline 5.1.4 (kids):** in-app purchases for under-13 apps require stronger guardrails.

### The unambiguous "do not do" list

1. Fake countdown timers / false urgency
2. Monetary-loss streak bets ("pay $5 to save your streak")
3. Asymmetric cancel (one-tap upgrade, multi-step downgrade)
4. "Most popular" badge on the plan you want to push — must reflect reality
5. Pre-checked auto-renewal hidden in small print
6. Dark-fog re-engagement (hidden unsubscribe, bait notification copy)
7. Guilt notifications without humor (Duolingo's mascot gets away with it; nobody else should try)
8. Infinite-scroll lessons (learning requires episodic closure — sleep-consolidation literature)
9. Kids-targeted paywalls without explicit parental gate
10. Saturated color backgrounds behind lesson content (Mayer coherence violation)

---

## Language-Learning-Specific Findings

### Duolingo benchmarks (public disclosures)

- **Q4 2024:** 116.7M MAU / 40.5M DAU → DAU/MAU ~35% (vs industry ~10–15%)
- **Q3 2025:** 50M+ DAU
- **MAU-to-paid:** grew from 3% (2020) → 8.8% (2025) — roughly 3× improvement in 5 years
- **Users at 7-day streak: 3.6× more likely to complete the course**
- **20%+ of DAUs have streaks longer than one year**

### Delayed-paywall empirical win

Duolingo's famous onboarding A/B: **sign-up delayed until after the first lesson** → ~20% DAU lift. Language learning's "aha" is concrete (first sentence produced). The paywall should fire at the dopamine peak post-first-lesson, not at install.

### Duolingo Super pricing (reference)

- Monthly $12.99
- Annual $83.99 (≈ $6.99/mo)
- Family $119.99/yr
- **3-tier structure with Family as anchor pushing individual-annual**

### Personalized paywalls — Babbel / Busuu

Both apps use onboarding-answer-driven paywall copy:

- **Babbel:** "Reach conversational Spanish in 3 weeks based on your 15-min/day goal"
- **Busuu:** goal-based testimonials ("Sarah went from Spanish A1 → B1 in 6 months")

**This is likely the highest-leverage single paywall-copy change** available. Echo back the user's onboarding goal. Superwall A/B tests show personalization beats generic by 10–30% routinely.

### L1 vs L2 paywall copy

Crucial language-app-specific rule: show paywall + billing copy in the user's **L1 (native language)**, not the L2 (target language).

- Willingness-to-pay decisions are made in native cognitive frame.
- Some apps attempt L2 paywalls as "immersion" — widely reported to hurt conversion [I, folklore at the specific %].
- Translate every billing term (cancel, trial, subscription, charge, refund) into L1.

### Free-quota calibration for language apps

RevenueCat 2024: education apps have higher free→paid conversion when free tier is **time-limited** or **feature-limited** rather than **content-limited** [I]. Translation: gate on hearts, AI-message caps, offline downloads — **not** on which lessons users can access.

**Fluenci cap recommendations:**

- Free: 5 AI messages/day, 5 hearts, no Gemini Live voice
- Premium: unlimited messages, unlimited hearts, Gemini Live, offline mode, streak shields

Users should hit the cap ~2–3× per week (median engaged user) — daily hits build resentment; weekly hits build anticipation.

---

## Prioritized Intervention Shortlist for Fluenci

Implementation order by expected ROI, adjusted for this app's current state:

### Tier 1 — ship in the next release

1. **Delay the paywall** until post-first-lesson-complete. If currently hitting on sign-up, this alone likely lifts install-to-paid 5–15pp.
2. **Switch to StoreKit 2 / SubscriptionStoreView** for the checkout. +40-ish% free-to-paid vs web is too big to leave on the table.
3. **Permission pre-prompt** for push notifications with a 7-day delay after install or post-first-lesson completion. Never cold-fire the iOS system prompt.
4. **Kill confirm-password** + magic links via Supabase Auth. Already possible — just wire it.
5. **Pre-select annual** in the plan picker with "Save 43% / 2 months free / $6.99/mo" triple framing.
6. **Contextual paywalls** at AI-message cap, hearts depletion, streak-at-risk (last 4 hours).

### Tier 2 — ship in the following release

7. **Personalized paywall headline** echoing the user's onboarding goal ("Reach conversational Spanish in 3 weeks based on your 15-min/day goal").
8. **Blinkist-style trial timeline** paywall (calendar + "we'll remind you 2 days before billing" + "cancel anytime"). +23% empirical.
9. **L1-localized paywall + billing copy** — never L2 on paywall.
10. **Microcopy sweep:** "Sign up" → "Get started", "Cancel" → "Maybe later", "Subscribe" → "Try free for 7 days".
11. **7-day trial with day-5 push reminder** if currently on 3-day.

### Tier 3 — growth optimization phase

12. **PPP-localized pricing** in BR / IN / MX / ID / PH — highest-impact international-revenue lever.
13. **Tab bar badges** (Zeigarnik effect) on Review / Assignments / Profile.
14. **Personalized welcome back** with recent-lesson context.
15. **3–5 recommended courses** above the fold, long tail hidden.
16. **Empty-state CTAs** instead of "No items yet" dead-ends.
17. **App Store screenshot refresh** every quarter, matched to first-run.
18. **Different paywall variant** on re-impression after dismissal (annual-first if monthly-first was dismissed).

### Never

All 10 items in the "unambiguous do not do" list above. The short-term gain doesn't beat the long-term regulatory + trust risk.

---

## Sources

### Peer-reviewed / formal research

- Ariely 2008 — Decoy Effect / Economist experiment — [The Strategy Story](https://thestrategystory.com/2020/10/02/economist-magazine-a-story-of-clever-decoy-pricing/) / [Decision Lab](https://thedecisionlab.com/biases/decoy-effect)
- Manning & Sprott 2009, *Journal of Consumer Research* — Left-digit pricing — [JCR](https://academic.oup.com/jcr/article-abstract/36/2/328/1942926)
- Troll et al. 2024 — Just-below prices meta-analysis — [Wiley](https://myscp.onlinelibrary.wiley.com/doi/full/10.1002/jcpy.1353)
- Johnson & Goldstein 2003, *Science* — Defaults and organ donation — [Science](https://www.science.org/doi/10.1126/science.1091721)
- Iyengar & Lepper 2000 — Jam study — [Cognitive Clicks](https://cognitive-clicks.com/blog/the-paradox-of-choice/)
- Schwartz 2004 — *The Paradox of Choice* — [Decision Lab](https://thedecisionlab.com/reference-guide/economics/the-paradox-of-choice)
- Thaler & Sunstein 2008 — *Nudge*
- Kahneman & Tversky 1979 — Prospect Theory — *Econometrica*
- Racat et al. 2026 — Haptic in AR shopping — [Int'l J. Consumer Studies](https://onlinelibrary.wiley.com/doi/10.1111/ijcs.70189)
- Paschmann et al. 2025 — Gamification drives app engagement — [JMR](https://journals.sagepub.com/doi/10.1177/00222437241275927)
- Hayward et al. 2022 — Badge-driven notifications — [PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0270888)
- Nielsen Norman Group — Empty states, button states

### Industry data (vendor A/B reports, growth blogs)

- RevenueCat State of Subscription Apps 2025 — [RevenueCat](https://www.revenuecat.com/state-of-subscription-apps-2025/)
- RevenueCat — IAP vs Web conversion test — [RevenueCat blog](https://www.revenuecat.com/blog/growth/iap-vs-web-purchases-conversion-test/)
- RevenueCat — Trial length benchmarks — [RevenueCat blog](https://www.revenuecat.com/blog/growth/7-day-trial-subscription-app/)
- RevenueCat — Price localization — [RevenueCat blog](https://www.revenuecat.com/blog/growth/price-localization-for-apps/)
- RevenueCat — JTBD paywall optimization — [RevenueCat blog](https://www.revenuecat.com/blog/growth/jtbd-paywall-optimization/)
- RevenueCat — R.I.P. toggle paywall — [RevenueCat blog](https://www.revenuecat.com/blog/growth/r-i-p-toggle-paywall-we-hardly-knew-ye/)
- RevenueCat — Paywall redesign case studies — [RevenueCat blog](https://www.revenuecat.com/blog/growth/paywall-redesigns-case-studies/)
- RevenueCat — Mobile paywall guide — [RevenueCat blog](https://www.revenuecat.com/blog/growth/guide-to-mobile-paywalls-subscription-apps/)
- Superwall Best Practices 2025 — [Superwall](https://superwall.com/blog/superwall-best-practices-winning-paywall-strategies-and-experiments-to/)
- Superwall — 5 paywall patterns used by million-dollar apps — [Superwall](https://superwall.com/blog/5-paywall-patterns-used-by-million-dollar-apps/)
- Adapty benchmarks — [adapty.io/benchmarks](https://adapty.io/benchmarks)
- Adapty dark patterns — [adapty.io](https://adapty.io/blog/dark-patterns-and-tricks-in-mobile-apps/)
- Leanplum (now CleverTap) push pre-permission — [CleverTap docs](https://docs.leanplum.com/docs/how-to-increase-push-notification-opt-ins)
- Business of Apps subscription trial benchmarks — [Business of Apps](https://www.businessofapps.com/data/app-subscription-trial-benchmarks/)
- Apphud paywall best practices — [Apphud](https://apphud.com/blog/design-high-converting-subscription-app-paywalls)
- Stormy.ai paywall psychology — [Stormy.ai](https://stormy.ai/blog/app-paywall-psychology-subscription-revenue-triggers)
- Growth.design Blinkist teardown — [Growth.design](https://growth.design/case-studies/trial-paywall-challenge)
- Growth.design Noom onboarding teardown — [Growth.design](https://growth.design/case-studies/noom-app-onboarding)
- Blinkist UX Planet essay — [UX Planet](https://uxplanet.org/how-solving-our-biggest-customer-complaint-at-blinkist-led-to-a-23-increase-in-conversion-b60ad514134b)
- CXL microcopy roundup — [CXL](https://cxl.com/blog/microcopy/)
- Copyhackers "$300M Button" — [Copyhackers](https://copyhackers.com/how-to-optimize-your-button-copy/)
- ProseMedia conversion microcopy — [ProseMedia](https://www.prosemedia.com/blog/the-psychology-of-conversion-how-microcopy-shapes-user-decisions-on-landing-pages)
- UX Movement confirm-password removal — [UX Movement](https://uxmovement.com/forms/why-the-confirm-password-field-must-die/)
- Baymard password / checkout research — [Baymard](https://baymard.com/blog/password-requirements-and-password-reset)
- Expedia $12M field removal — [Duncan Jones NZ](https://www.duncanjonesnz.com/case-study-expedias-12-million-a-year/)
- Unbounce form-length research via MailMunch — [MailMunch](https://www.mailmunch.com/blog/form-length-affect-conversion-rate)
- Shefali.dev skeleton screens — [Shefali.dev](https://shefali.dev/skeleton-screens/)
- Bill Chung / UX Design — "What you should know about skeleton screens" — [UX Design](https://uxdesign.cc/what-you-should-know-about-skeleton-screens-a820c45a571a)
- WebEngage app icon badges — [WebEngage](https://webengage.com/blog/what-are-app-icon-badges/)
- Reforge — Jorge Mazal on Duolingo growth model — [Reforge](https://www.reforge.com/blog/duolingo-growth-model)
- Gina Gotthilf — Lenny's Podcast on Duolingo growth — [Lenny's Podcast](https://www.lennyspodcast.com/)
- Andrew Chen — push notification CTR benchmarks — [andrewchen.com](https://andrewchen.com/new-data-on-push-notification-ctrs-shows-the-best-apps-perform-4x-better-than-the-worst-heres-why-guest-post/)
- AppsFlyer ATT opt-in — [AppsFlyer blog](https://www.appsflyer.com/blog/tips-strategy/apps-boost-att-opt-in/)
- Branch iOS opt-in rates — [Branch](https://www.branch.io/resources/blog/achieve-high-user-opt-in-rates-ios/)
- Pushwoosh urgency copy — [Pushwoosh](https://www.pushwoosh.com/blog/increase-push-notifications-ctr/)
- Orizon Duolingo gamification — [Orizon](https://www.orizon.co/blog/duolingos-gamification-secrets)
- ChoiceHacking Duolingo — [ChoiceHacking](https://www.choicehacking.com/2023/05/25/how-duolingo-used-psychology-to-make-learning-addictive/)
- Cloudinary skeleton perceived performance — [Erwin Hofman](https://www.erwinhofman.com/blog/skeleton-loading-and-perceived-performance-cro/)
- 925 Studios Duolingo teardown — [925studios.co](https://www.925studios.co/blog/duolingo-design-breakdown)
- Amplitude Aha Moment — [Amplitude blog](https://amplitude.com/blog/aha-moment)
- Rahul Vohra / Superhuman PMF score — [First Round Review](https://firstround.com/review/how-superhuman-built-an-engine-to-find-product-market-fit)
- StriveCloud gamification retention — [StriveCloud](https://www.strivecloud.io/blog/habit-formation-user-retention)
- Movable Ink real-time personalization — [Movable Ink](https://movableink.com/blog/3-ways-to-drive-lift-with-real-time-personalization)
- Involve.me personalization stats — [Involve.me](https://www.involve.me/blog/marketing-personalization-statistics)
- Chatway welcome messages — [Chatway](https://chatway.app/blog/welcome-greetings-for-websites)
- ASO Mobile screenshot testing — [ASO Mobile](https://asomobile.net/en/blog/screenshots-for-app-store-and-google-play-in-2025-a-complete-guide/)
- SplitMetrics ASO mistakes — [SplitMetrics](https://splitmetrics.com/blog/aso-mistakes-affecting-app-visibility-and-conversion-rate/)
- ApptWeak screenshot optimization — [ApptWeak](https://www.apptweak.com/en/aso-blog/how-to-optimize-your-app-screenshots)
- Swifty 3D button + haptic — [dev.to](https://dev.to/yossabourne/making-3d-button-with-haptic-effect-like-duolingo-in-swiftui-2mj9)
- LogRocket button states — [LogRocket](https://blog.logrocket.com/ux-design/designing-button-states/)
- Swmansion haptic feedback — [Swmansion](https://swmansion.com/blog/haptic-feedback-explained-what-it-is-and-what-it-does-for-your-app-and-business/)
- Apple HIG — [developer.apple.com/design/human-interface-guidelines](https://developer.apple.com/design/human-interface-guidelines)

### Regulatory / legal

- FTC Dark Patterns Report "Bringing Dark Patterns to Light" — [FTC](https://www.ftc.gov/reports/bringing-dark-patterns-light)
- FTC Click-to-Cancel Rule (2024) — [Kirkland](https://www.kirkland.com/publications/kirkland-alert/2024/10/ftc-finalizes-click-to-cancel-rule-governing-subscriptions-and-autorenewals)
- 8th Circuit vacatur of Click-to-Cancel (2025) — [WilmerHale](https://www.wilmerhale.com/en/insights/client-alerts/20250801-eighth-circuit-vacates-the-ftcs-click-to-cancel-rule-but-federal-and-state-regulators-likely-to-remain-active)
- FTC Dark Pattern enforcement 2022 — [WilmerHale](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20220921-ftc-issues-dark-pattern-guidance)
- EU Digital Services Act Art. 25 — [European Commission](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package)
- FTC Dark Patterns Blacklist — [AGG](https://www.agg.com/news-insights/publications/the-ftc-blacklists-dark-patterns/)

---

**Last updated:** 2026-04-21. Reference document. Claims tagged by evidence strength ([R]/[I]/[F]). Use as hypothesis source for the A/B roadmap, not as fact for pitch decks (especially [I] and [F] numbers — verify against your own funnel data before committing).
