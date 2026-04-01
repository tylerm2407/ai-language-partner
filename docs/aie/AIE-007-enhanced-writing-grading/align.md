# Align — Enhanced writing grading rubric

**AIE:** AIE-007
**Date:** 2026-03-31
**Severity:** major
**Domain:** ai

## Problem
The existing `grade-writing` edge function returns 5 independent 0-100 scores but lacks:
1. A **corrected version** of the submission — learners can't see how their text should have been written
2. **Structured strengths/improvements** — feedback is a single paragraph, not actionable items
3. **C1/C2 level expectations** — grading caps at B2 expectations
4. The max_tokens (500) is too low for the new response format

## Decision
Enhance the `grade-writing` edge function with:
1. **New rubric structure**: 4 categories of 25 points each (grammar, vocabulary, coherence, task_completion) totaling 100, alongside the existing 5 detailed sub-scores
2. **`correctedVersion`**: Full rewrite of the submission in correct target language
3. **`strengths`**: Array of 3 specific things done well
4. **`improvements`**: Array of 3 specific areas to focus on
5. **C1/C2 expectations**: Added to `getCefrExpectations()` function
6. **Increased `max_tokens`**: 500 -> 1500 to accommodate longer response

## Why This Approach
The corrected version is the single highest-value addition for language learners — seeing the "right answer" is how people learn. Structured strengths/improvements are more actionable than a paragraph of feedback. The 4x25 rubric gives a cleaner total while keeping detailed sub-scores for the progress bars.

Alternative considered: Separate API call for corrected version. Rejected because it doubles API cost and latency for every grading. A single prompt with more tokens is more efficient.

Alternative considered: Using a larger model (Sonnet) for better grading. Rejected because Haiku produces good enough results and costs 10x less.

## Impact
- Modified `supabase/functions/grade-writing/index.ts` — system prompt, token limit, fallback parsing
- Updated `WritingFeedback` type in `types/index.ts` (AIE-001) — added `correctedVersion`, `strengths`, `improvements`
- WritingFeedbackView component needs update to display new fields (AIE-007 scope)
- Response JSON is backward-compatible (new fields are additive)

## Success Criteria
- Grading response includes `correctedVersion` with the full corrected text
- `strengths` and `improvements` arrays have 3 items each
- C1/C2 prompts get appropriate expectations in the system prompt
- Existing A1-B2 grading continues to work correctly
- Response fits within 1500 tokens
