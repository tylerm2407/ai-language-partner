/**
 * Generate exercises from cards.
 *
 * Each card can produce multiple exercise types based on available metadata:
 *   - Word + distractors → multiple_choice
 *   - Word + sentence blank → fill_blank
 *   - Sentence pair → translate_to_target, translate_to_native
 *   - Word alone → speaking
 */
export function generateExercisesFromCards(cards: any[], lessonId: string): any[] {
  const exercises: any[] = [];

  for (const card of cards) {
    const baseExercise = {
      card_id: card.id,
      lesson_id: lessonId,
      language: card.language,
      cefr_level: card.cefr_level,
    };

    // Sentence pairs get translation exercises
    if (card.content_type === 'sentence_pair' || (card.native_text && card.target_text)) {
      // Translate native → target
      exercises.push({
        ...baseExercise,
        exercise_type: 'translate_to_target',
        prompt: card.native_text,
        correct_answer: card.target_text,
        accepted_answers: [card.target_text],
      });

      // Translate target → native
      exercises.push({
        ...baseExercise,
        exercise_type: 'translate_to_native',
        prompt: card.target_text,
        correct_answer: card.native_text,
        accepted_answers: [card.native_text],
      });
    }

    // Words/phrases get multiple choice and fill-in-blank
    if (card.part_of_speech || card.content_type === 'word' || card.content_type === 'phrase') {
      // Multiple choice (distractors to be filled later)
      exercises.push({
        ...baseExercise,
        exercise_type: 'multiple_choice',
        prompt: card.native_text,
        correct_answer: card.target_text,
        options: [card.target_text], // distractors added later
        accepted_answers: [card.target_text],
      });
    }

    // Fill blank if we have an example sentence
    if (card.example_sentence && card.target_text) {
      const blankSentence = card.example_sentence.replace(
        new RegExp(escapeRegex(card.target_text), 'gi'),
        '___'
      );

      if (blankSentence !== card.example_sentence) {
        exercises.push({
          ...baseExercise,
          exercise_type: 'fill_blank',
          prompt: blankSentence,
          correct_answer: card.target_text,
          accepted_answers: [card.target_text],
          context_sentence: card.example_translation ?? null,
        });
      }
    }

    // Speaking exercise for any card with target text
    if (card.target_text) {
      exercises.push({
        ...baseExercise,
        exercise_type: 'speaking',
        prompt: card.target_text,
        correct_answer: card.target_text,
        accepted_answers: [card.target_text],
      });
    }
  }

  return exercises;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
