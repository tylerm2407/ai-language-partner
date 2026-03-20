/**
 * Idempotent script to seed reading_materials via LLM generation + public-domain entries.
 *
 * For each course + level + unit, generates 1–3 graded reading texts using Claude.
 * Also inserts public-domain entries from config/publicDomainReadings.ts.
 *
 * Run: npx tsx scripts/seedReadingMaterials.ts
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js';
import {
  ALL_TARGET_LANGUAGES,
  getLevelsForLanguage,
  LANGUAGE_NAMES,
  UNIT_THEMES,
} from '../config/courseStructure';
import { PUBLIC_DOMAIN_READINGS } from '../config/publicDomainReadings';
import type { CEFRLevel, LanguageCode } from '../types';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY — needed for LLM-generated readings.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── CEFR descriptors for the LLM ──────────────────────────────

const CEFR_READING_GUIDELINES: Record<CEFRLevel, string> = {
  A1: 'Very simple text (50–100 words). Short sentences, present tense, basic vocabulary about everyday topics. Use only the 500 most common words.',
  A2: 'Simple text (100–200 words). Short paragraphs, past tense allowed, familiar topics like travel, shopping, daily life.',
  B1: 'Intermediate text (200–400 words). Clear standard language, opinions, narratives, some complex sentences.',
  B2: 'Upper-intermediate text (400–700 words). Complex arguments, abstract topics, news-style writing, varied vocabulary.',
  C1: 'Advanced text (600–1000 words). Academic or literary register, implicit meaning, sophisticated vocabulary and structure.',
  C2: 'Near-native text (800–1500 words). Nuanced, stylistically rich, may include irony, cultural references, specialized vocabulary.',
};

const DIFFICULTY_MAP: Record<CEFRLevel, number> = {
  A1: 1.5,
  A2: 3.0,
  B1: 4.5,
  B2: 6.0,
  C1: 7.5,
  C2: 9.0,
};

// ─── LLM Generation ─────────────────────────────────────────────

interface GeneratedReading {
  title: string;
  text: string;
  summary: string;
  tags: string[];
  wordCount: number;
}

async function generateReading(
  language: string,
  level: CEFRLevel,
  unitTheme: string,
  topics: string[]
): Promise<GeneratedReading | null> {
  const systemPrompt = `You are a curriculum designer creating graded reading materials for language learners.

Generate a reading text in ${language} at CEFR level ${level}.
${CEFR_READING_GUIDELINES[level]}

Topic/theme: "${unitTheme}" (related keywords: ${topics.join(', ')})

Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "title": "A short engaging title in ${language}",
  "text": "The full reading text in ${language}",
  "summary": "A 1-2 sentence summary in English for the teacher/app",
  "tags": ["tag1", "tag2", "tag3"],
  "wordCount": 150
}

The text must be entirely in ${language}. The title must be in ${language}. Summary and tags in English.
Make the content culturally authentic and engaging.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Generate a ${level} reading about "${unitTheme}" in ${language}.` }],
      }),
    });

    if (!response.ok) {
      console.error(`  LLM error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';
    return JSON.parse(text) as GeneratedReading;
  } catch (err) {
    console.error(`  Failed to generate reading: ${err}`);
    return null;
  }
}

// ─── Database Helpers ───────────────────────────────────────────

async function readingExists(courseId: string, title: string): Promise<boolean> {
  const { data } = await supabase
    .from('reading_materials')
    .select('id')
    .eq('course_id', courseId)
    .eq('title', title)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function insertReading(params: {
  courseId: string;
  unitId: string | null;
  level: CEFRLevel;
  title: string;
  author: string;
  text: string;
  summary: string;
  wordCount: number;
  difficultyScore: number;
  tags: string[];
  isPublicDomain: boolean;
  sourceUrl?: string;
  downloadUrlPdf?: string;
  downloadUrlEpub?: string;
}): Promise<void> {
  const { error } = await supabase.from('reading_materials').insert({
    course_id: params.courseId,
    unit_id: params.unitId,
    level: params.level,
    title: params.title,
    author: params.author,
    text: params.text,
    summary: params.summary,
    word_count: params.wordCount,
    difficulty_score: params.difficultyScore,
    tags: params.tags,
    is_public_domain: params.isPublicDomain,
    source_url: params.sourceUrl ?? null,
    download_url_pdf: params.downloadUrlPdf ?? null,
    download_url_epub: params.downloadUrlEpub ?? null,
  });

  if (error) console.error(`  Insert error: ${error.message}`);
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('Seeding reading materials...\n');

  let generated = 0;
  let skipped = 0;

  for (const lang of ALL_TARGET_LANGUAGES) {
    console.log(`\n${LANGUAGE_NAMES[lang]}:`);

    // Find the course
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('source_language', 'en')
      .eq('target_language', lang)
      .single();

    if (!course) {
      console.log('  No course found — run seedCourseStructure.ts first.');
      continue;
    }

    const levels = getLevelsForLanguage(lang);

    for (const level of levels) {
      const themes = UNIT_THEMES[level];

      for (const theme of themes) {
        // Find the unit
        const fullTitle = `${level}: ${theme.title}`;
        const { data: unit } = await supabase
          .from('units')
          .select('id')
          .eq('course_id', course.id)
          .eq('title', fullTitle)
          .single();

        const unitId = unit?.id ?? null;

        // Generate 1 reading per unit (can increase to 2–3 later)
        const readingTitle = `${theme.title} — ${level} Reading`;

        if (await readingExists(course.id, readingTitle)) {
          skipped++;
          continue;
        }

        console.log(`  Generating: ${readingTitle}`);
        const reading = await generateReading(
          LANGUAGE_NAMES[lang],
          level,
          theme.title,
          theme.topics
        );

        if (reading) {
          await insertReading({
            courseId: course.id,
            unitId,
            level,
            title: reading.title,
            author: 'Fluenci Stories Team',
            text: reading.text,
            summary: reading.summary,
            wordCount: reading.wordCount,
            difficultyScore: DIFFICULTY_MAP[level],
            tags: reading.tags,
            isPublicDomain: false,
          });
          generated++;
        }

        // Rate limit: small delay between LLM calls
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  // ─── Public Domain Entries ──────────────────────────────────────

  console.log('\nSeeding public-domain readings...');

  for (const entry of PUBLIC_DOMAIN_READINGS) {
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('source_language', 'en')
      .eq('target_language', entry.language)
      .single();

    if (!course) continue;

    if (await readingExists(course.id, entry.title)) {
      skipped++;
      continue;
    }

    // For public-domain entries, we generate an excerpt via LLM
    console.log(`  Generating excerpt: ${entry.title}`);
    const excerpt = await generateReading(
      LANGUAGE_NAMES[entry.language],
      entry.level,
      entry.title,
      entry.tags
    );

    if (excerpt) {
      await insertReading({
        courseId: course.id,
        unitId: null,
        level: entry.level,
        title: entry.title,
        author: entry.author,
        text: excerpt.text,
        summary: excerpt.summary,
        wordCount: excerpt.wordCount,
        difficultyScore: DIFFICULTY_MAP[entry.level],
        tags: entry.tags,
        isPublicDomain: true,
        sourceUrl: entry.sourceUrl,
        downloadUrlEpub: entry.downloadUrlEpub,
      });
      generated++;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone! Generated ${generated}, skipped ${skipped} existing.`);
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
