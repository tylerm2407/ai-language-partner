# AIE-004 — Writing Module — Instruct

> *This is a retroactive AIE entry. The directive below is reconstructed from the implemented changes, not captured at the time of implementation.*

## Directive

Create a unified `WritingExercise` component that replaces the old `PromptCard` + `WritingEditor` two-step flow. The component should:

1. Display the writing prompt (topic, instructions, minimum word count)
2. Provide a text input area with live word count
3. Track writing duration from first keystroke
4. Submit to `grade-writing` Edge Function on completion
5. Display structured feedback from `WritingFeedbackView`

### Route Structure

- `app/(app)/learn/writing/[promptId].tsx` — Writing screen with `WritingExercise`
- `app/(app)/learn/writing/_layout.tsx` — Writing stack layout (moved from practice)

## Constraints

- Minimum word count must be met before submission is enabled
- AI grading is async — show loading state during grading
- Feedback view is updated (not replaced) to work with new response format
