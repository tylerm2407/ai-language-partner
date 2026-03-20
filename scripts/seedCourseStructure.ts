/**
 * Idempotent script to seed the Supabase database with CEFR-leveled course structure.
 *
 * Creates:
 * - Courses for each target language (source = 'en')
 * - Units per CEFR level per course (flagship A1–C2, others A1–B2)
 * - Lessons per unit using LESSON_TEMPLATES
 *
 * Run: npx tsx scripts/seedCourseStructure.ts
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js';
import {
  ALL_TARGET_LANGUAGES,
  getLevelsForLanguage,
  UNIT_THEMES,
  LESSON_TEMPLATES,
  courseTitle,
  courseDescription,
  LANGUAGE_NAMES,
} from '../config/courseStructure';
import type { CEFRLevel, LanguageCode } from '../types';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findOrCreateCourse(targetLang: LanguageCode): Promise<string> {
  const { data: existing } = await supabase
    .from('courses')
    .select('id')
    .eq('source_language', 'en')
    .eq('target_language', targetLang)
    .single();

  if (existing) {
    console.log(`  Course "${LANGUAGE_NAMES[targetLang]}" already exists (${existing.id})`);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('courses')
    .insert({
      source_language: 'en',
      target_language: targetLang,
      title: courseTitle(targetLang),
      description: courseDescription(targetLang),
      is_published: true,
      total_units: 0,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create course for ${targetLang}: ${error.message}`);
  console.log(`  Created course "${LANGUAGE_NAMES[targetLang]}" (${created!.id})`);
  return created!.id;
}

async function findOrCreateUnit(
  courseId: string,
  level: CEFRLevel,
  theme: { title: string; description: string },
  orderIndex: number
): Promise<string> {
  const fullTitle = `${level}: ${theme.title}`;

  const { data: existing } = await supabase
    .from('units')
    .select('id')
    .eq('course_id', courseId)
    .eq('title', fullTitle)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('units')
    .insert({
      course_id: courseId,
      title: fullTitle,
      description: theme.description,
      order_index: orderIndex,
      total_lessons: LESSON_TEMPLATES.length,
      cefr_level: level,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create unit "${fullTitle}": ${error.message}`);
  return created!.id;
}

async function findOrCreateLesson(
  unitId: string,
  unitTitle: string,
  template: { titleSuffix: string; description: string; estimatedMinutes: number; xpReward: number },
  orderIndex: number
): Promise<void> {
  const title = `${unitTitle} — ${template.titleSuffix}`;

  const { data: existing } = await supabase
    .from('lessons')
    .select('id')
    .eq('unit_id', unitId)
    .eq('title', title)
    .single();

  if (existing) return;

  const { error } = await supabase.from('lessons').insert({
    unit_id: unitId,
    title,
    description: template.description,
    order_index: orderIndex,
    estimated_minutes: template.estimatedMinutes,
    xp_reward: template.xpReward,
  });

  if (error) throw new Error(`Failed to create lesson "${title}": ${error.message}`);
}

async function updateCourseUnitCount(courseId: string): Promise<void> {
  const { count } = await supabase
    .from('units')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId);

  await supabase
    .from('courses')
    .update({ total_units: count ?? 0 })
    .eq('id', courseId);
}

async function main() {
  console.log('Seeding course structure...\n');

  let totalUnits = 0;
  let totalLessons = 0;

  for (const lang of ALL_TARGET_LANGUAGES) {
    console.log(`\n${LANGUAGE_NAMES[lang]}:`);
    const courseId = await findOrCreateCourse(lang);
    const levels = getLevelsForLanguage(lang);

    let globalOrderIndex = 0;

    for (const level of levels) {
      const themes = UNIT_THEMES[level];

      for (const theme of themes) {
        const unitId = await findOrCreateUnit(courseId, level, theme, globalOrderIndex);
        const unitTitle = `${level}: ${theme.title}`;
        totalUnits++;

        for (let i = 0; i < LESSON_TEMPLATES.length; i++) {
          await findOrCreateLesson(unitId, unitTitle, LESSON_TEMPLATES[i], i);
          totalLessons++;
        }

        globalOrderIndex++;
      }
    }

    await updateCourseUnitCount(courseId);
  }

  console.log(`\nDone! Created/verified ${totalUnits} units and ${totalLessons} lessons.`);
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
