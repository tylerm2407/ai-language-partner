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
 *  4. A band is held when its WEIGHTED SCORE across six strands —
 *     interaction, vocabulary, reading, writing, listening, speaking — reaches
 *     `BAND_THRESHOLD`, and every rung beneath it does too.
 *
 *     This replaced a stricter rule: the band used to be held only when every
 *     scored strand held it independently. That rule was more faithful to what
 *     CEFR claims (a band is a conjunction of can-do statements, not a total)
 *     and it is worth being clear that the change cost real rigour. It was
 *     replaced because it made vocabulary a veto over the whole report —
 *     vocabulary being the one strand with a calendar in it, since SM-2 needs
 *     twenty-two days to graduate a card — so a learner who conversed daily
 *     for a month saw no movement at all. The most expensive feature in the
 *     app could not move the number that the app exists to produce.
 *
 *     Two guards keep the weighted rule from collapsing into "talk a lot":
 *     `BAND_THRESHOLD` (0.70) sits above the largest single weight (0.55), so
 *     no strand can carry a band alone; and `MIN_INTERACTION_DAYS` puts the
 *     calendar back, in the strand that now carries the weight, rather than
 *     letting it leave with the veto.
 *
 *     Home's ring draws the same per-band gates the score is built from, so
 *     the ring and the report remain one claim: 99% means one piece of work
 *     away.
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


export type SkillKey =
  | 'interaction'
  | 'vocabulary'
  | 'reading'
  | 'writing'
  | 'listening'
  | 'speaking';

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

// ─── Interaction (live conversation) ────────────────────────────
//
// The strand that carries the majority of the weight. Its unit is a SESSION,
// not a turn: per-turn evidence at ten items a band was priced for a strand
// worth a fifth of the level, and at 0.55 the same gate clears in four days of
// ordinary use. A session is also the honest unit — "I held twelve
// conversations at B1" is the claim the band makes, not "I produced 120 turns".

/**
 * Scored turns a session needs before it counts as a unit at all.
 *
 * A session that produced four scoreable turns was a false start, not a
 * conversation. `scoreTurn` has already thrown away everything under four
 * words, so these are five real contributions.
 */
export const MIN_INTERACTION_TURNS_PER_UNIT = 5;

/**
 * Turns counted from any one session.
 *
 * Without a cap, one marathon session clears a band's whole volume gate — the
 * exact failure the move from turns to sessions was meant to fix, reintroduced
 * through the mean. Twelve is comfortably more than a good fifteen-minute
 * session produces, so it only ever bites the outlier.
 */
export const MAX_INTERACTION_TURNS_COUNTED = 12;

/** Qualifying sessions in a band before it informs the interaction level. */
export const MIN_INTERACTION_UNITS = 12;

/**
 * Distinct days those sessions must span.
 *
 * The calendar term. Every other gate in this module can be cleared by a
 * determined learner in a weekend, and vocabulary's twenty-two-day SM-2
 * maturity wall used to be the only thing making a band mean elapsed time —
 * a role it can no longer play now that it is 0.12 of the score and not a
 * veto. Twelve days of conversation is a different claim from twelve
 * conversations, and it is the one a band should rest on.
 */
export const MIN_INTERACTION_DAYS = 12;

/** Mean turn score at which interaction in a band counts as solid. */
export const INTERACTION_PASS_SCORE = 0.7;

// ─── Weighting ──────────────────────────────────────────────────

/**
 * How much each strand contributes to a band's score.
 *
 * Live conversation carries the majority deliberately: it is the most
 * expensive thing the app does, the closest proxy for what a learner actually
 * wants to be able to do, and until `conversation_evidence` existed it moved
 * the measured level by nothing at all.
 *
 * `speaking` is now pronunciation attempts alone — scored read-alouds against
 * a known target. Conversation left it for `interaction`, because spoken
 * production and spoken interaction are different CEFR claims and pooling them
 * let a run of read-alouds stand in for ever having held a conversation.
 *
 * Must sum to 1. `weightsSumToOne` asserts it in the test suite rather than
 * here, so a bad edit fails a test instead of throwing at runtime in a
 * learner's report.
 */
export const STRAND_WEIGHTS: Record<SkillKey, number> = {
  interaction: 0.55,
  vocabulary: 0.12,
  listening: 0.09,
  reading: 0.08,
  writing: 0.08,
  speaking: 0.08,
};

/**
 * The weighted score a band must reach to be held.
 *
 * Chosen against the interaction weight, and the gap between them is
 * load-bearing. Interaction alone tops out at 0.55, so conversation — however
 * much of it, however good — can never publish a band by itself; it needs
 * roughly one other strand at half strength. That is what keeps "the majority
 * of the weight" from becoming "the only evidence", and it is the reason not
 * to quietly lower this to 0.55 later when a learner complains that their
 * level is stuck.
 */
export const BAND_THRESHOLD = 0.7;

/** The strands that contribute to a band's weighted score. */
export const SCORED_SKILLS: SkillKey[] = [
  'interaction',
  'vocabulary',
  'reading',
  'writing',
  'listening',
  'speaking',
];

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

/**
 * One answered orthography item — currently `script_choice`, "which is the
 * kanji for さかな (Fish)?". Correctness only, like listening: there is nothing
 * to score on a four-way choice beyond whether it was right.
 */
export interface OrthographyEvidenceItem {
  cefrLevel: string | null;
  /** First-attempt correctness. A recovered second try is `false`. */
  correct: boolean;
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

/**
 * One scored conversation turn, with what it takes to group turns into
 * sessions. Grouping happens here rather than in the query layer so the unit
 * rules — turns per session, the per-session cap, the day spread — are
 * testable without a database.
 */
export interface InteractionTurnItem {
  /** The band the conversation was held at. See `conversationCefrBand`. */
  cefrLevel: string | null;
  /**
   * The session this turn came from. Turns with no session cannot be grouped
   * and are dropped: before `chat_session_id` was stamped there was no way to
   * tell one conversation from ten, and counting an ungrouped turn as its own
   * session would rebuild exactly the per-turn gate this replaced.
   */
  sessionId: string | null;
  /** Local calendar day, `YYYY-MM-DD`, for the spread requirement. */
  day: string;
  /** `combineConversationScore` of the stored components, 0–1. */
  score: number;
}

export interface ProficiencyEvidence {
  /** Scored conversation turns (migration 095), chat and live tutor alike. */
  interaction: InteractionTurnItem[];
  vocabulary: VocabEvidenceItem[];
  reading: ReadingEvidenceItem[];
  writing: WritingEvidenceItem[];
  /** Answered orthography items; they strengthen writing, never carry it. */
  orthography: OrthographyEvidenceItem[];
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
  /**
   * Interaction only: distinct calendar days the qualifying sessions span.
   * Absent for every other strand, which has no calendar term.
   */
  days?: number;
}

export interface StrandBreakdown {
  skill: Exclude<SkillKey, 'vocabulary'>;
  bands: StrandBandStats[];
}

/** One strand's contribution to a band's weighted score. */
export interface StrandContribution {
  skill: SkillKey;
  /** 0–1, how far this strand is toward holding the band. */
  gate: number;
  weight: number;
  /** `gate * weight` — what this strand actually adds to the band score. */
  contribution: number;
}

/** The full arithmetic behind one band's verdict, so the UI can show its work. */
export interface BandScore {
  band: CefrBand;
  /** 0–1, the weighted sum. Held when `>= BAND_THRESHOLD`. */
  score: number;
  held: boolean;
  strands: StrandContribution[];
}

export interface ProficiencyReport {
  /**
   * The level the app SHOWS and pitches content at.
   *
   * Usually the practice estimate. It is the tested band instead when practice
   * has measured nothing at all — see `levelSource` and
   * `ProficiencyReportOptions.checkpointBand` for why that exception exists and
   * why it is only that one direction.
   */
  overallLevel: CefrBand | null;
  /**
   * The weighted six-strand estimate from practice history alone — what
   * `overallLevel` used to be, unconditionally.
   *
   * Kept separate because the two answer different questions and the UI needs
   * both. Progress toward the next band is a fact about PRACTICE: a learner
   * whose level was published by a test has proved nothing in the strand model
   * yet, so drawing their ring against the band after the tested one would
   * report ~0% toward a band they were never working on. The ring reads this;
   * the hero reads `overallLevel`.
   */
  practiceLevel: CefrBand | null;
  /** The band from the learner's most recent completed checkpoint, if any. */
  testedLevel: CefrBand | null;
  /**
   * Where `overallLevel` came from. Null when there is no level at all.
   *
   * `'test'` is the gap-filler: five minutes of fresh graded questions, which
   * is real evidence but does not measure live conversation at all — and
   * conversation is 0.55 of the practice model. So a test never displaces a
   * practice level, and this field exists so no surface can imply it did.
   */
  levelSource: 'practice' | 'test' | null;
  confidence: Confidence;
  skills: SkillAssessment[];
  bands: BandBreakdown[];
  /** Per-band evidence for the five non-vocabulary strands, ladder order. */
  strands: StrandBreakdown[];
  /**
   * Every band's weighted score and the per-strand contributions behind it,
   * in ladder order. This is the arithmetic the level comes from, kept on the
   * report so the UI can show its work rather than asserting a band.
   */
  bandScores: BandScore[];
  /**
   * Strands with no evidence at all at `nextLevel` — where the cheapest
   * remaining points are. Under the old all-strands rule this was the list of
   * things withholding the level; nothing withholds it now, so this is
   * guidance, not a gate.
   */
  unevidencedSkills: SkillKey[];
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
  /**
   * The band from the learner's most recent COMPLETED checkpoint.
   *
   * WHY A TEST MAY PUBLISH A LEVEL, AND ONLY HERE
   *
   * Credibility rule 1 at the top of this file says we never report a level we
   * cannot evidence. A graded checkpoint is evidence — fresh items the learner
   * has not seen, chosen server-side, graded server-side, now spread across
   * three bands so the result locates a band rather than nudging one (see
   * `bandFromStaircase` in supabase/functions/checkpoint/checkpoint-core.ts).
   * What it is not is BETTER evidence than the practice model, for one concrete
   * reason: it does not measure live conversation, and conversation is 0.55 of
   * the practice score. A five-minute test of listening, reading, writing and
   * speaking cannot outrank weeks of the thing the app is actually for.
   *
   * So the rule is one-directional and deliberately unclever: the tested band
   * is published only when practice has measured NOTHING. Not the higher of the
   * two, not the more recent — either would let a learner choose their level by
   * testing on a good day, which is the self-assigned band this module exists
   * to prevent.
   *
   * What this buys: the twelve-day floor stops being a wall. `MIN_INTERACTION_DAYS`
   * plus the `CONFIDENCE_TIERS.low` gate meant a new learner saw "Not yet
   * assessed" for a fortnight no matter what they did, on the one screen whose
   * whole job is to tell them where they are.
   */
  checkpointBand?: CefrBand | null;
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
export function levelBasis(
  level: CefrBand | null,
  assumed: CefrBand[],
  source: 'practice' | 'test' | null = 'practice',
): string | null {
  if (!level) return null;
  // A tested level has no assumed rungs to disclose — the test asked directly —
  // but it has a different thing to disclose, which is that it is not the
  // practice estimate the rest of the screen is about.
  if (source === 'test') {
    return 'From your level test. Your practice history has not measured a level yet.';
  }
  if (assumed.length === 0) return null;
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

/**
 * Graded submissions, plus orthography items at a strict cap. The band gates on
 * the mean, not on a pass count.
 *
 * ORTHOGRAPHY CAN STRENGTHEN A WRITING BAND; IT CANNOT CONJURE ONE. Knowing
 * which characters write a word is part of writing a language that has more
 * than one script, so answering `script_choice` items belongs in this strand
 * rather than nowhere. But a four-way choice is not a piece of prose, and
 * without a bound twenty correct taps would hold a band no one had ever
 * written a sentence in. So orthography items count only up to HALF the band's
 * graded submissions, most recent first: a band with no prose counts none of
 * them, and a band with six counts at most three.
 *
 * The consequence to keep in mind when reading a report: writing's mean is no
 * longer purely prose. It is prose plus a bounded orthography contribution,
 * and `ORTHOGRAPHY_TO_PROSE_RATIO` is the whole of the bound.
 */
export const ORTHOGRAPHY_TO_PROSE_RATIO = 0.5;

export function writingStrand(
  items: WritingEvidenceItem[],
  orthography: OrthographyEvidenceItem[] = [],
): StrandBreakdown {
  const m = emptyStrandBands();
  for (const item of items) {
    if (item.overallScore === null) continue;
    const band = normalizeBand(item.cefrLevel);
    if (!band) continue;
    const b = m.get(band)!;
    b.total += 1;
    b.sum += item.overallScore;
  }
  // Bucket first so the cap is applied per band, against that band's prose.
  const byBand = new Map<CefrBand, OrthographyEvidenceItem[]>();
  for (const item of orthography) {
    const band = normalizeBand(item.cefrLevel);
    if (!band) continue;
    if (!byBand.has(band)) byBand.set(band, []);
    byBand.get(band)!.push(item);
  }
  for (const [band, answered] of byBand) {
    const b = m.get(band)!;
    const allowed = Math.floor(b.total * ORTHOGRAPHY_TO_PROSE_RATIO);
    for (const item of answered.slice(0, allowed)) {
      b.total += 1;
      if (item.correct) b.sum += 1;
    }
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

/**
 * Group scored turns into session units, per band.
 *
 * Three rules, each answering a way the per-turn version could be gamed or
 * misread:
 *
 *  - A session needs `MIN_INTERACTION_TURNS_PER_UNIT` scored turns to count at
 *    all. Fewer is a false start, not a conversation.
 *  - At most `MAX_INTERACTION_TURNS_COUNTED` turns from any one session feed
 *    the mean, so a marathon session cannot swamp the average in either
 *    direction. The turns kept are the first ones, which is the part of a
 *    session a learner actually sustained rather than the tail where the
 *    tutor is carrying it.
 *  - `days` counts distinct calendar days across qualifying sessions, so the
 *    band carries elapsed time and not just volume.
 *
 * A session held across midnight is attributed to the day of its first counted
 * turn, which is the day the learner would say they practised.
 */
export function interactionStrand(turns: InteractionTurnItem[]): StrandBreakdown {
  // band -> sessionId -> that session's turns, in the order they arrived.
  const bySession = new Map<CefrBand, Map<string, { scores: number[]; day: string }>>();
  CEFR_LADDER.forEach((band) => bySession.set(band, new Map()));

  for (const turn of turns) {
    const band = normalizeBand(turn.cefrLevel);
    if (!band || !turn.sessionId) continue;
    const sessions = bySession.get(band)!;
    const existing = sessions.get(turn.sessionId);
    if (existing) {
      existing.scores.push(turn.score);
    } else {
      sessions.set(turn.sessionId, { scores: [turn.score], day: turn.day });
    }
  }

  return {
    skill: 'interaction',
    bands: CEFR_LADDER.map((band) => {
      const sessions = bySession.get(band)!;
      const days = new Set<string>();
      let units = 0;
      let sum = 0;
      let counted = 0;

      for (const session of sessions.values()) {
        if (session.scores.length < MIN_INTERACTION_TURNS_PER_UNIT) continue;
        units += 1;
        days.add(session.day);
        for (const score of session.scores.slice(0, MAX_INTERACTION_TURNS_COUNTED)) {
          sum += score;
          counted += 1;
        }
      }

      return {
        band,
        total: units,
        // Interaction gates on the mean, as writing and speaking do.
        passed: units,
        mean: counted > 0 ? sum / counted : 0,
        days: days.size,
      };
    }),
  };
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

/**
 * Interaction level = highest band, without skipping a band, with enough
 * qualifying sessions, spread over enough days, averaging at or above the pass
 * score. Shaped like writing and speaking — the mean is over every counted
 * turn in the band, failures included — so a learner cannot reach a level by
 * having twelve good conversations among fifty bad ones.
 *
 * With no qualifying session at all we say `not_assessed` rather than
 * `insufficient_data`, the same distinction speaking and listening draw: "we
 * have never measured this" and "we have measured it and it is not yet enough"
 * are different things.
 */
function assessInteraction(
  strand: StrandBreakdown,
  placementBand: CefrBand | null,
): SkillAssessment {
  const count = strand.bands.reduce((sum, b) => sum + b.total, 0);
  if (count === 0) {
    return {
      skill: 'interaction',
      level: null,
      status: 'not_assessed',
      detail: 'No conversations long enough to score yet.',
      evidenceCount: 0,
      assumedBands: [],
    };
  }

  const { level, assumedBands } = highestContiguousBand(
    strand.bands.map((b) => ({
      band: b.band,
      qualifies:
        b.total >= MIN_INTERACTION_UNITS &&
        (b.days ?? 0) >= MIN_INTERACTION_DAYS &&
        b.mean >= INTERACTION_PASS_SCORE,
      evidenced: b.total >= MIN_INTERACTION_UNITS,
    })),
    placementBand,
  );

  if (level) {
    const at = strandBand(strand, level);
    return {
      skill: 'interaction',
      level,
      status: 'assessed',
      detail:
        `Held ${at.total} ${level} conversations across ${at.days ?? 0} days, averaging ${Math.round(at.mean * 100)}%.` +
        assumedClause(assumedBands),
      evidenceCount: count,
      assumedBands,
    };
  }

  return {
    skill: 'interaction',
    level: null,
    status: 'insufficient_data',
    detail:
      `Hold ${MIN_INTERACTION_UNITS} conversations of ${MIN_INTERACTION_TURNS_PER_UNIT}+ turns ` +
      `across ${MIN_INTERACTION_DAYS} days at each level from ${placementBand ?? 'A1'} up to be assessed.`,
    evidenceCount: count,
    assumedBands: [],
  };
}

// ─── Per-band gates and the weighted score ──────────────────────
//
// One continuous 0–1 number per strand per band, and the weighted sum over
// them. This is the whole of the level rule now: the old `overallFromSkills`
// took the lowest of five strands and returned null unless every one of them
// was assessed, which made vocabulary a veto over a learner's entire report.
//
// These gates are also what Home's ring draws, imported rather than
// reimplemented, so the ring and the published level can never disagree about
// how far along a band is.

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * The three vocabulary conditions `analyzeBands` needs before a band is
 * mastered, a third each: items seen, items matured, items retained.
 */
export function vocabularyGate(band: CefrBand, bands: readonly BandBreakdown[]): number {
  const at = bands.find((b) => b.band === band);
  if (!at) return 0;
  const seenGate = clamp01(at.seen / MIN_ITEMS_PER_BAND);
  const matureGate = clamp01(at.mature / MIN_MATURE_ITEMS_PER_BAND);
  // Measured against the mature set, as the band rule is. Nothing mature yet
  // means nothing can be retained yet.
  const retainNeeded = Math.ceil(at.mature * MASTERY_RATE);
  const retainGate = retainNeeded > 0 ? clamp01(at.retained / retainNeeded) : 0;
  return (seenGate + matureGate + retainGate) / 3;
}

/**
 * Volume and quality, half each, for the non-vocabulary strands.
 *
 * Two exceptions, both because the strand's band rule has a different shape:
 *
 *  - Reading counts passed pieces rather than a mean, so its gate is the
 *    passed count alone. A piece that failed comprehension is not partial
 *    progress toward "understood three texts".
 *  - Interaction's volume half is the WORSE of its two volume conditions,
 *    sessions and days. Taking the mean of them would let a learner who held
 *    twelve conversations in one weekend read as three-quarters done on a
 *    requirement whose whole point is elapsed time.
 */
export function strandGate(strand: StrandBreakdown | undefined, band: CefrBand): number {
  if (!strand) return 0;
  const at = strand.bands.find((b) => b.band === band);
  if (!at || at.total === 0) return 0;
  switch (strand.skill) {
    case 'reading':
      return clamp01(at.passed / MIN_READING_ITEMS);
    case 'writing':
      return 0.5 * clamp01(at.total / MIN_WRITING_ITEMS) + 0.5 * clamp01(at.mean / WRITING_PASS_SCORE);
    case 'speaking':
      return 0.5 * clamp01(at.total / MIN_SPEAKING_ITEMS) + 0.5 * clamp01(at.mean / SPEAKING_PASS_SCORE);
    case 'listening':
      return 0.5 * clamp01(at.total / MIN_LISTENING_ITEMS) + 0.5 * clamp01(at.mean / LISTENING_PASS_RATE);
    case 'interaction': {
      const volume = Math.min(
        clamp01(at.total / MIN_INTERACTION_UNITS),
        clamp01((at.days ?? 0) / MIN_INTERACTION_DAYS),
      );
      return 0.5 * volume + 0.5 * clamp01(at.mean / INTERACTION_PASS_SCORE);
    }
  }
}

/** Everything the band score is computed from. */
export interface BandScoreInputs {
  bands: BandBreakdown[];
  strands: StrandBreakdown[];
}

/**
 * The weighted score for one band, with every strand's contribution kept so
 * the report can explain the number instead of asserting it.
 *
 * A strand already assessed at or above `band` contributes its full weight
 * regardless of the raw gate: finished work must never read as unfinished, and
 * the contiguity walk means a strand assessed at B2 has already satisfied B1.
 */
export function scoreBand(
  band: CefrBand,
  inputs: BandScoreInputs,
  skills: SkillAssessment[] = [],
): BandScore {
  const strands: StrandContribution[] = SCORED_SKILLS.map((skill) => {
    const weight = STRAND_WEIGHTS[skill];
    const gate = skillHolds(skills, skill, band)
      ? 1
      : skill === 'vocabulary'
        ? vocabularyGate(band, inputs.bands)
        : strandGate(
            inputs.strands.find((s) => s.skill === skill),
            band,
          );
    const clamped = clamp01(gate);
    return { skill, gate: clamped, weight, contribution: clamped * weight };
  });

  const score = strands.reduce((sum, s) => sum + s.contribution, 0);
  return { band, score, held: score >= BAND_THRESHOLD, strands };
}

/** Every band's score, in ladder order. */
export function scoreBands(
  inputs: BandScoreInputs,
  skills: SkillAssessment[] = [],
): BandScore[] {
  return CEFR_LADDER.map((band) => scoreBand(band, inputs, skills));
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
 * Overall level = the highest band whose weighted score clears
 * `BAND_THRESHOLD`, without skipping a band.
 *
 * ── What this replaced, and what was given up ──
 *
 * This used to be the *lowest* assessed strand, published only when EVERY
 * scored strand was assessed. That rule was the conservative one and it had a
 * real virtue: a band meant the learner could do all five things, which is
 * what CEFR actually claims. It also had two costs that decided against it.
 *
 * First, it made vocabulary a veto rather than a weight. Vocabulary is the
 * only strand fed passively by daily lessons and the only one with a calendar
 * in it (SM-2 needs twenty-two days to graduate a card), so in practice the
 * measured level moved at the pace of flashcards no matter what else the
 * learner did. Second, and worse for this product: a learner could talk to the
 * tutor every day for a month and the number would not move, because
 * conversation fed the speaking pool that vocabulary was already vetoing.
 *
 * The weighted blend is COMPENSATORY and the old rule was not. That is a real
 * loss of rigour — strength in conversation can now offset thin reading — and
 * it is why `BAND_THRESHOLD` sits above the interaction weight: no single
 * strand, conversation included, can carry a band alone. It is also why the
 * calendar term moved into `MIN_INTERACTION_DAYS` rather than being dropped
 * with the veto.
 *
 * Contiguity survives the change and is doing more work than before. A band is
 * held only if every rung beneath it is too, so a burst of hard material
 * cannot print a level with nothing under it — the failure
 * `highestContiguousBand` has always existed to stop.
 */
export function overallFromBands(
  scores: BandScore[],
  placementBand: CefrBand | null = null,
): { level: CefrBand | null; assumedBands: CefrBand[] } {
  return highestContiguousBand(
    scores.map((s) => ({
      band: s.band,
      qualifies: s.held,
      // A band nobody has touched is not evidence against the learner, it is
      // absence of evidence — which is what `placed` is for. Any contribution
      // at all makes the band evidenced and therefore judged on its score.
      evidenced: s.strands.some((strand) => strand.gate > 0),
    })),
    placementBand,
  );
}

/**
 * Strands contributing nothing at the band the learner is working toward, in
 * the UI's row order.
 *
 * Under the old AND-gate this listed the strands standing between the learner
 * and a level, because any one of them could withhold it. Nothing withholds a
 * level now — the score is a sum — so this is the weaker, honest claim: these
 * are the strands with no evidence at `target`, which is where the cheapest
 * remaining points are.
 */
export function unevidencedSkills(score: BandScore | undefined): SkillKey[] {
  if (!score) return [...SCORED_SKILLS];
  return score.strands.filter((s) => s.gate <= 0).map((s) => s.skill);
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

  // Conversation leads, because it is 0.55 of the score: it is where the work
  // pays best, and a requirement list that opened with flashcards would be
  // telling the learner to spend their fifteen minutes on the cheapest strand
  // in the model.
  const interaction = inputs?.strands.find((s) => s.skill === 'interaction');
  if (inputs && interaction && !skillHolds(inputs.skills, 'interaction', target)) {
    steps.push(strandStep(interaction, target));
  }

  const vocabDone = inputs ? skillHolds(inputs.skills, 'vocabulary', target) : false;
  if (!vocabDone) steps.push(vocabularyStep(target, bands));

  if (inputs) {
    for (const strand of inputs.strands) {
      if (strand.skill === 'interaction') continue;
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
    case 'interaction': {
      // Sessions and days are separate asks and a learner short of both needs
      // to be told both — "hold 4 more conversations" is actively misleading
      // when the real constraint is that they all happened this weekend.
      const sessionsShort = Math.max(0, MIN_INTERACTION_UNITS - at.total);
      const daysShort = Math.max(0, MIN_INTERACTION_DAYS - (at.days ?? 0));
      if (sessionsShort > 0 || daysShort > 0) {
        const parts: string[] = [];
        if (sessionsShort > 0) {
          parts.push(
            `${plural(sessionsShort, `more ${target} conversation`)} of ${MIN_INTERACTION_TURNS_PER_UNIT}+ turns`,
          );
        }
        if (daysShort > 0) parts.push(`${plural(daysShort, 'more day')} of practice`);
        return `Conversation: ${parts.join(', and ')} (${at.total}/${MIN_INTERACTION_UNITS} conversations across ${at.days ?? 0}/${MIN_INTERACTION_DAYS} days).`;
      }
      return `Conversation: lift your ${target} average to ${Math.round(INTERACTION_PASS_SCORE * 100)}% (now ${pct}%).`;
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
    interactionStrand(evidence.interaction),
    readingStrand(evidence.reading),
    writingStrand(evidence.writing, evidence.orthography),
    listeningStrand(evidence.listening),
    speakingStrand(evidence.speaking),
  ];
  const [interactionS, readingS, writingS, listeningS, speakingS] = strands;

  const skills: SkillAssessment[] = [
    assessInteraction(interactionS, placementBand),
    assessVocabulary(bands, placementBand),
    assessReading(readingS, evidence.reading.filter((i) => i.completed).length, placementBand),
    assessWriting(writingS, placementBand),
    assessListening(listeningS, evidence.listeningMinutes, placementBand),
    assessSpeaking(speakingS, evidence.speaking.length, evidence.speakingMinutes, placementBand),
  ];

  const confidence = assessConfidence(evidence.totalReviews, evidence.activeDays);
  const bandScores = scoreBands({ bands, strands }, skills);

  // With no meaningful evidence we withhold the level entirely rather than
  // publish a number the learner would be right not to trust.
  const blended =
    confidence === 'none'
      ? { level: null, assumedBands: [] as CefrBand[] }
      : overallFromBands(bandScores, placementBand);
  const practiceLevel = blended.level;

  // The tested band fills the gap when practice cannot speak, and never
  // otherwise. See `ProficiencyReportOptions.checkpointBand`.
  const testedLevel = options.checkpointBand ?? null;
  const overallLevel = practiceLevel ?? testedLevel;
  const levelSource: 'practice' | 'test' | null = practiceLevel
    ? 'practice'
    : testedLevel
      ? 'test'
      : null;

  // Computed from the PRACTICE level, not the published one. What the learner
  // has to do next is a fact about the strand model: a test-published B1 has
  // proved no rung of it, so asking them for B2 evidence would be asking for
  // work on a band they have no A1 or A2 practice behind. The requirement is
  // "prove your first band", exactly as it was before the test could publish.
  const { nextLevel, requirement, steps } = nextLevelRequirement(practiceLevel, bands, placementBand, {
    strands,
    skills,
    totalReviews: evidence.totalReviews,
    activeDays: evidence.activeDays,
  });

  // Placement disclosure has two sources and needs both.
  //
  // The band walk reports rungs IT stepped over — bands with no contribution
  // from any strand, below the placement band. But a strand assessed at B1 is
  // credited at full weight for A1 and A2 (finished work must not read as
  // unfinished), which makes those rungs "evidenced" as far as the walk can
  // see, even when the strand itself only reached B1 by assuming them. Reading
  // the walk alone would therefore drop the disclosure precisely for the
  // placed learner it exists to protect — the one whose level genuinely rests
  // on rungs nobody measured.
  //
  // So: rungs under the published level that either the walk assumed, or an
  // assessed strand assumed on its own way up.
  const assumedBands = practiceLevel
    ? CEFR_LADDER.filter(
        (band) =>
          bandIndex(band) < bandIndex(practiceLevel) &&
          (blended.assumedBands.includes(band) ||
            skills.some((s) => s.status === 'assessed' && s.assumedBands.includes(band))),
      )
    : [];

  return {
    overallLevel,
    practiceLevel,
    testedLevel,
    levelSource,
    confidence,
    skills,
    bands,
    strands,
    bandScores,
    unevidencedSkills: unevidencedSkills(bandScores.find((s) => s.band === nextLevel)),
    nextLevel,
    nextLevelRequirement: requirement,
    nextLevelSteps: steps,
    placementBand,
    assumedBands,
    levelBasis: levelBasis(overallLevel, assumedBands, levelSource),
    generatedAt: now.toISOString(),
  };
}
