import {
  ATTEMPT_STATUSES,
  canSkip,
  isAttemptStatus,
  isLocked,
  isResolved,
  maxAttempts,
  nextStatus,
  revealsAnswer,
  type AttemptStatus,
} from './lesson-attempts';
import type { Exercise, ExerciseType } from '../types';

const ALL_TYPES: ExerciseType[] = [
  'multiple_choice', 'listening_choice', 'listening_type', 'translate_to_target',
  'translate_to_native', 'speaking', 'fill_blank', 'free_production',
  'cloze_deletion', 'sentence_construction', 'dictation', 'error_correction',
  'collocation_match', 'word_form', 'sentence_transformation', 'mini_dialogue',
];

const exercise = (type: ExerciseType): Exercise => ({
  id: `ex-${type}`,
  lessonId: 'l1',
  type,
  orderIndex: 0,
  prompt: 'p',
  promptAudioUrl: null,
  correctAnswer: 'a',
  acceptedAnswers: [],
  options: null,
  hintText: null,
  cardId: null,
});

describe('nextStatus', () => {
  it('scores a first-attempt correct as correct', () => {
    expect(nextStatus(true, 0, 2)).toBe('correct');
  });

  it('opens a second attempt on the first wrong answer', () => {
    expect(nextStatus(false, 0, 2)).toBe('retrying');
  });

  it('marks a second-attempt correct as recovered, not correct', () => {
    expect(nextStatus(true, 1, 2)).toBe('recovered');
  });

  it('resolves as wrong once the attempts are spent', () => {
    expect(nextStatus(false, 1, 2)).toBe('wrong');
  });

  it('gives single-attempt exercises no second chance', () => {
    expect(nextStatus(true, 0, 1)).toBe('correct');
    expect(nextStatus(false, 0, 1)).toBe('wrong');
  });
});

describe('maxAttempts', () => {
  it('gives every ordinary type a second chance', () => {
    for (const type of ALL_TYPES) {
      if (type === 'speaking') continue;
      expect(maxAttempts(type, false)).toBe(2);
    }
  });

  it('gives speaking one graded attempt — re-recording is already free', () => {
    expect(maxAttempts('speaking', false)).toBe(1);
  });

  it('gives warm-up items one attempt so the SRS signal stays honest', () => {
    for (const type of ALL_TYPES) {
      expect(maxAttempts(type, true)).toBe(1);
    }
  });
});

describe('canSkip', () => {
  const SKIPPABLE = ['listening_choice', 'listening_type', 'speaking', 'dictation'];

  it('offers skip exactly on the types that need you to hear or speak', () => {
    for (const type of ALL_TYPES) {
      expect(canSkip(exercise(type), false)).toBe(SKIPPABLE.includes(type));
    }
  });

  it('never offers skip during the warm-up', () => {
    for (const type of ALL_TYPES) {
      expect(canSkip(exercise(type), true)).toBe(false);
    }
  });
});

describe('status predicates', () => {
  const expected: Record<AttemptStatus, { resolved: boolean; locked: boolean; reveals: boolean }> = {
    unanswered: { resolved: false, locked: false, reveals: false },
    retrying: { resolved: false, locked: false, reveals: false },
    correct: { resolved: true, locked: true, reveals: false },
    recovered: { resolved: true, locked: true, reveals: true },
    wrong: { resolved: true, locked: true, reveals: true },
    // Skipped resolves the exercise but leaves the input open, so a learner
    // who gets their headphones back can still answer it.
    skipped: { resolved: true, locked: false, reveals: false },
  };

  it.each(ATTEMPT_STATUSES)('classifies %s', (status) => {
    expect(isResolved(status)).toBe(expected[status].resolved);
    expect(isLocked(status)).toBe(expected[status].locked);
    expect(revealsAnswer(status)).toBe(expected[status].reveals);
  });

  it('never reveals the answer while a second attempt is open', () => {
    expect(revealsAnswer('retrying')).toBe(false);
  });

  it('never reveals the answer for a skip', () => {
    expect(revealsAnswer('skipped')).toBe(false);
  });
});

describe('isAttemptStatus', () => {
  it('accepts every known status and nothing else', () => {
    for (const status of ATTEMPT_STATUSES) expect(isAttemptStatus(status)).toBe(true);
    expect(isAttemptStatus('nonsense')).toBe(false);
    expect(isAttemptStatus(null)).toBe(false);
    expect(isAttemptStatus(1)).toBe(false);
  });
});
