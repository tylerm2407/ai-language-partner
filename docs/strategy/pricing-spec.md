# Fluenci — Pricing & Product Spec

**Date:** 2026-08-07
**Purpose:** the exact products to create in App Store Connect / Google Play / RevenueCat, and the reasoning behind them. Companion to `positioning-2026.md` §2.1.
**Status:** design agreed; the code migration to these tiers is a separate pass (see §5).

---

## 1. What changes and why

Today: four paid tiers (`starter` $3.79 / `basic` $9.99 / `premium` $19.99 / `vip` $29.99), each defined by *daily quotas* — 10 vs 25 vs 50 vs 75 messages. A free user sees only priced cards and no "Free" label.

Three problems:

1. **Quota metering is artificial scarcity**, and artificial scarcity is ~50% of critical reviews across the nine competitors sampled. Every tier is defined by what the user is prevented from doing.
2. **Four tiers is choice overload** on a screen where the job is one decision. The contrast/anchoring evidence wants a clear anchor, not a ladder.
3. **Monthly-first is the wrong default.** Annual-with-trial retains 19.9% at day 380 vs 14.2% monthly and 5.5% weekly. AI apps specifically retain **36% worse on monthly** at 12 months than non-AI apps.

**One deviation from `positioning-2026.md`, flagged deliberately.** That report recommended two tiers. This spec proposes **Free + two paid**. Reason: a single paid option removes the anchor entirely, and the contrast effect is one of the better-supported findings in the conversion literature — the mid option converts better when a higher one exists beside it. Three cards total is still well inside choice-overload limits; four quota rungs was the actual problem.

---

## 2. The tier structure

Defined by **capability**, not daily counts.

| | **Free** | **Plus** | **Pro** |
|---|---|---|---|
| Lessons, SRS review, reading library | Unlimited | Unlimited | Unlimited |
| CEFR proficiency report | ✓ | ✓ | ✓ |
| Daily news | ✓ | ✓ | ✓ |
| Tutor chat (text) | 10/day | Unlimited | Unlimited |
| Voice practice | 20 min/month | **300 min/month** | **1,000 min/month** |
| Writing feedback | 2/month | Unlimited | Unlimited |
| Pronunciation scoring | 5/month | Unlimited | Unlimited |
| Offline mode | — | ✓ | ✓ |
| Audiobook narration | — | — | ✓ |
| Priority support | — | — | ✓ |

**Learning is never gated.** Lessons, review and reading are unlimited on Free forever. Paid buys *AI capacity* — the things with real marginal cost. This is what makes the positioning ("we prove what you can actually do") survivable: you cannot claim to measure someone's proficiency and then stop them practising.

### Voice: monthly pools, not daily caps

The current model is daily (5/10/20/30 min per day). Switch to monthly pools. Two reasons:

- **UX:** a daily cap tells an engaged learner "come back tomorrow" — the same interruption we just removed from hearts. A monthly pool lets someone do a 40-minute session on Sunday.
- **Margin:** a daily cap bounds nothing useful. VIP at 30 min/day is **900 min/month** worst case. Voice is the dominant marginal cost in this product, and 900 minutes at any realistic per-minute rate does not survive $29.99. A monthly pool is a hard ceiling you can actually price against.

**Action for you:** before finalising, compute your true per-minute voice cost (Gemini Live + TTS + STT, all-in). Plus at 300 min must stay comfortably under its monthly revenue. If per-minute cost is above ~$0.015, lower the pools — do not raise the price.

---

## 3. Prices to create

Annual is the default everywhere. All prices USD; use App Store price tiers and let StoreKit localise.

| Product | Price | Per-month equivalent | Saving vs monthly |
|---|---|---|---|
| **Plus — Annual** ← default | **$59.99/yr** | $5.00/mo | **50%** |
| Plus — Monthly | $9.99/mo | — | — |
| **Pro — Annual** | **$119.99/yr** | $10.00/mo | **50%** |
| Pro — Monthly | $19.99/mo | — | — |

**No weekly plan.** Weekly is 52% of education-app revenue and simultaneously the single largest driver of "this is a scam" reviews. A two-person team cannot absorb the refund and support load it generates, and the review damage compounds against a pre-launch app with no rating buffer.

Context: Babbel ~$96/yr, Busuu ~$120/yr, Speak ~$20/mo, Praktika $8/mo flat. Plus at $59.99/yr undercuts Babbel and Busuu while sitting above the $38.42 education median — defensible because voice conversation costs real money and the median includes flashcard apps that cost nothing to run.

### Trial

**14-day free trial on both annual products only.** Not on monthly.

- 17–32 day trials convert at 42.5% trial-to-paid vs 25.5% for 3–7 day trials.
- 55.4% of 3-day trial cancellations happen on day 0 — short trials mostly manufacture a cancel reflex.
- 14 days is long enough to clear that and still inside a billing cycle people can hold in their head.
- Trial subscribers carry a **+50.4% LTV premium** in education and retain 1.4–1.7× better than direct buyers.

The in-app trial timeline (already built, `components/subscription/TrialTimeline.tsx`) reads its length and price from the live StoreKit product, so it will display whatever you configure — but configure 14 days.

---

## 4. Product IDs to create

Create in **App Store Connect** → Subscriptions, in one subscription group named `Fluenci` (so upgrades/downgrades resolve as a group), then mirror in **Google Play** and map in **RevenueCat**.

| Product ID | Duration | Price | Intro offer |
|---|---|---|---|
| `fluenci_plus_annual` | 1 year | $59.99 | 14-day free trial |
| `fluenci_plus_monthly` | 1 month | $9.99 | none |
| `fluenci_pro_annual` | 1 year | $119.99 | 14-day free trial |
| `fluenci_pro_monthly` | 1 month | $19.99 | none |

Subscription group ranking (highest first, so StoreKit handles upgrades correctly):
1. `fluenci_pro_annual`
2. `fluenci_pro_monthly`
3. `fluenci_plus_annual`
4. `fluenci_plus_monthly`

**RevenueCat setup:**
- Entitlements: `plus` and `pro`. Attach the two Plus products to `plus`, the two Pro products to `pro`. Grant `plus` from `pro` as well, or check both in code.
- One Offering, `default`, with packages `$rc_annual` → `fluenci_plus_annual` and `$rc_monthly` → `fluenci_plus_monthly`, plus a second set for Pro.
- Keep the existing `basic` / `premium` / `vip` products **active but hidden** — see §5.

---

## 5. Migration — the part that needs its own pass

Do **not** delete the old tiers. `PlanId` (`lib/plans.ts:10`) is threaded through:

- `user_subscriptions.tier` values in Postgres
- `supabase/functions/ai-chat/index.ts` and `score-pronunciation/index.ts` (each holds its own `PLAN_LIMITS` mirror — see the warning at `lib/plans.ts:5`)
- `supabase/functions/_shared/plan-limits.ts`
- RevenueCat entitlement → tier mapping
- School contract config (`SchoolContractConfig`)

Anyone already subscribed on `basic`/`premium`/`vip` must keep working. The migration is:

1. Add `plus` and `pro` to `PlanId`; keep the legacy three as deprecated aliases that resolve to the nearest new tier (`basic`→`plus`, `premium`→`plus`, `vip`→`pro`).
2. Convert quota enforcement from daily counts to monthly pools — this is the real work, and it touches the edge functions and whatever table tracks usage.
3. Update the three `PLAN_LIMITS` mirrors together, in one change, and deploy them together. They are the enforcement layer; a client-only change grants nothing and blocks nothing.
4. Show only `plus`/`pro` in the paywall; legacy tiers render only as "your current plan".
5. Never downgrade an existing subscriber's actual limits. If a legacy tier was more generous than its successor, honour the legacy numbers for as long as that subscription is active.

Sequence: products in App Store Connect first (they take review time and can exist unused), then the code pass, then flip the offering.

---

## 6. What is already built

Shipped in this pass, working against the current products:

- **Free tier named and shown.** `starter` renamed to `Free` at $0 (`lib/plans.ts:38`), with an explicit current-plan card so a non-subscriber no longer sees only priced options.
- **Honest trial timeline** (`components/subscription/TrialTimeline.tsx`) — today / reminder / charge date, reading real StoreKit intro-price data so it can never misstate the charge. Blinkist reported +23% conversion, −55% complaints, and trial-reminder opt-in from 6% → 74% after shipping this pattern.
- **Feature lists rewritten to capability**, leading with what Free includes. "Unlimited hearts" removed everywhere — hearts no longer gate anything, so selling relief from them would be selling a benefit that does not exist.
- **Accurate subhead** — the paywall previously led with "unlock unlimited hearts, streak protection", i.e. selling relief from the app's own friction.

Still to do, in `positioning-2026.md` order: the tier collapse above, and item 8 (pre-auth first lesson), which is blocked on a production RLS decision.
