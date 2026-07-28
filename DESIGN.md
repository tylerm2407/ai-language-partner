# languageAI / Fluenci Design System

**Canonical source of truth.** All UI changes must conform. Do not introduce new colors, spacing values, or component patterns outside of the approved token set in `config/theme.ts`.

> **Phase 0 status:** foundation primitives + theme tokens are live; per-screen rollout in progress. See [`redesign-plan.md`](./docs/strategy/redesign-plan.md) for phasing and [`design-research.md`](./docs/strategy/design-research.md) for the empirical/industry research anchoring every decision.

---

## Core Principles

1. **Canonical theme is DARK.** Surface.base `#0C0F14` is the default screen background. Reading/lesson/review surfaces step up to `surface.raised` (`#12161D`) for focus.
2. **Indigo is the primary brand.** `#6366F1` anchors CTAs and focused states. `#818CF8` is the brighter variant reserved for accents that must stay legible on dark.
3. **Motion is earned.** No global animation in chrome. Animation appears in (a) state transitions, (b) micro-feedback (≤200ms), (c) celebration moments. Everything else is static.
4. **Every animation gates `useMotion().shouldReduce`.** Honor `AccessibilityInfo.isReduceMotionEnabled` without exception. App Store accessibility criterion.
5. **Body text is WCAG AAA.** `text.primary` (`#F1F5F9`) is 14.6:1 against `surface.base`. Never pure white on pure black (halation).
6. **Color is never the only signal.** Correct/incorrect always paired with icon + text label. WCAG SC 1.4.1.
7. **60-30-10 color distribution.** Neutral surfaces dominate; accent color reserved for CTAs and progress.
8. **8pt grid.** Spacing values are 4, 8, 12, 16, 24, 32, 48, 64.
9. **Three typographic roles.** Display (PlayfairDisplay, celebration only), UI (Inter Bold 700), body (Inter 400/500).
10. **One mascot.** Consistent across celebration states; static SVG today, Rive state-machine in a future phase.

---

## Source of Truth

All tokens are defined in **`config/theme.ts`** and imported by every component. **Never hard-code hex values in screens or components.** If you need a new token, add it to `config/theme.ts` first.

```ts
import { colors, spacing, radii, typography, motion, elevation } from '../../config/theme';
```

---

## Color Palette

### Surfaces (dark-canonical)

| Token | Hex | Usage |
|---|---|---|
| `surface.base` | `#0C0F14` | Primary app background (home, chat, practice, profile) |
| `surface.raised` | `#12161D` | Reading / lesson / review screens — focus surface |
| `surface.card` | `#151921` | Card fills |
| `surface.cardAlt` | `#1C212B` | Nested cards, input fills |
| `surface.overlay` | `rgba(12,15,20,0.85)` | Modal/sheet backdrop |
| `surface.sheet` | `#1A1F29` | Bottom-sheet fill |

### Borders

| Token | Value | Usage |
|---|---|---|
| `border.subtle` | `rgba(255,255,255,0.06)` | Card outlines |
| `border.default` | `rgba(255,255,255,0.12)` | Dividers, button outlines |
| `border.strong` | `rgba(255,255,255,0.24)` | Focus borders |
| `border.focus` | `#6366F1` | Input focus |

### Text (AAA on `surface.base`)

| Token | Hex | Ratio | Usage |
|---|---|---|---|
| `text.primary` | `#F1F5F9` | 14.6:1 (AAA) | Headings, body |
| `text.secondary` | `#CBD5E1` | 10.2:1 (AAA) | Descriptions, metadata |
| `text.tertiary` | `#94A3B8` | 5.8:1 (AA large) | Placeholders, helper text |
| `text.quaternary` | `#64748B` | 3.7:1 (UI large only) | Muted timestamps |
| `text.onPrimary` | `#FFFFFF` | — | Text on `indigo.500` buttons |
| `text.disabled` | `rgba(241,245,249,0.38)` | — | Disabled button labels |

### Primary (Indigo)

| Token | Hex | Usage |
|---|---|---|
| `indigo.500` | `#6366F1` | **CANONICAL PRIMARY.** Buttons, active tabs, focused inputs |
| `indigo.400` | `#818CF8` | Accents on dark (small icons, text links, progress glow) |
| `indigo.700` | `#4338CA` | Tactile button bottom slab |
| `indigo.300` | `#A5B4FC` | Chips, subtle accents |
| `indigo.100` / `200` / `300` | — | Reserve for rare tint moments |

### Semantic

| Token | Base | Tint | Border | Usage |
|---|---|---|---|---|
| `success` | `#22C55E` | `rgba(34,197,94,0.15)` | `rgba(34,197,94,0.35)` | Correct, completed |
| `error` | `#EF4444` | `rgba(239,68,68,0.15)` | `rgba(239,68,68,0.40)` | Incorrect, destructive |
| `warning` | `#F59E0B` | `rgba(245,158,11,0.15)` | `rgba(245,158,11,0.35)` | Review needed, warnings |
| `streak` | `#F59E0B` (base) / `#F97316` (fire) | `rgba(245,158,11,0.18)` | — | Streak counters + fire animation |
| `premium` | `#A855F7` | `rgba(168,85,247,0.18)` | — | Super tier, pro moments |

### League Tiers

Bronze `#CD7F32` · Silver `#C0C0C0` · Gold `#FFD700` · Platinum `#A78BFA` · Diamond `#38BDF8`

### Hearts

Filled: `#EF4444` · Empty: `#64748B`

### Correction-banner error-type chips

grammar · vocabulary · spelling · word_order · tense · gender · other — see `colors.correctionChip.*` in `config/theme.ts`.

---

## Typography

Font families (loaded via `@expo-google-fonts`):
- `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`
- `PlayfairDisplay_700Bold` — **display only**, used by `<Hero>` on celebration screens

Use the typography primitives from `components/ui/Text.tsx`:

```tsx
<Heading level={1}>Learn</Heading>        // 28/34 Bold
<Heading level={2}>Spanish A2</Heading>   // 24/30 Bold
<Heading level={3}>Unit 4</Heading>       // 22/28 Semibold
<Body size="lg">Option text</Body>         // 17/25 Semibold
<Body>Message content</Body>               // 16/24 Regular
<Body size="sm">Helper text</Body>         // 14/20 Regular
<Caption>Stat label</Caption>              // 13/18 Medium
<Caption size="sm">Badge text</Caption>    // 12/16 Medium
<Hero>Nailed it!</Hero>                    // 32/38 PlayfairDisplay 700 (celebration only)
```

Tones: `primary` (default) / `secondary` / `tertiary` / `onPrimary` / `accent` / `success` / `error` / `warning`.

**Never** use raw `<Text>` with inline `fontSize` / `color`. Dynamic Type must be supported end-to-end.

---

## Spacing (4-8pt grid)

```ts
spacing.xxs   =  4
spacing.xs    =  8
spacing.sm    = 12
spacing.md    = 16
spacing.lg    = 24
spacing.xl    = 32
spacing.xxl   = 48
spacing.xxxl  = 64
```

---

## Border Radius

```ts
radii.sm    =  8   // badges, chips
radii.md    = 12   // inputs
radii.lg    = 14   // buttons, standard cards
radii.xl    = 16   // large cards
radii.xxl   = 20   // exercise cards, hero cards
radii.pill  = 999  // fully rounded
```

---

## Motion

```ts
motion.duration.instant     = 100  // tap feedback
motion.duration.micro       = 150
motion.duration.short       = 200  // default
motion.duration.medium      = 300  // sheets, cards
motion.duration.long        = 450
motion.duration.celebration = 600
```

Easing curves: `standard` / `decelerate` / `accelerate` / `emphasized` / `backOut` — see `config/theme.ts`.

**Rules:**
1. Use `useMotion()` — never raw `AccessibilityInfo.isReduceMotionEnabled` in components.
2. Never animate infinitely except: loading spinners, streak fire (streak ≥7).
3. Button press = 100ms + haptic light. No exceptions.
4. Screen transitions follow navigator defaults (no custom unless celebration).

---

## Haptics

Use `expo-haptics`:
- `Haptics.selectionAsync()` — selection/tap
- `Haptics.impactAsync(Light)` — button press
- `Haptics.impactAsync(Heavy)` — milestone (level up, streak milestone)
- `Haptics.notificationAsync(Success)` — correct answer, lesson complete
- `Haptics.notificationAsync(Error)` — incorrect answer

All haptics fire regardless of Reduce Motion (they are not motion) but respect the app's mute toggle (see `hooks/useSound.ts` once built).

---

## Components

### Surface (replaces GradientBackground)

```tsx
<Surface variant="base">      // dark #0C0F14
<Surface variant="raised">    // dark #12161D — reading/focus
<Surface variant="card">      // #151921
<Surface variant="cardAlt">   // #1C212B
```

> `<GradientBackground>` is a backward-compatible alias — new code should use `<Surface>` directly.

### TactileButton (canonical CTA)

Duolingo-style slab button with a darker bottom edge that collapses on press, paired with a light haptic.

```tsx
<TactileButton label="Continue" />                    // primary, full width
<TactileButton label="Skip" variant="secondary" />
<TactileButton label="End" variant="danger" />
<TactileButton label="Learn more" variant="ghost" />
```

Size: `md` (44px) / `lg` (56px, default). Always use for primary/secondary CTAs — never raw `<Pressable>` for main actions.

### Chip

Small pill with optional left icon.

```tsx
<Chip label="GRAMMAR" variant="primary" />
<Chip label="DIAMOND" variant="premium" />
<Chip label={`${streak}d`} variant="streak" leftIcon={<Ionicons name="flame" />} />
```

### Sheet

Bottom-anchored modal for feedback / pickers / mini-forms.

```tsx
<Sheet visible={open} onDismiss={() => setOpen(false)}>
  {/* content */}
</Sheet>
```

### CelebrationOverlay

Full-screen reward moment — mascot + confetti + headline + optional CTA.

```tsx
<CelebrationOverlay
  visible={showWin}
  mood="lessonComplete"
  title="Nailed it!"
  subtitle="+35 XP"
  ctaLabel="Continue"
  onDismiss={next}
/>
```

Moods: `correct` / `lessonComplete` / `streakMilestone` / `levelUp`. Motion auto-gates Reduce Motion.

### Mascot

```tsx
<Mascot state="happy" size="md" />
```

States: `idle` / `happy` / `thinking` / `cheering` / `sad` / `disappointed`. Sizes: `xs` (32) / `sm` (48) / `md` (80) / `lg` (128). Static SVG today; Rive upgrade deferred.

### ScreenHeader

```tsx
<ScreenHeader title="Learn" subtitle="Spanish · Beginner" onBack={router.back} />
```

---

## Layout

- Every screen wrapped in `<Surface>` (or compatible `<GradientBackground>` alias).
- `SafeAreaView` inside `<Surface>` where the status bar / home indicator matter.
- Forms use `KeyboardAvoidingView` (iOS: `behavior="padding"`, `keyboardVerticalOffset={90}`).
- Tabs stay visible; never push content behind the tab bar.

---

## Accessibility Mandatory

Every PR must pass:

- [ ] VoiceOver/TalkBack — every interactive element has `accessibilityRole` + `accessibilityLabel`
- [ ] Reduce Motion honored via `useMotion()`
- [ ] Touch targets ≥ 44×44 pt (iOS) / 48×48 dp (Android)
- [ ] Body text contrast ≥ 7:1 (AAA) against `surface.base`
- [ ] Color-blindness safety: correct/incorrect = icon + text + color, never color alone
- [ ] Dynamic Type tested at 200% (iOS XXL)

---

## What We Retired

| Old primitive | Replacement | Notes |
|---|---|---|
| Looping video background | Solid `surface.base` / `surface.raised` | Mayer coherence; Apple HIG compliance |
| `GradientBackground` (video) | `<Surface>` (identical API alias remains) | Backward compat — zero screen changes needed |
| `GlassSurface` 6-layer chromatic | 2-layer dark fill + hairline border | Same API; visually flat |
| `GradientButton` | `<TactileButton variant="primary">` | Slab + haptic instead of gradient |
| `AnimatedGalaxy` | Static starfield SVG (welcome/celebration only) | Decorative motion retired from chrome |
| Ad-hoc `<Text fontSize={…}>` | `<Heading>`, `<Body>`, `<Caption>`, `<Hero>` | Scale enforced centrally |

---

## Migration Path

When editing any existing screen:

1. Swap raw colors → `colors.*` tokens
2. Swap raw `<Text>` → typography primitives
3. Swap primary/secondary CTAs → `<TactileButton>`
4. Swap error-banner style strings → `<Chip variant="...">`
5. Gate animations behind `useMotion()`
6. Wrap with `<Surface variant="base">` or `<Surface variant="raised">` as appropriate

---

## Magazine Home (Phase 1)

### Deep Nebula Palette

| Token | Value | Usage |
|---|---|---|
| `magazine.nebulaTop` | `#0a0520` | Aurora base top |
| `magazine.nebulaMid` | `#1a0a3e` | Aurora base mid |
| `magazine.accentBlue` | `#4F8EF7` | Active tab gradient start, links |
| `magazine.accentViolet` | `#7C3AED` | Active tab gradient end |
| `magazine.accentLilac` | `#A855F7` | Kickers, premium accents |
| `magazine.heartsCoral` | `#FF6B6B` | Hearts pill |
| `magazine.xpGold` | `#FFB547` | XP pill |
| `magazine.streakFlame` | `#FF8A3D` | Streak pill |
| `magazine.glassBg` | `rgba(20,25,50,0.5)` | Magazine glass card fill |
| `magazine.glassBorder` | `rgba(255,255,255,0.10)` | Magazine glass card border |

### Font Roles

| Family | Token | Usage |
|---|---|---|
| Georgia (system) | `typography.family.serif` | Headlines, section titles, big numbers |
| JetBrains Mono | `typography.family.mono` / `monoMedium` | Date labels, meta text, stat values, duration pills |
| Inter | (existing) | Body text, UI labels |

### Floating Glass Pill Tab Bar

- `<FloatingTabBar />` — custom `tabBar` for Expo Router `<Tabs>`
- Positioned absolute, centered, `bottom: safeArea + 12`
- BlurView pill (iOS) / semi-transparent fallback (Android)
- 4 icons: Home, Learn, Chat, Profile — no labels
- Active icon: gradient circle (`#4F8EF7` → `#7C3AED`)
- Width: 240px, height: 56px, borderRadius: 999

### MagazineGlassCard

- `expo-blur` BlurView (intensity 40, tint "dark") on iOS
- Semi-transparent fallback on Android
- Fill: `magazine.glassBg`, border: 0.5px `magazine.glassBorder`, radius: 20
- Used by all magazine-style cards on the home screen

### Home Screen Layout (top to bottom)

1. `<DateLabel />` — JetBrains Mono, uppercase, letterSpacing 3
2. `<StatsStrip />` — 3 glass pills (streak/XP/hearts)
3. `<NewsHeroCard />` — editorial news with Georgia serif headline
4. `<SessionBand />` — play button + today's session
5. `<LessonTileGrid />` — 2-column continue learning tiles
6. `<MagazineDailyChallenges />` — "Your daily three"
7. `<WeekInWords />` — big serif number + 7-day dot grid
8. `<OnboardingChecklist />` — new users only (unchanged)
9. Quick Actions — restyled with MagazineGlassCard

---

## UX Psychology Principles

Source: *"The UX Psychology Behind Apps People Can't Stop Using"* — uxpeak (YouTube, 11:34, `2TlIg3VokY8`).
These are **behavioral rules**, not visual tokens. They govern flow design (onboarding, paywall, review queue, upgrade prompts), not colors or spacing. Nothing here overrides §Accessibility or §Core Principles.

**Status:** all six implemented. The "Fluenci surfaces" lines below record where each principle landed; surfaces marked *(backlog)* are identified but not yet built.

The structural change all six depend on: **onboarding now runs before authentication.** Answers live in `lib/pending-onboarding.ts` (AsyncStorage, 7-day TTL) until a session exists, at which point `app/(public)/onboarding.tsx` flushes them into the profile and clears the draft. The root route guard in `app/_layout.tsx` was not modified — onboarding remains its destination and simply gained a pre-auth mode.

### 1. Smart Defaults — kill decision fatigue

More options lowers completion, it doesn't raise it. Cited research: a jam-tasting study where a 24-flavor display converted ~3% of shoppers vs ~30% for a 6-flavor display. In most products 70–90% of users never touch a default value — a default reads as a *recommendation*, not a blank.

**Rule:** pre-select the most common choice in every field. Never ship an empty form when the answer is guessable. Shift the user's job from "fill this out" to "scan and adjust."

Also: put the outcome on the CTA. "Search" → "See 12 results."

Fluenci surfaces: placement test (pre-select likely CEFR from prior answers), daily-goal picker, new-cards-per-day setting (default 20), reminder-time picker, classroom-assignment creation form (teacher side), language pair.

### 2. Goal Gradient — never start at zero

Cited research: a car-wash loyalty card needing 8 stamps completed at roughly double the rate when presented as a 10-stamp card with 2 already filled. Same real work, different perceived distance. The closer the finish line feels, the faster people move. **You choose where the starting line is.**

**Rule:** no progress indicator ever renders at 0%. Find something the user already did and count it (account created, language picked, placement test taken). LinkedIn's profile-strength meter is the canonical example — it is never empty.

Fluenci surfaces: onboarding checklist (`<OnboardingChecklist />` — count signup + placement test as complete on first paint), unit/lesson progress rings, profile completeness, streak calendar, teacher classroom setup.

### 3. Reciprocity — give value before asking for anything

Free samples can lift purchase rate dramatically; receiving something first creates an unconscious debt. Cialdini rates reciprocity the strongest single driver of compliance. Gating results behind a signup wall reads as holding the user's own output hostage.

**Rule:** deliver a genuinely useful partial result *before* the account or paywall gate. Then offer to save/extend it. The gate should feel like preserving value already received, not paying an entry toll.

Fluenci surfaces: placement test → show CEFR level + strengths/gaps **before** signup, then "save your level"; first lesson playable anonymously; free AI chat turns before quota prompt; writing feedback shows top corrections free, full rubric on upgrade; reading passage first page free.

Anti-pattern to avoid: "Create an account to see your results."

### 4. IKEA / Endowment Effect — let them build before they commit

People value what they built more than an identical thing handed to them; merely *feeling* ownership is enough. A bare email/password screen contains nothing the user would lose by closing the tab.

**Rule:** front-load creation and personalization ahead of the signup screen. Label the button **Continue**, not Sign up — by then leaving means abandoning something they made. Duolingo's model: language chosen, goal set, first lesson done, *then* account.

Fluenci surfaces: pre-auth onboarding — pick language, pick goal, name/customize avatar or mascot, complete lesson 1; teacher onboarding — build the classroom (name, color, subject) before org signup.

### 5. Loss Aversion & Status Quo Bias — frame the cost of inaction

Kahneman: losing something hurts roughly twice as much as gaining the same thing feels good. A screen selling what the user *could* gain uses the weaker motivator; showing what they're about to lose engages loss aversion plus the instinct to protect what's already held.

**Rule:** for act-now screens, show concrete, named, already-owned things at risk — not abstract feature lists.

Fluenci surfaces: streak at risk (name the exact streak count and day), hearts depleting, "your 340 review cards go overdue tonight," downgrade flow listing what's lost, teacher trial expiry naming the actual classrooms.

**Ethical boundary — binding, not optional.** The video's example uses a manufactured countdown and a shaming dismiss label ("I'll risk it"). Fluenci does **not** ship that. Constraints:
- Every stated loss must be **factually true** and already-owned by the user (a real streak, real cards, real files). No invented scarcity, no fake countdowns.
- Dismiss options stay neutral ("Not now"). No guilt-labeled escape hatches.
- No loss framing in learner-facing streak/hearts UI aimed at minors or in B2B/classroom contexts.
- Apple 3.1 / App Store review and the EU DSA both scrutinize manipulative subscription prompts. A dark pattern here is a rejection risk, not just an ethics one.

### 6. Contrast Effect — control the anchor

The brain evaluates a number relative to whatever it processed immediately before. $50 in isolation reads as $600/year; $50 shown directly under a $1,900 cart item, labeled "just 2.6%," barely registers. Menus anchor with an expensive item; agents show an overpriced house first.

**Rule:** never display a price in isolation. Control what the user sees first, because that first number becomes the ruler for everything after.

Fluenci surfaces: paywall — anchor on annual total or on a tutor-cost comparison before showing monthly; show annual plan first with per-month equivalent; B2B seat pricing anchored against per-student tutoring cost; XP/gem costs anchored against a larger balance.

### Applying These

- These principles govern **flow and copy**, so they mostly land in `app/(public)/` onboarding, paywall screens, and `components/gamification/`.
- Any implementation still obeys §Motion, §Accessibility, and the token system. A psychology win never justifies a raw hex or an ungated animation.
- Loss-aversion and contrast work touches paywall/subscription surfaces → route through security/compliance review before shipping.
- Underlying insight from the source: users decide relative, not absolute. Defaults read as advice, the first number sets the scale, a gift creates obligation, building creates ownership, and visible progress creates momentum even when granted.

---

**Last updated:** 2026-07-27 (UX Psychology Principles documented — not yet implemented).
