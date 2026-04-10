import { getServiceClient } from '../shared/supabase-client';
import { RawContentItem, ImportResult } from '../shared/types';

/**
 * Import vocabulary cards into Supabase.
 *
 * Upserts cards with dedup key: (source_id, source_item_id).
 * Sets provenance fields: source_type='imported', source_id, license.
 */
export async function importVocabulary(
  items: RawContentItem[],
  sourceId: string
): Promise<ImportResult> {
  const supabase = getServiceClient();
  const result: ImportResult = {
    cardsInserted: 0,
    cardsUpdated: 0,
    exercisesGenerated: 0,
    errors: [],
  };

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const rows = batch
      .filter((item) => item.type === 'word' || item.type === 'phrase')
      .map((item) => ({
        source_type: 'imported',
        source_id: sourceId,
        source_item_id: item.sourceItemId ?? null,
        language: item.language,
        cefr_level: item.cefrLevel ?? 'A1',
        native_text: item.nativeText,
        target_text: item.targetText,
        part_of_speech: item.partOfSpeech ?? null,
        example_sentence: item.exampleSentence ?? null,
        example_translation: item.exampleTranslation ?? null,
        tags: item.tags,
        license: 'open',
      }));

    if (rows.length === 0) continue;

    const { data, error } = await supabase
      .from('cards')
      .upsert(rows, {
        onConflict: 'source_id,source_item_id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      result.errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
    } else if (data) {
      // Upsert doesn't distinguish insert vs update in the response,
      // so we count all as inserted for simplicity
      result.cardsInserted += data.length;
    }
  }

  console.log(
    `[import-vocabulary] Inserted ${result.cardsInserted} cards, ${result.errors.length} errors`
  );
  return result;
}
