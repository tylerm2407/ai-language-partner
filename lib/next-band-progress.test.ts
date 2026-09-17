import {
  LISTENING_PASS_RATE,
  MASTERY_RATE,
  MIN_ITEMS_PER_BAND,
  MIN_LISTENING_ITEMS,
  MIN_MATURE_ITEMS_PER_BAND,
  MIN_READING_ITEMS,
  MIN_SPEAKING_ITEMS,
  MIN_WRITING_ITEMS,
  BAND_THRESHOLD,
  STRAND_WEIGHTS,
  MIN_INTERACTION_UNITS,
  MIN_INTERACTION_DAYS,
  INTERACTION_PASS_SCORE,
  SCORED_SKILLS,
  SPEAKING_PASS_SCORE,
  WRITING_PASS_SCORE,
  type BandBreakdown,
  type CefrBand,
  type SkillAssessment,
  type SkillKey,
  type StrandBandStats,
  type StrandBreakdown,
  buildProficiencyReport,
  type ProficiencyEvidence,
  type ProficiencyReport,
} from './cefr-proficiency';
import {
  nextBandAfter,
  nextBandProgress,
  progressToward,
  ringForReport,
  ringIsMeasured,
  type RingEvidence,
} from './next-band-progress';

function band(partial: Partial<BandBreakdown> & { band: CefrBand }): BandBreakdown {
  return { seen: 0, mature: 0, retained: 0, retentionRate: 0, status: 'insufficient', ...partial };
}

function strand(skill: StrandBreakdown['skill'], at?: Partial<StrandBandStats> & { band: CefrBand }): StrandBreakdown {
  return {
    skill,
    bands: at ? [{ total: 0, passed: 0, mean: 0, ...at }] : [],
  };
}

function assessed(skill: SkillKey, level: CefrBand): SkillAssessment {
  return { skill, level, status: 'assessed', detail: '', evidenceCount: 0, assumedBands: [] };
}

function evidence(partial: Partial<RingEvidence> = {}): RingEvidence {
  return { bands: [], strands: [], skills: [], ...partial };
}

describe('nextBandAfter', () => {
  it('walks the ladder and stops at C2', () => {
    expect(nextBandAfter('A1')).toBe('A2');
    expect(nextBandAfter('B2')).toBe('C1');
    expect(nextBandAfter('C2')).toBeNull();
  });
});

describe('nextBandProgress', () => {
  it('is 0 when the next band has never been touched', () => {
    const p = nextBandProgress('A2', evidence());
    expect(p).toMatchObject({ current: 'A2', next: 'B1', fraction: 0, percent: 0 });
    expect(p.strands.map((s) => s.skill)).toEqual(SCORED_SKILLS);
    expect(p.strands.every((s) => s.fraction === 0 && !s.met)).toBe(true);
  });

  it('is full only at the top band', () => {
    expect(nextBandProgress('C2', evidence())).toEqual({
      current: 'C2',
      next: null,
      fraction: 1,
      percent: 100,
      score: 1,
      strands: [],
    });
  });

  it('gives each strand its weight, not an equal share', () => {
    // Every vocabulary gate met, nothing else. Vocabulary is 0.12 of the band
    // score and the ring is scaled by BAND_THRESHOLD, so this is 0.12/0.70 —
    // not the fifth it would have been under the equal-weight ring.
    const mature = MIN_MATURE_ITEMS_PER_BAND;
    const vocabOnly = nextBandProgress(
      'A2',
      evidence({ bands: [band({ band: 'B1', seen: MIN_ITEMS_PER_BAND, mature, retained: Math.ceil(mature * MASTERY_RATE) })] }),
    );
    const vocab = vocabOnly.strands.find((s) => s.skill === 'vocabulary')!;
    expect(vocab.fraction).toBe(1);
    expect(vocab.weight).toBe(STRAND_WEIGHTS.vocabulary);
    expect(vocab.contribution).toBeCloseTo(STRAND_WEIGHTS.vocabulary, 10);
    expect(vocabOnly.score).toBeCloseTo(STRAND_WEIGHTS.vocabulary, 10);
    expect(vocabOnly.percent).toBe(
      Math.floor((STRAND_WEIGHTS.vocabulary / BAND_THRESHOLD) * 100),
    );
  });

  it('moves most for conversation, which is most of the score', () => {
    // The point of the reweighting, asserted directly: a full interaction
    // strand fills far more of the ring than a full vocabulary one.
    const talk = nextBandProgress(
      'A2',
      evidence({
        strands: [
          strand('interaction', {
            band: 'B1',
            total: MIN_INTERACTION_UNITS,
            passed: MIN_INTERACTION_UNITS,
            mean: INTERACTION_PASS_SCORE,
            days: MIN_INTERACTION_DAYS,
          }),
        ],
      }),
    );
    expect(talk.strands.find((s) => s.skill === 'interaction')?.fraction).toBe(1);
    expect(talk.score).toBeCloseTo(STRAND_WEIGHTS.interaction, 10);
    // Still short of the band on its own — the threshold sits above the weight.
    expect(talk.percent).toBeLessThan(100);
    expect(talk.score).toBeLessThan(BAND_THRESHOLD);
  });

  it('holds the interaction volume gate to the worse of sessions and days', () => {
    // Twelve conversations crammed into one day is not twelve days of
    // practice; taking the mean of the two would say it was three-quarters of
    // the way there.
    const crammed = nextBandProgress(
      'A2',
      evidence({
        strands: [
          strand('interaction', {
            band: 'B1',
            total: MIN_INTERACTION_UNITS,
            passed: MIN_INTERACTION_UNITS,
            mean: INTERACTION_PASS_SCORE,
            days: 1,
          }),
        ],
      }),
    );
    const at = crammed.strands.find((s) => s.skill === 'interaction')!;
    // Volume is 1/MIN_INTERACTION_DAYS, quality is full: half of each.
    expect(at.fraction).toBeCloseTo(0.5 * (1 / MIN_INTERACTION_DAYS) + 0.5, 10);
  });

  it('gives each vocabulary gate a third of the strand and caps each at full', () => {
    // Seen gate met twice over, nothing mature: a third of vocabulary's 0.12.
    const seenOnly = nextBandProgress('A2', evidence({ bands: [band({ band: 'B1', seen: MIN_ITEMS_PER_BAND * 2 })] }));
    expect(seenOnly.strands.find((s) => s.skill === 'vocabulary')?.fraction).toBeCloseTo(1 / 3);
    expect(seenOnly.percent).toBe(
      Math.floor(((STRAND_WEIGHTS.vocabulary / 3) / BAND_THRESHOLD) * 100),
    );
  });

  it('measures vocabulary retention against the mature set, as the band rule does', () => {
    const mature = MIN_MATURE_ITEMS_PER_BAND;
    const needed = Math.ceil(mature * MASTERY_RATE);
    const p = nextBandProgress(
      'A2',
      evidence({ bands: [band({ band: 'B1', seen: MIN_ITEMS_PER_BAND, mature, retained: needed })] }),
    );
    expect(p.strands.find((s) => s.skill === 'vocabulary')?.fraction).toBe(1);
  });

  it('counts reading by pieces understood, not pieces attempted', () => {
    const p = nextBandProgress(
      'A2',
      evidence({ strands: [strand('reading', { band: 'B1', total: 6, passed: 2, mean: 0.5 })] }),
    );
    expect(p.strands.find((s) => s.skill === 'reading')?.fraction).toBeCloseTo(2 / MIN_READING_ITEMS);
  });

  it('splits writing, speaking and listening between volume and quality', () => {
    const p = nextBandProgress(
      'A2',
      evidence({
        strands: [
          strand('writing', { band: 'B1', total: MIN_WRITING_ITEMS, passed: MIN_WRITING_ITEMS, mean: WRITING_PASS_SCORE / 2 }),
          strand('speaking', { band: 'B1', total: MIN_SPEAKING_ITEMS / 2, passed: MIN_SPEAKING_ITEMS / 2, mean: SPEAKING_PASS_SCORE }),
          strand('listening', { band: 'B1', total: MIN_LISTENING_ITEMS, passed: MIN_LISTENING_ITEMS, mean: LISTENING_PASS_RATE }),
        ],
      }),
    );
    const by = Object.fromEntries(p.strands.map((s) => [s.skill, s.fraction]));
    expect(by.writing).toBeCloseTo(0.75);
    expect(by.speaking).toBeCloseTo(0.75);
    expect(by.listening).toBe(1);
  });

  it('treats a strand already assessed at or above the target as complete', () => {
    const p = nextBandProgress(
      'A2',
      evidence({ skills: [assessed('reading', 'B2'), assessed('speaking', 'B1')] }),
    );
    const by = Object.fromEntries(p.strands.map((s) => [s.skill, s]));
    expect(by.reading).toMatchObject({ skill: 'reading', fraction: 1, met: true });
    expect(by.speaking.met).toBe(true);
    expect(by.vocabulary.met).toBe(false);
    expect(p.percent).toBe(
      Math.floor(((STRAND_WEIGHTS.reading + STRAND_WEIGHTS.speaking) / BAND_THRESHOLD) * 100),
    );
  });

  it('never reaches 100 while a next band exists, whatever the counts say', () => {
    const p = nextBandProgress(
      'B1',
      evidence({ skills: SCORED_SKILLS.map((skill) => assessed(skill, 'C2')) }),
    );
    expect(p.percent).toBe(99);
    expect(p.fraction).toBeLessThan(1);
  });

  it('floors rather than rounds up', () => {
    // 19 of 20 seen, nothing else: (0.95/3) × 0.12 ÷ 0.70 = 0.0542… → 5, not 6.
    const p = nextBandProgress('A1', evidence({ bands: [band({ band: 'A2', seen: MIN_ITEMS_PER_BAND - 1 })] }));
    expect(p.percent).toBe(5);
  });

  it('ignores evidence for other bands', () => {
    const p = nextBandProgress(
      'A2',
      evidence({
        bands: [band({ band: 'C1', seen: 999, mature: 999, retained: 999 })],
        strands: [strand('reading', { band: 'C1', total: 99, passed: 99, mean: 1 })],
      }),
    );
    expect(p.percent).toBe(0);
  });
});

describe('progressToward', () => {
  it('measures the explicit target rather than the band after current', () => {
    // An unmeasured, placed-A2 learner proves A2 itself.
    const p = progressToward('A2', 'A2', evidence({ bands: [band({ band: 'A2', seen: MIN_ITEMS_PER_BAND })] }));
    expect(p.next).toBe('A2');
    expect(p.strands.find((s) => s.skill === 'vocabulary')?.fraction).toBeCloseTo(1 / 3);
  });
});

describe('ringForReport', () => {
  /**
   * A real report with no evidence, then the three level states written onto
   * it. The reports themselves are built and asserted in
   * cefr-proficiency.test.ts; what is under test here is only which target the
   * ring picks, so overriding the three fields is more legible than assembling
   * weeks of evidence to arrive at them.
   */
  function reportWith(over: Partial<ProficiencyReport>): ProficiencyReport {
    const evidence: ProficiencyEvidence = {
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
    return { ...buildProficiencyReport(evidence, new Date('2026-09-17T00:00:00.000Z')), ...over };
  }

  it('points at the band after a practice level', () => {
    const report = reportWith({
      practiceLevel: 'A2',
      overallLevel: 'A2',
      levelSource: 'practice',
    });
    expect(ringForReport(report)?.next).toBe('B1');
    expect(ringIsMeasured(report)).toBe(true);
  });

  it('points at the TESTED band, not the one above it, when a test published the level', () => {
    // Otherwise a B1 badge would sit over "0% to B2" — progress toward a band
    // the learner was never working on, measured with evidence they have none
    // of. The honest claim is "n% of the way to confirming B1".
    const report = reportWith({
      practiceLevel: null,
      overallLevel: 'B1',
      testedLevel: 'B1',
      levelSource: 'test',
    });
    expect(ringForReport(report)?.next).toBe('B1');
    // The band is not measured from practice, so the card says "Proving B1".
    expect(ringIsMeasured(report)).toBe(false);
  });

  it('points at the band to prove first when there is no level at all', () => {
    const report = reportWith({});
    expect(report.overallLevel).toBeNull();
    expect(ringForReport(report)?.next).toBe('A1');
    expect(ringIsMeasured(report)).toBe(false);
  });

  it('has no target at the top of the ladder', () => {
    const report = reportWith({ practiceLevel: 'C2', overallLevel: 'C2', levelSource: 'practice' });
    expect(ringForReport(report)?.next).toBeNull();
  });
});
