# Design System Enforcement

`DESIGN.md` in the project root is the **single source of truth** for all UI and styling decisions. Before making ANY UI or styling change, read `DESIGN.md`.

## Rules

- All design tokens (colors, spacing, radii, typography, motion, elevation) live in `config/theme.ts` and are documented in `DESIGN.md`. Never hard-code hex values, spacing numbers, or font sizes in screens or components.
- The canonical theme is **dark** (`surface.base` `#0C0F14`). Indigo `#6366F1` is the primary brand color.
- Follow the documented component patterns (Button, Card, Sheet, Surface, message bubbles, inputs) exactly. Compose new components from existing tokens and primitives — do not invent new visual patterns.
- Motion is earned: animation only for state transitions, micro-feedback (≤200ms), and celebration moments. Every animation must gate on `useMotion().shouldReduce` (reduce-motion accessibility).
- Body text must stay WCAG AAA against its surface. Correct/incorrect feedback is never color-only — always pair with icon + text label.
- 8pt grid: spacing values are 4, 8, 12, 16, 24, 32, 48, 64 only.
- If a UI change requires a token or pattern not in `DESIGN.md`, add it to `config/theme.ts` and document it in `DESIGN.md` in the same change — or flag it to the user if it's a significant visual departure.
