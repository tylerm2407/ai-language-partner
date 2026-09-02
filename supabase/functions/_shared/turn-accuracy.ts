// Score one conversation turn, so conversation can move a measured level.
//
// Pure, no I/O, `deno test`-able. Same split as ai-chat/prompt.ts.
//
// ── What this is for ──
//
// Fluenci expresses progress as a CEFR level with a can-do statement, never
// as points. Until now the most expensive feature in the app contributed
// nothing to that number: `fetchProficiencyEvidence` read review items,
// reading, writing and pronunciation scores, and no conversation source at
// all. A learner could talk to the tutor for a month and their measured level
// would not know it happened.
//
// This module turns what `ai-chat` already produces — a structured correction
// and the learner's own words — into evidence.
//
// ── Two axes, and why they are separate ──
//
// ACCURACY is severity-weighted correction density over words produced. It
// answers "was what they said right", and it covers grammar in the broad
// sense: agreement, tense and word order, plus vocabulary — a word that does
// not make sense in the sentence is an error of production even when it is
// perfectly conjugated.
//
// INTELLIGIBILITY answers "could it be understood", and exists only for
// spoken turns. It is deliberately NOT called a pronunciation score. It comes
// from the speech recogniser's own confidence, which conflates accent, audio
// quality and word rarity; calling that "pronunciation" would claim a
// precision it does not have, and would tell a learner with a regional accent
// that they are mispronouncing words they are saying correctly.
//
// ── Every constant here is an estimate ──
//
// There is no prior art in this repo for either scale and no logged
// distribution to fit them to. They are reasoned, not measured. Expect to
// re-tune against real turns; the thresholds they feed
// (SPEAKING_PASS_SCORE = 0.7 in lib/cefr-proficiency.ts) are the things that
// will show it first.

export type TurnModality = 'speaking' | 'writing';

/** Mirrors the `correction` object ai-chat parses out of the model reply. */
export interface TurnCorrection {
  errorType?: string | null;
  severity?: string | null;
}

export interface TurnScoreInput {
  modality: TurnModality;
  /** The learner's own words. Not the tutor's reply. */
  text: string;
  /** The single correction ai-chat produced for this turn, or null. */
  correction: TurnCorrection | null;
  /** Speech-recogniser confidence, 0-1. Null for typed turns, and for spoken
   *  turns where the provider reported nothing. */
  recognizerConfidence?: number | null;
}

export interface TurnScore {
  accuracy: number;
  intelligibility: number | null;
  wordCount: number;
}

/**
 * How much each severity costs.
 *
 * ai-chat returns at most ONE correction per turn, so the weighted total is
 * capped at 3 — these are a severity multiplier more than a running sum. They
 * stay additive anyway so that a future multi-correction reply needs no new
 * scale here.
 */
const SEVERITY_WEIGHT: Record<string, number> = {
  minor: 1,
  moderate: 2,
  critical: 3,
};

/**
 * Error types that count against production accuracy.
 *
 * `spelling` is absent on purpose for speech: a spoken turn reaches us as a
 * transcript, so "spelling" there is the recogniser's choice of homophone,
 * not the learner's error. It counts for typed turns, where the learner
 * really did choose the letters. See `countsForModality`.
 *
 * `other` is excluded from both. It is the model's escape hatch, and it is
 * not worth lowering a measured proficiency level on an uncategorised
 * observation.
 */
const COUNTED_ERROR_TYPES = new Set([
  'grammar',
  'vocabulary',
  'word_order',
  'tense',
  'gender',
]);

function countsForModality(errorType: string, modality: TurnModality): boolean {
  if (COUNTED_ERROR_TYPES.has(errorType)) return true;
  return errorType === 'spelling' && modality === 'writing';
}

/**
 * How steeply an error discounts the turn.
 *
 * Calibrated against the pass mark it feeds. One moderate error in a
 * twenty-word turn gives 1 - (2/20)*2 = 0.8, comfortably above the 0.7 band
 * pass; one critical error in a ten-word turn gives 0.4, well below it. That
 * is the intended shape — a learner producing long turns with occasional
 * slips is assessed as accurate, and one producing short turns that break
 * meaning is not.
 */
const ERROR_STEEPNESS = 2;

/**
 * Turns shorter than this produce no evidence at all.
 *
 * "Sí." is not a language sample. Scoring it would let a run of one-word
 * answers either inflate a level (no errors are possible in a word) or wreck
 * one (a single correction against a two-word denominator floors the score).
 * Both are worse than having no opinion.
 */
export const MIN_WORDS_FOR_EVIDENCE = 4;

/**
 * Below this recogniser confidence a spoken turn yields no evidence.
 *
 * Not the same judgement as whether to send the turn to the tutor — that gate
 * lives client-side and is about answering the right sentence. This one is
 * about measurement: if we are unsure what was said, we are in no position to
 * score how well it was said.
 */
export const MIN_CONFIDENCE_FOR_EVIDENCE = 0.5;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Words in a learner turn.
 *
 * Whitespace splitting, which undercounts languages that do not space words —
 * Japanese, Chinese, Thai. Accepted rather than solved: the count is only ever
 * a denominator for one turn's own error weight, so a language that reads
 * uniformly "short" shifts its own scale uniformly and the per-band
 * comparison still holds. A real segmenter would be a dependency in an edge
 * function to buy precision nothing downstream reads.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Score one turn, or decline to.
 *
 * Returns null when the turn is not usable evidence: too short, or spoken and
 * not clearly heard. Declining is the important behaviour — a wrong data
 * point in a proficiency measure is worse than a missing one, because the
 * learner acts on the number.
 */
export function scoreTurn(input: TurnScoreInput): TurnScore | null {
  const wordCount = countWords(input.text);
  if (wordCount < MIN_WORDS_FOR_EVIDENCE) return null;

  const confidence =
    typeof input.recognizerConfidence === 'number' && Number.isFinite(input.recognizerConfidence)
      ? clamp01(input.recognizerConfidence)
      : null;

  if (input.modality === 'speaking') {
    // A spoken turn we could not hear tells us nothing about how well it was
    // said. A spoken turn with no confidence reported at all still counts —
    // that is an older `transcribe` deployment, not a bad utterance.
    if (confidence !== null && confidence < MIN_CONFIDENCE_FOR_EVIDENCE) return null;
  }

  const errorType = (input.correction?.errorType ?? '').toString();
  const severity = (input.correction?.severity ?? '').toString();
  const weight =
    input.correction && countsForModality(errorType, input.modality)
      ? SEVERITY_WEIGHT[severity] ?? SEVERITY_WEIGHT.moderate
      : 0;

  const accuracy = clamp01(1 - (weight / wordCount) * ERROR_STEEPNESS);

  return {
    accuracy,
    intelligibility: input.modality === 'speaking' ? confidence : null,
    wordCount,
  };
}

/**
 * The single number a modality is assessed on.
 *
 * Speaking is half how accurate the language was and half how well it came
 * across, because both are part of what "can speak" means — a grammatically
 * perfect sentence nobody can follow has not achieved the can-do statement.
 * When the recogniser reported nothing, accuracy carries the turn alone
 * rather than the turn being dropped.
 *
 * Writing is accuracy alone. There is nothing to hear.
 */
export function combinedScore(score: TurnScore): number {
  if (score.intelligibility === null) return score.accuracy;
  return 0.5 * score.accuracy + 0.5 * score.intelligibility;
}
