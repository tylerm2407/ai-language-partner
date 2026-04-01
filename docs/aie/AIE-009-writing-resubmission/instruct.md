# Instruct — Writing resubmission + attempt tracking

**AIE:** AIE-009

## Directive
> "Update app/(app)/learn/writing/[promptId].tsx: Load past submissions on mount via fetchWritingSubmissionsByPrompt. Calculate attemptNumber from max previous + 1. Track previousScore. Pass attemptNumber to WritingExercise, previousScore/attemptNumber/maxAttempts to WritingFeedbackView. 'Try Again' increments attempt, stores previous score, resets feedback. Submit with attemptNumber. Award XP: A1=5, A2=10, B1=15, B2=20, C1=25, C2=30 base + (overallScore * 15) bonus via addXp()."

## Context Provided
- `app/(app)/learn/writing/[promptId].tsx` — existing writing screen
- `lib/supabase-queries.ts` — `fetchWritingSubmissionsByPrompt()`, `submitWriting()`, `addXp()`
- `components/writing/WritingExercise.tsx` — updated with attemptNumber prop (AIE-008)
- `components/writing/WritingFeedbackView.tsx` — updated with previousScore/attemptNumber/maxAttempts props (AIE-007)

## Scope
IN scope: [promptId].tsx rewrite, attempt tracking, XP awards, improvement delta
OUT of scope: Writing prompt creation, writing analytics dashboard, writing streak tracking
