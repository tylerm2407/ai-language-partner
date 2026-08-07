/**
 * Unit tests for the hands-free session reducer.
 *
 * This is the entire verification story for hands-free mode: development
 * happens without an iOS simulator, so every decision the feature makes lives
 * in this module precisely so it can be tested here. The tests that matter
 * most are the ones protecting the learner's SM-2 schedule — an aborted listen
 * must never score a card, and a replay must never re-score one.
 */

import { HANDSFREE_VAD } from './vad';
import {
  HANDSFREE_CONFIG_DEFAULTS,
  INITIAL_ITEM_COST_MS,
  createHandsFreeSession,
  currentItem,
  drainCommits,
  elapsedMs,
  handsFreeReduce,
  handsFreeSummaryText,
  hasBudgetForAnotherItem,
  prefetchWindow,
  remainingMs,
  shouldTopUpQueue,
  type HandsFreeConfig,
  type HandsFreeEvent,
  type HandsFreeQueueItem,
  type HandsFreeSessionState,
} from './handsfree-session';

const T0 = 1_000_000;

function config(overrides: Partial<HandsFreeConfig> = {}): HandsFreeConfig {
  return { ...HANDSFREE_CONFIG_DEFAULTS, vad: HANDSFREE_VAD, ...overrides };
}

function item(n: number): HandsFreeQueueItem {
  return {
    cardId: `card-${n}`,
    reviewItemId: `ri-${n}`,
    promptText: `prompt ${n}`,
    expectedText: `answer ${n}`,
    acceptedVariants: [],
    promptLang: 'es',
  };
}

function queue(count: number): HandsFreeQueueItem[] {
  return Array.from({ length: count }, (_, i) => item(i));
}

function start(count = 3, cfg = config(), now = T0): HandsFreeSessionState {
  return handsFreeReduce(createHandsFreeSession(cfg, now), {
    type: 'START',
    now,
    queue: queue(count),
  });
}

function apply(
  state: HandsFreeSessionState,
  events: HandsFreeEvent[],
): HandsFreeSessionState {
  return events.reduce(handsFreeReduce, state);
}

/** Walk announce -> prompt -> earcon -> listening for the current card. */
function toListening(state: HandsFreeSessionState, now = T0): HandsFreeSessionState {
  let s = state;
  let guard = 0;
  while (s.phase !== 'listening' && s.phase !== 'ended' && s.phase !== 'summarizing') {
    s = handsFreeReduce(s, { type: 'STEP_DONE', now });
    if (++guard > 10) throw new Error(`stuck in phase ${s.phase}`);
  }
  return s;
}

function answer(
  now: number,
  opts: { correct?: boolean; commitId?: string } = {},
): HandsFreeEvent {
  const correct = opts.correct ?? true;
  return {
    type: 'ANSWER',
    now,
    commitId: opts.commitId ?? `commit-${now}`,
    rating: correct ? 4 : 1,
    transcript: correct ? 'right' : 'wrong',
    wasCorrect: correct,
    responseTimeMs: 2000,
    phraseKey: correct ? 'correct' : 'incorrect',
  };
}

// ─────────────────────────────────────────────────────────────────────────

describe('start', () => {
  it('begins idle and does nothing until started', () => {
    const s = createHandsFreeSession(config(), T0);
    expect(s.phase).toBe('idle');
    expect(s.step).toEqual({ kind: 'none' });
  });

  it('announces the first card', () => {
    const s = start(3);
    expect(s.phase).toBe('announcing');
    expect(s.step.kind).toBe('announce');
  });

  it('goes straight to a summary when nothing is due', () => {
    const s = handsFreeReduce(createHandsFreeSession(config(), T0), {
      type: 'START',
      now: T0,
      queue: [],
    });
    expect(s.phase).toBe('summarizing');
    expect(handsFreeSummaryText(s)).toContain('Nothing reviewed');
  });

  it('ignores a second START', () => {
    const s = start(3);
    const again = handsFreeReduce(s, { type: 'START', now: T0 + 1, queue: queue(9) });
    expect(again.queue).toHaveLength(3);
  });
});

describe('the item loop', () => {
  it('runs announce, prompt, earcon, listen in order', () => {
    let s = start(2);
    expect(s.phase).toBe('announcing');
    s = handsFreeReduce(s, { type: 'STEP_DONE', now: T0 });
    expect(s.phase).toBe('prompting');
    expect(s.step).toMatchObject({ kind: 'prompt', cardId: 'card-0' });
    s = handsFreeReduce(s, { type: 'STEP_DONE', now: T0 });
    expect(s.phase).toBe('earcon');
    s = handsFreeReduce(s, { type: 'STEP_DONE', now: T0 });
    expect(s.phase).toBe('listening');
    expect(s.step).toMatchObject({ kind: 'listen', cardId: 'card-0' });
  });

  it('advances to the next card after feedback', () => {
    let s = toListening(start(2));
    s = handsFreeReduce(s, answer(T0 + 3000));
    expect(s.phase).toBe('feedback');
    s = handsFreeReduce(s, { type: 'STEP_DONE', now: T0 + 4000 });
    expect(s.index).toBe(1);
    expect(currentItem(s)?.cardId).toBe('card-1');
  });

  it('summarises after the last card', () => {
    let s = toListening(start(1));
    s = apply(s, [answer(T0 + 3000), { type: 'STEP_DONE', now: T0 + 4000 }]);
    expect(s.phase).toBe('summarizing');
    s = handsFreeReduce(s, { type: 'STEP_DONE', now: T0 + 5000 });
    expect(s.phase).toBe('ended');
    expect(s.endReason).toBe('completed');
  });
});

describe('scoring', () => {
  it('commits a graded answer to the outbox', () => {
    let s = toListening(start(2));
    s = handsFreeReduce(s, answer(T0 + 3000, { commitId: 'c1' }));
    expect(s.outbox).toHaveLength(1);
    expect(s.outbox[0]).toMatchObject({
      commitId: 'c1',
      cardId: 'card-0',
      reviewItemId: 'ri-0',
      rating: 4,
      wasCorrect: true,
    });
  });

  it('counts attempts and correct answers', () => {
    let s = toListening(start(2));
    s = apply(s, [answer(T0 + 1000, { correct: true }), { type: 'STEP_DONE', now: T0 + 2000 }]);
    s = toListening(s, T0 + 2000);
    s = handsFreeReduce(s, answer(T0 + 3000, { correct: false }));
    expect(s.itemsAttempted).toBe(2);
    expect(s.itemsCorrect).toBe(1);
  });

  it('drains commits exactly once', () => {
    let s = toListening(start(2));
    s = handsFreeReduce(s, answer(T0 + 1000));
    const first = drainCommits(s);
    expect(first.commits).toHaveLength(1);
    const second = drainCommits(first.state);
    expect(second.commits).toHaveLength(0);
  });
});

describe('retries never corrupt the schedule', () => {
  it('replays a wrong answer without scoring it twice', () => {
    let s = toListening(start(2));
    s = handsFreeReduce(s, answer(T0 + 1000, { correct: false }));
    expect(s.phase).toBe('retry_feedback');
    expect(s.outbox).toHaveLength(1);

    // Feedback finishes -> the SAME card is prompted again, not the next one.
    s = handsFreeReduce(s, { type: 'STEP_DONE', now: T0 + 2000 });
    expect(s.phase).toBe('prompting');
    expect(s.index).toBe(0);

    // The retry answer must not produce a second commit.
    s = toListening(s, T0 + 3000);
    s = handsFreeReduce(s, answer(T0 + 4000, { correct: true, commitId: 'c2' }));
    expect(s.outbox).toHaveLength(1);
    expect(s.itemsAttempted).toBe(1);
  });

  it('advances after the retry is exhausted', () => {
    let s = toListening(start(2));
    s = apply(s, [
      answer(T0 + 1000, { correct: false }),
      { type: 'STEP_DONE', now: T0 + 2000 },
    ]);
    s = toListening(s, T0 + 3000);
    s = apply(s, [
      answer(T0 + 4000, { correct: false }),
      { type: 'STEP_DONE', now: T0 + 5000 },
    ]);
    expect(s.index).toBe(1);
  });

  it('does not replay when repeatOnFail is off', () => {
    let s = toListening(start(2, config({ repeatOnFail: false })));
    s = handsFreeReduce(s, answer(T0 + 1000, { correct: false }));
    expect(s.phase).toBe('feedback');
    s = handsFreeReduce(s, { type: 'STEP_DONE', now: T0 + 2000 });
    expect(s.index).toBe(1);
  });
});

describe('an unheard answer is not a wrong answer', () => {
  it.each(['max_window', 'no_speech', 'too_short', 'low_confidence'] as const)(
    'never commits on abort reason "%s"',
    (reason) => {
      let s = toListening(start(2));
      s = handsFreeReduce(s, { type: 'LISTEN_ABORTED', now: T0 + 1000, reason });
      expect(s.outbox).toHaveLength(0);
      expect(s.itemsAttempted).toBe(0);
    },
  );

  it('re-prompts the same card after an abort', () => {
    let s = toListening(start(2));
    s = handsFreeReduce(s, { type: 'LISTEN_ABORTED', now: T0 + 1000, reason: 'no_speech' });
    expect(s.phase).toBe('retry_feedback');
    expect(s.step).toMatchObject({ phraseKey: 'not_caught' });
    s = handsFreeReduce(s, { type: 'STEP_DONE', now: T0 + 2000 });
    expect(s.phase).toBe('prompting');
    expect(s.index).toBe(0);
  });

  it('skips the card unscored once retries run out, leaving it due', () => {
    let s = toListening(start(2));
    s = apply(s, [
      { type: 'LISTEN_ABORTED', now: T0 + 1000, reason: 'no_speech' },
      { type: 'STEP_DONE', now: T0 + 2000 },
    ]);
    s = toListening(s, T0 + 3000);
    s = handsFreeReduce(s, { type: 'LISTEN_ABORTED', now: T0 + 4000, reason: 'no_speech' });
    expect(s.index).toBe(1);
    expect(s.outbox).toHaveLength(0);
    expect(s.itemsAttempted).toBe(0);
  });
});

describe('pause and resume', () => {
  it('excludes paused time from the session clock', () => {
    let s = start(3);
    s = handsFreeReduce(s, { type: 'PAUSE', now: T0 + 10_000, reason: 'call' });
    s = handsFreeReduce(s, { type: 'RESUME', now: T0 + 610_000 }); // 10 min call
    expect(elapsedMs(s)).toBeCloseTo(10_000, -2);
  });

  it('reports a frozen clock while still paused', () => {
    let s = start(3);
    s = handsFreeReduce(s, { type: 'PAUSE', now: T0 + 5_000, reason: 'call' });
    s = handsFreeReduce(s, { type: 'TICK', now: T0 + 60_000 });
    expect(elapsedMs(s)).toBeCloseTo(5_000, -2);
  });

  it('resumes at the start of the item, never mid-prompt', () => {
    let s = toListening(start(3));
    s = handsFreeReduce(s, { type: 'PAUSE', now: T0 + 5_000, reason: 'call' });
    s = handsFreeReduce(s, { type: 'RESUME', now: T0 + 20_000 });
    expect(s.phase).toBe('announcing');
    expect(s.index).toBe(0);
    expect(s.attempt).toBe(0);
  });

  it('ignores a pause while paused and a resume while running', () => {
    let s = start(3);
    s = handsFreeReduce(s, { type: 'PAUSE', now: T0 + 1000, reason: 'user' });
    const doubled = handsFreeReduce(s, { type: 'PAUSE', now: T0 + 2000, reason: 'call' });
    expect(doubled.pausedAt).toBe(T0 + 1000);

    const running = handsFreeReduce(start(3), { type: 'RESUME', now: T0 + 1000 });
    expect(running.phase).toBe('announcing');
  });

  it('ends an interruption that is never resumed', () => {
    let s = start(3);
    s = handsFreeReduce(s, { type: 'PAUSE', now: T0, reason: 'call' });
    s = handsFreeReduce(s, {
      type: 'TICK',
      now: T0 + HANDSFREE_CONFIG_DEFAULTS.resumeGraceMs + 1,
    });
    expect(s.phase).toBe('ended');
    expect(s.endReason).toBe('interrupted');
  });

  it('does not auto-end a pause the learner asked for', () => {
    let s = start(3);
    s = handsFreeReduce(s, { type: 'PAUSE', now: T0, reason: 'user' });
    s = handsFreeReduce(s, {
      type: 'TICK',
      now: T0 + HANDSFREE_CONFIG_DEFAULTS.resumeGraceMs * 5,
    });
    expect(s.phase).toBe('paused');
  });
});

describe('time boxing', () => {
  it('stops adding items when the budget runs out', () => {
    // Budget of one item, then a card that takes longer than the estimate.
    const cfg = config({ targetDurationMs: 20_000 });
    let s = toListening(start(5, cfg));
    s = apply(s, [answer(T0 + 18_000), { type: 'STEP_DONE', now: T0 + 19_000 }]);
    expect(s.phase).toBe('summarizing');
  });

  it('measures item cost rather than trusting the seed', () => {
    const s0 = start(5);
    expect(s0.itemCostEwmaMs).toBe(INITIAL_ITEM_COST_MS);
    let s = toListening(s0);
    s = apply(s, [answer(T0 + 5_000), { type: 'STEP_DONE', now: T0 + 6_000 }]);
    // First real item took 6s, replacing the 14s seed outright.
    expect(s.itemCostEwmaMs).toBeCloseTo(6_000, -2);
  });

  it('treats an unbounded session as always affordable', () => {
    const s = start(3, config({ targetDurationMs: Number.POSITIVE_INFINITY }));
    expect(hasBudgetForAnotherItem(s)).toBe(true);
    expect(remainingMs(s)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('queue management', () => {
  it('exposes a prefetch window of upcoming cards', () => {
    const s = start(10);
    expect(prefetchWindow(s)).toEqual(['card-0', 'card-1', 'card-2']);
  });

  it('asks for a top-up when the queue is short and time remains', () => {
    const s = start(1, config({ targetDurationMs: 20 * 60 * 1000 }));
    expect(shouldTopUpQueue(s)).toBeGreaterThan(0);
  });

  it('asks for nothing once summarising', () => {
    let s = toListening(start(1));
    s = apply(s, [answer(T0 + 1000), { type: 'STEP_DONE', now: T0 + 2000 }]);
    expect(shouldTopUpQueue(s)).toBe(0);
  });

  it('accepts items appended mid-session', () => {
    let s = start(1);
    s = handsFreeReduce(s, { type: 'QUEUE_APPENDED', now: T0 + 1000, items: queue(2) });
    expect(s.queue).toHaveLength(3);
  });
});

describe('commands', () => {
  it('skips without scoring', () => {
    let s = toListening(start(3));
    s = handsFreeReduce(s, { type: 'COMMAND', now: T0 + 1000, command: 'skip' });
    expect(s.index).toBe(1);
    expect(s.outbox).toHaveLength(0);
  });

  it('repeats without consuming a retry', () => {
    let s = toListening(start(3));
    s = handsFreeReduce(s, { type: 'COMMAND', now: T0 + 1000, command: 'repeat' });
    expect(s.phase).toBe('prompting');
    expect(s.attempt).toBe(0);
    expect(s.index).toBe(0);
  });

  it('pauses and ends', () => {
    const paused = handsFreeReduce(start(3), {
      type: 'COMMAND',
      now: T0 + 1000,
      command: 'pause',
    });
    expect(paused.phase).toBe('paused');

    const ended = handsFreeReduce(start(3), {
      type: 'COMMAND',
      now: T0 + 1000,
      command: 'end',
    });
    expect(ended.phase).toBe('ended');
    expect(ended.endReason).toBe('user_ended');
  });
});

describe('failures', () => {
  it('steps past a recoverable audio failure rather than stalling', () => {
    let s = start(3);
    s = handsFreeReduce(s, { type: 'STEP_FAILED', now: T0 + 1000, stage: 'tts', recoverable: true });
    expect(s.phase).toBe('prompting');
  });

  it('skips the card when the failure happens while listening', () => {
    let s = toListening(start(3));
    s = handsFreeReduce(s, { type: 'STEP_FAILED', now: T0 + 1000, stage: 'stt', recoverable: true });
    expect(s.index).toBe(1);
    expect(s.outbox).toHaveLength(0);
  });

  it('ends on an unrecoverable failure', () => {
    const s = handsFreeReduce(start(3), {
      type: 'STEP_FAILED',
      now: T0 + 1000,
      stage: 'tts',
      recoverable: false,
    });
    expect(s.phase).toBe('ended');
    expect(s.endReason).toBe('error');
  });
});

describe('the reducer is total', () => {
  it('ignores every event once ended', () => {
    const ended = handsFreeReduce(start(3), { type: 'END', now: T0, reason: 'user_ended' });
    const events: HandsFreeEvent[] = [
      { type: 'STEP_DONE', now: T0 + 1 },
      { type: 'LISTEN_ABORTED', now: T0 + 2, reason: 'no_speech' },
      answer(T0 + 3),
      { type: 'PAUSE', now: T0 + 4, reason: 'user' },
      { type: 'RESUME', now: T0 + 5 },
      { type: 'COMMAND', now: T0 + 6, command: 'skip' },
      { type: 'QUEUE_APPENDED', now: T0 + 7, items: queue(2) },
      { type: 'TICK', now: T0 + 8 },
    ];
    for (const e of events) expect(handsFreeReduce(ended, e)).toBe(ended);
  });

  it('ignores an answer that arrives outside a listen window', () => {
    const s = start(3); // announcing
    expect(handsFreeReduce(s, answer(T0 + 1000)).outbox).toHaveLength(0);
  });

  it('does not mutate the state it is given', () => {
    const s = toListening(start(3));
    const snapshot = JSON.stringify(s);
    handsFreeReduce(s, answer(T0 + 1000, { correct: false }));
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
