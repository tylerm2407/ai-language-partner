/**
 * Voice activity detection — deciding when the learner has stopped speaking.
 *
 * Pure and clock-free: it is fed metering samples with an elapsed time and
 * returns a decision. No expo-av, no timers, no Date.now. That is what makes
 * it testable on a machine with no simulator, which is the only way any of
 * this gets verified before it reaches a device.
 *
 * WHAT THIS FIXES
 * The chat voice loop endpoints on a FIXED threshold of -35 dB with no upper
 * bound on how long the microphone stays open. Both are wrong outside a quiet
 * room, and hands-free mode is specifically for commutes:
 *
 *   1. Road noise in a moving car sits well above -35 dB. The fixed threshold
 *      is therefore permanently exceeded, "speech" is detected continuously,
 *      the silence timer is cleared on every sample, and the turn never ends.
 *      Fixed by measuring the actual noise floor at the start of each turn and
 *      setting the threshold relative to it.
 *   2. If speech is never detected — mic failure, a learner who says nothing,
 *      or a threshold that noise never crosses — the recording runs forever.
 *      Fixed by `maxListenMs` and `noSpeechTimeoutMs`.
 *
 * The calibration percentile matters: a mean would be dragged upward by a
 * cough or a door slam during the calibration window, permanently raising the
 * threshold for that turn. A low percentile tracks the floor, not the events.
 */

export interface VadConfig {
  /** dB above the measured noise floor that counts as speech. */
  speechMarginDb: number;
  /** Absolute floor, so a silent room cannot drive the threshold absurdly low. */
  minThresholdDb: number;
  /** Absolute ceiling, so loud noise cannot push the threshold above real speech. */
  maxThresholdDb: number;
  /** ms of sub-threshold audio after speech that ends the turn. */
  silenceMs: number;
  /** ms at the start of a turn spent measuring the noise floor. */
  calibrationMs: number;
  /** Hard cap on a listening window. The missing max-listen window. */
  maxListenMs: number;
  /** Give up if no speech has been detected by this point. */
  noSpeechTimeoutMs: number;
  /** Turns with less than this much speech are coughs or road bumps, not answers. */
  minSpeechMs: number;
}

/**
 * Tuned for a moving vehicle: a wide margin over a high noise floor, and a
 * threshold ceiling low enough that ordinary speech still clears it.
 */
export const HANDSFREE_VAD: VadConfig = {
  speechMarginDb: 12,
  minThresholdDb: -45,
  maxThresholdDb: -20,
  silenceMs: 1200,
  calibrationMs: 600,
  maxListenMs: 8000,
  noSpeechTimeoutMs: 4000,
  minSpeechMs: 350,
};

/**
 * Tuned for a quiet room. Reproduces the feel of the existing chat loop while
 * still gaining the adaptive floor and the max-listen bound it lacks.
 */
export const CHAT_VAD: VadConfig = {
  speechMarginDb: 10,
  minThresholdDb: -50,
  maxThresholdDb: -25,
  silenceMs: 1500,
  calibrationMs: 400,
  maxListenMs: 30000,
  noSpeechTimeoutMs: 15000,
  minSpeechMs: 250,
};

/**
 * Chat endpointing tuned to how long this learner needs to get a sentence out.
 *
 * A second-language speaker pauses mid-utterance far more than a native one —
 * reaching for a word, re-planning a clause, self-correcting — and the lower
 * their level the longer those pauses run. Generic voice-agent VAD is tuned
 * for natives at around 500ms of silence, and the single most-cited complaint
 * about the best-funded AI conversation product in this market is that it cuts
 * people off and gives them no time to think.
 *
 * So patience is a function of level, not a constant: generous at A1 where
 * every clause is assembled deliberately, tightening toward B2/C1 where a long
 * gap really does mean "your turn". Erring long is much cheaper than erring
 * short — waiting an extra second costs a beat of dead air, while cutting a
 * learner off mid-sentence sends a truncated turn to the tutor and teaches
 * them the app cannot hear them.
 *
 * `maxListenMs` scales with it for the same reason: a beginner composing a
 * sentence out loud legitimately takes longer than an advanced speaker saying
 * one.
 */
const CHAT_VAD_BY_BAND: Record<string, { silenceMs: number; maxListenMs: number; noSpeechTimeoutMs: number }> = {
  A1: { silenceMs: 2200, maxListenMs: 45000, noSpeechTimeoutMs: 20000 },
  A2: { silenceMs: 2000, maxListenMs: 40000, noSpeechTimeoutMs: 18000 },
  B1: { silenceMs: 1700, maxListenMs: 35000, noSpeechTimeoutMs: 16000 },
  B2: { silenceMs: 1500, maxListenMs: 30000, noSpeechTimeoutMs: 15000 },
  C1: { silenceMs: 1300, maxListenMs: 30000, noSpeechTimeoutMs: 14000 },
  C2: { silenceMs: 1300, maxListenMs: 30000, noSpeechTimeoutMs: 14000 },
};

/**
 * A chat VAD config for a learner at `cefrLevel`.
 *
 * Unknown or missing levels get the A1 settings — the most patient. Guessing
 * wrong toward patience wastes a moment; guessing wrong toward haste truncates
 * someone mid-sentence.
 */
export function chatVadForLevel(cefrLevel: string | null | undefined): VadConfig {
  const band = (cefrLevel ?? '').trim().toUpperCase().slice(0, 2);
  const tuning = CHAT_VAD_BY_BAND[band] ?? CHAT_VAD_BY_BAND.A1;
  return { ...CHAT_VAD, ...tuning };
}

export type VadStopReason =
  | 'silence_after_speech'
  | 'max_window'
  | 'no_speech'
  | 'too_short';

export type VadDecision =
  | { kind: 'continue' }
  | { kind: 'stop'; reason: VadStopReason };

export interface VadState {
  readonly config: VadConfig;
  /** Metering samples collected during the calibration window. */
  readonly calibrationSamples: readonly number[];
  /** Measured floor; null until calibration completes. */
  readonly noiseFloorDb: number | null;
  /** Speech threshold derived from the floor; null until calibration completes. */
  readonly thresholdDb: number | null;
  readonly speechDetected: boolean;
  /** Elapsed ms at which the current run of silence began; null when not silent. */
  readonly silenceStartedAt: number | null;
  /** Total ms observed above threshold. */
  readonly speechMs: number;
  readonly lastElapsedMs: number;
  readonly stopped: VadStopReason | null;
}

/** Metering value expo-av reports when it has nothing — treated as silence. */
const METERING_FLOOR_DB = -160;

export function createVadState(config: VadConfig): VadState {
  return {
    config,
    calibrationSamples: [],
    noiseFloorDb: null,
    thresholdDb: null,
    speechDetected: false,
    silenceStartedAt: null,
    speechMs: 0,
    lastElapsedMs: 0,
    stopped: null,
  };
}

/**
 * The percentile of the calibration samples treated as the noise floor.
 * Below the median so that transient noise during calibration — a cough, a
 * pothole — cannot drag the floor up and desensitise the whole turn.
 */
const NOISE_FLOOR_PERCENTILE = 0.6;

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return METERING_FLOOR_DB;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Feed one metering sample.
 *
 * @param elapsedMs ms since the listening window opened. Must be monotonic.
 * @param meteringDb raw metering value from expo-av (negative dBFS).
 */
export function feedVadSample(
  state: VadState,
  elapsedMs: number,
  meteringDb: number,
): { state: VadState; decision: VadDecision } {
  // Already decided: stay decided. A late sample must not resurrect a
  // finished turn.
  if (state.stopped) {
    return { state, decision: { kind: 'stop', reason: state.stopped } };
  }

  const { config } = state;
  const db = Number.isFinite(meteringDb) ? meteringDb : METERING_FLOOR_DB;
  const deltaMs = Math.max(0, elapsedMs - state.lastElapsedMs);

  // ── Calibration ────────────────────────────────────────────────────────
  if (elapsedMs < config.calibrationMs) {
    return {
      state: {
        ...state,
        calibrationSamples: [...state.calibrationSamples, db],
        lastElapsedMs: elapsedMs,
      },
      decision: { kind: 'continue' },
    };
  }

  let next: VadState = state;

  // First sample past the calibration window: fix the floor and threshold.
  if (state.thresholdDb === null) {
    const sorted = [...state.calibrationSamples, db].sort((a, b) => a - b);
    const floor = percentile(sorted, NOISE_FLOOR_PERCENTILE);
    const threshold = clamp(
      floor + config.speechMarginDb,
      config.minThresholdDb,
      config.maxThresholdDb,
    );
    next = { ...next, noiseFloorDb: floor, thresholdDb: threshold };
  }

  const threshold = next.thresholdDb as number;
  const isSpeech = db > threshold;

  if (isSpeech) {
    next = {
      ...next,
      speechDetected: true,
      speechMs: next.speechMs + deltaMs,
      silenceStartedAt: null,
      lastElapsedMs: elapsedMs,
    };
  } else {
    next = {
      ...next,
      silenceStartedAt: next.silenceStartedAt ?? elapsedMs,
      lastElapsedMs: elapsedMs,
    };
  }

  // ── Stop conditions, most specific first ───────────────────────────────

  // Hard cap. Checked before everything else so a turn can never run away,
  // whatever the threshold ended up being.
  if (elapsedMs >= config.maxListenMs) {
    // A turn that hit the cap WITH enough speech is still a usable answer —
    // the learner was simply still talking. Only treat it as unusable when
    // there was never enough speech to grade.
    const reason: VadStopReason =
      next.speechDetected && next.speechMs >= config.minSpeechMs ? 'silence_after_speech' : 'max_window';
    return { state: { ...next, stopped: reason }, decision: { kind: 'stop', reason } };
  }

  // Nothing was ever said.
  if (!next.speechDetected && elapsedMs >= config.noSpeechTimeoutMs) {
    return {
      state: { ...next, stopped: 'no_speech' },
      decision: { kind: 'stop', reason: 'no_speech' },
    };
  }

  // Silence long enough after speech ends the turn.
  if (
    next.speechDetected &&
    next.silenceStartedAt !== null &&
    elapsedMs - next.silenceStartedAt >= config.silenceMs
  ) {
    const reason: VadStopReason =
      next.speechMs >= config.minSpeechMs ? 'silence_after_speech' : 'too_short';
    return { state: { ...next, stopped: reason }, decision: { kind: 'stop', reason } };
  }

  return { state: next, decision: { kind: 'continue' } };
}

/** Inspectable state, for logging and field tuning of the thresholds. */
export function vadDebug(state: VadState): {
  noiseFloorDb: number | null;
  thresholdDb: number | null;
  speechDetected: boolean;
  speechMs: number;
} {
  return {
    noiseFloorDb: state.noiseFloorDb,
    thresholdDb: state.thresholdDb,
    speechDetected: state.speechDetected,
    speechMs: state.speechMs,
  };
}
