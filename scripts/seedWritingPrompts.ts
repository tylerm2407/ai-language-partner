/**
 * Idempotent script to seed writing_prompts via LLM generation.
 *
 * For each course + level + unit, generates CEFR-aligned writing prompts
 * progressing from phrases to essays.
 *
 * Run: npx tsx scripts/seedWritingPrompts.ts
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js';
import {
  ALL_TARGET_LANGUAGES,
  getLevelsForLanguage,
  LANGUAGE_NAMES,
  UNIT_THEMES,
} from '../config/courseStructure';
import type { CEFRLevel, LanguageCode, WritingPromptType } from '../types';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY — needed for LLM-generated prompts.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Prompt types per CEFR level ────────────────────────────────

interface PromptSpec {
  type: WritingPromptType;
  minWords: number;
  maxWords: number;
}

const LEVEL_PROMPT_SPECS: Record<CEFRLevel, PromptSpec[]> = {
  A1: [
    { type: 'phrase', minWords: 5, maxWords: 20 },
    { type: 'sentence', minWords: 10, maxWords: 40 },
  ],
  A2: [
    { type: 'sentence', minWords: 15, maxWords: 50 },
    { type: 'paragraph', minWords: 30, maxWords: 80 },
  ],
  B1: [
    { type: 'paragraph', minWords: 50, maxWords: 150 },
    { type: 'letter', minWords: 80, maxWords: 200 },
  ],
  B2: [
    { type: 'paragraph', minWords: 100, maxWords: 250 },
    { type: 'letter', minWords: 150, maxWords: 350 },
    { type: 'essay', minWords: 200, maxWords: 400 },
  ],
  C1: [
    { type: 'letter', minWords: 200, maxWords: 500 },
    { type: 'essay', minWords: 300, maxWords: 700 },
  ],
  C2: [
    { type: 'essay', minWords: 500, maxWords: 1500 },
    { type: 'letter', minWords: 300, maxWords: 600 },
  ],
};

// ─── LLM Generation ─────────────────────────────────────────────

interface GeneratedPrompt {
  title: string;
  promptText: string;
  sampleOutline: string;
}

async function generateWritingPrompt(
  language: string,
  level: CEFRLevel,
  unitTheme: string,
  topics: string[],
  spec: PromptSpec
): Promise<GeneratedPrompt | null> {
  const typeDescriptions: Record<WritingPromptType, string> = {
    phrase: 'Write short phrases or word groups',
    sentence: 'Write complete sentences',
    paragraph: 'Write a single paragraph (5-8 sentences)',
    letter: 'Write a letter or email',
    essay: 'Write a multi-paragraph essay or composition',
  };

  const systemPrompt = `You are a language teaching curriculum designer.
Create a writing prompt for ${language} learners at CEFR level ${level}.

Task type: ${typeDescriptions[spec.type]}
Theme: "${unitTheme}" (keywords: ${topics.join(', ')})
Word range: ${spec.minWords}–${spec.maxWords} words

Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "Short title for this writing task in English",
  "promptText": "The full writing prompt instructions in English, telling the student exactly what to write in ${language}",
  "sampleOutline": "A brief outline or structure suggestion to help the student organize their response"
}

The prompt should be clear, specific, and achievable at ${level} level.
The student will write their response in ${language}, but the prompt instructions are in English.`;

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
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Generate a ${spec.type} writing prompt about "${unitTheme}" for ${level} ${language} learners.` }],
      }),
    });

    if (!response.ok) {
      console.error(`  LLM error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';
    return JSON.parse(text) as GeneratedPrompt;
  } catch (err) {
    console.error(`  Failed to generate prompt: ${err}`);
    return null;
  }
}

// ─── Database Helpers ───────────────────────────────────────────

async function promptExists(courseId: string, title: string, type: string): Promise<boolean> {
  const { data } = await supabase
    .from('writing_prompts')
    .select('id')
    .eq('course_id', courseId)
    .eq('title', title)
    .eq('type', type)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('Seeding writing prompts...\n');

  let generated = 0;
  let skipped = 0;

  for (const lang of ALL_TARGET_LANGUAGES) {
    console.log(`\n${LANGUAGE_NAMES[lang]}:`);

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
      const specs = LEVEL_PROMPT_SPECS[level];

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

        // Generate one prompt per spec for each unit
        for (const spec of specs) {
          const promptTitle = `${theme.title} — ${spec.type}`;

          if (await promptExists(course.id, promptTitle, spec.type)) {
            skipped++;
            continue;
          }

          console.log(`  Generating: ${level} ${promptTitle}`);
          const prompt = await generateWritingPrompt(
            LANGUAGE_NAMES[lang],
            level,
            theme.title,
            theme.topics,
            spec
          );

          if (prompt) {
            const { error } = await supabase.from('writing_prompts').insert({
              course_id: course.id,
              unit_id: unitId,
              level,
              type: spec.type,
              title: prompt.title,
              prompt_text: prompt.promptText,
              min_words: spec.minWords,
              max_words: spec.maxWords,
              sample_outline: prompt.sampleOutline,
            });

            if (error) {
              console.error(`  Insert error: ${error.message}`);
            } else {
              generated++;
            }
          }

          // Rate limit
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }
  }

  console.log(`\nDone! Generated ${generated}, skipped ${skipped} existing.`);
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
