# Execute — Scaffolded writing prompt UI

**AIE:** AIE-008

## Files Changed

| File | Action | What Changed |
|------|--------|-------------|
| `components/writing/WritingExercise.tsx` | rewritten | Full rewrite. Added `scaffoldInputs` state (Record<number, string>). Added `getCombinedText()` that merges scaffold inputs based on type. Added `isScaffoldComplete()` validation. Added 3 sub-components: `FillBlankInput` (inline input within sentence), `SentenceFrameInput` (starter + input rows), `GuidedParagraphInput` (starter labels + multiline text areas). Conditional rendering by `scaffoldType`. Added `attemptNumber` prop shown in header. Word count computed from combined text. |

## Outcome
Implementation matches plan. The component now handles 6 scaffold types:

- **fill_blank**: Renders words of the sentence as Text elements, replaces the word at `blank_index` with a TextInput with underline styling. Shows hint text if provided in scaffold_data.
- **sentence_frame**: Maps over `starters` array, renders each as Text + inline TextInput with flex layout for wrapping.
- **guided_paragraph**: Maps over `starters` array, renders each as a label above a multiline TextInput (min-height 60px).
- **essay/academic/free**: Renders the existing full text area (200px min-height).

`getCombinedText()` logic per type:
- fill_blank: Reconstructs sentence with user's word inserted at blank_index
- sentence_frame: Concatenates all "starter + input" pairs with spaces
- guided_paragraph: Concatenates all "starter + input" pairs with newlines
- Others: Returns `text` state directly

## Side Effects
None beyond the rewrite. Existing writing prompts with `scaffold_type='free'` (default) behave exactly as before.

## Tests
No automated tests. TypeScript compilation verified (zero errors).

## Follow-Up Required
- [x] AIE-012: Seed script creates prompts with appropriate scaffold_type and scaffold_data per CEFR level
