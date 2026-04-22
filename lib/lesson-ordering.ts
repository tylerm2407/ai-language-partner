/**
 * Lesson exercise ordering helper (research.md §13 + improvements.md §A.2.3).
 *
 * Applied Linguistics / Nation: a well-designed lesson progresses from
 * recognition → retrieval → production within the same session. Many
 * authored lessons in this codebase are ordered by thematic flow rather
 * than by cognitive load. This module provides a pure reorder that
 * enforces the recognition-first ordering without changing the overall
 * set of exercises.
 *
 * Hook usage: call `orderedExercises = orderExercisesForCognitiveLoad(lesson.exercises)`
 * when feeding LessonRunner. If the lesson is already in a sensible
 * order (detected via `lessonIsAlreadyOrdered`), skip the reorder.
 */

import type { Exercise, ExerciseType } from '../types';

/** Cognitive load bucket, lower = easier / earlier in the lesson. */
function cognitiveBucket(type: ExerciseType): number {
  switch (type) {
    // Recognition — picking from options, minimal production
    case 'multiple_choice':
    case 'listening_choice':
    case 'collocation_match':
      return 0;

    // Assisted retrieval — cloze / fill-blank with constrained response
    case 'cloze_deletion':
    case 'fill_blank':
    case 'sentence_construction':
      return 1;

    // Full retrieval — transcription or reproduction of known material
    case 'listening_type':
    case 'dictation':
    case 'word_form':
    case 'error_correction':
      return 2;

    // Directed production — learner generates structured target-language output
    case 'translate_to_native':
    case 'translate_to_target':
    case 'sentence_transformation':
      return 3;

    // Free production / interaction — open-ended output
    case 'speaking':
    case 'mini_dialogue':
    case 'free_production':
      return 4;

    default:
      return 2;
  }
}

/**
 * Sort exercises so recognition leads and production trails, while
 * preserving the original order within the same bucket.
 * Pure — does not mutate input.
 */
export function orderExercisesForCognitiveLoad(exercises: Exercise[]): Exercise[] {
  return exercises
    .map((ex, originalIdx) => ({ ex, originalIdx, bucket: cognitiveBucket(ex.type) }))
    .sort((a, b) => (a.bucket - b.bucket) || (a.originalIdx - b.originalIdx))
    .map(({ ex }) => ex);
}

/**
 * True if the lesson already progresses from lower to higher cognitive load
 * (allowing for plateaus). We use this to avoid reordering lessons that an
 * author has deliberately sequenced (e.g., review-then-new patterns).
 */
export function lessonIsAlreadyOrdered(exercises: Exercise[]): boolean {
  let prev = -1;
  for (const ex of exercises) {
    const b = cognitiveBucket(ex.type);
    if (b < prev - 1) return false; // never drop more than one bucket
    prev = Math.max(prev, b);
  }
  return true;
}

/**
 * Verify the lesson contains at least one production exercise
 * (Swain output hypothesis — improvements.md §A.2). A well-formed
 * lesson should fail this check only if authored as an
 * introductory-only lesson.
 */
export function lessonHasProductionExercise(exercises: Exercise[]): boolean {
  return exercises.some((ex) => cognitiveBucket(ex.type) >= 3);
}
