# Redesign Plan — Dark Cosmic + Indigo + Moderate Gamification + Mascot

**Status:** direction-locked, not yet executing.
**Rollout:** big-bang single release. ~5 weeks branched development + 1 week QA + release.
**Related reference docs:** [`design-research.md`](./design-research.md) (empirical/industry research) · [`DESIGN.md`](./DESIGN.md) (current spec — will be rewritten in Phase 0 to match these decisions).

---

## Direction Anchors (locked via user decision)

| Decision | Choice |
|---|---|
| **Aesthetic** | Dark cosmic — keep dark #0C0F14 surfaces, keep tasteful gradients/glass, **retire the looping video background**, reserve motion for reward moments |
| **Primary color** | **Indigo `#6366F1`** (DESIGN.md-canonical). On dark use brightened variants for contrast. |
| **Gamification** | **Moderate**. Streaks + hearts + XP + opt-in leagues (off by default first 14 days). Confetti + haptic + sound on every correct answer. **One new mascot character** (static illustrations in this release; Rive state-machine upgrade deferred to a follow-up release). |
| **Rollout** | **Big-bang** single release: 5 weeks dev + 1 week QA + 1 release. Parallel bugfix track. |

---

## North-Star Principles (research-grounded)

These 10 principles drive every downstream decision. Every one has citations in `design-research.md`; they are the tests every new screen must pass.

1. **Strip decorative animation from active learning surfaces.** [empirical] Mayer's Coherence Principle (*d* ≈ 0.86). Motion is reserved for reward moments — never global chrome. This is why the video background goes.
2. **Honor Reduce Motion globally.** [platform] Every animation gates on `useReducedMotion()` from `react-native-reanimated` (already a dependency) OR on `AccessibilityInfo.isReduceMotionEnabled` otherwise.
3. **Invest visual polish before feature breadth.** [empirical] Aesthetic-Usability Effect (Tractinsky 2000, replicated 2023) — polished design earns credibility tolerance.
4. **Pre-fill progress bars.** [empirical] Kivetz et al. 2006 — 20-40% completion-speed lift when bars start non-zero.
5. **Streaks with grace built in.** [empirical] Wharton/UCLA slack research + Duolingo's A/B data — streak freezes + repair windows increase retention, not decrease.
6. **One semantic color system, consistently applied.** Indigo primary / green correct / red incorrect / amber streak+warning / violet premium.
7. **Micro-celebration on every correct answer, not just lesson-end.** [industry] Duolingo fires confetti + haptic + sound per correct sentence; competitors who celebrate only at lesson-end retain worse.
8. **Delayed sign-up.** [industry] Duolingo's most famous onboarding A/B: sign-up prompted *after* first lesson, not before. ~20% DAU lift reported.
9. **Gentle notifications.** [empirical] Bidargaddi 2018 MRT: engagement lift decays with frequency; user-scheduled time outperforms fixed. 2–3/day cap, no sends after 10pm local, no guilt without humor.
10. **90-day phased aggression curve.** [empirical] Lally 2010 — habit formation averages 66 days. Days 1-14 fragile (opt-out leagues, soft copy); days 15-45 forming; days 46+ consolidated.

### Dark-mode-specific accommodations (since user chose dark over light-recommended)

Research in `design-research.md` flagged that light backgrounds win on sustained-reading evidence. Because we're committing to dark, these accommodations are **non-negotiable** to mitigate the downsides:

- Body text contrast **WCAG AAA on every content surface** (7:1 minimum, not just the AA 4.5:1 baseline). On `#0C0F14` background, body text must be at or brighter than `#E6E6E6`.
- Never pure white (`#FFFFFF`) on pure black — causes halation/smearing. Use `#F1F5F9` or `#E6E6E6` at most.
- Background must be **solid or a single static gradient** — no video, no parallax, no cross-fade loops. Motion lives in celebrations, not chrome.
- Per-screen surface "temperature": primary reading surfaces (lesson, review, reading) may lighten to `#12161D` to break the constant `#0C0F14` field. Ornamental screens (home, profile) stay darker.
- Reserve `#6366F1` (Indigo primary) for CTAs and focused states only. Use brighter `#818CF8` (Indigo-400) for small active accents on dark so it stays visible.

---

## Phase 0 — Design System Foundation (Week 1)

### Deliverables

1. **New token system** published as `config/theme.ts` — single source of truth for colors, spacing, typography, radii, motion, elevation.
2. **Rewritten `DESIGN.md`** reflecting dark canonical + indigo primary + moderate gamification (current DESIGN.md says "light only / no shadows / no gradients"; we reverse that and document why).
3. **Retire `GradientBackground.tsx`** globally. Replace its uses with a new `<Surface>` wrapper.
4. **Audit & retire/refactor existing primitives** per the matrix below.
5. **New shared primitives:** `<Surface>`, `<Heading>`, `<Body>`, `<Caption>`, `<Chip>`, `<TactileButton>`, `<Sheet>`, `<CelebrationOverlay>`.
6. **Mascot concept + 6 static SVG illustrations** (idle / happy / thinking / cheering / sad / disappointed) — commissioned or in-house.

### 0.1 Token system (colors)

```ts
// config/theme.ts (excerpt — to be implemented)

export const colors = {
  // Surfaces — dark-mode canonical
  surface: {
    base:       '#0C0F14',  // primary app background
    raised:     '#12161D',  // lesson/review/reading screens (slightly lighter)
    card:       '#151921',  // card fills
    cardAlt:    '#1C212B',  // nested cards, input fills
    overlay:    'rgba(12, 15, 20, 0.85)', // modal backdrops
  },
  // Borders & dividers (on dark)
  border: {
    subtle:  'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.12)',
    strong:  'rgba(255, 255, 255, 0.24)',
  },
  // Text (AAA on surface.base)
  text: {
    primary:   '#F1F5F9',  // body on dark, 14.6:1 vs #0C0F14
    secondary: '#CBD5E1',  // metadata, 10.2:1
    tertiary:  '#94A3B8',  // placeholders, 5.8:1 (AA for large text)
    onIndigo:  '#FFFFFF',  // text on indigo CTA
    onSuccess: '#0C0F14',  // text on bright success (if any)
  },
  // Indigo — primary brand
  indigo: {
    50:  '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',  // "light primary" for glows/accents on dark
    500: '#6366F1',  // CANONICAL PRIMARY
    600: '#4F46E5',
    700: '#4338CA',  // button slab bottom edge
    800: '#3730A3',
    900: '#312E81',
  },
  // Semantic tokens
  success: { base: '#22C55E', dark: '#16A34A', tint: 'rgba(34, 197, 94, 0.15)' },
  error:   { base: '#EF4444', dark: '#DC2626', tint: 'rgba(239, 68, 68, 0.15)' },
  warning: { base: '#F59E0B', dark: '#D97706', tint: 'rgba(245, 158, 11, 0.15)' },
  streak:  { base: '#F59E0B', fire: '#F97316' }, // amber + orange for fire
  premium: { base: '#A855F7', tint: 'rgba(168, 85, 247, 0.18)' },
  // League tiers (unchanged from current DESIGN.md)
  league: {
    bronze:   '#CD7F32',
    silver:   '#C0C0C0',
    gold:     '#FFD700',
    platinum: '#A78BFA',
    diamond:  '#38BDF8',
  },
  // Error-category chips (from CorrectionBanner)
  correctionChip: {
    grammar:    { bg: 'rgba(56, 189, 248, 0.22)',  text: '#7DD3FC' },
    vocabulary: { bg: 'rgba(168, 85, 247, 0.22)',  text: '#C084FC' },
    spelling:   { bg: 'rgba(148, 163, 184, 0.22)', text: '#CBD5E1' },
    word_order: { bg: 'rgba(251, 146, 60, 0.22)',  text: '#FB923C' },
    tense:      { bg: 'rgba(52, 211, 153, 0.22)',  text: '#6EE7B7' },
    gender:     { bg: 'rgba(244, 114, 182, 0.22)', text: '#F472B6' },
    other:      { bg: 'rgba(148, 163, 184, 0.22)', text: '#CBD5E1' },
  },
};
```

Accessibility contract:
- **body text ≥ 7:1 on surface.base** (AAA)
- **large text ≥ 4.5:1** on surface.base (AAA)
- **success/error/warning all ≥ 3:1** on surface.base (AA for UI components)
- **no color-only signals** — always paired with icon + text label (WCAG SC 1.4.1)

### 0.2 Token system (spacing, radii, motion)

Collapse current 14-value ad-hoc spacing scale → **4-8-12-16-24-32-48-64** (8 values, 4pt + 8pt grid).

Radii: **8, 12, 14, 16, 20, full** (button→card→large-card→pill).

Motion tokens (from Material 3 research, aligned to reasearch in `design-research.md`):

```ts
export const motion = {
  duration: {
    instant: 100,   // tap feedback
    micro:   150,   // icon swap, tiny shift
    short:   200,   // default component
    medium:  300,   // card/sheet transitions
    long:    450,   // full-screen transitions
    celebration: 600, // reward moments
  },
  easing: {
    standard:    [0.2, 0.0, 0.0, 1.0], // most UI
    decelerate:  [0.0, 0.0, 0.0, 1.0], // entrances (ease-out)
    accelerate:  [0.4, 0.0, 1.0, 1.0], // exits (ease-in)
    emphasized:  [0.2, 0.0, 0.0, 1.0], // hero / celebration
    backOut:     [0.175, 0.885, 0.32, 1.275], // celebration pops (ease-out-back)
  },
};
```

Every animation must:
- honor `useReducedMotion()` (fallback to instant / dissolve)
- be one of these durations (no ad-hoc `duration: 347`)
- have a state transition — no infinite loops except: (a) loading spinners, (b) the streak fire on home when streak ≥ 7.

### 0.3 Token system (typography)

Use **Inter** (already loaded via `@expo-google-fonts/inter`) for body/UI, **PlayfairDisplay_700Bold** (already loaded) for one-off editorial headers (e.g., welcome screen, celebration screens). Add typographic primitives that enforce scale:

```tsx
<Heading level={1}>Learn</Heading>        // 28/1.2, Inter 700
<Heading level={2}>Spanish A2</Heading>   // 24/1.3, Inter 700
<Heading level={3}>Unit 4</Heading>       // 22/1.3, Inter 600
<Body size="lg">Option one</Body>         // 17/1.5, Inter 600
<Body>Message content</Body>              // 16/1.5, Inter 400
<Body size="sm">Helper text</Body>        // 14/1.45, Inter 400
<Caption>Stat label</Caption>             // 13/1.4, Inter 500
<Hero>Nailed it!</Hero>                   // 32/1.15, PlayfairDisplay 700 — celebration only
```

All wrappers default to `color: colors.text.primary` and support `accessibilityRole="header"` on `Heading`.

### 0.4 Primitive retirement & refactor matrix

| Primitive | Status | Action |
|---|---|---|
| `GradientBackground.tsx` (video) | **RETIRE** | Delete file. Every current consumer swaps to `<Surface variant="base">`. |
| `GlassSurface.tsx` (6-stack chromatic) | **SIMPLIFY** | Reduce to 2 layers: single dark fill + 1px inner border. Drop chromatic aberration, drop specular sheen. Keep API. |
| `GradientButton.tsx` | **RETIRE** | Delete. Consumers migrate to new `<TactileButton variant="primary">`. |
| `GradientBorderCard.tsx` | **KEEP** | Reserved for premium/achievement/league-reveal moments only (≤ 5 usages post-migration). Document allowed uses. |
| `Button.tsx` (existing) | **REFACTOR** | Rewrite internals to call `<TactileButton>`. Keep public API for backward compat. |
| `Card.tsx` | **KEEP, TOKENIZE** | Swap hard-coded colors for theme tokens. Keep flat surfaces, use `border.subtle` instead of shadow where shadow currently exists. |
| `Badge.tsx` | **KEEP, TOKENIZE** | Add new variants: `errorType` (for correction chips), `severity`, `league`. |
| `ProgressBar.tsx` | **REFACTOR** | Drop gradient fill; use solid `indigo.500` fill + `border.subtle` track. Add bounce-on-advance animation (150ms spring). |
| `AnimatedGalaxy.tsx` | **RETIRE** | Galaxy parallax = more of the same distraction problem. Move to a single static SVG of stars used only on `<Welcome>` / celebration screens. |
| `ShinyText.tsx` | **KEEP** | Reserve for hero/celebration text only. Gate on `useReducedMotion`. |
| `StatsBar.tsx` | **REFACTOR** | Tokenize colors + typography. |
| `LoadingScreen.tsx` / `OfflineBanner.tsx` / `EmptyState.tsx` / `ErrorBoundary.tsx` | **TOKENIZE** | Swap hex for tokens. |
| All `components/lesson/*` exercise components | **TOKENIZE** | No structural change; swap colors → tokens, inline sizes → typography primitives. |
| `LessonRunner.tsx` | **REFACTOR** | Replace current chrome with new `<LessonShell>` (progress + hearts + exit anchored top, content, CTA slab anchored bottom). |
| `ChatBubble.tsx` | **TOKENIZE** | Keep the Listen/Translate/Correction work from prior phase. Tokenize colors only. |
| `ChatInput.tsx` | **TOKENIZE** | Keep recording state machine. Tokenize. |
| `components/animations/*` | **GATE** | Add `useReducedMotion` gate to every animation. `CorrectSparkle`, `WrongShake`, `HeartBreak`, `XpCounterTick`, `ChallengeCompletePop`, `StreakFireAnimation`. |
| `components/gamification/*` | **TOKENIZE + ENHANCE** | HeartsDisplay, OutOfHeartsModal, LeagueBadge, LevelProgressCard, LevelUpModal, XpPopup, AchievementBadge, AchievementGrid, DailyChallenges, StreakRepairModal, QuestCountdown, StreakShieldBadge. |

### 0.5 New primitives to create in Phase 0

- **`<Surface variant="base"|"raised"|"card">`** — the background wrapper every screen uses. Replaces `GradientBackground`.
- **`<Heading>`, `<Body>`, `<Caption>`, `<Hero>`** — typography primitives (see 0.3).
- **`<TactileButton variant="primary"|"secondary"|"ghost"|"danger">`** — Duolingo-style 4px bottom slab, haptic on press, scale:0.98 on tap. Duration 100ms. This is **the** CTA primitive — every screen must use it for primary/secondary actions.
- **`<Chip>`** — small pill with left-icon slot. Used for error-type, severity, league, streak.
- **`<Sheet>`** — bottom-anchored modal for correct/incorrect feedback, out-of-hearts, save-to-review confirmations.
- **`<CelebrationOverlay mood="correct"|"lessonComplete"|"streakMilestone"|"levelUp">`** — full-screen celebration router. Composes mascot + confetti + haptic + sound. Gated on `useReducedMotion` → falls back to dissolve.
- **`<Mascot state="idle"|"happy"|"thinking"|"cheering"|"sad"|"disappointed" size="sm"|"md"|"lg">`** — renders the correct static SVG based on state. Phase-3 target: swap SVG for Rive state machine without changing the API.
- **`<ScreenHeader title subtitle onBack>`** — replaces ad-hoc header markup across screens.

### 0.6 Mascot concept (new character)

Must be distinctly **not** a Duo clone. Target traits: non-avian, non-green, friendly, slightly whimsical but not childish (target audience is teen-to-adult language learners, including school students).

Shortlist concepts for the plan:
1. **A glowing indigo origami crane** — ties to "unfolding" learning, paper-crane symbolism across Japanese/Chinese cultures
2. **A small curious star-being** — fits the "cosmic" theme the user chose, lives in the navy-blue space surface
3. **A soft fluffy cloud creature with expressive eyes** — approachable, neutral, won't offend across cultures
4. **A minimalist robot with an indigo CPU heart** — ties to the AI-chat side of the product

**Design constraint:** whichever is picked, must be renderable as a single SVG in 6 states (idle / happy / thinking / cheering / sad / disappointed), use ≤ 4 colors total (indigo primary, one secondary, one skin/surface, one outline). Style: thick 2–3pt strokes, flat fills, no gradients.

Defer final pick to a small A/B mockup review with user. Commission or draw 3 concepts in Week 1. User picks 1 end of Week 1.

---

## Per-Screen Redesign Specs

Organized by tier. Each screen gets: **purpose** → **key changes** → **primitives used** → **motion moments** → **accessibility callouts**.

### Tier 1 — Learner daily flow (highest priority, 40-50% of all engagement time)

#### 🏠 Home Dashboard — `/(app)/` (`app/(app)/index.tsx`)

- **Purpose:** heartbeat. Show streak, XP, hearts. Invite next action. Surface daily challenges and pending assignments.
- **Key changes:**
  - Replace `<GradientBackground>` with `<Surface variant="base">`.
  - New layout: sticky top stat bar (streak fire + XP + hearts + league badge), then a single large **"Continue" `<TactileButton>`** (the single biggest CTA on the screen — biggest research-backed retention lever: ability × prompt), then daily challenges row, then weekly activity heatmap (small, glanceable), then quick-actions grid (Chat, Practice, Review, Reading).
  - Mascot in a small fixed position (upper-right-ish corner, 64×64) with gentle idle nod — playing the "happy" state when user has an active streak.
  - Streak fire is **the only persistent loop** on the screen (gated on streak ≥ 7), using `StreakFireAnimation` with a slow 2s breathing cycle.
- **Primitives used:** `<Surface base>`, `<Heading>`, `<Body>`, `<Chip>` (league), `<TactileButton primary>`, `<Mascot>`, `<StreakFireAnimation>`, `<Card>` (stat cards).
- **Motion moments:** streak fire breathing (perpetual, reduced-motion → static flame); stat cards slide-in on first mount (300ms, reduced-motion → instant).
- **Accessibility:** top stat bar has `accessibilityLabel="Streak 12 days, 1240 XP, 3 hearts"`. Mascot is `accessibilityElementsHidden={true}` (decorative).

#### 📚 Lesson Runner — `/(app)/learn/[lessonId]` (`LessonRunner.tsx`)

- **Purpose:** THE learning surface. Where germane load should be spent. Highest Mayer coherence requirement.
- **Key changes:**
  - Strictest calm surface in the app. `<Surface variant="raised">` (`#12161D`) for a subtle step-up in lightness that tells the brain "you're in focus mode."
  - Top: slim progress bar + hearts + X-exit; nothing else.
  - Middle: the exercise. Exercise components only render their prompt + answer area; zero background decoration.
  - Bottom: `<TactileButton primary>` CHECK anchored to safe area; morphs to CONTINUE on result.
  - **Bottom-sheet result reveal:** on CHECK, a `<Sheet>` slides up with "Amazing!" (green) or "Correct answer:" (red) + tap-to-continue. This matches Duolingo's proven pattern and focuses eyes on feedback.
  - Mascot absent during exercise (Mayer coherence) — appears only in the result sheet and lesson-complete celebration.
- **Motion moments:**
  - Progress bar pulses forward on correct (indigo, 150ms). Reduced-motion → instant.
  - Result sheet slides in from bottom (300ms emphasized ease).
  - Correct: `<CorrectSparkle>` around exercise card (500ms). Reduced-motion → dissolve.
  - Wrong: `<WrongShake>` 4-shake over 360ms. Reduced-motion → single red tint flash.
  - Lesson complete: `<CelebrationOverlay mood="lessonComplete">` with mascot "cheering", 30-particle confetti, XP number rolls up with 50ms stagger, ding sound (200ms), success haptic.
- **Accessibility:** all answer buttons ≥44pt. Hearts display labels remaining count. Exit button always present.

#### 💬 Chat — `/(app)/chat/*` (`app/(app)/chat/index.tsx`, `ChatBubble.tsx`, `ChatInput.tsx`)

- **Purpose:** scenario + practice conversations. Second-most-used surface.
- **Key changes:**
  - Scenario picker: `<Surface base>` with `<Card>` list. Each card: icon + title + description + **dual CTA** (Text / Live Voice). No more gradient cards.
  - Active chat: `<Surface raised>` so chat bubbles on `#12161D` read well.
  - `<ChatInput>` gets new styling to match the `<TactileButton>` primary — haptic on send, scale:0.98.
  - Mascot perched in scenario picker only (tiny, upper right), not in active chat (coherence).
- **Motion moments:** message slide-in on send (200ms); typing indicator dots (existing); correct/incorrect correction-chip reveal per prior phase's `<CorrectionBanner>`.
- **Accessibility:** unchanged from prior phase's work; keep Listen/Translate buttons on all bubbles; CorrectionBanner already tokenized (done in phase 4 earlier).

#### 🔁 Review — `/(app)/learn/review` + `/(app)/review/*`

- **Purpose:** SRS flashcards. Pure focus.
- **Key changes:**
  - Single visible card, center of screen, `<Surface raised>` background.
  - Card flip animation on tap (300ms 3D rotateY, gated reduced-motion → fade).
  - Rating row: 4 `<TactileButton>` in muted colors (Again = red.tint, Hard = warning.tint, Good = success.tint, Easy = indigo.tint). Each shows interval below.
  - Completion screen: `<CelebrationOverlay mood="lessonComplete">` with accuracy % in big `<Hero>` typography, XP earned, streak-updates-if-eligible text.
- **Motion moments:** card flip (300ms), correct/wrong lightweight confirmation (150ms), completion celebration.

### Tier 2 — Teacher-facing (~15% of engagement, school mode)

#### 🧑‍🏫 Teacher Dashboard — `/(teacher)/`
- **Surface:** `<Surface base>`.
- Stat cards in a flat row (3 cards: Active Students / Pending Grades / Avg Completion). Simplified `<GlassSurface>` (2-layer, no sheen).
- Upcoming assignments list — `<Card>` each; overdue in warning color.
- Recent activity feed — simple timeline with relative timestamps.

#### 📝 Grade Submission — `/(teacher)/assignments/[assignmentId]/[submissionId]`
- Transcript viewer (read-only `ChatBubble` list).
- Expandable rubric cards (`<Card>` with `<Chip>` scores).
- Score input + teacher notes.
- `<TactileButton primary>` Save.
- **Motion:** none beyond standard screen transition; this is a work surface, not a reward surface.

### Tier 3 — Onboarding & Auth (~5% of engagement but 100% of first impressions)

#### 🎉 Welcome — `/(public)/`
- Hero: mascot (large, "cheering" state) + animated multi-language greetings (already exists, keep that carousel).
- Two CTAs: primary "Get Started" (`<TactileButton primary>`) + ghost "I have an account" (`<TactileButton ghost>`).
- One static starfield SVG background (replaces `AnimatedGalaxy`). **Reduced-motion safe** because it's static.
- **Sign-up delayed:** after "Get Started" → straight to language picker → first exercise. Sign-up modal only at the end of first exercise. (Research-backed; DAU +20% in Duolingo's documented A/B.)

#### 📋 Onboarding — `/(public)/onboarding`
- 5 steps: language → native language → level → daily goal → (delayed) sign-up.
- Use `<Chip>`-style selection (not picker wheels) for language + level + goal. Large tap targets.
- Progress bar at top shows 1/5, 2/5, etc. Bar pre-fills at 20% on open (endowed progress).
- Step transitions: 300ms slide-left (emphasized ease).

#### 🔐 Auth — `/(public)/auth`
- Simple `<Surface base>`.
- Email input + password input (both large, 44pt touch) + `<TactileButton primary>` Continue.
- Inline validation feedback with icon pairing.
- Magic-link option as a `<TactileButton ghost>` below.

### Tier 4 — Secondary learner surfaces

#### 📖 Reading Passage — `/(app)/learn/reading/[passageId]`
- **Surface:** `<Surface raised>` for calmer reading.
- Reading typography bumped to 17px/1.55. Line length capped to 45-60 chars via `maxWidth`.
- Word-tap tooltips: small `<Sheet>` from bottom, not full overlay. Cached per passage.

#### 📘 Reading Book — `/(app)/learn/reading/book/[bookId]`
- Same reading typography as passage.
- Chapter progress bar at bottom; pre-fills based on saved position.
- Tap-word → tooltip pattern from passage.

#### ✍️ Writing Prompt — `/(app)/learn/writing/[promptId]`
- Multi-line input, 16px/1.5.
- Submit → loading state → feedback `<Sheet>` with rubric breakdown (4 score rings), strengths/improvements, corrected version, corrections list.
- **Motion:** score-ring fills animate on reveal (500ms staggered per ring).

#### ✍️ Writing History — `/(app)/learn/writing/history`
- Grouped list by prompt; best-score badge per prompt; attempt count.
- Tap → load most recent submission.

#### 📰 Daily News — `/(app)/news/[date]`
- Same reading typography as Reading Passage.
- Tappable vocabulary highlights → inline expand (not overlay).

#### 👤 Profile — `/(app)/profile/*`
- Large avatar tile at top (tap → customizer).
- Stat row (XP / level / streak / best).
- League badge `<Chip>`.
- Achievement grid (3 cols × N rows) — `<Card>` each, unlocked in color, locked muted.
- "My Classes" list.
- Settings/subscription/role-switcher links as `<TactileButton ghost>`.

#### ⚙️ Settings — `/(app)/profile/settings`
- Form: name, target language, proficiency level, daily goal.
- `<Chip>`-style selectors for language/level/goal.
- `<TactileButton primary>` Save.

#### 💳 Subscription — `/(app)/profile/subscription`
- Plan cards (free / premium / VIP). Current plan highlighted.
- Use `<GradientBorderCard>` (kept for this specific premium moment) on the top-tier card.
- Feature lists with check icons.
- `<TactileButton primary>` Subscribe per plan.

#### 🎒 Student Assignment Detail — `/(app)/assignments/[assignmentId]`
- Title, description, scenario tag, language/level chips, duration, due countdown.
- Status badge (not started / in progress / submitted / graded).
- Primary CTA: Start / Continue / View Grade.

### Tier 5 — Teacher admin + misc

#### 👥 Teacher Classes — `/(teacher)/classes/*`
- Class list → class detail → student view → enrollment code.
- All flat cards + `<TactileButton>`.

#### 📝 Teacher Assignment Create — `/(teacher)/assignments/create`
- Form. Scenario picker as inline `<Chip>` row (not modal). Rubric builder as tag input.

#### 🛡 Admin Panel — `/(teacher)/admin/*`
- Data stats + action buttons. Minimal ornament; work surface.

### Modals / overlays

All migrate to `<Sheet>` (bottom-anchored) unless full-screen celebration:

- **OnboardingChecklist** — keep as sticky banner, restyle.
- **Level-Up Modal** — `<CelebrationOverlay mood="levelUp">`.
- **Out of Hearts Modal** — `<Sheet>` with heart regen timer + upgrade CTA.
- **Achievement Modal** — `<Sheet>` with achievement icon + title + description, queued.
- **Streak Repair Modal** — `<Sheet>` with empathetic copy + repair CTA.
- **Avatar Customizer** — full-screen `<Sheet>` with feature picker.
- **Join Class Modal** — small `<Sheet>` with code input.
- **Role Switcher** — small `<Sheet>` with Learner/Teacher radio.

---

## Implementation Phasing (Big-Bang)

### Week 1 — Phase 0 Foundation

- [ ] Create `config/theme.ts` with all tokens (colors, spacing, radii, motion, typography).
- [ ] Rewrite `DESIGN.md` to document new canonical dark-mode system, indigo primary, retire old "no-shadows/no-gradients/light-only" text.
- [ ] Create `<Surface>`, `<Heading>`, `<Body>`, `<Caption>`, `<Hero>`, `<Chip>`, `<TactileButton>`, `<Sheet>`, `<CelebrationOverlay>`, `<ScreenHeader>` primitives.
- [ ] Retire `GradientBackground.tsx` from repo. Every import site swaps to `<Surface variant="base">`.
- [ ] Simplify `GlassSurface.tsx` to 2-layer. Keep API.
- [ ] Retire `GradientButton.tsx` → all consumers use `<TactileButton>`.
- [ ] Gate every animation on `useReducedMotion`.
- [ ] Commission / draft 3 mascot concepts; user picks 1 end of week.

### Week 2 — Tier 1 (part 1)

- [ ] Home Dashboard — full rewrite per spec.
- [ ] Lesson Runner — new `<LessonShell>`; all 14 exercise components tokenized.
- [ ] `<CelebrationOverlay>` with confetti + mascot + haptic + sound.

### Week 3 — Tier 1 (part 2) + Tier 2

- [ ] Chat screens + scenario picker tokenized.
- [ ] Review screen redesigned with card flip + rating row.
- [ ] Teacher Dashboard tokenized.
- [ ] Grade Submission tokenized.

### Week 4 — Tier 3

- [ ] Welcome screen with mascot + delayed sign-up flow.
- [ ] Onboarding restructured into chip-select 5-step.
- [ ] Auth screen simplified.
- [ ] Sign-up delayed → fires after first exercise.

### Week 5 — Tier 4 + Tier 5 + modals

- [ ] Reading passage + book + writing prompt + writing history + daily news + profile + settings + subscription + student assignment + teacher classes + teacher assignment create + admin panel.
- [ ] All modals migrated to `<Sheet>` pattern.
- [ ] Orphan hex colors swept → all tokens.

### Week 6 — QA + accessibility audit + App Store prep

- [ ] Every screen: VoiceOver walkthrough, Reduce Motion test, Dynamic Type XXL, Larger Text, Bold Text.
- [ ] Contrast validator run on every token combo (WebAIM contrast checker or Accessible Contrast CLI).
- [ ] Perf profile: ensure 60fps on animations, no long tasks on Lesson Runner.
- [ ] App Store screenshots refreshed with new UI.
- [ ] TestFlight build for internal bash; collect 48h of feedback.
- [ ] Release.

---

## Mascot Follow-Up (Post-Launch)

Not in big-bang release — scheduled after ship:

- Rive state-machine implementation (idle / speak / correct / wrong / celebrate, all one asset).
- Viseme-mapped lip-sync if Chat/Practice ever goes character-led (currently mascot is UI ornament, not a chat interlocutor).
- Seasonal outfit variants (first year of holiday packs).

---

## Success Metrics

### Pre-ship (technical gates)

- Every surface passes WCAG AAA for body text on dark (7:1).
- Every animation gates `useReducedMotion`; manual test with setting ON.
- Every primary action uses `<TactileButton>` (no raw `<Pressable>` for primary CTAs).
- Every color is a theme token reference (no raw hex in screen code, audited via grep).
- App Store "Reduced Motion Evaluation Criteria" compliance verified.
- 60fps on Lesson Runner celebration overlay on iPhone 12 and newer.
- Zero "GradientBackground" imports remain in repo.

### Post-ship (product metrics, 30-day window)

- D1 retention: baseline now vs. post-ship. Target +5pp lift.
- D7 retention: baseline vs. post-ship. Target +8pp.
- D30 retention: baseline vs. post-ship. Target +10pp.
- Activation rate (first lesson complete + goal set + first voice message) — target 40%.
- Median session length — expect slight increase; watch for dark-pattern signal (session length growing without competence growing).
- App Store rating — expect +0.3 stars over baseline.
- Churn notification (self-throttle) — measure % of users who have muted notifications.

### Anti-pattern watch (ethical guardrails)

- Monitor "streak broken" re-engagement rate. If it drops below 20%, something in the streak-repair UX is failing learners.
- Monitor notification "ignore rate." If >7 in a row, app auto-mutes per the research-grounded self-throttle rule.
- Monitor league participation by user cohort age. If <14-day users are being funneled into leagues (contrary to opt-in), ship a hotfix.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Big-bang slip: 5→8 weeks | High | Parallel bugfix branch; any screen not ready by week 5 ships its previous version (not a blocker). |
| Mascot polarizing | Medium | Phase 0 includes user-review step before any screen illustrates the mascot. If no concept sticks, ship gamification-minus-mascot. |
| Dark mode contrast regressions | Medium | Automated contrast check in CI; every new color pair runs through checker before merge. |
| Animation perf on older devices | Medium | Reanimated UI-thread only; profile on iPhone XR + iPhone SE 2; drop heavy anims there. |
| Sound on correct-answer annoys users | Medium | Add opt-out toggle in Settings; default ON; respect system mute. |
| Token swap breaks teacher screens (less-tested) | Medium | Teacher screens get dedicated QA pass in week 3; teacher testing pool of 3 real teachers in week 6 TestFlight. |
| Existing streak/XP data model mismatches new UI expectations | Low | Audit in week 1; no schema migration expected since gamification scope is additive. |
| App Store review flags "decorative motion without reduced-motion alternative" | Low | Already guarded globally in Phase 0. Spot-check during QA. |

---

## Open Questions / Deferred Decisions

These don't block Phase 0. To be decided during build:

1. **Mascot name** — locked end of Week 1 after user picks a concept.
2. **Sound design** — use existing free SFX (freesound.org CC0) or commission 4-5 custom SFX (ding, chime, success, fanfare, streak)? Initial: use CC0 pack.
3. **Haptic library** — all `expo-haptics` (light / medium / heavy / success / warning / error) should be sufficient. No custom haptics needed.
4. **Dark-mode contrast at Dynamic Type XXL** — some current text colors may fail AAA at XXL; audit week 6.
5. **Tab bar redesign** — current implementation is in `_layout.tsx` files; spec above doesn't touch it. Week 2 task: update tab bar to match new tokens (no gradient).
6. **League opt-in default screen** — where/when does the "Would you like to join Leagues?" prompt appear? Proposal: in the Profile screen as a toggle, surfaced via a coach-mark after day 14. To finalize week 4.
7. **Sound toggle in Settings** — add to Settings form. Week 4.

---

## Files to Create / Modify (Master List)

### Create

- `config/theme.ts` — all tokens
- `components/ui/Surface.tsx`
- `components/ui/Text.tsx` — exports `Heading`, `Body`, `Caption`, `Hero`
- `components/ui/TactileButton.tsx`
- `components/ui/Chip.tsx`
- `components/ui/Sheet.tsx`
- `components/ui/CelebrationOverlay.tsx`
- `components/ui/ScreenHeader.tsx`
- `components/mascot/Mascot.tsx` — static SVG renderer
- `components/mascot/assets/*.svg` — 6 state SVGs
- `hooks/useMotion.ts` — wraps `useReducedMotion` + durations/easing tokens
- `hooks/useSound.ts` — preload SFX, respect system mute + in-app toggle

### Delete / retire

- `components/ui/GradientBackground.tsx` — delete file, delete `assets/galaxy-bg.mp4`
- `components/ui/GradientButton.tsx`
- `components/ui/AnimatedGalaxy.tsx` — delete or repurpose as static SVG

### Modify

- `DESIGN.md` — rewrite to reflect dark-canonical + indigo + moderate gamification
- Every file under `app/` (~50 screens) — swap background wrapper, retokenize colors, retokenize typography
- Every file under `components/lesson/`, `components/gamification/`, `components/chat/`, `components/reading/`, `components/school/`, `components/animations/` — tokenize
- `tailwind.config.js` — import from `config/theme.ts` tokens; remove shadow tokens reserved for ornamental primitives
- `app/_layout.tsx` — mount theme provider, font loader already present

---

## Execution Starts When

- [ ] This plan reviewed / edited by user
- [ ] Mascot concept shortlist approved (will be proposed as a follow-up question when build begins)
- [ ] Branch created: `feat/redesign-dark-indigo-v1`
- [ ] TestFlight slot reserved for week 6

When all 4 are checked, Phase 0 starts. First PR will be `config/theme.ts` + `DESIGN.md` rewrite + primitives shell — should be mergeable in ~2 days.

---

**Last updated:** 2026-04-21. Direction-locked, not yet executing. References `design-research.md` for underlying empirical and platform guidance.
