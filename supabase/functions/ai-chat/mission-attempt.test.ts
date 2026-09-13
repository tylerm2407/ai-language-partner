// Deno tests for the mission attempt lifecycle.
//
// Run with: `deno test supabase/functions/ai-chat/mission-attempt.test.ts`
//
// What is pinned: the row's stage beats the client's, a locked stage is
// refused before anything is written, another user's session reads as not
// found, and a second finish of the same attempt returns the stored result
// without touching progress again. Each of those is silent in production if
// it regresses — the learner just quietly skips a stage, or passes twice.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { getMission } from '../_shared/missions.ts';
import {
  finishMissionAttempt,
  recordMissionTurn,
  resolveMissionAttempt,
  type MissionAttemptClient,
} from './mission-attempt.ts';

// ─── Test double: an in-memory PostgREST ──────────────────────────────────

type Row = Record<string, unknown>;

const PRIMARY_KEYS: Record<string, string[]> = {
  chat_mission_attempts: ['chat_session_id'],
  chat_sessions: ['id'],
  chat_mission_progress: ['user_id', 'target_language', 'scenario_key', 'stage'],
};

function fakeClient(seed: Partial<Record<string, Row[]>> = {}) {
  const tables: Record<string, Row[]> = {
    chat_mission_attempts: [],
    chat_sessions: [],
    chat_mission_progress: [],
    conversation_evidence: [],
    correction_log: [],
    ...Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, (v ?? []).map((r) => ({ ...r }))])),
  };
  const calls: { table: string; op: string; payload?: Row }[] = [];

  const sameKey = (table: string, a: Row, b: Row) =>
    (PRIMARY_KEYS[table] ?? []).every((k) => String(a[k]) === String(b[k]));

  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    let op = 'select';
    let payload: Row | null = null;
    const eqs: [string, unknown][] = [];
    const nulls: string[] = [];
    let returning = false;

    const matches = (r: Row) =>
      eqs.every(([c, v]) => String(r[c]) === String(v)) && nulls.every((c) => r[c] === null || r[c] === undefined);

    const execute = (): { data: unknown; error: { message: string } | null } => {
      calls.push({ table, op, payload: payload ?? undefined });
      if (op === 'select') return { data: rows.filter(matches).map((r) => ({ ...r })), error: null };
      if (op === 'insert') {
        const row = payload!;
        if (rows.some((r) => sameKey(table, r, row))) {
          return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
        }
        const full: Row = {
          objectives_met: [],
          saved_words: [],
          finished_at: null,
          result: null,
          ...row,
        };
        rows.push(full);
        return { data: returning ? [{ ...full }] : null, error: null };
      }
      if (op === 'update') {
        const hit = rows.filter(matches);
        for (const r of hit) Object.assign(r, payload);
        return { data: returning ? hit.map((r) => ({ ...r })) : null, error: null };
      }
      if (op === 'upsert') {
        const row = payload!;
        const at = rows.findIndex((r) => sameKey(table, r, row));
        if (at === -1) rows.push({ ...row });
        else rows[at] = { ...rows[at], ...row };
        return { data: null, error: null };
      }
      throw new Error(`unsupported op ${op}`);
    };

    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select: () => {
        if (op !== 'select') returning = true;
        return builder;
      },
      eq: (c: string, v: unknown) => {
        eqs.push([c, v]);
        return builder;
      },
      is: (c: string, v: unknown) => {
        if (v === null) nulls.push(c);
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      insert: (p: Row) => {
        op = 'insert';
        payload = p;
        return builder;
      },
      update: (p: Row) => {
        op = 'update';
        payload = p;
        return builder;
      },
      upsert: (p: Row) => {
        op = 'upsert';
        payload = p;
        return builder;
      },
      maybeSingle: () => {
        const r = execute();
        const list = Array.isArray(r.data) ? r.data : [];
        return Promise.resolve({ data: list[0] ?? null, error: r.error });
      },
      single: () => {
        const r = execute();
        const list = Array.isArray(r.data) ? r.data : [];
        return Promise.resolve({
          data: list[0] ?? null,
          error: r.error ?? (list.length === 0 ? { message: 'no rows' } : null),
        });
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve().then(execute).then(resolve, reject),
    };
    return builder;
  }

  return { client: { from } as unknown as MissionAttemptClient, tables, calls };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

const ME = 'user-me';
const OTHER = 'user-other';
const SESSION = '11111111-1111-4111-8111-111111111111';
const MISSION_1 = getMission('restaurant', 1)!;
const MISSION_2 = getMission('restaurant', 2)!;
const IDS_1 = MISSION_1.objectives.map((o) => o.id);

const base = {
  userId: ME,
  chatSessionId: SESSION,
  scenarioKey: 'restaurant',
  targetLanguage: 'es',
};

const mySession = { id: SESSION, user_id: ME, mission_stage: null };

// ─── resolveMissionAttempt ────────────────────────────────────────────────

Deno.test('a first turn creates the attempt row and stamps the session stage', async () => {
  const fake = fakeClient({ chat_sessions: [mySession] });
  const r = await resolveMissionAttempt(fake.client, { ...base, requestedStage: 1 });
  assert(r.ok);
  assertEquals(r.attempt.stage, 1);
  assertEquals(r.attempt.objectivesMet, []);
  assertEquals(r.attempt.finished, false);
  assertEquals(fake.tables.chat_mission_attempts.length, 1);
  assertEquals(fake.tables.chat_mission_attempts[0].user_id, ME);
  assertEquals(fake.tables.chat_sessions[0].mission_stage, 1);
});

Deno.test("the row's stage wins over what the client requested", async () => {
  const fake = fakeClient({
    chat_sessions: [mySession],
    chat_mission_attempts: [{
      chat_session_id: SESSION, user_id: ME, scenario_key: 'restaurant', stage: 1,
      objectives_met: ['greet_table'], saved_words: ['mesa'], finished_at: null,
    }],
  });
  const r = await resolveMissionAttempt(fake.client, { ...base, requestedStage: 4 });
  assert(r.ok);
  assertEquals(r.attempt.stage, 1);
  assertEquals(r.attempt.objectivesMet, ['greet_table']);
  assertEquals(r.attempt.savedWords, ['mesa']);
  // Nothing was inserted or rewritten.
  assertEquals(fake.calls.filter((c) => c.op !== 'select').length, 0);
});

Deno.test('stage 2 is locked until stage 1 has a passed_at, and a locked stage writes nothing', async () => {
  const locked = fakeClient({ chat_sessions: [mySession] });
  const r1 = await resolveMissionAttempt(locked.client, { ...base, requestedStage: 2 });
  assertEquals(r1, { ok: false, code: 'MISSION_LOCKED' });
  assertEquals(locked.tables.chat_mission_attempts.length, 0);

  const attempted = fakeClient({
    chat_sessions: [mySession],
    chat_mission_progress: [{ user_id: ME, target_language: 'es', scenario_key: 'restaurant', stage: 1, attempts: 2, best_accuracy: 0.5, passed_at: null }],
  });
  const r2 = await resolveMissionAttempt(attempted.client, { ...base, requestedStage: 2 });
  assertEquals(r2, { ok: false, code: 'MISSION_LOCKED' });

  const unlocked = fakeClient({
    chat_sessions: [mySession],
    chat_mission_progress: [{ user_id: ME, target_language: 'es', scenario_key: 'restaurant', stage: 1, attempts: 1, best_accuracy: 0.9, passed_at: '2026-09-01T00:00:00Z' }],
  });
  const r3 = await resolveMissionAttempt(unlocked.client, { ...base, requestedStage: 2 });
  assert(r3.ok);
  assertEquals(r3.attempt.stage, 2);
});

Deno.test('the lock is per language and per scene', async () => {
  const fake = fakeClient({
    chat_sessions: [mySession],
    chat_mission_progress: [
      { user_id: ME, target_language: 'fr', scenario_key: 'restaurant', stage: 1, attempts: 1, best_accuracy: 1, passed_at: '2026-09-01T00:00:00Z' },
      { user_id: ME, target_language: 'es', scenario_key: 'shopping', stage: 1, attempts: 1, best_accuracy: 1, passed_at: '2026-09-01T00:00:00Z' },
    ],
  });
  const r = await resolveMissionAttempt(fake.client, { ...base, requestedStage: 2 });
  assertEquals(r, { ok: false, code: 'MISSION_LOCKED' });
});

Deno.test('a missing session or someone else’s session is SESSION_NOT_FOUND', async () => {
  const missing = fakeClient();
  assertEquals(
    await resolveMissionAttempt(missing.client, { ...base, requestedStage: 1 }),
    { ok: false, code: 'SESSION_NOT_FOUND' },
  );

  const foreign = fakeClient({ chat_sessions: [{ id: SESSION, user_id: OTHER, mission_stage: null }] });
  assertEquals(
    await resolveMissionAttempt(foreign.client, { ...base, requestedStage: 1 }),
    { ok: false, code: 'SESSION_NOT_FOUND' },
  );
  assertEquals(foreign.tables.chat_mission_attempts.length, 0);

  // An attempt row that exists but belongs to another user reads the same way
  // — and its stage and progress are not disclosed.
  const foreignAttempt = fakeClient({
    chat_mission_attempts: [{ chat_session_id: SESSION, user_id: OTHER, scenario_key: 'restaurant', stage: 3, objectives_met: [], saved_words: [], finished_at: null }],
  });
  assertEquals(
    await resolveMissionAttempt(foreignAttempt.client, { ...base, requestedStage: 1 }),
    { ok: false, code: 'SESSION_NOT_FOUND' },
  );
});

Deno.test('a finished attempt is MISSION_FINISHED for a turn, but not for a finish', async () => {
  const seed = {
    chat_mission_attempts: [{ chat_session_id: SESSION, user_id: ME, scenario_key: 'restaurant', stage: 1, objectives_met: IDS_1, saved_words: [], finished_at: '2026-09-01T00:00:00Z', passed: true }],
  };
  const turn = fakeClient(seed);
  assertEquals(
    await resolveMissionAttempt(turn.client, { ...base, requestedStage: 1 }),
    { ok: false, code: 'MISSION_FINISHED' },
  );

  const finishing = fakeClient(seed);
  const r = await resolveMissionAttempt(finishing.client, { ...base, requestedStage: 1, finishing: true });
  assert(r.ok);
  assertEquals(r.attempt.finished, true);
});

// ─── recordMissionTurn ────────────────────────────────────────────────────

Deno.test('recording a turn unions ids and words into the row', async () => {
  const fake = fakeClient({
    chat_mission_attempts: [{ chat_session_id: SESSION, user_id: ME, scenario_key: 'restaurant', stage: 1, objectives_met: ['greet_table'], saved_words: ['mesa'], finished_at: null }],
  });
  await recordMissionTurn(fake.client, {
    chatSessionId: SESSION,
    objectivesMet: ['greet_table', 'order_drink'],
    savedWords: ['agua', 'mesa'],
  });
  const row = fake.tables.chat_mission_attempts[0];
  assertEquals(row.objectives_met, ['greet_table', 'order_drink']);
  assertEquals(row.saved_words, ['mesa', 'agua']);
});

Deno.test('recording nothing writes nothing, and a broken client does not throw', async () => {
  const fake = fakeClient({
    chat_mission_attempts: [{ chat_session_id: SESSION, user_id: ME, scenario_key: 'restaurant', stage: 1, objectives_met: [], saved_words: [], finished_at: null }],
  });
  await recordMissionTurn(fake.client, { chatSessionId: SESSION, objectivesMet: [], savedWords: [] });
  assertEquals(fake.calls.length, 0);

  const exploding = { from() { throw new Error('connection reset'); } } as unknown as MissionAttemptClient;
  await recordMissionTurn(exploding, { chatSessionId: SESSION, objectivesMet: ['x'], savedWords: [] });
});

// ─── finishMissionAttempt ─────────────────────────────────────────────────

function runningAttempt(objectivesMet: string[], stage = 1) {
  return {
    chat_session_id: SESSION, user_id: ME, scenario_key: 'restaurant', stage,
    objectives_met: objectivesMet, saved_words: ['la cuenta'], finished_at: null, result: null,
  };
}

Deno.test('a passing finish claims the row, stores the result and unlocks the next stage', async () => {
  const fake = fakeClient({
    chat_mission_attempts: [runningAttempt(IDS_1)],
    conversation_evidence: [
      { chat_session_id: SESSION, user_id: ME, accuracy: 0.8, intelligibility: null },
      { chat_session_id: SESSION, user_id: ME, accuracy: 1, intelligibility: 0.8 },
      // Another session's evidence must not count.
      { chat_session_id: 'other-session', user_id: ME, accuracy: 0, intelligibility: null },
    ],
    correction_log: [
      { chat_session_id: SESSION, user_id: ME, error_type: 'gender', original: 'un mesa', corrected: 'una mesa' },
    ],
  });
  const attempt = { chatSessionId: SESSION, scenarioKey: 'restaurant', stage: 1, objectivesMet: IDS_1, savedWords: ['la cuenta'], finished: false };
  const result = await finishMissionAttempt(fake.client, {
    ...base, mission: MISSION_1, attempt, sendoff: '¡Hasta luego!',
  });

  assertEquals(result.passed, true);
  assertEquals(result.reason, null);
  assertEquals(result.accuracy, 0.85);
  assertEquals(result.scoredTurns, 2);
  assertEquals(result.unlockedStage, 2);
  assertEquals(result.stage, 1);
  assertEquals(result.band, 'A1');
  assertEquals(result.title, MISSION_1.title);
  assertEquals(result.scenarioKey, 'restaurant');
  assertEquals(result.savedWords, ['la cuenta']);
  assertEquals(result.sendoff, '¡Hasta luego!');
  assertEquals(result.corrections, [{ errorType: 'gender', count: 1, examples: [{ original: 'un mesa', corrected: 'una mesa' }] }]);
  assertEquals(result.objectives.every((o) => o.met), true);

  const row = fake.tables.chat_mission_attempts[0];
  assert(typeof row.finished_at === 'string');
  assertEquals(row.passed, true);
  assertEquals(row.accuracy, 0.85);
  assertEquals(row.scored_turns, 2);
  assertEquals(row.result, result);

  const progress = fake.tables.chat_mission_progress;
  assertEquals(progress.length, 1);
  assertEquals(progress[0].stage, 1);
  assertEquals(progress[0].attempts, 1);
  assertEquals(progress[0].best_accuracy, 0.85);
  assert(typeof progress[0].passed_at === 'string');
});

Deno.test('a failing finish counts the attempt but does not unlock', async () => {
  const fake = fakeClient({
    chat_mission_attempts: [runningAttempt(IDS_1.slice(0, 1))],
    chat_mission_progress: [
      { user_id: ME, target_language: 'es', scenario_key: 'restaurant', stage: 1, attempts: 2, best_accuracy: 0.6, passed_at: null },
    ],
  });
  const attempt = { chatSessionId: SESSION, scenarioKey: 'restaurant', stage: 1, objectivesMet: [], savedWords: [], finished: false };
  const result = await finishMissionAttempt(fake.client, { ...base, mission: MISSION_1, attempt, sendoff: 'Adiós' });

  assertEquals(result.passed, false);
  assertEquals(result.reason, 'objectives_incomplete');
  assertEquals(result.accuracy, null);
  assertEquals(result.unlockedStage, 1);
  // The score used the ROW's union, not the stale attempt passed in.
  assertEquals(result.objectives.filter((o) => o.met).map((o) => o.id), IDS_1.slice(0, 1));

  const progress = fake.tables.chat_mission_progress[0];
  assertEquals(progress.attempts, 3);
  assertEquals(progress.best_accuracy, 0.6, 'null accuracy must not erase the best');
  assertEquals(progress.passed_at, null);
});

Deno.test('unlockedStage is the ladder’s max passed stage + 1, capped at 5', async () => {
  const fake = fakeClient({
    chat_mission_attempts: [runningAttempt(MISSION_2.objectives.map((o) => o.id), 2)],
    chat_mission_progress: [
      { user_id: ME, target_language: 'es', scenario_key: 'restaurant', stage: 1, attempts: 1, best_accuracy: 1, passed_at: '2026-09-01T00:00:00Z' },
      { user_id: ME, target_language: 'es', scenario_key: 'restaurant', stage: 3, attempts: 1, best_accuracy: 1, passed_at: '2026-09-01T00:00:00Z' },
      { user_id: ME, target_language: 'es', scenario_key: 'restaurant', stage: 4, attempts: 1, best_accuracy: 1, passed_at: '2026-09-01T00:00:00Z' },
    ],
  });
  const attempt = { chatSessionId: SESSION, scenarioKey: 'restaurant', stage: 2, objectivesMet: [], savedWords: [], finished: false };
  const result = await finishMissionAttempt(fake.client, { ...base, mission: MISSION_2, attempt, sendoff: 'Adiós' });
  assertEquals(result.passed, true);
  assertEquals(result.unlockedStage, 5);
});

Deno.test('a second finish returns the stored result and makes no second progress write', async () => {
  const fake = fakeClient({
    chat_mission_attempts: [runningAttempt(IDS_1)],
  });
  const attempt = { chatSessionId: SESSION, scenarioKey: 'restaurant', stage: 1, objectivesMet: IDS_1, savedWords: [], finished: true };

  const first = await finishMissionAttempt(fake.client, { ...base, mission: MISSION_1, attempt, sendoff: 'first goodbye' });
  const upsertsAfterFirst = fake.calls.filter((c) => c.table === 'chat_mission_progress' && c.op === 'upsert').length;
  assertEquals(upsertsAfterFirst, 1);

  const second = await finishMissionAttempt(fake.client, { ...base, mission: MISSION_1, attempt, sendoff: 'second goodbye' });
  assertEquals(second, first, 'the stored result, verbatim');
  assertEquals(second.sendoff, 'first goodbye');
  const upsertsAfterSecond = fake.calls.filter((c) => c.table === 'chat_mission_progress' && c.op === 'upsert').length;
  assertEquals(upsertsAfterSecond, 1, 'progress is written exactly once per attempt');
  assertEquals(fake.tables.chat_mission_progress[0].attempts, 1);
});
