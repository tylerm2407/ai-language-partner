# Skill: Add a New Learning Feature / Exercise Type

## When to Use
When Tyler asks to add a new exercise type, learning mode, or practice activity.

## Steps

1. **Understand the feature**
   - What skill does it train? (listening, speaking, reading, writing, vocabulary, grammar)
   - What's the user interaction? (tap, type, speak, drag)
   - How does it integrate with SRS? (does it produce reviewable cards?)
   - What data does it need? (audio, images, translations, AI responses)

2. **Design the data model**
   - Add new exercise type to `types/index.ts` `ExerciseType` enum.
   - Define any new fields needed on `Card` or `Lesson` types.
   - Create migration if schema changes are needed.

3. **Implement the scoring logic**
   - Add grading function in `lib/srs.ts` or a new `lib/<feature>.ts` module.
   - Write unit tests for the grading/scoring logic FIRST.
   - Handle edge cases: empty input, timeout, partial answers.

4. **Build the UI component**
   - Create component in `components/lesson/Exercise<Name>.tsx`.
   - Follow mobile-ui rules: safe areas, touch targets, accessibility.
   - Add animations for feedback (correct/incorrect).
   - Support offline mode if possible.

5. **Wire into the lesson/review flow**
   - Add the new exercise type to the lesson renderer in `app/(app)/learn/[lessonId].tsx`.
   - Add to review queue logic if it's SRS-compatible.
   - Test the full flow: lesson start → exercise → grading → summary.

6. **Audio integration (if applicable)**
   - Use `useAudioPlayer` hook for playback.
   - Use `useAudioRecorder` hook for speech exercises.
   - Ensure audio loads/plays correctly on iOS.

7. **Quality check**
   - `npx tsc --noEmit` — must pass.
   - `npm test` — all tests pass, new tests included.
   - `npm run lint` — no new warnings.
   - Manual test on iOS simulator.
   - Verify accessibility with VoiceOver.

8. **Summarize for commit/PR**
   - List files changed, new types added, migration (if any).
   - Note any follow-up work needed.
