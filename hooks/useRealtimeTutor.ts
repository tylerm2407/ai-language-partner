import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Audio } from 'expo-av';
import { useAudioInterruptions } from './useAudioInterruptions';
import { enterTutorCallSession, releaseTutorCallSession } from '../lib/audio-session';
import { responseCreateEvent, type RealtimeServerEvent } from '../lib/realtime-events';
import {
  DEFAULT_CALLS_URL,
  createWebRtcTransport,
  mapTransportEvent,
  outputAudioBufferClearEvent,
  type RealtimeTransport,
  type TransportEvent,
} from '../lib/realtime-transport';
import {
  TUTOR_SESSION_DEFAULTS,
  createTutorSession,
  remainingBudgetMs,
  sessionLiveMs,
  tutorReduce,
  toSessionCorrectionMode,
  type StoredCorrectionMode,
  type TutorCommand,
  type TutorCorrectionMode,
  type TutorEffect,
  type TutorEndReason,
  type TutorPhase,
  type TutorSessionConfig,
  type TutorSessionState,
  type TutorTurnRecord,
} from '../lib/realtime-session';
import {
  applyLearnerDelta,
  applyTutorDelta,
  completeLearnerTurn,
  completeTutorTurn,
  emptyTranscript,
  truncateCurrentTutorTurn,
  type TranscriptState,
} from '../lib/tutor-transcript';
import { reportTutorTurn, type TutorTurnResult } from '../lib/tutor-api';
import {
  NO_PENDING_TURNS,
  TUTOR_SAFETY_RECOVERY_NOTICE,
  canReportTutorTurn,
  dropTutorTurns,
  hasPendingTurns,
  joinPendingText,
  tutorHeartbeatIntervalMs,
  tutorTurnOutcome,
  type PendingTutorTurns,
} from '../lib/tutor-heartbeat';

/**
 * The I/O host for a live speech-to-speech tutor call.
 *
 * Every DECISION in this feature was already made somewhere pure and tested:
 * `lib/realtime-session.ts` owns the state machine, `lib/realtime-events.ts`
 * owns the wire, `lib/tutor-transcript.ts` owns the transcript's ordering
 * rules, `lib/call-audio-route.ts` owns the output route. What is left here is
 * four things and nothing else:
 *
 *   1. draining the reducer's effects outbox onto real I/O,
 *   2. owning the timers the reducer asks for and cannot hold itself,
 *   3. the audio-session handoff, in the one order that works,
 *   4. accumulating the transcript from parsed server events,
 *   5. driving the heartbeat, which is the ONLY thing on this screen that
 *      talks to our own server while a call is live.
 *
 * Five is the one that looks like it does not belong, so: the heartbeat is not
 * billing plumbing. It is the safety pass, the transcript buffer that the
 * debrief and the SRS write-back are built from, and the liveness mark the
 * reaper settles against — all three on one call. `lib/tutor-heartbeat.ts`
 * opens with the full account. Every DECISION it makes lives there, pure and
 * tested; what is here is the timer, the buffer, and the I/O.
 *
 * If you are about to add an `if` to this file, check first whether it is a
 * decision. Decisions belong in `lib/realtime-session.ts`, where they can be
 * verified without a microphone. The same instruction is in the header of
 * `useHandsFreeSession.ts`, for the same reason, and it has held up.
 *
 * ── THE ORDER THAT IS LOAD-BEARING ──
 *
 * `enterTutorCallSession()` runs BEFORE anything opens the microphone.
 * `react-native-webrtc` configures the native audio session as part of
 * `getUserMedia` — AVAudioSession `playAndRecord` + `voiceChat`, which is what
 * routes the mic through VoiceProcessingIO and gets hardware echo
 * cancellation. That AEC is the entire reason barge-in works in a call and
 * does not work in chat. If expo-av is still holding a competing
 * configuration at that moment, two owners have raced over one device
 * resource and the call may already be running through the wrong route.
 *
 * `releaseTutorCallSession()` runs in a `finally`, AFTER the peer connection
 * is closed and every track is stopped. Releasing while a track is live hands
 * back a session WebRTC is still recording on; and leaving the session in
 * record mode routes the NEXT screen's playback to the earpiece. That is the
 * original bug documented in `lib/audio-session.ts`'s header, and it has now
 * been shipped three times in this app under three different hats.
 *
 * ── WHAT IS NOT VERIFIABLE HERE ──
 *
 * There is no component-render harness in this project, so nothing that needs
 * a render is checked. What HAS been pulled out and covered:
 * `mapTransportEvent` and `iceStateFrom` (`lib/realtime-transport.ts`), every
 * heartbeat decision (`lib/tutor-heartbeat.ts`), and
 * `applyServerEventToTranscript` (exported below, covered in
 * `useRealtimeTutor.test.ts`).
 *
 * What remains unverified until a device runs it: the audio-session ordering,
 * the mic permission prompt, AppState transitions, whether the tutor is
 * audible — and, new with the heartbeat, whether `setRemoteAudioEnabled(false)`
 * actually silences the tail of a cut turn within `SAFETY_CUT_MUTE_MS`. That
 * last one is a real-hardware question about jitter-buffer depth and cannot be
 * answered from a simulator.
 */

// ─── Options and return ─────────────────────────────────────────────────

/**
 * The credential half of a minted call.
 *
 * Structurally a subset of `StartTutorSessionResult` from `lib/tutor-api.ts`,
 * so the lobby's stashed handoff satisfies it as-is. Declared here rather than
 * imported so the SHAPE is this hook's own.
 *
 * The rule this used to enforce — no dependency on the API module at all — has
 * narrowed rather than gone: the hook now imports `reportTutorTurn`, because
 * the heartbeat has to live somewhere a timer and the transport both reach.
 * What it must never import is `startTutorSession`. Minting is what costs
 * money and is refusable, and a hook that could do it is a hook that can spend
 * a learner's allowance on a re-render. Reporting is the opposite: cheap,
 * idempotent, and dangerous only if it does NOT happen.
 */
export interface TutorCallSession {
  /** Our own session row id, for the debrief screen. */
  sessionId: string;
  /**
   * OpenAI ephemeral credential. Held only for the SDP exchange. It is never
   * logged, never persisted, and never interpolated into an error message —
   * see the header of `lib/tutor-api.ts`.
   */
  clientSecret: string;
  model: string;
  /** The SDP exchange endpoint the server named. */
  callsUrl: string;
  /**
   * MILLISECONDS reserved and charged up front; the unused part is refunded on
   * `end`. Already converted by the parser in `lib/tutor-api.ts` — seconds are
   * never passed upward, so nothing here multiplies by a thousand.
   */
  grantedMs: number;
  /**
   * The learner's own words for it. Converted to the reducer's vocabulary by
   * `toSessionCorrectionMode`, which is the ONLY place that conversion is
   * allowed to happen — see the note beside it in `lib/realtime-session.ts`.
   */
  correctionMode: StoredCorrectionMode;
  /**
   * How often the server wants to hear from us. It returns 20.
   *
   * Optional so a caller that predates the heartbeat still type-checks, and
   * because the fallback in `tutorHeartbeatIntervalMs` is the same 20 the
   * server names — the cadence is not a secret and getting it slightly wrong
   * is not a failure, whereas not heartbeating at all is three of them.
   *
   * It was excluded from this interface originally to keep the credential
   * surface minimal, which was the wrong instinct applied to the wrong field:
   * an integer nobody can spend is not part of that surface. `clientSecret`
   * is, and the rules for it are in the header of `lib/tutor-api.ts`.
   */
  heartbeatIntervalSeconds?: number;
}

export interface TutorCallSummary {
  sessionId: string | null;
  reason: TutorEndReason | null;
  /** Conversation time, excluding pauses and reconnects. */
  liveMs: number;
  turns: readonly TutorTurnRecord[];
}

export interface UseRealtimeTutorOptions {
  /** Overrides for the session ceilings. Defaults are `TUTOR_SESSION_DEFAULTS`. */
  config?: Partial<TutorSessionConfig>;
  /** Injectable transport. Production leaves this unset. */
  transport?: RealtimeTransport;
  onEnded?: (summary: TutorCallSummary) => void;
  /**
   * The reducer decided a debrief is worth showing. It is not always — a
   * declined consent or a call with no turns in it has nothing to debrief.
   * Optional because `app/(app)/tutor/call.tsx` routes on `phase === 'ended'`
   * itself, so that it can settle the money on EVERY terminal state.
   */
  onDebrief?: (sessionId: string) => void;
}

export interface UseRealtimeTutorReturn {
  state: TutorSessionState;
  phase: TutorPhase;
  transcript: TranscriptState;
  /** The learner's own mute. Distinct from the reducer's mic gating. */
  muted: boolean;
  /** The tutor's audio track has arrived and is playing. */
  remoteAudioReady: boolean;
  correctionMode: TutorCorrectionMode;
  remainingMs: number;
  liveMs: number;
  /** Under two minutes left. A banner, never an interruption. */
  budgetWarned: boolean;
  /**
   * A neutral line to show the learner, or null.
   *
   * Currently set by exactly one thing: a turn the safety check cut, which
   * vanishes out of the transcript and would otherwise look like the app
   * losing text. It is a STRING rather than a flag so the screen renders it
   * without knowing what a safety cut is — session control stays here, copy
   * stays in `lib/tutor-heartbeat.ts`, and the screen stays a screen.
   */
  notice: string | null;
  endReason: TutorEndReason | null;
  /** Preflight is under way. The dial itself shows as `phase`. */
  starting: boolean;
  error: string | null;
  start: (session: TutorCallSession) => Promise<void>;
  end: () => void;
  toggleMute: () => void;
  setCorrectionMode: (mode: StoredCorrectionMode) => void;
  sendText: (text: string) => void;
  /** Clear a finished call so the screen can offer another without remounting. */
  reset: () => void;
}

/**
 * How often the clock is advanced while a call is live.
 *
 * The budget ladder — the two-minute warning, the closing cue, the overrun
 * grace — is evaluated on `tick` and has no scheduled timer of its own, so
 * without this the reducer never learns the call is running out. One second is
 * also the resolution a countdown needs to not visibly stutter.
 */
const TICK_MS = 1_000;

/**
 * How long the tutor stays locally muted after a safety cut.
 *
 * `output_audio_buffer.clear` handles everything OpenAI has not sent yet,
 * which is most of a turn. This covers what is already on the wire and in the
 * jitter buffer — a few hundred milliseconds that will play regardless. 750ms
 * is comfortably past that on a bad connection, and short enough that the
 * tutor's NEXT turn is never clipped: nothing new can start speaking that
 * fast, because the response we just cancelled has to be acknowledged first.
 *
 * Bounded rather than left muted until the next turn, on purpose. A mute with
 * no scheduled release is one dropped event away from a call the learner
 * cannot hear at all, and a silent tutor is indistinguishable from a broken
 * app.
 */
const SAFETY_CUT_MUTE_MS = 750;

/** No cut turns yet. Hoisted so the default parameter is not a fresh Set per call. */
const NO_CUT_IDS: ReadonlySet<string> = new Set<string>();

// ─── Transcript accumulation ────────────────────────────────────────────

/**
 * Fold one parsed server event into the live transcript.
 *
 * `seqs` is a per-turn counter the CALLER owns, and it is why this is a
 * function rather than inline: `lib/tutor-transcript.ts` requires an ordinal
 * on every fragment and refuses to trust arrival order, but the realtime wire
 * carries no ordinal at all. On THIS transport arrival order is production
 * order — an SCTP data channel is ordered by default, so frames cannot
 * overtake each other between the server and here. The counter records that
 * fact rather than guessing at one. If the transport ever moves to something
 * unordered, this is the line that becomes wrong.
 *
 * `cutTurnIds` is the second thing the CALLER owns, and it is a seal rather
 * than a filter. Once a turn has been cut by the safety check it is gone from
 * the transcript — but the wire does not know that, and a late delta or the
 * `done` for that same response would quietly recreate it as a brand new turn
 * carrying the exact text we removed. Dropping those events here is the only
 * place that can be prevented, because `lib/tutor-transcript.ts` has no
 * concept of a turn that used to exist.
 *
 * Exported so the mapping is checkable without a renderer.
 */
export function applyServerEventToTranscript(
  transcript: TranscriptState,
  event: RealtimeServerEvent,
  seqs: Map<string, number>,
  cutTurnIds: ReadonlySet<string> = NO_CUT_IDS,
): TranscriptState {
  const nextSeq = (id: string): number => {
    const seq = seqs.get(id) ?? 0;
    seqs.set(id, seq + 1);
    return seq;
  };

  switch (event.kind) {
    case 'input_transcript_delta': {
      const id = event.itemId ?? '';
      return applyLearnerDelta(transcript, { id, seq: nextSeq(id), delta: event.delta });
    }
    case 'input_transcript_done': {
      const id = event.itemId ?? '';
      return completeLearnerTurn(transcript, { id, text: event.transcript });
    }
    case 'tutor_transcript_delta': {
      const id = event.itemId ?? event.responseId ?? '';
      if (cutTurnIds.has(id)) return transcript;
      return applyTutorDelta(transcript, { id, seq: nextSeq(id), delta: event.delta });
    }
    case 'tutor_transcript_done': {
      const id = event.itemId ?? event.responseId ?? '';
      if (cutTurnIds.has(id)) return transcript;
      return completeTutorTurn(transcript, { id, text: event.transcript });
    }
    default:
      // Everything else is session lifecycle, and the transcript has no
      // opinion about it.
      return transcript;
  }
}

/**
 * A message the learner TYPED.
 *
 * Deliberately not built by `lib/realtime-events.ts`. That module's client
 * union is the reducer's vocabulary — two events, both control-shaped, whose
 * item role is `system` precisely so a control cue can never be put in the
 * learner's mouth. This is the opposite case: really the learner's words, in
 * their own role, sent outside the reducer because the reducer has no command
 * for typing. Adding it to that closed union would widen the vocabulary the
 * reducer is allowed to emit, which is not what is wanted.
 */
function learnerTextItemEvent(text: string): unknown {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text }],
    },
  };
}

/**
 * Stop the response the model is currently generating.
 *
 * Not in `RealtimeClientEvent`, and for the same reason `learnerTextItemEvent`
 * above is not: that union is the REDUCER's vocabulary, and everything in it
 * is something the reducer is allowed to decide to send. A safety cut is not a
 * conversational decision — it is the server overruling the conversation — and
 * widening the union would hand the reducer a hang-up it has no business
 * having.
 *
 * Paired with `output_audio_buffer.clear`, never used alone. Cancelling stops
 * the model producing more; clearing discards what it already produced. Either
 * one on its own leaves the learner hearing most of the turn.
 */
function responseCancelEvent(): unknown {
  return { type: 'response.cancel' };
}

// ─── The hook ───────────────────────────────────────────────────────────

export function useRealtimeTutor(
  options: UseRealtimeTutorOptions = {},
): UseRealtimeTutorReturn {
  const config = useMemo<TutorSessionConfig>(
    () => ({ ...TUTOR_SESSION_DEFAULTS, ...options.config }),
    [options.config],
  );

  const [state, setState] = useState<TutorSessionState>(() =>
    createTutorSession(config, Date.now()),
  );
  const [transcript, setTranscript] = useState<TranscriptState>(emptyTranscript);
  const [muted, setMuted] = useState(false);
  const [remoteAudioReady, setRemoteAudioReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Mirrors for callbacks that must not close over a stale render — native
  // callbacks and timers both fire long after the render that created them.
  const stateRef = useRef(state);
  stateRef.current = state;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const transportRef = useRef<RealtimeTransport | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const seqsRef = useRef<Map<string, number>>(new Map());
  /** The last mic state the REDUCER asked for. See `toggleMute`. */
  const micWantedRef = useRef(false);
  /**
   * `onEnded` fires at most ONCE per session.
   *
   * Teardown is otherwise idempotent — a second `close()` finds no transport,
   * a second release finds the session already idle — but a callback is not,
   * and a double teardown is the normal case rather than the odd one: the
   * screen's own unmount cleanup and this hook's both run on a swipe-back.
   * A consumer that settles the server, or navigates, on `onEnded` would do it
   * twice.
   */
  const endNotifiedRef = useRef(false);
  const startingRef = useRef(false);
  const localTurnRef = useRef(0);
  /**
   * The SDP endpoint the SERVER named for this call, pinned when it started.
   * Not a constant: the edge function is the one thing that knows which
   * provider and API version the ephemeral credential was minted against, and
   * a client-side default that drifts from it produces a 401 nobody can read.
   */
  const callsUrlRef = useRef(DEFAULT_CALLS_URL);

  // ── Heartbeat bookkeeping ──────────────────────────────────────────────
  //
  // All refs, all deliberately. None of this belongs in React state: a
  // re-render per buffered fragment during a live WebRTC call is exactly the
  // kind of load this screen cannot afford, and none of it is rendered.

  /** The cadence the server asked for, pinned when the call started. */
  const heartbeatMsRef = useRef(tutorHeartbeatIntervalMs(undefined));
  /** The pending timer, kept apart from `timersRef` so it can be rescheduled. */
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * One report at a time.
   *
   * Not a nicety. `TUTOR_TURN_TIMEOUT_MS` is 12 seconds and the cadence is 20,
   * so on a bad network reports would otherwise stack — each one an edge
   * function invocation and an OpenAI moderation call, on a device already
   * carrying a live audio stream. Turns that arrive while one is in flight
   * wait in `pendingTurnsRef` and go out immediately afterwards; nothing is
   * dropped, because a dropped turn is an unmoderated one.
   */
  const heartbeatInFlightRef = useRef(false);
  const pendingTurnsRef = useRef<PendingTutorTurns>(NO_PENDING_TURNS);
  /** Turn ids the safety check refused. See `applyServerEventToTranscript`. */
  const cutTurnIdsRef = useRef<Set<string>>(new Set());
  /**
   * Which cut a pending unmute belongs to.
   *
   * Two cuts inside `SAFETY_CUT_MUTE_MS` would otherwise have the FIRST one's
   * restore timer fire during the second one's mute window and make the tutor
   * audible again mid-cut. Comparing generations makes a stale restore a no-op
   * — the same technique the transport uses for stale peer connections.
   */
  const cutGenerationRef = useRef(0);

  /**
   * Mutual recursion, broken with a ref: `dispatch` performs effects and
   * effects dispatch commands back. Assigned during render, exactly as
   * `stateRef` above is.
   */
  const performRef = useRef<(effect: TutorEffect) => void>(() => undefined);

  const dispatch = useCallback((command: TutorCommand) => {
    const { state: next, effects } = tutorReduce(stateRef.current, command);
    // The ref is updated FIRST. An effect performed below can dispatch again
    // synchronously, and it must see the state that produced it rather than
    // the one React has not re-rendered with yet.
    stateRef.current = next;
    setState(next);
    for (const effect of effects) performRef.current(effect);
  }, []);

  // ── Timers ─────────────────────────────────────────────────────────────

  const clearHeartbeatTimer = useCallback(() => {
    if (heartbeatTimerRef.current === null) return;
    clearTimeout(heartbeatTimerRef.current);
    heartbeatTimerRef.current = null;
  }, []);

  const clearAllTimers = useCallback(() => {
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current.clear();
    // Cleared with the rest, so teardown and `reset` do not each have to
    // remember it. A heartbeat that fires after `ended` gets a 409 from the
    // server — harmless, but it is a paid invocation asking a settled session
    // to settle again.
    clearHeartbeatTimer();
  }, [clearHeartbeatTimer]);

  /**
   * Honour one `schedule` effect.
   *
   * Timers are the host's job and the token is opaque to us as well as to the
   * reducer — we hand it straight back. Nothing is ever cancelled
   * individually: the reducer holds absolute deadlines in state, so a stale or
   * duplicated `timer_fired` reaches the same conclusion as the next `tick`.
   * That removes the entire "we cancelled the wrong timeout" bug class from a
   * code path nobody can watch happen.
   */
  const schedule = useCallback(
    (at: number, token: string) => {
      const timer = setTimeout(
        () => {
          timersRef.current.delete(timer);
          dispatch({ type: 'timer_fired', now: Date.now(), token });
        },
        Math.max(0, at - Date.now()),
      );
      timersRef.current.add(timer);
    },
    [dispatch],
  );

  // ── Teardown ───────────────────────────────────────────────────────────

  const teardown = useCallback(
    async (releaseAudio: boolean) => {
      clearAllTimers();
      const transport = transportRef.current;
      transportRef.current = null;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;

      try {
        // The peer connection and EVERY track first. See the header: releasing
        // the audio session while a track is still live hands expo-av back a
        // session WebRTC is recording on.
        await transport?.close();
      } catch (err) {
        console.warn('[tutor] transport close failed:', err);
      } finally {
        // `releaseAudio` is false when the OS is holding the session for a
        // phone call. Deactivating it under iOS in that state throws — the OS
        // owns the route until the interruption ends, so let it.
        if (releaseAudio) await releaseTutorCallSession();
      }

      if (endNotifiedRef.current) return;
      endNotifiedRef.current = true;
      const settled = stateRef.current;
      optionsRef.current.onEnded?.({
        sessionId: settled.sessionId,
        reason: settled.endReason,
        liveMs: sessionLiveMs(settled),
        turns: settled.turns,
      });
    },
    [clearAllTimers],
  );
  const teardownRef = useRef(teardown);
  teardownRef.current = teardown;

  // ── Heartbeat ──────────────────────────────────────────────────────────

  /**
   * Mutual recursion again, broken the same way: a report reschedules the
   * timer, and the timer sends a report. `sendHeartbeatRef` is also what lets
   * `handleTransportEvent` — defined below, and a dependency of everything —
   * trigger a report without the two of them declaring each other.
   */
  const sendHeartbeatRef = useRef<() => void>(() => undefined);

  /**
   * Remember a finished utterance, and — for the tutor — ask for it to be
   * reported now.
   *
   * TWO TRIGGERS, and the asymmetry between them is the whole design:
   *
   *   A COMPLETED TUTOR TURN reports IMMEDIATELY, because that text is what
   *   the safety check exists to look at and the learner is hearing it right
   *   now. Waiting up to 20 seconds for the timer would mean the moderation
   *   verdict arrives after the turn has finished playing, which is a verdict
   *   about nothing.
   *
   *   A COMPLETED LEARNER TURN does not. It is buffered and rides along on
   *   whichever report goes next. The learner's words are checked for the
   *   record and never to cut them off — see `turn.ts` — so there is nothing
   *   urgent to act on, and reporting on both halves of every exchange would
   *   double the invocation count for no safety gained.
   *
   * Empty transcripts are dropped rather than buffered: the realtime API emits
   * a `done` with empty text for an utterance its recogniser gave up on, and
   * an empty turn in the debrief buffer is a turn the analyser will try to
   * mine for vocabulary.
   */
  const bufferReportableTurn = useCallback((event: RealtimeServerEvent) => {
    if (event.kind === 'input_transcript_done') {
      const text = event.transcript.trim();
      if (!text) return;
      const pending = pendingTurnsRef.current;
      pendingTurnsRef.current = { ...pending, learner: [...pending.learner, text] };
      return;
    }
    if (event.kind !== 'tutor_transcript_done') return;

    // The tutor is talking again, so a "your last reply was skipped" line has
    // said what it had to say. Written as an updater that returns the same
    // value when there is nothing to clear, so React bails out rather than
    // re-rendering the call screen on every single turn.
    setNotice((current) => (current === null ? current : null));

    const id = event.itemId ?? event.responseId ?? '';
    const text = event.transcript.trim();
    if (text) {
      const pending = pendingTurnsRef.current;
      pendingTurnsRef.current = { ...pending, tutor: [...pending.tutor, { id, text }] };
    }
    // Fired even for an empty turn: it is still proof the session is alive,
    // and liveness is one of the three jobs.
    sendHeartbeatRef.current();
  }, []);

  // ── Transport ──────────────────────────────────────────────────────────

  const handleTransportEvent = useCallback(
    (event: TransportEvent) => {
      const now = Date.now();
      switch (event.kind) {
        case 'remote_track':
          // Nothing to mount. The native peer connection plays the tutor's
          // audio the moment the track arrives; this is UI news only.
          setRemoteAudioReady(true);
          break;
        case 'error':
          // Deliberately inert. A dead connection arrives as `closed`, and a
          // dial that never came up rejects out of `connect`.
          console.warn(`[tutor] transport ${event.stage}: ${event.message}`);
          break;
        case 'server_event':
          setTranscript((current) =>
            applyServerEventToTranscript(
              current,
              event.event,
              seqsRef.current,
              cutTurnIdsRef.current,
            ),
          );
          bufferReportableTurn(event.event);
          break;
        default:
          break;
      }
      const command = mapTransportEvent(event, now);
      if (command) dispatch(command);
    },
    [bufferReportableTurn, dispatch],
  );

  const ensureTransport = useCallback((): RealtimeTransport => {
    const existing = transportRef.current;
    if (existing) return existing;
    const transport = optionsRef.current.transport ?? createWebRtcTransport();
    unsubscribeRef.current = transport.on(handleTransportEvent);
    transportRef.current = transport;
    return transport;
  }, [handleTransportEvent]);

  // ── Effects ────────────────────────────────────────────────────────────

  const acquireMic = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone access is off. Turn it on in Settings to talk to your tutor.');
        dispatch({ type: 'mic_denied', now: Date.now() });
        return;
      }
      // BEFORE the dial, because the dial is what calls `getUserMedia` and
      // WebRTC configures the native session inside it. See the header.
      await enterTutorCallSession();
      dispatch({ type: 'mic_granted', now: Date.now() });
    } catch (err) {
      console.warn('[tutor] microphone preflight failed:', err);
      setError('Could not reach the microphone.');
      dispatch({ type: 'mic_denied', now: Date.now() });
    }
  }, [dispatch]);

  const dial = useCallback(
    async (clientSecret: string, model: string) => {
      try {
        await ensureTransport().connect({ clientSecret, model, callsUrl: callsUrlRef.current });
      } catch (err) {
        console.warn('[tutor] connect failed:', err);
        setError('Could not connect to your tutor.');
        // There is no `connect_failed` command, and there should not be: the
        // reducer models a dead TRANSPORT, not a dead dial, and
        // `data_channel_closed` is exactly that. In `connecting` it
        // reconnects-or-ends — which also means a hard failure does not sit
        // out the full connect deadline first.
        dispatch({ type: 'data_channel_closed', now: Date.now() });
      }
    },
    [dispatch, ensureTransport],
  );

  const perform = useCallback(
    (effect: TutorEffect) => {
      switch (effect.kind) {
        case 'acquire_mic':
          void acquireMic();
          return;
        case 'connect':
          void dial(effect.clientSecret, effect.model);
          return;
        case 'send':
          transportRef.current?.send(effect.event);
          return;
        case 'set_mic_enabled':
          micWantedRef.current = effect.enabled;
          // The learner's own mute masks the reducer's gating rather than
          // fighting it — see `toggleMute`.
          transportRef.current?.setMicEnabled(effect.enabled && !mutedRef.current);
          return;
        case 'clear_output_buffer':
          transportRef.current?.send(outputAudioBufferClearEvent());
          // Audio the learner will now never hear must not stay in the
          // transcript looking like audio they did. The reducer emits this
          // exactly once per tutor turn, which is exactly the truncation rate
          // `truncateCurrentTutorTurn` wants.
          setTranscript(truncateCurrentTutorTurn);
          return;
        case 'schedule':
          schedule(effect.at, effect.token);
          return;
        case 'teardown':
          void teardownRef.current(effect.releaseAudio);
          return;
        case 'navigate_debrief':
          optionsRef.current.onDebrief?.(effect.sessionId);
          return;
      }
    },
    [acquireMic, dial, schedule],
  );
  performRef.current = perform;

  // ── Heartbeat: acting on what came back ────────────────────────────────

  /**
   * Silence and scrub a turn the safety check refused.
   *
   * Order matters and it is the order below. The local mute goes first
   * because it is the only step that takes effect instantly — the two data
   * channel frames have to reach OpenAI before they do anything, and on the
   * network that just took 300ms to answer a heartbeat that is not free.
   *
   * Then the transcript. The learner did not hear this turn, so it must not
   * sit in their transcript looking like something they did — and it must not
   * reach the debrief either, which is why the server refuses to buffer a cut
   * turn (`turn.ts`) as well. Both halves are needed: the server owns what is
   * analysed, this owns what is read.
   */
  const cutTutorPlayback = useCallback((ids: ReadonlySet<string>) => {
    const transport = transportRef.current;
    transport?.setRemoteAudioEnabled(false);
    transport?.send(responseCancelEvent());
    transport?.send(outputAudioBufferClearEvent());

    for (const id of ids) cutTurnIdsRef.current.add(id);
    setTranscript((current) => dropTutorTurns(current, ids));

    const generation = ++cutGenerationRef.current;
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      // A later cut has taken over the mute; this restore is stale.
      if (cutGenerationRef.current !== generation) return;
      transportRef.current?.setRemoteAudioEnabled(true);
    }, SAFETY_CUT_MUTE_MS);
    timersRef.current.add(timer);
  }, []);

  /**
   * End the call because the SERVER said so.
   *
   * A straight handoff, and it is meant to stay one. `tutorTurnOutcome` has
   * already turned the server's `terminate` reason into a `TutorEndReason`,
   * and `server_ended` is the one command whose end reason the CALLER supplies
   * — because it is the one case where the authority sits outside the reducer.
   * The reasoning for that lives on the command in `lib/realtime-session.ts`;
   * the short version is that the server's clock and the reducer's disagree by
   * design, so its verdict wins.
   *
   * NOT a hard cut. `endSession` flushes the tutor turn in flight and tears
   * down in the normal order, which matters most on the budget path: by the
   * time the server says the grant is spent, the reducer's own ladder has
   * usually already sent the closing cue and moved to `ending`, so the learner
   * has been wrapped up rather than dropped mid-sentence.
   */
  const endForTurnResult = useCallback(
    (reason: TutorEndReason) => {
      dispatch({ type: 'server_ended', now: Date.now(), reason });
    },
    [dispatch],
  );

  const scheduleHeartbeat = useCallback(() => {
    clearHeartbeatTimer();
    heartbeatTimerRef.current = setTimeout(() => {
      heartbeatTimerRef.current = null;
      sendHeartbeatRef.current();
    }, heartbeatMsRef.current);
  }, [clearHeartbeatTimer]);

  /**
   * One heartbeat, start to finish.
   *
   * NOTHING IN HERE MAY TEAR DOWN A WORKING CALL. `reportTutorTurn` is
   * documented never to throw and returns a `degraded` result instead, which
   * `tutorTurnOutcome` reads as "do nothing"; the try/catch is belt-and-braces
   * against that contract being broken later, because an unhandled rejection
   * in a React effect during a WebRTC session is a crashed call. The reaper is
   * the backstop for everything a failed heartbeat did not record.
   */
  const sendHeartbeat = useCallback(async (): Promise<void> => {
    const before = stateRef.current;
    if (!canReportTutorTurn(before.phase, before.sessionId)) return;
    // A report is already out. Whatever has just been buffered goes with the
    // follow-up this one fires on the way out — see the drain at the bottom.
    if (heartbeatInFlightRef.current) return;

    // Taken, not copied. If the call fails, these turns are gone rather than
    // retried: the next heartbeat is 20 seconds away and re-sending stale text
    // would have the server moderate and buffer the same turn twice.
    const pending = pendingTurnsRef.current;
    pendingTurnsRef.current = NO_PENDING_TURNS;
    const tutorText = joinPendingText(pending.tutor.map((turn) => turn.text));
    const learnerText = joinPendingText(pending.learner);
    const batchIds = new Set(pending.tutor.map((turn) => turn.id));

    heartbeatInFlightRef.current = true;
    let result: TutorTurnResult | null = null;
    try {
      result = await reportTutorTurn({
        sessionId: before.sessionId ?? '',
        // Advisory only — the server bills from `started_at` and ignores this.
        // Sent anyway because a client clock that has drifted from the
        // server's is worth being able to see in the logs.
        elapsedSeconds: Math.round(sessionLiveMs(before) / 1000),
        ...(tutorText ? { tutorText } : {}),
        ...(learnerText ? { learnerText } : {}),
        // `recognizerConfidence` is deliberately absent. The realtime wire
        // does not carry one that `parseRealtimeEvent` exposes, and inventing
        // a number for a field the server stores would be worse than omitting
        // an optional field.
      });
    } catch (err) {
      console.warn('[tutor] heartbeat threw, which it is not supposed to:', err);
    } finally {
      heartbeatInFlightRef.current = false;
    }

    const outcome = result ? tutorTurnOutcome(result) : null;

    // The scrub happens whatever state the call is in now, including `ended`.
    // A cut turn must not survive into the debrief screen, which renders this
    // same transcript.
    if (outcome?.cutPlayback) cutTutorPlayback(batchIds);
    if (outcome?.showRecovery) setNotice(TUTOR_SAFETY_RECOVERY_NOTICE);

    // Re-checked rather than assumed: a call that ends while a heartbeat is in
    // flight is the normal case — the learner hangs up mid-round-trip — and
    // rescheduling or re-ending on a settled session is what earns a 409.
    const after = stateRef.current;
    if (!canReportTutorTurn(after.phase, after.sessionId)) return;

    if (outcome?.endReason) {
      endForTurnResult(outcome.endReason);
      return;
    }

    scheduleHeartbeat();
    // Turns that arrived while this was in flight. Sent now rather than in 20
    // seconds, because one of them may be a turn the learner is still hearing.
    if (hasPendingTurns(pendingTurnsRef.current)) sendHeartbeatRef.current();
  }, [cutTutorPlayback, endForTurnResult, scheduleHeartbeat]);

  // `void`, because every rejection path is already handled inside and a
  // floating promise here would be the one thing that could crash the call.
  sendHeartbeatRef.current = () => void sendHeartbeat();

  /**
   * The timer half.
   *
   * Keyed on `reportable` rather than on `active`: the clock above starts the
   * moment the learner taps call, and heartbeating through preflight and the
   * dial would tell the reaper a learner was talking to a tutor they had not
   * reached yet. `canReportTutorTurn` owns that judgement and says why.
   *
   * The interval is not a `setInterval`. Each report reschedules the next one
   * from its own completion, so a turn-triggered report also postpones the
   * timer — which is the point: the timer exists to cover a long learner
   * monologue with no tutor turn in it, not to add a second report beside one
   * that just went out.
   */
  const reportable = canReportTutorTurn(state.phase, state.sessionId);

  useEffect(() => {
    if (!reportable) return;
    scheduleHeartbeat();
    return clearHeartbeatTimer;
  }, [reportable, scheduleHeartbeat, clearHeartbeatTimer]);

  // ── Clock ──────────────────────────────────────────────────────────────

  const active = state.phase !== 'idle' && state.phase !== 'ended';

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), TICK_MS);
    return () => clearInterval(interval);
  }, [active, dispatch]);

  // ── Interruptions ──────────────────────────────────────────────────────

  useAudioInterruptions(active, {
    // A PAUSE, never a teardown. Reconnecting costs another ephemeral token
    // and the entire conversation so far — OpenAI has no session resume — to
    // recover from a phone call the learner declined in four seconds.
    onPause: () => dispatch({ type: 'os_interruption', now: Date.now(), began: true }),
    onResume: () => dispatch({ type: 'os_interruption', now: Date.now(), began: false }),
    // Ignored on purpose. NetInfo reports whether the DEVICE has a route, not
    // whether this peer connection survived; ICE reports the thing that
    // actually matters, and reacting to both means reacting twice.
    onNetworkChange: () => undefined,
  });

  useEffect(() => {
    if (!active) return;
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      // `inactive` is deliberately not mapped here: `useAudioInterruptions`
      // already debounces it, because iOS reports it for a notification
      // banner as well as for a real interruption.
      if (next === 'active') {
        dispatch({ type: 'app_focus', now: Date.now(), foreground: true });
      } else if (next === 'background') {
        dispatch({ type: 'app_focus', now: Date.now(), foreground: false });
      }
    });
    return () => subscription.remove();
  }, [active, dispatch]);

  // A hook that unmounts mid-call must not leave the microphone open and the
  // audio session in record mode. There is no dispatch here on purpose —
  // setting state during unmount is a no-op at best.
  useEffect(() => {
    return () => {
      // Guarded on having actually started. An unused hook unmounting must not
      // force the audio session to `idle` — that would stomp whatever mode the
      // screen underneath had set, which is the very bug `lib/audio-session.ts`
      // exists to prevent.
      if (stateRef.current.phase === 'idle') return;
      void teardownRef.current(!stateRef.current.osInterrupted);
    };
  }, []);

  // ── Commands ───────────────────────────────────────────────────────────

  const start = useCallback(
    async (session: TutorCallSession) => {
      // Guards I/O, not the state machine: the reducer already ignores `start`
      // unless it is idle, but the screen's mount effect fires on remount too
      // and a second dial would open a second microphone capture against a
      // credential that is already in use.
      if (startingRef.current || stateRef.current.phase !== 'idle') return;
      startingRef.current = true;
      setStarting(true);
      setError(null);
      try {
        callsUrlRef.current = session.callsUrl || DEFAULT_CALLS_URL;
        // Pinned here, not read on every heartbeat: the cadence belongs to the
        // session the server minted, and a mid-call change would mean the
        // reaper's staleness window and our reporting rate had silently
        // stopped agreeing.
        heartbeatMsRef.current = tutorHeartbeatIntervalMs(session.heartbeatIntervalSeconds);
        dispatch({
          type: 'start',
          now: Date.now(),
          sessionId: session.sessionId,
          clientSecret: session.clientSecret,
          model: session.model,
          grantedMs: Math.max(0, session.grantedMs),
          correctionMode: toSessionCorrectionMode(session.correctionMode),
        });
      } finally {
        startingRef.current = false;
        setStarting(false);
      }
      // Async by signature rather than by need: the mic prompt, the dial and
      // the SDP exchange are all effects the reducer drives from here, and a
      // caller that awaits this must not think the call is up when it returns.
      await Promise.resolve();
    },
    [dispatch],
  );

  const end = useCallback(() => {
    dispatch({ type: 'user_end', now: Date.now() });
  }, [dispatch]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    // Mute is the LEARNER's control and the reducer does not model it. It
    // masks the reducer's own mic gating rather than overriding it: unmuting
    // while the reducer wants the mic shut — during a reconnect, or an OS
    // interruption — must not open it.
    transportRef.current?.setMicEnabled(micWantedRef.current && !next);
  }, []);

  const setCorrectionMode = useCallback(
    (mode: StoredCorrectionMode) => {
      // No reconnect. The mode lives in the server-side instructions minted
      // with the token; the client only ever names it, so switching mid-call
      // costs one data-channel frame instead of another token and the whole
      // conversation.
      dispatch({
        type: 'set_correction_mode',
        now: Date.now(),
        mode: toSessionCorrectionMode(mode),
      });
    },
    [dispatch],
  );

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    const transport = transportRef.current;
    if (!transport) return;

    transport.send(learnerTextItemEvent(trimmed));
    // Typing is not speech, so the server's VAD will never trigger a reply on
    // its own. The response has to be asked for.
    transport.send(responseCreateEvent());

    // Added locally because a typed item comes back as `conversation.item.*`,
    // which this app does not parse — waiting for an echo would mean the
    // learner's own message never appearing.
    const id = `typed_${localTurnRef.current++}`;
    setTranscript((current) => completeLearnerTurn(current, { id, text: trimmed }));
  }, []);

  const reset = useCallback(() => {
    // `ended` is terminal by design — inertness after teardown is enforced in
    // exactly one place. A second call is therefore a NEW session, not a
    // resumed one, which is also honest: the tutor remembers nothing.
    clearAllTimers();
    seqsRef.current = new Map();
    micWantedRef.current = false;
    endNotifiedRef.current = false;
    // Everything the heartbeat accumulated belonged to the finished call.
    // Carrying a pending turn into a NEW session would report one call's words
    // against another call's session id, which the server would happily accept
    // and buffer into the wrong debrief.
    pendingTurnsRef.current = NO_PENDING_TURNS;
    cutTurnIdsRef.current = new Set();
    heartbeatInFlightRef.current = false;
    const fresh = createTutorSession(config, Date.now());
    stateRef.current = fresh;
    setState(fresh);
    setTranscript(emptyTranscript());
    setRemoteAudioReady(false);
    setError(null);
    setNotice(null);
  }, [clearAllTimers, config]);

  return {
    state,
    phase: state.phase,
    transcript,
    muted,
    remoteAudioReady,
    correctionMode: state.correctionMode,
    remainingMs: remainingBudgetMs(state),
    liveMs: sessionLiveMs(state),
    budgetWarned: state.budgetWarned,
    notice,
    endReason: state.endReason,
    starting,
    error,
    start,
    end,
    toggleMute,
    setCorrectionMode,
    sendText,
    reset,
  };
}
