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
  isRetained,
  normalizeBand,
  nextLevelRequirement,
  overallFromSkills,
  vocabularyLevel,
  MIN_ITEMS_PER_BAND,
  MIN_READING_ITEMS,
  MIN_WRITING_ITEMS,
  type ProficiencyEvidence,
  type SkillAssessment,
  type VocabEvidenceItem,
} from './cefr-proficiency';

const NOW = new Date('2026-08-05T12:00:00.000Z');

/** Build `count` vocab items in a band, the first `retained` of them graduated. */
function vocab(band: string, count: number, retained: number): VocabEvidenceItem[] {
  return Array.from({ length: count }, (_, i) => ({
    cefrLevel: band,
    status: i < retained ? ('graduated' as const) : ('learning' as const),
    repetitions: i < retained ? 5 : 1,
    interval: i < retained ? 30 : 1,
  }));
}

function emptyEvidence(): ProficiencyEvidence {
  return {
    vocabulary: [],
    reading: [],
    writing: [],
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
    // 50 seen, 20 retained; mastery needs ceil(50 * 0.8) = 40 → 20 more.
    const bands = analyzeBands([...vocab('A1', 50, 50), ...vocab('A2', 50, 20)]);
    const { requirement } = nextLevelRequirement('A1', bands);
    expect(requirement).toContain('20 more A2');
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

  it('never reports speaking or listening as an assessed level', () => {
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

  it('assesses reading when enough pieces clear the comprehension bar', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        reading: Array.from({ length: MIN_READING_ITEMS }, () => ({
          cefrLevel: 'B1',
          comprehension: 0.9,
          completed: true,
        })),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    const reading = report.skills.find((s) => s.skill === 'reading');
    expect(reading?.status).toBe('assessed');
    expect(reading?.level).toBe('B1');
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

  it('does not let a strong skill mask a weak one in the overall level', () => {
    const report = buildProficiencyReport(
      {
        ...emptyEvidence(),
        // Vocabulary reaches A1 only; reading reaches B2.
        vocabulary: vocab('A1', 60, 55),
        reading: Array.from({ length: MIN_READING_ITEMS }, () => ({
          cefrLevel: 'B2',
          comprehension: 0.95,
          completed: true,
        })),
        totalReviews: 600,
        activeDays: 40,
      },
      NOW
    );
    expect(report.overallLevel).toBe('A1');
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
