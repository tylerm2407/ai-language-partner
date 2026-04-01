# Align — Writing resubmission + attempt tracking

**AIE:** AIE-009
**Date:** 2026-03-31
**Severity:** moderate
**Domain:** mobile

## Problem
The writing screen treats every submission as a one-off — there's no concept of improving on a previous attempt. If a learner submits a writing exercise, sees their feedback, and wants to try again, the new submission has no link to the previous one and no way to show improvement over time. The `max_attempts` field on prompts exists (AIE-001) but isn't enforced in the UI.

## Decision
Update `app/(app)/learn/writing/[promptId].tsx` to:
1. Load past submissions for this prompt on mount via `fetchWritingSubmissionsByPrompt()`
2. Calculate `attemptNumber` from the max previous attempt + 1
3. Track `previousScore` from the latest graded submission for improvement delta display
4. Pass `attemptNumber` to WritingExercise and `previousScore`/`attemptNumber`/`maxAttempts` to WritingFeedbackView
5. "Try Again" increments `attemptNumber` and stores previous score
6. Submit with `attemptNumber` parameter to `submitWriting()`
7. Award XP based on CEFR level: A1=5, A2=10, B1=15, B2=20, C1=25, C2=30 + score bonus (overallScore * 15)

## Why This Approach
Attempt tracking gives learners a clear sense of progress — seeing "+12 points from last attempt" is motivating. Capping attempts (default 3) prevents infinite retries on the same prompt while still allowing meaningful improvement. XP scales with CEFR level to reward harder writing.

Alternative considered: Unlimited retries. Rejected because it could be gamed for XP and doesn't encourage moving on to new content.

Alternative considered: No XP for writing (only for vocab lessons). Rejected because it makes writing feel unrewarding compared to other activities.

## Impact
- Rewrites `app/(app)/learn/writing/[promptId].tsx`
- Uses `fetchWritingSubmissionsByPrompt()` from AIE-001
- Uses `addXp()` for XP awards
- WritingFeedbackView "Try Again" conditionally shown based on attempt limit

## Success Criteria
- First attempt shows "Attempt 1 of 3" in header
- After grading, "Try Again" button appears if attempts remain
- Trying again shows "Attempt 2 of 3" and submits with `attempt_number=2`
- Feedback view shows improvement delta ("+ points" or "- points") between attempts
- "Try Again" hidden when max attempts reached
- XP awarded on each grading
