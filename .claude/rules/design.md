# Design System Enforcement

Before making ANY UI or styling changes, you MUST read `DESIGN.md` in the project root.

## Rules

- Use ONLY the colors defined in `DESIGN.md`. Never introduce new hex values.
- Use ONLY the spacing, border radius, and typography values from the documented scales.
- Follow the documented component patterns (button variants, card styles, message bubbles, inputs, etc.) exactly.
- Maintain the flat design: no shadows, no gradients, solid colors only.
- Keep the light-mode-only approach unless explicitly asked to add dark mode.
- When creating new components, compose them from the existing design tokens — do not invent new visual patterns.
- If a UI change requires a value not in `DESIGN.md`, flag it to the user and get approval before proceeding.
