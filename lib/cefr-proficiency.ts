/**
 * CEFR proficiency estimation from in-app evidence.
 *
 * The product claim this supports: Fluenci can tell an adult learner what
 * level they are actually at, backed by the work they've done — as opposed to
 * a point total, which says nothing about proficiency.
 *
 * Credibility rules baked into this module. Do not relax them without a very
 * good reason; the entire value of the report is that it is not inflated:
 *
 *  1. We NEVER report a level we cannot evidence. Thin data yields
 *     `insufficient_data`, not an optimistic guess.
 *  2. We NEVER report a skill we do not measure. Speaking has no persisted
 *     scores today (pronunciation results are counted for quota purposes but
 *     the scores themselves are not stored), so speaking is reported as
 *     `not_assessed` until a spoken assessment exists.
 *  3. The report is an *estimate from practice history*, not a certification.
 *     Any UI rendering this must say so.
 *
 * Method. Rather than mapping a raw vocabulary count onto published CEFR
 * vocabulary-size thresholds (~500 words at A1 up to ~16k at C2 — Milton 2010,
 * Nation 2006), which would rate every realistic user A1 because in-app decks
 * are far smaller than a learner's true lexicon, we measure *band mastery*:
 * of the CEFR-tagged material the learner has actually encountered, how much
 * have they durably retained? Durable retention is SM-2 graduation, which by
 * definition means the item survived spaced recall over weeks.
 *
 * That question is asked only of material old enough to answer it. Retention is
 * measured over MATURE items — see `isMature` — never over everything seen, and
 * a band needs a minimum number of them before it is judged at all. Two rules
 * follow, and both are load-bearing: meeting new material cannot move the
 * reported level, and a level is never published off a handful of cards. A
 * number that FALLS when the learner studies is worse than one that is merely
 * inflated; it tells them the work made them worse, which is both untrue and
 * the exact opposite of what this report is for.
 *
 * This module is pure: no React, no network, no Date.now(). `now` is injected
 * so every branch is deterministically testable.
 */

import type { ProficiencyLevel, ReviewStatus } from '../types';

export type CefrBand = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_LADDER: CefrBand[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * The learner's self-declared / placement-test proficiency expressed as a CEFR
 * band. Mirrors the ladder used by `allowedCefrLevelsFor` in
 * `lib/supabase-queries.ts`.
 *
 * This is the *stated* level, not the evidenced one — use
 * `buildProficiencyReport` for the assessed level. Handy for lightweight
 * surfaces that need a competence label without paying for a full report.
 */
export function cefrBandForProficiencyLevel(level: ProficiencyLevel): CefrBand {
  return CEFR_BAND_BY_LEVEL[level] ?? 'A1';
}

/**
 * The ProficiencyLevel -> CEFR ladder. THE client-side copy.
 *
 * There were four independent copies of this table (here, `supabase-queries`'s
 * `allowedCefrLevelsFor`, the chat header, and `_shared/cefr.ts`). They agreed,
 * which is exactly what made it dangerous: this mapping gates which content a
 * learner is shown, the proficiency report, the chat header, and the level
 * every server prompt is written for. Editing three of four produces B2 reading
 * material with a B1 tutor, and nothing fails.
 *
 * The fourth copy lives in the Deno edge runtime and cannot import this module;
 * `lib/cefr-ladder.test.ts` asserts the two stay identical.
 */
export const CEFR_BAND_BY_LEVEL: Record<ProficiencyLevel, CefrBand> = {
  beginner: 'A1',
  elementary: 'A2',
  intermediate: 'B1',
  upper_intermediate: 'B2',
  advanced: 'C1',
};


export type SkillKey = 'vocabulary' | 'reading' | 'writing' | 'listening' | 'speaking';

export type BandStatus = 'mastered' | 'developing' | 'weak' | 'insufficient';

export type AssessmentStatus = 'assessed' | 'insufficient_data' | 'not_assessed';

export type Confidence = 'none' | 'low' | 'medium' | 'high';

// ─── Thresholds ─────────────────────────────────────────────────
// Tuned to be conservative: it should be harder to earn a level than to lose
// one. A learner who sees "B1" here should not be embarrassed in a real B1
// conversation.

/** Minimum CEFR-tagged items seen in a band before we will judge that band. */
export const MIN_ITEMS_PER_BAND = 20;

/**
 * Minimum *mature* items in a band before we will judge that band.
 *
 * `MIN_ITEMS_PER_BAND` counts exposure; this counts settled evidence. They are
 * different questions and a band needs to clear both. Forty A2 cards started
 * last week is ample exposure and says nothing yet about retention, because
 * none of them have been asked for again after a real gap — see `isMature`.
 *
 * Ten, because at `MASTERY_RATE` one item is then worth at most ten percentage
 * points of the rate. Below that a band's verdict swings on a single card:
 * with three mature items one lapse takes the learner from 100% to 67%, and a
 * level that flickers on one card is not a level. Ten is also half the exposure
 * floor, so the two thresholds stay in a readable relationship if either moves.
 */
export const MIN_MATURE_ITEMS_PER_BAND = 10;

/** Retention rate at which a band counts as mastered. */
export const MASTERY_RATE = 0.8;

/** Retention rate at which a band counts as actively developing. */
export const DEVELOPING_RATE = 0.5;

/** Minimum completed reading pieces in a band before it informs the reading level. */
export const MIN_READING_ITEMS = 3;

/** Comprehension score a reading piece must hit to count as understood. */
export const READING_COMPREHENSION_PASS = 0.7;

/** Minimum graded submissions in a band before it informs the writing level. */
export const MIN_WRITING_ITEMS = 3;

/** Mean submission score at which writing in a band counts as solid. */
export const WRITING_PASS_SCORE = 0.7;

/** Evidence volume required for each confidence tier. */
export const CONFIDENCE_TIERS = {
  high: { reviews: 500, activeDays: 30 },
  medium: { reviews: 150, activeDays: 10 },
  low: { reviews: 30, activeDays: 3 },
} as const;

// ─── Evidence inputs ────────────────────────────────────────────

export interface VocabEvidenceItem {
  /** CEFR level tag on the underlying card. Untagged items are ignored. */
  cefrLevel: string | null;
  status: ReviewStatus;
  repetitions: number;
  /** SM-2 interval in days. */
  interval: number;
}

export interface ReadingEvidenceItem {
  cefrLevel: string | null;
  /** 0–1 comprehension-question accuracy; null when the piece had no questions. */
  comprehension: number | null;
  completed: boolean;
}

export interface WritingEvidenceItem {
  cefrLevel: string | null;
  /** 0–1 overall score from AI grading; null when ungraded. */
  overallScore: number | null;
  wordCount: number;
}

export interface ProficiencyEvidence {
  vocabulary: VocabEvidenceItem[];
  reading: ReadingEvidenceItem[];
  writing: WritingEvidenceItem[];
  listeningMinutes: number;
  speakingMinutes: number;
  /** Distinct days with recorded activity. */
  activeDays: number;
  /** Total review events on record. */
  totalReviews: number;
}

// ─── Report output ──────────────────────────────────────────────

export interface BandBreakdown {
  band: CefrBand;
  /** Every CEFR-tagged item in this band the learner has encountered. */
  seen: number;
  /**
   * Of those, the ones settled enough to be evidence either way — the
   * denominator of `retentionRate`. Always `<= seen`, and always `>= retained`.
   * See `isMature`.
   */
  mature: number;
  retained: number;
  /** 0–1, over `mature` and NOT over `seen`. Zero when nothing is mature yet. */
  retentionRate: number;
  status: BandStatus;
}

export interface SkillAssessment {
  skill: SkillKey;
  level: CefrBand | null;
  status: AssessmentStatus;
  /** Human-readable explanation of why this level (or why not). */
  detail: string;
  evidenceCount: number;
}

export interface ProficiencyReport {
  overallLevel: CefrBand | null;
  confidence: Confidence;
  skills: SkillAssessment[];
  bands: BandBreakdown[];
  /** The band above `overallLevel`, or null at C2 / when unassessed. */
  nextLevel: CefrBand | null;
  /** Concrete, countable requirement to reach `nextLevel`. */
  nextLevelRequirement: string | null;
  generatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Normalise a free-text CEFR tag to a band. Content tags in the wild include
 * 'a2', 'A2 ', and 'B1-B2'; we take the first recognisable band token.
 */
export function normalizeBand(raw: string | null | undefined): CefrBand | null {
  if (!raw) return null;
  const match = raw.trim().toUpperCase().match(/[ABC][12]/);
  if (!match) return null;
  const band = match[0] as CefrBand;
  return CEFR_LADDER.includes(band) ? band : null;
}

/**
 * A vocabulary item counts as durably retained once SM-2 has graduated it.
 * `status === 'graduated'` is the primary signal; the interval/repetitions
 * fallback catches rows written before the status field was maintained.
 * Leeches are explicitly excluded — a leech is the opposite of retention.
 */
export function isRetained(item: VocabEvidenceItem): boolean {
  if (item.status === 'leech') return false;
  if (item.status === 'graduated') return true;
  return item.repetitions >= 3 && item.interval >= 21;
}

/**
 * An item is *mature* once it has produced evidence either way — once the
 * learner has been asked for it again after a real gap and we know something
 * about whether it stuck.
 *
 * This is the denominator of every retention rate in the report, and getting it
 * wrong in the obvious way (denominator = everything seen) is what made the
 * reported level FALL when the learner studied. Starting five new A2 cards adds
 * five to `seen` and nothing to `retained` for the ~three weeks SM-2 takes to
 * graduate them, so the rate dropped the moment the learner met new material
 * and recovered only slowly. A learner who did exactly what the app asked was
 * told they had got worse — worse than an inflated number, because it punishes
 * the behaviour the whole product is trying to produce.
 *
 * `interval < 21 && repetitions < 3` is `isRetained`'s graduation fallback,
 * negated: an item is immature only while it is short of BOTH. Either alone is
 * enough to count it. Three survived recalls is real evidence even if the
 * interval is still short (a low-ease card can sit at repetitions 6, interval
 * 17 for a long time), and a 21-day interval is real evidence however reached.
 *
 * Two statuses are decided by status rather than by those numbers:
 *
 *  - `graduated` is mature by definition, and `isRetained` already trusts the
 *    status over the interval/repetition fields for rows written before those
 *    were maintained. If the two disagreed here, a retained item could fall out
 *    of its own denominator and the rate could exceed 1.
 *  - `leech` is mature AND not retained, which is the entire point of the
 *    clause. SM-2 resets a failed card to `repetitions: 0, interval: 1`, so a
 *    card the learner has forgotten eight times is numerically identical to one
 *    they met yesterday. Without this, chronic failure would quietly leave the
 *    denominator and push the rate UP — inflation, which is the failure this
 *    module exists to avoid.
 *
 * A single lapse does still drop an item out of the denominator until it climbs
 * back. That is deliberate: one bad evening is not evidence of the learner's
 * level, and a card that keeps lapsing arrives here as a leech.
 */
export function isMature(item: VocabEvidenceItem): boolean {
  if (item.status === 'graduated' || item.status === 'leech') return true;
  return !(item.interval < 21 && item.repetitions < 3);
}

function bandIndex(band: CefrBand): number {
  return CEFR_LADDER.indexOf(band);
}

function nextBand(band: CefrBand): CefrBand | null {
  const idx = bandIndex(band);
  return idx >= 0 && idx < CEFR_LADDER.length - 1 ? CEFR_LADDER[idx + 1] : null;
}

// ─── Band analysis ──────────────────────────────────────────────

/**
 * Retention per CEFR band across everything the learner has been exposed to.
 * Items with no usable CEFR tag are skipped rather than bucketed into a
 * default band — guessing here would silently corrupt the whole report.
 *
 * Exposure and retention are counted separately and never mixed: `seen` is
 * everything met, `mature` is the subset that has had time to prove itself, and
 * the rate is measured strictly over `mature`. That separation is what makes
 * the reported level immune to new material (see `isMature`).
 */
export function analyzeBands(items: VocabEvidenceItem[]): BandBreakdown[] {
  const counts = new Map<CefrBand, { seen: number; mature: number; retained: number }>();
  CEFR_LADDER.forEach((band) => counts.set(band, { seen: 0, mature: 0, retained: 0 }));

  for (const item of items) {
    const band = normalizeBand(item.cefrLevel);
    if (!band) continue;
    const bucket = counts.get(band);
    if (!bucket) continue;
    bucket.seen += 1;
    // An immature item is exposure and nothing else: absent from BOTH sides of
    // the ratio, so meeting new material moves the rate by exactly zero rather
    // than dragging it down for three weeks. Every retained item is mature by
    // construction, so `retained <= mature` holds and the rate cannot exceed 1.
    if (!isMature(item)) continue;
    bucket.mature += 1;
    if (isRetained(item)) bucket.retained += 1;
  }

  return CEFR_LADDER.map((band) => {
    const { seen, mature, retained } = counts.get(band) ?? { seen: 0, mature: 0, retained: 0 };
    const retentionRate = mature > 0 ? retained / mature : 0;

    let status: BandStatus;
    // Two independent ways to have too little to say: not enough of the band
    // met at all, or not enough of what was met has settled. A rate computed
    // over three mature cards is arithmetic, not an assessment.
    if (seen < MIN_ITEMS_PER_BAND || mature < MIN_MATURE_ITEMS_PER_BAND) {
      status = 'insufficient';
    } else if (retentionRate >= MASTERY_RATE) {
      status = 'mastered';
    } else if (retentionRate >= DEVELOPING_RATE) {
      status = 'developing';
    } else {
      status = 'weak';
    }

    return { band, seen, mature, retained, retentionRate, status };
  });
}

/**
 * The highest band reached without skipping one: walk up from the bottom of the
 * ladder and stop at the first band that does not qualify.
 *
 * Every skill shares this, deliberately. Contiguity is a claim about what a
 * level *means* — that a level you cannot demonstrate at the rungs beneath it
 * is not a level you hold — and that claim does not vary by skill. It used to
 * live only inside `vocabularyLevel`, so three C1 texts printed "Reading: C1"
 * on the profile screen (and, being the only assessed skill, made the whole
 * report C1) while three C1 decks correctly printed nothing. One policy, one
 * implementation, or the two drift again.
 *
 * A band with no evidence at all does not qualify and therefore stops the walk.
 * That is the same treatment `analyzeBands` already gives an empty vocabulary
 * band — `insufficient`, which breaks the walk — and it is the conservative
 * reading: we have not been shown the lower rung, so we do not grant the
 * higher one.
 *
 * Callers pass the bands in ladder order, each already judged.
 */
function highestContiguousBand(
  judged: { band: CefrBand; qualifies: boolean }[]
): CefrBand | null {
  let level: CefrBand | null = null;
  for (const entry of judged) {
    if (!entry.qualifies) break;
    level = entry.band;
  }
  return level;
}

/**
 * Vocabulary level = the highest band mastered *without skipping a band*.
 *
 * The contiguity requirement matters. A learner who has mastered A1 and, via
 * a niche track, a handful of B2 medical terms is not B2. We walk up from A1
 * and stop at the first band that is not mastered, which is what a placement
 * examiner would effectively do.
 */
export function vocabularyLevel(bands: BandBreakdown[]): CefrBand | null {
  // Walked in the caller's order rather than over CEFR_LADDER, so a caller that
  // hands us a partial ladder still gets the old answer.
  return highestContiguousBand(
    bands.map((b) => ({ band: b.band, qualifies: b.status === 'mastered' }))
  );
}

// ─── Per-skill assessment ───────────────────────────────────────

function assessVocabulary(bands: BandBreakdown[]): SkillAssessment {
  const evidenceCount = bands.reduce((sum, b) => sum + b.seen, 0);
  const level = vocabularyLevel(bands);

  if (level) {
    const at = bands.find((b) => b.band === level);
    return {
      skill: 'vocabulary',
      level,
      status: 'assessed',
      // Counted against mature items, not against everything seen, so the
      // sentence matches the number that decided the level — and so it does not
      // read worse the day after the learner starts a new deck.
      detail: `Retained ${at?.retained ?? 0} of ${at?.mature ?? 0} ${level} items in long-term review.`,
      evidenceCount,
    };
  }

  const inProgress = bands.find((b) => b.status === 'developing' || b.status === 'weak');
  if (inProgress) {
    return {
      skill: 'vocabulary',
      level: null,
      status: 'insufficient_data',
      detail:
        `Working through ${inProgress.band}: ${inProgress.retained} of ${inProgress.mature} items retained. ` +
        `${Math.round(MASTERY_RATE * 100)}% retention confirms the level.`,
      evidenceCount,
    };
  }

  // Plenty of words met, none of them old enough to count yet. Telling this
  // learner to "review at least 20 words" would be both false and useless —
  // they have done that; what they need is for time to pass on the ones they
  // have. Saying so is the difference between a report that explains itself and
  // one that looks broken.
  const settling = bands.find(
    (b) => b.seen >= MIN_ITEMS_PER_BAND && b.mature < MIN_MATURE_ITEMS_PER_BAND
  );
  if (settling) {
    return {
      skill: 'vocabulary',
      level: null,
      status: 'insufficient_data',
      detail:
        `${settling.seen} ${settling.band} words started, ${settling.mature} of them settled into long-term review. ` +
        `${MIN_MATURE_ITEMS_PER_BAND} are needed before ${settling.band} can be judged — keep reviewing.`,
      evidenceCount,
    };
  }

  return {
    skill: 'vocabulary',
    level: null,
    status: 'insufficient_data',
    detail: `Review at least ${MIN_ITEMS_PER_BAND} words in a level to be assessed on it.`,
    evidenceCount,
  };
}

/**
 * Reading level = highest band, *without skipping a band*, with enough
 * completed pieces understood at or above the comprehension pass mark. Pieces
 * without comprehension questions count as completed but cannot demonstrate
 * understanding, so they are excluded from the pass tally.
 *
 * The contiguity requirement is `highestContiguousBand`, the same walk
 * vocabulary uses. Before it was applied here, this loop assigned `level` on
 * every qualifying band and never stopped, so the HIGHEST qualifying band won
 * no matter what sat below it: three C1 articles, which the library will happily
 * serve to a curious B1 learner, printed "Reading: C1" on the profile screen.
 */
function assessReading(items: ReadingEvidenceItem[]): SkillAssessment {
  const completed = items.filter((i) => i.completed);
  const perBand = new Map<CefrBand, { total: number; passed: number }>();

  for (const item of completed) {
    const band = normalizeBand(item.cefrLevel);
    if (!band || item.comprehension === null) continue;
    const bucket = perBand.get(band) ?? { total: 0, passed: 0 };
    bucket.total += 1;
    if (item.comprehension >= READING_COMPREHENSION_PASS) bucket.passed += 1;
    perBand.set(band, bucket);
  }

  const level = highestContiguousBand(
    CEFR_LADDER.map((band) => ({
      band,
      qualifies: (perBand.get(band)?.passed ?? 0) >= MIN_READING_ITEMS,
    }))
  );

  if (level) {
    const bucket = perBand.get(level);
    return {
      skill: 'reading',
      level,
      status: 'assessed',
      detail: `Understood ${bucket?.passed ?? 0} of ${bucket?.total ?? 0} ${level} texts at ${Math.round(READING_COMPREHENSION_PASS * 100)}%+ comprehension.`,
      evidenceCount: completed.length,
    };
  }

  return {
    skill: 'reading',
    level: null,
    status: 'insufficient_data',
    detail: `Finish ${MIN_READING_ITEMS} texts with comprehension questions at each level from A1 up to be assessed.`,
    evidenceCount: completed.length,
  };
}

/**
 * Writing level = highest band, *without skipping a band*, with enough graded
 * submissions averaging at or above the pass score. Ungraded submissions are
 * ignored entirely.
 *
 * Same contiguity fix as reading, and the same reason: the old loop kept the
 * highest qualifying band regardless of the ones below it, so three good B2
 * pieces read "Writing: B2" with nothing at A1, A2 or B1 to support it.
 * Production evidence is exactly where a skipped band is least defensible —
 * writing three passable B2 paragraphs on a familiar topic is not the same
 * claim as being able to write at B2.
 */
function assessWriting(items: WritingEvidenceItem[]): SkillAssessment {
  const graded = items.filter((i) => i.overallScore !== null);
  const perBand = new Map<CefrBand, number[]>();

  for (const item of graded) {
    const band = normalizeBand(item.cefrLevel);
    if (!band || item.overallScore === null) continue;
    const scores = perBand.get(band) ?? [];
    scores.push(item.overallScore);
    perBand.set(band, scores);
  }

  // Mean per band first, so the walk below is a pure yes/no per rung.
  const means = new Map<CefrBand, number>();
  for (const [band, scores] of perBand) {
    if (scores.length < MIN_WRITING_ITEMS) continue;
    means.set(band, scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  const level = highestContiguousBand(
    CEFR_LADDER.map((band) => {
      const mean = means.get(band);
      return { band, qualifies: mean !== undefined && mean >= WRITING_PASS_SCORE };
    })
  );

  if (level) {
    const levelMean = means.get(level) ?? 0;
    return {
      skill: 'writing',
      level,
      status: 'assessed',
      detail: `Averaged ${Math.round(levelMean * 100)}% across ${perBand.get(level)?.length ?? 0} graded ${level} pieces.`,
      evidenceCount: graded.length,
    };
  }

  return {
    skill: 'writing',
    level: null,
    status: 'insufficient_data',
    detail: `Submit ${MIN_WRITING_ITEMS} graded pieces at each level from A1 up to be assessed.`,
    evidenceCount: graded.length,
  };
}

/**
 * Listening minutes are exposure, not proficiency — we record how long audio
 * played, not whether it was understood. Reporting a level from that would be
 * exactly the inflation this feature exists to avoid.
 */
function assessListening(minutes: number): SkillAssessment {
  return {
    skill: 'listening',
    level: null,
    status: 'not_assessed',
    detail:
      minutes > 0
        ? `${Math.round(minutes)} minutes of listening practice logged. Listening is not yet scored.`
        : 'No listening practice logged yet.',
    evidenceCount: Math.round(minutes),
  };
}

/**
 * Speaking is deliberately unassessed. Pronunciation attempts are counted for
 * quota but their scores are not persisted, so there is nothing to grade from.
 * A spoken assessment lands with the voice work; until then this stays honest.
 */
function assessSpeaking(minutes: number): SkillAssessment {
  return {
    skill: 'speaking',
    level: null,
    status: 'not_assessed',
    detail:
      minutes > 0
        ? `${Math.round(minutes)} minutes of speaking practice logged. A spoken assessment is coming.`
        : 'No speaking practice logged yet.',
    evidenceCount: Math.round(minutes),
  };
}

// ─── Confidence ─────────────────────────────────────────────────

/**
 * Confidence reflects evidence volume, not accuracy. Both the review count
 * and the spread of active days must clear a tier — a single cramming session
 * is not the same evidence as a month of spaced practice.
 */
export function assessConfidence(totalReviews: number, activeDays: number): Confidence {
  if (
    totalReviews >= CONFIDENCE_TIERS.high.reviews &&
    activeDays >= CONFIDENCE_TIERS.high.activeDays
  ) {
    return 'high';
  }
  if (
    totalReviews >= CONFIDENCE_TIERS.medium.reviews &&
    activeDays >= CONFIDENCE_TIERS.medium.activeDays
  ) {
    return 'medium';
  }
  if (
    totalReviews >= CONFIDENCE_TIERS.low.reviews &&
    activeDays >= CONFIDENCE_TIERS.low.activeDays
  ) {
    return 'low';
  }
  return 'none';
}

// ─── Overall level ──────────────────────────────────────────────

/**
 * Overall level is the *lowest* assessed skill level, not the highest or the
 * mean. CEFR describes what a learner can reliably do; a person who reads B2
 * but cannot produce past A2 is not a B2 speaker. Taking the floor is the
 * conservative reading and the one a real examiner would defend.
 */
export function overallFromSkills(skills: SkillAssessment[]): CefrBand | null {
  const assessed = skills.filter((s) => s.status === 'assessed' && s.level);
  if (assessed.length === 0) return null;
  return assessed.reduce<CefrBand | null>((lowest, skill) => {
    if (!skill.level) return lowest;
    if (!lowest) return skill.level;
    return bandIndex(skill.level) < bandIndex(lowest) ? skill.level : lowest;
  }, null);
}

/**
 * The concrete, countable thing standing between the learner and the next
 * band. Vague encouragement is worthless here — the learner should be able to
 * read this and know exactly what to go do.
 */
export function nextLevelRequirement(
  current: CefrBand | null,
  bands: BandBreakdown[]
): { nextLevel: CefrBand | null; requirement: string | null } {
  if (!current) {
    return {
      nextLevel: 'A1',
      requirement: `Review at least ${MIN_ITEMS_PER_BAND} A1 words to earn your first assessed level.`,
    };
  }

  const target = nextBand(current);
  if (!target) {
    return { nextLevel: null, requirement: null };
  }

  const targetBand = bands.find((b) => b.band === target);
  if (!targetBand || targetBand.seen < MIN_ITEMS_PER_BAND) {
    const shortfall = MIN_ITEMS_PER_BAND - (targetBand?.seen ?? 0);
    return {
      nextLevel: target,
      requirement: `Start ${target}: review ${shortfall} more ${target} item${shortfall === 1 ? '' : 's'}.`,
    };
  }

  // Enough of the band met, not enough of it settled. The fix for this state is
  // time spent on cards the learner already has; starting more new ones does
  // nothing for it, so the requirement must not imply otherwise.
  if (targetBand.mature < MIN_MATURE_ITEMS_PER_BAND) {
    const shortfall = MIN_MATURE_ITEMS_PER_BAND - targetBand.mature;
    return {
      nextLevel: target,
      requirement: `Keep reviewing your ${target} words — ${shortfall} more must reach long-term intervals (${targetBand.mature}/${MIN_MATURE_ITEMS_PER_BAND} so far).`,
    };
  }

  // Against mature, matching the rate that actually gates the band. This is a
  // floor rather than an exact figure: an item the learner retains from here
  // adds to both sides of the ratio, so the last few can take slightly more
  // than the count suggests. Understating the work left would be the worse
  // error, and the number moves with every review anyway.
  const needed = Math.ceil(targetBand.mature * MASTERY_RATE) - targetBand.retained;
  if (needed > 0) {
    return {
      nextLevel: target,
      requirement: `Retain ${needed} more ${target} item${needed === 1 ? '' : 's'} in long-term review (${targetBand.retained}/${targetBand.mature} so far).`,
    };
  }

  return {
    nextLevel: target,
    requirement: `${target} vocabulary is on track — build reading and writing evidence at ${target} to confirm the level.`,
  };
}

// ─── Entry point ────────────────────────────────────────────────

/**
 * Build the full proficiency report from evidence.
 *
 * @param evidence Aggregated in-app history.
 * @param now Injected clock, so output is deterministic under test.
 */
export function buildProficiencyReport(
  evidence: ProficiencyEvidence,
  now: Date
): ProficiencyReport {
  const bands = analyzeBands(evidence.vocabulary);

  const skills: SkillAssessment[] = [
    assessVocabulary(bands),
    assessReading(evidence.reading),
    assessWriting(evidence.writing),
    assessListening(evidence.listeningMinutes),
    assessSpeaking(evidence.speakingMinutes),
  ];

  const confidence = assessConfidence(evidence.totalReviews, evidence.activeDays);

  // With no meaningful evidence we withhold the level entirely rather than
  // publish a number the learner would be right not to trust.
  const overallLevel = confidence === 'none' ? null : overallFromSkills(skills);

  const { nextLevel, requirement } = nextLevelRequirement(overallLevel, bands);

  return {
    overallLevel,
    confidence,
    skills,
    bands,
    nextLevel,
    nextLevelRequirement: requirement,
    generatedAt: now.toISOString(),
  };
}
