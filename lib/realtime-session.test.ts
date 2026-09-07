/**
 * Unit tests for the live tutor session reducer.
 *
 * This file is the entire verification story for the feature right now:
 * `react-native-webrtc` is not installed, there is no microphone in CI, and
 * WebRTC audio happening to work once on a simulator would not tell us that
 * barge-in clears the output buffer exactly once, that a spent budget never
 * cuts a teacher off mid-word, or that a bad tunnel cannot hand out free
 * minutes. Those are decisions, they all live in the reducer, and they are
 * checked here.
 *
 * Server events are fed through the real `parseRealtimeEvent`, from raw wire
 * shapes, so the two modules are exercised together rather than against a
 * hand-written idea of what the wire looks like.
 */

import { parseRealtimeEvent } from './realtime-events';
import {
  TUTOR_SESSION_DEFAULTS,
  createTutorSession,
  isLive,
  limitingBound,
  remainingBudgetMs,
  sessionLiveMs,
  tutorReduce,
  type TutorCommand,
  type TutorEffect,
  type TutorEndReason,
  type TutorSessionConfig,
  type TutorSessionState,
  toSessionCorrectionMode,
  toStoredCorrectionMode,
} from './realtime-session';

const T0 = 1_000_000;
const GRANT = 600_000;

function config(overrides: Partial<TutorSessionConfig> = {}): TutorSessionConfig {
  return { ...TUTOR_SESSION_DEFAULTS, ...overrides };
}

interface Run {
  state: TutorSessionState;
  effects: TutorEffect[];
}

function apply(state: TutorSessionState, commands: TutorCommand[]): Run {
  let s = state;
  const effects: TutorEffect[] = [];
  for (const command of commands) {
    const result = tutorReduce(s, command);
    s = result.state;
    effects.push(...result.effects);
  }
  return { state: s, effects };
}

function step(run: Run, commands: TutorCommand[]): Run {
  return apply(run.state, commands);
}

/** A server event, built from the raw wire shape through the real parser. */
function wire(now: number, raw: unknown): TutorCommand {
  return { type: 'server_event', now, event: parseRealtimeEvent(raw) };
}

function of(effects: TutorEffect[], kind: TutorEffect['kind']): TutorEffect[] {
  return effects.filter((e) => e.kind === kind);
}

function sends(effects: TutorEffect[]): string[] {
  return effects.flatMap((e) =>
    e.kind === 'send' && e.event.type === 'conversation.item.create'
      ? [e.event.item.content[0].text]
      : [],
  );
}

/** Dial through to a live session with the tutor greeting. */
function boot(opts: { grantedMs?: number; cfg?: TutorSessionConfig; now?: number } = {}): Run {
  const now = opts.now ?? T0;
  return apply(createTutorSession(opts.cfg ?? config(), now), [
    {
      type: 'start',
      now,
      sessionId: 'sess-1',
      clientSecret: 'ek_secret',
      model: 'gpt-realtime',
      grantedMs: opts.grantedMs ?? GRANT,
      correctionMode: 'debrief',
    },
    { type: 'mic_granted', now },
    { type: 'transport_open', now },
    wire(now, { type: 'session.created', session: { id: 'oai_1', model: 'gpt-realtime' } }),
  ]);
}

/** The tutor starts a turn and says something. */
function tutorSpeaks(run: Run, now: number, id: string, text: string): Run {
  return step(run, [
    wire(now, { type: 'response.created', response: { id } }),
    wire(now, {
      type: 'response.output_audio_transcript.delta',
      response_id: id,
      item_id: `item_${id}`,
      delta: text,
    }),
  ]);
}

// ─── Preflight ──────────────────────────────────────────────────────────

describe('preflight', () => {
  it('asks for the microphone before dialling anything', () => {
    const run = apply(createTutorSession(config(), T0), [
      {
        type: 'start',
        now: T0,
        sessionId: 'sess-1',
        clientSecret: 'ek_secret',
        model: 'gpt-realtime',
        grantedMs: GRANT,
        correctionMode: 'live',
      },
    ]);
    expect(run.state.phase).toBe('preflight');
    expect(run.effects).toEqual([{ kind: 'acquire_mic' }]);
    // Nothing is dialled until permission exists: an ephemeral token spent on a
    // session the learner cannot speak into is money and a round trip wasted.
    expect(of(run.effects, 'connect')).toHaveLength(0);
    expect(run.state.startedAt).toBeNull();
  });

  it('ignores a second start', () => {
    const first = boot();
    const second = step(first, [
      {
        type: 'start',
        now: T0 + 10,
        sessionId: 'sess-2',
        clientSecret: 'other',
        model: 'gpt-realtime',
        grantedMs: 1,
        correctionMode: 'live',
      },
    ]);
    expect(second.state.sessionId).toBe('sess-1');
    expect(second.effects).toEqual([]);
  });

  it('dials once the microphone is granted', () => {
    const run = boot();
    const connects = of(run.effects, 'connect');
    expect(connects).toEqual([
      { kind: 'connect', clientSecret: 'ek_secret', model: 'gpt-realtime', attempt: 1 },
    ]);
    expect(of(run.effects, 'schedule').length).toBeGreaterThan(0);
  });

  it('greets once the session is created, and starts the clock there', () => {
    const run = boot();
    expect(run.state.phase).toBe('greeting');
    expect(run.state.realtimeSessionId).toBe('oai_1');
    expect(run.state.startedAt).toBe(T0);
    expect(run.effects).toContainEqual({ kind: 'set_mic_enabled', enabled: true });
    expect(run.effects).toContainEqual({ kind: 'send', event: { type: 'response.create' } });
    // Dialling is not tutoring, so it must not have spent any of the grant.
    expect(remainingBudgetMs(run.state)).toBe(GRANT);
  });

  it('gives up if the session never becomes ready', () => {
    const dialled = apply(createTutorSession(config({ maxReconnects: 0 }), T0), [
      {
        type: 'start',
        now: T0,
        sessionId: 'sess-1',
        clientSecret: 'ek_secret',
        model: 'gpt-realtime',
        grantedMs: GRANT,
        correctionMode: 'live',
      },
      { type: 'mic_granted', now: T0 },
    ]);
    const timedOut = step(dialled, [{ type: 'tick', now: T0 + 15_001 }]);
    expect(timedOut.state.phase).toBe('ended');
    expect(timedOut.state.endReason).toBe('network_lost');
  });
});

// ─── Turn taking ────────────────────────────────────────────────────────

describe('turn taking', () => {
  it('moves to tutor_speaking on the first transcript delta and back on response.done', () => {
    const speaking = tutorSpeaks(boot(), T0 + 500, 'resp_1', 'Hola, ¿qué tal?');
    expect(speaking.state.phase).toBe('tutor_speaking');
    expect(speaking.state.tutorAudioActive).toBe(true);

    const done = step(speaking, [
      wire(T0 + 3_000, { type: 'response.done', response: { id: 'resp_1', status: 'completed' } }),
    ]);
    expect(done.state.phase).toBe('listening');
    expect(done.state.turns).toEqual([
      { role: 'tutor', id: 'resp_1', text: 'Hola, ¿qué tal?', truncated: false, at: T0 + 3_000 },
    ]);
  });

  it('prefers the output audio buffer signal once the server proves it sends one', () => {
    // The transcript is generated faster than realtime, so response.done fires
    // while audio is still draining. When the WebRTC-only buffer events show
    // up they are the truthful end-of-audio signal and take over.
    let run = tutorSpeaks(boot(), T0 + 500, 'resp_1', 'Bueno...');
    run = step(run, [wire(T0 + 600, { type: 'output_audio_buffer.started', response_id: 'resp_1' })]);
    expect(run.state.audioBufferSignalSeen).toBe(true);

    run = step(run, [
      wire(T0 + 2_000, { type: 'response.done', response: { id: 'resp_1', status: 'completed' } }),
    ]);
    expect(run.state.tutorAudioActive).toBe(true);
    expect(run.state.phase).toBe('tutor_speaking');

    run = step(run, [
      wire(T0 + 4_000, { type: 'output_audio_buffer.stopped', response_id: 'resp_1' }),
    ]);
    expect(run.state.tutorAudioActive).toBe(false);
    expect(run.state.phase).toBe('listening');
  });

  it('records the learner from the completed transcript, not the deltas', () => {
    let run = step(boot(), [
      wire(T0 + 1_000, { type: 'response.done', response: { id: 'r0', status: 'completed' } }),
    ]);
    run = step(run, [
      wire(T0 + 2_000, {
        type: 'conversation.item.input_audio_transcription.delta',
        item_id: 'item_1',
        delta: 'me llamo',
      }),
      wire(T0 + 2_500, {
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'item_1',
        transcript: 'Me llamo Ana.',
      }),
    ]);
    expect(run.state.turns).toEqual([
      { role: 'learner', id: 'item_1', text: 'Me llamo Ana.', truncated: false, at: T0 + 2_500 },
    ]);
    expect(run.state.pendingLearner).toEqual([]);
  });

  it('drops a failed transcription instead of recording an empty learner turn', () => {
    // An empty turn reads downstream as "the learner said nothing", which is a
    // false claim about someone who may have spoken for ten seconds.
    const run = step(boot(), [
      wire(T0 + 1_000, {
        type: 'conversation.item.input_audio_transcription.delta',
        item_id: 'item_1',
        delta: 'mmm',
      }),
      wire(T0 + 1_500, {
        type: 'conversation.item.input_audio_transcription.failed',
        item_id: 'item_1',
        error: { message: 'audio too short' },
      }),
    ]);
    expect(run.state.turns).toEqual([]);
    expect(run.state.pendingLearner).toEqual([]);
  });
});

// ─── Barge-in ───────────────────────────────────────────────────────────

describe('barge-in', () => {
  function interrupted(): Run {
    const speaking = tutorSpeaks(boot(), T0 + 500, 'resp_1', 'La paella es un plato');
    return step(speaking, [
      wire(T0 + 1_000, { type: 'input_audio_buffer.speech_started', item_id: 'item_1' }),
    ]);
  }

  it('enters the interrupted phase and clears the output buffer', () => {
    const run = interrupted();
    expect(run.state.phase).toBe('interrupted');
    expect(of(run.effects, 'clear_output_buffer')).toHaveLength(1);
  });

  it('never mutes the learner to do it', () => {
    // The open mic during playback is the entire reason WebRTC was chosen over
    // the record-then-send cascade. Muting here would give back the cascade.
    const run = interrupted();
    const mutes = of(run.effects, 'set_mic_enabled').filter(
      (e) => e.kind === 'set_mic_enabled' && !e.enabled,
    );
    expect(mutes).toEqual([]);
  });

  it('clears the buffer EXACTLY ONCE however many times the VAD fires', () => {
    let run = interrupted();
    const before = of(run.effects, 'clear_output_buffer').length;
    run = step(run, [
      wire(T0 + 1_100, { type: 'input_audio_buffer.speech_started', item_id: 'item_1' }),
      wire(T0 + 1_200, { type: 'input_audio_buffer.speech_started', item_id: 'item_1' }),
    ]);
    expect(of(run.effects, 'clear_output_buffer')).toHaveLength(0);
    expect(before).toBe(1);
  });

  it('clears again for the NEXT tutor turn', () => {
    let run = interrupted();
    run = step(run, [
      wire(T0 + 2_000, { type: 'response.done', response: { id: 'resp_1', status: 'completed' } }),
    ]);
    run = tutorSpeaks(run, T0 + 3_000, 'resp_2', 'Perdona, sigue tú.');
    run = step(run, [
      wire(T0 + 3_500, { type: 'input_audio_buffer.speech_started', item_id: 'item_2' }),
    ]);
    expect(of(run.effects, 'clear_output_buffer')).toHaveLength(1);
  });

  it('marks the truncated turn so it is not counted as heard', () => {
    let run = interrupted();
    run = step(run, [
      wire(T0 + 2_000, { type: 'response.done', response: { id: 'resp_1', status: 'completed' } }),
    ]);
    expect(run.state.turns).toEqual([
      {
        role: 'tutor',
        id: 'resp_1',
        text: 'La paella es un plato',
        truncated: true,
        at: T0 + 2_000,
      },
    ]);
  });

  it.each([
    [
      'the learner stops speaking',
      (now: number) => wire(now, { type: 'input_audio_buffer.speech_stopped', item_id: 'item_1' }),
    ],
    [
      'the server confirms the buffer is cleared',
      (now: number) => wire(now, { type: 'output_audio_buffer.cleared', response_id: 'resp_1' }),
    ],
    [
      'the cancelled response completes',
      (now: number) =>
        wire(now, { type: 'response.done', response: { id: 'resp_1', status: 'completed' } }),
    ],
    ['the settle timer fires', (now: number): TutorCommand => ({ type: 'tick', now })],
  ])('leaves interrupted when %s', (_label, make) => {
    const run = step(interrupted(), [make(T0 + 1_400)]);
    expect(run.state.phase).toBe('listening');
    expect(run.state.interruptSettleDeadline).toBeNull();
  });

  it('does not wedge in interrupted when nothing confirms the clear', () => {
    // Several redundant exits exist precisely because the confirming event may
    // not be emitted at all on some paths; the settle deadline is the backstop.
    const run = step(interrupted(), [{ type: 'tick', now: T0 + 60_000 }]);
    expect(run.state.phase).toBe('listening');
  });
});

// ─── Budget ─────────────────────────────────────────────────────────────

describe('budget', () => {
  it('raises a warning flag at 120s without interrupting anything', () => {
    const run = step(boot(), [{ type: 'tick', now: T0 + (GRANT - 120_000) }]);
    expect(run.state.budgetWarned).toBe(true);
    expect(run.effects).toEqual([]);
    expect(isLive(run.state)).toBe(true);
  });

  it('cues the tutor to wrap up at 60s, once, and does not force a response', () => {
    let run = step(boot(), [{ type: 'tick', now: T0 + (GRANT - 60_000) }]);
    expect(run.state.phase).toBe('ending');
    expect(sends(run.effects)).toEqual(['CUE:WRAP_UP']);
    // Forcing a response.create here would talk over a learner who is
    // mid-sentence — the opposite of wrapping up naturally.
    expect(
      run.effects.filter((e) => e.kind === 'send' && e.event.type === 'response.create'),
    ).toEqual([]);

    run = step(run, [
      { type: 'tick', now: T0 + (GRANT - 50_000) },
      { type: 'tick', now: T0 + (GRANT - 40_000) },
    ]);
    expect(sends(run.effects)).toEqual([]);
  });

  it('ends when the grant is spent and the tutor is silent', () => {
    let run = tutorSpeaks(boot(), T0 + 1_000, 'resp_1', 'Vale.');
    run = step(run, [
      wire(T0 + 2_000, { type: 'response.done', response: { id: 'resp_1', status: 'completed' } }),
      { type: 'tick', now: T0 + GRANT },
    ]);
    expect(run.state.phase).toBe('ended');
    expect(run.state.endReason).toBe('budget_exhausted');
    expect(of(run.effects, 'teardown')).toEqual([{ kind: 'teardown', releaseAudio: true }]);
  });

  it('NEVER hard-cuts the tutor mid-sentence', () => {
    let run = step(boot(), [{ type: 'tick', now: T0 + (GRANT - 60_000) }]);
    run = tutorSpeaks(run, T0 + (GRANT - 5_000), 'resp_9', 'Entonces, para resumir');

    run = step(run, [{ type: 'tick', now: T0 + GRANT }]);
    expect(run.state.phase).toBe('ending');
    expect(of(run.effects, 'teardown')).toEqual([]);
    expect(of(run.effects, 'schedule')).toHaveLength(1);

    // It ends the moment the sentence lands, not a moment before.
    run = step(run, [
      wire(T0 + GRANT + 4_000, {
        type: 'response.done',
        response: { id: 'resp_9', status: 'completed' },
      }),
    ]);
    expect(run.state.phase).toBe('ended');
    expect(run.state.endReason).toBe('budget_exhausted');
    expect(run.state.turns.at(-1)).toMatchObject({ truncated: false, text: 'Entonces, para resumir' });
  });

  it('bounds the overrun so a runaway response cannot spend the grant forever', () => {
    let run = step(boot(), [{ type: 'tick', now: T0 + (GRANT - 60_000) }]);
    run = tutorSpeaks(run, T0 + (GRANT - 5_000), 'resp_9', 'Y entonces, y entonces, y entonces');
    run = step(run, [{ type: 'tick', now: T0 + GRANT }]);
    run = step(run, [{ type: 'tick', now: T0 + GRANT + TUTOR_SESSION_DEFAULTS.overrunGraceMs }]);
    expect(run.state.phase).toBe('ended');
    expect(run.state.endReason).toBe('budget_exhausted');
    // What was being said when the call ended is kept, but flagged unheard.
    expect(run.state.turns.at(-1)).toMatchObject({ truncated: true });
  });

  it('reports the wall clock, not the grant, when that is what bit', () => {
    const cfg = config({ maxSessionMs: 60_000 });
    const run = step(boot({ cfg, grantedMs: GRANT }), [{ type: 'tick', now: T0 + 60_000 }]);
    expect(limitingBound(run.state)).toBe('session');
    expect(run.state.endReason).toBe('session_max');
  });
});

// ─── Reconnect ──────────────────────────────────────────────────────────

describe('reconnect', () => {
  it('waits out a transient ICE disconnect instead of reacting to it', () => {
    // Disconnected self-heals often enough that reacting immediately would
    // cost far more sessions than it saved.
    const run = step(boot(), [{ type: 'ice_state', now: T0 + 10_000, state: 'disconnected' }]);
    expect(run.state.phase).toBe('greeting');
    expect(of(run.effects, 'connect')).toEqual([]);
    expect(of(run.effects, 'schedule')).toHaveLength(1);

    const healed = step(run, [
      { type: 'ice_state', now: T0 + 12_000, state: 'connected' },
      { type: 'tick', now: T0 + 30_000 },
    ]);
    expect(healed.state.phase).toBe('greeting');
    expect(of(healed.effects, 'connect')).toEqual([]);
  });

  it('reconnects silently once the grace expires, preserving elapsed time', () => {
    let run = step(boot(), [{ type: 'ice_state', now: T0 + 100_000, state: 'disconnected' }]);
    run = step(run, [{ type: 'tick', now: T0 + 104_000 }]);
    expect(run.state.phase).toBe('reconnecting');
    expect(of(run.effects, 'connect')).toEqual([
      { kind: 'connect', clientSecret: 'ek_secret', model: 'gpt-realtime', attempt: 2 },
    ]);
    expect(run.effects).toContainEqual({ kind: 'set_mic_enabled', enabled: false });

    // The clock is frozen while nobody is being tutored...
    const stalled = step(run, [{ type: 'tick', now: T0 + 108_000 }]);
    expect(sessionLiveMs(stalled.state)).toBe(104_000);

    const back = step(stalled, [
      wire(T0 + 110_000, { type: 'session.created', session: { id: 'oai_2' } }),
    ]);
    expect(back.state.phase).toBe('listening');
    // ...and it is NOT reset. A bad tunnel does not buy free minutes, and the
    // grant is what is actually being spent.
    expect(remainingBudgetMs(back.state)).toBe(GRANT - 104_000);
    expect(back.effects).toContainEqual({ kind: 'set_mic_enabled', enabled: true });
  });

  it('does not re-greet after a reconnect', () => {
    // A second "hello, what shall we talk about?" mid-conversation announces
    // the amnesia rather than hiding it.
    let run = step(boot(), [{ type: 'ice_state', now: T0 + 100_000, state: 'failed' }]);
    run = step(run, [wire(T0 + 102_000, { type: 'session.created', session: { id: 'oai_2' } })]);
    expect(run.state.phase).toBe('listening');
    expect(
      run.effects.filter((e) => e.kind === 'send' && e.event.type === 'response.create'),
    ).toEqual([]);
  });

  it('reconnects at most ONCE', () => {
    // OpenAI has no session resume, so a second attempt just produces a tutor
    // with amnesia twice.
    let run = step(boot(), [{ type: 'ice_state', now: T0 + 100_000, state: 'failed' }]);
    run = step(run, [wire(T0 + 101_000, { type: 'session.created', session: { id: 'oai_2' } })]);
    run = step(run, [{ type: 'ice_state', now: T0 + 200_000, state: 'failed' }]);
    expect(run.state.phase).toBe('ended');
    expect(run.state.endReason).toBe('network_lost');
    expect(of(run.effects, 'connect')).toEqual([]);
  });

  it('gives the one attempt a hard 8s budget', () => {
    let run = step(boot(), [{ type: 'ice_state', now: T0 + 100_000, state: 'failed' }]);
    run = step(run, [{ type: 'tick', now: T0 + 107_999 }]);
    expect(run.state.phase).toBe('reconnecting');
    run = step(run, [{ type: 'tick', now: T0 + 108_001 }]);
    expect(run.state.endReason).toBe('network_lost');
  });

  it('treats a closed data channel as a lost link', () => {
    const run = step(boot(), [{ type: 'data_channel_closed', now: T0 + 5_000 }]);
    expect(run.state.phase).toBe('reconnecting');
    expect(of(run.effects, 'connect')).toHaveLength(1);
  });

  it('does not report a link that closed during the wrap-up as a network failure', () => {
    let run = step(boot(), [{ type: 'tick', now: T0 + (GRANT - 60_000) }]);
    run = step(run, [{ type: 'ice_state', now: T0 + (GRANT - 55_000), state: 'closed' }]);
    expect(run.state.endReason).toBe('budget_exhausted');
  });
});

// ─── Pause ──────────────────────────────────────────────────────────────

describe('pause', () => {
  it('pauses on a phone call rather than tearing the session down', () => {
    // Reconnecting would cost another ephemeral token and the entire
    // conversation, to recover from a call declined in four seconds.
    const run = step(boot(), [{ type: 'os_interruption', now: T0 + 30_000, began: true }]);
    expect(run.state.phase).toBe('paused');
    expect(of(run.effects, 'teardown')).toEqual([]);
    expect(run.effects).toContainEqual({ kind: 'set_mic_enabled', enabled: false });
    expect(of(run.effects, 'clear_output_buffer')).toHaveLength(1);
  });

  it('does not charge the learner for the call', () => {
    let run = step(boot(), [{ type: 'os_interruption', now: T0 + 30_000, began: true }]);
    run = step(run, [{ type: 'tick', now: T0 + 200_000 }]);
    expect(remainingBudgetMs(run.state)).toBe(GRANT - 30_000);

    run = step(run, [{ type: 'os_interruption', now: T0 + 240_000, began: false }]);
    expect(run.state.phase).toBe('listening');
    expect(remainingBudgetMs(run.state)).toBe(GRANT - 30_000);
    expect(run.effects).toContainEqual({ kind: 'set_mic_enabled', enabled: true });
  });

  it('leaves the audio route alone when the OS still holds it', () => {
    // Deactivating the audio session during an iOS interruption throws.
    let run = step(boot(), [{ type: 'os_interruption', now: T0 + 10_000, began: true }]);
    run = step(run, [{ type: 'user_end', now: T0 + 11_000 }]);
    expect(of(run.effects, 'teardown')).toEqual([{ kind: 'teardown', releaseAudio: false }]);
  });

  it('pauses on backgrounding and resumes on return', () => {
    let run = step(boot(), [{ type: 'app_focus', now: T0 + 20_000, foreground: false }]);
    expect(run.state.phase).toBe('paused');
    run = step(run, [{ type: 'app_focus', now: T0 + 40_000, foreground: true }]);
    expect(run.state.phase).toBe('listening');
    expect(run.state.endReason).toBeNull();
  });

  it('ends a backgrounded session that never comes back', () => {
    let run = step(boot(), [{ type: 'app_focus', now: T0 + 20_000, foreground: false }]);
    run = step(run, [
      { type: 'tick', now: T0 + 20_000 + TUTOR_SESSION_DEFAULTS.backgroundGraceMs },
    ]);
    expect(run.state.endReason).toBe('app_backgrounded');
  });

  it('does not unmute into a phone call when the app comes back', () => {
    let run = step(boot(), [
      { type: 'os_interruption', now: T0 + 10_000, began: true },
      { type: 'app_focus', now: T0 + 10_100, foreground: false },
    ]);
    run = step(run, [{ type: 'app_focus', now: T0 + 15_000, foreground: true }]);
    expect(run.state.phase).toBe('paused');
    expect(
      of(run.effects, 'set_mic_enabled').filter((e) => e.kind === 'set_mic_enabled' && e.enabled),
    ).toEqual([]);
  });
});

// ─── Correction mode ────────────────────────────────────────────────────

describe('correction mode', () => {
  it('switches mid-call with an opaque token and no reconnect', () => {
    const run = step(boot(), [{ type: 'set_correction_mode', now: T0 + 5_000, mode: 'live' }]);
    expect(run.state.correctionMode).toBe('live');
    expect(sends(run.effects)).toEqual(['MODE:LIVE']);
    expect(of(run.effects, 'connect')).toEqual([]);
    expect(of(run.effects, 'teardown')).toEqual([]);
  });

  it('never puts prompt text on the wire', () => {
    // Anything the client can send, a reader of the bundle can rewrite — and a
    // rewritten system prompt is a jailbroken tutor talking to a student.
    const run = step(boot(), [{ type: 'set_correction_mode', now: T0 + 5_000, mode: 'live' }]);
    const payload = JSON.stringify(of(run.effects, 'send'));
    expect(payload).not.toMatch(/you are|tutor|correct the/i);
    expect(payload.length).toBeLessThan(200);
  });

  it('does nothing when the mode is unchanged', () => {
    const run = step(boot(), [{ type: 'set_correction_mode', now: T0 + 5_000, mode: 'debrief' }]);
    expect(run.effects).toEqual([]);
  });

  it('records a switch made before the call is live without sending anything', () => {
    const run = apply(createTutorSession(config(), T0), [
      {
        type: 'start',
        now: T0,
        sessionId: 'sess-1',
        clientSecret: 'ek',
        model: 'gpt-realtime',
        grantedMs: GRANT,
        correctionMode: 'debrief',
      },
      { type: 'set_correction_mode', now: T0 + 1, mode: 'live' },
    ]);
    expect(run.state.correctionMode).toBe('live');
    expect(of(run.effects, 'send')).toEqual([]);
  });
});

// ─── Errors ─────────────────────────────────────────────────────────────

describe('server errors', () => {
  const errorEvent = (now: number, code: string): TutorCommand =>
    wire(now, { type: 'error', error: { type: 'invalid_request_error', code, message: code } });

  it('shrugs off a complaint about one client event', () => {
    // The vast majority of error frames are exactly this. Ending a lesson over
    // one is far worse than ignoring it.
    const run = step(boot(), [errorEvent(T0 + 1_000, 'invalid_value')]);
    expect(run.state.phase).toBe('greeting');
    expect(run.state.errorCount).toBe(1);
  });

  it('gives up once the stream of them says the session is wedged', () => {
    let run = boot();
    for (let i = 0; i < TUTOR_SESSION_DEFAULTS.maxTransientErrors; i++) {
      run = step(run, [errorEvent(T0 + 1_000 + i, 'invalid_value')]);
    }
    expect(run.state.endReason).toBe('server_error');
  });

  it('ends immediately on an error that means the session is gone', () => {
    const run = step(boot(), [errorEvent(T0 + 1_000, 'session_expired')]);
    expect(run.state.endReason).toBe('server_error');
  });

  it('ends with safety when the server refuses on policy grounds', () => {
    const run = step(boot(), [errorEvent(T0 + 1_000, 'content_policy_violation')]);
    expect(run.state.endReason).toBe('safety');
  });
});

// ─── Robustness ─────────────────────────────────────────────────────────

describe('robustness', () => {
  it('ignores events it has never heard of, rather than dying on them', () => {
    const base = boot();
    const run = step(base, [
      wire(T0 + 1_000, { type: 'response.mcp_call_arguments.delta', delta: '{' }),
      wire(T0 + 1_001, '{"type":"response.done"'),
      wire(T0 + 1_002, { nope: true }),
      wire(T0 + 1_003, 'conversation.item.created'),
    ]);
    expect(run.state.phase).toBe(base.state.phase);
    expect(run.effects).toEqual([]);
  });

  it('is inert once ended: no state change and no effects, ever', () => {
    // Data channel messages, ICE callbacks and timers all arrive after
    // teardown as a matter of routine. None may reopen the microphone.
    const ended = step(boot(), [{ type: 'user_end', now: T0 + 5_000 }]).state;
    const late: TutorCommand[] = [
      wire(T0 + 6_000, { type: 'input_audio_buffer.speech_started', item_id: 'x' }),
      wire(T0 + 6_100, { type: 'response.created', response: { id: 'resp_z' } }),
      wire(T0 + 6_200, { type: 'session.created', session: { id: 'oai_z' } }),
      { type: 'tick', now: T0 + 999_999 },
      { type: 'timer_fired', now: T0 + 999_999, token: 'overrun:3' },
      { type: 'ice_state', now: T0 + 7_000, state: 'failed' },
      { type: 'os_interruption', now: T0 + 7_100, began: false },
      { type: 'app_focus', now: T0 + 7_200, foreground: true },
      { type: 'set_correction_mode', now: T0 + 7_300, mode: 'live' },
      { type: 'user_end', now: T0 + 7_400 },
    ];
    for (const command of late) {
      const result = tutorReduce(ended, command);
      expect(result.state).toBe(ended);
      expect(result.effects).toEqual([]);
    }
  });

  it('does not let a stale timestamp rewind the clock and hand out free minutes', () => {
    const run = step(boot(), [
      { type: 'tick', now: T0 + 300_000 },
      { type: 'tick', now: T0 + 10_000 },
    ]);
    expect(sessionLiveMs(run.state)).toBe(300_000);
  });

  it('ignores the timer token entirely — deadlines are the source of truth', () => {
    // A stale, duplicated or invented token must be as harmless as a tick.
    const viaToken = step(boot(), [
      { type: 'timer_fired', now: T0 + (GRANT - 60_000), token: 'nonsense:999' },
    ]);
    const viaTick = step(boot(), [{ type: 'tick', now: T0 + (GRANT - 60_000) }]);
    expect(viaToken.effects).toEqual(viaTick.effects);
    expect(viaToken.state.phase).toBe(viaTick.state.phase);
  });

  it('sends the learner to a debrief only when there is something to debrief', () => {
    const empty = step(boot(), [{ type: 'user_end', now: T0 + 2_000 }]);
    expect(of(empty.effects, 'navigate_debrief')).toEqual([]);

    let talked = tutorSpeaks(boot(), T0 + 1_000, 'resp_1', 'Hola.');
    talked = step(talked, [
      wire(T0 + 2_000, { type: 'response.done', response: { id: 'resp_1', status: 'completed' } }),
      { type: 'user_end', now: T0 + 3_000 },
    ]);
    expect(of(talked.effects, 'navigate_debrief')).toEqual([
      { kind: 'navigate_debrief', sessionId: 'sess-1' },
    ]);
  });
});

// ─── Every end reason ───────────────────────────────────────────────────

describe('end reasons', () => {
  /**
   * Keyed by the union, so adding a reason without a way to reach it — the
   * failure mode where a state is declared and then quietly unreachable —
   * fails to compile rather than silently passing.
   */
  const REACH: Record<TutorEndReason, () => Run> = {
    user_ended: () => step(boot(), [{ type: 'user_end', now: T0 + 1_000 }]),
    budget_exhausted: () => step(boot(), [{ type: 'tick', now: T0 + GRANT }]),
    session_max: () =>
      step(boot({ cfg: config({ maxSessionMs: 30_000 }) }), [{ type: 'tick', now: T0 + 30_000 }]),
    network_lost: () => {
      const dropped = step(boot(), [{ type: 'ice_state', now: T0 + 1_000, state: 'failed' }]);
      return step(dropped, [{ type: 'tick', now: T0 + 20_000 }]);
    },
    permission_denied: () =>
      apply(createTutorSession(config(), T0), [
        {
          type: 'start',
          now: T0,
          sessionId: 'sess-1',
          clientSecret: 'ek',
          model: 'gpt-realtime',
          grantedMs: GRANT,
          correctionMode: 'live',
        },
        { type: 'mic_denied', now: T0 + 100 },
      ]),
    consent_declined: () =>
      apply(createTutorSession(config(), T0), [{ type: 'consent_declined', now: T0 }]),
    app_backgrounded: () => {
      const bg = step(boot(), [{ type: 'app_focus', now: T0 + 1_000, foreground: false }]);
      return step(bg, [{ type: 'tick', now: T0 + 1_000 + TUTOR_SESSION_DEFAULTS.backgroundGraceMs }]);
    },
    safety: () => step(boot(), [{ type: 'safety_stop', now: T0 + 1_000 }]),
    server_error: () =>
      step(boot(), [
        wire(T0 + 1_000, { type: 'error', error: { code: 'session_expired', message: 'gone' } }),
      ]),
  };

  it.each(Object.keys(REACH) as TutorEndReason[])('%s is reachable', (reason) => {
    const run = REACH[reason]();
    expect(run.state.phase).toBe('ended');
    expect(run.state.endReason).toBe(reason);
    expect(of(run.effects, 'teardown')).toHaveLength(1);
  });

  it('never leaves a session live after any of them', () => {
    for (const reason of Object.keys(REACH) as TutorEndReason[]) {
      expect(isLive(REACH[reason]().state)).toBe(false);
    }
  });
});

describe('correction mode vocabulary', () => {
  it('round-trips between the learner-facing and reducer-internal names', () => {
    // Two names for one setting, converted in exactly one place. A screen doing
    // this inline is how someone who asked to be left alone ends up corrected.
    expect(toSessionCorrectionMode('as_you_go')).toBe('live');
    expect(toSessionCorrectionMode('let_me_talk')).toBe('debrief');
    expect(toStoredCorrectionMode('live')).toBe('as_you_go');
    expect(toStoredCorrectionMode('debrief')).toBe('let_me_talk');
  });

  it('is lossless in both directions', () => {
    for (const stored of ['as_you_go', 'let_me_talk'] as const) {
      expect(toStoredCorrectionMode(toSessionCorrectionMode(stored))).toBe(stored);
    }
    for (const mode of ['live', 'debrief'] as const) {
      expect(toSessionCorrectionMode(toStoredCorrectionMode(mode))).toBe(mode);
    }
  });

  it('the stored names are exactly what the database CHECK accepts', () => {
    // tutor_sessions.correction_mode CHECK IN ('as_you_go','let_me_talk').
    // Renaming these requires a migration, so they are pinned here.
    const accepted: readonly string[] = ['as_you_go', 'let_me_talk'];
    expect(accepted).toContain(toStoredCorrectionMode('live'));
    expect(accepted).toContain(toStoredCorrectionMode('debrief'));
  });
});

describe('server_ended', () => {
  it('records the reason the SERVER gave, not a client guess', () => {
    // The point of the command: routing a server budget-stop through `user_end`
    // records it on the wire as 'learner' — the learner hung up — which
    // under-reports budget ends in tutor_sessions.end_reason.
    const run = step(boot(), [{ type: 'server_ended', now: T0 + 5_000, reason: 'budget_exhausted' }]);
    expect(run.state.endReason).toBe('budget_exhausted');
    expect(run.state.phase).toBe('ended');
  });

  it('does not launder one server verdict into another', () => {
    for (const reason of ['budget_exhausted', 'safety', 'server_error'] as const) {
      const run = step(boot(), [{ type: 'server_ended', now: T0 + 5_000, reason }]);
      expect(run.state.endReason).toBe(reason);
    }
  });

  it('tears the session down like any other end', () => {
    const run = step(boot(), [{ type: 'server_ended', now: T0 + 5_000, reason: 'budget_exhausted' }]);
    expect(of(run.effects, 'teardown').length).toBeGreaterThan(0);
  });

  it('cannot resurrect a session that already ended', () => {
    // Same invariant every other terminal command obeys: a late server verdict
    // arriving after teardown must not reopen anything or rewrite the reason.
    const ended = step(boot(), [{ type: 'user_end', now: T0 + 4_000 }]);
    const late = step(ended, [{ type: 'server_ended', now: T0 + 9_000, reason: 'safety' }]);
    expect(late.state.phase).toBe('ended');
    expect(late.state.endReason).toBe('user_ended');
  });

  it('the server verdict beats the client ladder, which is why it exists', () => {
    // The server measures wall clock from started_at; the reducer measures
    // grantedMs minus live time, excluding pauses. The server always runs out
    // first, so a session with budget left on the client can still be ended.
    const run = boot({ grantedMs: 600_000 });
    expect(remainingBudgetMs(run.state)).toBeGreaterThan(0);
    const ended = step(run, [{ type: 'server_ended', now: T0 + 1_000, reason: 'budget_exhausted' }]);
    expect(ended.state.phase).toBe('ended');
    expect(ended.state.endReason).toBe('budget_exhausted');
  });
});
