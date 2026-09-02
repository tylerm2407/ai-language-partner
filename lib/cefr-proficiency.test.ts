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
  normalizeBand,
  nextLevelRequirement,
  overallFromSkills,
  vocabularyLevel,
  MIN_ITEMS_PER_BAND,
  MIN_MATURE_ITEMS_PER_BAND,
  MIN_READING_ITEMS,
  MIN_SPEAKING_ITEMS,
  MIN_WRITING_ITEMS,
  SPEAKING_PASS_SCORE,
  type ProficiencyEvidence,
  type ReadingEvidenceItem,
  type SkillAssessment,
  type SpeakingEvidenceItem,
  type VocabEvidenceItem,
  type WritingEvidenceItem,
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

function emptyEvidence(): ProficiencyEvidence {
  return {
    vocabulary: [],
    reading: [],
    writing: [],
    speaking: [],
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

describe('overallFromSkills', () => {
  const skill = (
    name: SkillAssessment['skill'],
    level: SkillAssessment['level'],
    status: SkillAssessment['status']
  ): SkillAssessment => ({ skill: name, level, status, detail: '', evidenceCount: 0 });

  it('returns null when no skill is assessed', () => {
    expect(
      overallFromSkills([
        skill('vocabulary', null, 'insufficient_data'),
        skill('speaking', null, 'not_assessed'),
      ])
    ).toBeNull();
  });

  it('takes the floor, not the ceiling — B2 reading with A2 writing is A2', () => {
    expect(
      overallFromSkills([
        skill('reading', 'B2', 'assessed'),
        skill('writing', 'A2', 'assessed'),
      ])
    ).toBe('A2');
  });

  it('ignores unassessed skills instead of treating them as zero', () => {
    expect(
      overallFromSkills([
        skill('vocabulary', 'B1', 'assessed'),
        skill('speaking', null, 'not_assessed'),
      ])
    ).toBe('B1');
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

  it('reports an overall level once evidence and confidence are both present', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        vocabulary: [...vocab('A1', 60, 55), ...vocab('A2', 60, 50)],
        totalReviews: 400,
        activeDays: 25,
      },
      NOW
    );
    expect(report.confidence).toBe('medium');
    expect(report.overallLevel).toBe('A2');
    expect(report.nextLevel).toBe('B1');
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
  it('does not let a strong skill mask a weak one in the overall level', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        // Vocabulary reaches A1 only; reading reaches B2.
        vocabulary: vocab('A1', 60, 55),
        reading: [
          ...reading('A1', MIN_READING_ITEMS),
          ...reading('A2', MIN_READING_ITEMS),
          ...reading('B1', MIN_READING_ITEMS),
          ...reading('B2', MIN_READING_ITEMS),
        ],
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(report.skills.find((s) => s.skill === 'reading')?.level).toBe('B2');
    expect(report.overallLevel).toBe('A1');
  });

  it('never lowers the overall level because the learner started new material', () => {
    // End to end, on the audit's worked example: a B1 learner opens a new deck.
    const settled = [...vocab('A1', 40, 40), ...vocab('A2', 40, 40), ...vocab('B1', 40, 34)];
    const base = { ...emptyEvidence(), totalReviews: 600, activeDays: 40 };

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

  it('lets weak speaking drag the overall level down', () => {
    // Reading has to earn B2 rung by rung: `highestContiguousBand` stops the
    // walk at the first band with no evidence, so B2 texts alone assess as
    // insufficient and there would be no strong skill for speaking to drag.
    const strongReading = [
      ...reading('A1', MIN_READING_ITEMS),
      ...reading('A2', MIN_READING_ITEMS),
      ...reading('B1', MIN_READING_ITEMS),
      ...reading('B2', MIN_READING_ITEMS),
    ];

    const withoutSpeaking = buildProficiencyReport(
      { ...emptyEvidence(), reading: strongReading, totalReviews: 600, activeDays: 40 },
      NOW
    );
    expect(withoutSpeaking.overallLevel).toBe('B2');

    const withSpeaking = buildProficiencyReport(
      {
        ...emptyEvidence(),
        reading: strongReading,
        speaking: [
          ...speak('A1', MIN_SPEAKING_ITEMS, 0.9),
          ...speak('A2', MIN_SPEAKING_ITEMS, 0.9),
        ],
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    // Reading is unchanged at B2; the floor across skills is now speaking's A2.
    expect(withSpeaking.skills.find((s) => s.skill === 'reading')?.level).toBe('B2');
    expect(withSpeaking.overallLevel).toBe('A2');
  });

  it('always returns exactly the five skill rows the UI expects', () => {
    const report = buildProficiencyReport(emptyEvidence(), NOW);
    expect(report.skills.map((s) => s.skill)).toEqual([
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
  // Conversation turns arrive already shaped as SpeakingEvidenceItem /
  // WritingEvidenceItem, so they flow through the existing assessments. These
  // pin the two properties that matter: a conversation CAN move a level, and
  // typed turns cannot move the *speaking* one.

  const conversationTurns = (band: string, count: number, score: number): SpeakingEvidenceItem[] =>
    Array.from({ length: count }, () => ({ cefrLevel: band, score }));

  it('spoken turns alone can evidence a speaking level', () => {
    const evidence: ProficiencyEvidence = {
      vocabulary: [],
      reading: [],
      writing: [],
      speaking: [
        ...conversationTurns('A1', MIN_SPEAKING_ITEMS, 0.85),
        ...conversationTurns('A2', MIN_SPEAKING_ITEMS, 0.8),
      ],
      listeningMinutes: 0,
      speakingMinutes: 30,
      activeDays: 12,
      totalReviews: 200,
    };
    const report = buildProficiencyReport(evidence, NOW);
    const speaking = report.skills.find((s) => s.skill === 'speaking')!;
    expect(speaking.status).toBe('assessed');
    expect(speaking.level).toBe('A2');
  });

  it('turns below the pass mark do not grant a level', () => {
    const evidence: ProficiencyEvidence = {
      vocabulary: [],
      reading: [],
      writing: [],
      speaking: conversationTurns('A1', MIN_SPEAKING_ITEMS, SPEAKING_PASS_SCORE - 0.05),
      listeningMinutes: 0,
      speakingMinutes: 30,
      activeDays: 12,
      totalReviews: 200,
    };
    const report = buildProficiencyReport(evidence, NOW);
    expect(report.skills.find((s) => s.skill === 'speaking')!.level).toBeNull();
  });

  it('typed turns are writing evidence and never touch speaking', () => {
    const typed: WritingEvidenceItem[] = Array.from({ length: MIN_WRITING_ITEMS }, () => ({
      cefrLevel: 'A1',
      overallScore: 0.9,
      wordCount: 20,
    }));
    const evidence: ProficiencyEvidence = {
      vocabulary: [],
      reading: [],
      writing: typed,
      speaking: [],
      listeningMinutes: 0,
      speakingMinutes: 0,
      activeDays: 12,
      totalReviews: 200,
    };
    const report = buildProficiencyReport(evidence, NOW);
    expect(report.skills.find((s) => s.skill === 'writing')!.level).toBe('A1');
    // Never "assessed" off typing — a keyboard and time to think is not speech.
    expect(report.skills.find((s) => s.skill === 'speaking')!.status).toBe('not_assessed');
  });
});
