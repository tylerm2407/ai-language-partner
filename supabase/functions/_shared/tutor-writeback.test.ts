/**
 * Tests for turning a finished voice-tutor session into a learning record.
 *
 * What is pinned here is the part of the sequence that fails silently in
 * production. Every write in this module is best-effort by design, which means
 * none of them can announce a problem by breaking a request: a correction that
 * never got logged, a debrief that quietly carried the model's invented
 * duration, or a session written back twice all look exactly like a session
 * that went fine. The ordering invariant, the refusals that are supposed to
 * happen, and the idempotency guard are therefore all asserted directly.
 *
 * Run with: npm run test:functions
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  writeBackTutorSession,
  type TutorWritebackClient,
  type TutorWritebackInput,
} from './tutor-writeback.ts';
import type { TutorAnalysis, TutorAnalysisTurn, TutorDebrief } from './tutor-analysis.ts';

// ─── Test doubles ─────────────────────────────────────────────────────────

interface Result {
  data: unknown;
  error: { message: string } | null;
}

interface FakeOptions {
  /** The conditional claim finds no unclaimed row, i.e. somebody got here
   *  first. */
  alreadyClaimed?: boolean;
  /** The claim query itself errors — the fail-open path. */
  claimError?: string;
  /** Fail the Nth (1-based) `correction_log` insert. */
  correctionInsertFailsOn?: number[];
  /** Fail every `conversation_evidence` insert. */
  evidenceInsertError?: string;
  /** Words the learner is already studying, so the card dedupe skips them. */
  existingWords?: string[];
  /** `prune_tutor_memory` reports this many deleted rows. */
  prunedRows?: number;
}

/**
 * PostgREST-shaped double that also records the ORDER of everything it was
 * asked to do.
 *
 * The order log is the point of this double rather than a convenience: the
 * module's contract with `ai-chat` is a sequence, not a set, and a set-shaped
 * assertion would pass on a version that wrote cards before evidence.
 */
function fakeClient(opts: FakeOptions = {}) {
  /** Every DB touch, in the order it happened. */
  const calls: string[] = [];
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const rpcCalls: { name: string; params: Record<string, unknown> }[] = [];
  const cardWords: string[] = [];
  let correctionInserts = 0;

  const client = {
    from(table: string) {
      // deno-lint-ignore no-explicit-any
      const builder: any = {};
      let result: Result = { data: [], error: null };

      for (const method of ['select', 'eq', 'limit', 'single', 'order']) {
        builder[method] = () => builder;
      }
      builder.is = () => builder;

      builder.ilike = (_column: string, value: string) => {
        const hit = (opts.existingWords ?? []).some(
          (w) => w.toLowerCase() === String(value).toLowerCase(),
        );
        calls.push('cards:lookup');
        result = { data: hit ? [{ id: 'existing-card' }] : [], error: null };
        return builder;
      };

      builder.insert = (payload: Record<string, unknown>) => {
        inserted.push({ table, ...payload });
        if (table === 'correction_log') {
          correctionInserts += 1;
          calls.push('correction_log:insert');
          result = (opts.correctionInsertFailsOn ?? []).includes(correctionInserts)
            ? { data: null, error: { message: 'correction insert rejected' } }
            : { data: null, error: null };
        } else if (table === 'conversation_evidence') {
          calls.push('conversation_evidence:insert');
          result = opts.evidenceInsertError
            ? { data: null, error: { message: opts.evidenceInsertError } }
            : { data: null, error: null };
        } else if (table === 'cards') {
          calls.push('cards:insert');
          cardWords.push(String(payload.target_text ?? ''));
          result = { data: { id: `card-${cardWords.length}` }, error: null };
        }
        return builder;
      };

      builder.upsert = (payload: Record<string, unknown>) => {
        inserted.push({ table, ...payload });
        calls.push(`${table}:upsert`);
        result = { data: null, error: null };
        return builder;
      };

      builder.update = (payload: Record<string, unknown>) => {
        updated.push({ table, ...payload });
        if ('analyzed_at' in payload) {
          calls.push('tutor_sessions:claim');
          if (opts.claimError) {
            result = { data: null, error: { message: opts.claimError } };
          } else {
            result = { data: opts.alreadyClaimed ? [] : [{ id: 'session-1' }], error: null };
          }
        } else {
          calls.push('tutor_sessions:debrief');
          result = { data: null, error: null };
        }
        return builder;
      };

      builder.then = (onFulfilled: (r: Result) => unknown) =>
        Promise.resolve(result).then(onFulfilled);
      return builder;
    },

    rpc(name: string, params: Record<string, unknown>) {
      rpcCalls.push({ name, params });
      calls.push(`rpc:${name}`);
      let result: Result = { data: null, error: null };
      if (name === 'consume_daily_quota') result = { data: true, error: null };
      if (name === 'prune_tutor_memory') result = { data: opts.prunedRows ?? 0, error: null };
      if (name === 'upsert_tutor_memory') result = { data: 'note-id', error: null };
      return {
        then: (onFulfilled: (r: Result) => unknown) => Promise.resolve(result).then(onFulfilled),
      };
    },
  };

  return {
    client: client as unknown as TutorWritebackClient,
    calls,
    rpcCalls,
    rowsIn: (table: string) => inserted.filter((r) => r.table === table),
    updatesTo: (table: string) => updated.filter((r) => r.table === table),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

/** Long enough to clear `MIN_WORDS_FOR_EVIDENCE` (4). */
const LONG_TURN = 'yo quiero comprar una casa grande';

function correction(shortLabel: string) {
  return {
    shortLabel,
    explanation: 'gender agreement',
    original: 'la problema',
    corrected: 'el problema',
    errorType: 'gender' as const,
    severity: 'minor' as const,
  };
}

const DEBRIEF: TutorDebrief = {
  highlight: 'You held a whole conversation about housing.',
  patterns: [{ label: 'gender', why: 'noun endings mislead', theirs: 'la problema', better: 'el problema' }],
  reachFor: [{ phrase: 'me da igual', meaning: "I don't mind", when: 'choosing between options' }],
  nextTime: 'Try narrating a past weekend.',
  minutesSpoken: 999,
};

function analysis(overrides: Partial<TutorAnalysis> = {}): TutorAnalysis {
  return {
    turns: [
      { learnerText: LONG_TURN, correction: correction('gender-agreement') },
      { learnerText: LONG_TURN, correction: correction('ser-vs-estar') },
    ] as TutorAnalysisTurn[],
    vocabulary: [{ word: 'alquiler', translation: 'rent' }],
    memoryNotes: [{ kind: 'goal', content: 'Moving to Madrid in March' }],
    debrief: DEBRIEF,
    ...overrides,
  };
}

function input(over: Partial<TutorWritebackInput> = {}): TutorWritebackInput {
  return {
    userId: 'user-1',
    sessionId: 'session-1',
    targetLanguage: 'es',
    nativeLanguage: 'en',
    level: 'intermediate',
    cefrLevel: 'B1',
    analysis: analysis(),
    observedSeconds: 300,
    chatCardLimit: 10,
    ...over,
  };
}

// ─── The ordering invariant ───────────────────────────────────────────────

Deno.test('writes correction, then evidence, then cards', async () => {
  const fake = fakeClient();
  await writeBackTutorSession(fake.client, input());

  // Corrections and evidence interleave per turn; the cards come after every
  // turn, because the analysis picks the session's vocabulary as a whole.
  const ordered = fake.calls.filter((c) =>
    c === 'correction_log:insert' || c === 'conversation_evidence:insert' || c === 'cards:lookup'
  );
  assertEquals(ordered, [
    'correction_log:insert',
    'conversation_evidence:insert',
    'correction_log:insert',
    'conversation_evidence:insert',
    'cards:lookup',
  ]);

  // And the whole-session tail order: cards, then memory, then prune, then the
  // debrief. A prune before the notes would rank against a set this session had
  // not contributed to.
  const tail = fake.calls.filter((c) => c.startsWith('rpc:') || c === 'tutor_sessions:debrief');
  assertEquals(tail, [
    'rpc:consume_daily_quota',
    'rpc:upsert_tutor_memory',
    'rpc:prune_tutor_memory',
    'tutor_sessions:debrief',
  ]);
});

Deno.test('claims the session before writing anything', async () => {
  const fake = fakeClient();
  await writeBackTutorSession(fake.client, input());
  assertEquals(fake.calls[0], 'tutor_sessions:claim');
});

// ─── A turn with nothing to correct ───────────────────────────────────────

Deno.test('a clean turn writes evidence but no correction row', async () => {
  const fake = fakeClient();
  const result = await writeBackTutorSession(
    fake.client,
    input({
      analysis: analysis({
        turns: [{ learnerText: LONG_TURN, correction: null }] as TutorAnalysisTurn[],
      }),
    }),
  );

  assertEquals(fake.rowsIn('correction_log').length, 0);
  assertEquals(fake.rowsIn('conversation_evidence').length, 1);
  assertEquals(result.correctionsLogged, 0);
  // A turn that went right is evidence of accuracy. Skipping it would mean the
  // only spoken turns feeding a measured level were the ones that went wrong.
  assertEquals(result.evidenceRows, 1);
});

Deno.test('correction rows carry a null chat_session_id', async () => {
  const fake = fakeClient();
  await writeBackTutorSession(fake.client, input());
  const row = fake.rowsIn('correction_log')[0];
  // A tutor session is not a row in `chat_sessions`; that FK has nothing to
  // point at.
  assertEquals(row.chat_session_id, null);
  assertEquals(row.target_language, 'es');
  assertEquals(row.short_label, 'gender-agreement');
});

// ─── The refusals that are supposed to happen ─────────────────────────────

Deno.test('a turn too short to be a language sample leaves no evidence', async () => {
  const fake = fakeClient();
  const result = await writeBackTutorSession(
    fake.client,
    input({
      analysis: analysis({
        turns: [
          { learnerText: 'sí', correction: null },
          { learnerText: 'vale', correction: null },
        ] as TutorAnalysisTurn[],
      }),
    }),
  );

  // `scoreTurn` refuses these, and that refusal must not be worked around: a
  // measured CEFR level built partly out of "sí" says something untrue.
  assertEquals(fake.rowsIn('conversation_evidence').length, 0);
  assertEquals(result.evidenceRows, 0);
});

Deno.test('a spoken turn below the recogniser floor leaves no evidence', async () => {
  const fake = fakeClient();
  const result = await writeBackTutorSession(
    fake.client,
    input({
      analysis: analysis({
        turns: [
          { learnerText: LONG_TURN, correction: null, recognizerConfidence: 0.2 },
        ] as TutorAnalysisTurn[],
      }),
    }),
  );
  assertEquals(fake.rowsIn('conversation_evidence').length, 0);
  assertEquals(result.evidenceRows, 0);
});

// ─── The clock ────────────────────────────────────────────────────────────

Deno.test('the server clock overwrites whatever the model claimed', async () => {
  const fake = fakeClient();
  // The fixture debrief says 999 minutes. The model has no clock — it is
  // inferring duration from how much text it was handed.
  const result = await writeBackTutorSession(fake.client, input({ observedSeconds: 312 }));

  assertEquals(result.debrief.minutesSpoken, 5.2);
  const stored = fake.updatesTo('tutor_sessions')[1].debrief as TutorDebrief;
  assertEquals(stored.minutesSpoken, 5.2);
  // Everything else about the debrief survives untouched.
  assertEquals(stored.highlight, DEBRIEF.highlight);
  assertEquals(stored.nextTime, DEBRIEF.nextTime);
});

Deno.test('a forty-second session does not round down to zero minutes', async () => {
  const fake = fakeClient();
  const result = await writeBackTutorSession(fake.client, input({ observedSeconds: 40 }));
  assertEquals(result.debrief.minutesSpoken, 0.7);
});

// ─── Memory ───────────────────────────────────────────────────────────────

Deno.test('an unusable memory note is dropped and the others still land', async () => {
  const fake = fakeClient({ prunedRows: 3 });
  const result = await writeBackTutorSession(
    fake.client,
    input({
      analysis: analysis({
        memoryNotes: [
          // Invented kind — outside the DB CHECK.
          { kind: 'mood' as never, content: 'Seemed cheerful today' },
          { kind: 'goal', content: 'Moving to Madrid in March' },
          // Two characters after sanitisation, under the 3-char floor.
          { kind: 'preference', content: ' a ' },
          { kind: 'personal_fact', content: 'Works as a nurse' },
        ],
      }),
    }),
  );

  const upserts = fake.rpcCalls.filter((c) => c.name === 'upsert_tutor_memory');
  assertEquals(upserts.length, 2);
  assertEquals(upserts.map((c) => c.params.p_content), [
    'Moving to Madrid in March',
    'Works as a nurse',
  ]);
  assertEquals(upserts[0].params.p_session_id, 'session-1');
  assertEquals(result.memoryNotesWritten, 2);
  assertEquals(result.memoryPruned, 3);
});

Deno.test('prune runs exactly once, even for a session that remembered nothing', async () => {
  const fake = fakeClient();
  await writeBackTutorSession(
    fake.client,
    input({ analysis: analysis({ memoryNotes: [] }) }),
  );
  const prunes = fake.rpcCalls.filter((c) => c.name === 'prune_tutor_memory');
  // The 180-day forgetting curve inside the RPC is time-based, so a silent
  // session is still the occasion to let old notes expire.
  assertEquals(prunes.length, 1);
});

Deno.test('prune runs once for a session with several notes, not once per note', async () => {
  const fake = fakeClient();
  await writeBackTutorSession(
    fake.client,
    input({
      analysis: analysis({
        memoryNotes: [
          { kind: 'goal', content: 'Moving to Madrid in March' },
          { kind: 'personal_fact', content: 'Works as a nurse' },
          { kind: 'topic_thread', content: 'Was house hunting last week' },
        ],
      }),
    }),
  );
  assertEquals(fake.rpcCalls.filter((c) => c.name === 'prune_tutor_memory').length, 1);
});

// ─── Failure does not cascade ─────────────────────────────────────────────

Deno.test('a failed insert does not abort the rest, and the counts say so', async () => {
  const fake = fakeClient({ correctionInsertFailsOn: [1], evidenceInsertError: 'rls denied' });
  const result = await writeBackTutorSession(fake.client, input());

  // The first correction was rejected; the second still had to be attempted.
  assertEquals(fake.rowsIn('correction_log').length, 2);
  assertEquals(result.correctionsLogged, 1);
  // Both evidence writes were rejected. The count reflects what landed, not
  // what was tried.
  assertEquals(result.evidenceRows, 0);
  // And the learner still gets everything downstream of the failures.
  assertEquals(result.cardsSaved, 1);
  assertEquals(result.memoryNotesWritten, 1);
  assertEquals(fake.updatesTo('tutor_sessions').length, 2);
});

Deno.test('a word the learner already studies costs no card and no slot', async () => {
  const fake = fakeClient({ existingWords: ['alquiler'] });
  const result = await writeBackTutorSession(fake.client, input());
  assertEquals(result.cardsSaved, 0);
  assertEquals(fake.rpcCalls.filter((c) => c.name === 'consume_daily_quota').length, 0);
});

Deno.test('cards are tagged as the tutor surface', async () => {
  const fake = fakeClient();
  await writeBackTutorSession(fake.client, input());
  const card = fake.rowsIn('cards')[0];
  // The only provenance on the row; ai-chat writes ['chat','vocabulary'].
  assertEquals(card.tags, ['tutor', 'vocabulary']);
  assertEquals(card.cefr_level, 'B1');
});

// ─── An analysis no model produced ────────────────────────────────────────

Deno.test('an empty analysis writes no learning record at all', async () => {
  const fake = fakeClient();
  // `analyzeTutorSession` returns this shape whenever no model read the
  // conversation: an outage, a safety fallback, a refusal, a truncation.
  const result = await writeBackTutorSession(
    fake.client,
    input({ analysis: analysis({ turns: [], vocabulary: [], memoryNotes: [] }) }),
  );

  // Turns are derived from the transcript, so it would be easy — and wrong —
  // to write "clean" evidence here. `turn-accuracy.ts` scores a null correction
  // as 1.0, so an outage would push the measured speaking level UP.
  assertEquals(fake.rowsIn('conversation_evidence').length, 0);
  assertEquals(fake.rowsIn('correction_log').length, 0);
  assertEquals(fake.rowsIn('cards').length, 0);
  assertEquals(result.evidenceRows, 0);
  assertEquals(result.cardsSaved, 0);
  assertEquals(result.memoryNotesWritten, 0);
  // The time-based half of the forgetting curve still runs, and the debrief is
  // still stored — an empty debrief is what the learner is owed when there is
  // nothing to say about the session.
  assertEquals(fake.rpcCalls.filter((c) => c.name === 'prune_tutor_memory').length, 1);
  assertEquals(fake.updatesTo('tutor_sessions').length, 2);
});

// ─── Idempotency ──────────────────────────────────────────────────────────

Deno.test('a session someone else already analysed is not written back twice', async () => {
  const fake = fakeClient({ alreadyClaimed: true });
  const result = await writeBackTutorSession(fake.client, input());

  assert(result.alreadyAnalyzed);
  assertEquals(result.correctionsLogged, 0);
  assertEquals(result.evidenceRows, 0);
  assertEquals(fake.rowsIn('correction_log').length, 0);
  assertEquals(fake.rowsIn('conversation_evidence').length, 0);
  assertEquals(fake.rpcCalls.length, 0);
  // Only the claim itself touched the session row.
  assertEquals(fake.updatesTo('tutor_sessions').length, 1);
  // The caller still gets a debrief to show, with the server's minutes.
  assertEquals(result.debrief.minutesSpoken, 5);
});

Deno.test('a claim that errors fails open rather than losing the session', async () => {
  const fake = fakeClient({ claimError: 'connection reset' });
  const result = await writeBackTutorSession(fake.client, input());

  // An error means the database did not answer, not that somebody else won.
  // Refusing to write on that basis would turn one flaky query into a session
  // with no record at all.
  assert(!result.alreadyAnalyzed);
  assertEquals(result.correctionsLogged, 2);
  assertEquals(result.evidenceRows, 2);
});
