import { getServiceClient } from '../shared/supabase-client';
import { RawContentItem, ImportResult } from '../shared/types';

/**
 * Import grammar rules into Supabase.
 *
 * Upserts into grammar_rules table with dedup on (language, rule_name).
 * rule_name is derived from the targetText field of the RawContentItem.
 */
export async function importGrammarRules(
  rules: RawContentItem[],
  sourceId: string
): Promise<ImportResult> {
  const supabase = getServiceClient();
  const result: ImportResult = {
    cardsInserted: 0,
    cardsUpdated: 0,
    exercisesGenerated: 0,
    errors: [],
  };

  const grammarItems = rules.filter((r) => r.type === 'grammar_rule');
  if (grammarItems.length === 0) return result;

  const batchSize = 50;
  for (let i = 0; i < grammarItems.length; i += batchSize) {
    const batch = grammarItems.slice(i, i + batchSize);

    const rows = batch.map((item) => ({
      language: item.language,
      rule_name: item.targetText,
      explanation: item.nativeText,
      cefr_level: item.cefrLevel ?? 'A1',
      example_sentence: item.exampleSentence ?? null,
      example_translation: item.exampleTranslation ?? null,
      tags: item.tags,
      source_id: sourceId,
      source_item_id: item.sourceItemId ?? null,
    }));

    const { data, error } = await supabase
      .from('grammar_rules')
      .upsert(rows, {
        onConflict: 'language,rule_name',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      result.errors.push(`Grammar batch ${i / batchSize + 1}: ${error.message}`);
    } else if (data) {
      result.cardsInserted += data.length;
    }
  }

  console.log(
    `[import-grammar] Inserted ${result.cardsInserted} rules, ${result.errors.length} errors`
  );
  return result;
}
