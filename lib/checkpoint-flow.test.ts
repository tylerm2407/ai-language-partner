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
  checkpointRungLabel,
  checkpointScoreLines,
  checkpointSubmission,
  isCheckpointAnswered,
  CHECKPOINT_SCORE_ORDER,
  MIN_INTERACTION_REPLIES,
  STRAND_LABELS,
  interactionIsEvidence,
  orderCheckpointItems,
  skippedCheckpointStrands,
  testPublishesLevel,
} from './checkpoint-flow';
import type { CheckpointItem, CheckpointResult } from './ai';

function item(id: string, strand: CheckpointItem['strand'], band = 'B1'): CheckpointItem {
  return { id, strand, band, prompt: `prompt ${id}`, options: null };
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
  it('reports every strand in result order, with unmeasured ones null', () => {
    // Result order, not ask order: conversation leads — see
    // CHECKPOINT_SCORE_ORDER. The test asks listening first and reports
    // conversation first, and the two lists are deliberately different.
    const lines = checkpointScoreLines(
      result({ scores: { listening: 0.9, reading: null, speaking: null, writing: 0.5, interaction: 0.72 } }),
    );
    expect(lines.map((l) => l.strand)).toEqual(CHECKPOINT_SCORE_ORDER);
    expect(lines.map((l) => l.percent)).toEqual([72, 90, null, 50, null]);
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

// ─── the staircase, client side ─────────────────────────────────────────────

describe('a strand asked at several bands', () => {
  const RUNGS: CheckpointItem[] = [
    item('l-b2', 'listening', 'B2'),
    item('l-a2', 'listening', 'A2'),
    item('l-b1', 'listening', 'B1'),
    item('w-b2', 'writing', 'B2'),
    item('w-b1', 'writing', 'B1'),
  ];

  it('asks the easier rung first', () => {
    // A B2 question before the A2 one reads as the test being broken, and a
    // hard opener makes people abandon the strand.
    expect(orderCheckpointItems(RUNGS).map((i) => i.id)).toEqual([
      'l-a2',
      'l-b1',
      'l-b2',
      'w-b1',
      'w-b2',
    ]);
  });

  it('keeps strand order ahead of band order', () => {
    // Receptive before productive, exactly as before: every listening rung
    // comes before any writing rung, however the bands compare.
    const strands = orderCheckpointItems(RUNGS).map((i) => i.strand);
    expect(strands).toEqual(['listening', 'listening', 'listening', 'writing', 'writing']);
  });

  it('labels a rung by its position in the strand, not the global index', () => {
    const ordered = orderCheckpointItems(RUNGS);
    expect(checkpointRungLabel(ordered[0], ordered)).toBe('Listening · 1 of 3');
    expect(checkpointRungLabel(ordered[2], ordered)).toBe('Listening · 3 of 3');
    expect(checkpointRungLabel(ordered[3], ordered)).toBe('Writing · 1 of 2');
  });

  it('drops the counter when a strand has only one rung', () => {
    const single = [item('r1', 'reading', 'B1')];
    expect(checkpointRungLabel(single[0], single)).toBe('Reading');
  });

  it('counts every rung toward progress', () => {
    // Five questions, not four. The learner is told how many are left.
    expect(checkpointProgress(RUNGS, { 'l-a2': 'x' }).total).toBe(5);
  });
});

describe('whether a test result becomes the level', () => {
  it('publishes only when practice has measured nothing', () => {
    expect(testPublishesLevel(null)).toBe(true);
  });

  it('never displaces a practice level, in either direction', () => {
    // Not the higher of the two and not the newer of the two: either would let
    // a learner choose their band by testing on a good day.
    expect(testPublishesLevel('A1')).toBe(false);
    expect(testPublishesLevel('C2')).toBe(false);
  });

  it('says which case the learner is in before it names the band', () => {
    const publishes = checkpointOutcomeLine(result({ band: 'B2', movedFrom: 'B1' }), true);
    expect(publishes).toContain('above B1, at B2');
    expect(publishes).toContain('Your report now shows B2');

    const advisory = checkpointOutcomeLine(result({ band: 'B2', movedFrom: 'B1' }), false);
    expect(advisory).toContain('above B1, at B2');
    expect(advisory).toContain('keeps the level measured from your practice');
  });

  it('still reports nothing scored as nothing changed', () => {
    expect(checkpointOutcomeLine(result({ composite: null }), true)).toBe(
      'Nothing was scored this time, so your level is unchanged.',
    );
  });
});

// ─── the conversation strand ────────────────────────────────────────────────

describe('the conversation in the result', () => {
  it('is reported first, ahead of the four item strands', () => {
    // It is 0.55 of the level where the other four are 0.33 together, so it is
    // the first number a learner should meet.
    expect(CHECKPOINT_SCORE_ORDER[0]).toBe('interaction');
  });

  it('is labelled in the learner\'s word, not the CEFR one', () => {
    expect(STRAND_LABELS.interaction).toBe('Conversation');
  });

  it('shows Not measured rather than a zero when it was skipped', () => {
    const lines = checkpointScoreLines(
      result({ scores: { listening: 0.9, reading: 0.8, speaking: null, writing: 0.8, interaction: null } }),
    );
    const conversation = lines.find((l) => l.strand === 'interaction');
    expect(conversation?.percent).toBeNull();
  });

  it('parses a result from a deployment that predates the strand', () => {
    // `interaction` is optional on the wire; an older server omits it and the
    // row must read as unmeasured rather than as a zero.
    const lines = checkpointScoreLines(result());
    expect(lines.find((l) => l.strand === 'interaction')?.percent).toBeNull();
  });

  it('reports a measured conversation as a percentage', () => {
    const lines = checkpointScoreLines(
      result({ scores: { listening: 0.9, reading: 0.8, speaking: 0.7, writing: 0.8, interaction: 0.74 } }),
    );
    expect(lines.find((l) => l.strand === 'interaction')?.percent).toBe(74);
  });

  it('needs three answers before it is worth scoring', () => {
    expect(MIN_INTERACTION_REPLIES).toBe(3);
    expect(interactionIsEvidence(2)).toBe(false);
    expect(interactionIsEvidence(3)).toBe(true);
    expect(interactionIsEvidence(4)).toBe(true);
  });
});
