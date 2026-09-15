/**
 * Unit tests for the live tutor transcript.
 *
 * The rule under test throughout: the transcript may only show what the
 * learner actually heard, in the order it was actually said. A transcript that
 * is merely close teaches words the tutor never spoke.
 */

import {
  applyLearnerDelta,
  applyTutorDelta,
  completeLearnerTurn,
  completeTutorTurn,
  currentTutorTurn,
  emptyTranscript,
  truncateCurrentTutorTurn,
  type TranscriptState,
} from './tutor-transcript';

const text = (state: TranscriptState, index = 0) => state.turns[index].text;

function tutorSaying(...fragments: string[]): TranscriptState {
  return fragments.reduce(
    (state, delta, seq) => applyTutorDelta(state, { id: 't1', seq, delta }),
    emptyTranscript(),
  );
}

describe('accumulating in order', () => {
  it('builds a turn from its fragments', () => {
    const state = tutorSaying('Hola', ', ', '¿qué tal?');
    expect(text(state)).toBe('Hola, ¿qué tal?');
    expect(state.turns[0].status).toBe('streaming');
    expect(state.turns[0].role).toBe('tutor');
  });

  it('keeps learner and tutor turns in first-seen order', () => {
    let state = applyLearnerDelta(emptyTranscript(), { id: 'l1', seq: 0, delta: 'Hola' });
    state = applyTutorDelta(state, { id: 't1', seq: 0, delta: '¡Hola!' });
    state = applyLearnerDelta(state, { id: 'l2', seq: 0, delta: 'Bien' });
    expect(state.turns.map((t) => t.role)).toEqual(['learner', 'tutor', 'learner']);
    expect(state.turns.map((t) => t.id)).toEqual(['l1', 't1', 'l2']);
  });
});

describe('out-of-order deltas', () => {
  it('renders by seq, not by arrival', () => {
    let state = applyTutorDelta(emptyTranscript(), { id: 't1', seq: 2, delta: 'tal?' });
    state = applyTutorDelta(state, { id: 't1', seq: 0, delta: 'Hola, ' });
    state = applyTutorDelta(state, { id: 't1', seq: 1, delta: '¿qué ' });
    expect(text(state)).toBe('Hola, ¿qué tal?');
  });

  it('handles a fragment that arrives long after the ones around it', () => {
    let state = tutorSaying('a', 'b', 'c', 'd');
    state = applyTutorDelta(state, { id: 't1', seq: 4, delta: 'e' });
    state = applyTutorDelta(state, { id: 't1', seq: 10, delta: 'z' });
    state = applyTutorDelta(state, { id: 't1', seq: 5, delta: 'f' });
    expect(text(state)).toBe('abcdefz');
  });

  it('does not care whether seq numbers are contiguous', () => {
    let state = applyTutorDelta(emptyTranscript(), { id: 't1', seq: 100, delta: 'second' });
    state = applyTutorDelta(state, { id: 't1', seq: 7, delta: 'first ' });
    expect(text(state)).toBe('first second');
  });
});

describe('duplicate deltas', () => {
  it('does not stutter when a fragment arrives twice', () => {
    let state = applyTutorDelta(emptyTranscript(), { id: 't1', seq: 0, delta: 'I ' });
    state = applyTutorDelta(state, { id: 't1', seq: 1, delta: 'think' });
    state = applyTutorDelta(state, { id: 't1', seq: 0, delta: 'I ' });
    expect(text(state)).toBe('I think');
  });

  it('returns the same state object so nothing re-renders', () => {
    const state = tutorSaying('Hola');
    expect(applyTutorDelta(state, { id: 't1', seq: 0, delta: 'Hola' })).toBe(state);
  });

  it('keeps the first text when a duplicate seq carries different text', () => {
    let state = applyTutorDelta(emptyTranscript(), { id: 't1', seq: 0, delta: 'original' });
    state = applyTutorDelta(state, { id: 't1', seq: 0, delta: 'REPLACED' });
    expect(text(state)).toBe('original');
  });
});

describe('completion', () => {
  it('marks the turn complete', () => {
    const state = completeTutorTurn(tutorSaying('Hola'), { id: 't1' });
    expect(state.turns[0].status).toBe('complete');
  });

  it('prefers the server authoritative text over the accumulated fragments', () => {
    // The final event accounts for fragments we may never have received.
    const state = completeTutorTurn(tutorSaying('Hol'), { id: 't1', text: 'Hola, ¿qué tal?' });
    expect(text(state)).toBe('Hola, ¿qué tal?');
  });

  it('creates a turn for a completion that never had deltas', () => {
    // A short learner utterance is often transcribed in one shot.
    const state = completeLearnerTurn(emptyTranscript(), { id: 'l1', text: 'Sí' });
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toMatchObject({ role: 'learner', text: 'Sí', status: 'complete' });
  });

  it('ignores an empty completion for a turn it never saw', () => {
    const state = emptyTranscript();
    expect(completeLearnerTurn(state, { id: 'l1' })).toBe(state);
  });

  it('ignores deltas that arrive after the turn is complete', () => {
    let state = completeTutorTurn(tutorSaying('Hola'), { id: 't1' });
    state = applyTutorDelta(state, { id: 't1', seq: 9, delta: ' and more' });
    expect(text(state)).toBe('Hola');
  });
});

describe('truncation on barge-in', () => {
  it('marks the interrupted turn as interrupted', () => {
    const state = truncateCurrentTutorTurn(tutorSaying('Hola, ', 'me llamo Mara'));
    expect(state.turns[0].status).toBe('interrupted');
  });

  it('cuts the text back to what was actually heard', () => {
    const state = truncateCurrentTutorTurn(tutorSaying('Hola, ', 'me llamo Mara'), {
      keepChars: 6,
    });
    expect(text(state)).toBe('Hola, ');
  });

  it('leaves the text alone when the caller cannot say where the audio stopped', () => {
    // Marking without cutting is honest; guessing at a cut point is not.
    const state = truncateCurrentTutorTurn(tutorSaying('Hola, me llamo Mara'));
    expect(text(state)).toBe('Hola, me llamo Mara');
    expect(state.turns[0].status).toBe('interrupted');
  });

  it('removes the turn entirely when nothing was heard', () => {
    // An empty bubble reads as a bug, and there is no honest way to render
    // "the tutor said nothing, loudly".
    const state = truncateCurrentTutorTurn(tutorSaying('Hola'), { keepChars: 0 });
    expect(state.turns).toHaveLength(0);
  });

  it('ignores deltas still in flight for the cancelled response', () => {
    // THE bug this module exists for: the tail arrives after the cancel and
    // puts back text the learner never heard.
    let state = truncateCurrentTutorTurn(tutorSaying('Hola, '), { keepChars: 6 });
    state = applyTutorDelta(state, { id: 't1', seq: 1, delta: 'me llamo Mara' });
    state = applyTutorDelta(state, { id: 't1', seq: 2, delta: ' y soy tu tutora' });
    expect(text(state)).toBe('Hola, ');
    expect(state.turns[0].status).toBe('interrupted');
  });

  it('does not let the done event undo the truncation', () => {
    // `done` carries the FULL response text, including the cancelled part.
    let state = truncateCurrentTutorTurn(tutorSaying('Hola, '), { keepChars: 6 });
    state = completeTutorTurn(state, { id: 't1', text: 'Hola, me llamo Mara' });
    expect(text(state)).toBe('Hola, ');
    expect(state.turns[0].status).toBe('interrupted');
  });

  it('is a no-op when the tutor was not speaking', () => {
    // A barge-in during silence is normal.
    const state = completeTutorTurn(tutorSaying('Hola'), { id: 't1' });
    expect(truncateCurrentTutorTurn(state)).toBe(state);
    expect(truncateCurrentTutorTurn(emptyTranscript()).turns).toHaveLength(0);
  });

  it('truncates the most recent tutor turn, not an earlier one', () => {
    let state = completeTutorTurn(tutorSaying('First turn'), { id: 't1' });
    state = applyTutorDelta(state, { id: 't2', seq: 0, delta: 'Second turn' });
    state = truncateCurrentTutorTurn(state, { keepChars: 6 });
    expect(text(state, 0)).toBe('First turn');
    expect(text(state, 1)).toBe('Second');
  });

  it('never truncates a learner turn', () => {
    const state = applyLearnerDelta(emptyTranscript(), { id: 'l1', seq: 0, delta: 'Hola' });
    expect(truncateCurrentTutorTurn(state, { keepChars: 1 })).toBe(state);
  });

  it('is final — a second truncation cannot re-cut a sealed turn', () => {
    // Sealed means sealed, in both directions. Cutting further would be safe
    // in itself (it only ever removes text), but "a finished turn is
    // immutable" is a rule with no exceptions worth defending, and the second
    // call here is a duplicate cancel event, not new information.
    const first = truncateCurrentTutorTurn(tutorSaying('Hola, mundo'), { keepChars: 5 });
    expect(truncateCurrentTutorTurn(first, { keepChars: 1 })).toBe(first);
    expect(text(first)).toBe('Hola,');
  });

  it('clamps a nonsensical keepChars rather than throwing', () => {
    expect(text(truncateCurrentTutorTurn(tutorSaying('Hola'), { keepChars: 99 }))).toBe('Hola');
    expect(truncateCurrentTutorTurn(tutorSaying('Hola'), { keepChars: -5 }).turns).toHaveLength(0);
    expect(text(truncateCurrentTutorTurn(tutorSaying('Hola'), { keepChars: NaN }))).toBe('Hola');
  });
});

describe('currentTutorTurn', () => {
  it('finds the streaming tutor turn and nothing else', () => {
    expect(currentTutorTurn(emptyTranscript())).toBeNull();
    expect(currentTutorTurn(tutorSaying('Hola'))?.id).toBe('t1');
    expect(currentTutorTurn(completeTutorTurn(tutorSaying('Hola'), { id: 't1' }))).toBeNull();
  });
});

describe('immutability', () => {
  it('never mutates the state it was given', () => {
    const before = tutorSaying('Hola');
    const snapshot = JSON.stringify(before);
    applyTutorDelta(before, { id: 't1', seq: 1, delta: ' mundo' });
    completeTutorTurn(before, { id: 't1', text: 'other' });
    truncateCurrentTutorTurn(before, { keepChars: 1 });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
