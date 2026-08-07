# Fluenci — Positioning, UI Retention & Professional Tone

**Date:** 2026-08-06
**Method:** 4 parallel research tracks — competitive/market, retention evidence, design/tone research, and a read-only audit of the Fluenci codebase. ~85 primary App Store reviews sampled across 9 competitor apps; RevenueCat/Adapty 2026 benchmark data; peer-reviewed design and gamification literature; every code claim cited to `file:line`.
**Companion docs:** `design-research.md`, `conversion-research.md`, `AD-CAMPAIGNS.md`, `selling-software-to-schools.md`. This document supersedes their positioning sections where they conflict.

---

## Executive summary

1. **Stop leading with AI.** "AI-powered" is commoditized and now measurably counterproductive as a claim. Every competitor ships AI conversation. A 767-user study found the label produced no trust gain, no willingness-to-pay gain, and sometimes *lowered* performance expectations.
2. **Lead with level accuracy and honest billing.** These are the only two positions supported by primary user complaints that no competitor owns. Both map onto systems Fluenci already has.
3. **The UI will not retain users as currently configured — but the UI is not the main problem.** The paywall architecture is. Four quota-metered tiers with no free label is artificial scarcity as the core mechanic, and artificial scarcity is ~50% of all critical reviews in this category.
4. **Fluenci already ships its own differentiator and hides it.** Adult mode (`lib/adult-mode.ts`) is the professional positioning, fully built, buried on step 8 of 9 in onboarding.
5. **`DESIGN.md` describes an app that does not exist.** 625 raw `<Text>` vs 86 primitives; 244 raw `<Pressable>` vs 8 `<TactileButton>`; ~9 hue families on Home against a documented 60-30-10 rule.
6. **One item is a compliance issue, not a taste debate:** the always-on glow blobs are a WCAG 2.2 SC 2.2.2 **Level A** failure, and four other animations don't gate reduce-motion at all.

---

## 1. Positioning

### 1.1 What is already owned — do not fight for these

| Claim | Owner |
|---|---|
| Free / gamified habit | Duolingo |
| Speaking-first | Speak ($1B valuation, OpenAI-backed) |
| CEFR-aligned *curriculum* | Busuu |
| Structured grammar for professionals | Babbel (€352M rev, 5,000+ B2B clients) |
| Business English | Loora |
| Pronunciation scoring | ELSA |
| Audio / commute | Pimsleur |
| Avatar roleplay | Praktika, LingoLooper |
| Live humans | Preply ($1.2B), italki, Lingoda |

**AI conversation practice is table stakes as of 2026.** Duolingo Max, Busuu Conversations (Feb 2026), Speak, Praktika, TalkPal, Loora, Univerbal, Jumpspeak and ELSA all ship it. Shipping "AI chat + voice tutor" as the headline is shipping parity and calling it a product.

### 1.2 Why "AI-powered" is now a liability

- Harris Poll, June 2026: 63% *less likely to buy* from a brand using AI-generated ads; 73% less likely to trust one.
- Fractl: consumers saying heavy AI use would decrease brand trust went 20% → 40% in one year.
- Gartner 2026: 50% of US consumers prefer brands that don't use generative AI in customer-facing content.
- Direct experiment (n=767 software users): labeling a product "AI-powered" did not increase trust or willingness to pay, and in some cases lowered performance expectations.
- Duolingo's own case: von Ahn attributed Q2 2025's low-end DAU result to AI messaging on the earnings call — *"I said some stuff about AI, and I didn't give enough context."* Revenue was unharmed (+41%), but growth landed at the bottom of guidance and the remediation was tonal.

**Rule: lead with the outcome. AI is the mechanism, never the headline.**

### 1.3 The two defensible positions — validated against primary user text

We sampled ~85 App Store reviews across 9 competitors (~34 critical). Findings, ordinal not cardinal:

| Rank | Complaint theme | Share of critical reviews |
|---|---|---|
| 1 | **Billing / cancellation / paywall / price** | **~50%** |
| 2 | Speech recognition / AI factual accuracy | ~15% |
| 2= | Support, stability, accessibility | ~15% |
| 4 | Content ceiling — too basic for the price | ~12% |
| 4= | Progress slower than marketed | ~12% |
| 6 | **Level mismatch — AI over/under user's level, unadjustable** | ~9% |
| 6= | Conversation incoherent / shallow | ~9% |

**Position A — "The tutor stays at your level, and never teaches you something wrong."**

Verbatim user complaints:
> *"Emma seems to chat on a B2 level well above my knowledge level… How do I adjust the conversational level?"* — TalkPal ⭐⭐⭐
> *"TalkAI is continually making serious errors in Gallego… My teacher must absolutely never teach me to speak incorrectly."* — TalkPal ⭐⭐⭐
> *"Definitely not for beginners… you would need a considerable foundation in the language."* — Praktika

This is exactly what `supabase/functions/_shared/validated-generate.ts` — the level-checker plus content-safety pipeline — already does on every AI interaction. It is the one asset in the stack that is both genuinely differentiated and mapped to an unowned, unprompted user complaint. It is also *demonstrable in a screenshot*, which "our AI is deeper" is not.

**Position B — "Honest pricing. No weekly plans, no dark patterns, cancel in two taps."**

The single loudest unmet demand in the category. Verbatim:
> *"Partially scammers… designed to make it difficult for you to cancel."* — Loora
> *"Price Scam - don't pay subscription"* — ELSA ⭐⭐
> *"They trick you into what you think is free but then steal $129."* — Duolingo
> *"I didnt even get to try it without paying 80 bucks a year… Not even one feature was unlocked."* — TalkPal ⭐⭐

Praktika's answer — flat $8/mo, one tier, no upsells — correlates with 20x revenue growth in 2024. This position is free to adopt and attacks the #1 complaint in every competitor sampled.

### 1.4 What we tested and had to discard

- **"Error memory across sessions"** — zero primary reviews asked for it across 85 sampled. Its only source was a competitor's own blog. Good retention mechanic; **not validated market demand**. Do not headline it.
- **"AI conversation is shallow and loops"** — overstated ~2.5x. Ranks 6th at ~9%, not 2nd at 22%, and the phrasing appears mainly in competitor-owned blogs rather than paying users' words. The real complaint is *incoherence and non-adaptation*, which Position A already covers.

### 1.5 Recommended positioning statement

> **Fluenci is language learning that proves it's working.**
> Every sentence your tutor says is checked against your actual CEFR level. Every sentence you produce is measured. You get a proficiency report that shows what you can do — not a number that goes up.
> One price. No weekly plans. Cancel in two taps.

Target segment: **adult learners at the A2–B2 plateau** — the least contested, most frustrated, most willing-to-pay part of the market. Content-ceiling complaints (~12%) corroborate the plateau thesis: *"$250 for 5 levels just up to past tense verbs,"* *"won't be able to learn anything beside hello, goodbye, and how are you."*

### 1.6 Channel — consumer first, B2B later

Realistic benchmarks (RevenueCat SOSA 2026, Education row): D30 download-to-trial 6.5% median (13.5% top quartile), trial-to-paid 36.4%, 12-month LTV **$45.10**, median annual price $38.42.

$45 LTV supports roughly **$11–15 CAC**. Education blended CPI is $4.70; at 10.7% hard-paywall conversion that implies ~$44 CPA — essentially the entire 12-month LTV. **Paid UA alone cannot reach $10K MRR profitably.**

Channel order:
1. **Creator/UGC on TikTok + Reels** — the only channel with documented small-team success (LingoLooper: 12M+ views in 100 days). Cheapest reach at $9.16 CPM vs Meta's $14.91.
2. **ASO with localized screenshots.** Apple began indexing screenshot caption text for keyword ranking in mid-2025 — captions now do ranking *and* conversion work. Fluenci's largest addressable market is people learning English outside English-speaking countries; localizing screenshots (not just metadata) is the highest-ROI ASO move available.
3. **Apple Search Ads** — education CPT $1.24, the cheapest paid inventory available. Start here, not Meta.
4. **SEO/AEO content** — slow, compounding, feeds AI-assistant recommendations.
5. **Broad paid UA** — do not scale until the paywall clears 10% and D60 RPI is known.

**Note:** education is the category where buyers decide latest — 23.5% of trials start 31+ days after install, highest of any vertical. Standard 7-day attribution will systematically undercount your best channels, and lapsed-user re-engagement is higher-leverage here than anywhere else.

### 1.7 The Bryant pilot — reframe it

180 pre-provisioned `@bryant.edu` accounts, zero sign-ins (`CLAUDE.md:61`).

**This is a seeded roster, not a landed pilot.** Provisioning is not a phase of any edtech pilot framework. Zero activation out of 180 is a near-certain signal that no instructor is requiring it and no student was told what it is.

Ceiling math: 180 students × $79/yr = $14,220/yr ≈ **$1,185/mo — 12% of the $10K MRR target**, at 100% activation. If they are free pilot seats, $0. To reach $10K MRR on institutional seats you'd need ~2,400 seats — roughly 13 more Bryant-sized deployments, each 6–18 months, each requiring SOC 2 + FERPA DPA + LTI + VPAT that Fluenci does not have.

**Answer: consumer subscriptions are the faster path to $10K MRR, and it is not close.** Babbel and Busuu both show B2B as their fastest-growing segment (Busuu B2B +29% YoY vs 7% consumer) — B2B is where durable revenue lives *later*. It is not where the first $120K comes from for a two-person team.

**What Bryant is actually worth: evidence, not revenue.** Even 30 activated students with measured CEFR movement over one semester is the case study that gates every future institutional deal and adds credibility to consumer marketing.

Actions, in order:
1. **Find the human owner.** One instructor who assigns Fluenci for a grade beats 180 emails. Ask for one 20-minute in-class session and one graded assignment.
2. **Write success criteria before the cohort starts** (e.g. ≥60% complete a placement test week 1). Pilots without these stall at renewal regardless of product quality.
3. **Do not cold-email 180 students who never consented.** Route through the instructor. CAN-SPAM exposure, sender-domain reputation, and the institutional relationship are all on the line.
4. **Close the liability.** 180 dormant pre-provisioned institutional credentials sitting in `auth.users` indefinitely is exactly what a FERPA/security review fails you on. Expire them on a deadline or document why they exist.
5. **Re-aim the school system at instructor self-serve** — credit card, no procurement. Same code, zero compliance gate. That is how Kahoot, Quizlet and Duolingo for Schools got inside institutions: bottom-up first, procurement following usage. Note `config/app.ts:6` currently ships it disabled (`SCHOOL_ENABLED = false`).

---

## 2. Will the current UI retain users?

**Short answer: no — but the UI is the second problem. The paywall is the first.**

### 2.1 The paywall is the largest retention risk in the product

Current state (`lib/plans.ts:37-130`, `app/(app)/profile/subscription.tsx`):

| Tier | Price | Text msgs/day | Voice min | Writing grades | Hearts |
|---|---|---|---|---|---|
| Starter | $3.79/mo | 10 | 5 | 1 | 5/day |
| Basic | $9.99/mo | 25 | 10 | 3 | unlimited |
| Premium | $19.99/mo | 50 | 20 | 7 | unlimited |
| VIP | $29.99/mo | 75 | 30 | 12 | unlimited |

Four problems, in severity order:

1. **Quota metering is artificial scarcity, and artificial scarcity is ~50% of all critical reviews in this category.** Every tier is defined by how much the user is *prevented* from doing. This is the exact structure users call a scam in competitors' reviews.
2. **A free user never sees a "Free" label** — `currentTier = subscription?.tier ?? 'starter'` (`subscription.tsx:49`) means free users see only paid cards, and "Starter" carries a $3.79 price in `plans.ts` while acting as the free default. That ambiguity is the mechanism behind *"NOTHING IS FREE AS IT SAYS."*
3. **Hearts gate lesson entry** (`app/(app)/index.tsx:198-204`). Duolingo ran this experiment at 50M DAU scale and reversed it: in Feb 2026 they gave up **~$50M in 2026 bookings** to reduce free-tier friction, with von Ahn stating on the record that excessive friction hurt user growth. Stock fell 22–24%. That is the most expensive publicly-priced lesson available on this mechanic.
4. **Four tiers is too many, and monthly-first is the wrong default.** Education median annual price is $38.42; annual-trial subscribers retain at 19.9% at day 380 vs 5.5% weekly. Note AI apps specifically retain **36% worse on monthly plans** at 12 months than non-AI apps — a hard argument for annual-primary.

**Recommendation:** two tiers (Free + one paid, or Free + monthly/annual of one paid tier). Define the paid tier by *capability* (voice tutor, writing grades, offline) rather than by daily counts. Annual pre-selected at ~$59–79/yr with a monthly decoy. Skip weekly entirely despite it being 52% of education revenue — two people cannot absorb the refund and 1-star-review load it generates. Adopt Blinkist's honest-paywall pattern: visual trial timeline, exact charge date, cancellation path in plain text, pre-charge reminder (reported +23% conversion, −55% complaints, notification opt-in 6% → 74%).

### 2.2 Time-to-first-value is far too long

- **~32 taps** from launch to first lesson with the placement test; ~12 taps plus two text fields without it.
- **Nothing teaches before signup.** All lesson routes are under `app/(app)/` and `app/_layout.tsx:170-173` bounces every session-less user out.
- `DESIGN.md:581` claims "first lesson playable anonymously" is implemented. **It is not.** The reciprocity principle documented in your own design system is unbuilt.

Evidence: moving signup behind the first lesson is Duolingo's most-cited onboarding win (~+20% DAU; exact figure unverified, but the design choice is directly observable in the shipping product). NN/g: a signup wall in front of the first value moment routinely loses 20–40% of users who reach it. Target first core action under 60 seconds.

**The pre-auth onboarding is otherwise well-built** — 9 steps, answers persisted to AsyncStorage, flushed post-signup. The placement test terminating in a CEFR result before signup is exactly right (education A/B data: survey + trial lesson beat lesson-only by +25% trial starts, +78% ARPU). The gap is that the *lesson* isn't reachable, not that the flow is wrong.

### 2.3 What is working and should be protected

- **Adult mode** (`lib/adult-mode.ts:22-53`) — a single source of truth toggling hearts, streaks, leagues, XP, daily challenges, with values still accruing server-side so nothing is lost. Offered in onboarding step 8 and in Settings.
- **The proficiency report** (`app/(app)/profile/proficiency.tsx`) — CEFR letter, confidence label, per-skill breakdown, vocabulary retention ladder, and an honesty notice: *"This is an estimate based on what you have practised in Fluenci. It is not an official CEFR certification."* This is the single strongest credibility artifact in the app.
- **Accessibility implementation** — 238 of 244 `<Pressable>` elements (97.5%) carry `accessibilityRole` and/or `accessibilityLabel`; zero `TouchableOpacity`. Genuinely strong, and a competitive edge: two competitors drew unprompted accessibility complaints (*"text remains very small,"* *"vastly shrunk the font with no option in settings"*).
- **SM-2 with honest interval labels** ("Again 1m / Hard 6m / Good 10m / Easy 4d"). Spaced repetition has the best published evidence in the whole gamification stack: +12% daily engagement in Duolingo's own operational study.
- **Restraint on emoji** — only 3 user-visible strings, with a code comment documenting the deliberate removal of 🔥⚡❤️.

### 2.4 Gamification: keep it, re-render it

The evidence does **not** support "adults reject gamification." It supports a narrower claim: effectiveness is strongly moderated by individual preference (β=0.517, p<0.001, n=413 adults), and adult complaints cluster on *missing explanation* and *artificial scarcity*, not on XP and streaks themselves.

Duolingo's own published lifts are modest and specific — +3.3% D14 from the streak change, +0.5% DAU from notification optimization, +17% learning time from leagues. The 40-point retention miracles in growth blogs are unsourced; treat them as fabricated.

Two structural cautions:
- **Leagues are safe only in bracketed form.** Global rank harms low performers; ~30-person score-matched weekly leagues have RCT support for *helping* them (+0.27 SD exam grades). Fluenci currently ships only a `LeagueBadge` on Profile with no standings screen — that's the safe end, and worth keeping there.
- **Hearts carry the strongest negative real-world evidence available.** See §2.1.

**Adult mode's one limitation: it's all-or-nothing.** No granular control (keep XP, drop hearts), and there is no sound, haptics, or reduce-motion toggle anywhere in Settings. Strava's lesson is parallel mechanics so users self-select rather than one binary switch.

---

## 3. Professional tone: what the research says vs. what Fluenci built

### 3.1 The governing finding

Stanford Web Credibility Project (~4,500 participants): **"design look" was the most frequently mentioned credibility factor, cited in 46.1% of comments** — above content quality. Users judge competence visually first.

Fox, Shaikh & Chaparro (2007) is the load-bearing paper for this section: **typeface incongruence degrades the perceived personality of the document *and the perceived competence of its author*.** For a product making CEFR and SM-2 claims, the "author" being judged is Fluenci's credibility as an educational provider.

### 3.2 Gap analysis

| Research finding | Fluenci today | Verdict |
|---|---|---|
| One neutral/humanist grotesque for UI+body; rounded faces are the fastest "for children" signal | **Nunito (rounded) carries 100% of UI and body** | ✗ Highest-risk element in the visual system |
| One editorial serif for headlines is the cheapest credible-plus-warm purchase | Fraunces on headlines | ✓ Correct |
| Never share one face between credibility and celebration roles | Fraunces on headlines **and** `<Hero>` celebration | ✗ Type that means authority and party means neither |
| Mono only where notation is semantic; tabular figures otherwise | JetBrains Mono for dates/counts | ~ Redundant; adds a developer-tool signal |
| ≤5 hues system-wide, one accent used scarcely | **~9 hue families, 20+ hex values on Home alone** | ✗ Directly contradicts `DESIGN.md:17` |
| Never hard-code hex outside tokens | `LessonTile.tsx:30-37`, `lib/challenges.ts:20-29`, `index.tsx:208-246` all hard-code | ✗ Violates `DESIGN.md:26` |
| No ambient looping motion on task surfaces | 3 glow blobs loop on every screen incl. lesson/reading | ✗ **WCAG 2.2.2 Level A** |
| All motion gates reduce-motion | 4 animations ungated | ✗ Violates `DESIGN.md:14` |
| Light default for sustained reading | Dark canonical incl. reading/writing | ~ Defensible with conditions (§3.4) |
| Report the work, don't praise the person | "Awesome!", "Great work!", "Oh no!", "Insane" | ✗ |
| Errors: what happened → why → what next, with recovery | Mixed — some excellent, some raw Supabase strings | ~ |

### 3.3 The one compliance item

**WCAG 2.2 SC 2.2.2 (Pause, Stop, Hide) is Level A** — the conformance floor. It requires a *mechanism* to pause, stop or hide any motion that (1) starts automatically, (2) runs >5 seconds, and (3) appears alongside other content. The three glow blobs in `components/ui/GlowBackground.tsx:106` (9s/12s/15s loops, every screen) match all three conditions. Decorative ambience never qualifies for the essential-activity exemption.

**Honoring `prefers-reduced-motion` does not satisfy 2.2.2** — the criterion requires a user-facing control, and Fluenci has no motion toggle in Settings.

Four animations don't even gate reduce-motion:
- `components/learning-path/PathNode.tsx:25-43` — active node pulse, on Learn
- `components/avatar/AvatarExpression.tsx:30-36` — avatar "breathing", on Profile
- `components/onboarding/OnboardingChecklistFab.tsx:133-144` — FAB pulse, on Home
- (`TypingIndicator` runs only while typing — defensible)

This is the cheapest item on the list to fix and the one most likely to surface in a university VPAT request.

Separately: low-opacity indigo/violet radial glow blobs are the most conventionalized "AI startup landing page" visual of the last few years. Whatever premium signal they carried has become a prototypicality signal pointing at *template*. Linear achieves its premium read with flat luminance steps and **zero** ambient motion.

### 3.4 Dark theme — keep, with conditions

The dark base `#08090F` is a good near-black and is defensible for lesson, drill, review, chat and profile — glanceable, short-dwell surfaces. WHOOP and Calm both justify dark *functionally* (evening use, data contrast) rather than on brand vibes, which is the right framing.

Two costs to accept knowingly:
- **Reading and writing run against the strongest evidence here.** Piepenbrock (2013, *Ergonomics*) and NN/g's synthesis both find light better for sustained reading and proofreading, and the advantage grows as font size shrinks. Your own `design-research.md:482` reached the same conclusion and recommended near-white as the default baseline — `DESIGN.md` overrode it without recording why.
- **Prototypicality.** Every education product in the research sample defaults to light — Duolingo, Babbel, Khan Academy, Brilliant, Notion, Headspace, Blinkist. Dark-default reads "technical / AI tool," which is a legitimate position but not the one a university procurement committee pattern-matches to "learning platform."

**Recommendation:** keep dark as a first-class theme; ship a genuine light theme; default **reading and writing surfaces to light** or give them a per-surface override. If dark stays global, reading type must be the largest and heaviest in the product.

### 3.5 Copy fixes

**Childish / patronizing:**
- `onboarding.tsx:786` — daily-goal scale ends at **"Insane"** for 30 min/day
- `StreakRepairModal.tsx:36` — **"Oh no!"** as a modal headline
- `LevelUpModal.tsx:162` — **"Awesome!"** as a CTA label
- `learn/review.tsx:94` — "Great work!" appended to a review summary
- `learn/index.tsx:30-35` — CEFR mapped as **A1 Beginner / A2 Intermediate / B1 Advanced / B2 Professor**. Both game-flavored and *pedagogically wrong*, sitting directly under the one credential the product wants to claim. **Fix this first** — it undermines Position A single-handedly.

**Cold / unfinished:**
- `learn/index.tsx:285` — *"Courses will appear here once they are published to your Supabase database."* Developer-facing copy in a shipping user-visible empty state.
- Raw `Alert.alert('Error', <supabase message>)` at `auth.tsx:56`, `auth.tsx:78`, `onboarding.tsx:347`, `learn/index.tsx:97/118/130/433`, `profile/settings.tsx:59`
- `NewsHeroCard.tsx:56-57` renders **"TODAY'S READ · NIVEL INTERMEDIATE"** — Spanish noun, wrong scale, on the loudest element on Home
- Silent-swallow paths at `index.tsx:126-128` and `news/[date].tsx:45-47` contradict `CLAUDE.md` §6
- `review/index.tsx:190` — exit button is a literal lowercase "x" as text
- `AudioPlayButton.tsx:59` — "!", "||", "▶" as text glyphs instead of Ionicons

**Copy principles to adopt** (Mailchimp / Polaris / Apple HIG / GOV.UK):
- Report the work, don't praise the person: *"Unit 3 complete — 42 new words, 91% accuracy"* beats *"Amazing job!!"*
- Name difficulty honestly — *"Subjunctive is hard. Most learners need 3–4 passes."* Expertise reads as credibility; *"You've got this! 💪"* reads as filler.
- Errors: what happened → why → what to do next, always with a recovery action. Never "Oops."
- Notifications: assume the user got busy, not that they failed. Guilt may win a 7-day A/B test and lose on brand — a professional-positioning product should refuse that trade.

**Also:** the mascot is named **"Lumi"** in exactly two places (`useNotifications.ts:178`, `PrePermissionSheet.tsx:42`) and nowhere in the app UI. A user meets the name for the first time in a push notification.

### 3.6 The documentation problem

`DESIGN.md` is materially stale and self-contradictory:
- `:11` says `surface.base` is `#0C0F14`; `config/theme.ts:19` is `#08090F`
- `:19` (Core Principle #9) still names **PlayfairDisplay and Inter** — neither is loaded
- `:15` says text contrast is 14.6:1; `:91` says 15.6:1
- `:553` says the UX psychology principles are "all six implemented"; `:624` says "not yet implemented"
- `:581` claims anonymous first lesson — unbuilt
- `:401` lists `GradientButton` as retired — 15 usages remain

A design system nobody follows is worse than none: it produces false confidence in review. Either enforce it with lint rules or rewrite it to describe what's actually there.

---

## 4. Ranked action list

### Do first — credibility and compliance, all cheap
1. **Fix the CEFR map** (`learn/index.tsx:30-35`). A2 is not "Intermediate," B1 is not "Advanced," B2 is not "Professor." This is the credential the whole position rests on.
2. **Make the glow blobs static, or remove them from lesson/reading/writing/review.** WCAG Level A.
3. **Gate the 4 ungated animations** on `useMotion()` and add a motion toggle in Settings.
4. **Kill developer-facing and raw-error copy** — the Supabase-database empty state, every raw `Alert.alert('Error', message)`, "NIVEL INTERMEDIATE".
5. **Fix the childish strings** — "Insane", "Oh no!", "Awesome!", per-answer praise.

### Do next — retention and revenue
6. **Rebuild the paywall.** Two tiers, capability-based not quota-based, annual pre-selected, explicit "Free" label, Blinkist-style honest trial timeline.
7. **Remove hearts from lesson gating**, or make adult mode the default. Duolingo priced this mistake at $50M.
8. **Make the first lesson playable pre-auth** — the thing `DESIGN.md` already claims. Target <60s to first teaching moment.
9. **Surface the proficiency report.** It's the strongest credibility artifact in the app and it's three taps deep behind achievements.

### Do for positioning
10. **Promote adult mode from a buried step to a headline.** It is the professional positioning, already built.
11. **Rewrite store listing and marketing around level accuracy + honest billing.** Localize screenshots, not just metadata.
12. **Swap Nunito for Inter (or SF) in UI and body**; take Fraunces off celebration; drop JetBrains Mono for tabular figures. Largest single change to perceived register.
13. **Cut Home to one accent plus semantic colors.** From ~9 hue families to ≤5 system-wide.

### Do for B2B
14. **Find the Bryant instructor.** Written success criteria before any outbound. Run it for the case study, not the revenue line.
15. **Expire or document the 180 dormant accounts.**
16. **Re-aim the school system at instructor self-serve.**

---

## 5. Evidence gaps — stated plainly

- **Reddit was inaccessible at the domain level** through every route tried, including mirrors. There is no r/languagelearning primary voice in this research. Someone should browse it manually before betting the positioning.
- **Trustpilot 403'd; Google Play review text is client-rendered and unfetchable.** All primary review data is **iOS-only**. Android has 31% involuntary billing-failure churn vs 14% on iOS, so the billing complaint theme is probably *larger* than measured.
- **N=34 critical reviews, ordered by Apple's "Most Helpful," is not a random sample.** Directions are solid; the percentages are not. Non-English reviews were not sampled.
- **No verified university-pilot contract value for a language product exists.** All per-seat figures are corporate-training comparables; ELSA's ~$6.96/user/year institutional entry is the only confirmed small-vendor education price.
- **No RCT quantifies post-streak-break churn magnitude.** Direction is universally reported; magnitude is unverified everywhere.
- **The Babbel/Duolingo age split** (26–29 favoring Duolingo, 34–40 flipping to Babbel) is the most strategically loaded datum here and rests on a single small-N source. Validate against your own users before it drives decisions.
- **Widely-circulated figures that are unsourced and should not be cited:** "streaks lifted retention 12%→55%", "streaks boost engagement 60%", "Streak Freeze reduced churn 21%", "serif fonts increase trust 40%", "dark mode reduces comprehension 14%".
