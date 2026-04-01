# Instruct — Enhanced writing grading rubric

**AIE:** AIE-007

## Directive
> "Enhance supabase/functions/grade-writing/index.ts with: 1) 4-category rubric (grammar, vocabulary, coherence, task_completion) of 25 each totaling 100, keeping the existing 5 sub-scores. 2) correctedVersion field — the entire submission rewritten correctly. 3) strengths array (3 items) and improvements array (3 items). 4) Add C1 and C2 expectations to getCefrExpectations(). 5) Increase max_tokens from 500 to 1500. 6) Update fallback JSON parse to include new fields. Update the WritingFeedbackView component to display correctedVersion, strengths, improvements, and improvement delta between attempts."

## Context Provided
- `supabase/functions/grade-writing/index.ts` — existing edge function with system prompt, language rules, CEFR expectations
- `components/writing/WritingFeedbackView.tsx` — existing feedback display component
- `types/index.ts` — WritingFeedback type (already updated with new fields in AIE-001)
- `DESIGN.md` — color tokens for feedback display

## Scope
IN scope: Edge function prompt changes, token limit increase, fallback update, WritingFeedbackView rewrite
OUT of scope: Changing the grading model, adding new language-specific rules, client-side caching
