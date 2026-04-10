import { getServiceClient } from '../shared/supabase-client';
import { RawContentItem, ImportResult } from '../shared/types';
import { generateExercisesFromCards } from '../generators/generate-exercises';

/**
 * Import sentence pairs into Supabase and auto-generate exercises.
 *
 * Creates cards for sentence pairs and generates:
 *   - translate_to_target
 *   - translate_to_native
 *   - cloze_deletion
 */
export async function importSentences(
  items: RawContentItem[],
  sourceId: string,
  courseMap: Map<string, string>
): Promise<ImportResult> {
  const supabase = getServiceClient();
  const result: ImportResult = {
    cardsInserted: 0,
    cardsUpdated: 0,
    exercisesGenerated: 0,
    errors: [],
  };

  const sentenceItems = items.filter((item) => item.type === 'sentence_pair');
  if (sentenceItems.length === 0) return result;

  // Process in batches of 50 (sentences are larger than vocab)
  const batchSize = 50;
  for (let i = 0; i < sentenceItems.length; i += batchSize) {
    const batch = sentenceItems.slice(i, i + batchSize);

    const rows = batch.map((item) => ({
      source_type: 'imported',
      source_id: sourceId,
      source_item_id: item.sourceItemId ?? null,
      language: item.language,
      cefr_level: item.cefrLevel ?? 'A1',
      native_text: item.nativeText,
      target_text: item.targetText,
      content_type: 'sentence_pair',
      tags: item.tags,
      license: 'cc-by-2.0',
    }));

    const { data: insertedCards, error } = await supabase
      .from('cards')
      .upsert(rows, {
        onConflict: 'source_id,source_item_id',
        ignoreDuplicates: false,
      })
      .select('*');

    if (error) {
      result.errors.push(`Sentence batch ${i / batchSize + 1}: ${error.message}`);
      continue;
    }

    if (!insertedCards || insertedCards.length === 0) continue;
    result.cardsInserted += insertedCards.length;

    // Generate exercises for inserted cards
    const courseId = courseMap.get(batch[0].language);
    if (!courseId) {
      result.errors.push(
        `No course found for language "${batch[0].language}" — skipping exercise generation`
      );
      continue;
    }

    // Use a placeholder lesson ID — exercises can be assigned to lessons later
    const exercises = generateExercisesFromCards(insertedCards, courseId);

    if (exercises.length > 0) {
      const { data: insertedExercises, error: exError } = await supabase
        .from('exercises')
        .insert(exercises)
        .select('id');

      if (exError) {
        result.errors.push(`Exercise insert: ${exError.message}`);
      } else if (insertedExercises) {
        result.exercisesGenerated += insertedExercises.length;
      }
    }
  }

  console.log(
    `[import-sentences] Inserted ${result.cardsInserted} cards, generated ${result.exercisesGenerated} exercises, ${result.errors.length} errors`
  );
  return result;
}
