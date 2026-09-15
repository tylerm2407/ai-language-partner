// Cards for a generated goal-track lesson.
//
// WHY A LESSON NEEDS CARDS AT ALL
//
// The lesson runner writes SRS only for exercises that carry a `card_id`
// (components/lesson/LessonRunner.tsx), and the proficiency report only sees
// vocabulary through `review_items -> cards.cefr_level` (lib/cefr-proficiency.ts).
// A goal-track lesson used to ship exercises with no card behind them, so a
// learner could finish all six lessons and have produced a `lesson_completions`
// row and nothing else: no review items, no vocabulary evidence, no movement on
// their measured level. The track was a dead end dressed as a course.
//
// WHY THE CARDS ARE SHARED CURRICULUM ROWS (user_id NULL)
//
// A track is shared (migration 099): one `courses` row, one set of `exercises`
// rows, for every learner who wants the same thing. `exercises.card_id` is one
// column, so it can point at exactly one card. A learner-owned card (user_id
// set) would be visible only to the learner who happened to open the lesson
// first; everyone after them would get an exercise whose card they cannot read
// under the `cards` SELECT policy. So the card is curriculum, like the exercise
// it belongs to, and the per-learner part — the SM-2 schedule — lives in
// `review_items` where it always has. Nothing here is economic: the new-card
// cap is still enforced when the learner's review item is created.
//
// WHY source_type IS 'ai_generated' AND NOT 'goal_track'
//
// `cards_source_type_check` in production admits exactly imported,
// ai_generated, seed and manual — verified against pg_constraint 2026-09-13,
// not read off the migration files. Provenance is carried by `tags` and by
// `source_item_id` (the lesson id; `source_id` is a foreign key to
// `content_sources` and cannot hold it). This is also what a goal track IS:
// AI-generated curriculum.

import { planLessonCards, termKey, type GeneratedExercise } from './goal-core.ts';

/** The slice of the client this module uses. Loose on purpose, matching
 *  `_shared/chat-vocabulary.ts`: the PostgREST builder's real type is
 *  generated per schema and pinning it here only makes the test double harder
 *  to write. */
export type GoalCardsClient = {
  // deno-lint-ignore no-explicit-any
  from: (table: string) => any;
};

/** Tags every goal-track card carries. `goal_track` is the only thing on the
 *  row that says which surface produced it (see the header). */
export const GOAL_CARD_TAGS: readonly string[] = ['goal_track', 'vocabulary'];

/** More cards than a track could hold: 6 lessons x 10 exercises. The dedupe
 *  read is bounded by this rather than paginated because the bound is
 *  structural, not a guess. */
export const MAX_TRACK_CARDS = 200;

export interface EnsureCardsInput {
  courseId: string;
  unitId: string;
  lessonId: string;
  /** `courses.target_language`. */
  language: string;
  /** `courses.cefr_level`. Written to every card so `analyzeBands` counts it;
   *  a null here is a card the proficiency report silently drops. */
  cefrLevel: string;
  exercises: readonly GeneratedExercise[];
}

export type EnsureCardsResult =
  | {
    ok: true;
    /** Card id per exercise index, null where the exercise teaches no term. */
    cardIdByExercise: (string | null)[];
    /** How many cards were inserted (as opposed to reused). For the log. */
    created: number;
  }
  | { ok: false; error: string };

/**
 * Give every term-bearing exercise a card, creating only the cards the track
 * does not already have.
 *
 * Dedupe is per TRACK, not per lesson: lesson 4 revisiting "la cuenta" from
 * lesson 1 must point at the same card, or the learner reviews the word on two
 * independent schedules. The lookup is one read of the track's cards (bounded
 * by `MAX_TRACK_CARDS`) matched in memory on `termKey`, because Postgres has no
 * case-insensitive `IN` and a per-term `ilike` would be N round trips.
 *
 * The read also makes a retry idempotent: if the exercise insert that follows
 * this fails and the lesson is regenerated, the cards created here are found
 * and reused rather than duplicated.
 *
 * Failure is reported, not swallowed. A lesson that ships without its cards is
 * marked `ready` forever and never gets them — exactly the state this module
 * exists to end — so the caller must treat `ok: false` as a failed generation.
 */
export async function ensureLessonCards(
  supabase: GoalCardsClient,
  input: EnsureCardsInput,
): Promise<EnsureCardsResult> {
  const planned = planLessonCards(input.exercises);
  const cardIdByExercise: (string | null)[] = input.exercises.map(() => null);
  if (planned.length === 0) return { ok: true, cardIdByExercise, created: 0 };

  const { data: existingRows, error: readError } = await supabase
    .from('cards')
    .select('id, target_text')
    .eq('course_id', input.courseId)
    .is('user_id', null)
    .limit(MAX_TRACK_CARDS);
  if (readError) return { ok: false, error: `card lookup failed: ${readError.message}` };

  const idByKey = new Map<string, string>();
  for (const row of (existingRows ?? []) as { id: string; target_text: string }[]) {
    const key = termKey(String(row.target_text ?? ''));
    // First one wins: if a race ever produced two rows for one term, every
    // exercise still lands on the same one.
    if (key && !idByKey.has(key)) idByKey.set(key, row.id);
  }

  const missing = planned.filter((p) => !idByKey.has(termKey(p.term)));
  if (missing.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from('cards')
      .insert(
        missing.map((p) => ({
          user_id: null,
          course_id: input.courseId,
          unit_id: input.unitId,
          native_text: p.termNative,
          target_text: p.term,
          example_sentence: p.example,
          language: input.language,
          cefr_level: input.cefrLevel,
          skill_type: 'vocabulary',
          source_type: 'ai_generated',
          source_item_id: input.lessonId,
          tags: [...GOAL_CARD_TAGS],
        })),
      )
      .select('id, target_text');
    if (insertError) return { ok: false, error: `card insert failed: ${insertError.message}` };
    for (const row of (insertedRows ?? []) as { id: string; target_text: string }[]) {
      idByKey.set(termKey(String(row.target_text ?? '')), row.id);
    }
  }

  for (const p of planned) {
    const id = idByKey.get(termKey(p.term));
    if (!id) return { ok: false, error: `no card came back for a term` };
    for (const index of p.exerciseIndexes) cardIdByExercise[index] = id;
  }
  return { ok: true, cardIdByExercise, created: missing.length };
}
