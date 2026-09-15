import * as Sentry from '@sentry/react-native';
import {
  isDatabaseExerciseId,
  recordExerciseEvidence,
  reportLessonWriteFailure,
} from './lesson-evidence';
import { recordExerciseResult } from './supabase-queries';
import { enqueue } from './offline-queue';

jest.mock('./supabase-queries', () => ({
  recordExerciseResult: jest.fn(),
}));

jest.mock('./offline-queue', () => ({
  enqueue: jest.fn(async () => {}),
  isNetworkError: (err: unknown) =>
    /network request failed|failed to fetch/i.test(err instanceof Error ? err.message : String(err)),
  newClientResultId: jest.fn(() => 'er:test-1'),
}));

const mockRecord = recordExerciseResult as jest.Mock;
const mockEnqueue = enqueue as jest.Mock;

const USER = 'user-1';
const EXERCISE = '123e4567-e89b-12d3-a456-426614174000';

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockRecord.mockResolvedValue({});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('isDatabaseExerciseId', () => {
  it('accepts a uuid and rejects the synthetic ids the runner also sees', () => {
    expect(isDatabaseExerciseId(EXERCISE)).toBe(true);
    expect(isDatabaseExerciseId('warmup-abc')).toBe(false);
    expect(isDatabaseExerciseId('trial-1')).toBe(false);
    expect(isDatabaseExerciseId('')).toBe(false);
  });
});

describe('recordExerciseEvidence', () => {
  it('sends only what the client is trusted to say, with a minted id', async () => {
    const result = await recordExerciseEvidence(USER, EXERCISE, {
      correct: false,
      attempts: 2,
      responseTimeMs: 4321.6,
    });
    expect(result).toEqual({ status: 'written' });
    expect(mockRecord).toHaveBeenCalledWith({
      exerciseId: EXERCISE,
      correct: false,
      attempts: 2,
      responseTimeMs: 4322,
      clientResultId: 'er:test-1',
    });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('clamps attempts and response time to what the RPC accepts', async () => {
    await recordExerciseEvidence(USER, EXERCISE, { correct: true, attempts: 0, responseTimeMs: -50 });
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1, responseTimeMs: 0 }));
    await recordExerciseEvidence(USER, EXERCISE, { correct: true, attempts: 9, responseTimeMs: 10 });
    expect(mockRecord).toHaveBeenLastCalledWith(expect.objectContaining({ attempts: 5 }));
  });

  it('skips without a signed-in user (the pre-auth trial lesson)', async () => {
    const result = await recordExerciseEvidence('', EXERCISE, { correct: true, attempts: 1, responseTimeMs: 1 });
    expect(result).toEqual({ status: 'skipped', reason: 'no-user' });
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('skips an exercise that cannot be a database row', async () => {
    // The RPC derives everything from the `exercises` row; a hand-authored
    // topic-pack id would fail as "unknown exercise" on every answer.
    const result = await recordExerciseEvidence(USER, 'pack-greetings-3', { correct: true, attempts: 1, responseTimeMs: 1 });
    expect(result).toEqual({ status: 'skipped', reason: 'not-a-row' });
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('queues the same payload — same client id — on a network error', async () => {
    mockRecord.mockRejectedValueOnce(new TypeError('Network request failed'));
    const result = await recordExerciseEvidence(USER, EXERCISE, { correct: true, attempts: 1, responseTimeMs: 900 });
    expect(result).toEqual({ status: 'queued' });
    expect(mockEnqueue).toHaveBeenCalledWith(USER, {
      type: 'exercise-result',
      payload: mockRecord.mock.calls[0][0],
    });
  });

  it('rethrows a non-network failure rather than queueing it forever', async () => {
    mockRecord.mockRejectedValueOnce(new Error('unknown exercise'));
    await expect(
      recordExerciseEvidence(USER, EXERCISE, { correct: true, attempts: 1, responseTimeMs: 1 }),
    ).rejects.toThrow('unknown exercise');
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

describe('reportLessonWriteFailure', () => {
  it('logs and reports a non-network failure to Sentry under the lesson-srs area', () => {
    const err = new Error('permission denied for function record_exercise_result');
    reportLessonWriteFailure('exercise evidence', err);
    expect(warnSpy).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { area: 'lesson-srs' },
      extra: { what: 'exercise evidence' },
    });
  });

  it('logs a network failure without paging Sentry', () => {
    reportLessonWriteFailure('SRS update', new TypeError('Network request failed'));
    expect(warnSpy).toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
