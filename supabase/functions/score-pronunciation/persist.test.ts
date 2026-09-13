// Deno tests for the deferred pronunciation_scores write (persist.ts).
// Run with: deno test --allow-read --allow-env supabase/functions/score-pronunciation

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { persistAttempt } from './persist.ts';

/** A client whose inserts answer from a script, in order. */
function makeStub(script: Array<{ error: { message: string } | null } | 'throw'>) {
  const inserts: Record<string, unknown>[] = [];
  let i = 0;
  const supabase = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        assertEquals(table, 'pronunciation_scores');
        inserts.push(row);
        const step = script[i++] ?? { error: null };
        if (step === 'throw') return Promise.reject(new Error('socket hang up'));
        return Promise.resolve(step);
      },
    }),
  };
  return { supabase, inserts };
}

const noDelay = () => Promise.resolve();

/** Capture console.error lines for the duration of `fn`. */
async function capturingErrors(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const real = console.error;
  console.error = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
  try {
    await fn();
  } finally {
    console.error = real;
  }
  return lines;
}

const ROW = {
  user_id: 'user-uuid-should-never-be-logged',
  target_language: 'es',
  expected_text: 'la manzana',
  transcription: 'la manzana',
  score: 92,
  is_correct: true,
  phoneme_errors: [],
  source: 'practice',
  card_id: 'card-1',
};

Deno.test('a write that succeeds first time is written once', async () => {
  const { supabase, inserts } = makeStub([{ error: null }]);
  const ok = await persistAttempt(supabase, ROW, { delay: noDelay });
  assert(ok);
  assertEquals(inserts.length, 1);
});

Deno.test('a transient failure is retried once, after the delay, and lands', async () => {
  const { supabase, inserts } = makeStub([{ error: { message: 'connection reset' } }, { error: null }]);
  let waited = 0;
  const ok = await persistAttempt(supabase, ROW, { delay: (ms) => { waited = ms; return Promise.resolve(); } });
  assert(ok);
  assertEquals(inserts.length, 2);
  assert(waited > 0, 'the retry must wait before trying again');
  // The same row both times — a retry that rebuilt the row could drift.
  assertEquals(inserts[0], inserts[1]);
});

Deno.test('a thrown insert is a failure like any other, not an escape', async () => {
  const { supabase, inserts } = makeStub(['throw', { error: null }]);
  const ok = await persistAttempt(supabase, ROW, { delay: noDelay });
  assert(ok);
  assertEquals(inserts.length, 2);
});

Deno.test('two failures log at error level with the reason and no PII', async () => {
  const { supabase, inserts } = makeStub([
    { error: { message: 'first: pooler refused' } },
    { error: { message: 'second: pooler refused' } },
  ]);
  let ok = true;
  const lines = await capturingErrors(async () => {
    ok = await persistAttempt(supabase, ROW, { delay: noDelay });
  });
  assert(!ok);
  assertEquals(inserts.length, 2, 'exactly one retry — a third attempt is a loop');
  assertEquals(lines.length, 1);
  const logged = JSON.parse(lines[0]);
  assertEquals(logged.evt, 'pronunciation_persist_failed');
  assertEquals(logged.source, 'practice');
  assertEquals(logged.attempts, 2);
  assert(String(logged.reason).includes('pooler refused'));
  // What must NOT be in the line.
  assert(!lines[0].includes(ROW.user_id), 'the user id must not be logged');
  assert(!lines[0].includes(ROW.transcription), 'the transcription must not be logged');
  assert(!lines[0].includes(ROW.expected_text), 'the expected text must not be logged');
});

Deno.test('it never throws, whatever the client does', async () => {
  const { supabase } = makeStub(['throw', 'throw']);
  const lines = await capturingErrors(async () => {
    const ok = await persistAttempt(supabase, ROW, { delay: noDelay });
    assert(!ok);
  });
  assertEquals(lines.length, 1);
});
