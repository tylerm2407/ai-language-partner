# AIE-004 — Writing Module — Execute

## Files Created

- `components/writing/WritingExercise.tsx` — Unified writing component (prompt + editor + submission + feedback)
- `app/(app)/learn/writing/[promptId].tsx` — Writing screen route
- `app/(app)/learn/writing/_layout.tsx` — Writing stack layout (moved from `app/(app)/practice/writing/_layout.tsx`)

## Files Modified

- `components/writing/WritingFeedbackView.tsx` — Updated to work with new `grade-writing` response format

## Files Deleted

- `components/writing/PromptCard.tsx` — Replaced by WritingExercise
- `components/writing/WritingEditor.tsx` — Replaced by WritingExercise
- `app/(app)/practice/writing/[promptId].tsx` — Moved to Learn tab
- `app/(app)/practice/writing/history.tsx` — Writing history removed
- `app/(app)/practice/writing/index.tsx` — Writing index removed

## Verification

- [x] Writing prompt displays with instructions and word count target
- [x] Live word count updates as user types
- [x] Submit button disabled until minimum word count met
- [x] AI grading request fires on submission
- [x] Feedback renders inline after grading completes
