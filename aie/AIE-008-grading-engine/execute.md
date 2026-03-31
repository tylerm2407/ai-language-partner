# AIE-008 — Grading Engine — Execute

## Files Created

- `lib/confusable-pairs.ts` — Confusable word pair lookup for Spanish, French, German, Italian, Portuguese

## Files Modified

- `lib/grading.ts` — Added confusable-pair check before fuzzy match acceptance
- `lib/ai.ts` — Updated AI model references and prompt templates for grade-writing
- `lib/plans.ts` — Updated plan limits to include reading/writing quotas
- `hooks/useReviewQueue.ts` — Multi-source card fetching (lessons + reading annotations)
- `types/index.ts` — Added ReadingPassage, ReadingAnnotation, ReadingQuestion, WritingPrompt types; expanded ExerciseType union
- `config/app.ts` — Feature flags and configuration for new modules

## Verification

- [x] Confusable pairs loaded for 5 languages
- [x] Grading rejects confusable-pair false positives
- [x] Review queue fetches cards from lessons and reading
- [x] All new types compile without errors
- [x] Config changes don't break existing functionality
