/**
 * Grading a spoken answer in a hands-free session.
 *
 * This sits between transcription and the session reducer, and exists to
 * answer one question the on-screen path never has to ask: *did we actually
 * hear the learner?*
 *
 * On screen, a wrong answer is a wrong answer — the learner typed it. In a car
 * it is not. Road noise, a passing truck, a bad Bluetooth mic, or the learner
 * simply being cut off all produce a transcript that looks like a failed
 * attempt but evidences nothing about recall. Feeding those into SM-2 would
 * let a noisy commute silently demote material the learner knows, and the
 * damage compounds: shorter intervals mean more reviews, which means more
 * chances to be mis-heard.
 *
 * So this module refuses to grade when confidence is low, and returns
 * `low_confidence` instead. The session reducer treats that exactly like an
 * aborted listen: re-ask, never score.
 *
 * Grading itself is delegated to `gradeSpeechTranscription` unchanged, so
 * spoken answers in a lesson and spoken answers in a hands-free session cannot
 * drift apart.
 */

import { gradeSpeechTranscription, speechScoreToRating } from './grading';
import type { FeedbackPhraseKey } from './handsfree-session';
import type { ReviewRating } from '../types';

// ─── Getting the transcript: scored when possible, transcribed otherwise ──
//
// A hands-free session used to transcribe every answer through `transcribe`
// and grade it on the device. That produced review_items and review_logs —
// the SRS half of the loop — and NOTHING for the speaking strand: the CEFR
// report's speaking level is built from `pronunciation_scores` alone, and a
// twenty-minute commute of spoken answers left that table untouched. A
// learner could speak every day and still be `not_assessed` at speaking.
//
// `score-pronunciation` transcribes AND persists a scored row against the
// card, and returns the transcription, so one call now does both jobs. The
// on-device grading is unchanged — it grades whatever transcript comes back,
// from either source, so a scored turn and a transcribed one cannot drift in
// how they are marked.
//
// The rule that matters: scoring may fail, and the session may not. The
// daily scoring allowance is small (3–7 on paid tiers, 0 on free) and the
// function can be down; either way the answer is still transcribed the old
// way and the session keeps going. Evidence is the bonus; the drive is the
// product.

/** What `score-pronunciation` returns in place of a transcript its safety
 *  check rejected. Mirrors the literal in the edge function. */
export const TRANSCRIPTION_UNAVAILABLE = '[transcription unavailable]';

/**
 * Consecutive scoring failures before the session stops trying.
 *
 * One transient failure should not cost twenty minutes of evidence, but
 * a function that is down would otherwise be asked once per card, each ask
 * a retried round trip before the fallback even starts — that latency is
 * paid in a car. Two in a row is the compromise. A spent allowance skips
 * straight to the cap: it is settled for the day and asking again only
 * wastes the round trip.
 */
export const MAX_SCORING_STRIKES = 2;

/** The server code for a spent daily allowance. Mirrors score-pronunciation. */
export const PRONUNCIATION_LIMIT_CODE = 'DAILY_PRONUNCIATION_LIMIT_REACHED';

export interface HandsFreeTurnTranscript {
  text: string;
  /** Whisper's confidence signals — only the plain transcriber reports them.
   *  A scored turn carries nulls, which `sttConfidence` reads as neutral. */
  noSpeechProb: number | null;
  avgLogprob: number | null;
  /** True when a `pronunciation_scores` row was written for this turn. */
  scored: boolean;
}

export interface TranscribeHandsFreeTurnDeps {
  /** Consecutive scoring failures so far this session. */
  scoringStrikes: number;
  /** `scorePronunciation` for this card. */
  score: () => Promise<{ transcription?: string | null }>;
  /** `transcribeAudio` — the fallback. */
  transcribe: () => Promise<{ text: string; noSpeechProb: number | null; avgLogprob: number | null }>;
}

export interface TranscribeHandsFreeTurnResult {
  transcript: HandsFreeTurnTranscript;
  /** Strikes for the caller to hold for the next turn. */
  scoringStrikes: number;
  /** Why the fallback was used, when it was. `null` on a scored turn. */
  fallbackReason: 'strikes' | 'error' | null;
}

/** Is this the server saying the allowance is spent for the day? */
function isQuotaError(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === PRONUNCIATION_LIMIT_CODE;
}

/**
 * Transcribe one hands-free answer, through scoring when scoring is available.
 *
 * Pure apart from the two injected calls, so the fallback policy — which is
 * the part that decides whether a drive is interrupted — is testable without
 * a network or a microphone.
 */
export async function transcribeHandsFreeTurn(
  deps: TranscribeHandsFreeTurnDeps,
): Promise<TranscribeHandsFreeTurnResult> {
  if (deps.scoringStrikes >= MAX_SCORING_STRIKES) {
    const plain = await deps.transcribe();
    return {
      transcript: { ...plain, scored: false },
      scoringStrikes: deps.scoringStrikes,
      fallbackReason: 'strikes',
    };
  }

  let scored: { transcription?: string | null };
  try {
    scored = await deps.score();
  } catch (err) {
    // The answer still has to be heard: fall back, and remember the failure.
    const plain = await deps.transcribe();
    return {
      transcript: { ...plain, scored: false },
      scoringStrikes: isQuotaError(err) ? MAX_SCORING_STRIKES : deps.scoringStrikes + 1,
      fallbackReason: 'error',
    };
  }

  // A safety-rejected transcript is not re-transcribed: the plain path would
  // hand back the very text the server declined to echo. An empty transcript
  // grades as `low_confidence`, and the card is simply asked again.
  const text =
    typeof scored.transcription === 'string' && scored.transcription !== TRANSCRIPTION_UNAVAILABLE
      ? scored.transcription
      : '';
  return {
    transcript: { text, noSpeechProb: null, avgLogprob: null, scored: true },
    scoringStrikes: 0,
    fallbackReason: null,
  };
}

/**
 * Signals from the transcription provider.
 *
 * `transcribe` now surfaces both — it always asked Whisper for `verbose_json`
 * and used to discard the `segments[]` these are folded out of. They stay
 * nullable because an older deployment of that function returns neither, and
 * a null must keep degrading to a neutral value rather than failing the turn
 * closed.
 */
export interface SttConfidenceSignal {
  /** Whisper's probability the clip is silence. 0–1, higher is worse. */
  noSpeechProb: number | null;
  /** Whisper's mean token log-probability. Negative; closer to 0 is better. */
  avgLogprob: number | null;
  transcript: string;
  /** How much speech the endpointer actually measured. */
  speechDurationMs: number;
}

/** Confidence assumed when the provider reports nothing. */
export const NEUTRAL_CONFIDENCE = 0.75;

/**
 * Below this, the answer is re-asked rather than graded.
 *
 * Sits below NEUTRAL_CONFIDENCE so that missing signals never trip it.
 */
export const HANDSFREE_MIN_CONFIDENCE = 0.55;

/**
 * Below this, a spoken conversation turn is re-asked rather than sent.
 *
 * Same signal and the same number as the hands-free gate, named separately
 * because the two answer different questions and may need to diverge. Grading
 * asks "may this write to the SM-2 schedule"; conversation asks "may this be
 * sent to the tutor". The costs are comparable — a garbled turn earns a
 * non-sequitur reply and, worse, a grammar correction aimed at a word the
 * learner never said. That last one is a named complaint about a competitor
 * and is exactly what this gate exists to prevent.
 */
export const CHAT_MIN_CONFIDENCE = 0.55;

/** avg_logprob at or above this is treated as fully confident. */
const LOGPROB_CEILING = -0.1;

/**
 * avg_logprob at or below this is treated as no confidence at all.
 *
 * Widened from -1.0 when `transcribe` began returning real values and this
 * gate stopped being inert. The old floor put the refusal threshold at
 * avg_logprob ≈ -0.505, which is inside the range accented second-language
 * speech normally occupies — Whisper scores a clear but non-native utterance
 * well below a native one, and this app's users are non-native by
 * definition. Every learner with a strong accent would have been told the app
 * could not hear them, on turns it had transcribed correctly.
 *
 * At -1.6 the refusal threshold lands near -0.78, which is a turn that is
 * genuinely mangled rather than merely accented.
 *
 * Still an estimate, not a measurement: it is reasoned from published Whisper
 * behaviour, not from our own logged distributions. Revisit once real turns
 * have been recorded — deliberately erring toward grading an imperfect turn
 * rather than refusing a good one, because a spurious "I didn't catch that"
 * is the failure learners abandon an app over.
 */
const LOGPROB_FLOOR = -1.6;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Collapse the provider's signals into a single 0–1 confidence.
 *
 * An empty transcript is zero regardless of what else is reported: there is
 * nothing to be confident about.
 */
export function sttConfidence(sig: SttConfidenceSignal): number {
  if (sig.transcript.trim().length === 0) return 0;

  const haveNoSpeech = sig.noSpeechProb !== null && Number.isFinite(sig.noSpeechProb);
  const haveLogprob = sig.avgLogprob !== null && Number.isFinite(sig.avgLogprob);

  if (!haveNoSpeech && !haveLogprob) return NEUTRAL_CONFIDENCE;

  const factors: number[] = [];
  if (haveNoSpeech) factors.push(clamp01(1 - (sig.noSpeechProb as number)));
  if (haveLogprob) {
    const span = LOGPROB_CEILING - LOGPROB_FLOOR;
    factors.push(clamp01(((sig.avgLogprob as number) - LOGPROB_FLOOR) / span));
  }

  // The weakest signal governs. Two independent measures disagreeing means
  // something is wrong with the turn, and the conservative reading is the one
  // that costs a re-ask rather than a corrupted schedule.
  return Math.min(...factors);
}

export interface HandsFreeGradeInput {
  transcript: string;
  expectedText: string;
  acceptedVariants: string[];
  targetWord?: string;
  /** Prompt-audio-end to speech-end, in ms. */
  responseTimeMs: number;
  /** Silence the endpointer waited through before stopping. Subtracted out. */
  endpointerLagMs: number;
  /** 0–1, from `sttConfidence`. */
  confidence: number;
}

export type HandsFreeEvaluation =
  | {
      kind: 'graded';
      rating: ReviewRating;
      score: number;
      wasCorrect: boolean;
      phraseKey: FeedbackPhraseKey;
    }
  | { kind: 'low_confidence'; reason: 'stt' | 'empty' };

/** Feedback line to speak, chosen from the score band. */
function phraseFor(score: number, wasCorrect: boolean): FeedbackPhraseKey {
  if (wasCorrect) return 'correct';
  // A near miss and a total miss deserve different responses out loud — being
  // told "not quite" after a genuinely close attempt is discouraging.
  return score >= 40 ? 'close' : 'incorrect';
}

/**
 * Grade a spoken answer, or decline to.
 *
 * Declining is the important behaviour: `low_confidence` must never reach the
 * SM-2 write path.
 */
export function evaluateHandsFreeAnswer(input: HandsFreeGradeInput): HandsFreeEvaluation {
  if (input.transcript.trim().length === 0) {
    return { kind: 'low_confidence', reason: 'empty' };
  }
  if (input.confidence < HANDSFREE_MIN_CONFIDENCE) {
    return { kind: 'low_confidence', reason: 'stt' };
  }

  const grade = gradeSpeechTranscription(
    input.transcript,
    input.expectedText,
    input.acceptedVariants,
    input.targetWord,
  );

  const thinkingTimeMs = Math.max(0, input.responseTimeMs - input.endpointerLagMs);
  const rating = speechScoreToRating(grade.score, thinkingTimeMs);

  return {
    kind: 'graded',
    rating,
    score: grade.score,
    wasCorrect: grade.isCorrect,
    phraseKey: phraseFor(grade.score, grade.isCorrect),
  };
}
