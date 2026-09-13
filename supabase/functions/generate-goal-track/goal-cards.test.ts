// Deno tests for goal-cards.ts. No network: the client is a PostgREST-shaped
// double in the style of _shared/chat-vocabulary.test.ts.
//
// What is pinned is the dedupe, because its failure is silent: a learner ends
// up reviewing one word on two independent SM-2 schedules and nothing ever
// says so.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { GOAL_CARD_TAGS, MAX_TRACK_CARDS, ensureLessonCards, type GoalCardsClient } from './goal-cards.ts';
import type { GeneratedExercise } from './goal-core.ts';

interface Result {
  data: unknown;
  error: { message: string } | null;
}

interface FakeOptions {
  /** Cards the track already has, as `target_text`. */
  existing?: string[];
  readError?: string;
  insertError?: string;
}

function fakeClient(opts: FakeOptions = {}) {
  const inserted: Record<string, unknown>[] = [];
  const reads: { column: string; value: unknown }[] = [];
  let limitSeen: number | null = null;
  let nextId = 1;

  const client = {
    from(table: string) {
      assertEquals(table, 'cards');
      // deno-lint-ignore no-explicit-any
      const builder: any = {};
      let result: Result = { data: [], error: null };

      builder.select = () => builder;
      builder.eq = (column: string, value: unknown) => {
        reads.push({ column, value });
        return builder;
      };
      builder.is = (column: string, value: unknown) => {
        reads.push({ column, value });
        return builder;
      };
      builder.limit = (n: number) => {
        limitSeen = n;
        result = opts.readError
          ? { data: null, error: { message: opts.readError } }
          : {
            data: (opts.existing ?? []).map((t, i) => ({ id: `existing-${i + 1}`, target_text: t })),
            error: null,
          };
        return builder;
      };
      builder.insert = (rows: Record<string, unknown>[]) => {
        inserted.push(...rows);
        result = opts.insertError
          ? { data: null, error: { message: opts.insertError } }
          : {
            data: rows.map((r) => ({ id: `new-${nextId++}`, target_text: r.target_text })),
            error: null,
          };
        return builder;
      };
      builder.then = (onFulfilled: (r: Result) => unknown) =>
        Promise.resolve(result).then(onFulfilled);
      return builder;
    },
  };

  return {
    client: client as unknown as GoalCardsClient,
    inserted,
    reads,
    limitSeen: () => limitSeen,
  };
}

function ex(term: string | null, termNative: string | null = term && 'meaning'): GeneratedExercise {
  return {
    type: 'translate_to_target',
    prompt: 'p',
    correctAnswer: 'a',
    acceptedAnswers: ['a'],
    options: null,
    explanation: null,
    term,
    termNative,
    example: null,
  };
}

const INPUT = {
  courseId: 'course-1',
  unitId: 'unit-1',
  lessonId: 'lesson-1',
  language: 'fr',
  cefrLevel: 'B1',
};

Deno.test('every term-bearing exercise gets a card; termless ones get null', async () => {
  const fake = fakeClient();
  const out = await ensureLessonCards(fake.client, {
    ...INPUT,
    exercises: [ex("l'addition"), ex(null), ex('le pourboire')],
  });
  assert(out.ok);
  assertEquals(out.cardIdByExercise, ['new-1', null, 'new-2']);
  assertEquals(out.created, 2);
});

Deno.test('two exercises teaching one term share one card', async () => {
  const fake = fakeClient();
  const out = await ensureLessonCards(fake.client, {
    ...INPUT,
    exercises: [ex("l'addition"), ex("L'addition"), ex("l'addition ")],
  });
  assert(out.ok);
  assertEquals(out.cardIdByExercise, ['new-1', 'new-1', 'new-1']);
  assertEquals(fake.inserted.length, 1);
});

Deno.test('a term the track already has is reused, not recreated', async () => {
  // Lesson 4 revisiting lesson 1's word must land on lesson 1's card, or the
  // learner reviews it on two schedules.
  const fake = fakeClient({ existing: ["L'ADDITION"] });
  const out = await ensureLessonCards(fake.client, {
    ...INPUT,
    exercises: [ex("l'addition"), ex('la carte')],
  });
  assert(out.ok);
  assertEquals(out.cardIdByExercise, ['existing-1', 'new-1']);
  assertEquals(out.created, 1);
  assertEquals(fake.inserted.map((r) => r.target_text), ['la carte']);
});

Deno.test('the dedupe read is scoped to the track and to curriculum rows', async () => {
  const fake = fakeClient();
  await ensureLessonCards(fake.client, { ...INPUT, exercises: [ex('x')] });
  assertEquals(fake.reads, [
    { column: 'course_id', value: 'course-1' },
    { column: 'user_id', value: null },
  ]);
  assertEquals(fake.limitSeen(), MAX_TRACK_CARDS);
});

Deno.test('the card row is shaped so the proficiency report can see it', async () => {
  const fake = fakeClient();
  const exercise = { ...ex('la carte', 'the menu'), example: 'La carte, s’il vous plaît.' };
  await ensureLessonCards(fake.client, { ...INPUT, exercises: [exercise] });
  const [row] = fake.inserted;
  // Shared curriculum: exercises are shared rows with one card_id each, so a
  // learner-owned card would be invisible to the second learner on the track.
  assertEquals(row.user_id, null);
  assertEquals(row.course_id, 'course-1');
  assertEquals(row.unit_id, 'unit-1');
  assertEquals(row.target_text, 'la carte');
  assertEquals(row.native_text, 'the menu');
  assertEquals(row.example_sentence, 'La carte, s’il vous plaît.');
  assertEquals(row.language, 'fr');
  // Without a level `analyzeBands` drops the card on the floor.
  assertEquals(row.cefr_level, 'B1');
  // The production CHECK admits only imported/ai_generated/seed/manual.
  assertEquals(row.source_type, 'ai_generated');
  assertEquals(row.source_item_id, 'lesson-1');
  assertEquals(row.tags, [...GOAL_CARD_TAGS]);
  assert(GOAL_CARD_TAGS.includes('goal_track'));
});

Deno.test('no terms means no reads, no writes, all nulls', async () => {
  const fake = fakeClient();
  const out = await ensureLessonCards(fake.client, { ...INPUT, exercises: [ex(null), ex(null)] });
  assert(out.ok);
  assertEquals(out.cardIdByExercise, [null, null]);
  assertEquals(fake.reads.length, 0);
  assertEquals(fake.inserted.length, 0);
});

Deno.test('a failed read or insert is reported, never swallowed', async () => {
  // A lesson shipped without its cards is marked ready forever and never
  // gets them — the caller must be able to fail the generation instead.
  const readFail = await ensureLessonCards(fakeClient({ readError: 'boom' }).client, {
    ...INPUT,
    exercises: [ex('x')],
  });
  assert(!readFail.ok);
  assert(readFail.error.includes('lookup'));

  const insertFail = await ensureLessonCards(fakeClient({ insertError: 'check violation' }).client, {
    ...INPUT,
    exercises: [ex('x')],
  });
  assert(!insertFail.ok);
  assert(insertFail.error.includes('insert'));
});
