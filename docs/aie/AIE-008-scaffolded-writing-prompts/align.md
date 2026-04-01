# Align — Scaffolded writing prompt UI

**AIE:** AIE-008
**Date:** 2026-03-31
**Severity:** major
**Domain:** mobile

## Problem
The existing `WritingExercise` component only has a single free-form text input. This works for B2+ learners but is intimidating for beginners. A1/A2 learners need structured scaffolding — fill-in-the-blank, sentence frames, guided paragraph starters — to build confidence before attempting free writing. The CEFR framework prescribes a progression from controlled to free production.

## Decision
Modify `WritingExercise` to render different input UIs based on the `scaffold_type` field on the `WritingPrompt`:

| CEFR | scaffold_type | UI Behavior |
|------|--------------|-------------|
| A1 | `fill_blank` | Show sentence with inline text input at blank position |
| A1 | `sentence_frame` | Show starter phrases with text inputs after each |
| A2 | `guided_paragraph` | Show starter sentences with expandable text areas |
| B1 | `guided_paragraph` | Topic + outline starters |
| B2 | `essay` | Full text area, no scaffolding |
| C1+ | `academic` | Full text area, no scaffolding |
| Any | `free` | Full text area (existing behavior) |

The `scaffold_data` JSONB field on the prompt stores scaffold-specific configuration:
- `fill_blank`: `{ sentence, blank_index, hint }`
- `sentence_frame`: `{ starters: string[] }`
- `guided_paragraph`: `{ starters: string[] }`

The component combines scaffold inputs into a single text string for grading.

## Why This Approach
Scaffolding is a well-established language teaching methodology. Fill-blank is the easiest (one word), sentence frames are next (complete a thought), guided paragraphs give structure while allowing creativity. This progression mirrors how language teachers scaffold writing in classrooms.

Alternative considered: Separate components per scaffold type. Rejected because the submission/grading logic is identical — only the input UI differs. A single component with conditional rendering is cleaner.

Alternative considered: Client-side scaffold type inference from CEFR level. Rejected because the same level can have different scaffold types (A1 has both fill_blank and sentence_frame), so it must be prompt-level metadata.

## Impact
- Rewrites `components/writing/WritingExercise.tsx` — new sub-components, combined text logic
- 3 new internal sub-components: `FillBlankInput`, `SentenceFrameInput`, `GuidedParagraphInput`
- Props expanded with `attemptNumber`
- Completion detection changes: scaffold types check if all inputs are filled vs free text length > 0
- Word count computed from combined text across all scaffold inputs

## Success Criteria
- `fill_blank` prompt shows sentence with inline input at correct position
- `sentence_frame` prompt shows starters with text inputs
- `guided_paragraph` prompt shows starters with expandable text areas
- `essay`/`academic`/`free` prompts show full text area (existing behavior preserved)
- Combined text from scaffold inputs is submitted for grading
- Word count reflects all inputs combined
