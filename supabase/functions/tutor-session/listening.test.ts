// Tests for the `listening-answer` action.
//
// The three properties that matter, all of them about the score being ours
// rather than the client's: the key never crosses the wire, a session is graded
// once, and a session that is not yours is indistinguishable from one that does
// not exist.

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { handleListeningAnswer, type ListeningCheckRow } from './listening.ts';
import type { TutorListeningItem } from '../_shared/tutor-listening.ts';

const ITEMS: TutorListeningItem[] = [
  { question: 'q1', options: ['a', 'b', 'c', 'd'], answerIndex: 0 },
  { question: 'q2', options: ['a', 'b', 'c', 'd'], answerIndex: 1 },
  { question: 'q3', options: ['a', 'b', 'c', 'd'], answerIndex: 2 },
];

interface FakeOptions {
  row?: Partial<ListeningCheckRow> | null;
  /** Rows the guarded update reports as written. Empty models losing a race. */
  updated?: { tutor_session_id: string }[];
  readError?: string;
  updateError?: string;
}

/**
 * A Supabase double narrow enough to be read in one sitting.
 *
 * Both `select` chains and the `update` chain end in something awaitable, so
 * the builder returns itself until a terminal is reached. `filters` records
 * every `.eq()` so a test can assert the ownership check actually ran — the
 * thing a comparison-after-the-fact would quietly get wrong.
 */
function fakeClient(options: FakeOptions = {}) {
  const filters: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  let updateGuarded = false;

  const builder = (isUpdate: boolean) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = self;
    chain.eq = (column: string, value: unknown) => {
      filters.push({ column, value });
      return chain;
    };
    chain.is = (column: string, value: unknown) => {
      if (column === 'answered_at' && value === null) updateGuarded = true;
      return chain;
    };
    chain.maybeSingle = () =>
      Promise.resolve(
        options.readError
          ? { data: null, error: { message: options.readError } }
          : { data: options.row === null ? null : { ...defaultRow, ...options.row }, error: null },
      );
    // The update chain is awaited directly after `.select()`.
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(
        options.updateError
          ? { data: null, error: { message: options.updateError } }
          : { data: options.updated ?? [{ tutor_session_id: 'session-1' }], error: null },
      ).then(resolve);
    if (!isUpdate) delete chain.then;
    return chain;
  };

  const defaultRow: ListeningCheckRow = {
    items: ITEMS,
    answered_at: null,
    correct_count: null,
    total_count: null,
    cefr_level: 'B1',
  };

  return {
    filters,
    updates,
    get updateGuarded() {
      return updateGuarded;
    },
    client: {
      from: (_table: string) => {
        const chain = builder(false);
        chain.update = (values: Record<string, unknown>) => {
          updates.push(values);
          return builder(true);
        };
        return chain;
      },
    },
  };
}

Deno.test('grades a submission and records the tally', async () => {
  const fake = fakeClient();
  const result = await handleListeningAnswer(fake.client, 'user-1', {
    sessionId: 'session-1',
    answers: [0, 1, 3],
  });

  assertEquals(result.status, 200);
  assertEquals(result.body.correctCount, 2);
  assertEquals(result.body.total, 3);
  assertEquals(result.body.correct, [true, true, false]);
  assertEquals(fake.updates[0].correct_count, 2);
  assertEquals(fake.updates[0].total_count, 3);
});

Deno.test('never returns the answer key, even for wrong answers', async () => {
  const fake = fakeClient();
  const result = await handleListeningAnswer(fake.client, 'user-1', {
    sessionId: 'session-1',
    answers: [3, 3, 3],
  });
  // Whether they were right, never what was right. A response naming the
  // correct index lets a client walk the key out one submission at a time.
  const body = JSON.stringify(result.body);
  assertEquals(body.includes('answerIndex'), false);
  assertEquals(body.includes('options'), false);
  assertEquals(result.body.correctCount, 0);
});

Deno.test('scopes the read to the caller', async () => {
  const fake = fakeClient();
  await handleListeningAnswer(fake.client, 'user-1', { sessionId: 'session-1', answers: [0] });
  // The ownership check is a filter, not a comparison afterwards: a session
  // that is not theirs must read as absent rather than as forbidden.
  assertEquals(
    fake.filters.some((f) => f.column === 'user_id' && f.value === 'user-1'),
    true,
  );
});

Deno.test('a second submission returns the stored grade and writes nothing', async () => {
  const fake = fakeClient({ row: { answered_at: '2026-09-15T00:00:00Z', correct_count: 1, total_count: 3 } });
  const result = await handleListeningAnswer(fake.client, 'user-1', {
    sessionId: 'session-1',
    answers: [0, 1, 2],
  });

  assertEquals(result.body.alreadyAnswered, true);
  assertEquals(result.body.correctCount, 1);
  // Without this, guessing repeatedly would eventually produce 3/3 and the
  // listening strand would measure persistence rather than comprehension.
  assertEquals(fake.updates.length, 0);
});

Deno.test('losing the update race reports the stored grade, not this submission', async () => {
  const fake = fakeClient({ updated: [] });
  const result = await handleListeningAnswer(fake.client, 'user-1', {
    sessionId: 'session-1',
    answers: [0, 1, 2],
  });
  assertEquals(result.body.alreadyAnswered, true);
  // The guard is what makes the race safe at all.
  assertEquals(fake.updateGuarded, true);
});

Deno.test('a missing or foreign session is a 404', async () => {
  const fake = fakeClient({ row: null });
  const result = await handleListeningAnswer(fake.client, 'user-1', {
    sessionId: 'nope',
    answers: [0],
  });
  assertEquals(result.status, 404);
});

Deno.test('a check with no items is a 404 rather than a 0/0', async () => {
  const fake = fakeClient({ row: { items: [] } });
  const result = await handleListeningAnswer(fake.client, 'user-1', {
    sessionId: 'session-1',
    answers: [],
  });
  assertEquals(result.status, 404);
});

Deno.test('a read failure is a 500 and leaks nothing', async () => {
  const fake = fakeClient({ readError: 'relation "tutor_listening_checks" does not exist' });
  const result = await handleListeningAnswer(fake.client, 'user-1', {
    sessionId: 'session-1',
    answers: [0],
  });
  assertEquals(result.status, 500);
  // Schema details in a client-visible message are a gift to whoever is poking.
  assertEquals(String(result.body.error).includes('relation'), false);
});
