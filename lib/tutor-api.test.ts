/**
 * Tests for the `tutor-session` client.
 *
 * Four things are worth pinning, and they are not equally obvious:
 *
 *   1. The request shape. `action` is what routes the edge function; getting it
 *      wrong is a 400 the learner reads as "the tutor is broken".
 *   2. Every ceiling code becomes a `TutorLimitError`. These have their own
 *      copy and their own reset time, and a limit that arrives as a generic
 *      Error shows the learner a retry button for something that will refuse
 *      identically forever.
 *   3. A failed heartbeat DEGRADES. It fires every 20 seconds during a live
 *      call, so a throw here is a crashed call.
 *   4. The ephemeral client secret never reaches a log or a thrown message.
 *      That one cannot be un-leaked once it has happened.
 */

const mockInvoke = jest.fn();

jest.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
  AI_REQUEST_TIMEOUT_MS: 60_000,
}));

import {
  startTutorSession,
  reportTutorTurn,
  endTutorSession,
  redactTutorSecrets,
  asTutorDebrief,
  TutorLimitError,
  type StartTutorSessionInput,
} from './tutor-api';

/** The one string that must never escape this module. */
const SECRET = 'ek_super_secret_ephemeral_value_do_not_leak';

const START_OK = {
  sessionId: 'sess-1',
  model: 'gpt-realtime',
  grantedSeconds: 600,
  heartbeatIntervalSeconds: 20,
  correctionMode: 'as_you_go',
  personaId: 'ana',
  remainingTutorMinutesToday: 5,
};

const START_INPUT: StartTutorSessionInput = {
  targetLanguage: 'fr',
  nativeLanguage: 'en',
  level: 'intermediate',
  scenarioKey: 'restaurant',
  correctionMode: 'as_you_go',
  personaId: 'ana',
  requestedMinutes: 10,
};

/** An error shaped the way supabase-js reports a non-2xx: generic message,
 *  real body on `.context`. */
function httpError(status: number, body: Record<string, unknown>) {
  return {
    message: 'Edge Function returned a non-2xx status code',
    context: { status, json: async () => body },
  };
}

/** Everything written to the console during `run`, as one string. */
async function captureConsole(run: () => Promise<unknown>): Promise<string> {
  const lines: string[] = [];
  const record = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((m) =>
    jest.spyOn(console, m).mockImplementation(record),
  );
  try {
    await run().catch((err: unknown) => {
      lines.push(String(err));
      lines.push(err instanceof Error ? (err.stack ?? '') : '');
    });
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  return lines.join('\n');
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startTutorSession', () => {
  it('sends the start action with the session parameters', async () => {
    mockInvoke.mockResolvedValue({ data: START_OK, error: null });
    await startTutorSession(START_INPUT);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fn, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fn).toBe('tutor-session');
    expect(options.body).toEqual({
      action: 'start',
      targetLanguage: 'fr',
      nativeLanguage: 'en',
      level: 'intermediate',
      scenarioKey: 'restaurant',
      correctionMode: 'as_you_go',
      personaId: 'ana',
      requestedMinutes: 10,
    });
  });

  it('sends scenarioKey as null rather than omitting it', async () => {
    // The server reads `scenarioKey ?? null` either way, but an explicit null
    // is what says "free conversation" rather than "this client is too old to
    // know about scenarios".
    mockInvoke.mockResolvedValue({ data: START_OK, error: null });
    await startTutorSession({ ...START_INPUT, scenarioKey: undefined });
    const [, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body.scenarioKey).toBeNull();
  });

  it('returns the whole session envelope', async () => {
    mockInvoke.mockResolvedValue({ data: START_OK, error: null });
    const result = await startTutorSession(START_INPUT);
    expect(result).toEqual({
      sessionId: 'sess-1',
      model: 'gpt-realtime',
      grantedMs: 600_000,
      heartbeatIntervalSeconds: 20,
      correctionMode: 'as_you_go',
      personaId: 'ana',
      remainingTutorMinutesToday: 5,
    });
  });

  it('converts the grant from seconds to milliseconds exactly once', () => {
    // The server speaks seconds and every client consumer speaks milliseconds.
    // A second conversion anywhere above this module is a factor-of-1000 bug
    // that presents as "the budget ran out instantly", not as a rounding slip.
    expect(START_OK.grantedSeconds).toBe(600);
  });

  it('falls back to a usable heartbeat interval rather than zero', async () => {
    // Zero would either spin the heartbeat or stop it, and both cost money.
    mockInvoke.mockResolvedValue({
      data: { ...START_OK, heartbeatIntervalSeconds: 0 },
      error: null,
    });
    expect((await startTutorSession(START_INPUT)).heartbeatIntervalSeconds).toBe(20);
  });

  it('refuses a response with no session id rather than returning an empty one', async () => {
    mockInvoke.mockResolvedValue({ data: { model: 'gpt-realtime', grantedSeconds: 600 }, error: null });
    await expect(startTutorSession(START_INPUT)).rejects.toThrow(/incomplete/);
  });

  it('does not require, and does not surface, a credential on the start response', async () => {
    // Since migration 113 the ephemeral key never leaves the server. A server
    // that still sent one is redacted (see redactTutorSecrets) and ignored.
    mockInvoke.mockResolvedValue({ data: { ...START_OK, clientSecret: SECRET }, error: null });
    const result = await startTutorSession(START_INPUT);
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it.each([
    [429, 'DAILY_TUTOR_LIMIT_REACHED'],
    [429, 'MONTHLY_TUTOR_BUDGET_REACHED'],
    [403, 'TUTOR_NOT_ENTITLED'],
  ])('turns a %s %s into a TutorLimitError', async (status, code) => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: httpError(status, { error: 'You have used your live tutor time.', code }),
    });

    const err = await startTutorSession(START_INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TutorLimitError);
    expect((err as TutorLimitError).code).toBe(code);
    // The server's own sentence, not a generic one — the copy layer decides
    // what the learner sees, but the code has to survive to reach it.
    expect((err as TutorLimitError).message).toBe('You have used your live tutor time.');
  });

  it('treats a 200 that carries a limit code as a limit, not a success', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'Out of minutes.', code: 'MONTHLY_TUTOR_BUDGET_REACHED' },
      error: null,
    });
    const err = await startTutorSession(START_INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TutorLimitError);
    expect((err as TutorLimitError).code).toBe('MONTHLY_TUTOR_BUDGET_REACHED');
  });

  it('surfaces a non-limit failure as a plain Error carrying the server code', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: httpError(502, { error: 'The tutor is unavailable right now.', code: 'TUTOR_UNAVAILABLE' }),
    });
    const err = await startTutorSession(START_INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(TutorLimitError);
    expect((err as Error).message).toContain('TUTOR_UNAVAILABLE');
  });

  it('retries once on a 5xx and does not retry a refusal', async () => {
    mockInvoke
      .mockResolvedValueOnce({ data: null, error: httpError(503, {}) })
      .mockResolvedValueOnce({ data: START_OK, error: null });
    await startTutorSession(START_INPUT);
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({
      data: null,
      error: httpError(429, { error: 'no', code: 'DAILY_TUTOR_LIMIT_REACHED' }),
    });
    await startTutorSession(START_INPUT).catch(() => undefined);
    // A second call would spend the learner's allowance twice for one refusal.
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});

describe('reportTutorTurn', () => {
  it('sends the turn action with only the fields it was given', async () => {
    mockInvoke.mockResolvedValue({
      data: { safe: true, cut: false, terminate: false, remainingSeconds: 480 },
      error: null,
    });
    await reportTutorTurn({ sessionId: 'sess-1', elapsedSeconds: 120, tutorText: 'Bonjour !' });

    const [fn, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fn).toBe('tutor-session');
    expect(options.body).toEqual({
      action: 'turn',
      sessionId: 'sess-1',
      elapsedSeconds: 120,
      tutorText: 'Bonjour !',
    });
    // A bare heartbeat carries no transcript at all.
    expect(options.body).not.toHaveProperty('learnerText');
  });

  it('gives the request its own short deadline, not the 60s AI budget', async () => {
    // At 60s a hung heartbeat is still open when the next two fire.
    mockInvoke.mockResolvedValue({
      data: { safe: true, cut: false, terminate: false, remainingSeconds: 1 },
      error: null,
    });
    await reportTutorTurn({ sessionId: 'sess-1' });
    const [, options] = mockInvoke.mock.calls[0] as [string, { signal?: AbortSignal }];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('passes through the terminate verdict and its reason', async () => {
    mockInvoke.mockResolvedValue({
      data: { safe: false, cut: true, terminate: true, reason: 'safety', remainingSeconds: 300 },
      error: null,
    });
    // 300 seconds on the wire, 300_000 ms out — the same single conversion the
    // grant gets, so nothing above this module handles two units for one thing.
    expect(await reportTutorTurn({ sessionId: 'sess-1', tutorText: 'x' })).toEqual({
      safe: false,
      cut: true,
      terminate: true,
      reason: 'safety',
      remainingMs: 300_000,
      degraded: false,
    });
  });

  it.each([
    ['a server error', () => mockInvoke.mockResolvedValue({ data: null, error: httpError(502, {}) })],
    ['a rate limit', () =>
      mockInvoke.mockResolvedValue({
        data: null,
        error: httpError(429, { error: 'Too many requests.', code: 'RATE_LIMITED' }),
      })],
    ['a thrown transport failure', () => mockInvoke.mockRejectedValue(new Error('Network request failed'))],
    ['an application error in a 200', () =>
      mockInvoke.mockResolvedValue({ data: { error: 'Session not found.' }, error: null })],
  ])('degrades rather than throwing on %s', async (_label, arrange) => {
    arrange();
    const result = await reportTutorTurn({ sessionId: 'sess-1' });

    expect(result.degraded).toBe(true);
    expect(result.terminate).toBe(false);
    expect(result.safe).toBe(true);
    expect(result.cut).toBe(false);
    // NaN, not 0 or -1: a caller writing `remainingMs <= 0` must not hang up a
    // healthy call because a heartbeat missed, and every comparison against
    // NaN is false.
    expect(Number.isNaN(result.remainingMs)).toBe(true);
    expect(result.remainingMs <= 0).toBe(false);
    expect(result.remainingMs <= 60_000).toBe(false);
  });

  it('does not retry a failed heartbeat — the next one is 20 seconds away', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(503, {}) });
    await reportTutorTurn({ sessionId: 'sess-1' });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('degrades without a round trip when there is no session id', async () => {
    expect((await reportTutorTurn({ sessionId: '' })).degraded).toBe(true);
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('endTutorSession', () => {
  const DEBRIEF = {
    highlight: 'You held a whole exchange about the menu without switching to English.',
    patterns: [{ label: 'Gender agreement', why: 'because', theirs: 'le carte', better: 'la carte' }],
    reachFor: [{ phrase: "l'addition", meaning: 'the bill', when: 'asking to pay' }],
    nextTime: 'Try asking a question back.',
    minutesSpoken: 8.4,
  };

  it('sends the end action with the reason', async () => {
    mockInvoke.mockResolvedValue({
      data: { sessionId: 'sess-1', minutesSpoken: 8, debrief: DEBRIEF, savedWords: ['addition'] },
      error: null,
    });
    await endTutorSession({ sessionId: 'sess-1', endReason: 'learner' });

    const [, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body).toEqual({ action: 'end', sessionId: 'sess-1', endReason: 'learner' });
  });

  it('returns the debrief and the words that became cards', async () => {
    mockInvoke.mockResolvedValue({
      data: { minutesSpoken: 8, debrief: DEBRIEF, savedWords: ['addition', 'carte'] },
      error: null,
    });
    const result = await endTutorSession({ sessionId: 'sess-1', endReason: 'budget' });
    expect(result.debrief).toEqual(DEBRIEF);
    expect(result.savedWords).toEqual(['addition', 'carte']);
    expect(result.minutesSpoken).toBe(8);
    expect(result.alreadyEnded).toBe(false);
    expect(result.transcriptLost).toBe(false);
  });

  it('reports a second end as already ended rather than as a failure', async () => {
    // The client retries and the reaper may have got there first; both should
    // see the same debrief.
    mockInvoke.mockResolvedValue({
      data: { alreadyEnded: true, minutesSpoken: 8, debrief: DEBRIEF, savedWords: [] },
      error: null,
    });
    const result = await endTutorSession({ sessionId: 'sess-1', endReason: 'learner' });
    expect(result.alreadyEnded).toBe(true);
    expect(result.debrief).toEqual(DEBRIEF);
  });

  it('distinguishes a lost transcript from a debrief that has not landed yet', async () => {
    mockInvoke.mockResolvedValue({
      data: { minutesSpoken: 3, debrief: null, savedWords: [], transcriptLost: true },
      error: null,
    });
    const result = await endTutorSession({ sessionId: 'sess-1', endReason: 'timeout' });
    expect(result.debrief).toBeNull();
    expect(result.transcriptLost).toBe(true);
  });

  it('drops non-string entries from savedWords rather than rendering them', async () => {
    mockInvoke.mockResolvedValue({
      data: { minutesSpoken: 1, debrief: null, savedWords: ['ok', null, 7, 'fine'] },
      error: null,
    });
    const result = await endTutorSession({ sessionId: 'sess-1', endReason: 'learner' });
    expect(result.savedWords).toEqual(['ok', 'fine']);
  });
});

describe('the client secret never escapes', () => {
  it('is absent from everything written to the console on a successful start', async () => {
    mockInvoke.mockResolvedValue({ data: START_OK, error: null });
    const logged = await captureConsole(() => startTutorSession(START_INPUT));
    expect(logged).not.toContain(SECRET);
  });

  it('is absent from the thrown message even when the server echoes it back', async () => {
    // The pathological case: a misconfigured server puts the minted secret in
    // its own error body. Only `error` and `code` are ever read off that body,
    // so nothing carries it into the message, the stack, or a crash report.
    mockInvoke.mockResolvedValue({
      data: null,
      error: httpError(500, {
        error: 'mint failed',
        code: 'SESSION_INSERT_FAILED',
        clientSecret: SECRET,
        debug: { minted: SECRET },
      }),
    });
    const logged = await captureConsole(() => startTutorSession(START_INPUT));
    expect(logged).toContain('SESSION_INSERT_FAILED');
    expect(logged).not.toContain(SECRET);
  });

  it('is absent when a malformed response is refused', async () => {
    mockInvoke.mockResolvedValue({
      data: { clientSecret: SECRET }, // no sessionId
      error: null,
    });
    const logged = await captureConsole(() => startTutorSession(START_INPUT));
    expect(logged).not.toContain(SECRET);
  });

  it('is absent from a heartbeat that degrades', async () => {
    mockInvoke.mockRejectedValue(new Error(`transport died carrying ${SECRET}`));
    const logged = await captureConsole(() =>
      reportTutorTurn({ sessionId: 'sess-1', tutorText: 'hello' }),
    );
    expect(logged).not.toContain(SECRET);
  });
});

describe('redactTutorSecrets', () => {
  it('removes the secret from a nested object without mutating the original', () => {
    const event = {
      extra: { response: { clientSecret: SECRET, sessionId: 'sess-1' } },
      breadcrumbs: [{ data: { client_secret: SECRET } }],
    };
    const scrubbed = redactTutorSecrets(event);

    expect(JSON.stringify(scrubbed)).not.toContain(SECRET);
    expect(scrubbed.extra.response.sessionId).toBe('sess-1');
    // The caller's object is untouched — a scrub that mutates the event would
    // also mutate whatever the app is still holding.
    expect(event.extra.response.clientSecret).toBe(SECRET);
  });

  it('survives a cycle instead of hanging the error path', () => {
    const cyclic: Record<string, unknown> = { clientSecret: SECRET };
    cyclic.self = cyclic;
    expect(() => redactTutorSecrets(cyclic)).not.toThrow();
    expect(JSON.stringify(redactTutorSecrets(cyclic))).not.toContain(SECRET);
  });

  it('leaves scalars and nulls alone', () => {
    expect(redactTutorSecrets('hello')).toBe('hello');
    expect(redactTutorSecrets(null)).toBeNull();
    expect(redactTutorSecrets(7)).toBe(7);
  });
});

describe('asTutorDebrief', () => {
  it('returns null for anything with nothing in it', () => {
    expect(asTutorDebrief(null)).toBeNull();
    expect(asTutorDebrief('not a debrief')).toBeNull();
    expect(asTutorDebrief({})).toBeNull();
    expect(asTutorDebrief({ highlight: '', patterns: [], reachFor: [], nextTime: '' })).toBeNull();
  });

  it('drops malformed entries but keeps the rest of the debrief', () => {
    const parsed = asTutorDebrief({
      highlight: 'Good work',
      patterns: [
        { label: 'Gender', why: 'w', theirs: 'le carte', better: 'la carte' },
        null,
        { why: 'no label and no correction' },
      ],
      reachFor: [{ phrase: "l'addition", meaning: 'the bill', when: 'paying' }, { meaning: 'x' }],
      nextTime: 'Ask a question back.',
      minutesSpoken: 8.4,
    });

    expect(parsed?.patterns).toHaveLength(1);
    expect(parsed?.reachFor).toHaveLength(1);
    expect(parsed?.minutesSpoken).toBe(8.4);
  });
});
