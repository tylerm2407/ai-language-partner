/**
 * Seed script for reading & writing content.
 * Run with: npx ts-node scripts/seed-reading-content.ts
 * Or: npx tsx scripts/seed-reading-content.ts
 *
 * This populates the reading_books table with AI-generated stories
 * and seeds scaffolded writing prompts for all 8 languages.
 *
 * Note: Gutenberg/Wikisource ingestion requires the app's supabase client
 * and is designed to be run from the app context. For those, use the
 * lib/gutenberg.ts and lib/wikisource.ts functions directly.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const LANGUAGES = ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru'];

// ── Scaffolded Writing Prompts ───────────────────────────────────

interface WritingPromptSeed {
  cefr_level: string;
  prompt_text: string;
  prompt_type: string;
  scaffold_type: string;
  scaffold_data: Record<string, unknown>;
  min_words: number | null;
  max_words: number | null;
  target_vocabulary: string[];
  target_grammar: string[];
  max_attempts: number;
}

function getWritingPrompts(language: string): WritingPromptSeed[] {
  // Language-specific prompts would be best, but for seed we use generic prompts
  // that work across languages with the scaffold UI handling the structure
  return [
    // A1 - Fill in the blank
    {
      cefr_level: 'A1',
      prompt_text: 'Complete the sentence about yourself.',
      prompt_type: 'guided',
      scaffold_type: 'fill_blank',
      scaffold_data: { sentence: 'My name is ___ and I live in a city.', blank_index: 3, hint: 'Write your name' },
      min_words: null,
      max_words: null,
      target_vocabulary: [],
      target_grammar: ['present tense'],
      max_attempts: 5,
    },
    {
      cefr_level: 'A1',
      prompt_text: 'Complete the sentence about your family.',
      prompt_type: 'guided',
      scaffold_type: 'fill_blank',
      scaffold_data: { sentence: 'I have ___ brothers and sisters.', blank_index: 2, hint: 'Write a number' },
      min_words: null,
      max_words: null,
      target_vocabulary: ['family', 'brother', 'sister'],
      target_grammar: ['present tense', 'numbers'],
      max_attempts: 5,
    },
    // A1 - Sentence frame
    {
      cefr_level: 'A1',
      prompt_text: 'Introduce yourself using these sentence starters.',
      prompt_type: 'guided',
      scaffold_type: 'sentence_frame',
      scaffold_data: { starters: ['My name is', 'I am from', 'I like to'] },
      min_words: null,
      max_words: 50,
      target_vocabulary: ['name', 'from', 'like'],
      target_grammar: ['present tense', 'subject pronouns'],
      max_attempts: 5,
    },
    // A2 - Guided paragraph
    {
      cefr_level: 'A2',
      prompt_text: 'Describe your daily routine using the prompts below.',
      prompt_type: 'guided',
      scaffold_type: 'guided_paragraph',
      scaffold_data: { starters: ['In the morning, I', 'After that, I', 'In the evening, I', 'Before bed, I'] },
      min_words: 30,
      max_words: 150,
      target_vocabulary: ['morning', 'afternoon', 'evening', 'breakfast', 'lunch'],
      target_grammar: ['present tense', 'time expressions', 'sequence words'],
      max_attempts: 3,
    },
    {
      cefr_level: 'A2',
      prompt_text: 'Write about your favorite food and why you like it.',
      prompt_type: 'guided',
      scaffold_type: 'guided_paragraph',
      scaffold_data: { starters: ['My favorite food is', 'I like it because', 'I usually eat it'] },
      min_words: 30,
      max_words: 150,
      target_vocabulary: ['delicious', 'taste', 'cook', 'restaurant'],
      target_grammar: ['present tense', 'because', 'adjectives'],
      max_attempts: 3,
    },
    // B1 - Guided paragraph (more open)
    {
      cefr_level: 'B1',
      prompt_text: 'Write a short essay about a memorable trip you took.',
      prompt_type: 'guided',
      scaffold_type: 'guided_paragraph',
      scaffold_data: { starters: ['Last year, I traveled to', 'The most interesting thing was', 'I learned that', 'I would recommend this trip because'] },
      min_words: 100,
      max_words: 300,
      target_vocabulary: ['travel', 'experience', 'culture', 'memorable'],
      target_grammar: ['past tense', 'comparatives', 'because/since'],
      max_attempts: 3,
    },
    // B1 - Free
    {
      cefr_level: 'B1',
      prompt_text: 'Write about the advantages and disadvantages of living in a big city.',
      prompt_type: 'free',
      scaffold_type: 'free',
      scaffold_data: {},
      min_words: 150,
      max_words: 300,
      target_vocabulary: ['advantage', 'disadvantage', 'opportunity', 'traffic', 'pollution'],
      target_grammar: ['present tense', 'connectors', 'opinion expressions'],
      max_attempts: 3,
    },
    // B2 - Essay
    {
      cefr_level: 'B2',
      prompt_text: 'Write an essay discussing whether social media has a positive or negative impact on society.',
      prompt_type: 'free',
      scaffold_type: 'essay',
      scaffold_data: {},
      min_words: 300,
      max_words: 500,
      target_vocabulary: ['impact', 'communication', 'privacy', 'influence', 'debate'],
      target_grammar: ['passive voice', 'conditional', 'complex sentences'],
      max_attempts: 3,
    },
    // C1 - Academic
    {
      cefr_level: 'C1',
      prompt_text: 'Write a formal argumentative essay on the following topic: "Should governments prioritize economic growth over environmental protection?"',
      prompt_type: 'free',
      scaffold_type: 'academic',
      scaffold_data: {},
      min_words: 400,
      max_words: 600,
      target_vocabulary: ['sustainability', 'economic', 'policy', 'consequence', 'advocate'],
      target_grammar: ['subjunctive', 'passive voice', 'complex subordination'],
      max_attempts: 3,
    },
    // C2 - Academic
    {
      cefr_level: 'C2',
      prompt_text: 'Critically analyze the role of artificial intelligence in education. Consider both current applications and future implications.',
      prompt_type: 'free',
      scaffold_type: 'academic',
      scaffold_data: {},
      min_words: 500,
      max_words: null,
      target_vocabulary: [],
      target_grammar: [],
      max_attempts: 3,
    },
  ];
}

async function seedWritingPrompts() {
  console.log('Seeding scaffolded writing prompts...');

  // Get all courses to associate prompts with
  const { data: courses, error: courseError } = await supabase
    .from('courses')
    .select('id, target_language, cefr_level')
    .eq('is_published', true);

  if (courseError) {
    console.error('Failed to fetch courses:', courseError.message);
    return;
  }

  if (!courses || courses.length === 0) {
    console.log('No courses found. Skipping writing prompt seeding.');
    return;
  }

  let totalInserted = 0;

  for (const course of courses) {
    const prompts = getWritingPrompts(course.target_language);

    for (const prompt of prompts) {
      const { error } = await supabase.from('writing_prompts').insert({
        course_id: course.id,
        cefr_level: prompt.cefr_level,
        prompt_text: prompt.prompt_text,
        prompt_type: prompt.prompt_type,
        scaffold_type: prompt.scaffold_type,
        scaffold_data: prompt.scaffold_data,
        min_words: prompt.min_words,
        max_words: prompt.max_words,
        target_vocabulary: prompt.target_vocabulary,
        target_grammar: prompt.target_grammar,
        max_attempts: prompt.max_attempts,
      });

      if (error) {
        console.error(`Failed to insert prompt for ${course.target_language}/${prompt.cefr_level}:`, error.message);
      } else {
        totalInserted++;
      }
    }
  }

  console.log(`Inserted ${totalInserted} writing prompts.`);
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('=== Reading & Writing Content Seed ===\n');

  await seedWritingPrompts();

  console.log('\n=== Seed Complete ===');
  console.log('\nNote: AI story generation and Gutenberg/Wikisource ingestion');
  console.log('should be run through the generate-story edge function');
  console.log('and the lib/gutenberg.ts / lib/wikisource.ts modules.');
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
