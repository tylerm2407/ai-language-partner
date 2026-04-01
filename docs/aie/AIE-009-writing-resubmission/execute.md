# Execute — Writing resubmission + attempt tracking

**AIE:** AIE-009

## Files Changed

| File | Action | What Changed |
|------|--------|-------------|
| `app/(app)/learn/writing/[promptId].tsx` | rewritten | Full rewrite. Loads prompt + past submissions in parallel on mount. Calculates attemptNumber (max previous + 1). Tracks previousScore from latest graded submission. handleSubmit passes attemptNumber to submitWriting(). Awards XP: base by CEFR (A1=5...C2=30) + score bonus (overallScore * 15). handleTryAgain calculates previous score from current feedback, increments attempt, resets state. Passes attemptNumber to WritingExercise, previousScore/attemptNumber/maxAttempts to WritingFeedbackView. |

## Outcome
Implementation matches plan. The resubmission flow:
1. Mount: parallel load of prompt + past submissions
2. If past submissions exist: attemptNumber = max(attempt_numbers) + 1, previousScore = latest scored submission's overallScore
3. Submit: saves with `attempt_number`, grades, awards XP
4. Feedback view: shows delta if previousScore exists, shows "Try Again" if attemptNumber < maxAttempts
5. Try again: stores current feedback's average as previousScore, increments attemptNumber, clears feedback
6. XP formula: `baseXp[cefrLevel] + Math.round(overallScore * 15)`, e.g. B1 + 80% score = 15 + 12 = 27 XP

Note: The TODO `targetLanguage: 'es'` still hardcoded in the grading call (pre-existing issue, not introduced in this change).

## Side Effects
None beyond the rewrite. Existing submissions are backward compatible (attempt_number defaults to 1).

## Tests
No automated tests. TypeScript compilation verified.

## Follow-Up Required
- [ ] TODO: Get targetLanguage from course context instead of hardcoding 'es'
