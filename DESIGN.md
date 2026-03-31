# languageAI Design System

This is the single source of truth for the app's visual design. All UI changes must conform to these values. Do not introduce new colors, spacing values, or component patterns without explicit approval.

---

## Color Palette

### Primary & Branding

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#6366F1` | Buttons, active tabs, focused input borders, accent text, spinners |
| Primary Light | `#C7D2FE` | Disabled buttons, secondary indicators, decorative arrows |
| Primary Tint | `#E0E7FF` | Selected state backgrounds (language picker, level picker) |

### Feedback

| Token | Hex | Usage |
|-------|-----|-------|
| Success | `#22C55E` | Correct answers, completed items, positive borders |
| Success Background | `#DCFCE7` | Correct answer card fill, positive feedback containers |
| Error | `#EF4444` | Incorrect answers, destructive text |
| Error Dark | `#DC2626` | Danger button text, correction text on light backgrounds |
| Error Light | `#FCA5A5` | Correction text on dark (user bubble) backgrounds |
| Error Background | `#FEE2E2` | Incorrect answer fill, danger button fill, end-session button fill |
| Warning | `#CA8A04` | Medium performance score text (60-79%) |
| Warning Background | `#FEF9C3` | Medium performance fill |
| Streak Accent | `#F59E0B` | Streak counter icon/text |
| Heart | `#EF4444` | Heart icons (filled state) |
| Heart Empty | `#64748B` | Heart icons (empty state) |

### League Tiers

| Token | Hex | Usage |
|-------|-----|-------|
| Bronze | `#CD7F32` | Bronze league badge, level 1-10 |
| Silver | `#C0C0C0` | Silver league badge, level 11-25 |
| Gold | `#FFD700` | Gold league badge, level 26-50 |
| Platinum | `#A78BFA` | Platinum league badge, level 51-75 |
| Diamond | `#38BDF8` | Diamond league badge, level 76-100 |

### Neutrals & Surfaces

| Token | Hex | Usage |
|-------|-----|-------|
| White | `#FFFFFF` | Primary background, card surfaces |
| Surface | `#F9FAFB` | Card backgrounds, picker items, secondary sections |
| Surface Alt | `#F3F4F6` | Unselected options, assistant message bubbles, progress bar unfilled |
| Border | `#E5E7EB` | Dividers, subtle separators |
| Input Border | `#D1D5DB` | TextInput default border, correction dividers (assistant side) |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| Text Primary | `#111111` | Headings, body text, primary labels |
| Text Secondary | `#666666` | Descriptions, stat labels, metadata |
| Text Tertiary | `#999999` | Placeholders, helper text, loading messages |
| Text On Primary | `#FFFFFF` | Text on `#6366F1` backgrounds and user bubbles |

---

## Typography

System fonts only (San Francisco on iOS, Roboto on Android).

| Use Case | Size | Weight | Example |
|----------|------|--------|---------|
| Page Header | 28px | 700 | "Learn", "Profile", "AI Practice" |
| Section Header | 24px | 700 | Course/Unit titles |
| Card Header | 22px | 600 | Speaking exercise prompt |
| Subheading | 18px | 600–700 | "AI Conversation", lesson titles |
| Body Large | 17px | 600 | Multiple choice option text |
| Body / Button | 16px | 400–600 | Message content, button labels, form labels |
| Secondary | 15px | 400–600 | Time displays, counters |
| Caption | 14px | 400–600 | Stat labels, helper text, exercise type labels |
| Small | 13px | 400 | Timestamps, small metadata |
| Tiny | 12px | 400 | Badge text, extra-small labels |

Default line height: **22px** for body text.

---

## Spacing Scale

| Value | Usage |
|-------|-------|
| 2px | Minimal text offsets (fill-blank underlines) |
| 4px | Extra-small gaps, inline element spacing |
| 6px | Small row gaps |
| 8px | Small internal padding (buttons, badges, icon spacing, message gaps) |
| 10px | Input vertical padding, list item margins |
| 12px | Medium card/list padding, section spacing |
| 14px | Message bubble padding, icon-text spacing |
| 16px | Standard content padding, block spacing |
| 18px | Topic item padding |
| 20px | Profile sections, course cards internal padding |
| 24px | Exercise card padding, page section spacing |
| 32px | Page-level padding (sign out area) |
| 40px | ScrollView bottom content padding |
| 48px | Primary button horizontal padding |

---

## Border Radius Scale

| Value | Usage |
|-------|-------|
| 8px | Small elements (picker items, badges) |
| 10px | End/close buttons |
| 12px | Picker containers |
| 14px | Standard cards, inputs, multiple choice options, primary buttons |
| 16px | Large cards (course, unit, profile sections) |
| 18px | Message bubbles (with asymmetric 4px on sender corner) |
| 20px | Extra-large containers (exercise cards, summary screens) |
| 22px | Circular buttons (44x44 send button) |

---

## Component Reference

### Buttons

**Primary** — `bg: #6366F1` | `text: white, 18px, w600` | `px: 48, py: 16` | `radius: 14` | disabled: `bg: #C7D2FE`

**Secondary** — `bg: #F9FAFB` | `text: #111, 18px, w600` | `px: 48, py: 16` | `radius: 14`

**Danger** — `bg: #FEE2E2` | `text: #DC2626, 18px, w600` | `px: 48, py: 16` | `radius: 14`

**Text/Tertiary** — `bg: transparent` | `text: #6366F1, 16px` | no padding

**End/Close** — `bg: #FEE2E2` | `text: #DC2626, 14px, w600` | `px: 16, py: 8` | `radius: 10`

**Send (circular)** — `bg: #6366F1` | `text: white, 18px, w700` | `44x44` | `radius: 22` | disabled: `bg: #C7D2FE`

### Cards

**Standard** — `bg: #F9FAFB` | `p: 16–20` | `radius: 14–16` | `mb: 10–12` | flat (no shadow)

**User Info** — `bg: #F9FAFB` | `p: 20` | `radius: 16` | name 18px w600, email 14px #666

**Topic/Course** — `bg: #F9FAFB` | `p: 20` | `radius: 16` | row layout, arrow `>` in `#C7D2FE`

**Exercise** — `bg: #F9FAFB` | `p: 24` | `radius: 20` | `minHeight: 200`

### Message Bubbles

**User** — `bg: #6366F1` | `text: white` | `p: 14` | `radius: 18` (bottom-right: 4px) | maxWidth: 82%

**Assistant** — `bg: #F3F4F6` | `text: #111` | `p: 14` | `radius: 18` (bottom-left: 4px) | maxWidth: 82%

Margin bottom: 8px between messages.

### Multiple Choice Options

| State | Background | Border (2px) | Text Weight |
|-------|-----------|--------------|-------------|
| Default | `#F3F4F6` | transparent | 600 |
| Selected | `#E0E7FF` | `#6366F1` | 600 |
| Correct | `#DCFCE7` | `#22C55E` | 600 |
| Incorrect | `#FEE2E2` | `#EF4444` | 600 |

Padding: 16px | Radius: 14px | Margin bottom: 10px | Font: 17px

### Text Inputs

Border: 2px `#D1D5DB` (default) / `#6366F1` (focused) / `#22C55E` (correct) / `#EF4444` (error)
Radius: 14px | px: 16, py: 10 | Font: 16–18px | Placeholder: `#999`
Multiline: minHeight 80px, textAlignVertical top

### Progress Bar

Height: 8–12px | Filled: `#6366F1` | Unfilled: `#F3F4F6` | Radius: 4–8px

### Score Feedback Circle

Size: 100x100 | Radius: 50 (circle) | Score text: 32px w700

| Score Range | Background | Text Color |
|-------------|-----------|------------|
| >= 80% | `#DCFCE7` | `#22C55E` |
| 60–79% | `#FEF9C3` | `#CA8A04` |
| < 60% | `#FEE2E2` | `#EF4444` |

---

## Interaction Patterns

### Haptic Feedback

| Event | Type |
|-------|------|
| Option tap | Selection (light) |
| Correct answer | Success (3 rapid pulses) |
| Incorrect answer | Error (strong impact) |
| Record start/stop | Selection |

### Loading States

Full-screen overlay: semi-transparent white background, centered `ActivityIndicator` (color `#6366F1`, size large), optional status text below.

---

## Accessibility

- Minimum touch target: **44x44pt**
- All `Pressable` elements: `accessibilityRole="button"` + `accessibilityLabel`
- Headers: `accessibilityRole="header"`
- Color is never the sole indicator — always paired with text labels
- Contrast ratios: `#111` on `#FFF` = 16:1 (AAA), `#666` on `#FFF` = 6:1 (AA), `#FFF` on `#6366F1` = 7:1 (AAA)

---

## Layout

- All screens wrapped in `SafeAreaView`
- Forms use `KeyboardAvoidingView` with `behavior="padding"` and `keyboardVerticalOffset={90}` on iOS
- Default layout: flexbox column
- Message/stat rows: flexbox row
- Status bar: `<StatusBar style="auto" />` at root layout

---

## Important Notes

- **No dark mode** — light mode only (for now)
- **No shadows** — flat design throughout
- **No gradients** — solid colors only
- **Inline styles** — all styling is via React Native style objects with hardcoded values (no NativeWind classes used currently)
