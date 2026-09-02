// Collapse Whisper's per-segment confidence into one signal per turn.
//
// Split out of index.ts so it can be `deno test`-ed: index.ts calls serve()
// at module scope, so importing it from a test would stand up an HTTP
// listener. Same split as tts/synthesis.ts and ai-chat/prompt.ts.
//
// ── Why this exists ──
//
// `transcribe` has always asked Whisper for `verbose_json` — it is the only
// response format that reports the detected language — and that payload also
// carries a `segments[]` array where every segment reports `avg_logprob` (how
// confident the model was in the tokens it emitted) and `no_speech_prob` (how
// likely the audio was silence). All of it was thrown away at the response
// boundary, which returned only `{ text, language }`.
//
// Downstream, `lib/handsfree-grading.ts` has a fully calibrated
// `sttConfidence()` that consumes exactly these two numbers — and has been
// returning NEUTRAL_CONFIDENCE for every turn ever spoken, because both
// arrive null. The gate that is supposed to keep a misheard answer out of the
// SM-2 schedule has never once fired. This module is the missing half.

/** One entry of Whisper's `verbose_json` `segments[]`. Every field is
 *  optional because this is an external payload and a shape change must
 *  degrade to "no signal", never throw. */
export interface WhisperSegment {
  start?: unknown;
  end?: unknown;
  avg_logprob?: unknown;
  no_speech_prob?: unknown;
}

export interface TurnConfidence {
  /** Mean token log-probability across the turn, duration-weighted. Null when
   *  no segment reported one. */
  avgLogprob: number | null;
  /** Probability the audio was not speech, duration-weighted. Null when no
   *  segment reported one. */
  noSpeechProb: number | null;
}

/** A segment with no usable duration still has to count for something, or a
 *  malformed `start`/`end` pair would silently drop a real segment's opinion
 *  out of the average. One second is the rough scale of a Whisper segment. */
const FALLBACK_SEGMENT_SECONDS = 1;

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Seconds of audio a segment covers, floored at zero. Negative or reversed
 *  spans are treated as unmeasured rather than subtracted from the weight. */
function segmentSeconds(seg: WhisperSegment): number {
  const start = finite(seg.start);
  const end = finite(seg.end);
  if (start === null || end === null) return FALLBACK_SEGMENT_SECONDS;
  const span = end - start;
  return span > 0 ? span : FALLBACK_SEGMENT_SECONDS;
}

/**
 * Duration-weighted summary of a turn's segments.
 *
 * Weighted rather than a plain mean because segments are not equal lengths: a
 * learner who speaks one long confident clause and then clips a half-second
 * "um" should not have the "um" drag the turn's confidence down by half.
 *
 * Each field is averaged over only the segments that reported it, so a
 * payload carrying `avg_logprob` but not `no_speech_prob` still yields the
 * half it does have. Returns nulls for an empty or unusable array — the
 * caller's `sttConfidence` reads that as "no signal" and stays neutral, which
 * is the behaviour that shipped before this module existed.
 */
export function summarizeSegments(segments: unknown): TurnConfidence {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { avgLogprob: null, noSpeechProb: null };
  }

  let logprobWeight = 0;
  let logprobTotal = 0;
  let noSpeechWeight = 0;
  let noSpeechTotal = 0;

  for (const raw of segments) {
    if (typeof raw !== 'object' || raw === null) continue;
    const seg = raw as WhisperSegment;
    const seconds = segmentSeconds(seg);

    const logprob = finite(seg.avg_logprob);
    if (logprob !== null) {
      logprobTotal += logprob * seconds;
      logprobWeight += seconds;
    }

    const noSpeech = finite(seg.no_speech_prob);
    if (noSpeech !== null) {
      noSpeechTotal += noSpeech * seconds;
      noSpeechWeight += seconds;
    }
  }

  return {
    avgLogprob: logprobWeight > 0 ? logprobTotal / logprobWeight : null,
    noSpeechProb: noSpeechWeight > 0 ? noSpeechTotal / noSpeechWeight : null,
  };
}
