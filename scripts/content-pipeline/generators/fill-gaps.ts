import { getServiceClient } from '../shared/supabase-client';

/**
 * Fill gaps in exercises using AI via the generate-content Supabase edge function.
 *
 * For exercises missing distractors (multiple_choice with < 4 options),
 * calls the edge function to generate plausible wrong answers.
 *
 * For exercises missing accepted_answers, calls the edge function
 * to generate alternative correct phrasings.
 */
export async function fillGapsWithAI(
  exercises: any[],
  language: string,
  cefrLevel: string
): Promise<void> {
  const supabase = getServiceClient();

  const needsDistractors = exercises.filter(
    (ex) =>
      ex.exercise_type === 'multiple_choice' &&
      (!ex.options || ex.options.length < 4)
  );

  const needsAccepted = exercises.filter(
    (ex) =>
      (ex.exercise_type === 'translate_to_target' ||
        ex.exercise_type === 'translate_to_native') &&
      (!ex.accepted_answers || ex.accepted_answers.length <= 1)
  );

  console.log(
    `[fill-gaps] ${needsDistractors.length} exercises need distractors, ${needsAccepted.length} need accepted answers`
  );

  // Process distractor requests in batches of 10
  for (let i = 0; i < needsDistractors.length; i += 10) {
    const batch = needsDistractors.slice(i, i + 10);

    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          type: 'distractors',
          language,
          cefrLevel,
          items: batch.map((ex) => ({
            exerciseId: ex.id,
            correctAnswer: ex.correct_answer,
            prompt: ex.prompt,
            count: 3,
          })),
        },
      });

      if (error) {
        console.error(`[fill-gaps] Distractor generation error: ${error.message}`);
        continue;
      }

      if (data?.results) {
        for (const item of data.results) {
          const exercise = batch.find((ex) => ex.id === item.exerciseId);
          if (exercise && item.distractors) {
            exercise.options = [exercise.correct_answer, ...item.distractors];
            // Shuffle options
            for (let j = exercise.options.length - 1; j > 0; j--) {
              const k = Math.floor(Math.random() * (j + 1));
              [exercise.options[j], exercise.options[k]] = [
                exercise.options[k],
                exercise.options[j],
              ];
            }
          }
        }
      }
    } catch (err) {
      console.error(`[fill-gaps] Distractor batch ${i / 10 + 1} failed:`, err);
    }
  }

  // Process accepted-answer requests in batches of 10
  for (let i = 0; i < needsAccepted.length; i += 10) {
    const batch = needsAccepted.slice(i, i + 10);

    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          type: 'accepted_answers',
          language,
          cefrLevel,
          items: batch.map((ex) => ({
            exerciseId: ex.id,
            correctAnswer: ex.correct_answer,
            prompt: ex.prompt,
          })),
        },
      });

      if (error) {
        console.error(`[fill-gaps] Accepted answers error: ${error.message}`);
        continue;
      }

      if (data?.results) {
        for (const item of data.results) {
          const exercise = batch.find((ex) => ex.id === item.exerciseId);
          if (exercise && item.acceptedAnswers) {
            exercise.accepted_answers = [
              exercise.correct_answer,
              ...item.acceptedAnswers,
            ];
          }
        }
      }
    } catch (err) {
      console.error(`[fill-gaps] Accepted answers batch ${i / 10 + 1} failed:`, err);
    }
  }

  // Update exercises in Supabase with filled data
  const toUpdate = [...needsDistractors, ...needsAccepted].filter((ex) => ex.id);
  if (toUpdate.length > 0) {
    console.log(`[fill-gaps] Updating ${toUpdate.length} exercises in database...`);
    for (const ex of toUpdate) {
      const { error } = await supabase
        .from('exercises')
        .update({
          options: ex.options,
          accepted_answers: ex.accepted_answers,
        })
        .eq('id', ex.id);

      if (error) {
        console.error(`[fill-gaps] Update error for exercise ${ex.id}: ${error.message}`);
      }
    }
  }

  console.log('[fill-gaps] Done');
}
