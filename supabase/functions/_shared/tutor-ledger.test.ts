import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { reserveTutorSession, settleTutorSession } from './tutor-ledger.ts';

Deno.test('reservation sends both ceilings through one RPC', async () => {
  let call: { name: string; params: Record<string, unknown> } | null = null;
  const supabase = {
    rpc(name: string, params: Record<string, unknown>) {
      call = { name, params };
      return Promise.resolve({ data: { status: 'reserved' }, error: null });
    },
  };

  const status = await reserveTutorSession(supabase, {
    sessionId: 'session-1',
    userId: 'user-1',
    dailyLimit: 1800,
    monthlyLimit: 800,
  });

  assertEquals(status, 'reserved');
  assertEquals(call, {
    name: 'reserve_tutor_session',
    params: {
      p_session_id: 'session-1',
      p_user_id: 'user-1',
      p_daily_limit: 1800,
      p_monthly_limit: 800,
    },
  });
});

Deno.test('a fulfilled Supabase error is still a failed settlement', async () => {
  const supabase = {
    rpc() {
      return Promise.resolve({
        data: null,
        error: { message: 'transaction rolled back' },
      });
    },
  };

  await assertRejects(
    () =>
      settleTutorSession(supabase, {
        sessionId: 'session-1',
        userId: 'user-1',
        settlement: {
          observedSeconds: 120,
          refundSeconds: 480,
          refundCents: 96,
        },
      }),
    Error,
    'transaction rolled back',
  );
});

Deno.test('settlement returns the stored winner on an idempotent retry', async () => {
  const supabase = {
    rpc() {
      return Promise.resolve({
        data: {
          status: 'already_settled',
          observedSeconds: 90,
          refundSeconds: 510,
          refundCents: 102,
        },
        error: null,
      });
    },
  };

  assertEquals(
    await settleTutorSession(supabase, {
      sessionId: 'session-1',
      userId: 'user-1',
      settlement: { observedSeconds: 300, refundSeconds: 300, refundCents: 60 },
    }),
    {
      status: 'already_settled',
      observedSeconds: 90,
      refundSeconds: 510,
      refundCents: 102,
    },
  );
});

Deno.test('malformed ledger responses fail closed', async () => {
  const supabase = {
    rpc() {
      return Promise.resolve({ data: { status: 'settled' }, error: null });
    },
  };

  await assertRejects(
    () =>
      settleTutorSession(supabase, {
        sessionId: 'session-1',
        userId: 'user-1',
        settlement: { observedSeconds: 1, refundSeconds: 1, refundCents: 1 },
      }),
    Error,
    'invalid tutor settlement response',
  );
});
