# Execute — Enhanced writing grading rubric

**AIE:** AIE-007

## Files Changed

| File | Action | What Changed |
|------|--------|-------------|
| `supabase/functions/grade-writing/index.ts` | modified | Updated system prompt to request 4x25 rubric + correctedVersion + strengths + improvements. Added C1/C2 to `getCefrExpectations()`. Changed max_tokens: 500 -> 1500. Updated fallback JSON with new fields. |
| `components/writing/WritingFeedbackView.tsx` | rewritten | Complete rewrite. Now displays: attempt indicator, improvement delta badge ("+12 points from last attempt" with green/red coloring), strengths section (green background with checkmark icons), improvements section (yellow background with bulb icons), corrected version section (with create icon), plus existing score circle, category scores, corrections. Props expanded: `previousScore`, `attemptNumber`, `maxAttempts`. "Try Again" button conditionally shown based on `attemptNumber < maxAttempts`. |

## Outcome
Implementation matches plan. Key changes to the system prompt:
- Instruction now requests JSON with `grammar`, `vocabulary`, `coherence`, `task_completion` (0-25 each) plus `total`, `strengths`, `improvements`, `correctedVersion`
- Still requests the 5 detailed 0-100 sub-scores for backward compatibility with score bars
- C1 expectations: formal essays 500+ words, subjunctive, passive voice, complex subordination
- C2 expectations: native-level, sophisticated vocabulary, flawless grammar

WritingFeedbackView improvement delta uses the previous attempt's average score vs current, displayed as "+N points" (green) or "-N points" (red) in a badge below the score circle.

## Side Effects
- Grading cost per submission increases ~3x due to larger response (1500 vs 500 tokens). Still under $0.01 per grading with Haiku.
- Existing submissions without `correctedVersion`/`strengths`/`improvements` display gracefully (null checks in component).

## Tests
No automated tests. Edge function tested via type compilation. Component tested via type compilation.

## Follow-Up Required
- [ ] Deploy updated edge function: `npx supabase functions deploy grade-writing`
