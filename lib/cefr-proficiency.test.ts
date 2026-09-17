/**
 * Unit tests for the CEFR proficiency estimator.
 *
 * The contract under test is deliberately conservative: the estimator must
 * refuse to report a level it cannot evidence, must not skip bands, and must
 * take the floor across skills rather than the best one. Most of these tests
 * exist to stop future changes from quietly inflating the report.
 */

import {
  analyzeBands,
  assessConfidence,
  buildProficiencyReport,
  cefrBandForProficiencyLevel,
  combineConversationScore,
  isMature,
  isRetained,
  unevidencedSkills,
  normalizeBand,
  nextLevelRequirement,
  overallFromBands,
  scoreBand,
  scoreBands,
  interactionStrand,
  BAND_THRESHOLD,
  STRAND_WEIGHTS,
  MIN_INTERACTION_UNITS,
  MIN_INTERACTION_DAYS,
  MIN_INTERACTION_TURNS_PER_UNIT,
  MAX_INTERACTION_TURNS_COUNTED,
  INTERACTION_PASS_SCORE,
  vocabularyLevel,
  CEFR_LADDER,
  CONFIDENCE_TIERS,
  LISTENING_PASS_RATE,
  MIN_ITEMS_PER_BAND,
  MIN_LISTENING_ITEMS,
  MIN_MATURE_ITEMS_PER_BAND,
  MIN_READING_ITEMS,
  MIN_SPEAKING_ITEMS,
  MIN_WRITING_ITEMS,
  SCORED_SKILLS,
  SPEAKING_PASS_SCORE,
  type CefrBand,
  type InteractionTurnItem,
  type ListeningEvidenceItem,
  type ProficiencyEvidence,
  type ReadingEvidenceItem,
  type SkillAssessment,
  type SpeakingEvidenceItem,
  type VocabEvidenceItem,
  type WritingEvidenceItem,
  writingStrand,
  ORTHOGRAPHY_TO_PROSE_RATIO,
} from './cefr-proficiency';

const NOW = new Date('2026-08-05T12:00:00.000Z');

/**
 * Build `count` MATURE vocab items in a band, the first `retained` of them
 * graduated and the rest failing to hold.
 *
 * The unretained items are low-ease cards that have survived several recalls
 * without ever reaching a 21-day interval — repetitions 6 at interval 17 is an
 * ordinary shape for a card stuck at the minimum ease factor. They used to be
 * built as brand-new cards (repetitions 1, interval 1), which is a different
 * thing entirely: a card nobody has failed, because nobody has asked for it
 * again yet. Every caller here means "the learner met N items and only R of
 * them stuck", and only the mature version says that. See `newVocab` for items
 * that genuinely have not been tested yet.
 */
function vocab(band: string, count: number, retained: number): VocabEvidenceItem[] {
  return Array.from({ length: count }, (_, i) =>
    i < retained
      ? { cefrLevel: band, status: 'graduated' as const, repetitions: 5, interval: 30 }
      : { cefrLevel: band, status: 'review' as const, repetitions: 6, interval: 17 }
  );
}

/** Build `count` freshly introduced items: seen once, never yet recalled. */
function newVocab(band: string, count: number): VocabEvidenceItem[] {
  return Array.from({ length: count }, () => ({
    cefrLevel: band,
    status: 'learning' as const,
    repetitions: 1,
    interval: 1,
  }));
}

/** Build `count` completed reading pieces in a band, all above the pass mark. */
function reading(band: string, count: number): ReadingEvidenceItem[] {
  return Array.from({ length: count }, () => ({
    cefrLevel: band,
    comprehension: 0.9,
    completed: true,
  }));
}

/** Build `count` graded writing submissions in a band, all above the pass mark. */
function writing(band: string, count: number): WritingEvidenceItem[] {
  return Array.from({ length: count }, () => ({
    cefrLevel: band,
    overallScore: 0.85,
    wordCount: 120,
  }));
}

/** Build `count` scored spoken attempts in a band, each at `score` (0–1). */
function speak(band: string | null, count: number, score: number): SpeakingEvidenceItem[] {
  return Array.from({ length: count }, () => ({ cefrLevel: band, score }));
}

/** Build `count` graded listening exercises in a band, the first `correct` of them right first time. */
function listen(band: string | null, count: number, correct: number): ListeningEvidenceItem[] {
  return Array.from({ length: count }, (_, i) => ({ cefrLevel: band, correct: i < correct }));
}

/**
 * Build `sessions` qualifying conversations in a band, each of `turns` turns
 * scored at `score`, spread one per day over `days` distinct days.
 *
 * Sessions beyond `days` reuse the last day, which is how a learner who talked
 * twice in one evening actually looks.
 */
function convo(
  band: string | null,
  sessions: number,
  days: number,
  score: number,
  turns: number = MIN_INTERACTION_TURNS_PER_UNIT,
): InteractionTurnItem[] {
  const out: InteractionTurnItem[] = [];
  for (let s = 0; s < sessions; s++) {
    const day = `2026-01-${String(Math.min(s, days - 1) + 1).padStart(2, '0')}`;
    for (let t = 0; t < turns; t++) {
      out.push({ cefrLevel: band, sessionId: `${band}-s${s}`, day, score });
    }
  }
  return out;
}

/**
 * Passing evidence in the five non-vocabulary strands at every band from
 * `from` up to `to` inclusive. A band is a weighted score over six strands, so
 * most report-level tests pair this with `vocab(...)` at the same bands.
 */
function fullStrands(
  to: CefrBand,
  from: CefrBand = 'A1',
): Pick<ProficiencyEvidence, 'reading' | 'writing' | 'speaking' | 'listening' | 'interaction'> {
  const bands = CEFR_LADDER.slice(CEFR_LADDER.indexOf(from), CEFR_LADDER.indexOf(to) + 1);
  return {
    reading: bands.flatMap((b) => reading(b, MIN_READING_ITEMS)),
    writing: bands.flatMap((b) => writing(b, MIN_WRITING_ITEMS)),
    speaking: bands.flatMap((b) => speak(b, MIN_SPEAKING_ITEMS, 0.9)),
    listening: bands.flatMap((b) => listen(b, MIN_LISTENING_ITEMS, MIN_LISTENING_ITEMS)),
    interaction: bands.flatMap((b) => convo(b, MIN_INTERACTION_UNITS, MIN_INTERACTION_DAYS, 0.9)),
  };
}

function emptyEvidence(): ProficiencyEvidence {
  return {
    interaction: [],
    vocabulary: [],
    reading: [],
    writing: [],
  orthography: [],
    speaking: [],
    listening: [],
    listeningMinutes: 0,
    speakingMinutes: 0,
    activeDays: 0,
    totalReviews: 0,
  };
}

describe('normalizeBand', () => {
  it('accepts clean band tags', () => {
    expect(normalizeBand('A1')).toBe('A1');
    expect(normalizeBand('C2')).toBe('C2');
  });

  it('normalises case and surrounding whitespace', () => {
    expect(normalizeBand('  b1 ')).toBe('B1');
  });

  it('takes the first band token from a range tag', () => {
    expect(normalizeBand('B1-B2')).toBe('B1');
  });

  it('returns null for missing or unrecognisable tags', () => {
    expect(normalizeBand(null)).toBeNull();
    expect(normalizeBand('')).toBeNull();
    expect(normalizeBand('intermediate')).toBeNull();
    expect(normalizeBand('D1')).toBeNull();
  });
});

describe('cefrBandForProficiencyLevel', () => {
  it('maps every proficiency level onto the CEFR ladder', () => {
    expect(cefrBandForProficiencyLevel('beginner')).toBe('A1');
    expect(cefrBandForProficiencyLevel('elementary')).toBe('A2');
    expect(cefrBandForProficiencyLevel('intermediate')).toBe('B1');
    expect(cefrBandForProficiencyLevel('upper_intermediate')).toBe('B2');
    expect(cefrBandForProficiencyLevel('advanced')).toBe('C1');
  });
});

describe('isRetained', () => {
  it('counts graduated items', () => {
    expect(
      isRetained({ cefrLevel: 'A1', status: 'graduated', repetitions: 4, interval: 30 })
    ).toBe(true);
  });

  it('counts legacy rows via repetitions + interval when status lags', () => {
    expect(
      isRetained({ cefrLevel: 'A1', status: 'review', repetitions: 3, interval: 21 })
    ).toBe(true);
  });

  it('excludes leeches even when the interval looks mature', () => {
    expect(
      isRetained({ cefrLevel: 'A1', status: 'leech', repetitions: 9, interval: 40 })
    ).toBe(false);
  });

  it('excludes items still in learning', () => {
    expect(
      isRetained({ cefrLevel: 'A1', status: 'learning', repetitions: 1, interval: 1 })
    ).toBe(false);
  });
});

describe('isMature', () => {
  it('excludes an item that is short of both the interval and the repetition bar', () => {
    expect(isMature({ cefrLevel: 'A1', status: 'learning', repetitions: 1, interval: 1 })).toBe(
      false
    );
  });

  it('counts an item that clears either bar alone', () => {
    // Several survived recalls, interval still short (a low-ease card).
    expect(isMature({ cefrLevel: 'A1', status: 'review', repetitions: 6, interval: 17 })).toBe(
      true
    );
    // Long interval reached some other way (imported or hand-edited row).
    expect(isMature({ cefrLevel: 'A1', status: 'review', repetitions: 1, interval: 30 })).toBe(
      true
    );
  });

  it('counts every retained item, so the rate can never exceed 1', () => {
    const retainedItems: VocabEvidenceItem[] = [
      { cefrLevel: 'A1', status: 'graduated', repetitions: 5, interval: 30 },
      // Graduated but with fields that predate the status being maintained.
      { cefrLevel: 'A1', status: 'graduated', repetitions: 0, interval: 0 },
      { cefrLevel: 'A1', status: 'review', repetitions: 3, interval: 21 },
    ];
    for (const item of retainedItems) {
      expect(isRetained(item)).toBe(true);
      expect(isMature(item)).toBe(true);
    }
  });

  it('keeps leeches in the denominator even though SM-2 has reset their counters', () => {
    // A card forgotten eight times is reset to repetitions 0 / interval 1, so
    // it is numerically identical to a card met yesterday. If it left the
    // denominator, chronic failure would silently RAISE the retention rate.
    const leech: VocabEvidenceItem = {
      cefrLevel: 'A1',
      status: 'leech',
      repetitions: 0,
      interval: 1,
    };
    expect(isMature(leech)).toBe(true);
    expect(isRetained(leech)).toBe(false);

    const withLeeches = [...vocab('A1', 20, 20), ...Array.from({ length: 20 }, () => leech)];
    expect(analyzeBands(withLeeches)[0].retentionRate).toBeCloseTo(0.5);
    expect(analyzeBands(withLeeches)[0].status).toBe('developing');
  });
});

describe('analyzeBands', () => {
  it('always returns all six bands so the UI can render a full ladder', () => {
    expect(analyzeBands([]).map((b) => b.band)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });

  it('marks a band insufficient below the minimum item count', () => {
    const bands = analyzeBands(vocab('A1', MIN_ITEMS_PER_BAND - 1, MIN_ITEMS_PER_BAND - 1));
    expect(bands[0].status).toBe('insufficient');
  });

  it('marks a band mastered at or above the mastery rate', () => {
    const bands = analyzeBands(vocab('A1', 100, 80));
    expect(bands[0].retentionRate).toBeCloseTo(0.8);
    expect(bands[0].status).toBe('mastered');
  });

  it('marks a band developing between the developing and mastery rates', () => {
    expect(analyzeBands(vocab('A1', 100, 60))[0].status).toBe('developing');
  });

  it('marks a band weak below the developing rate', () => {
    expect(analyzeBands(vocab('A1', 100, 20))[0].status).toBe('weak');
  });

  it('measures retention over mature items only, not over everything seen', () => {
    const bands = analyzeBands([...vocab('A1', 20, 18), ...newVocab('A1', 80)]);
    expect(bands[0].seen).toBe(100);
    expect(bands[0].mature).toBe(20);
    expect(bands[0].retained).toBe(18);
    expect(bands[0].retentionRate).toBeCloseTo(0.9);
  });

  it('marks a band insufficient when too few of its items have matured', () => {
    // Exposure is ample, but only three cards have been asked for again — a
    // rate over three items is arithmetic, not an assessment.
    const bands = analyzeBands([
      ...vocab('A1', MIN_MATURE_ITEMS_PER_BAND - 7, MIN_MATURE_ITEMS_PER_BAND - 7),
      ...newVocab('A1', 60),
    ]);
    expect(bands[0].seen).toBe(63);
    expect(bands[0].mature).toBe(3);
    expect(bands[0].retentionRate).toBeCloseTo(1);
    expect(bands[0].status).toBe('insufficient');
  });

  it('judges the band on the exact mature item that crosses the floor', () => {
    const below = analyzeBands([
      ...vocab('A1', MIN_MATURE_ITEMS_PER_BAND - 1, MIN_MATURE_ITEMS_PER_BAND - 1),
      ...newVocab('A1', 40),
    ]);
    expect(below[0].status).toBe('insufficient');

    const at = analyzeBands([
      ...vocab('A1', MIN_MATURE_ITEMS_PER_BAND, MIN_MATURE_ITEMS_PER_BAND),
      ...newVocab('A1', 40),
    ]);
    expect(at[0].status).toBe('mastered');
  });

  it('ignores untagged items rather than bucketing them into a default band', () => {
    const items: VocabEvidenceItem[] = [
      ...vocab('A1', 30, 30),
      { cefrLevel: null, status: 'graduated', repetitions: 5, interval: 30 },
      { cefrLevel: 'nonsense', status: 'graduated', repetitions: 5, interval: 30 },
    ];
    const bands = analyzeBands(items);
    expect(bands[0].seen).toBe(30);
    expect(bands.reduce((sum, b) => sum + b.seen, 0)).toBe(30);
  });
});

describe('vocabularyLevel', () => {
  it('returns null when nothing is mastered', () => {
    expect(vocabularyLevel(analyzeBands(vocab('A1', 100, 10)))).toBeNull();
  });

  it('returns the highest contiguously mastered band', () => {
    const items = [...vocab('A1', 50, 50), ...vocab('A2', 50, 45)];
    expect(vocabularyLevel(analyzeBands(items))).toBe('A2');
  });

  it('does not skip a band — mastering B2 without A2 does not make you B2', () => {
    const items = [...vocab('A1', 50, 50), ...vocab('B2', 50, 50)];
    expect(vocabularyLevel(analyzeBands(items))).toBe('A1');
  });

  it('stops at a band that is merely developing', () => {
    const items = [...vocab('A1', 50, 50), ...vocab('A2', 50, 30), ...vocab('B1', 50, 50)];
    expect(vocabularyLevel(analyzeBands(items))).toBe('A1');
  });

  // The defect this pins: `retentionRate` was `retained / seen`, and a card
  // introduced today lands in `seen` while `isRetained` stays false for the
  // ~three weeks SM-2 needs to graduate it. Starting a new deck therefore
  // dropped the reported level immediately — the audit's worked example was a
  // B1 learner shown A1 for three weeks for the crime of studying.
  it('does not regress when the learner starts new cards in a mastered band', () => {
    const settled = [...vocab('A1', 40, 40), ...vocab('A2', 40, 40), ...vocab('B1', 40, 34)];
    expect(vocabularyLevel(analyzeBands(settled))).toBe('B1');

    for (const started of [1, 5, 20, 200]) {
      const after = analyzeBands([...settled, ...newVocab('B1', started)]);
      expect(vocabularyLevel(after)).toBe('B1');
      // Not merely "still B1": the rate itself must be untouched, so the level
      // cannot be sitting one new card away from falling.
      expect(after[2].retentionRate).toBeCloseTo(0.85);
      expect(after[2].mature).toBe(40);
      expect(after[2].seen).toBe(40 + started);
    }
  });

  it('does not regress when the new cards are in a band above the current level', () => {
    // The commonest shape of the bug in practice: A2 is confirmed, the learner
    // is pushed onward into B1 material, and the act of starting it used to
    // knock the B1 band from insufficient into weak — which changes nothing for
    // the walk, but the same move one rung lower cost them the level outright.
    const settled = [...vocab('A1', 40, 40), ...vocab('A2', 40, 36)];
    expect(vocabularyLevel(analyzeBands(settled))).toBe('A2');
    expect(vocabularyLevel(analyzeBands([...settled, ...newVocab('B1', 60)]))).toBe('A2');
    expect(vocabularyLevel(analyzeBands([...settled, ...newVocab('A2', 60)]))).toBe('A2');
  });

  it('withholds a level built on too few mature items, however much was seen', () => {
    // Three mature cards at 100% is not A1. Under the old rate this learner was
    // 'insufficient' only by accident of the seen count; make the seen count
    // large and the band would have been judged on three items.
    const thin = analyzeBands([...vocab('A1', 3, 3), ...newVocab('A1', 97)]);
    expect(thin[0].seen).toBe(100);
    expect(vocabularyLevel(thin)).toBeNull();
  });

  it('still falls when material the learner HAS studied stops sticking', () => {
    // The fix must not turn the estimate into a ratchet. Mature items that fail
    // are exactly the evidence the report is supposed to react to.
    expect(vocabularyLevel(analyzeBands([...vocab('A1', 40, 40), ...vocab('A2', 40, 36)]))).toBe(
      'A2'
    );
    expect(vocabularyLevel(analyzeBands([...vocab('A1', 40, 40), ...vocab('A2', 40, 20)]))).toBe(
      'A1'
    );
  });
});

describe('assessConfidence', () => {
  it('returns none when evidence is thin', () => {
    expect(assessConfidence(10, 2)).toBe('none');
  });

  it('requires both review volume and spread — cramming alone is not confidence', () => {
    expect(assessConfidence(600, 2)).toBe('none');
    expect(assessConfidence(600, 12)).toBe('medium');
    expect(assessConfidence(600, 40)).toBe('high');
  });

  it('steps through the tiers', () => {
    expect(assessConfidence(30, 3)).toBe('low');
    expect(assessConfidence(150, 10)).toBe('medium');
    expect(assessConfidence(500, 30)).toBe('high');
  });
});

describe('interactionStrand', () => {
  it('needs enough turns before a conversation counts as a unit', () => {
    const short = interactionStrand(
      convo('A1', 3, 3, 0.9, MIN_INTERACTION_TURNS_PER_UNIT - 1),
    );
    expect(short.bands.find((b) => b.band === 'A1')?.total).toBe(0);

    const long = interactionStrand(convo('A1', 3, 3, 0.9));
    expect(long.bands.find((b) => b.band === 'A1')?.total).toBe(3);
  });

  it('drops turns that cannot be attributed to a session', () => {
    // Pre-migration-131 voice rows have no session id. Counting each as its
    // own conversation would rebuild the per-turn gate the session unit
    // replaced, so they contribute nothing at all.
    const orphaned = interactionStrand(
      Array.from({ length: 50 }, () => ({
        cefrLevel: 'A1',
        sessionId: null,
        day: '2026-01-01',
        score: 0.9,
      })),
    );
    expect(orphaned.bands.find((b) => b.band === 'A1')?.total).toBe(0);
  });

  it('counts distinct days, so one marathon evening is not twelve days', () => {
    const crammed = interactionStrand(convo('A1', MIN_INTERACTION_UNITS, 1, 0.9));
    const at = crammed.bands.find((b) => b.band === 'A1');
    expect(at?.total).toBe(MIN_INTERACTION_UNITS);
    expect(at?.days).toBe(1);
  });

  it('caps the turns any one session contributes to the mean', () => {
    // One enormous session of perfect turns, plus one ordinary weak session.
    // Without the cap the big session swamps the mean; with it, each session
    // contributes at most MAX_INTERACTION_TURNS_COUNTED turns.
    const big = MAX_INTERACTION_TURNS_COUNTED * 10;
    const turns = [
      ...convo('A1', 1, 1, 1.0, big),
      ...convo('A1', 1, 1, 0.0),
    ].map((t, i) => ({ ...t, sessionId: i < big ? 'big' : 'small' }));
    const at = interactionStrand(turns).bands.find((b) => b.band === 'A1');
    const expected =
      (MAX_INTERACTION_TURNS_COUNTED * 1.0) /
      (MAX_INTERACTION_TURNS_COUNTED + MIN_INTERACTION_TURNS_PER_UNIT);
    expect(at?.mean).toBeCloseTo(expected, 5);
  });
});

describe('scoreBand and the weighted rule', () => {
  it('has weights that sum to one', () => {
    const total = SCORED_SKILLS.reduce((sum, k) => sum + STRAND_WEIGHTS[k], 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('keeps the threshold above the largest single weight', () => {
    // The load-bearing inequality. If any one strand's weight ever reaches
    // BAND_THRESHOLD, that strand alone can publish a band and the whole
    // "no level rests on one source" guarantee is gone.
    const largest = Math.max(...SCORED_SKILLS.map((k) => STRAND_WEIGHTS[k]));
    expect(largest).toBeLessThan(BAND_THRESHOLD);
  });

  it('will not publish a band on perfect conversation alone', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        interaction: convo('A1', MIN_INTERACTION_UNITS, MIN_INTERACTION_DAYS, 1),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(report.skills.find((s) => s.skill === 'interaction')?.level).toBe('A1');
    // The strand is maxed and the band still is not held.
    const a1 = report.bandScores.find((b) => b.band === 'A1');
    expect(a1?.strands.find((s) => s.skill === 'interaction')?.gate).toBe(1);
    expect(a1?.held).toBe(false);
    expect(report.overallLevel).toBeNull();
  });

  it('publishes the band once conversation is joined by other work', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        interaction: convo('A1', MIN_INTERACTION_UNITS, MIN_INTERACTION_DAYS, 1),
        reading: reading('A1', MIN_READING_ITEMS),
        listening: listen('A1', MIN_LISTENING_ITEMS, MIN_LISTENING_ITEMS),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(report.overallLevel).toBe('A1');
  });

  it('no longer lets thin vocabulary veto a whole report', () => {
    // The failure that motivated the weighted rule: every other strand strong,
    // vocabulary untouched. Under the old all-strands rule this was null.
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        ...fullStrands('A1'),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(report.skills.find((s) => s.skill === 'vocabulary')?.level).toBeNull();
    expect(report.overallLevel).toBe('A1');
  });

  it('still refuses to skip a rung', () => {
    // Full evidence at A2 and nothing at A1. The score at A2 clears the
    // threshold on its own, and the contiguity walk still withholds the level.
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        ...fullStrands('A2', 'A2'),
        vocabulary: vocab('A2', 60, 55),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(report.bandScores.find((b) => b.band === 'A2')?.held).toBe(true);
    expect(report.overallLevel).toBeNull();
  });

  it('names the strands with nothing logged at the target band', () => {
    const scores = scoreBands({
      bands: analyzeBands([]),
      strands: [interactionStrand(convo('A1', MIN_INTERACTION_UNITS, MIN_INTERACTION_DAYS, 0.9))],
    });
    expect(unevidencedSkills(scores.find((s) => s.band === 'A1'))).toEqual([
      'vocabulary',
      'reading',
      'writing',
      'listening',
      'speaking',
    ]);
  });

  it('credits a strand already assessed above the band at full weight', () => {
    const skills: SkillAssessment[] = [
      {
        skill: 'reading',
        level: 'B2',
        status: 'assessed',
        detail: '',
        evidenceCount: 0,
        assumedBands: [],
      },
    ];
    const scored = scoreBand('A1', { bands: analyzeBands([]), strands: [] }, skills);
    expect(scored.strands.find((s) => s.skill === 'reading')?.gate).toBe(1);
  });

  it('holds the level when overallFromBands walks a contiguous run', () => {
    const scores = [
      { band: 'A1' as const, score: 0.9, held: true, strands: [] },
      { band: 'A2' as const, score: 0.8, held: true, strands: [] },
      { band: 'B1' as const, score: 0.3, held: false, strands: [] },
    ];
    expect(overallFromBands(scores).level).toBe('A2');
  });
});

describe('nextLevelRequirement', () => {
  it('points an unassessed learner at their first level', () => {
    const { nextLevel, requirement } = nextLevelRequirement(null, analyzeBands([]));
    expect(nextLevel).toBe('A1');
    expect(requirement).toContain('A1');
  });

  it('asks for more exposure when the next band is barely started', () => {
    const bands = analyzeBands([...vocab('A1', 50, 50), ...vocab('A2', 5, 5)]);
    const { nextLevel, requirement } = nextLevelRequirement('A1', bands);
    expect(nextLevel).toBe('A2');
    expect(requirement).toContain('15 more A2');
  });

  it('quantifies the retention gap when the next band is underway', () => {
    // 50 mature, 20 retained; mastery needs ceil(50 * 0.8) = 40 → 20 more.
    const bands = analyzeBands([...vocab('A1', 50, 50), ...vocab('A2', 50, 20)]);
    const { requirement } = nextLevelRequirement('A1', bands);
    expect(requirement).toContain('20 more A2');
    expect(requirement).toContain('20/50');
  });

  it('asks for time, not for more new words, when the next band has not settled', () => {
    // 40 A2 words met and only 4 old enough to count. Telling this learner to
    // review more A2 words would be false — they have done that; what is
    // missing is time on the ones they hold.
    const bands = analyzeBands([...vocab('A1', 50, 50), ...vocab('A2', 4, 4), ...newVocab('A2', 36)]);
    const { nextLevel, requirement } = nextLevelRequirement('A1', bands);
    expect(nextLevel).toBe('A2');
    expect(requirement).toContain('long-term intervals');
    expect(requirement).toContain(`4/${MIN_MATURE_ITEMS_PER_BAND}`);
  });

  it('returns no requirement at the top of the ladder', () => {
    expect(nextLevelRequirement('C2', analyzeBands([]))).toEqual({
      nextLevel: null,
      requirement: null,
      steps: [],
    });
  });
});

describe('buildProficiencyReport', () => {
  it('withholds a level entirely for a brand-new account', () => {
    const report = buildProficiencyReport(emptyEvidence(), NOW);
    expect(report.overallLevel).toBeNull();
    expect(report.confidence).toBe('none');
    expect(report.generatedAt).toBe(NOW.toISOString());
  });

  it('withholds the level when evidence exists but confidence is none', () => {
    const report = buildProficiencyReport(
      { ...emptyEvidence(), vocabulary: vocab('A1', 50, 50), totalReviews: 10, activeDays: 1 },
      NOW
    );
    // Vocabulary itself is assessable...
    expect(report.skills.find((s) => s.skill === 'vocabulary')?.level).toBe('A1');
    // ...but the report refuses to publish an overall level on one day's work.
    expect(report.overallLevel).toBeNull();
  });

  it('reports an overall level once every strand and confidence are present', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        vocabulary: [...vocab('A1', 60, 55), ...vocab('A2', 60, 50)],
        ...fullStrands('A2'),
        totalReviews: 400,
        activeDays: 25,
      },
      NOW
    );
    expect(report.confidence).toBe('medium');
    expect(report.overallLevel).toBe('A2');
    expect(report.nextLevel).toBe('B1');
  });

  it('withholds the level and names the untouched strands when only vocabulary is measured', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        vocabulary: [...vocab('A1', 60, 55), ...vocab('A2', 60, 50)],
        totalReviews: 400,
        activeDays: 25,
      },
      NOW
    );
    expect(report.skills.find((s) => s.skill === 'vocabulary')?.level).toBe('A2');
    expect(report.overallLevel).toBeNull();
    expect(report.unevidencedSkills).toEqual([
      'interaction',
      'reading',
      'writing',
      'listening',
      'speaking',
    ]);
    // The first level such a learner can earn is A1, and the steps say what
    // A1 still needs in each strand — vocabulary is already past it.
    expect(report.nextLevel).toBe('A1');
    expect(report.nextLevelSteps.some((line) => line.startsWith('Reading:'))).toBe(true);
    expect(report.nextLevelSteps.some((line) => line.startsWith('Listening:'))).toBe(true);
    expect(report.nextLevelSteps.some((line) => line.includes('vocabulary'))).toBe(false);
  });

  it('assesses listening from graded exercises and never from minutes', () => {
    const measured = buildProficiencyReport(
      {
        ...emptyEvidence(),
        listening: [...listen('A1', MIN_LISTENING_ITEMS, MIN_LISTENING_ITEMS), ...listen('A2', MIN_LISTENING_ITEMS, 8)],
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    const listening = measured.skills.find((s) => s.skill === 'listening');
    expect(listening?.status).toBe('assessed');
    expect(listening?.level).toBe('A2');
    expect(listening?.detail).toContain('8 of 10 A2');

    const belowRate = buildProficiencyReport(
      {
        ...emptyEvidence(),
        listening: listen('A1', MIN_LISTENING_ITEMS, Math.ceil(MIN_LISTENING_ITEMS * LISTENING_PASS_RATE) - 1),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(belowRate.skills.find((s) => s.skill === 'listening')?.status).toBe('insufficient_data');
  });

  it('names the confidence gate as the last step when it alone withholds the level', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        vocabulary: vocab('A1', 60, 55),
        ...fullStrands('A1'),
        totalReviews: CONFIDENCE_TIERS.low.reviews - 5,
        activeDays: 1,
      },
      NOW
    );
    expect(report.overallLevel).toBeNull();
    const last = report.nextLevelSteps[report.nextLevelSteps.length - 1];
    expect(last).toContain('5 more logged reviews');
    expect(last).toContain('2 more active days');
  });

  it('never turns practice minutes alone into an assessed speaking or listening level', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        vocabulary: vocab('A1', 60, 55),
        listeningMinutes: 500,
        speakingMinutes: 500,
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    const speaking = report.skills.find((s) => s.skill === 'speaking');
    const listening = report.skills.find((s) => s.skill === 'listening');
    expect(speaking?.status).toBe('not_assessed');
    expect(speaking?.level).toBeNull();
    expect(listening?.status).toBe('not_assessed');
    expect(listening?.level).toBeNull();
  });

  it('assesses reading only from pieces that had comprehension questions', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        reading: [
          ...Array.from({ length: MIN_READING_ITEMS }, () => ({
            cefrLevel: 'B1',
            comprehension: null,
            completed: true,
          })),
        ],
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(report.skills.find((s) => s.skill === 'reading')?.status).toBe('insufficient_data');
  });

  // Rewritten. This test used to pass MIN_READING_ITEMS B1 texts and nothing
  // else, and expect "Reading: B1" — it encoded the missing contiguity rule as
  // if it were the contract. Three B1 texts read by someone with no A1 or A2
  // evidence is not a B1 reader; the vocabulary path has always said so, and
  // this is the same policy, so the evidence now has to run from A1 up.
  it('assesses reading when enough pieces clear the bar at every band up to it', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        reading: [
          ...reading('A1', MIN_READING_ITEMS),
          ...reading('A2', MIN_READING_ITEMS),
          ...reading('B1', MIN_READING_ITEMS),
        ],
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    const assessed = report.skills.find((s) => s.skill === 'reading');
    expect(assessed?.status).toBe('assessed');
    expect(assessed?.level).toBe('B1');
  });

  it('does not report a reading level that skips a band', () => {
    // Three C1 articles, which the library will serve to any curious learner,
    // used to print "Reading: C1" on the profile screen — and, being the only
    // assessed skill, made the entire report C1.
    const report = buildProficiencyReport(
      { ...emptyEvidence(), reading: reading('C1', 3), totalReviews: 600, activeDays: 40 },
      NOW
    );
    expect(report.skills.find((s) => s.skill === 'reading')?.status).toBe('insufficient_data');
    expect(report.skills.find((s) => s.skill === 'reading')?.level).toBeNull();
    expect(report.overallLevel).toBeNull();
  });

  it('stops the reading walk at the first band without enough evidence', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        reading: [
          ...reading('A1', MIN_READING_ITEMS),
          ...reading('A2', MIN_READING_ITEMS - 1), // one short
          ...reading('B1', MIN_READING_ITEMS + 5),
        ],
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(report.skills.find((s) => s.skill === 'reading')?.level).toBe('A1');
  });

  it('does not report a writing level that skips a band', () => {
    const report = buildProficiencyReport(
      { ...emptyEvidence(), writing: writing('B2', 5), totalReviews: 600, activeDays: 40 },
      NOW
    );
    expect(report.skills.find((s) => s.skill === 'writing')?.status).toBe('insufficient_data');
    expect(report.skills.find((s) => s.skill === 'writing')?.level).toBeNull();
  });

  it('assesses writing contiguously from A1 up', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        writing: [
          ...writing('A1', MIN_WRITING_ITEMS),
          ...writing('A2', MIN_WRITING_ITEMS),
          // B1 graded below the pass score: the walk stops here.
          ...Array.from({ length: MIN_WRITING_ITEMS }, () => ({
            cefrLevel: 'B1',
            overallScore: 0.4,
            wordCount: 120,
          })),
          ...writing('B2', MIN_WRITING_ITEMS),
        ],
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    const assessed = report.skills.find((s) => s.skill === 'writing');
    expect(assessed?.level).toBe('A2');
    expect(assessed?.detail).toContain('A2');
  });

  it('ignores ungraded writing submissions', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        writing: Array.from({ length: MIN_WRITING_ITEMS + 2 }, () => ({
          cefrLevel: 'B1',
          overallScore: null,
          wordCount: 120,
        })),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(report.skills.find((s) => s.skill === 'writing')?.status).toBe('insufficient_data');
  });

  // Reading's evidence was widened. It was three B2 texts and nothing else,
  // which now (correctly) assesses as insufficient — leaving the test passing
  // for the wrong reason, since there would no longer be a strong skill to do
  // the masking. Reading now genuinely earns B2, band by band, so the floor
  // rule is what the assertion actually exercises.
  it('lets a strong strand carry a band a weak one would once have vetoed', () => {
    // The compensatory property, stated plainly so nobody has to discover it.
    // Vocabulary reaches A1 only; every other strand reaches B2. Under the old
    // all-strands floor this report was A1. It is B2 now, because vocabulary is
    // 0.12 of the score and the remaining 0.88 is at full strength.
    //
    // This is the cost of the weighted rule and it is deliberate — but it is
    // only defensible because `BAND_THRESHOLD` exceeds every single weight, so
    // no ONE strand can do this on its own. See the scoreBand suite.
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        vocabulary: vocab('A1', 60, 55),
        ...fullStrands('B2'),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(report.skills.find((s) => s.skill === 'reading')?.level).toBe('B2');
    expect(report.overallLevel).toBe('B2');
    // The weak strand still costs its weight — the band is held, not maxed.
    const b2 = report.bandScores.find((b) => b.band === 'B2')!;
    expect(b2.score).toBeLessThan(1);
    expect(b2.score).toBeGreaterThanOrEqual(BAND_THRESHOLD);
  });

  it('never lowers the overall level because the learner started new material', () => {
    // End to end, on the audit's worked example: a B1 learner opens a new deck.
    const settled = [...vocab('A1', 40, 40), ...vocab('A2', 40, 40), ...vocab('B1', 40, 34)];
    const base = { ...emptyEvidence(), ...fullStrands('B1'), totalReviews: 600, activeDays: 40 };

    const before = buildProficiencyReport({ ...base, vocabulary: settled }, NOW);
    const after = buildProficiencyReport(
      { ...base, vocabulary: [...settled, ...newVocab('B1', 20)] },
      NOW
    );

    expect(before.overallLevel).toBe('B1');
    expect(after.overallLevel).toBe('B1');
    expect(after.nextLevel).toBe(before.nextLevel);
    expect(after.nextLevelRequirement).toBe(before.nextLevelRequirement);
  });

  it('reports speaking as not_assessed when no attempt has ever been scored', () => {
    const report = buildProficiencyReport(
      { ...emptyEvidence(), speakingMinutes: 90, totalReviews: 600, activeDays: 40 },
      NOW
    );
    const speaking = report.skills.find((s) => s.skill === 'speaking');
    expect(speaking?.status).toBe('not_assessed');
    expect(speaking?.level).toBeNull();
    expect(speaking?.evidenceCount).toBe(0);
  });

  it('reports speaking as insufficient_data below the minimum attempt count', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        speaking: speak('A2', MIN_SPEAKING_ITEMS - 1, 0.95),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    const speaking = report.skills.find((s) => s.skill === 'speaking');
    // Measured, but not yet enough to judge — distinct from never measured.
    expect(speaking?.status).toBe('insufficient_data');
    expect(speaking?.level).toBeNull();
    expect(speaking?.evidenceCount).toBe(MIN_SPEAKING_ITEMS - 1);
  });

  it('assesses speaking once enough attempts average above the pass score', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        speaking: [
          ...speak('A1', MIN_SPEAKING_ITEMS, 0.85),
          ...speak('A2', MIN_SPEAKING_ITEMS, 0.85),
          ...speak('B1', MIN_SPEAKING_ITEMS, 0.85),
        ],
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    const speaking = report.skills.find((s) => s.skill === 'speaking');
    expect(speaking?.status).toBe('assessed');
    expect(speaking?.level).toBe('B1');
  });

  it('does not report a speaking level that skips a band', () => {
    // Ten strong C1 attempts and nothing below. Reading and writing both refuse
    // to grant a rung they have not been shown; speaking is held to the same bar.
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        speaking: speak('C1', MIN_SPEAKING_ITEMS, 0.95),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    const speaking = report.skills.find((s) => s.skill === 'speaking');
    expect(speaking?.status).toBe('insufficient_data');
    expect(speaking?.level).toBeNull();
  });

  it('averages failures in — cherry-picked good attempts do not carry a band', () => {
    const half = MIN_SPEAKING_ITEMS;
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        // Mean is 0.5, below the pass score, despite ten attempts at 95%.
        speaking: [...speak('B1', half, 0.95), ...speak('B1', half, 0.05)],
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(SPEAKING_PASS_SCORE).toBeGreaterThan(0.5);
    expect(report.skills.find((s) => s.skill === 'speaking')?.status).toBe('insufficient_data');
  });

  it('ignores untagged attempts when picking a speaking level', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        speaking: speak(null, MIN_SPEAKING_ITEMS * 3, 1),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    const speaking = report.skills.find((s) => s.skill === 'speaking');
    expect(speaking?.status).toBe('insufficient_data');
    expect(speaking?.level).toBeNull();
  });

  it('lets a missing strand lower the band score without vetoing the level', () => {
    // Reading has to earn B2 rung by rung: `highestContiguousBand` stops the
    // walk at the first band with no evidence, so B2 texts alone assess as
    // insufficient and there would be no strong skill for speaking to drag.
    const strongReading = [
      ...reading('A1', MIN_READING_ITEMS),
      ...reading('A2', MIN_READING_ITEMS),
      ...reading('B1', MIN_READING_ITEMS),
      ...reading('B2', MIN_READING_ITEMS),
    ];

    const strong = {
      ...emptyEvidence(),
      ...fullStrands('B2'),
      reading: strongReading,
      vocabulary: [...vocab('A1', 40, 40), ...vocab('A2', 40, 40), ...vocab('B1', 40, 40), ...vocab('B2', 40, 40)],
      totalReviews: 600,
      activeDays: 40,
    };
    const allStrong = buildProficiencyReport(strong, NOW);
    expect(allStrong.overallLevel).toBe('B2');

    const withSpeaking = buildProficiencyReport(
      {
        ...strong,
        speaking: [
          ...speak('A1', MIN_SPEAKING_ITEMS, 0.9),
          ...speak('A2', MIN_SPEAKING_ITEMS, 0.9),
        ],
      },
      NOW
    );
    // Speaking now reaches only A2, so B2 loses speaking's 0.08 — the score
    // falls, and with the other five strands full it still clears the bar.
    expect(withSpeaking.bandScores.find((b) => b.band === 'B2')!.score).toBeLessThan(
      allStrong.bandScores.find((b) => b.band === 'B2')!.score,
    );
    expect(withSpeaking.skills.find((s) => s.skill === 'reading')?.level).toBe('B2');
    expect(withSpeaking.skills.find((s) => s.skill === 'speaking')?.level).toBe('A2');
    expect(withSpeaking.overallLevel).toBe('B2');
  });

  it('withholds the band when enough weight is missing at once', () => {
    // The other half of the same claim: compensation has a limit. Conversation
    // and vocabulary together are 0.67, so a learner with everything EXCEPT
    // those two cannot reach 0.70 however good the rest is.
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        ...fullStrands('A1'),
        interaction: [],
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(report.bandScores.find((b) => b.band === 'A1')!.held).toBe(false);
    expect(report.overallLevel).toBeNull();
  });

  it('always returns exactly the six skill rows the UI expects', () => {
    const report = buildProficiencyReport(emptyEvidence(), NOW);
    expect(report.skills.map((s) => s.skill)).toEqual([
      'interaction',
      'vocabulary',
      'reading',
      'writing',
      'listening',
      'speaking',
    ]);
  });
});

describe('combineConversationScore', () => {
  // Mirrors combinedScore in supabase/functions/_shared/turn-accuracy.ts.
  // The two are duplicated across the edge/app boundary, so this test is also
  // the thing that catches them drifting apart.

  it('weighs being understood equally with being right', () => {
    expect(combineConversationScore(1, 0.6)).toBeCloseTo(0.8, 5);
    expect(combineConversationScore(0.6, 1)).toBeCloseTo(0.8, 5);
  });

  it('lets accuracy carry the turn when nothing was heard from the recogniser', () => {
    // A missing intelligibility is an older transcribe deployment reporting
    // nothing, not a learner who could not be understood. Discarding the turn
    // would lose real evidence.
    expect(combineConversationScore(0.9, null)).toBe(0.9);
    expect(combineConversationScore(0.9, Number.NaN)).toBe(0.9);
  });

  it('is monotonic in both inputs', () => {
    expect(combineConversationScore(0.9, 0.5)).toBeGreaterThan(combineConversationScore(0.4, 0.5));
    expect(combineConversationScore(0.5, 0.9)).toBeGreaterThan(combineConversationScore(0.5, 0.4));
  });

  it('a perfect turn is 1 and a failed one is 0', () => {
    expect(combineConversationScore(1, 1)).toBe(1);
    expect(combineConversationScore(0, 0)).toBe(0);
  });
});

describe('conversation as proficiency evidence', () => {
  // Conversation turns are their own strand now. They used to be split by
  // modality into the speaking and writing pools, which let three chat
  // messages satisfy the same band gate as three graded essays and let scored
  // read-alouds stand in for ever having held a conversation. These pin the
  // separation.

  it('feeds the interaction strand and neither speaking nor writing', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        interaction: convo('A1', MIN_INTERACTION_UNITS, MIN_INTERACTION_DAYS, 0.9),
        totalReviews: 200,
        activeDays: 12,
      },
      NOW
    );
    expect(report.skills.find((s) => s.skill === 'interaction')!.level).toBe('A1');
    // Never assessed off conversation: a scored read-aloud against a known
    // target and a graded submission are different claims.
    expect(report.skills.find((s) => s.skill === 'speaking')!.status).toBe('not_assessed');
    expect(report.skills.find((s) => s.skill === 'writing')!.status).toBe('insufficient_data');
  });

  it('needs the day spread, not just the conversations', () => {
    const crammed = buildProficiencyReport(
      {
        ...emptyEvidence(),
        interaction: convo('A1', MIN_INTERACTION_UNITS, 1, 0.95),
        totalReviews: 200,
        activeDays: 12,
      },
      NOW
    );
    expect(crammed.skills.find((s) => s.skill === 'interaction')!.status).toBe('insufficient_data');
    expect(
      crammed.nextLevelSteps.some((l) => l.startsWith('Conversation:') && l.includes('more day')),
    ).toBe(true);
  });

  it('will not reach a level on conversations below the pass score', () => {
    const weak = buildProficiencyReport(
      {
        ...emptyEvidence(),
        interaction: convo(
          'A1',
          MIN_INTERACTION_UNITS,
          MIN_INTERACTION_DAYS,
          INTERACTION_PASS_SCORE - 0.2,
        ),
        totalReviews: 200,
        activeDays: 12,
      },
      NOW
    );
    expect(weak.skills.find((s) => s.skill === 'interaction')!.status).toBe('insufficient_data');
  });

  it('leads the requirement list, because it is where the work pays', () => {
    const report = buildProficiencyReport(
      { ...emptyEvidence(), totalReviews: 200, activeDays: 12 },
      NOW
    );
    expect(report.nextLevelSteps[0].startsWith('Conversation:')).toBe(true);
  });
});

// ─── Placement ──────────────────────────────────────────────────
//
// A learner placed straight into the B1 course never meets A1 or A2 cards. The
// contiguity walk must step over the rungs their placement vouches for — while
// still refusing to publish a level made of assumed rungs, and still letting
// real evidence below the placement band overrule it.

describe('placement', () => {
  const PLACED_EVIDENCE = { totalReviews: 600, activeDays: 40 };

  describe('analyzeBands', () => {
    it('marks unjudged bands below the placement band as placed, judged ones on their evidence', () => {
      const bands = analyzeBands([...vocab('A2', 40, 10), ...vocab('B1', 40, 36)], 'B1');
      expect(bands.find((b) => b.band === 'A1')?.status).toBe('placed');
      expect(bands.find((b) => b.band === 'A2')?.status).toBe('weak');
      expect(bands.find((b) => b.band === 'B1')?.status).toBe('mastered');
      // Above the placement band nothing is assumed.
      expect(bands.find((b) => b.band === 'B2')?.status).toBe('insufficient');
    });

    it('marks nothing placed at A1 placement or with no placement', () => {
      expect(analyzeBands([], 'A1').every((b) => b.status === 'insufficient')).toBe(true);
      expect(analyzeBands([], null)).toEqual(analyzeBands([]));
    });

    it('keeps the counts of a placed band untouched', () => {
      const a1 = analyzeBands(vocab('A1', 15, 15), 'B1').find((b) => b.band === 'A1');
      expect(a1?.status).toBe('placed');
      expect(a1?.seen).toBe(15);
    });
  });

  describe('vocabularyLevel', () => {
    it('starts the walk at the placement band', () => {
      const items = vocab('B1', 40, 36);
      expect(vocabularyLevel(analyzeBands(items, 'B1'), 'B1')).toBe('B1');
      // Pin the old behaviour: without placement the same evidence is nothing.
      expect(vocabularyLevel(analyzeBands(items))).toBeNull();
    });

    it('never grants a level made only of assumed rungs', () => {
      // B1 barely started: A1 and A2 are assumed, but an assumed rung is not a level.
      expect(vocabularyLevel(analyzeBands(vocab('B1', 5, 5), 'B1'), 'B1')).toBeNull();
    });

    it('lets evidence below the placement band override it downward', () => {
      const items = [...vocab('A1', 40, 40), ...vocab('A2', 40, 10), ...vocab('B1', 40, 36)];
      expect(vocabularyLevel(analyzeBands(items, 'B1'), 'B1')).toBe('A1');
    });

    it('steps over a placed rung between two evidenced ones', () => {
      const items = [...vocab('A1', 40, 40), ...vocab('B1', 40, 36)];
      expect(vocabularyLevel(analyzeBands(items, 'B1'), 'B1')).toBe('B1');
    });
  });

  describe('nextLevelRequirement', () => {
    it('points a placed learner at their entry band, never at A1', () => {
      const bands = analyzeBands(vocab('B1', 5, 5), 'B1');
      const { nextLevel, requirement } = nextLevelRequirement(null, bands, 'B1');
      expect(nextLevel).toBe('B1');
      expect(requirement).toContain('15 more B1');
      expect(requirement).not.toContain('A1');
    });

    it('skips assumed rungs when choosing the next rung to prove', () => {
      const bands = analyzeBands(vocab('A1', 40, 40), 'B1');
      expect(nextLevelRequirement('A1', bands, 'B1').nextLevel).toBe('B1');
    });

    it('targets the rung the evidence broke on', () => {
      // A2 judged weak (40 mature, 10 retained): mastery needs 32 → 22 more.
      const bands = analyzeBands([...vocab('A2', 40, 10), ...vocab('B1', 40, 36)], 'B1');
      const { nextLevel, requirement } = nextLevelRequirement(null, bands, 'B1');
      expect(nextLevel).toBe('A2');
      expect(requirement).toContain('22 more A2');
    });
  });

  describe('buildProficiencyReport', () => {
    it('reports the entry band as measured and discloses the assumed rungs', () => {
      const report = buildProficiencyReport(
        { ...emptyEvidence(), vocabulary: vocab('B1', 40, 36), ...fullStrands('B1', 'B1'), ...PLACED_EVIDENCE },
        NOW,
        { placementBand: 'B1' },
      );
      expect(report.overallLevel).toBe('B1');
      expect(report.placementBand).toBe('B1');
      expect(report.assumedBands).toEqual(['A1', 'A2']);
      expect(report.levelBasis).toBe(
        'Measured from your B1 work; A1–A2 assumed from your placement.',
      );
      expect(report.nextLevel).toBe('B2');
      expect(report.bands.slice(0, 2).map((b) => b.status)).toEqual(['placed', 'placed']);
      expect(report.skills.find((s) => s.skill === 'vocabulary')?.detail).toContain(
        'A1–A2 assumed from your placement',
      );
    });

    it('withholds the level and points at the entry band while it is unproven', () => {
      const report = buildProficiencyReport(
        { ...emptyEvidence(), vocabulary: vocab('B1', 5, 5), ...PLACED_EVIDENCE },
        NOW,
        { placementBand: 'B1' },
      );
      expect(report.overallLevel).toBeNull();
      expect(report.levelBasis).toBeNull();
      expect(report.assumedBands).toEqual([]);
      expect(report.nextLevel).toBe('B1');
      expect(report.nextLevelRequirement).not.toContain('A1');
    });

    it('lets weak evidence below the placement band cost score without pinning the level', () => {
      // Under the old all-strands floor this report was A1: measured A2
      // vocabulary that FAILED outranked the placement that would otherwise
      // have assumed A2, and pinned the whole level there.
      //
      // The weighted rule keeps the first half and drops the second. A2's
      // score still loses most of vocabulary's 0.12, and `assumedBands` is
      // still empty — placement never overrides evidence, so A2 is judged on
      // what the learner actually showed. But 0.12 is no longer enough to
      // withhold a band the other five strands hold outright.
      const report = buildProficiencyReport(
        {
          ...emptyEvidence(),
          vocabulary: [...vocab('A1', 40, 40), ...vocab('A2', 40, 10), ...vocab('B1', 40, 36)],
          ...fullStrands('B1', 'B1'),
          ...PLACED_EVIDENCE,
        },
        NOW,
        { placementBand: 'B1' },
      );
      // Vocabulary is judged on its evidence and fails at A2, so placement
      // never assumes A2 *for vocabulary* — that half of the old rule stands.
      expect(report.skills.find((s) => s.skill === 'vocabulary')?.level).toBe('A1');
      expect(report.overallLevel).toBe('B1');

      // The other four strands did reach B1 by assuming A1–A2 from placement,
      // so the level genuinely rests partly on rungs nobody measured and the
      // report says so. Disclosure is per-strand, not per-report: one strand
      // measuring a rung does not make the rungs the others assumed measured.
      expect(report.assumedBands).toEqual(['A1', 'A2']);
      expect(report.levelBasis).toBe(
        'Measured from your B1 work; A1–A2 assumed from your placement.',
      );

      const a2 = report.bandScores.find((b) => b.band === 'A2')!;
      expect(a2.strands.find((s) => s.skill === 'vocabulary')!.gate).toBeLessThan(1);
      expect(a2.held).toBe(true);
    });

    it('applies the same rule to reading, writing and speaking', () => {
      const report = buildProficiencyReport(
        {
          ...emptyEvidence(),
          reading: reading('B1', MIN_READING_ITEMS),
          ...PLACED_EVIDENCE,
        },
        NOW,
        { placementBand: 'B1' },
      );
      const readingSkill = report.skills.find((s) => s.skill === 'reading');
      expect(readingSkill?.level).toBe('B1');
      expect(readingSkill?.assumedBands).toEqual(['A1', 'A2']);
      expect(readingSkill?.detail).toContain('assumed from your placement');
      expect(report.skills.find((s) => s.skill === 'writing')?.detail).toContain('from B1 up');
      expect(report.skills.find((s) => s.skill === 'speaking')?.status).toBe('not_assessed');
    });

    it('reproduces the pre-placement report field for field when placement is null', () => {
      const evidence: ProficiencyEvidence = {
        ...emptyEvidence(),
        vocabulary: [...vocab('A1', 60, 55), ...vocab('A2', 60, 50)],
        totalReviews: 400,
        activeDays: 25,
      };
      const before = buildProficiencyReport(evidence, NOW);
      const after = buildProficiencyReport(evidence, NOW, { placementBand: null });
      expect(after).toEqual(before);
      expect(before.placementBand).toBeNull();
      expect(before.assumedBands).toEqual([]);
      expect(before.levelBasis).toBeNull();
    });

    it('does not let new entry-band material lower a placed learner’s level', () => {
      const settled = buildProficiencyReport(
        { ...emptyEvidence(), vocabulary: vocab('B1', 40, 34), ...fullStrands('B1', 'B1'), ...PLACED_EVIDENCE },
        NOW,
        { placementBand: 'B1' },
      );
      const studying = buildProficiencyReport(
        {
          ...emptyEvidence(),
          vocabulary: [...vocab('B1', 40, 34), ...newVocab('B1', 20)],
          ...fullStrands('B1', 'B1'),
          ...PLACED_EVIDENCE,
        },
        NOW,
        { placementBand: 'B1' },
      );
      expect(settled.overallLevel).toBe('B1');
      expect(studying.overallLevel).toBe('B1');
      expect(studying.nextLevelRequirement).toBe(settled.nextLevelRequirement);
    });
  });
});


describe('writing strand: orthography strengthens but never carries', () => {
  const prose = (n: number, score: number) =>
    Array.from({ length: n }, () => ({ cefrLevel: 'A2', overallScore: score, wordCount: 60 }));
  const taps = (n: number, correct: boolean) =>
    Array.from({ length: n }, () => ({ cefrLevel: 'A2', correct }));
  const a2 = (s: ReturnType<typeof writingStrand>) => s.bands.find((b) => b.band === 'A2')!;

  it('counts nothing in a band with no graded prose', () => {
    // Twenty correct taps and not one sentence written. The whole point of the
    // cap: floor(0 * ratio) is 0, so the band stays unevidenced.
    const strand = writingStrand([], taps(20, true));
    expect(a2(strand).total).toBe(0);
  });

  it('counts at most half the band\'s submissions', () => {
    const strand = writingStrand(prose(6, 0.8), taps(20, true));
    // 6 submissions admit 3 taps, so 9 items, not 26.
    expect(a2(strand).total).toBe(6 + Math.floor(6 * ORTHOGRAPHY_TO_PROSE_RATIO));
  });

  it('raises the mean when the taps are right', () => {
    const without = a2(writingStrand(prose(6, 0.8))).mean;
    const with_ = a2(writingStrand(prose(6, 0.8), taps(3, true))).mean;
    expect(with_).toBeGreaterThan(without);
  });

  it('lowers it when they are wrong', () => {
    const without = a2(writingStrand(prose(6, 0.8))).mean;
    const with_ = a2(writingStrand(prose(6, 0.8), taps(3, false))).mean;
    expect(with_).toBeLessThan(without);
  });

  it('is unchanged when no orthography is passed at all', () => {
    expect(writingStrand(prose(4, 0.75))).toEqual(writingStrand(prose(4, 0.75), []));
  });

  it('ignores an item with no band, as every other strand does', () => {
    const strand = writingStrand(prose(4, 0.8), [{ cefrLevel: null, correct: true }]);
    expect(a2(strand).total).toBe(4);
  });

  it('caps each band against its own prose, not against the total', () => {
    const strand = writingStrand(
      [...prose(4, 0.8), { cefrLevel: 'B1', overallScore: 0.8, wordCount: 60 }],
      [...taps(10, true), { cefrLevel: 'B1', correct: true }],
    );
    // A2 has 4 submissions so admits 2; B1 has 1, so floor(0.5) is 0.
    expect(a2(strand).total).toBe(6);
    expect(strand.bands.find((b) => b.band === 'B1')!.total).toBe(1);
  });
});

describe('a level test filling the gap', () => {
  it('publishes the tested band when practice has measured nothing', () => {
    // The dead end this exists to close: MIN_INTERACTION_DAYS plus the
    // confidence gate meant a fortnight of "Not yet assessed" no matter what.
    const report = buildProficiencyReport(emptyEvidence(), NOW, { checkpointBand: 'B1' });
    expect(report.practiceLevel).toBeNull();
    expect(report.overallLevel).toBe('B1');
    expect(report.testedLevel).toBe('B1');
    expect(report.levelSource).toBe('test');
  });

  it('discloses that the level came from the test, not from practice', () => {
    const report = buildProficiencyReport(emptyEvidence(), NOW, { checkpointBand: 'B1' });
    expect(report.levelBasis).toContain('level test');
    expect(report.levelBasis).toContain('has not measured a level yet');
  });

  it('never displaces a practice level, even with a higher tested band', () => {
    // Not "the higher of the two" and not "the newer of the two": either would
    // let a learner choose their band by testing on a good day.
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        vocabulary: [...vocab('A1', 60, 55), ...vocab('A2', 60, 50)],
        ...fullStrands('A2'),
        totalReviews: 400,
        activeDays: 25,
      },
      NOW,
      { checkpointBand: 'C2' },
    );
    expect(report.practiceLevel).toBe('A2');
    expect(report.overallLevel).toBe('A2');
    expect(report.levelSource).toBe('practice');
    // Still exposed, so the report can show the two side by side.
    expect(report.testedLevel).toBe('C2');
  });

  it('never lowers a practice level with a worse tested band either', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        vocabulary: [...vocab('A1', 60, 55), ...vocab('A2', 60, 50)],
        ...fullStrands('A2'),
        totalReviews: 400,
        activeDays: 25,
      },
      NOW,
      { checkpointBand: 'A1' },
    );
    expect(report.overallLevel).toBe('A2');
  });

  it('keeps the next step a fact about practice, not about the tested band', () => {
    // A test-published B1 has proved no rung of the strand model, so asking for
    // B2 evidence would be asking for work on a band with nothing beneath it.
    const report = buildProficiencyReport(emptyEvidence(), NOW, { checkpointBand: 'B1' });
    expect(report.overallLevel).toBe('B1');
    expect(report.nextLevel).toBe('A1');
    expect(report.nextLevelSteps.length).toBeGreaterThan(0);
  });

  it('is unchanged from before when no test has been taken', () => {
    const withOption = buildProficiencyReport(emptyEvidence(), NOW, { checkpointBand: null });
    const without = buildProficiencyReport(emptyEvidence(), NOW);
    expect(withOption.overallLevel).toBeNull();
    expect(withOption.levelSource).toBeNull();
    expect(without.levelSource).toBeNull();
  });
});
