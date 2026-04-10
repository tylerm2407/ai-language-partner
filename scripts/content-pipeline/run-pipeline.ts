/**
 * Content ingestion pipeline orchestrator.
 *
 * Usage:
 *   npx tsx scripts/content-pipeline/run-pipeline.ts --source tatoeba --language es --limit 100
 *   npx tsx scripts/content-pipeline/run-pipeline.ts --source tatoeba --language fr --fill-gaps --limit 500
 *   npx tsx scripts/content-pipeline/run-pipeline.ts --source tatoeba --language de --dry-run
 */

import { PipelineConfig, RawContentItem, ImportResult } from './shared/types';
import { getServiceClient } from './shared/supabase-client';
import { downloadTatoeba, parseTatoeba } from './sources/tatoeba';
import { importVocabulary } from './importers/import-vocabulary';
import { importSentences } from './importers/import-sentences';
import { importGrammarRules } from './importers/import-grammar-rules';
import { fillGapsWithAI } from './generators/fill-gaps';
import { resolve } from 'path';

function parseArgs(): PipelineConfig {
  const args = process.argv.slice(2);
  const config: PipelineConfig = {
    source: '',
    language: '',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
        config.source = args[++i] ?? '';
        break;
      case '--language':
        config.language = args[++i] ?? '';
        break;
      case '--limit':
        config.limit = parseInt(args[++i] ?? '0', 10);
        break;
      case '--fill-gaps':
        config.fillGaps = true;
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
    }
  }

  if (!config.source) {
    console.error('Error: --source is required (e.g., --source tatoeba)');
    process.exit(1);
  }
  if (!config.language) {
    console.error('Error: --language is required (e.g., --language es)');
    process.exit(1);
  }

  return config;
}

async function getCourseMap(language: string): Promise<Map<string, string>> {
  const supabase = getServiceClient();
  const courseMap = new Map<string, string>();

  const { data, error } = await supabase
    .from('courses')
    .select('id, target_language')
    .eq('target_language', language);

  if (error) {
    console.warn(`Could not fetch courses: ${error.message}`);
    return courseMap;
  }

  if (data) {
    for (const course of data) {
      courseMap.set(course.target_language, course.id);
    }
  }

  return courseMap;
}

async function runTatoebaPipeline(config: PipelineConfig): Promise<void> {
  const dataDir = resolve(__dirname, '..', '..', 'data');

  console.log(`\n--- Source: Tatoeba ---`);
  console.log(`Language: ${config.language}`);
  console.log(`Limit: ${config.limit ?? 'none'}`);
  console.log(`Dry run: ${config.dryRun ?? false}`);
  console.log(`Fill gaps: ${config.fillGaps ?? false}\n`);

  // Step 1: Download data
  console.log('Step 1: Downloading Tatoeba data...');
  await downloadTatoeba(config.language, dataDir);

  // Step 2: Parse sentence pairs
  console.log('\nStep 2: Parsing sentence pairs...');
  const items: RawContentItem[] = [];
  const vocabItems: RawContentItem[] = [];
  const sentenceItems: RawContentItem[] = [];
  const grammarItems: RawContentItem[] = [];

  for await (const item of parseTatoeba(config.language, dataDir, config.limit)) {
    items.push(item);

    switch (item.type) {
      case 'word':
      case 'phrase':
        vocabItems.push(item);
        break;
      case 'sentence_pair':
        sentenceItems.push(item);
        break;
      case 'grammar_rule':
        grammarItems.push(item);
        break;
    }
  }

  console.log(
    `\nParsed ${items.length} items: ${vocabItems.length} vocab, ${sentenceItems.length} sentences, ${grammarItems.length} grammar rules`
  );

  if (config.dryRun) {
    console.log('\n[DRY RUN] Would import:');
    console.log(`  - ${vocabItems.length} vocabulary cards`);
    console.log(`  - ${sentenceItems.length} sentence pairs`);
    console.log(`  - ${grammarItems.length} grammar rules`);
    console.log('\nFirst 5 items:');
    for (const item of items.slice(0, 5)) {
      console.log(`  [${item.type}] "${item.nativeText}" → "${item.targetText}" (${item.cefrLevel})`);
    }
    return;
  }

  // Step 3: Import into Supabase
  console.log('\nStep 3: Importing into Supabase...');
  const sourceId = `tatoeba-${config.language}`;
  const courseMap = await getCourseMap(config.language);

  const results: ImportResult[] = [];

  if (vocabItems.length > 0) {
    console.log(`  Importing ${vocabItems.length} vocabulary cards...`);
    results.push(await importVocabulary(vocabItems, sourceId));
  }

  if (sentenceItems.length > 0) {
    console.log(`  Importing ${sentenceItems.length} sentence pairs...`);
    results.push(await importSentences(sentenceItems, sourceId, courseMap));
  }

  if (grammarItems.length > 0) {
    console.log(`  Importing ${grammarItems.length} grammar rules...`);
    results.push(await importGrammarRules(grammarItems, sourceId));
  }

  // Step 4: Optional AI gap-filling
  if (config.fillGaps) {
    console.log('\nStep 4: Filling gaps with AI...');
    const supabase = getServiceClient();

    // Fetch recently inserted exercises that need gap-filling
    const { data: exercises, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('language', config.language)
      .or(
        'exercise_type.eq.multiple_choice,exercise_type.eq.translate_to_target,exercise_type.eq.translate_to_native'
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error(`  Error fetching exercises for gap-filling: ${error.message}`);
    } else if (exercises && exercises.length > 0) {
      await fillGapsWithAI(exercises, config.language, 'A1');
    } else {
      console.log('  No exercises found that need gap-filling');
    }
  }

  // Summary
  const totals = results.reduce(
    (acc, r) => ({
      cardsInserted: acc.cardsInserted + r.cardsInserted,
      cardsUpdated: acc.cardsUpdated + r.cardsUpdated,
      exercisesGenerated: acc.exercisesGenerated + r.exercisesGenerated,
      errors: [...acc.errors, ...r.errors],
    }),
    { cardsInserted: 0, cardsUpdated: 0, exercisesGenerated: 0, errors: [] as string[] }
  );

  console.log('\n=== Pipeline Summary ===');
  console.log(`  Source: ${config.source}`);
  console.log(`  Language: ${config.language}`);
  console.log(`  Cards inserted: ${totals.cardsInserted}`);
  console.log(`  Cards updated: ${totals.cardsUpdated}`);
  console.log(`  Exercises generated: ${totals.exercisesGenerated}`);
  console.log(`  Errors: ${totals.errors.length}`);

  if (totals.errors.length > 0) {
    console.log('\n  Error details:');
    for (const err of totals.errors.slice(0, 20)) {
      console.log(`    - ${err}`);
    }
    if (totals.errors.length > 20) {
      console.log(`    ... and ${totals.errors.length - 20} more`);
    }
  }
}

async function main(): Promise<void> {
  const config = parseArgs();

  console.log('=== Fluenci Content Ingestion Pipeline ===');
  console.log(`Started at: ${new Date().toISOString()}`);

  switch (config.source) {
    case 'tatoeba':
      await runTatoebaPipeline(config);
      break;
    default:
      console.error(`Unknown source: "${config.source}". Supported sources: tatoeba`);
      process.exit(1);
  }

  console.log(`\nFinished at: ${new Date().toISOString()}`);
}

main().catch((e) => {
  console.error('Pipeline failed:', e);
  process.exit(1);
});
