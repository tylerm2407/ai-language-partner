# AIE-002 — New Exercise Types — Instruct

> *This is a retroactive AIE entry. The directive below is reconstructed from the implemented changes, not captured at the time of implementation.*

## Directive

Create 4 new exercise components following the existing pattern in `components/lesson/`. Update LessonRunner to route all 9 exercise types and integrate gamification (hearts, XP, animations).

### New Components

1. **ClozeExercise** — Sentence with blanked word(s); user selects or types the missing word
2. **DictationExercise** — Audio plays; user types what they heard (full sentence)
3. **ErrorCorrectionExercise** — Sentence with deliberate error; user identifies and corrects it
4. **SentenceConstructionExercise** — Scrambled words; user arranges them into correct order

### LessonRunner Updates

- Add case handlers for new exercise types in the render switch
- Integrate heart system (deduct on incorrect, block on 0 hearts)
- Award XP on exercise completion and lesson finish
- Trigger animations on correct/incorrect answers

## Constraints

- Each component must accept the same base props interface as existing exercises
- Grading must go through `lib/grading.ts`, not inline in components
- No new dependencies for exercise rendering
