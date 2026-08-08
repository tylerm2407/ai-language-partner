---
paths: ["components/**", "app/**", "config/theme.ts", "DESIGN.md"]
---

# Design System Enforcement

`DESIGN.md` in the project root is the **single source of truth** for all UI and styling decisions. Before making ANY UI or styling change, read `DESIGN.md`.

## Rules

- All design tokens (colors, spacing, radii, typography, motion, elevation) live in `config/theme.ts` and are documented in `DESIGN.md`. Never hard-code hex values, spacing numbers, or font sizes in screens or components.
- The canonical theme is **dark** (`surface.base` `#08090F`). Indigo is the primary brand: `#4F46E5` (`indigo.600`) for CTA **fills**, `#818CF8` (`indigo.400`) for text and icon accents. `#6366F1` (`indigo.500`) is for borders and gradient stops only — white on it is 4.47:1, under AA.
- **The palette is settled. Do not propose a new one.** Two full rethemes shipped and were reverted; see `docs/NEXT-SESSION.md` §2.1–2.2 for what was tried, why it came back, and the traps if it ever changes again.
- Follow the documented component patterns (Button, Card, Sheet, Surface, message bubbles, inputs) exactly. Compose new components from existing tokens and primitives — do not invent new visual patterns.
- Motion is earned: animation only for state transitions, micro-feedback (≤200ms), and celebration moments. Every animation must gate on `useMotion().shouldReduce` (reduce-motion accessibility).
- Body text must stay WCAG AAA against its surface. Correct/incorrect feedback is never color-only — always pair with icon + text label.
- 8pt grid: spacing values are 4, 8, 12, 16, 24, 32, 48, 64 only.
- If a UI change requires a token or pattern not in `DESIGN.md`, add it to `config/theme.ts` and document it in `DESIGN.md` in the same change — or flag it to the user if it's a significant visual departure.
