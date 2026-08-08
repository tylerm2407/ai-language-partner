# languageAI / Fluenci Design System

**Canonical source of truth.** All UI changes must conform. Do not introduce new colors, spacing values, or component patterns outside of the approved token set in `config/theme.ts`.

> **Phase 0 status:** foundation primitives + theme tokens are live; per-screen rollout in progress. See [`redesign-plan.md`](./docs/strategy/redesign-plan.md) for phasing and [`design-research.md`](./docs/strategy/design-research.md) for the empirical/industry research anchoring every decision.

---

## Core Principles

1. **Canonical theme is MONOCHROME** — black, charcoal, silver, grey. Surface.base `#08090A` is the default screen background. Reading/lesson/review surfaces step up to `surface.raised` (`#0E0F11`) for focus.
2. **The CTA is the brightest thing on the screen.** `action.primaryFill` is near-white `#F2F4F6` carrying a near-black label at **18.1:1**. With no hue to lean on, hierarchy is built entirely from lightness — and the highest-contrast element in the composition is always the primary action. This is what stops greyscale from reading as drab.
3. **Motion is earned.** No global animation in chrome. Animation appears in (a) state transitions, (b) micro-feedback (≤200ms), (c) celebration moments. Everything else is static.
4. **Every animation gates `useMotion().shouldReduce`.** Honor `AccessibilityInfo.isReduceMotionEnabled` without exception. App Store accessibility criterion.
5. **Body text is WCAG AAA.** `text.primary` (`#F7F8F9`) is 18.7:1 against `surface.base`. Never pure white on pure black (halation) — which is why `text.primary` stops short of `#FFFFFF` even though the palette is greyscale.
6. **Color is never the only signal.** Correct/incorrect always paired with icon + text label. WCAG SC 1.4.1.
7. **Exactly two hues exist.** `success` (correct) and `error` (incorrect, hearts) — nothing else. Streak, warning, premium, league tiers, achievements, mistake categories and unit tiles are all greyscale, separated by lightness plus their own icon and label. Adding a third hue is a design change, not a detail.
8. **8pt grid.** Spacing values are 4, 8, 12, 16, 24, 32, 48, 64.
9. **Three typographic roles.** Display/editorial (Fraunces — `600` for headlines, `700` for `<Hero>` celebration), UI and body (Nunito 400/500/600/700/800), meta labels (JetBrains Mono — eyebrows, dates, counts, durations).
10. **One mascot.** Consistent across celebration states; static SVG today, Rive state-machine in a future phase.

---

## Source of Truth

All tokens are defined in **`config/theme.ts`** and imported by every component. **Never hard-code hex values in screens or components.** If you need a new token, add it to `config/theme.ts` first.

```ts
import { colors, spacing, radii, typography, motion, elevation } from '../../config/theme';
```

---

## Color Palette

### Surfaces (monochrome charcoal)

| Token | Hex | Usage |
|---|---|---|
| `surface.base` | `#08090A` | Primary app background (home, chat, practice, profile) |
| `surface.raised` | `#0E0F11` | Reading / lesson / review screens — focus surface |
| `surface.sunken` | `#050506` | Behind-content wells, inset tracks |
| `surface.card` | `#141618` | Card fills — **opaque** |
| `surface.cardAlt` | `#1C1F22` | Nested cards, input fills |
| `surface.overlay` | `rgba(5,5,6,0.86)` | Modal/sheet backdrop, celebration scrim |
| `surface.sheet` | `#141618` | Bottom-sheet fill |

Neutral, with a very slight cool cast. The steps are **wider** than the previous
palette's on purpose: in a system with no hue, crispness comes from clearly
separated surfaces plus hairlines you can actually see. A tint-based palette can
get away with 4-point steps because the colour carries the separation; this one
cannot.

### Ambient light

Two layers, both static, both silver.

**1. The wash** — `components/ui/GradientBackground.tsx` renders one
top-anchored radial wash behind screen content.

| Property | Value |
|---|---|
| Tint | `glow.silver` `#E2E6EA` |
| Peak alpha | `0.09` |
| Height | 320, anchored 45% above the top edge |
| Horizontal overscan | 1.6× window width, so the falloff sits off-screen |
| Motion | **none** |

**2. Stat blooms** — `<StatBloom />` from the same module, a soft halo placed
*behind* a numeral.

| Property | Value |
|---|---|
| Tint | `glow.bloom` `#F2F4F6` |
| Default size / intensity | `90` / `0.16` |
| Used by | `StatsStrip` (streak, XP) at size `54` |

The bloom exists because the palette has no accent colour to say "this number
matters". Emphasis is carried by light instead. Use it on figures the learner is
meant to notice — never as background decoration, and never more than two or
three to a screen, or it stops meaning anything.

Rules:
- **Never stack two wash layers.** `GradientBackground` (or a single
  `GlowLayer`) per screen — two layers compound alpha.
- **Nothing here animates.** Chrome motion is retired (§Motion rule 2), so
  neither layer gates on Reduce Motion — both are static for every user.
  `GlowLayer` and `GlowBackground` still accept a `drift` prop; it is ignored,
  and kept only so the screens that pass `drift={false}` keep compiling.
- Both are radial gradients with a soft stop ramp, **not** blurred views. A
  full-screen `BlurView` under every screen costs Android scroll frames for no
  visual gain on an already-soft shape.
- Both are `pointerEvents="none"` and carry **no** `zIndex`. React Native paints
  siblings in declaration order and treats a sibling without `zIndex` as 0, so a
  positive `zIndex` would put the glow *over* the content it sits behind. They
  must be declared **first** inside their parent.

### Borders

Neutral white alpha, stepped up from the previous palette. On pure charcoal a
`0.07` hairline disappears, and the crisp look depends on edges being visible.

| Token | Value | Usage |
|---|---|---|
| `border.subtle` | `rgba(255,255,255,0.08)` | Card outlines |
| `border.default` | `rgba(255,255,255,0.15)` | Dividers, button outlines |
| `border.strong` | `rgba(255,255,255,0.28)` | Focus borders |
| `border.focus` | `#F2F4F6` | Input focus |

### Text (AAA on `surface.base`)

| Token | Hex | Ratio | Usage |
|---|---|---|---|
| `text.primary` | `#F7F8F9` | 18.7:1 (AAA) | Headings, body |
| `text.secondary` | `#B4B9BF` | 10.1:1 (AAA) | Descriptions, metadata |
| `text.tertiary` | `#80868C` | 5.4:1 (AA) | Placeholders, helper text |
| `text.quaternary` | `#5C6166` | 3.2:1 (UI large only) | Muted timestamps |
| `text.onPrimary` | `#08090A` | 18.1:1 on `action.primaryFill` | Text on filled CTAs — **dark, not white** |
| `text.onSuccess` | `#052B10` | 6.1:1 on `success.base` | Text on success fills |
| `text.onWarning` | `#08090A` | — | Warning is greyscale; dark label on it |
| `text.disabled` | `rgba(247,248,249,0.38)` | — | Disabled button labels |

### Primary (Silver) — fills vs accents

The polarity is the same trap brass had, and it bites harder here: the primary
fill is **light**, so a filled CTA carries a **near-black** label. White on
`#F2F4F6` is 1.1:1 — invisible. Any new light background must be checked.

| Token | Hex | Usage |
|---|---|---|
| `action.primaryFill` | `#F2F4F6` (silver.100) | **All solid CTA fills.** `text.onPrimary` on it is 18.1:1 |
| `action.accent` | `#C9CDD2` (silver.300) | Text links, small icons, spinners, progress (12.5:1) |
| `action.primaryTint` | `rgba(242,244,246,0.10)` | Selected-row fills, icon-circle backgrounds |
| `silver.200` | `#E2E6EA` | Emphasis numerals, streak (15.5:1) |
| `silver.400` | `#ADB3BA` | 9.4:1 |
| `silver.500` | `#8C9198` | 6.3:1 |
| `silver.700` | `#4E5257` | **Disabled CTA fill** — needs a light label, not `text.onPrimary` |
| `silver.800` | `#33373B` | Tracks, dividers |
| `action.primarySlab` | `#ADB3BA` | **Deprecated.** Slab CTAs are retired |

`colors.brass.*` and `colors.indigo.*` survive as **deprecated aliases** onto the
silver ramp, so call sites from either previous palette compile and pick up the
current one instead of silently staying gold or violet. Migrate to
`colors.silver.*`.

### Semantic

| Token | Base | Tint | Border | Usage |
|---|---|---|---|---|
| `success` | `#3FB950` | `rgba(63,185,80,0.14)` | `rgba(63,185,80,0.32)` | Correct, completed |
| `error` | `#F85149` | `rgba(248,81,73,0.14)` | `rgba(248,81,73,0.34)` | Incorrect, destructive |
| `warning` | `#E2E6EA` | `rgba(226,230,234,0.12)` | `rgba(226,230,234,0.30)` | Review needed — **greyscale** |
| `streak` | `#E2E6EA` (base) / `#F2F4F6` (fire) | `rgba(226,230,234,0.12)` | — | Streak counters — **greyscale** |
| `premium` | `#FFFFFF` | `rgba(255,255,255,0.12)` | — | Super tier, pro moments |

`success` and `error` are the **only** hues in the system, and they exist because
grading feedback is the one place in a learning app where colour does real work.
Both are the GitHub dark-UI pair — engineered for this job: legible on
near-black, distinguishable under the common colour-vision deficiencies, and
unsaturated enough not to fight a greyscale system.

Small text uses the `.light` step (`success.light` `#56D364` 10.3:1,
`error.light` `#FF7B72` 7.9:1); the bases are for fills and icons. The **`danger`
CTA fill is `error.dark`** `#C93C34`, which clears 5.0:1 under a white label
where `error.base` would not.

`warning` and `streak` are deliberately colourless. A third hue would break rule
7, and both always ship with an icon and a label that carry the meaning. Premium
is pure white — in a monochrome system the brightest possible value *is* the most
valuable one.

### League Tiers

Rank maps to **brightness**, not to metal colour, so the ladder is legible at a
glance without five competing hues.

Bronze `#6B7076` · Silver `#8C9198` · Gold `#ADB3BA` · Platinum `#C9CDD2` · Diamond `#F2F4F6`

The same rule governs `LevelBadge` (beginner → advanced) and the `LessonTile`
unit gradients: dimmest to brightest, in rank order.

### Hearts

Filled: `#F85149` · Empty: `#4E5257`

Hearts keep red. They are a depletable resource, and depletion is the one place
the app wants an involuntary reaction.

### Correction-banner error-type chips

**All seven types render identically** — `rgba(255,255,255,0.07)` fill, `#C9CDD2`
label. The chip already prints its type as text ("GRAMMAR", "WORD ORDER"), so hue
was encoding nothing the label did not already say; it was seven decorative tints
on a single banner. Severity is carried by the banner border — see §CorrectionBanner.

---

## Typography

Font families (loaded via `@expo-google-fonts`):
- **Nunito** — `Nunito_400Regular`, `_500Medium`, `_600SemiBold`, `_700Bold`, `_800ExtraBold`.
  The UI/body face. Rounded terminals read friendlier than Inter, and lighter at
  the same numeric weight — which is why the scale below runs one step heavier
  than a geometric sans would.
- **Fraunces** — `Fraunces_600SemiBold` (`typography.family.serif`) for magazine
  editorial headlines, `Fraunces_700Bold` (`family.display`) for `<Hero>` on
  celebration screens.
- **JetBrains Mono** — `JetBrainsMono_400Regular` / `_500Medium` for eyebrows,
  date labels, counts, durations.

Never pair a custom `fontFamily` with `fontWeight` — the face already carries the
weight, and Android then synthesizes a second bolding pass on top of it.

Use the typography primitives from `components/ui/Text.tsx`:

```tsx
<Heading level={1}>Learn</Heading>        // 28/39 ExtraBold, ls -0.6
<Heading level={2}>Spanish A2</Heading>   // 24/33 ExtraBold, ls -0.6
<Heading level={3}>Unit 4</Heading>       // 22/31 Bold
<Body size="lg">Option text</Body>         // 17/25 Bold
<Body>Message content</Body>               // 16/24 Medium
<Body size="sm">Helper text</Body>         // 14/20 Medium
<Caption>Stat label</Caption>              // 13/18 Semibold
<Caption size="sm">Badge text</Caption>    // 12/17 Semibold
<Hero>Nailed it!</Hero>                    // 32/40 Fraunces 700 (celebration only)
```

Tones: `primary` (default) / `secondary` / `tertiary` / `onPrimary` / `accent` / `success` / `error` / `warning`.

**Never** use raw `<Text>` with inline `fontSize` / `color`. Dynamic Type must be supported end-to-end.

### Line height is not a free parameter

A `lineHeight` below the face's natural line box does not compress the text — iOS
(`RCTTextAttributes.mm`) and Android (`TextAttributes.kt`) both pin the baseline
and clip the **ascender**, so the top of the glyphs is cut off. Every step in the
scale is `>= minLineHeight(fontSize, face)`; `config/theme.test.ts` enforces it.

`leading` in `config/theme.ts`, read from the font binaries. All three faces set
OS/2 `fsSelection` bit 7 (USE_TYPO_METRICS), so layout uses the typo metrics —
which here equal hhea — and not the larger `usWin*` pair:

| Face | typo / hhea | usWin* | capHeight |
|---|---|---|---|
| Nunito | **1.364em** | 1.377 | 0.705 |
| Fraunces | **1.233em** | 1.474 | 0.700 |
| JetBrains Mono | **1.320em** | 1.320 | — |

Use `minLineHeight(fontSize, face)` for any size not in the scale. The one
sanctioned exception is text that is *provably* digits-or-capitals only — those
stop at capHeight and have ~0.3em of headroom (see `WeekInWords.bigNumber`, which
documents why it sits under the bound). Never assume it for user or AI content.

Both platforms scale explicit `lineHeight` by the font-size multiplier, so a
correct *ratio* stays correct at every Dynamic Type size. Getting the ratio right
is what makes accessibility scaling safe — there is no per-device font math.

### Adapting to screen size

`hooks/useDisplayScale.ts` scales **display type only** against a 390pt baseline
window, clamped to `[0.88, 1.10]`. `<Heading>` and `<Hero>` apply it so page
titles keep their line count on a 320pt phone and don't look lost on a 430pt one.

Body, caption and mono steps deliberately do **not** width-scale — iOS governs
reading size through Dynamic Type, and overriding that per-device fights the
platform and hurts accessibility. Width scaling here is for headline fit, not
readability. The clamp is narrow on purpose: unbounded scaling turns a tablet
into a billboard.

`<Heading>`/`<Hero>` floor the scaled lineHeight at `minLineHeight(scaledSize)`,
so the no-clip invariant holds at every width, not just at baseline.

Screens must take their top inset from `SafeAreaView edges={['top']}` (the app
convention) or `useSafeAreaInsets()`. A screen that renders a title against the
physical top of the window is cut off by the status bar and Dynamic Island.

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
<Surface variant="base">      // charcoal #08090A
<Surface variant="raised">    // charcoal #0E0F11 — reading/focus
<Surface variant="card">      // #141618
<Surface variant="cardAlt">   // #1C1F22
```

> `<GradientBackground>` is a backward-compatible alias — new code should use `<Surface>` directly.

### TactileButton (canonical CTA)

**Flat.** A single filled pill with an optional hairline border; on press it
scales to 0.96 and drops to 90% opacity, paired with a light haptic.

It used to be a Duolingo-style slab — the fill sitting on a darker bottom edge
that collapsed on press. That slab was the single strongest visual tell tying the
app to Duolingo and is retired. The component name and its whole prop surface are
unchanged, so no call site moved.

`primary` is a near-white silver fill with a **near-black** label. `danger` is `error.dark`
with a light label (see §Semantic for why not `error.base`).

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

### Mascot — the dragon, at moments only

```tsx
<Mascot state="happy" size="md" />
```

States: `idle` / `happy` / `thinking` / `cheering` / `sad` / `disappointed`. Sizes: `xs` (32) / `sm` (48) / `md` (80) / `lg` (128). Static SVG today; Rive upgrade deferred.

**Placement is a hard rule, not a preference.**

| Allowed | Forbidden |
|---|---|
| Celebration overlays (`CelebrationOverlay`, level-up, streak milestone) | Home header |
| Empty states | Chat header |
| Onboarding / pre-permission sheets | Tab bar |
| Streak-at-risk and out-of-hearts moments | Any persistent chrome |

The Duolingo tell is a mascot living in **permanent chrome**, not a mascot
existing. A character in the header is the same silhouette whatever the
character is, and it also spends the screen's most animated element on a surface
where nothing is being celebrated. Keeping the dragon to moments makes each
appearance an event, which is where its animation budget is worth spending.

Chrome placements were removed from `app/(app)/index.tsx` and
`app/(app)/chat/index.tsx` during the Studio Graphite migration. Do not reintroduce
them.

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
| Looping video background (`nebula-bg.mp4`) | `<GlowBackground>` blob layer | Removed a 1.9MB asset + an `expo-av` player from every screen |
| `AuroraBackground` | `GlowBackground` (via `GradientBackground`) | Deleted; `GradientBackground` keeps the same API |
| `GradientBackground` (video) | `<Surface>` (identical API alias remains) | Backward compat — zero screen changes needed |
| `GlassSurface` 6-layer chromatic | Opaque `surface.card` + hairline border | Same API; visually flat |
| `BlurView` glass (cards, tab bar, stat pills) | Opaque `surface.card` + 1px border | See "There is no glass" |
| Light-theme reading surfaces | `surface.raised` + dark tokens | The book reader and comprehension flow were a white island in a dark app |
| Sky `#38BDF8` chrome accent (teacher side) | `action.accent` `#E0BE6B` | Sky survives only as a *product* color, retuned to `#86B4CE`: `PathNode` active, `LevelBadge` intermediate, diamond league, one unit-tile gradient |
| `GradientButton` | `<TactileButton variant="primary">` | Slab + haptic instead of gradient |
| `AnimatedGalaxy` | Static starfield SVG (welcome/celebration only) | Decorative motion retired from chrome |
| Ad-hoc `<Text fontSize={…}>` | `<Heading>`, `<Body>`, `<Caption>`, `<Hero>` | Scale enforced centrally |
| **Slab CTA** (`TactileButton` bottom edge) | Flat pill + 0.96 press scale | The strongest single Duolingo tell. `action.primarySlab` and `elevation.tactile` are deprecated shims |
| **Indigo brand** (`#6366F1` / `#4F46E5` / `#818CF8`) | Brass (`#C8A24A` / `#E0BE6B`) | `colors.indigo.*` is a deprecated alias onto the brass steps |
| **Three drifting glow blobs** | One static top wash | Removed the theme's decorative signature and all chrome motion; `drift` prop is now ignored |
| **Mascot in chrome** (Home + chat headers) | Moments only — see §Mascot | A permanent mascot is the Duolingo silhouette regardless of the character |
| **Chip scoreboard** (streak / XP / hearts pills) | Mono meta row — `7 DAY · 1,240 XP` | Three saturated pills under the greeting *was* the Duolingo header |
| Rainbow unit-tile gradients | Six tonal one-hue pairs | Two-hue sweeps read as a consumer game |
| Saturated semantics (`#22C55E` / `#EF4444` / `#F59E0B`) | Desaturated jade / clay / amber | A traffic light next to a gold accent |
| White labels on primary fills | `text.onPrimary` `#14120E` | Polarity inverted — brass is a *light* fill. Fixed at 8 call sites (reading CTAs, writing submit, record button, role switcher, word tooltip) |
| Cool greys (`#9CA3AF`, `#999`, `#64748B`, `#E2E8F0`, `#2A2F3A`, `#1E2330`, …) | Warm text scale + `surface.cardAlt` | Slate greys over warm graphite read blue |
| Sky/amber/violet accents (`#38BDF8`, `#FBBF24`, `#A78BFA`, `#60A5FA`, `#F472B6`) | `#86B4CE` / `#D9913C` / `#B497C4` / `#E0A5B6` | Achievement, league, level-badge and mistake-category colors |
| Gold streak flame (`#FFD700`) | `streak.fire` `#F0763D` | Gold is the brand accent now — a blazing streak read as a CTA |

### Monochrome migration (supersedes the brass rows above)

Brass shipped and was reviewed on device: professional, but not engaging, and it
still left stray hue on screen. The palette is now greyscale.

| Old | New | Notes |
|---|---|---|
| **Brass brand** (`#C8A24A` / `#E0BE6B`) | Silver (`#F2F4F6` / `#C9CDD2`) | `colors.brass.*` is now a deprecated alias onto the silver ramp, alongside `colors.indigo.*` |
| Warm graphite surfaces (`#0F0E0C` …) | Neutral charcoal (`#08090A` …) | Steps widened — hue no longer carries surface separation |
| Warm off-white text (`#F2EFE9` …) | Neutral greys (`#F7F8F9` …) | |
| Mauve + rose categories (`#B497C4`, `#E0A5B6`) | Silver steps | These were introduced *by* the brass migration as category hues, and were the "purple" left on screen |
| Slate blue accents (`#86B4CE`, `#A8C6DC`) | Silver steps | |
| Ember streak (`#E2673C`) and amber warning (`#D9913C`) | Greyscale | Rule 7 — icon and label carry the meaning |
| Desaturated jade / clay (`#4E9F6B` / `#C0555F`) | GitHub pair (`#3FB950` / `#F85149`) | The only two surviving hues |
| Metal league tiers | Brightness ladder | Rank = lightness, across league, `LevelBadge` and unit tiles |
| Seven tinted correction chips | One neutral chip | The type is already printed as text on the chip |
| Brass wash | Silver wash + `StatBloom` halos | Emphasis by light, since there is no accent colour |

**The palette is closed.** Every hex in `app/`, `components/`, `lib/` and
`config/` is now either a theme token or one of the documented values above. Two
deliberate exceptions:

- `components/avatar/**` — skin, hair, eye and shirt swatches are user choices
  and must stay diverse. Not part of the theme.

(`AnimatedGalaxy` and `ShinyText` used to be listed here as dead code carrying
untuned values. They have since been deleted, along with `StreakFireAnimation`,
`HeroHook`, `OutOfHeartsModal`, `components/ui/StatsBar.tsx` and the whole
`components/stats-bar/` directory — all were imported nowhere.)

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
| `magazine.nebulaTop` | `#08090A` | Base top |
| `magazine.nebulaMid` | `#141618` | Base mid |
| `magazine.accentBlue` | `#C9CDD2` | Active tab gradient start, links |
| `magazine.accentViolet` | `#8C9198` | Active tab gradient end |
| `magazine.accentLilac` | `#E2E6EA` | Kickers, premium accents |
| `magazine.heartsCoral` | `#F85149` | Hearts pill |
| `magazine.xpGold` | `#E2E6EA` | XP pill |
| `magazine.streakFlame` | `#F2F4F6` | Streak pill |
| `magazine.glassBg` | `#141618` | Editorial card fill — **opaque**, same as `surface.card` |
| `magazine.glassBorder` | `rgba(255,255,255,0.15)` | Editorial card border |

The `accentBlue` / `accentViolet` / `accentLilac` / `xpGold` / `streakFlame`
names are historical — they are silver steps now. Every gradient stop pair in `config/gradients.ts` runs *within*
one hue rather than across two.

### Font Roles

| Family | Token | Usage |
|---|---|---|
| Fraunces | `typography.family.serif` | Headlines, section titles, big numbers |
| JetBrains Mono | `typography.family.mono` / `monoMedium` | Date labels, meta text, stat values, duration pills |
| Nunito | `typography.family.*` | Body text, UI labels |

### There is no glass

**All card primitives are opaque.** `GlassSurface`, `GlassCard`,
`MagazineGlassCard`, `GradientBorderCard` and `FloatingTabBar` keep their names
for API compatibility but render `surface.card` + a 1px `border.default`. Nothing
in the app uses `BlurView`.

Depth is supplied **once**, by the glow layer behind content. Per-card
translucency competed with it and muddied the blobs; blur also cost real Android
scroll frames and forced an iOS/Android visual fork that never matched.

### Floating Tab Bar

- `<FloatingTabBar />` — custom `tabBar` for Expo Router `<Tabs>`
- Positioned absolute, centered, `bottom: max(safeArea.bottom, 16) + 12`
- Opaque `surface.card` pill, 1px `border.default` — identical on both platforms
- 4 icons: Home, Learn, Chat, Profile — no labels. Glyph *switches* on focus
  (`home-outline` → `home`), it is not just recolored
- Active icon: 40px gradient circle, `action.primaryFill` → `magazine.accentViolet`
- Width: 240px, height: 56px, borderRadius: 999, 44pt hit targets

### Home Screen Layout (top to bottom)

1. Header row — `<DateLabel />` (mono, uppercase, ls 3) + target-language
   greeting `<Heading level={2}>`. **No mascot** — see §Mascot
2. `<StatsStrip />` — mono meta row (`7 DAY · 1,240 XP`) + `<HeartsDisplay size={14} />`.
   Hearts keep their glyph row because they are a spendable resource and a count
   of shapes reads faster than a numeral; streak and XP do not
3. `<NewsHeroCard />` — editorial news with a Fraunces headline
4. `<SessionBand />` — play button + today's session
5. `<LessonTileGrid />` — 2-column continue learning tiles

The greeting comes from `targetLanguageGreeting()` in `lib/language.ts` — it
greets the learner in the language they're studying, which is a free daily dose
of comprehensible input on a string they will read every session.
6. `<MagazineDailyChallenges />` — "Your daily three"
7. `<WeekInWords />` — big serif number + 7-day dot grid
8. `<OnboardingChecklist />` — new users only (unchanged)
9. Quick Actions — restyled with MagazineGlassCard

---

## Live AI Chat

### Header (top to bottom, left to right)

`chevron-back` 22 in `text.tertiary` · `<Mascot size="xs" />` · title/status stack
· elapsed-time `<Chip variant="primary">` · controls.

The stack is `<Body weight="extrabold">` (the scenario label) over a status row: a
6px `success.base` dot plus `<Caption size="sm">` reading `Live · A2`. The dot and
the word "Live" appear only while hands-free is active.

The level is a bare CEFR code, not the deck's "Nivel A2" — "Nivel" is Spanish and
the target language varies, so localising the noun would mean 12 translations of
a word the code already conveys.

The hands-free toggle **collapses to icon-only once live**, because the status row
already says so. It keeps its "Live Voice" label while off, where it is the only
affordance advertising the feature.

### Message bubbles

- Assistant: `surface.card`, 1px `border.default`, r18 / bottom-left r4.
- Learner: `action.primaryFill`, no border, r18 / bottom-right r4.
- `maxWidth: 84%`, padding 12, copy at body/600 (`font-sans-semibold`).
- Translation renders **outside** the bubble as a caption, and stays opt-in —
  auto-translating every assistant turn would bill a translate call per message.

`<TypingIndicator />` wears the same shell as an assistant bubble: 8px dots in
`text.tertiary`, `marginHorizontal: 3`, staggered `translateY(-6)` bounce at
0/150/300ms. A bounce, not a scale pulse.

### CorrectionBanner

Fill carries the **error type** (`correctionChip[type].bg`); border carries
**severity**. The deck's lilac banner is simply the vocabulary family — it is not
a uniform tint. Severity keeps its `· MINOR` text label, which is the non-colour
cue §Accessibility requires once the fill stops encoding it.

Diff is inline: `original` struck through in `error.light` → `arrow-forward` →
`corrected` in `success.light`/extrabold. Colour stays on both halves; strike and
weight alone are weaker error cues. The action row is separated by a 1px
`border.default` hairline.

### LiveComposer

One card — `surface.card`, 1px border, r20, padding 12 — holding
`[keypad-outline 40x40 r12]` · `[waveform]` · `[mic 56x56 r28]`. Both voice
branches of `ChatInput` render it, so hold-to-talk and hands-free share a shape.

Two departures from the deck:

- It stays **in flow with margins**, not absolutely positioned. Chat is a tab
  screen, so the composer must clear the FloatingTabBar *and* live inside
  `KeyboardAvoidingView`; absolute positioning fights both.
- The 20 bars are driven by the real `meterLevel`, not the deck's fixed CSS
  shimmer. Faking amplitude on a live mic would misreport whether the app is
  hearing the learner. Idle rests at the deck's own 0.35 `scaleY` floor.

The waveform is `accessibilityElementsHidden` — the status line above the card
carries state for VoiceOver.

---

## UX Psychology Principles

Source: *"The UX Psychology Behind Apps People Can't Stop Using"* — uxpeak (YouTube, 11:34, `2TlIg3VokY8`).
These are **behavioral rules**, not visual tokens. They govern flow design (onboarding, paywall, review queue, upgrade prompts), not colors or spacing. Nothing here overrides §Accessibility or §Core Principles.

**Status:** partially implemented — the "Fluenci surfaces" lines below are a mix of what shipped and what was only identified. Treat each as a claim to verify against the code, not as a record of completed work. This section previously said "all six implemented" while the footer of this same file said "not yet implemented"; neither was accurate.

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

Fluenci surfaces: placement test → show CEFR level + strengths/gaps **before** signup, then "save your level" (**shipped** — this is the reciprocity moment); free AI chat turns before quota prompt; writing feedback shows top corrections free, full rubric on upgrade; reading passage first page free.

**Anonymous first lesson: deliberately not built, and not planned.** An earlier version of this file listed it as shipped; it never was. The decision against it (2026-08-07): every learner gets an account, because the pre-auth placement test already delivers the reciprocity payoff, while anonymous play would cost per-user rate limiting on AI endpoints, a permanent anon hole in an otherwise clean `TO authenticated` RLS posture, broken install attribution, and a second code path through `LessonRunner`. The friction actually worth removing is the ~32 taps to the first teaching moment, which is a routing and step-count problem, not an auth one.

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

**Last updated:** 2026-08-07 (monochrome palette: black/charcoal/silver/grey, two surviving hues, silver wash + StatBloom halos).

> **Known drift, stated honestly.** This document mandates typography
> primitives, `<TactileButton>` for CTAs and `<Surface>` for screens. The code
> currently runs ~899 raw `<Text>` against 69 primitives, 241 raw `<Pressable>`
> against 6 `<TactileButton>`, and 55 `<GradientBackground>` against 1
> `<Surface>`. The rules above are the target, not a description of the tree.
> The one that carries real risk is raw `<Text>`: inline font sizes do not
> scale with Dynamic Type, which `.claude/rules/mobile-ui.md` requires and
> App Review checks. Migrate high-traffic screens first.
