# AIE-002 — New Exercise Types — Execute

## Files Created

- `components/lesson/ClozeExercise.tsx` — Cloze deletion exercise component
- `components/lesson/DictationExercise.tsx` — Dictation/transcription exercise component
- `components/lesson/ErrorCorrectionExercise.tsx` — Error correction exercise component
- `components/lesson/SentenceConstructionExercise.tsx` — Sentence reordering exercise component

## Files Modified

- `components/lesson/LessonRunner.tsx` — Added routing for 9 exercise types, hearts/XP integration, animation hooks
- `components/lesson/SpeakingExercise.tsx` — Updated to align with new exercise interface pattern
- `components/lesson/ExerciseCard.tsx` — Minor updates for new exercise type support
- `components/lesson/FillBlankExercise.tsx` — Alignment with updated grading interface
- `components/lesson/ListeningExercise.tsx` — Alignment with updated grading interface
- `components/lesson/MultipleChoice.tsx` — Alignment with updated grading interface
- `components/lesson/TranslationExercise.tsx` — Alignment with updated grading interface

## Verification

- [x] All 9 exercise types render in LessonRunner
- [x] Grading callbacks fire correctly for each type
- [x] Hearts deducted on wrong answer
- [x] XP awarded on lesson completion
- [x] Animations trigger on correct/incorrect feedback
