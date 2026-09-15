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
 *  2. We NEVER report a skill we do not measure. Speaking became measurable
 *     with migration 089 (`score-pronunciation` persists a row per scored
 *     attempt) and listening with migration 128 (`record_exercise_result`
 *     persists every graded lesson exercise, and the listening ones —
 *     `listening_choice`, `listening_type`, `dictation` — are answered from
 *     audio alone). Minutes of audio played are still exposure, never a
 *     level. A learner with no scored attempts in a strand is `not_assessed`,
 *     not zero.
 *  3. The report is an *estimate from practice history*, not a certification.
 *     Any UI rendering this must say so.
 *  4. A band is held only when EVERY scored strand holds it — vocabulary,
 *     reading, writing, listening and speaking. The overall level used to be
 *     the floor across whichever strands happened to be assessed, so a
 *     learner who only ever did vocabulary reviews was "A2" with nothing to
 *     show for reading, writing or speech, and Home's ring — which now blends
 *     all five strands — could not predict when the report would promote.
 *     Requiring all five makes the ring and the report the same claim:
 *     99% means one piece of work away. The cost is honesty's usual cost —
 *     a lessons-only learner reads "not yet assessed" with a list of what to
 *     go do — and the report says exactly which strands are missing.
 *  5. Evidence is scoped to ONE target language. The caller fetches per
 *     language (`fetchProficiencyEvidence(userId, targetLanguage)`); nothing
 *     here mixes Spanish cards into a French report.
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

/**
 * `placed` is the one status that is not a verdict on evidence. It marks a band
 * strictly below the learner's placement band (the CEFR band of the course they
 * started in) that has too little evidence to judge. The report assumes such a
 * band from the learner's own placement rather than breaking the contiguity
 * walk on it — see `highestContiguousBand` — and always discloses that it did.
 * A band below placement that DOES have enough evidence is judged on it.
 */
export type BandStatus = 'mastered' | 'developing' | 'weak' | 'insufficient' | 'placed';

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

/**
 * Minimum scored spoken attempts in a band before it informs the speaking
 * level.
 *
 * Higher than reading's and writing's 3 on purpose. A reading piece or a
 * graded submission is a substantial artefact; a pronunciation attempt is one
 * utterance of a few seconds, scored against a Whisper transcript that is
 * itself noisy (mic, room, accent). Three of those are not evidence of a
 * level. Ten still sits well inside a couple of days of practice at the paid
 * daily quota, and it is the same instinct that puts vocabulary — the other
 * small-grained signal — at 20 items per band.
 */
export const MIN_SPEAKING_ITEMS = 10;

/**
 * Mean pronunciation score at which speaking in a band counts as solid.
 *
 * Deliberately the same bar as reading and writing: one pass mark across the
 * three scored strands, and comfortably above the 60 that `score-pronunciation`
 * itself calls "correct" — clearing this band means the learner is past merely
 * intelligible, not scraping it.
 */
export const SPEAKING_PASS_SCORE = 0.7;

/**
 * Minimum graded listening exercises in a band before it informs the
 * listening level. Ten, like speaking: one exercise is one short clip, and a
 * tap on the right option is a small-grained signal.
 */
export const MIN_LISTENING_ITEMS = 10;

/**
 * Share of listening exercises answered right on the first attempt at which
 * a band counts as solid. The same 0.7 bar as every other scored strand.
 */
export const LISTENING_PASS_RATE = 0.7;

/** The strands a band must be held in for the overall level to hold it. */
export const SCORED_SKILLS: SkillKey[] = ['vocabulary', 'reading', 'writing', 'listening', 'speaking'];

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

export interface SpeakingEvidenceItem {
  /**
   * CEFR level tag of the attempt. For a scored card this is the card's tag;
   * null for read-aloud and free practice, which are real practice but cannot
   * evidence a *level*, so they are ignored here exactly as an untagged
   * reading piece is. Conversation turns always carry the level the
   * conversation was held at.
   */
  cefrLevel: string | null;
  /**
   * 0–1. Two sources feed this, deliberately on the same scale:
   *
   *  - `pronunciation_scores`, a scored attempt against a known target,
   *    stored 0–100 and normalised by the query layer.
   *  - `conversation_evidence`, a spoken turn scored on how accurate the
   *    language was and how well it came across (see combineConversationScore).
   *
   * They measure different things and are pooled on purpose: both are
   * evidence of the same can-do statement, and a learner who only ever holds
   * conversations should still be assessed on speaking.
   */
  score: number;
}

/**
 * Collapse one conversation turn's stored components into a single 0–1 score.
 *
 * Mirrors `combinedScore` in supabase/functions/_shared/turn-accuracy.ts. The
 * two exist separately because an edge function and the app bundle cannot
 * share a module, and the rule is duplicated rather than the score being
 * stored pre-combined — the raw components are kept in the table precisely so
 * the weighting can be re-tuned later without losing the evidence.
 *
 * Speaking is half accuracy and half intelligibility: a grammatically perfect
 * sentence nobody can follow has not achieved the can-do statement. Where the
 * recogniser reported nothing, accuracy carries the turn alone rather than the
 * turn being discarded.
 */
export function combineConversationScore(
  accuracy: number,
  intelligibility: number | null,
): number {
  if (intelligibility === null || !Number.isFinite(intelligibility)) return accuracy;
  return 0.5 * accuracy + 0.5 * intelligibility;
}

/**
 * One graded listening exercise from a lesson (migration 128). The band is
 * the card's when the exercise is card-linked, else the lesson's course band —
 * both derived server-side by `record_exercise_result`, never by the client.
 */
export interface ListeningEvidenceItem {
  cefrLevel: string | null;
  /** First-attempt correctness. A recovered second try is `false`. */
  correct: boolean;
}

export interface ProficiencyEvidence {
  vocabulary: VocabEvidenceItem[];
  reading: ReadingEvidenceItem[];
  writing: WritingEvidenceItem[];
  /** Scored spoken attempts (migration 089). */
  speaking: SpeakingEvidenceItem[];
  /** Graded listening exercises (migration 128). */
  listening: ListeningEvidenceItem[];
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
  /**
   * Rungs below `level` granted from the learner's placement rather than from
   * evidence. Empty when every rung under the level was measured, and always
   * empty when `level` is null — an assumed rung is never itself a level.
   */
  assumedBands: CefrBand[];
}

/**
 * What one scored strand (reading, writing, listening, speaking) has at one
 * band. Vocabulary keeps its own richer `BandBreakdown`; these four share a
 * shape because their gates are all "enough items, good enough".
 */
export interface StrandBandStats {
  band: CefrBand;
  /** Items that can count: completed pieces with questions, graded pieces, scored attempts, graded exercises. */
  total: number;
  /** Reading and listening: items over the pass mark. Writing and speaking: same as `total` (they gate on the mean). */
  passed: number;
  /** Mean score / correctness rate over `total`. 0 when nothing counts yet. */
  mean: number;
}

export interface StrandBreakdown {
  skill: Exclude<SkillKey, 'vocabulary'>;
  bands: StrandBandStats[];
}

export interface ProficiencyReport {
  overallLevel: CefrBand | null;
  confidence: Confidence;
  skills: SkillAssessment[];
  bands: BandBreakdown[];
  /** Per-band evidence for the four non-vocabulary strands, ladder order. */
  strands: StrandBreakdown[];
  /**
   * Scored strands with no level yet. Empty when a level is published. This
   * is what stands between the learner and their first (or next) band, so
   * the UI names them rather than showing a bare "not yet assessed".
   */
  missingSkills: SkillKey[];
  /** The band above `overallLevel`, or null at C2 / when unassessed. */
  nextLevel: CefrBand | null;
  /**
   * Concrete, countable requirement to reach `nextLevel` — every line of
   * `nextLevelSteps` joined, kept for callers that render one string.
   */
  nextLevelRequirement: string | null;
  /**
   * One line per strand still short of `nextLevel`, vocabulary first, plus a
   * final line for the confidence gate when that is what withholds the level.
   * Empty at the top of the ladder.
   */
  nextLevelSteps: string[];
  /**
   * The CEFR band of the course the learner started in, or null for an account
   * with no placement (the walk then starts at A1 exactly as it always did).
   */
  placementBand: CefrBand | null;
  /** Union over assessed skills of rungs assumed from placement below `overallLevel`. */
  assumedBands: CefrBand[];
  /**
   * One sentence the UI pairs with `cefrCanDo(overallLevel)` whenever part of
   * the level rests on placement. Null when nothing was assumed or there is no
   * level, so a caller can render it unconditionally.
   */
  levelBasis: string | null;
  generatedAt: string;
}

/** Optional inputs to `buildProficiencyReport` that are not in-app history. */
export interface ProficiencyReportOptions {
  /** See `ProficiencyReport.placementBand`. */
  placementBand?: CefrBand | null;
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

/** True when `band` sits strictly below the placement band. Never true without one. */
function isBelowPlacement(band: CefrBand, placementBand: CefrBand | null): boolean {
  return placementBand !== null && bandIndex(band) < bandIndex(placementBand);
}

/**
 * "A1", "A1–A2" for a contiguous run, otherwise comma-separated. Bands arrive
 * in ladder order from the walk, so contiguity is a first/last check.
 */
export function formatBandRange(bands: CefrBand[]): string {
  if (bands.length === 0) return '';
  if (bands.length === 1) return bands[0];
  const first = bandIndex(bands[0]);
  const last = bandIndex(bands[bands.length - 1]);
  const contiguous = last - first === bands.length - 1;
  return contiguous ? `${bands[0]}–${bands[bands.length - 1]}` : bands.join(', ');
}

/**
 * The sentence that keeps a placed learner's level honest. Null when there is
 * nothing to disclose, so the UI can render it unconditionally.
 */
export function levelBasis(level: CefrBand | null, assumed: CefrBand[]): string | null {
  if (!level || assumed.length === 0) return null;
  return `Measured from your ${level} work; ${formatBandRange(assumed)} assumed from your placement.`;
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
 *
 * With a `placementBand`, an unjudgeable band strictly below it is reported as
 * `placed` instead of `insufficient`. The counts are untouched — a placed band
 * with 15 items seen still says 15 — only the verdict changes, and only for
 * bands the evidence could not speak to.
 */
export function analyzeBands(
  items: VocabEvidenceItem[],
  placementBand: CefrBand | null = null,
): BandBreakdown[] {
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
      status = isBelowPlacement(band, placementBand) ? 'placed' : 'insufficient';
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
 * A band with no evidence at all does not qualify and therefore stops the walk,
 * with one exception: placement. A learner who started in the B1 course was
 * never shown A1 or A2 cards, and a walk that breaks on those would leave them
 * unassessed forever while telling them to go review A1 words. So a rung that
 * is strictly below the `placementBand` AND has no usable evidence is *assumed*
 * — the walk steps over it and records it in `assumedBands` so the report can
 * say so. Two limits keep the never-inflate rule intact:
 *
 *  - Evidence overrides placement, never the reverse. A rung below placement
 *    that HAS enough evidence is judged on it, and if it fails it breaks the
 *    walk exactly as it would for anyone else. Placement fills gaps in the
 *    evidence; it does not outrank it.
 *  - A level is never an assumed rung. Only an evidenced, qualifying rung sets
 *    `level`. A placed-B1 learner with nothing settled at B1 yet is null, not
 *    "A2" off zero A2 evidence.
 *
 * Callers pass the bands in ladder order, each already judged, with `evidenced`
 * saying whether the rung had enough evidence to be judged at all.
 */
interface JudgedBand {
  band: CefrBand;
  qualifies: boolean;
  evidenced: boolean;
}

function highestContiguousBand(
  judged: JudgedBand[],
  placementBand: CefrBand | null = null,
): { level: CefrBand | null; assumedBands: CefrBand[] } {
  let level: CefrBand | null = null;
  const assumed: CefrBand[] = [];
  for (const entry of judged) {
    const placed = !entry.evidenced && isBelowPlacement(entry.band, placementBand);
    if (!entry.qualifies && !placed) break;
    if (placed) {
      assumed.push(entry.band);
    } else {
      level = entry.band;
    }
  }
  // Assumed rungs above the level actually granted are not part of that level's
  // basis, so they are not reported as such.
  const granted = level;
  return {
    level,
    assumedBands: granted ? assumed.filter((b) => bandIndex(b) < bandIndex(granted)) : [],
  };
}

/**
 * Vocabulary level = the highest band mastered *without skipping a band*.
 *
 * The contiguity requirement matters. A learner who has mastered A1 and, via
 * a niche track, a handful of B2 medical terms is not B2. We walk up from A1
 * and stop at the first band that is not mastered, which is what a placement
 * examiner would effectively do. With a `placementBand`, unjudgeable bands
 * below it are stepped over — see `highestContiguousBand`.
 */
export function vocabularyLevel(
  bands: BandBreakdown[],
  placementBand: CefrBand | null = null,
): CefrBand | null {
  return highestContiguousBand(judgeVocabulary(bands), placementBand).level;
}

function judgeVocabulary(bands: BandBreakdown[]): JudgedBand[] {
  // Walked in the caller's order rather than over CEFR_LADDER, so a caller that
  // hands us a partial ladder still gets the old answer.
  return bands.map((b) => ({
    band: b.band,
    qualifies: b.status === 'mastered',
    evidenced: b.status !== 'insufficient' && b.status !== 'placed',
  }));
}

/** Appended to an assessed skill's detail whenever part of its level is assumed. */
function assumedClause(assumed: CefrBand[]): string {
  return assumed.length > 0 ? ` ${formatBandRange(assumed)} assumed from your placement.` : '';
}

// ─── Per-skill assessment ───────────────────────────────────────

function assessVocabulary(
  bands: BandBreakdown[],
  placementBand: CefrBand | null,
): SkillAssessment {
  const evidenceCount = bands.reduce((sum, b) => sum + b.seen, 0);
  const { level, assumedBands } = highestContiguousBand(judgeVocabulary(bands), placementBand);

  if (level) {
    const at = bands.find((b) => b.band === level);
    return {
      skill: 'vocabulary',
      level,
      status: 'assessed',
      // Counted against mature items, not against everything seen, so the
      // sentence matches the number that decided the level — and so it does not
      // read worse the day after the learner starts a new deck.
      detail:
        `Retained ${at?.retained ?? 0} of ${at?.mature ?? 0} ${level} items in long-term review.` +
        assumedClause(assumedBands),
      evidenceCount,
      assumedBands,
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
      assumedBands: [],
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
      assumedBands: [],
    };
  }

  return {
    skill: 'vocabulary',
    level: null,
    status: 'insufficient_data',
    detail: `Review at least ${MIN_ITEMS_PER_BAND} words in a level to be assessed on it.`,
    evidenceCount,
    assumedBands: [],
  };
}

// ─── Strand statistics ──────────────────────────────────────────
//
// The four non-vocabulary strands share one shape: per band, how many items
// count and how well they went. The assessment functions below judge from
// these, and `lib/next-band-progress.ts` draws the ring from the same numbers,
// so the two can never disagree about what the learner has done.

function emptyStrandBands(): Map<CefrBand, { total: number; passed: number; sum: number }> {
  const m = new Map<CefrBand, { total: number; passed: number; sum: number }>();
  CEFR_LADDER.forEach((band) => m.set(band, { total: 0, passed: 0, sum: 0 }));
  return m;
}

function finishStrand(
  skill: StrandBreakdown['skill'],
  m: Map<CefrBand, { total: number; passed: number; sum: number }>,
  /** Writing and speaking gate on the mean, so `passed` mirrors `total`. */
  passedIsTotal: boolean,
): StrandBreakdown {
  return {
    skill,
    bands: CEFR_LADDER.map((band) => {
      const b = m.get(band) ?? { total: 0, passed: 0, sum: 0 };
      return {
        band,
        total: b.total,
        passed: passedIsTotal ? b.total : b.passed,
        mean: b.total > 0 ? b.sum / b.total : 0,
      };
    }),
  };
}

/** Completed pieces with comprehension questions; `passed` = at or over the pass mark. */
export function readingStrand(items: ReadingEvidenceItem[]): StrandBreakdown {
  const m = emptyStrandBands();
  for (const item of items) {
    if (!item.completed || item.comprehension === null) continue;
    const band = normalizeBand(item.cefrLevel);
    if (!band) continue;
    const b = m.get(band)!;
    b.total += 1;
    b.sum += item.comprehension;
    if (item.comprehension >= READING_COMPREHENSION_PASS) b.passed += 1;
  }
  return finishStrand('reading', m, false);
}

/** Graded submissions only; the band gates on the mean, not on a pass count. */
export function writingStrand(items: WritingEvidenceItem[]): StrandBreakdown {
  const m = emptyStrandBands();
  for (const item of items) {
    if (item.overallScore === null) continue;
    const band = normalizeBand(item.cefrLevel);
    if (!band) continue;
    const b = m.get(band)!;
    b.total += 1;
    b.sum += item.overallScore;
  }
  return finishStrand('writing', m, true);
}

/** Tagged scored attempts only; untagged practice is real but cannot place a level. */
export function speakingStrand(items: SpeakingEvidenceItem[]): StrandBreakdown {
  const m = emptyStrandBands();
  for (const item of items) {
    const band = normalizeBand(item.cefrLevel);
    if (!band) continue;
    const b = m.get(band)!;
    b.total += 1;
    b.sum += item.score;
  }
  return finishStrand('speaking', m, true);
}

/** Graded listening exercises; `mean` is the first-attempt correctness rate. */
export function listeningStrand(items: ListeningEvidenceItem[]): StrandBreakdown {
  const m = emptyStrandBands();
  for (const item of items) {
    const band = normalizeBand(item.cefrLevel);
    if (!band) continue;
    const b = m.get(band)!;
    b.total += 1;
    if (item.correct) {
      b.sum += 1;
      b.passed += 1;
    }
  }
  return finishStrand('listening', m, false);
}

function strandBand(strand: StrandBreakdown, band: CefrBand): StrandBandStats {
  return strand.bands.find((b) => b.band === band) ?? { band, total: 0, passed: 0, mean: 0 };
}

// ─── Per-skill assessment (continued) ───────────────────────────

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
function assessReading(
  strand: StrandBreakdown,
  completedCount: number,
  placementBand: CefrBand | null,
): SkillAssessment {
  const { level, assumedBands } = highestContiguousBand(
    strand.bands.map((b) => ({
      band: b.band,
      qualifies: b.passed >= MIN_READING_ITEMS,
      evidenced: b.total >= MIN_READING_ITEMS,
    })),
    placementBand,
  );

  if (level) {
    const at = strandBand(strand, level);
    return {
      skill: 'reading',
      level,
      status: 'assessed',
      detail:
        `Understood ${at.passed} of ${at.total} ${level} texts at ${Math.round(READING_COMPREHENSION_PASS * 100)}%+ comprehension.` +
        assumedClause(assumedBands),
      evidenceCount: completedCount,
      assumedBands,
    };
  }

  return {
    skill: 'reading',
    level: null,
    status: 'insufficient_data',
    detail: `Finish ${MIN_READING_ITEMS} texts with comprehension questions at each level from ${placementBand ?? 'A1'} up to be assessed.`,
    evidenceCount: completedCount,
    assumedBands: [],
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
function assessWriting(
  strand: StrandBreakdown,
  placementBand: CefrBand | null,
): SkillAssessment {
  const gradedCount = strand.bands.reduce((sum, b) => sum + b.total, 0);
  const { level, assumedBands } = highestContiguousBand(
    strand.bands.map((b) => ({
      band: b.band,
      qualifies: b.total >= MIN_WRITING_ITEMS && b.mean >= WRITING_PASS_SCORE,
      evidenced: b.total >= MIN_WRITING_ITEMS,
    })),
    placementBand,
  );

  if (level) {
    const at = strandBand(strand, level);
    return {
      skill: 'writing',
      level,
      status: 'assessed',
      detail:
        `Averaged ${Math.round(at.mean * 100)}% across ${at.total} graded ${level} pieces.` +
        assumedClause(assumedBands),
      evidenceCount: gradedCount,
      assumedBands,
    };
  }

  return {
    skill: 'writing',
    level: null,
    status: 'insufficient_data',
    detail: `Submit ${MIN_WRITING_ITEMS} graded pieces at each level from ${placementBand ?? 'A1'} up to be assessed.`,
    evidenceCount: gradedCount,
    assumedBands: [],
  };
}

/**
 * Listening level = highest band, *without skipping a band*, with enough
 * graded listening exercises answered right first time. Minutes of audio are
 * exposure, not proficiency — we record how long audio played, not whether
 * it was understood — and can never produce a level on their own; they only
 * phrase the "never measured" case, exactly as speaking's minutes do.
 *
 * With no graded exercises at all we say `not_assessed` rather than
 * `insufficient_data`: "we have never measured this" and "we have measured it
 * and it is not yet enough" are different things and the learner deserves to
 * be told which.
 */
function assessListening(
  strand: StrandBreakdown,
  minutes: number,
  placementBand: CefrBand | null,
): SkillAssessment {
  const count = strand.bands.reduce((sum, b) => sum + b.total, 0);
  if (count === 0) {
    return {
      skill: 'listening',
      level: null,
      status: 'not_assessed',
      detail:
        minutes > 0
          ? `${Math.round(minutes)} minutes of listening practice logged, but no graded listening exercises yet.`
          : 'No listening practice logged yet.',
      evidenceCount: 0,
      assumedBands: [],
    };
  }

  const { level, assumedBands } = highestContiguousBand(
    strand.bands.map((b) => ({
      band: b.band,
      qualifies: b.total >= MIN_LISTENING_ITEMS && b.mean >= LISTENING_PASS_RATE,
      evidenced: b.total >= MIN_LISTENING_ITEMS,
    })),
    placementBand,
  );

  if (level) {
    const at = strandBand(strand, level);
    return {
      skill: 'listening',
      level,
      status: 'assessed',
      detail:
        `Got ${at.passed} of ${at.total} ${level} listening exercises right first time.` +
        assumedClause(assumedBands),
      evidenceCount: count,
      assumedBands,
    };
  }

  return {
    skill: 'listening',
    level: null,
    status: 'insufficient_data',
    detail: `Answer ${MIN_LISTENING_ITEMS} listening exercises at each level from ${placementBand ?? 'A1'} up to be assessed on listening.`,
    evidenceCount: count,
    assumedBands: [],
  };
}

/**
 * Speaking level = highest band with enough scored attempts averaging at or
 * above the pass score. Shaped like writing rather than reading on purpose:
 * the mean is taken over *every* attempt in the band, failures included, so a
 * learner cannot reach a level by producing ten good attempts among fifty bad
 * ones. Attempts with no CEFR tag (free practice, read-aloud) are ignored.
 *
 * With no scored attempts at all we say `not_assessed` rather than
 * `insufficient_data`: the difference is "we have never measured this" versus
 * "we have measured it and it is not yet enough", and the learner deserves to
 * be told which. `minutes` is exposure from daily_stats and is only ever used
 * to phrase that first case — it can never produce a level on its own.
 */
function assessSpeaking(
  strand: StrandBreakdown,
  attemptCount: number,
  minutes: number,
  placementBand: CefrBand | null,
): SkillAssessment {
  if (attemptCount === 0) {
    return {
      skill: 'speaking',
      level: null,
      status: 'not_assessed',
      detail:
        minutes > 0
          ? `${Math.round(minutes)} minutes of speaking practice logged, but no scored attempts yet.`
          : 'No speaking practice logged yet.',
      evidenceCount: 0,
      assumedBands: [],
    };
  }

  // Same walk as reading and writing. Skipping unevidenced rungs would let ten
  // C1 attempts print "Speaking: C1" off no lower evidence at all — the exact
  // failure `highestContiguousBand` exists to stop.
  const { level, assumedBands } = highestContiguousBand(
    strand.bands.map((b) => ({
      band: b.band,
      qualifies: b.total >= MIN_SPEAKING_ITEMS && b.mean >= SPEAKING_PASS_SCORE,
      evidenced: b.total >= MIN_SPEAKING_ITEMS,
    })),
    placementBand,
  );

  if (level) {
    const at = strandBand(strand, level);
    return {
      skill: 'speaking',
      level,
      status: 'assessed',
      // Not "pronunciation": conversation turns contribute how accurate the
      // language was and how well it came across, alongside scored
      // pronunciation attempts. Naming one source would misdescribe the other.
      detail:
        `Averaged ${Math.round(at.mean * 100)}% across ${at.total} scored ${level} attempts.` +
        assumedClause(assumedBands),
      evidenceCount: attemptCount,
      assumedBands,
    };
  }

  return {
    skill: 'speaking',
    level: null,
    status: 'insufficient_data',
    detail: `Record ${MIN_SPEAKING_ITEMS} scored attempts at each level from ${placementBand ?? 'A1'} up to be assessed on speaking.`,
    evidenceCount: attemptCount,
    assumedBands: [],
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
 * Overall level is the *lowest* assessed strand, and it exists only when
 * EVERY scored strand is assessed. CEFR describes what a learner can reliably
 * do; a person who reads B2 but cannot produce past A2 is not a B2 speaker,
 * and a person whose speaking has never been measured is not yet anything the
 * report can vouch for. Taking the floor over all five is the conservative
 * reading and the one a real examiner would defend — and it is the rule that
 * makes Home's five-strand ring an honest prediction of promotion.
 */
export function overallFromSkills(skills: SkillAssessment[]): CefrBand | null {
  const byKey = new Map(skills.map((s) => [s.skill, s]));
  let lowest: CefrBand | null = null;
  for (const key of SCORED_SKILLS) {
    const skill = byKey.get(key);
    if (!skill || skill.status !== 'assessed' || !skill.level) return null;
    if (!lowest || bandIndex(skill.level) < bandIndex(lowest)) lowest = skill.level;
  }
  return lowest;
}

/** Scored strands that do not hold a level, in ladder order of the UI's rows. */
export function missingSkills(skills: SkillAssessment[]): SkillKey[] {
  const byKey = new Map(skills.map((s) => [s.skill, s]));
  return SCORED_SKILLS.filter((key) => {
    const skill = byKey.get(key);
    return !skill || skill.status !== 'assessed' || !skill.level;
  });
}

// ─── Next level ─────────────────────────────────────────────────

/** Everything `nextLevelSteps` needs beyond the vocabulary bands. */
export interface NextLevelInputs {
  strands: StrandBreakdown[];
  skills: SkillAssessment[];
  totalReviews: number;
  activeDays: number;
}

/**
 * The concrete, countable things standing between the learner and the next
 * band, one line per strand. Vague encouragement is worthless here — the
 * learner should be able to read this and know exactly what to go do.
 *
 * Vocabulary comes first because it is the leading strand: the lessons feed
 * it every day, so it is usually the closest to done. The remaining strands
 * follow in the report's row order, and a final line names the confidence
 * gate when that alone withholds the level — a learner who has done every
 * kind of work at the band but only for two days must be told the level is
 * waiting on time, not on more of the same.
 *
 * With only the vocabulary bands (the legacy call shape) the result is the
 * vocabulary line alone, so older callers and tests keep their answer.
 */
export function nextLevelRequirement(
  current: CefrBand | null,
  bands: BandBreakdown[],
  placementBand: CefrBand | null = null,
  inputs?: NextLevelInputs,
): { nextLevel: CefrBand | null; requirement: string | null; steps: string[] } {
  let target: CefrBand | null;
  if (!current) {
    // A placed learner's first level is proved at their entry band, never by
    // going back to A1 words they were placed past.
    target = placementBand ? nextRungToProve(null, bands) ?? placementBand : 'A1';
  } else {
    target = nextRungToProve(current, bands);
  }
  if (!target) return { nextLevel: null, requirement: null, steps: [] };

  const steps: string[] = [];
  const vocabDone = inputs ? skillHolds(inputs.skills, 'vocabulary', target) : false;
  if (!vocabDone) steps.push(vocabularyStep(target, bands));

  if (inputs) {
    for (const strand of inputs.strands) {
      if (skillHolds(inputs.skills, strand.skill, target)) continue;
      steps.push(strandStep(strand, target));
    }
    const gate = confidenceStep(inputs.totalReviews, inputs.activeDays);
    if (gate) steps.push(gate);
  }

  return { nextLevel: target, requirement: steps.length > 0 ? steps.join(' ') : null, steps };
}

/** True when the strand is assessed at `target` or above. */
function skillHolds(skills: SkillAssessment[], key: SkillKey, target: CefrBand): boolean {
  const skill = skills.find((s) => s.skill === key);
  return !!skill && skill.status === 'assessed' && !!skill.level && bandIndex(skill.level) >= bandIndex(target);
}

/**
 * The next rung the learner has to PROVE: the first band above `current` (from
 * the bottom when nothing is assessed yet) that placement does not already
 * vouch for. Without a placement no band is `placed`, so this is exactly
 * the band after `current`.
 */
function nextRungToProve(current: CefrBand | null, bands: BandBreakdown[]): CefrBand | null {
  const start = current ? bandIndex(current) + 1 : 0;
  for (const band of CEFR_LADDER.slice(start)) {
    const judged = bands.find((b) => b.band === band);
    if (judged?.status !== 'placed') return band;
  }
  return null;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function vocabularyStep(target: CefrBand, bands: BandBreakdown[]): string {
  const targetBand = bands.find((b) => b.band === target);
  if (!targetBand || targetBand.seen < MIN_ITEMS_PER_BAND) {
    const shortfall = MIN_ITEMS_PER_BAND - (targetBand?.seen ?? 0);
    return `Start ${target}: review ${shortfall} more ${target} item${shortfall === 1 ? '' : 's'}.`;
  }

  // Enough of the band met, not enough of it settled. The fix for this state is
  // time spent on cards the learner already has; starting more new ones does
  // nothing for it, so the requirement must not imply otherwise.
  if (targetBand.mature < MIN_MATURE_ITEMS_PER_BAND) {
    const shortfall = MIN_MATURE_ITEMS_PER_BAND - targetBand.mature;
    return `Keep reviewing your ${target} words — ${shortfall} more must reach long-term intervals (${targetBand.mature}/${MIN_MATURE_ITEMS_PER_BAND} so far).`;
  }

  // Against mature, matching the rate that actually gates the band. This is a
  // floor rather than an exact figure: an item the learner retains from here
  // adds to both sides of the ratio, so the last few can take slightly more
  // than the count suggests. Understating the work left would be the worse
  // error, and the number moves with every review anyway.
  const needed = Math.ceil(targetBand.mature * MASTERY_RATE) - targetBand.retained;
  if (needed > 0) {
    return `Retain ${needed} more ${target} item${needed === 1 ? '' : 's'} in long-term review (${targetBand.retained}/${targetBand.mature} so far).`;
  }

  return `${target} vocabulary is on track.`;
}

function strandStep(strand: StrandBreakdown, target: CefrBand): string {
  const at = strandBand(strand, target);
  const pct = Math.round(at.mean * 100);
  switch (strand.skill) {
    case 'reading': {
      const need = Math.max(0, MIN_READING_ITEMS - at.passed);
      return `Reading: understand ${plural(need, `more ${target} text`)} at ${Math.round(READING_COMPREHENSION_PASS * 100)}%+ (${at.passed}/${MIN_READING_ITEMS} so far).`;
    }
    case 'writing': {
      if (at.total < MIN_WRITING_ITEMS) {
        return `Writing: submit ${plural(MIN_WRITING_ITEMS - at.total, `more graded ${target} piece`)} (${at.total}/${MIN_WRITING_ITEMS} so far).`;
      }
      return `Writing: lift your ${target} average to ${Math.round(WRITING_PASS_SCORE * 100)}% (now ${pct}%).`;
    }
    case 'speaking': {
      if (at.total < MIN_SPEAKING_ITEMS) {
        return `Speaking: record ${plural(MIN_SPEAKING_ITEMS - at.total, `more scored ${target} attempt`)} (${at.total}/${MIN_SPEAKING_ITEMS} so far).`;
      }
      return `Speaking: lift your ${target} average to ${Math.round(SPEAKING_PASS_SCORE * 100)}% (now ${pct}%).`;
    }
    case 'listening': {
      if (at.total < MIN_LISTENING_ITEMS) {
        return `Listening: answer ${plural(MIN_LISTENING_ITEMS - at.total, `more ${target} listening exercise`)} (${at.total}/${MIN_LISTENING_ITEMS} so far).`;
      }
      return `Listening: get your ${target} first-try accuracy to ${Math.round(LISTENING_PASS_RATE * 100)}% (now ${pct}%).`;
    }
  }
}

/**
 * The line for the lowest confidence tier when the learner is short of it.
 * Only the `low` tier gates the level (see `buildProficiencyReport`), so
 * this never asks for more than that.
 */
function confidenceStep(totalReviews: number, activeDays: number): string | null {
  const reviewsShort = Math.max(0, CONFIDENCE_TIERS.low.reviews - totalReviews);
  const daysShort = Math.max(0, CONFIDENCE_TIERS.low.activeDays - activeDays);
  if (reviewsShort === 0 && daysShort === 0) return null;
  const parts: string[] = [];
  if (reviewsShort > 0) parts.push(`${plural(reviewsShort, 'more logged review')}`);
  if (daysShort > 0) parts.push(`${plural(daysShort, 'more active day')}`);
  return `Then ${parts.join(' across ')} before a level is published.`;
}

// ─── Entry point ────────────────────────────────────────────────

/**
 * Build the full proficiency report from evidence.
 *
 * @param evidence Aggregated in-app history for ONE target language.
 * @param now Injected clock, so output is deterministic under test.
 * @param options Inputs that are not history — today only the placement band.
 *   Omitted or null, the report is exactly what it was before placement
 *   existed.
 */
export function buildProficiencyReport(
  evidence: ProficiencyEvidence,
  now: Date,
  options: ProficiencyReportOptions = {},
): ProficiencyReport {
  const placementBand = options.placementBand ?? null;
  const bands = analyzeBands(evidence.vocabulary, placementBand);

  const strands: StrandBreakdown[] = [
    readingStrand(evidence.reading),
    writingStrand(evidence.writing),
    listeningStrand(evidence.listening),
    speakingStrand(evidence.speaking),
  ];
  const [readingS, writingS, listeningS, speakingS] = strands;

  const skills: SkillAssessment[] = [
    assessVocabulary(bands, placementBand),
    assessReading(readingS, evidence.reading.filter((i) => i.completed).length, placementBand),
    assessWriting(writingS, placementBand),
    assessListening(listeningS, evidence.listeningMinutes, placementBand),
    assessSpeaking(speakingS, evidence.speaking.length, evidence.speakingMinutes, placementBand),
  ];

  const confidence = assessConfidence(evidence.totalReviews, evidence.activeDays);

  // With no meaningful evidence we withhold the level entirely rather than
  // publish a number the learner would be right not to trust.
  const overallLevel = confidence === 'none' ? null : overallFromSkills(skills);

  const { nextLevel, requirement, steps } = nextLevelRequirement(overallLevel, bands, placementBand, {
    strands,
    skills,
    totalReviews: evidence.totalReviews,
    activeDays: evidence.activeDays,
  });

  // Only rungs under the level actually published count as its basis. A skill
  // that assumed A2 on its way to B2 contributes nothing when the overall level
  // is the A1 another skill pinned it to.
  const assumedBands = overallLevel
    ? CEFR_LADDER.filter(
        (band) =>
          bandIndex(band) < bandIndex(overallLevel) &&
          skills.some((s) => s.status === 'assessed' && s.assumedBands.includes(band)),
      )
    : [];

  return {
    overallLevel,
    confidence,
    skills,
    bands,
    strands,
    missingSkills: overallLevel ? [] : missingSkills(skills),
    nextLevel,
    nextLevelRequirement: requirement,
    nextLevelSteps: steps,
    placementBand,
    assumedBands,
    levelBasis: levelBasis(overallLevel, assumedBands),
    generatedAt: now.toISOString(),
  };
}
