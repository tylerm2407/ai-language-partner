/**
 * Unit tests for the one part of the tutor call host that is checkable without
 * a renderer.
 *
 * There is no component-render harness in this project, so the hook itself —
 * timers, audio session, transport wiring — is verified on a device and
 * nowhere else. `applyServerEventToTranscript` is the exception: it is a pure
 * fold from a parsed server event onto transcript state, and it carries two
 * traps that a device test would not catch either.
 *
 * TRAP ONE is the sequence counter. The realtime wire carries no ordinal on
 * text fragments, and `lib/tutor-transcript.ts` refuses to trust arrival
 * order, so the counter here is what records "on an ordered SCTP data channel,
 * arrival order IS production order". If that counter is ever shared between
 * turns or reset per event, the transcript scrambles.
 *
 * TRAP TWO is the safety seal. A turn the heartbeat's safety check cut has
 * been removed from the transcript — but the wire has not been told, and a
 * late delta for that same response would recreate it as a brand new turn
 * carrying the exact text we removed. The learner would then read a sentence
 * they were deliberately prevented from hearing. That is the assertion this
 * file exists for.
 */

import { applyServerEventToTranscript } from './useRealtimeTutor';
import { emptyTranscript, type TranscriptState } from '../lib/tutor-transcript';
import type { RealtimeServerEvent } from '../lib/realtime-events';

// Importing the hook module drags in everything the hook needs at RUNTIME —
// the native audio module, the API client — none of which the pure function
// under test touches. Both are stubbed so the import is cheap, offline, and
// cannot reach a device module that does not exist in node.
jest.mock('expo-av', () => ({
  __esModule: true,
  Audio: {
    setAudioModeAsync: jest.fn(async () => undefined),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  },
  InterruptionModeIOS: { MixWithOthers: 0, DoNotMix: 1, DuckOthers: 2 },
  InterruptionModeAndroid: { DoNotMix: 1, DuckOthers: 2 },
}));

jest.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

function fold(
  events: readonly RealtimeServerEvent[],
  cutIds?: ReadonlySet<string>,
): TranscriptState {
  const seqs = new Map<string, number>();
  return events.reduce(
    (state, event) => applyServerEventToTranscript(state, event, seqs, cutIds),
    emptyTranscript(),
  );
}

const tutorDelta = (itemId: string, delta: string): RealtimeServerEvent => ({
  kind: 'tutor_transcript_delta',
  responseId: 'resp_1',
  itemId,
  delta,
});

const tutorDone = (itemId: string, transcript: string): RealtimeServerEvent => ({
  kind: 'tutor_transcript_done',
  responseId: 'resp_1',
  itemId,
  transcript,
});

describe('applyServerEventToTranscript', () => {
  it('assembles a tutor turn from its fragments', () => {
    const state = fold([
      tutorDelta('item_1', 'Bon'),
      tutorDelta('item_1', 'jour'),
      tutorDone('item_1', 'Bonjour !'),
    ]);
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toMatchObject({
      role: 'tutor',
      text: 'Bonjour !',
      status: 'complete',
    });
  });

  it('interleaves the learner and the tutor in first-seen order', () => {
    const state = fold([
      tutorDone('item_1', 'Bonjour !'),
      { kind: 'input_transcript_delta', itemId: 'item_2', delta: 'Salut' },
      { kind: 'input_transcript_done', itemId: 'item_2', transcript: 'Salut.' },
      tutorDone('item_3', 'Comment ça va ?'),
    ]);
    expect(state.turns.map((turn) => turn.role)).toEqual(['tutor', 'learner', 'tutor']);
  });

  it('counts a sequence per turn, not per session', () => {
    // Shared across turns, the second turn's fragments would sort behind the
    // first's and the sentence would come out scrambled.
    const state = fold([
      tutorDelta('item_1', 'one'),
      tutorDelta('item_2', 'two'),
      tutorDelta('item_1', ' and one'),
      tutorDelta('item_2', ' and two'),
    ]);
    expect(state.turns.map((turn) => turn.text)).toEqual(['one and one', 'two and two']);
  });

  it('falls back to the response id when the item id is missing', () => {
    const state = fold([
      { kind: 'tutor_transcript_delta', responseId: 'resp_9', itemId: null, delta: 'hi' },
      { kind: 'tutor_transcript_done', responseId: 'resp_9', itemId: null, transcript: 'hi' },
    ]);
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0].text).toBe('hi');
  });

  it('has no opinion about session lifecycle events', () => {
    const state = fold([
      { kind: 'session_created', sessionId: 'rt_1', model: 'gpt-realtime' },
      { kind: 'output_audio_started', responseId: 'resp_1' },
      { kind: 'rate_limits', limits: [] },
      { kind: 'error', code: null, errorType: null, message: 'nope' },
      { kind: 'unknown', type: 'something.new' },
      { kind: 'malformed', reason: 'json' },
    ]);
    expect(state.turns).toEqual([]);
  });

  // ── The safety seal ───────────────────────────────────────────────────

  it('EXCLUDES a cut turn from the transcript', () => {
    const state = fold([tutorDone('item_bad', 'refused')], new Set(['item_bad']));
    expect(state.turns).toEqual([]);
  });

  it('does not let a late delta resurrect a cut turn', () => {
    // The exact failure: the verdict lands, the turn is removed — and then the
    // deltas still in flight for that response rebuild it word for word.
    const state = fold(
      [
        tutorDelta('item_bad', 'refu'),
        tutorDelta('item_bad', 'sed'),
        tutorDone('item_bad', 'refused'),
      ],
      new Set(['item_bad']),
    );
    expect(state.turns).toEqual([]);
  });

  it('keeps the turns either side of a cut one', () => {
    const state = fold(
      [
        tutorDone('item_1', 'Bonjour !'),
        { kind: 'input_transcript_done', itemId: 'item_2', transcript: 'Salut.' },
        tutorDone('item_bad', 'refused'),
        tutorDone('item_4', 'On continue.'),
      ],
      new Set(['item_bad']),
    );
    expect(state.turns.map((turn) => turn.text)).toEqual([
      'Bonjour !',
      'Salut.',
      'On continue.',
    ]);
  });

  it('never seals a learner turn', () => {
    // Ids come from different sequences server-side, but the learner is never
    // cut off for what they said and this must hold even on a collision.
    const state = fold(
      [{ kind: 'input_transcript_done', itemId: 'item_bad', transcript: 'Salut.' }],
      new Set(['item_bad']),
    );
    expect(state.turns.map((turn) => turn.text)).toEqual(['Salut.']);
  });

  it('seals nothing when no turn has been cut', () => {
    const state = fold([tutorDone('item_1', 'Bonjour !')], new Set());
    expect(state.turns).toHaveLength(1);
  });
});
