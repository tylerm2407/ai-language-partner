/**
 * Tests for the checkpoint screen's decisions.
 *
 * The ones that matter are all about a PARTIAL checkpoint, because that is the
 * normal case: speaking is the strand that fails for reasons unrelated to the
 * learner, and every rule here exists so that a denied microphone costs one
 * strand rather than the whole check-in.
 */
import {
  CHECKPOINT_STRAND_ORDER,
  canSubmitCheckpoint,
  checkpointOutcomeLine,
  checkpointProgress,
  checkpointScoreLines,
  checkpointSubmission,
  isCheckpointAnswered,
  orderCheckpointItems,
  skippedCheckpointStrands,
} from './checkpoint-flow';
import type { CheckpointItem, CheckpointResult } from './ai';

function item(id: string, strand: CheckpointItem['strand']): CheckpointItem {
  return { id, strand, prompt: `prompt ${id}`, options: null };
}

const ITEMS: CheckpointItem[] = [
  item('w1', 'writing'),
  item('s1', 'speaking'),
  item('l1', 'listening'),
  item('r1', 'reading'),
];

function result(over: Partial<CheckpointResult> = {}): CheckpointResult {
  return {
    composite: 0.8,
    band: 'B1',
    movedFrom: 'B1',
    scores: { listening: 0.9, reading: 0.8, speaking: 0.7, writing: 0.8 },
    ...over,
  };
}

describe('orderCheckpointItems', () => {
  it('asks receptive strands first and speaking last', () => {
    // Speaking last is the load-bearing part: it is the only strand that can
    // fail for reasons that are not the learner's, and asking it last means
    // such a failure costs the strand rather than the checkpoint.
    expect(orderCheckpointItems(ITEMS).map((i) => i.strand)).toEqual(CHECKPOINT_STRAND_ORDER);
  });

  it('keeps the server rotation within a strand', () => {
    const two = [item('l1', 'listening'), item('l2', 'listening')];
    expect(orderCheckpointItems(two).map((i) => i.id)).toEqual(['l1', 'l2']);
  });

  it('does not invent strands the server did not send', () => {
    const only = [item('r1', 'reading')];
    expect(orderCheckpointItems(only)).toHaveLength(1);
  });
});

describe('isCheckpointAnswered', () => {
  it('treats whitespace as unanswered', () => {
    // A spaces-only answer would normalise to empty on the server and score as
    // wrong, which reads as "I answered and got it wrong" rather than "I left
    // it blank".
    expect(isCheckpointAnswered(item('a', 'writing'), { a: '   ' })).toBe(false);
    expect(isCheckpointAnswered(item('a', 'writing'), { a: ' hola ' })).toBe(true);
    expect(isCheckpointAnswered(item('a', 'writing'), {})).toBe(false);
  });
});

describe('checkpointProgress', () => {
  it('counts answered over total', () => {
    expect(checkpointProgress(ITEMS, { l1: 'a', r1: 'b' })).toEqual({
      answered: 2,
      total: 4,
      fraction: 0.5,
    });
  });

  it('is zero rather than NaN with nothing to answer', () => {
    expect(checkpointProgress([], {}).fraction).toBe(0);
  });
});

describe('skippedCheckpointStrands', () => {
  it('names the strands with no answer at all', () => {
    expect(skippedCheckpointStrands(ITEMS, { l1: 'a', r1: 'b' })).toEqual(['writing', 'speaking']);
  });

  it('never names a strand the checkpoint did not include', () => {
    const noSpeaking = ITEMS.filter((i) => i.strand !== 'speaking');
    expect(skippedCheckpointStrands(noSpeaking, { l1: 'a' })).not.toContain('speaking');
  });
});

describe('canSubmitCheckpoint', () => {
  it('allows a partial checkpoint', () => {
    // Requiring every item would turn a skipped speaking strand into a lost
    // check-in. The server averages the strands that were answered and
    // excludes the rest.
    expect(canSubmitCheckpoint(ITEMS, { l1: 'a' })).toBe(true);
  });

  it('refuses an empty one', () => {
    expect(canSubmitCheckpoint(ITEMS, {})).toBe(false);
    expect(canSubmitCheckpoint(ITEMS, { l1: '  ' })).toBe(false);
  });
});

describe('checkpointSubmission', () => {
  it('sends trimmed answers and drops the blanks', () => {
    expect(checkpointSubmission(ITEMS, { l1: ' a ', r1: '', s1: '   ' })).toEqual({ l1: 'a' });
  });
});

describe('checkpointScoreLines', () => {
  it('reports every strand in ask order, with unmeasured ones null', () => {
    const lines = checkpointScoreLines(result({ scores: { listening: 0.9, reading: null, speaking: null, writing: 0.5 } }));
    expect(lines.map((l) => l.strand)).toEqual(CHECKPOINT_STRAND_ORDER);
    expect(lines.map((l) => l.percent)).toEqual([90, null, 50, null]);
  });
});

describe('checkpointOutcomeLine', () => {
  it('never claims the learner is now a different level', () => {
    // A checkpoint moves the cohort segment. The band on the report still comes
    // from practice history, and a result screen implying otherwise would be
    // the promotion gate we deliberately did not build.
    const line = checkpointOutcomeLine(result({ band: 'B2', movedFrom: 'B1' }));
    expect(line).toContain('above B1');
    expect(line).not.toMatch(/you are now/i);
  });

  it('says so when the check-in agrees', () => {
    expect(checkpointOutcomeLine(result())).toContain('agrees with B1');
  });

  it('reports a downward result without dressing it up', () => {
    expect(checkpointOutcomeLine(result({ band: 'A2', movedFrom: 'B1' }))).toContain('below B1');
  });

  it('handles a checkpoint where nothing scored', () => {
    expect(checkpointOutcomeLine(result({ composite: null }))).toContain('unchanged');
  });
});
