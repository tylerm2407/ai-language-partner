// Deno tests for the `connect` action (connect.ts): the server-side SDP
// exchange that makes every tutor call one the server can end.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { handleConnect, type ConnectDeps } from './connect.ts';

interface Row {
  id: string;
  user_id: string;
  model: string;
  ended_at: string | null;
  call_id: string | null;
  connected_at: string | null;
}

/** A minimal chainable stand-in for the one table this action touches. */
function stubDb(row: Row | null, opts: { updateError?: string } = {}) {
  const updates: Record<string, unknown>[] = [];
  const supabase = {
    from(_table: string) {
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: () => Promise.resolve({ data: row, error: null }) };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          updates.push(patch);
          return {
            eq: () => Promise.resolve({ error: opts.updateError ? { message: opts.updateError } : null }),
          };
        },
      };
    },
  };
  return { supabase, updates };
}

function fakeDeps(over: Partial<ConnectDeps> = {}): ConnectDeps & { hangups: string[]; created: string[] } {
  const hangups: string[] = [];
  const created: string[] = [];
  return {
    hangups,
    created,
    takeKey: () => Promise.resolve('ek_stashed'),
    create: (secret, model, sdp) => {
      created.push(`${secret}|${model}|${sdp.slice(0, 3)}`);
      return Promise.resolve({ answerSdp: 'v=0\r\nanswer', callId: 'rtc_new' });
    },
    hangup: (_key, callId) => {
      hangups.push(callId);
      return Promise.resolve('ended' as const);
    },
    ...over,
  };
}

const OPEN: Row = {
  id: 'sess-1', user_id: 'user-1', model: 'gpt-realtime', ended_at: null, call_id: null, connected_at: null,
};
const env = { openaiKey: 'sk-test' };
const req = { sessionId: 'sess-1', sdp: 'v=0\r\noffer' };

Deno.test('exchanges the offer with the stashed key and records the call id', async () => {
  const { supabase, updates } = stubDb(OPEN);
  const deps = fakeDeps();
  const res = await handleConnect(supabase, 'user-1', req, env, deps);
  assertEquals(res.status, 200);
  assertEquals(res.body.sdp, 'v=0\r\nanswer');
  assertEquals(deps.created, ['ek_stashed|gpt-realtime|v=0']);
  assertEquals(updates[0].call_id, 'rtc_new');
  assert(typeof updates[0].connected_at === 'string');
  // The key never appears in the response.
  assert(!JSON.stringify(res.body).includes('ek_stashed'));
});

Deno.test('another learner cannot connect to a session they do not own', async () => {
  const { supabase } = stubDb(OPEN);
  const deps = fakeDeps();
  const res = await handleConnect(supabase, 'user-2', req, env, deps);
  assertEquals(res.status, 404);
  assertEquals(deps.created, []);
});

Deno.test('an ended session is refused before any key is read', async () => {
  const { supabase } = stubDb({ ...OPEN, ended_at: '2026-09-08T10:00:00Z' });
  let keyReads = 0;
  const deps = fakeDeps({ takeKey: () => { keyReads += 1; return Promise.resolve('ek'); } });
  const res = await handleConnect(supabase, 'user-1', req, env, deps);
  assertEquals(res.status, 410);
  assertEquals(keyReads, 0);
});

Deno.test('a lost or expired key is a 410, and nothing is dialled', async () => {
  const { supabase } = stubDb(OPEN);
  const deps = fakeDeps({ takeKey: () => Promise.resolve(null) });
  const res = await handleConnect(supabase, 'user-1', req, env, deps);
  assertEquals(res.status, 410);
  assertEquals(res.body.code, 'SESSION_EXPIRED');
  assertEquals(deps.created, []);
});

Deno.test('a redial hangs up the previous call first and keeps the original connected_at', async () => {
  const { supabase, updates } = stubDb({ ...OPEN, call_id: 'rtc_old', connected_at: '2026-09-08T10:00:00Z' });
  const deps = fakeDeps();
  const res = await handleConnect(supabase, 'user-1', req, env, deps);
  assertEquals(res.status, 200);
  assertEquals(deps.hangups, ['rtc_old']);
  assertEquals(updates[0].call_id, 'rtc_new');
  assertEquals(updates[0].connected_at, '2026-09-08T10:00:00Z');
});

Deno.test('if the call id cannot be recorded, the call is hung up rather than left unreachable', async () => {
  const { supabase } = stubDb(OPEN, { updateError: 'db down' });
  const deps = fakeDeps();
  const res = await handleConnect(supabase, 'user-1', req, env, deps);
  assertEquals(res.status, 502);
  assertEquals(deps.hangups, ['rtc_new']);
});

Deno.test('an OpenAI failure is a 502 with no provider text in the body', async () => {
  const { supabase } = stubDb(OPEN);
  const deps = fakeDeps({ create: () => Promise.reject(new Error('calls 401: bad ek')) });
  const res = await handleConnect(supabase, 'user-1', req, env, deps);
  assertEquals(res.status, 502);
  assert(!JSON.stringify(res.body).includes('bad ek'));
});
