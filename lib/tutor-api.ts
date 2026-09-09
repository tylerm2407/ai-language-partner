/**
 * The client half of the `tutor-session` edge function.
 *
 * Three calls, and they are not interchangeable in how they may fail:
 *
 *   `startTutorSession`  — expensive, refusable, and the only one that returns
 *                          a credential. It may throw; the caller has a screen
 *                          to put the error on and nothing is live yet.
 *   `reportTutorTurn`    — fires every 20 seconds for the whole call. It must
 *                          NEVER throw. See its own header.
 *   `endTutorSession`    — settles the money. It may throw, but the money is
 *                          already correct by the time it does.
 *
 * ── THE CLIENT SECRET ──
 *
 * `start` returns an OpenAI ephemeral credential. For the life of the call it
 * is a bearer token for a paid API on our account, and unlike our own JWT
 * nothing about it is scoped to a user we could later disown.
 *
 * It must never be:
 *   - logged (no `console.log`, no `__DEV__` dump, no error message that
 *     interpolates the response body),
 *   - persisted (not AsyncStorage, not a persisted Zustand slice, not
 *     `lib/tutor-storage.ts`),
 *   - put in a route param — expo-router params are reconstructible as a deep
 *     link, and a deep link is a URL that ends up in logs and clipboards,
 *   - put in an analytics property (`EventProperties` is closed, which stops
 *     the accident, but it is worth saying out loud),
 *   - put in a Sentry event.
 *
 * The last one is not free: it needs a `beforeSend`/`beforeBreadcrumb` on the
 * `Sentry.init` in `app/_layout.tsx`. `redactTutorSecrets` below is the whole
 * implementation of that scrub — it lives here, where the shape it is
 * redacting is defined, so that whoever wires it up does not have to know it.
 *
 * Everything this module throws is built from the server's own `error` and
 * `code` strings. It never interpolates a response body, which is what would
 * otherwise carry the secret into a crash report.
 */

import { supabase } from './supabase';
import type { CorrectionMode } from './tutor-storage';
import type { LanguageCode, ProficiencyLevel, TutorDebrief } from '../types';
import type { ScenarioKey } from '../types/scenarios';
import type { WireEndReason } from './tutor-end-reason';

/**
 * Re-exported for convenience, NOT redeclared.
 *
 * The one definition lives in `types/index.ts` — CLAUDE.md section 3 puts DB
 * row shapes there, and this is the shape of the `tutor_sessions.debrief` jsonb
 * column. Everything that consumes a debrief also consumes something else from
 * this module (`endTutorSession`, `asTutorDebrief`), so importing the type from
 * the same place is the shorter path for the caller.
 *
 * `export type`, so this is erased at compile time and creates no second
 * definition for the two to drift apart into: change `types/index.ts` and every
 * importer moves with it, whichever path they came in by. The one thing this
 * does NOT excuse is the hand-kept mirror of
 * `supabase/functions/_shared/tutor-analysis.ts` — that pair is Deno-side and
 * still held together by review alone.
 */
export type { TutorDebrief, TutorDebriefPattern, TutorDebriefPhrase } from '../types';

// Requests to `/functions/v1/...` already carry the 60s `AI_REQUEST_TIMEOUT_MS`
// deadline from the custom `fetch` in `lib/supabase.ts`, so nothing here has to
// arrange one — except the heartbeat, which needs a much shorter one and says
// why below.

/** Property names that may hold the ephemeral credential, in any casing the
 *  wire or a local variable might use. */
const SECRET_KEYS = new Set(['clientSecret', 'client_secret', 'ephemeralKey', 'ephemeral_key']);

const REDACTED = '[redacted]';

/**
 * Strip anything that looks like the ephemeral credential out of an arbitrary
 * object, without mutating it.
 *
 * Written for a Sentry `beforeSend`, which is handed a deeply nested event
 * whose exact shape is the SDK's business rather than ours — so this walks
 * blind and keys on the property name, which is the one thing we do control.
 *
 * Depth-capped. A Sentry event can contain cycles (a captured React component
 * tree, a request object holding its own response) and a scrub that hangs the
 * error path is worse than the leak it prevents.
 */
export function redactTutorSecrets<T>(value: T, depth = 0): T {
  if (value === null || typeof value !== 'object') return value;
  // Past the cap the subtree is replaced rather than returned as-is: handing
  // back the original object would put both an unredacted secret and a
  // potential cycle into the result.
  if (depth > 8) return '[truncated]' as unknown as T;

  if (Array.isArray(value)) {
    return (value as unknown[]).map((entry) => redactTutorSecrets(entry, depth + 1)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEYS.has(key) ? REDACTED : redactTutorSecrets(entry, depth + 1);
  }
  return out as unknown as T;
}

/**
 * A ceiling or an entitlement refused the call.
 *
 * Separate from a generic failure because the answer differs: these are
 * settled states with copy of their own (`tutorLimitCopy` in
 * `lib/limit-messaging.ts`) and retrying them is pointless — the server will
 * refuse identically a second later.
 */
export class TutorLimitError extends Error {
  readonly code: 'DAILY_TUTOR_LIMIT_REACHED' | 'MONTHLY_TUTOR_BUDGET_REACHED' | 'TUTOR_NOT_ENTITLED';

  constructor(message: string, code: TutorLimitError['code']) {
    super(message);
    this.name = 'TutorLimitError';
    this.code = code;
  }
}

function isTutorLimitCode(value: unknown): value is TutorLimitError['code'] {
  return (
    value === 'DAILY_TUTOR_LIMIT_REACHED' ||
    value === 'MONTHLY_TUTOR_BUDGET_REACHED' ||
    value === 'TUTOR_NOT_ENTITLED'
  );
}

/** The server's `{ error, code }` envelope, however it arrived. */
interface ServerFailure {
  detail: string;
  code?: string;
}

/**
 * Unwrap a `supabase.functions.invoke` error into the server's own words.
 *
 * On a non-2xx, supabase-js puts a generic "Edge Function returned a non-2xx
 * status code" on `error.message` and the real body on `error.context` (the
 * raw `Response`). Without this every ceiling reads as the same unhelpful
 * sentence — the same unwrapping `lib/ai.ts` does at every call site.
 *
 * Only `error` and `code` are ever read off the body. Nothing else is
 * interpolated anywhere, which is what keeps a `start` response out of a
 * thrown message.
 */
async function readFailure(error: unknown, fallback: string): Promise<ServerFailure> {
  let detail = (error as { message?: string })?.message ?? fallback;
  let code: string | undefined;

  try {
    const ctx = (error as Record<string, unknown>)?.context;
    if (ctx && typeof (ctx as Response).json === 'function') {
      const body = await (ctx as Response).json();
      if (typeof body?.error === 'string') detail = body.error;
      if (typeof body?.code === 'string') code = body.code;
    }
  } catch {
    // Body wasn't JSON — fall through with the generic message.
  }

  return { detail, code };
}

/** Turn a server failure into the right error class and throw it. */
function throwFailure(failure: ServerFailure, prefix: string): never {
  if (isTutorLimitCode(failure.code)) {
    throw new TutorLimitError(failure.detail, failure.code);
  }
  const suffix = failure.code ? ` [${failure.code}]` : '';
  throw new Error(`${prefix}: ${failure.detail}${suffix}`);
}

/**
 * Invoke `tutor-session`, retrying once on a transient failure.
 *
 * Same policy and the same reasoning as `invokeWithRetry` in `lib/ai.ts`: the
 * device-to-edge hop is the least reliable part of the chain, so a 5xx or a
 * dropped connection is worth one more try, while a 4xx is a decision the
 * server already made and will make again. Retrying a refused `start` would
 * only spend the learner's allowance twice.
 *
 * NOT used by the heartbeat, which fires again on its own in 20 seconds.
 */
async function invokeTutor<T>(
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: unknown }> {
  const attempt = () => supabase.functions.invoke<T>('tutor-session', { body });

  const first = await attempt();
  if (!first.error || !isRetriableInvokeError(first.error)) return first;

  // 150-450ms. Enough to clear a transient blip without being felt as a stall.
  await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 300));
  return attempt();
}

function isRetriableInvokeError(error: unknown): boolean {
  const status = (error as { context?: { status?: number } })?.context?.status;
  if (typeof status === 'number') return status >= 500;

  const name = (error as { name?: string })?.name ?? '';
  const message = String((error as { message?: string })?.message ?? '').toLowerCase();
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('load failed') ||
    message.includes('fetch failed')
  );
}

// ─── start ────────────────────────────────────────────────────────────────

export interface StartTutorSessionInput {
  targetLanguage: LanguageCode;
  /** The learner's own language, used for the debrief and for explanations
   *  mid-call. Defaults to English server-side. */
  nativeLanguage?: LanguageCode;
  level: ProficiencyLevel;
  /** Resolves to a hidden server-side scenario prompt, same as chat. */
  scenarioKey?: ScenarioKey | null;
  correctionMode: CorrectionMode;
  /** Which tutor. Omitted means the server assigns one deterministically. */
  personaId?: string;
  /** How long the learner asked for. The server grants the smaller of this and
   *  what is left of their day and month, so asking for more is not a way to
   *  get more. See `TUTOR_DEFAULTS` in `config/app.ts`. */
  requestedMinutes?: number;
}

export interface StartTutorSessionResult {
  /** `tutor_sessions.id`. The handle for every later call, and safe to log. */
  sessionId: string;
  model: string;
  /**
   * MILLISECONDS reserved and CHARGED IN FULL up front. The client is expected
   * to hang up at it; what is not used is refunded on `end`. It is not a
   * suggestion — once the WebRTC session is established we are not in the
   * media path and cannot stop it.
   *
   * The server speaks SECONDS (`start.ts` returns `grantedSeconds`) and every
   * client-side consumer speaks milliseconds — `assessTutorBudget` takes
   * `grantedMs`, the reducer in `lib/realtime-session.ts` holds `grantedMs`.
   * The conversion happens ONCE, in the parser below, and seconds are never
   * passed upward. See the comment there for why that matters.
   */
  grantedMs: number;
  heartbeatIntervalSeconds: number;
  correctionMode: CorrectionMode;
  personaId: string;
  /** Whole minutes left today AFTER this grant. For "one more call?" copy. */
  remainingTutorMinutesToday: number;
}

/**
 * Open a live tutor session.
 *
 * Throws `TutorLimitError` when a ceiling or the plan refuses (the caller
 * should show `tutorLimitCopy`, not a generic failure), and a plain `Error`
 * for everything else.
 */
export async function startTutorSession(
  input: StartTutorSessionInput,
): Promise<StartTutorSessionResult> {
  const { data, error } = await invokeTutor<Record<string, unknown>>({
    action: 'start',
    targetLanguage: input.targetLanguage,
    ...(input.nativeLanguage ? { nativeLanguage: input.nativeLanguage } : {}),
    level: input.level,
    scenarioKey: input.scenarioKey ?? null,
    correctionMode: input.correctionMode,
    ...(input.personaId ? { personaId: input.personaId } : {}),
    ...(input.requestedMinutes !== undefined ? { requestedMinutes: input.requestedMinutes } : {}),
  });

  if (error) {
    throwFailure(await readFailure(error, 'Could not start the tutor'), 'Could not start the tutor');
  }

  // A 200 that still carries an application-level refusal. Handled the same
  // way so a server that answers 200 with a code cannot bypass the limit path.
  if (data && typeof data.error === 'string') {
    throwFailure(
      { detail: data.error, code: typeof data.code === 'string' ? data.code : undefined },
      'Could not start the tutor',
    );
  }

  const sessionId = typeof data?.sessionId === 'string' ? data.sessionId : '';
  if (!sessionId) {
    // Deliberately says nothing about what DID come back. If a misconfigured
    // server ever put a credential in here, it must not end up in a message.
    throw new Error('Could not start the tutor: the session response was incomplete.');
  }

  return {
    sessionId,
    model: typeof data?.model === 'string' ? data.model : '',
    // THE ONLY seconds-to-milliseconds conversion for the grant, on purpose.
    // If each screen converted for itself, one of them would eventually be off
    // by a factor of 1000 — and that does not present as a rounding error, it
    // presents as "the budget ran out instantly" or "the call never ends".
    grantedMs: (Number(data?.grantedSeconds ?? 0) || 0) * 1000,
    // Falls back rather than defaulting to zero: a zero interval would either
    // spin the heartbeat or stop it, and both cost the learner money.
    heartbeatIntervalSeconds: Number(data?.heartbeatIntervalSeconds ?? 0) || 20,
    correctionMode: (data?.correctionMode as CorrectionMode) ?? input.correctionMode,
    personaId: typeof data?.personaId === 'string' ? data.personaId : (input.personaId ?? ''),
    remainingTutorMinutesToday: Number(data?.remainingTutorMinutesToday ?? 0) || 0,
  };
}

/**
 * The SDP exchange, done by the server.
 *
 * The device never holds an OpenAI credential. It builds its WebRTC offer,
 * sends it here, and gets the answer back; `tutor-session` posts the offer to
 * OpenAI with the ephemeral key it kept, and records the resulting call id so
 * that it — not the device — decides when the call ends. See the server's
 * `_shared/tutor-calls.ts` for why that is the whole spend ceiling.
 *
 * Throws a plain `Error` on any failure; the transport turns that into a
 * `data_channel_closed` for the reducer, exactly as a failed dial always has.
 */
export async function connectTutorCall(input: {
  sessionId: string;
  offerSdp: string;
}): Promise<string> {
  const { data, error } = await invokeTutor<Record<string, unknown>>({
    action: 'connect',
    sessionId: input.sessionId,
    sdp: input.offerSdp,
  });
  if (error) {
    throwFailure(await readFailure(error, 'Could not connect to the tutor'), 'Could not connect to the tutor');
  }
  if (data && typeof data.error === 'string') {
    throwFailure(
      { detail: data.error, code: typeof data.code === 'string' ? data.code : undefined },
      'Could not connect to the tutor',
    );
  }
  const answer = typeof data?.sdp === 'string' ? data.sdp : '';
  if (!answer.startsWith('v=0')) {
    throw new Error('Could not connect to the tutor: the answer was incomplete.');
  }
  return answer;
}

// ─── turn / heartbeat ─────────────────────────────────────────────────────

export interface ReportTutorTurnInput {
  sessionId: string;
  /** Client-measured. Advisory only — the server bills from `started_at`. */
  elapsedSeconds?: number;
  /** What the tutor just said. This is what gets safety-checked. */
  tutorText?: string;
  /** What the learner just said. Checked for the record, never to cut them
   *  off — see the server's `turn.ts`. */
  learnerText?: string;
  recognizerConfidence?: number;
}

export interface TutorTurnResult {
  /** False when the tutor's turn failed the safety check. */
  safe: boolean;
  /** The turn was suppressed and must not appear in the transcript. */
  cut: boolean;
  /** Hang up. The one field a caller must always act on. */
  terminate: boolean;
  /** Why, when `terminate` is true: 'budget' | 'safety'. */
  reason?: string;
  /**
   * Server-measured MILLISECONDS left in the grant.
   *
   * The wire carries `remainingSeconds`; like the grant, it is converted once
   * here so nothing above this module handles two units for one quantity.
   *
   * `NaN` when the round trip failed — see `degraded`. NaN and not 0, -1, or
   * a guess: every comparison against NaN is false, so a caller that writes
   * `remainingMs <= 60_000` does NOT get a spurious warning and one that
   * writes `<= 0` does NOT hang up a call that is fine. A sentinel that reads
   * as "out of time" is the one bug this field could cause.
   */
  remainingMs: number;
  /** True when the server did not answer and everything above is a default. */
  degraded: boolean;
}

/**
 * How long a heartbeat may hang before it is abandoned.
 *
 * Deliberately far below the 60s `AI_REQUEST_TIMEOUT_MS` that
 * `lib/supabase.ts` applies to every edge-function call. At 60s a heartbeat
 * that hangs is still in flight when the next two fire, so a bad network turns
 * a 20s cadence into a growing pile of open sockets on a device that is also
 * carrying a live WebRTC stream. Better to give up before the next one starts:
 * the state we needed written is written again in 20 seconds anyway.
 */
export const TUTOR_TURN_TIMEOUT_MS = 12_000;

/** What a failed heartbeat resolves to. Nothing here ends a call. */
const DEGRADED_TURN: TutorTurnResult = {
  safe: true,
  cut: false,
  terminate: false,
  remainingMs: Number.NaN,
  degraded: true,
};

/**
 * Report one exchange, and prove the session is still alive.
 *
 * THIS FUNCTION DOES NOT THROW. Not "should not" — the whole body is wrapped,
 * because it fires every 20 seconds for the length of a live call and an
 * unhandled rejection inside a React effect during a WebRTC session is a
 * crashed call. A learner mid-sentence losing the tutor because a heartbeat
 * got a 502 is a far worse outcome than a heartbeat that quietly missed.
 *
 * WHAT A MISSED HEARTBEAT ACTUALLY COSTS, so the degradation is an informed
 * one rather than a hopeful one: `last_heartbeat_at` is what the reaper
 * settles an abandoned session to. Missing one moves that mark back by one
 * interval, which matters only if the app then dies before the next. The next
 * successful heartbeat repairs it completely. Missing every heartbeat for a
 * whole call means the session settles as abandoned at its start — the learner
 * is refunded, not overcharged.
 *
 * No retry, on purpose: the next one is 20 seconds away and is a better retry
 * than an immediate one on a network that just failed.
 */
export async function reportTutorTurn(input: ReportTutorTurnInput): Promise<TutorTurnResult> {
  if (!input.sessionId) return DEGRADED_TURN;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TUTOR_TURN_TIMEOUT_MS);

    let data: Record<string, unknown> | null = null;
    let error: unknown = null;
    try {
      const result = await supabase.functions.invoke<Record<string, unknown>>('tutor-session', {
        body: {
          action: 'turn',
          sessionId: input.sessionId,
          ...(input.elapsedSeconds !== undefined ? { elapsedSeconds: input.elapsedSeconds } : {}),
          ...(input.tutorText ? { tutorText: input.tutorText } : {}),
          ...(input.learnerText ? { learnerText: input.learnerText } : {}),
          ...(input.recognizerConfidence !== undefined
            ? { recognizerConfidence: input.recognizerConfidence }
            : {}),
        },
        signal: controller.signal,
      });
      data = result.data;
      error = result.error;
    } finally {
      clearTimeout(timer);
    }

    if (error || !data) return DEGRADED_TURN;

    // A 200 carrying an application-level error. Nothing to act on mid-call.
    if (typeof data.error === 'string') return DEGRADED_TURN;

    return {
      safe: data.safe !== false,
      cut: data.cut === true,
      terminate: data.terminate === true,
      ...(typeof data.reason === 'string' ? { reason: data.reason } : {}),
      // Converted once, same rule as the grant above.
      remainingMs:
        typeof data.remainingSeconds === 'number' ? data.remainingSeconds * 1000 : Number.NaN,
      degraded: false,
    };
  } catch {
    // Anything at all — an abort, a thrown fetch, a malformed response. The
    // call keeps going; that is the entire contract of this function.
    return DEGRADED_TURN;
  }
}

// ─── end ──────────────────────────────────────────────────────────────────

export interface EndTutorSessionResult {
  /**
   * The debrief, or null when there is not one yet. `unknown` at the boundary
   * on purpose — it is model output that has been through the server's writer
   * but not through anything that guarantees this shape to a TypeScript
   * compiler. Narrow it with `asTutorDebrief` before rendering.
   */
  debrief: unknown;
  /** Words from the call that actually became SRS cards. */
  savedWords: string[];
  /** Whole minutes to show, floored at 1 — a 40-second call is not "0". */
  minutesSpoken: number;
  /** The transcript buffer had expired, so there is no debrief and never will
   *  be. The difference between "still being written" and "gone". */
  transcriptLost: boolean;
  /** The session was already closed (a retry, or the reaper got there first).
   *  Not an error — the debrief is the same one either way. */
  alreadyEnded: boolean;
}

/**
 * Close a session: settle the money, then write back what was learned.
 *
 * Worth calling even when the app is tearing down. The server refunds the
 * unused part of the grant here, and a session that is never ended is settled
 * by the reaper to its last heartbeat instead — correct, but up to a heartbeat
 * interval less generous, and the learner waits for their debrief.
 *
 * Safe to call twice. The server answers a second `end` with the same debrief
 * and `alreadyEnded: true` rather than an error, so a retry after a dropped
 * response is the right move.
 */
export async function endTutorSession(input: {
  sessionId: string;
  /**
   * The WIRE vocabulary, not the client's.
   *
   * Deliberately narrowed rather than `string`. The client's `TutorEndReason`
   * has nine values and the edge function accepts five, so a widening cast
   * would compile and ship an unhandled reason on the one request that settles
   * money. `'abandoned'` in particular belongs to `tutor-session-reaper` alone
   * and must never arrive from a client — it is what the reaper writes to mark
   * a session nobody closed.
   *
   * Callers go through `wireEndReason()` in `lib/tutor-end-reason.ts`, and this
   * type is what makes that mandatory instead of merely conventional. The edge
   * function defends itself too (`parseEndRequest` falls back to `'learner'`
   * for anything it does not recognise), but a reason silently rewritten on the
   * server is telemetry quietly lying rather than a caller being corrected.
   */
  endReason: WireEndReason;
}): Promise<EndTutorSessionResult> {
  const { data, error } = await invokeTutor<Record<string, unknown>>({
    action: 'end',
    sessionId: input.sessionId,
    endReason: input.endReason,
  });

  if (error) {
    throwFailure(await readFailure(error, 'Could not end the session'), 'Could not end the session');
  }
  if (data && typeof data.error === 'string') {
    throwFailure(
      { detail: data.error, code: typeof data.code === 'string' ? data.code : undefined },
      'Could not end the session',
    );
  }

  const rawWords: unknown = data?.savedWords;
  const savedWords = Array.isArray(rawWords)
    ? (rawWords as unknown[]).filter((w): w is string => typeof w === 'string')
    : [];

  return {
    debrief: data?.debrief ?? null,
    savedWords,
    minutesSpoken: Number(data?.minutesSpoken ?? 0) || 0,
    transcriptLost: data?.transcriptLost === true,
    alreadyEnded: data?.alreadyEnded === true,
  };
}

/**
 * Narrow a stored or returned debrief into something renderable.
 *
 * Returns null rather than throwing, and drops individual malformed entries
 * rather than the whole debrief: a debrief with one unusable pattern is still
 * worth reading, and this is model output rendered to a learner who has just
 * finished talking for ten minutes.
 */
export function asTutorDebrief(raw: unknown): TutorDebrief | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const v = raw as Record<string, unknown>;

  const patterns = (Array.isArray(v.patterns) ? v.patterns : [])
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p) => ({
      label: String(p.label ?? ''),
      why: String(p.why ?? ''),
      theirs: String(p.theirs ?? ''),
      better: String(p.better ?? ''),
    }))
    .filter((p) => p.label.length > 0 || p.better.length > 0);

  const reachFor = (Array.isArray(v.reachFor) ? v.reachFor : [])
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p) => ({
      phrase: String(p.phrase ?? ''),
      meaning: String(p.meaning ?? ''),
      when: String(p.when ?? ''),
    }))
    .filter((p) => p.phrase.length > 0);

  const highlight = typeof v.highlight === 'string' ? v.highlight : '';
  const nextTime = typeof v.nextTime === 'string' ? v.nextTime : '';

  // Nothing to show at all is not a debrief. Returning an empty one would
  // render a screen of blank sections rather than the "still being written"
  // state the caller has for exactly this.
  if (!highlight && !nextTime && patterns.length === 0 && reachFor.length === 0) return null;

  return {
    highlight,
    patterns,
    reachFor,
    nextTime,
    minutesSpoken: Number(v.minutesSpoken ?? 0) || 0,
  };
}
