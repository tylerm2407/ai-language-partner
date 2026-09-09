/**
 * The live tutor session state machine.
 *
 * Everything the speech-to-speech tutor DECIDES lives here — pure, clock-free,
 * effect-free — and the host hook is left holding nothing but I/O. Same
 * arrangement, and same reason, as `lib/handsfree-session.ts`: if you find
 * yourself writing an `if` in the hook that is not about performing an effect,
 * it belongs in this file.
 *
 * The reason is sharper here than anywhere else in the app. This feature rides
 * on `react-native-webrtc`, which is not installed yet and whose viability is
 * still being checked. So this module imports nothing from it, never touches
 * `RTCPeerConnection`, never calls `Date.now()` or `Math.random()`, and never
 * performs I/O. All of it is therefore testable TODAY, on a machine with no
 * microphone. And even once the native module lands that still matters: WebRTC
 * audio working once on the iOS simulator is not evidence that barge-in,
 * budgeting, or reconnect are correct.
 *
 * TIMERS ARE THE HOST'S JOB. The reducer asks for one with a `schedule` effect
 * and hears back with `timer_fired`. But the token is OPAQUE to the reducer and
 * is never validated: correctness comes from absolute deadlines held in state,
 * not from timer identity. A stale timer, a duplicated timer, or a timer that
 * never fires at all are all harmless — the next `tick` reaches the same
 * conclusion. That removes an entire category of "we cancelled the wrong
 * timeout" bugs from a code path nobody can watch happen.
 *
 * THE SHAPE OF THE THING WORTH KNOWING BEFORE CHANGING IT:
 *
 * - `interrupted` is a real phase, not a flag. Entering it clears the output
 *   buffer exactly ONCE per tutor turn and marks that turn truncated. A tutor
 *   turn the learner cut off after four words is not a turn they heard, and
 *   letting it into the transcript as though it were is a bug class this app
 *   has already shipped once.
 *
 * - The budget NEVER hard-cuts mid-sentence. Cutting a teacher off mid-word is
 *   exactly the failure `lib/handsfree-budget.ts` was written to avoid. At 60s
 *   left the tutor is cued to wrap up and does so in its own words; at zero, a
 *   sentence already in flight gets a bounded grace to finish.
 *
 * - Reconnect happens at most ONCE. OpenAI has no session resume: a reconnect
 *   produces a tutor with amnesia. Doing it twice produces a tutor with amnesia
 *   twice, which is worse for the learner than a clean "the connection dropped".
 *
 * - An OS interruption PAUSES; it does not tear down. Reconnecting would cost
 *   another ephemeral token and the entire conversation so far, to recover from
 *   a phone call the learner declined in four seconds.
 *
 * - A late event after `ended` must never resurrect the session. `lib/vad.ts`
 *   enforces the same invariant for the same reason: audio callbacks arrive
 *   after teardown as a matter of routine, not as an anomaly.
 */

import {
  CLOSING_CUE,
  MODE_CONTROL_DEBRIEF,
  MODE_CONTROL_LIVE,
  controlItemEvent,
  responseCreateEvent,
  type RealtimeClientEvent,
  type RealtimeServerEvent,
} from './realtime-events';

// ─── Phases, reasons, modes ─────────────────────────────────────────────

export type TutorPhase =
  | 'idle'
  | 'preflight'
  | 'connecting'
  | 'greeting'
  | 'listening'
  | 'tutor_speaking'
  | 'interrupted'
  | 'paused'
  | 'reconnecting'
  | 'ending'
  | 'ended'
  /**
   * Declared for the host's benefit, and deliberately never entered by this
   * reducer. There is exactly ONE terminal state — `ended`, carrying a
   * `TutorEndReason` — because inertness after teardown has to be enforced in
   * exactly one place. Two terminal phases means two guards, and the second
   * one gets forgotten the first time somebody adds a state. A failed session
   * is `ended` with reason `server_error` or `network_lost`; render that.
   */
  | 'error';

export type TutorEndReason =
  | 'user_ended'
  | 'budget_exhausted'
  | 'session_max'
  | 'network_lost'
  | 'permission_denied'
  | 'consent_declined'
  | 'app_backgrounded'
  | 'safety'
  | 'server_error';

/** Live correction during the call, or held back for the debrief afterwards. */
export type TutorCorrectionMode = 'live' | 'debrief';

/**
 * The SAME choice, in the vocabulary everything outside this reducer uses.
 *
 * There are deliberately two names for one setting, and they are not
 * interchangeable:
 *
 *   - `'as_you_go' | 'let_me_talk'` is the LEARNER's choice. It is what
 *     `lib/tutor-storage.ts` persists and what the `tutor_sessions.correction_mode`
 *     CHECK constraint accepts, so it is fixed by the database and cannot be
 *     renamed without a migration.
 *   - `'live' | 'debrief'` is the reducer's INTERNAL state, named after what the
 *     tutor does rather than after what the learner asked for.
 *
 * They are converted in exactly one place — here — because a screen doing its
 * own `mode === 'as_you_go' ? 'live' : 'debrief'` is how one call surface ends
 * up silently putting a learner who asked to be left alone into correcting
 * mode, which is the single thing they explicitly opted out of.
 */
export type StoredCorrectionMode = 'as_you_go' | 'let_me_talk';

export function toSessionCorrectionMode(stored: StoredCorrectionMode): TutorCorrectionMode {
  return stored === 'as_you_go' ? 'live' : 'debrief';
}

export function toStoredCorrectionMode(mode: TutorCorrectionMode): StoredCorrectionMode {
  return mode === 'live' ? 'as_you_go' : 'let_me_talk';
}

export type TutorIceState = 'connected' | 'disconnected' | 'failed' | 'closed';

/**
 * WHICH WIRE SIGNAL MEANS "THE TUTOR'S VOICE IS AUDIBLE". Single point of
 * change; nothing else in this file decides it.
 *
 * `output_audio_buffer.started/.stopped` are WebRTC-only server events, and I
 * could not verify they are emitted on every path — so they are not a
 * dependency. The primary signal is derived instead from the tutor's own
 * transcript: the first `response.output_audio_transcript.delta` means audio is
 * coming, `response.done` means it is over.
 *
 * That derivation has one known inaccuracy, and it is why `auto` exists: the
 * model generates transcript faster than realtime, so `response.done` fires
 * while the last second or two of audio is still draining out of the peer
 * connection. `output_audio_buffer.stopped` is the truthful end-of-audio
 * signal. So: derive from the transcript until an `output_audio_buffer` event
 * actually shows up, then trust that source for the rest of the session. Pin
 * this to `'transcript'` or `'output_audio_buffer'` to force one.
 */
export const TUTOR_SPEAKING_SOURCE: 'auto' | 'transcript' | 'output_audio_buffer' = 'auto';

// ─── Configuration ──────────────────────────────────────────────────────

export interface TutorSessionConfig {
  /** Wall-clock ceiling regardless of what the server granted. */
  maxSessionMs: number;
  /** Remaining budget at which the UI starts warning. No audio interruption. */
  warningMs: number;
  /** Remaining budget at which the tutor is cued to wrap up. */
  closingCueMs: number;
  /** How long a sentence already in flight may overrun a spent budget. */
  overrunGraceMs: number;
  /** ICE `disconnected` self-heals this often; wait before doing anything. */
  iceGraceMs: number;
  /** Ceiling on the initial connect. */
  connectTimeoutMs: number;
  /** Ceiling on the one reconnect attempt. */
  reconnectBudgetMs: number;
  /** One. See the header. */
  maxReconnects: number;
  /** A backgrounded app that never returns ends rather than holding the mic. */
  backgroundGraceMs: number;
  /** Belt-and-braces exit from `interrupted` if no confirming event arrives. */
  interruptSettleMs: number;
  /** Non-fatal server errors tolerated before concluding the session is wedged. */
  maxTransientErrors: number;
}

export const TUTOR_SESSION_DEFAULTS: TutorSessionConfig = {
  maxSessionMs: 15 * 60 * 1000,
  warningMs: 120_000,
  closingCueMs: 60_000,
  overrunGraceMs: 15_000,
  iceGraceMs: 4_000,
  connectTimeoutMs: 15_000,
  reconnectBudgetMs: 8_000,
  maxReconnects: 1,
  backgroundGraceMs: 30_000,
  interruptSettleMs: 250,
  maxTransientErrors: 5,
};

/**
 * Error codes that mean this session is over. Everything NOT in here is
 * treated as a complaint about one client event — a stale item id, a cancel
 * with nothing to cancel — and is counted, not acted on. Ending a lesson over
 * one grumpy frame is far worse than ignoring it; a steady stream of them is
 * caught by `maxTransientErrors`.
 */
const FATAL_ERROR_CODES: ReadonlySet<string> = new Set([
  'session_expired',
  'session_not_found',
  'invalid_session',
  'unauthorized',
  'invalid_api_key',
  'insufficient_quota',
  'rate_limit_exceeded',
]);

const SAFETY_ERROR_CODES: ReadonlySet<string> = new Set([
  'content_policy_violation',
  'moderation_blocked',
  'safety_violation',
]);

// ─── Effects: data the host performs, never callbacks ───────────────────

export type TutorEffect =
  | { readonly kind: 'acquire_mic' }
  /** Discard any existing peer connection and dial. `attempt` starts at 1. */
  | { readonly kind: 'connect'; readonly sessionId: string; readonly model: string; readonly attempt: number }
  | { readonly kind: 'send'; readonly event: RealtimeClientEvent }
  | { readonly kind: 'set_mic_enabled'; readonly enabled: boolean }
  /** Maps to the WebRTC-only `output_audio_buffer.clear` client event. */
  | { readonly kind: 'clear_output_buffer' }
  | { readonly kind: 'teardown'; readonly releaseAudio: boolean }
  | { readonly kind: 'schedule'; readonly at: number; readonly token: string }
  | { readonly kind: 'navigate_debrief'; readonly sessionId: string };

type TimerPurpose =
  | 'connect'
  | 'ice_grace'
  | 'background'
  | 'interrupt_settle'
  | 'overrun';

// ─── Turns ──────────────────────────────────────────────────────────────

/**
 * A finished turn, handed to whoever persists transcripts.
 *
 * `truncated` is the load-bearing field. When it is true the learner heard SOME
 * PREFIX of `text` and we do not know which — the transcript is what the model
 * generated, not what came out of the speaker. Consumers must not count a
 * truncated turn as heard, quote it back in a debrief, or mine it for
 * vocabulary the learner was "exposed to".
 */
export interface TutorTurnRecord {
  readonly role: 'tutor' | 'learner';
  readonly id: string;
  readonly text: string;
  readonly truncated: boolean;
  readonly at: number;
}

// ─── State ──────────────────────────────────────────────────────────────

export interface TutorSessionState {
  readonly phase: TutorPhase;
  readonly config: TutorSessionConfig;
  readonly now: number;

  /** Our own session row id, for the debrief screen. */
  readonly sessionId: string | null;
  /** OpenAI's id, from `session.created`. Logging only. */
  readonly realtimeSessionId: string | null;
  readonly model: string;
  readonly correctionMode: TutorCorrectionMode;

  /** Milliseconds of conversation the server authorised. */
  readonly grantedMs: number;
  /** When audio actually began. Preflight and dialling are free. */
  readonly startedAt: number | null;
  /** Start of the current pause or reconnect, or null when running. */
  readonly heldSince: number | null;
  readonly heldTotalMs: number;
  readonly budgetWarned: boolean;
  readonly closingCueSent: boolean;

  readonly tutorAudioActive: boolean;
  /** Once true, `output_audio_buffer.*` is trusted over the transcript. */
  readonly audioBufferSignalSeen: boolean;
  readonly currentResponseId: string | null;
  readonly pendingTutorText: string;
  readonly pendingTutorTruncated: boolean;
  /** Output buffer already cleared for the current tutor turn. Enforces EXACTLY ONCE. */
  readonly clearedThisTurn: boolean;
  readonly pendingLearner: readonly { readonly itemId: string; readonly text: string }[];
  readonly turns: readonly TutorTurnRecord[];

  readonly reconnectsUsed: number;
  readonly errorCount: number;
  readonly lastError: string | null;
  readonly osInterrupted: boolean;
  readonly backgrounded: boolean;
  readonly endReason: TutorEndReason | null;

  readonly timerSeq: number;
  readonly connectDeadline: number | null;
  readonly iceGraceDeadline: number | null;
  readonly backgroundDeadline: number | null;
  readonly interruptSettleDeadline: number | null;
  readonly overrunDeadline: number | null;
}

// ─── Commands ───────────────────────────────────────────────────────────

export type TutorCommand =
  | {
      type: 'start';
      now: number;
      sessionId: string;
      model: string;
      grantedMs: number;
      correctionMode: TutorCorrectionMode;
    }
  | { type: 'mic_granted'; now: number }
  | { type: 'mic_denied'; now: number }
  | { type: 'consent_declined'; now: number }
  /** The data channel opened. Transport is up; the session may not be ready yet. */
  | { type: 'transport_open'; now: number }
  | { type: 'ice_state'; now: number; state: TutorIceState }
  | { type: 'data_channel_closed'; now: number }
  | { type: 'server_event'; now: number; event: RealtimeServerEvent }
  | { type: 'set_correction_mode'; now: number; mode: TutorCorrectionMode }
  /** An OS audio interruption began or ended — a phone call, an alarm. */
  | { type: 'os_interruption'; now: number; began: boolean }
  | { type: 'app_focus'; now: number; foreground: boolean }
  /** A client-side classifier or a moderator pulled the plug. */
  | { type: 'safety_stop'; now: number }
  /**
   * The SERVER ended it, and its reason wins.
   *
   * The `turn` endpoint returns `terminate` with a reason, and that verdict is
   * authoritative over the client's own budget ladder for a concrete reason:
   * the server measures wall clock from `started_at`, while this reducer
   * measures `grantedMs - liveMs` with pauses and reconnects excluded. The
   * server therefore ALWAYS runs out first — by seconds on a clean call, by
   * minutes after a phone-call pause. Waiting for the local ladder would hold
   * a paid Realtime session open past the grant we reserved for it.
   *
   * It also has to carry the reason rather than reuse an existing command.
   * Routing a server budget-stop through `user_end` records it on the wire as
   * `'learner'` — the learner hung up — which under-reports budget ends in
   * `tutor_sessions.end_reason`, and routing it through `safety_stop` would
   * file a moderation event that never happened. Both are false records of
   * something the server already knows the truth about.
   */
  | { type: 'server_ended'; now: number; reason: TutorEndReason }
  | { type: 'user_end'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'timer_fired'; now: number; token: string };

export interface TutorReduceResult {
  readonly state: TutorSessionState;
  readonly effects: readonly TutorEffect[];
}

interface Reduced {
  state: TutorSessionState;
  effects: TutorEffect[];
}

// ─── Construction and read models ───────────────────────────────────────

export function createTutorSession(
  config: TutorSessionConfig,
  now: number,
): TutorSessionState {
  return {
    phase: 'idle',
    config,
    now,
    sessionId: null,
    realtimeSessionId: null,
    model: '',
    correctionMode: 'debrief',
    grantedMs: 0,
    startedAt: null,
    heldSince: null,
    heldTotalMs: 0,
    budgetWarned: false,
    closingCueSent: false,
    tutorAudioActive: false,
    audioBufferSignalSeen: false,
    currentResponseId: null,
    pendingTutorText: '',
    pendingTutorTruncated: false,
    clearedThisTurn: false,
    pendingLearner: [],
    turns: [],
    reconnectsUsed: 0,
    errorCount: 0,
    lastError: null,
    osInterrupted: false,
    backgrounded: false,
    endReason: null,
    timerSeq: 0,
    connectDeadline: null,
    iceGraceDeadline: null,
    backgroundDeadline: null,
    interruptSettleDeadline: null,
    overrunDeadline: null,
  };
}

/** Conversation time, excluding pauses and reconnects. */
export function sessionLiveMs(state: TutorSessionState): number {
  if (state.startedAt === null) return 0;
  const holding = state.heldSince === null ? 0 : state.now - state.heldSince;
  return Math.max(0, state.now - state.startedAt - state.heldTotalMs - holding);
}

export function remainingBudgetMs(state: TutorSessionState): number {
  const live = sessionLiveMs(state);
  return Math.max(0, Math.min(state.grantedMs - live, state.config.maxSessionMs - live));
}

/** Which ceiling is about to bite — the paid grant, or the wall clock. */
export function limitingBound(state: TutorSessionState): 'budget' | 'session' {
  return state.grantedMs <= state.config.maxSessionMs ? 'budget' : 'session';
}

export function isLive(state: TutorSessionState): boolean {
  return (
    state.phase === 'greeting' ||
    state.phase === 'listening' ||
    state.phase === 'tutor_speaking' ||
    state.phase === 'interrupted' ||
    state.phase === 'ending'
  );
}

// ─── Internal helpers ───────────────────────────────────────────────────

function withTimer(
  state: TutorSessionState,
  purpose: TimerPurpose,
  at: number,
): { state: TutorSessionState; effect: TutorEffect } {
  const seq = state.timerSeq + 1;
  return {
    state: { ...state, timerSeq: seq },
    effect: { kind: 'schedule', at, token: `${purpose}:${seq}` },
  };
}

/** Stop the clock. Idempotent, because two hold reasons can overlap. */
function hold(state: TutorSessionState): TutorSessionState {
  if (state.heldSince !== null || state.startedAt === null) return state;
  return { ...state, heldSince: state.now };
}

function release(state: TutorSessionState): TutorSessionState {
  if (state.heldSince === null) return state;
  return {
    ...state,
    heldTotalMs: state.heldTotalMs + Math.max(0, state.now - state.heldSince),
    heldSince: null,
  };
}

const NO_DEADLINES = {
  connectDeadline: null,
  iceGraceDeadline: null,
  backgroundDeadline: null,
  interruptSettleDeadline: null,
  overrunDeadline: null,
} as const;

function finishTutorTurn(state: TutorSessionState, id: string | null): TutorSessionState {
  if (state.pendingTutorText.trim().length === 0) {
    return { ...state, pendingTutorText: '', pendingTutorTruncated: false };
  }
  const turn: TutorTurnRecord = {
    role: 'tutor',
    id: id ?? state.currentResponseId ?? 'pending',
    text: state.pendingTutorText,
    truncated: state.pendingTutorTruncated,
    at: state.now,
  };
  return {
    ...state,
    turns: [...state.turns, turn],
    pendingTutorText: '',
    pendingTutorTruncated: false,
  };
}

function endSession(
  state: TutorSessionState,
  reason: TutorEndReason,
  prior: TutorEffect[] = [],
): Reduced {
  // A tutor turn still in flight at teardown was, by definition, not heard to
  // the end. Flush it truncated rather than dropping it — the debrief still
  // wants to know what was being said when the call died.
  const flushed = finishTutorTurn({ ...state, pendingTutorTruncated: true }, null);
  const settled = release(flushed);

  const effects: TutorEffect[] = [
    ...prior,
    // Deactivating the audio session while iOS holds it for a phone call
    // throws. The OS owns the route until the interruption ends; let it.
    { kind: 'teardown', releaseAudio: !state.osInterrupted },
  ];

  // No conversation happened, so there is nothing to debrief. Pushing the
  // learner to a debrief screen after they declined consent would be absurd.
  const debriefable =
    reason !== 'consent_declined' && reason !== 'permission_denied' && settled.turns.length > 0;
  if (debriefable && settled.sessionId !== null) {
    effects.push({ kind: 'navigate_debrief', sessionId: settled.sessionId });
  }

  return {
    state: {
      ...settled,
      ...NO_DEADLINES,
      phase: 'ended',
      endReason: reason,
      tutorAudioActive: false,
      pendingLearner: [],
    },
    effects,
  };
}

/** Enter `reconnecting`, or give up if the one attempt is already spent. */
function reconnectOrEnd(state: TutorSessionState, prior: TutorEffect[] = []): Reduced {
  if (state.reconnectsUsed >= state.config.maxReconnects || state.sessionId === null) {
    return endSession(state, 'network_lost', prior);
  }
  const reconnectsUsed = state.reconnectsUsed + 1;
  // `attempt` counts dials, not reconnects, so the host's logs line up: the
  // initial dial was attempt 1 and this is the next one.
  const attempt = reconnectsUsed + 1;
  const held = hold(state);
  const timer = withTimer(
    {
      ...held,
      phase: 'reconnecting',
      reconnectsUsed,
      tutorAudioActive: false,
      iceGraceDeadline: null,
      interruptSettleDeadline: null,
      // The elapsed budget is deliberately NOT reset. A learner does not get
      // free minutes for a bad tunnel, and more to the point the server grant
      // is the thing being spent.
    },
    'connect',
    state.now + state.config.reconnectBudgetMs,
  );
  return {
    state: { ...timer.state, connectDeadline: state.now + state.config.reconnectBudgetMs },
    effects: [
      ...prior,
      { kind: 'set_mic_enabled', enabled: false },
      { kind: 'connect', sessionId: state.sessionId, model: state.model, attempt },
      timer.effect,
    ],
  };
}

/** The session is ready: first time it greets, on a reconnect it just listens. */
function onSessionReady(state: TutorSessionState): Reduced {
  const first = state.startedAt === null;
  const running = release({ ...state, connectDeadline: null, iceGraceDeadline: null });

  if (!first) {
    // Silent resume. No greeting, because a second "hello, what shall we talk
    // about?" mid-conversation announces the amnesia rather than hiding it.
    return {
      state: { ...running, phase: 'listening' },
      effects: [{ kind: 'set_mic_enabled', enabled: true }],
    };
  }
  return {
    state: { ...running, phase: 'greeting', startedAt: state.now },
    effects: [
      { kind: 'set_mic_enabled', enabled: true },
      { kind: 'send', event: responseCreateEvent() },
    ],
  };
}

function markTutorAudible(state: TutorSessionState): TutorSessionState {
  const phase: TutorPhase =
    state.phase === 'greeting' || state.phase === 'listening' ? 'tutor_speaking' : state.phase;
  return { ...state, tutorAudioActive: true, phase };
}

function markTutorSilent(state: TutorSessionState): TutorSessionState {
  const phase: TutorPhase =
    state.phase === 'tutor_speaking' || state.phase === 'interrupted' || state.phase === 'greeting'
      ? 'listening'
      : state.phase;
  return { ...state, tutorAudioActive: false, phase, interruptSettleDeadline: null };
}

function leaveInterrupted(state: TutorSessionState): TutorSessionState {
  if (state.phase !== 'interrupted') return { ...state, interruptSettleDeadline: null };
  return { ...state, phase: 'listening', interruptSettleDeadline: null };
}

/**
 * The learner talked over the tutor.
 *
 * This is the whole reason WebRTC was chosen over the existing record-then-send
 * cascade: the microphone stays open while the tutor speaks, because hardware
 * echo cancellation stops the tutor hearing itself. Barge-in is therefore not
 * an edge case here, it is how the conversation is supposed to feel.
 */
function bargeIn(state: TutorSessionState): Reduced {
  const effects: TutorEffect[] = [];
  // EXACTLY ONCE per tutor turn. Server VAD can emit speech_started more than
  // once inside one response (a false start, a cough, then the real sentence),
  // and each extra clear is a wasted round trip that can chop the FRONT off the
  // tutor's next turn.
  if (!state.clearedThisTurn) effects.push({ kind: 'clear_output_buffer' });

  const marked: TutorSessionState = {
    ...state,
    clearedThisTurn: true,
    pendingTutorTruncated: true,
    tutorAudioActive: false,
  };

  // While wrapping up we do not show an interrupted state — the session is
  // already on its way out and flickering the UI adds nothing.
  if (marked.phase === 'ending') return { state: marked, effects };

  const timer = withTimer(
    { ...marked, phase: 'interrupted' },
    'interrupt_settle',
    state.now + state.config.interruptSettleMs,
  );
  return {
    state: { ...timer.state, interruptSettleDeadline: state.now + state.config.interruptSettleMs },
    effects: [...effects, timer.effect],
  };
}

// ─── Server events ──────────────────────────────────────────────────────

function handleServerEvent(state: TutorSessionState, event: RealtimeServerEvent): Reduced {
  const none = (s: TutorSessionState): Reduced => ({ state: s, effects: [] });
  const trustBuffer =
    TUTOR_SPEAKING_SOURCE === 'output_audio_buffer' ||
    (TUTOR_SPEAKING_SOURCE === 'auto' && state.audioBufferSignalSeen);

  switch (event.kind) {
    case 'session_created': {
      const seen = { ...state, realtimeSessionId: event.sessionId };
      if (seen.phase === 'connecting' || seen.phase === 'reconnecting') return onSessionReady(seen);
      return none(seen);
    }

    case 'session_updated':
      return none(state);

    case 'speech_started': {
      if (!isLive(state)) return none(state);
      if (state.tutorAudioActive) return bargeIn(state);
      if (state.phase === 'greeting') return none({ ...state, phase: 'listening' });
      return none(state);
    }

    case 'speech_stopped':
      return none(leaveInterrupted(state));

    case 'input_transcript_delta': {
      const key = event.itemId ?? '';
      const existing = state.pendingLearner.find((t) => t.itemId === key);
      const pendingLearner = existing
        ? state.pendingLearner.map((t) =>
            t.itemId === key ? { itemId: key, text: t.text + event.delta } : t,
          )
        : [...state.pendingLearner, { itemId: key, text: event.delta }];
      return none({ ...state, pendingLearner });
    }

    case 'input_transcript_done': {
      const key = event.itemId ?? '';
      const pendingLearner = state.pendingLearner.filter((t) => t.itemId !== key);
      // The `completed` payload is authoritative; the deltas were a preview.
      const finalText = event.transcript.trim().length > 0
        ? event.transcript
        : (state.pendingLearner.find((t) => t.itemId === key)?.text ?? '');
      if (finalText.trim().length === 0) return none({ ...state, pendingLearner });
      const turn: TutorTurnRecord = {
        role: 'learner',
        id: key,
        text: finalText,
        truncated: false,
        at: state.now,
      };
      return none({ ...state, pendingLearner, turns: [...state.turns, turn] });
    }

    case 'input_transcript_failed': {
      // Drop the partial rather than committing an empty learner turn. An empty
      // turn reads, downstream, as "the learner said nothing" — which is a
      // false claim about a person who may have spoken for ten seconds.
      const key = event.itemId ?? '';
      return none({
        ...state,
        pendingLearner: state.pendingLearner.filter((t) => t.itemId !== key),
      });
    }

    case 'response_created':
      return none({
        ...state,
        currentResponseId: event.responseId,
        pendingTutorText: '',
        pendingTutorTruncated: false,
        clearedThisTurn: false,
      });

    case 'tutor_transcript_delta': {
      const appended = { ...state, pendingTutorText: state.pendingTutorText + event.delta };
      return none(trustBuffer ? appended : markTutorAudible(appended));
    }

    case 'tutor_transcript_done':
      return none(
        event.transcript.trim().length > 0
          ? { ...state, pendingTutorText: event.transcript }
          : state,
      );

    case 'response_done': {
      const finished = finishTutorTurn(state, event.responseId);
      if (event.status === 'failed') {
        const failed = { ...finished, errorCount: finished.errorCount + 1, lastError: event.errorMessage };
        return none(trustBuffer ? failed : markTutorSilent(failed));
      }
      return none(trustBuffer ? finished : markTutorSilent(finished));
    }

    case 'output_audio_started':
      return none(markTutorAudible({ ...state, audioBufferSignalSeen: true }));

    case 'output_audio_stopped':
      return none(markTutorSilent({ ...state, audioBufferSignalSeen: true }));

    case 'output_audio_cleared':
      return none(markTutorSilent({ ...state, audioBufferSignalSeen: true }));

    case 'rate_limits':
      // Informational. The budget this session actually obeys is `grantedMs`,
      // which the server issued knowing what it was willing to pay for.
      return none(state);

    case 'error': {
      const code = event.code ?? event.errorType ?? '';
      if (SAFETY_ERROR_CODES.has(code)) {
        return endSession({ ...state, lastError: event.message }, 'safety');
      }
      const counted = {
        ...state,
        errorCount: state.errorCount + 1,
        lastError: event.message,
      };
      if (FATAL_ERROR_CODES.has(code) || counted.errorCount >= state.config.maxTransientErrors) {
        return endSession(counted, 'server_error');
      }
      return none(counted);
    }

    case 'unknown':
    case 'malformed':
      // Dropped on purpose. See the header of `realtime-events.ts`: OpenAI
      // ships new event types without telling us, and a session that dies on
      // one is a feature outage we cannot ship a fix for.
      return none(state);
  }
}

// ─── Deadlines and budget ───────────────────────────────────────────────

/**
 * Everything time-driven, in one idempotent pass.
 *
 * Called after EVERY command, not only after ticks, so that a state change
 * which makes a deadline newly relevant — the tutor finishing its sentence
 * after the budget ran out — is acted on immediately rather than waiting for
 * the next tick.
 */
function checkDeadlines(state: TutorSessionState): Reduced {
  let s = state;
  const effects: TutorEffect[] = [];
  if (s.phase === 'idle' || s.phase === 'ended') return { state: s, effects };

  if (s.backgroundDeadline !== null && s.now >= s.backgroundDeadline) {
    return endSession(s, 'app_backgrounded', effects);
  }

  if (s.interruptSettleDeadline !== null && s.now >= s.interruptSettleDeadline) {
    s = leaveInterrupted(s);
  }

  if (
    s.connectDeadline !== null &&
    s.now >= s.connectDeadline &&
    (s.phase === 'connecting' || s.phase === 'reconnecting')
  ) {
    const r = reconnectOrEnd({ ...s, connectDeadline: null }, effects);
    if (r.state.phase === 'ended') return r;
    s = r.state;
    effects.length = 0;
    effects.push(...r.effects);
  }

  if (s.iceGraceDeadline !== null && s.now >= s.iceGraceDeadline) {
    const r = reconnectOrEnd({ ...s, iceGraceDeadline: null }, effects);
    if (r.state.phase === 'ended') return r;
    s = r.state;
    effects.length = 0;
    effects.push(...r.effects);
  }

  // ── Budget ladder ──────────────────────────────────────────────────
  // Nothing below applies before audio starts: dialling is not tutoring and
  // must not spend the grant.
  if (s.startedAt === null || s.phase === 'paused' || s.phase === 'reconnecting') {
    return { state: s, effects };
  }

  const remaining = remainingBudgetMs(s);
  const reason: TutorEndReason = limitingBound(s) === 'budget' ? 'budget_exhausted' : 'session_max';

  // 120s: a flag only. Interrupting the lesson to announce that the lesson is
  // nearly over is a worse use of the remaining two minutes than the lesson.
  if (!s.budgetWarned && remaining <= s.config.warningMs) {
    s = { ...s, budgetWarned: true };
  }

  // 60s: cue the tutor to land the conversation in its own words.
  if (!s.closingCueSent && remaining <= s.config.closingCueMs) {
    s = { ...s, closingCueSent: true, phase: 'ending' };
    // Deliberately NOT followed by `response.create`: forcing a response here
    // would talk over a learner who is mid-sentence. The cue sits in the
    // conversation and is picked up on the tutor's next turn, which is what
    // "wraps up naturally" means.
    effects.push({ kind: 'send', event: controlItemEvent(CLOSING_CUE) });
  }

  if (remaining <= 0) {
    if (!s.tutorAudioActive) return endSession(s, reason, effects);
    // A sentence already in flight gets to finish. The grace is bounded so a
    // runaway response cannot spend the grant indefinitely, but it exists
    // because cutting a teacher off mid-word is the exact failure
    // `lib/handsfree-budget.ts` was written to prevent.
    if (s.overrunDeadline === null) {
      const at = s.now + s.config.overrunGraceMs;
      const timer = withTimer(s, 'overrun', at);
      s = { ...timer.state, overrunDeadline: at };
      effects.push(timer.effect);
    } else if (s.now >= s.overrunDeadline) {
      return endSession(s, reason, effects);
    }
  }

  return { state: s, effects };
}

// ─── Commands ───────────────────────────────────────────────────────────

function handleCommand(state: TutorSessionState, command: TutorCommand): Reduced {
  const none = (s: TutorSessionState): Reduced => ({ state: s, effects: [] });

  switch (command.type) {
    case 'start': {
      if (state.phase !== 'idle') return none(state);
      return {
        state: {
          ...state,
          phase: 'preflight',
          sessionId: command.sessionId,
          model: command.model,
          grantedMs: command.grantedMs,
          correctionMode: command.correctionMode,
        },
        effects: [{ kind: 'acquire_mic' }],
      };
    }

    case 'mic_granted': {
      if (state.phase !== 'preflight' || state.sessionId === null) return none(state);
      const at = state.now + state.config.connectTimeoutMs;
      const timer = withTimer({ ...state, phase: 'connecting' }, 'connect', at);
      return {
        state: { ...timer.state, connectDeadline: at },
        effects: [
          { kind: 'connect', sessionId: state.sessionId, model: state.model, attempt: 1 },
          timer.effect,
        ],
      };
    }

    case 'mic_denied':
      return endSession(state, 'permission_denied');

    case 'consent_declined':
      return endSession(state, 'consent_declined');

    case 'transport_open':
      // Transport up is not the same as session ready; `session.created` is
      // what starts the clock. All this does is retire a degradation.
      return none({ ...state, iceGraceDeadline: null });

    case 'ice_state': {
      switch (command.state) {
        case 'connected':
          return none({ ...state, iceGraceDeadline: null });
        case 'disconnected': {
          // ICE `disconnected` self-heals often enough that reacting to it
          // immediately would cost far more sessions than it saved. Wait.
          if (!isLive(state) || state.iceGraceDeadline !== null) return none(state);
          const at = state.now + state.config.iceGraceMs;
          const timer = withTimer(state, 'ice_grace', at);
          return { state: { ...timer.state, iceGraceDeadline: at }, effects: [timer.effect] };
        }
        case 'failed':
          return reconnectOrEnd(state);
        case 'closed':
          // Closing during the wrap-up is not a network failure worth
          // reporting as one — the session had already reached its ceiling and
          // was on its way out. Report the ceiling that ended it.
          if (state.phase === 'ending') {
            return endSession(
              state,
              limitingBound(state) === 'budget' ? 'budget_exhausted' : 'session_max',
            );
          }
          return reconnectOrEnd(state);
      }
      break;
    }

    case 'data_channel_closed':
      if (!isLive(state) && state.phase !== 'connecting') return none(state);
      return reconnectOrEnd(state);

    case 'server_event':
      return handleServerEvent(state, command.event);

    case 'set_correction_mode': {
      if (command.mode === state.correctionMode) return none(state);
      const switched = { ...state, correctionMode: command.mode };
      // NO reconnect. The mode lives in the server-side instructions, and the
      // client only ever names it — a mid-call reconnect to change a setting
      // would cost another token and the whole conversation.
      if (!isLive(state)) return none(switched);
      const token = command.mode === 'live' ? MODE_CONTROL_LIVE : MODE_CONTROL_DEBRIEF;
      return { state: switched, effects: [{ kind: 'send', event: controlItemEvent(token) }] };
    }

    case 'os_interruption': {
      if (command.began) {
        if (!isLive(state)) return none({ ...state, osInterrupted: true });
        // PAUSE, do not tear down. Mute, drop whatever audio is queued so the
        // tutor does not resume mid-word after the call, and hold the peer
        // connection open — it carries the entire conversation.
        const held = hold({ ...state, osInterrupted: true, phase: 'paused', tutorAudioActive: false });
        return {
          state: held,
          effects: [
            { kind: 'set_mic_enabled', enabled: false },
            { kind: 'clear_output_buffer' },
          ],
        };
      }
      const cleared = { ...state, osInterrupted: false };
      if (cleared.phase !== 'paused') return none(cleared);
      return {
        state: release({ ...cleared, phase: 'listening' }),
        effects: [{ kind: 'set_mic_enabled', enabled: true }],
      };
    }

    case 'app_focus': {
      if (!command.foreground) {
        if (!isLive(state)) return none({ ...state, backgrounded: true });
        const at = state.now + state.config.backgroundGraceMs;
        const held = hold({ ...state, backgrounded: true, phase: 'paused', tutorAudioActive: false });
        const timer = withTimer(held, 'background', at);
        return {
          state: { ...timer.state, backgroundDeadline: at },
          effects: [
            { kind: 'set_mic_enabled', enabled: false },
            { kind: 'clear_output_buffer' },
            timer.effect,
          ],
        };
      }
      const back = { ...state, backgrounded: false, backgroundDeadline: null };
      // An OS interruption outranks focus: coming back to the app during a
      // phone call must not unmute into the call.
      if (back.phase !== 'paused' || back.osInterrupted) return none(back);
      return {
        state: release({ ...back, phase: 'listening' }),
        effects: [{ kind: 'set_mic_enabled', enabled: true }],
      };
    }

    case 'safety_stop':
      return endSession(state, 'safety');

    case 'server_ended':
      // The reason is passed straight through. This is the one command whose
      // end reason the caller supplies, because it is the one case where the
      // authority sits outside this reducer.
      return endSession(state, command.reason);

    case 'user_end':
      return endSession(state, 'user_ended');

    case 'tick':
    case 'timer_fired':
      // Both are pure clock advances. The token is never inspected — see the
      // header: deadlines in state are the source of truth, so a stale or
      // duplicated timer is harmless and a missing one is caught by the next
      // tick.
      return none(state);
  }

  return none(state);
}

// ─── Reducer ────────────────────────────────────────────────────────────

/**
 * Total function. Any command in any phase returns a valid state; unhandled
 * combinations are no-ops rather than throws, because a dropped data-channel
 * message must never crash a call the learner is in the middle of.
 */
export function tutorReduce(
  state: TutorSessionState,
  command: TutorCommand,
): TutorReduceResult {
  // A finished session is inert, forever. Data channel messages, ICE
  // callbacks and timers all arrive after teardown as a matter of routine;
  // none of them may produce an effect, least of all one that reopens the mic.
  if (state.phase === 'ended') return { state, effects: [] };

  // The clock only ever moves forwards. A host that hands back a stale
  // timestamp — two timers firing out of order, a JS clock adjustment — must
  // not be able to rewind elapsed time and hand out free minutes.
  const now = Math.max(state.now, command.now);
  const first = handleCommand({ ...state, now }, command);
  if (first.state.phase === 'ended') return first;

  const second = checkDeadlines(first.state);
  return { state: second.state, effects: [...first.effects, ...second.effects] };
}
