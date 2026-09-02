/**
 * Reading the curriculum, and reading back what is already cached.
 *
 * Two rules shape everything here:
 *
 *   - Every read is paged. `cards` is 3,168 rows and `exercises` is ~20,000;
 *     PostgREST caps a response at 1,000, so an unpaged `select` silently
 *     returns a prefix. For a warming script a silent prefix is worse than an
 *     error — it produces a plan that looks complete and warms two thirds of
 *     the curriculum.
 *   - The joins are done in memory rather than with PostgREST embedding. The
 *     tables involved (courses, units, lessons) are small, and an in-memory
 *     join is a thing this file can be read and checked against, where a
 *     three-deep `!inner(...)` string is not.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { splitParagraphs } from '../../lib/reading-text';
import { requireSecret } from './env';
import { hintCacheKey } from './keys';
import type { AudioPromptRow, CardRow, ExerciseCardRow, PassageParagraph } from './plan';

const PAGE = 1000;

export function getServiceClient(): SupabaseClient {
  return createClient(requireSecret('supabaseUrl'), requireSecret('serviceRoleKey'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Page a table until it stops returning full pages. */
async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  what: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    // Surfaced, never swallowed: an empty array from a failed read would make
    // the plan claim there is nothing left to warm. CLAUDE.md §5.
    if (error) throw new Error(`Failed to read ${what}: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

// ─── Curriculum ──────────────────────────────────────────────────────────

const CARD_COLUMNS = 'id, language, target_text, native_text, part_of_speech, example_sentence, cefr_level';

/** Curriculum cards only. `user_id IS NULL` is what makes a card shared by
 *  every learner, and therefore worth paying for exactly once. */
export function fetchCurriculumCards(db: SupabaseClient): Promise<CardRow[]> {
  return selectAll<CardRow>(
    (from, to) =>
      db.from('cards').select(CARD_COLUMNS).is('user_id', null).order('id').range(from, to),
    'cards',
  );
}

interface ExerciseRow {
  id: string;
  lesson_id: string | null;
  card_id: string | null;
  type: string;
  prompt: string | null;
  prompt_audio_url: string | null;
}

/**
 * Exercise types the app synthesises lesson audio for.
 *
 * Mirrors AUDIO_TYPES in hooks/useLessonAudioPrewarm.ts, which is the set that
 * reaches `lib/lesson-audio.ts` — the only caller that asks the tts function
 * for `purpose: 'lesson'`. Anything outside this set is either silent or goes
 * down the `voice` path, which is a different cache namespace entirely.
 */
export const LESSON_AUDIO_TYPES = ['listening_choice', 'listening_type', 'dictation'] as const;

async function fetchExercises(db: SupabaseClient, types: readonly string[]): Promise<ExerciseRow[]> {
  return selectAll<ExerciseRow>(
    (from, to) =>
      db
        .from('exercises')
        .select('id, lesson_id, card_id, type, prompt, prompt_audio_url')
        .in('type', types)
        .order('id')
        .range(from, to),
    'exercises',
  );
}

/** lesson_id → the course's target language, assembled from three small tables. */
async function lessonLanguages(db: SupabaseClient): Promise<Map<string, string>> {
  const courses = await selectAll<{ id: string; target_language: string | null }>(
    (from, to) => db.from('courses').select('id, target_language').order('id').range(from, to),
    'courses',
  );
  const units = await selectAll<{ id: string; course_id: string | null }>(
    (from, to) => db.from('units').select('id, course_id').order('id').range(from, to),
    'units',
  );
  const lessons = await selectAll<{ id: string; unit_id: string | null }>(
    (from, to) => db.from('lessons').select('id, unit_id').order('id').range(from, to),
    'lessons',
  );

  const courseLanguage = new Map(courses.map((c) => [c.id, c.target_language]));
  const unitLanguage = new Map(
    units.map((u) => [u.id, u.course_id ? courseLanguage.get(u.course_id) : undefined]),
  );

  const out = new Map<string, string>();
  for (const lesson of lessons) {
    const language = lesson.unit_id ? unitLanguage.get(lesson.unit_id) : undefined;
    if (language) out.set(lesson.id, language);
  }
  return out;
}

export async function fetchAudioPrompts(
  db: SupabaseClient,
  cards: readonly CardRow[],
): Promise<AudioPromptRow[]> {
  const [exercises, byLesson] = await Promise.all([
    fetchExercises(db, LESSON_AUDIO_TYPES),
    lessonLanguages(db),
  ]);
  const cardLanguage = new Map(cards.map((c) => [c.id, c.language]));

  const out: AudioPromptRow[] = [];
  for (const ex of exercises) {
    // A pre-recorded clip needs no synthesis — the same check the prewarm hook
    // and ListeningExercise both make before calling the function.
    if (ex.prompt_audio_url || !ex.prompt) continue;
    const language =
      (ex.card_id ? cardLanguage.get(ex.card_id) : undefined) ??
      (ex.lesson_id ? byLesson.get(ex.lesson_id) : undefined);
    if (!language) continue;
    out.push({ prompt: ex.prompt, language, type: ex.type });
  }
  return out;
}

/**
 * (card, exercise type) pairs `get-hint` could be asked about.
 *
 * Restricted to exercises that carry a `card_id`, because the function's
 * request takes a cardId and validates it as a UUID — an exercise without one
 * can never generate a request that reads these rows.
 */
export async function fetchHintTargets(
  db: SupabaseClient,
  cards: readonly CardRow[],
): Promise<ExerciseCardRow[]> {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const exercises = await selectAll<ExerciseRow>(
    (from, to) =>
      db
        .from('exercises')
        .select('id, lesson_id, card_id, type, prompt, prompt_audio_url')
        .not('card_id', 'is', null)
        .order('id')
        .range(from, to),
    'exercises (hint targets)',
  );

  const out: ExerciseCardRow[] = [];
  for (const ex of exercises) {
    if (!ex.card_id) continue;
    const card = byId.get(ex.card_id);
    if (!card || !card.language) continue;
    out.push({ card_id: ex.card_id, type: ex.type, language: card.language, card });
  }
  return out;
}

interface PassageRow {
  id: string;
  course_id: string | null;
  cefr_level: string | null;
  title: string | null;
  content: string | null;
  is_published: boolean | null;
}

/**
 * Published passages, split into the same paragraphs the reader renders.
 *
 * `splitParagraphs` is imported from lib/reading-text.ts rather than
 * reimplemented for the reason its own header gives: the explanation cache is
 * keyed on a hash of the paragraph, so a second splitter that differed by one
 * merge rule would produce spans nobody ever asks about.
 *
 * Scoped to `reading_passages` and deliberately NOT `reading_books`: the books
 * are 10,375 imported Gutenberg texts totalling ~2.2 GB, which is not a
 * one-time cost, it is a different project.
 */
export async function fetchPassageParagraphs(db: SupabaseClient): Promise<PassageParagraph[]> {
  const passages = await selectAll<PassageRow>(
    (from, to) =>
      db
        .from('reading_passages')
        .select('id, course_id, cefr_level, title, content, is_published')
        .eq('is_published', true)
        .order('id')
        .range(from, to),
    'reading_passages',
  );

  const courses = await selectAll<{ id: string; target_language: string | null }>(
    (from, to) => db.from('courses').select('id, target_language').order('id').range(from, to),
    'courses',
  );
  const courseLanguage = new Map(courses.map((c) => [c.id, c.target_language]));

  const out: PassageParagraph[] = [];
  for (const passage of passages) {
    const language = passage.course_id ? courseLanguage.get(passage.course_id) : undefined;
    if (!language || !passage.content || !passage.cefr_level) continue;
    for (const paragraph of splitParagraphs(passage.content)) {
      out.push({
        span: paragraph.text,
        language,
        cefrLevel: passage.cefr_level,
        passageTitle: passage.title ?? passage.id,
      });
    }
  }
  return out;
}

// ─── What is already cached ──────────────────────────────────────────────

/** Ask only about the keys we are considering. Bounded work regardless of how
 *  large the cache grows, which an unfiltered `select hash` is not. */
async function existingHashes(
  db: SupabaseClient,
  table: 'translation_cache' | 'explanation_cache',
  keys: readonly string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  // 100, not 400: PostgREST sends `.in()` as a query string, and 400 sha256
  // hashes is a ~27 kB URL that the gateway answers with a bare 400 Bad
  // Request. Small enough to stay well under any proxy'''s line limit, large
  // enough that 3,000 keys is 30 round trips rather than 3,000.
  const CHUNK = 100;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    const { data, error } = await db.from(table).select('hash').in('hash', chunk);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    for (const row of data ?? []) found.add((row as { hash: string }).hash);
  }
  return found;
}

export const existingTranslationKeys = (db: SupabaseClient, keys: readonly string[]) =>
  existingHashes(db, 'translation_cache', keys);

export const existingExplanationKeys = (db: SupabaseClient, keys: readonly string[]) =>
  existingHashes(db, 'explanation_cache', keys);

/** `hint_cache` is capped by the curriculum (CLAUDE.md §4), so reading all of
 *  it is bounded and cheaper than thousands of composite-key lookups. */
export async function existingHintKeys(db: SupabaseClient): Promise<Set<string>> {
  const rows = await selectAll<{ card_id: string; exercise_type: string }>(
    (from, to) =>
      db.from('hint_cache').select('card_id, exercise_type').order('card_id').range(from, to),
    'hint_cache',
  );
  return new Set(rows.map((r) => hintCacheKey(r.card_id, r.exercise_type)));
}

export const TTS_BUCKET = 'tts-cache';

/**
 * Object paths already in the bucket under one prefix.
 *
 * `storage.list` is not recursive and returns names relative to the prefix, so
 * the caller gets back full paths to compare against `cachePathFor` output.
 * A slow-rate warm lives under its own `r075/` segment and is listed
 * separately — passing the wrong prefix would report every clip as missing and
 * re-synthesise the lot.
 */
export async function existingTtsPaths(db: SupabaseClient, prefix: string): Promise<Set<string>> {
  const found = new Set<string>();
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage
      .from(TTS_BUCKET)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Failed to list ${TTS_BUCKET}/${prefix}: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      // Directory placeholders have no id and are not objects.
      if (row.id) found.add(`${prefix}/${row.name}`);
    }
    if (rows.length < PAGE) return found;
  }
}
