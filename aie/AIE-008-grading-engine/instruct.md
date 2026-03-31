# AIE-008 — Grading Engine — Instruct

> *This is a retroactive AIE entry. The directive below is reconstructed from the implemented changes, not captured at the time of implementation.*

## Directive

### Confusable Pairs Library (`lib/confusable-pairs.ts`)

Create a lookup of commonly confused word pairs per language:
- Spanish: ser/estar, por/para, saber/conocer, etc.
- French: savoir/connaître, bon/bien, etc.
- German: sein/haben, kennen/wissen, etc.
- Italian: sapere/conoscere, buono/bene, etc.
- Portuguese: ser/estar, saber/conhecer, etc.

### Enhanced Grading (`lib/grading.ts`)

- Before accepting a fuzzy match, check if the user's answer and the correct answer form a confusable pair
- If confusable, require exact match (no fuzzy tolerance)
- Preserve existing Levenshtein-based fuzzy matching for non-confusable words

### Multi-Source Review Queue (`hooks/useReviewQueue.ts`)

- Source review cards from lesson exercises AND reading annotations
- Prioritize overdue cards, then reading-sourced cards, then new cards
- Respect daily new card limit from user settings

### Type Updates (`types/index.ts`)

- Add types: `ReadingPassage`, `ReadingAnnotation`, `ReadingQuestion`, `WritingPrompt`, `UserWritingSubmission`
- Add new exercise types to `ExerciseType` union
- Update `ReviewCard` type for multi-source support

### Config Updates (`config/app.ts`, `lib/plans.ts`, `lib/ai.ts`)

- Update plan limits for reading/writing features
- Update AI model references for grade-writing
- Add feature flags for new modules

## Constraints

- Confusable pairs must be extensible (easy to add new languages/pairs)
- Grading changes must not break existing exercise scoring
- Type changes must be backwards-compatible with existing stored data
