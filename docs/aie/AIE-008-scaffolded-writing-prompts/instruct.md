# Instruct — Scaffolded writing prompt UI

**AIE:** AIE-008

## Directive
> "Modify components/writing/WritingExercise.tsx to render different input UIs based on scaffold_type: fill_blank shows sentence with inline TextInput at blank_index position from scaffold_data. sentence_frame shows starter phrases with TextInputs after each. guided_paragraph shows starters with expandable text areas. essay/academic/free shows full text area (existing behavior). Add getCombinedText() that merges scaffold inputs into a single string for submission. Add isScaffoldComplete() validation. Add attemptNumber prop. Keep existing prompt display, vocabulary hints, grammar hints, word count, submit button."

## Context Provided
- `components/writing/WritingExercise.tsx` — existing component with free-form text input
- `types/index.ts` — WritingPrompt type with scaffoldType, scaffoldData fields (from AIE-001)
- `DESIGN.md` — input styles, spacing, colors

## Scope
IN scope: WritingExercise rewrite with scaffold sub-components, combined text logic, validation
OUT of scope: Scaffold prompt creation UI, admin scaffold editor, scaffold type switching
