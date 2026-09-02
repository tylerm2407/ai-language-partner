/**
 * Unit tests for the endpointer.
 *
 * The two headline cases are the ones the existing chat loop gets wrong: a
 * turn in a noisy car (which never ends under a fixed -35 dB threshold) and a
 * turn where speech never arrives (which runs forever with no max window).
 */

import {
  CHAT_VAD,
  chatVadForLevel,
  HANDSFREE_VAD,
  createVadState,
  feedVadSample,
  vadDebug,
  type VadConfig,
  type VadDecision,
  type VadState,
} from './vad';

const SAMPLE_MS = 200;

/**
 * Drive a whole turn from a level function and return where it stopped.
 * `levelAt` receives elapsed ms and returns a metering value in dBFS.
 */
function runTurn(
  config: VadConfig,
  levelAt: (elapsedMs: number) => number,
  limitMs = 60_000,
): { decision: VadDecision; state: VadState; stoppedAtMs: number } {
  let state = createVadState(config);
  let last: VadDecision = { kind: 'continue' };
  for (let t = 0; t <= limitMs; t += SAMPLE_MS) {
    const step = feedVadSample(state, t, levelAt(t));
    state = step.state;
    last = step.decision;
    if (last.kind === 'stop') return { decision: last, state, stoppedAtMs: t };
  }
  return { decision: last, state, stoppedAtMs: limitMs };
}

/** Quiet room: floor at -55, speech at -20 between `from` and `to`. */
function quietRoomSpeech(fromMs: number, toMs: number) {
  return (t: number) => (t >= fromMs && t < toMs ? -20 : -55);
}

describe('calibration', () => {
  it('does not decide anything during the calibration window', () => {
    let state = createVadState(HANDSFREE_VAD);
    for (let t = 0; t < HANDSFREE_VAD.calibrationMs; t += SAMPLE_MS) {
      const step = feedVadSample(state, t, -20); // loud, but still calibrating
      state = step.state;
      expect(step.decision.kind).toBe('continue');
    }
    expect(vadDebug(state).thresholdDb).toBeNull();
  });

  it('sets the threshold relative to the measured floor', () => {
    const { state } = runTurn(HANDSFREE_VAD, quietRoomSpeech(1000, 2000));
    const { noiseFloorDb, thresholdDb } = vadDebug(state);
    expect(noiseFloorDb).toBeCloseTo(-55, 0);
    // floor + margin = -43, inside [-45, -20], so it is used unclamped.
    expect(thresholdDb).toBeCloseTo(-43, 0);
  });

  it('clamps the threshold up when the room is near-silent', () => {
    // Floor at -120 would give a threshold of -108, so quiet room hiss would
    // read as speech. The floor clamp prevents that.
    const { state } = runTurn(HANDSFREE_VAD, () => -120, 5000);
    expect(vadDebug(state).thresholdDb).toBe(HANDSFREE_VAD.minThresholdDb);
  });

  it('clamps the threshold down when the environment is loud', () => {
    // Road noise at -25 would give a threshold of -13, above ordinary speech,
    // so nothing would ever register. The ceiling prevents that.
    const { state } = runTurn(HANDSFREE_VAD, () => -25, 5000);
    expect(vadDebug(state).thresholdDb).toBe(HANDSFREE_VAD.maxThresholdDb);
  });

  it('is not poisoned by a transient during calibration', () => {
    // A single loud spike inside the calibration window must not drag the
    // floor up — a mean would, a low percentile does not.
    const withCough = runTurn(HANDSFREE_VAD, (t) => (t === 200 ? -5 : -55));
    expect(vadDebug(withCough.state).noiseFloorDb).toBeCloseTo(-55, 0);
  });
});

describe('normal turns', () => {
  it('stops after silence follows speech', () => {
    const { decision, stoppedAtMs } = runTurn(HANDSFREE_VAD, quietRoomSpeech(600, 2000));
    expect(decision).toEqual({ kind: 'stop', reason: 'silence_after_speech' });
    // Speech ends at 2000, plus the 1200 ms silence window.
    expect(stoppedAtMs).toBeGreaterThanOrEqual(3200);
    expect(stoppedAtMs).toBeLessThan(3800);
  });

  it('does not stop on a brief pause mid-sentence', () => {
    // 400 ms gap, well under the 1200 ms silence window.
    const levels = (t: number) => {
      if (t < 600) return -55;
      if (t < 1400) return -20;
      if (t < 1800) return -55; // pause
      if (t < 3000) return -20; // resumes
      return -55;
    };
    const { decision, stoppedAtMs } = runTurn(HANDSFREE_VAD, levels);
    expect(decision).toEqual({ kind: 'stop', reason: 'silence_after_speech' });
    expect(stoppedAtMs).toBeGreaterThanOrEqual(4200); // ended after the SECOND run
  });

  it('accumulates speech across a pause', () => {
    const levels = (t: number) => {
      if (t < 600) return -55;
      if (t < 1200) return -20;
      if (t < 1600) return -55;
      if (t < 2400) return -20;
      return -55;
    };
    const { state } = runTurn(HANDSFREE_VAD, levels);
    expect(vadDebug(state).speechMs).toBeGreaterThan(1000);
  });
});

describe('the moving-car case', () => {
  it('still ends the turn when road noise sits above a fixed -35 dB', () => {
    // This is the scenario the current chat loop cannot exit: continuous road
    // noise at -30 permanently exceeds a hardcoded -35 threshold, so silence
    // is never observed and the microphone stays open indefinitely.
    const roadNoise = -30;
    const speech = -12;
    const { decision } = runTurn(HANDSFREE_VAD, (t) =>
      t >= 800 && t < 2200 ? speech : roadNoise,
    );
    expect(decision).toEqual({ kind: 'stop', reason: 'silence_after_speech' });
  });

  it('does not mistake steady road noise for speech', () => {
    const { decision, state } = runTurn(HANDSFREE_VAD, () => -30);
    expect(decision).toEqual({ kind: 'stop', reason: 'no_speech' });
    expect(vadDebug(state).speechDetected).toBe(false);
  });
});

describe('bounds', () => {
  it('gives up when speech never arrives', () => {
    const { decision, stoppedAtMs } = runTurn(HANDSFREE_VAD, () => -70);
    expect(decision).toEqual({ kind: 'stop', reason: 'no_speech' });
    expect(stoppedAtMs).toBeGreaterThanOrEqual(HANDSFREE_VAD.noSpeechTimeoutMs);
  });

  it('caps a turn where the learner never stops talking', () => {
    const { decision, stoppedAtMs } = runTurn(HANDSFREE_VAD, (t) => (t < 600 ? -55 : -15));
    expect(decision.kind).toBe('stop');
    expect(stoppedAtMs).toBe(HANDSFREE_VAD.maxListenMs);
  });

  it('treats a capped turn that contained real speech as usable', () => {
    // Hitting the ceiling mid-sentence is not a failed turn — the learner was
    // still answering. Marking it unusable would discard a correct answer.
    const { decision } = runTurn(HANDSFREE_VAD, (t) => (t < 600 ? -55 : -15));
    expect(decision).toEqual({ kind: 'stop', reason: 'silence_after_speech' });
  });

  it('rejects a turn too short to be an answer', () => {
    // One 200 ms blip: a cough or a pothole, not speech.
    const { decision } = runTurn(HANDSFREE_VAD, (t) => (t === 800 ? -15 : -55));
    expect(decision).toEqual({ kind: 'stop', reason: 'too_short' });
  });
});

describe('robustness', () => {
  it('stays stopped once stopped', () => {
    let state = createVadState(HANDSFREE_VAD);
    for (let t = 0; t <= 6000; t += SAMPLE_MS) {
      state = feedVadSample(state, t, -70).state;
    }
    const after = feedVadSample(state, 99_999, -10);
    expect(after.decision).toEqual({ kind: 'stop', reason: 'no_speech' });
    expect(after.state.speechDetected).toBe(false);
  });

  it('treats a non-finite metering value as silence', () => {
    const { decision } = runTurn(HANDSFREE_VAD, () => Number.NaN);
    expect(decision).toEqual({ kind: 'stop', reason: 'no_speech' });
  });

  it('does not mutate the state it is given', () => {
    const state = createVadState(HANDSFREE_VAD);
    const snapshot = JSON.stringify(state);
    feedVadSample(state, 100, -20);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('tolerates a repeated elapsed value without accruing negative time', () => {
    let state = createVadState(HANDSFREE_VAD);
    for (let t = 0; t <= 1400; t += SAMPLE_MS) state = feedVadSample(state, t, -20).state;
    const before = vadDebug(state).speechMs;
    state = feedVadSample(state, 1000, -20).state; // out-of-order sample
    expect(vadDebug(state).speechMs).toBeGreaterThanOrEqual(before);
  });
});

describe('chat profile', () => {
  it('allows a much longer turn than the hands-free profile', () => {
    expect(CHAT_VAD.maxListenMs).toBeGreaterThan(HANDSFREE_VAD.maxListenMs);
  });

  it('still bounds a turn that never ends', () => {
    const { decision, stoppedAtMs } = runTurn(CHAT_VAD, (t) => (t < 400 ? -60 : -15), 60_000);
    expect(decision.kind).toBe('stop');
    expect(stoppedAtMs).toBe(CHAT_VAD.maxListenMs);
  });
});

describe('chatVadForLevel', () => {
  // The rule this defends: patience falls as fluency rises, and an unknown
  // level is treated as a beginner. Cutting a learner off mid-sentence is the
  // single most-cited complaint about the best-funded rival in this market, so
  // every ambiguity here resolves toward waiting longer.

  it('is more patient the lower the level', () => {
    const silence = (band: string) => chatVadForLevel(band).silenceMs;
    expect(silence('A1')).toBeGreaterThan(silence('A2'));
    expect(silence('A2')).toBeGreaterThan(silence('B1'));
    expect(silence('B1')).toBeGreaterThan(silence('B2'));
    expect(silence('B2')).toBeGreaterThan(silence('C1'));
  });

  it('gives a beginner longer to finish a sentence', () => {
    expect(chatVadForLevel('A1').maxListenMs).toBeGreaterThan(chatVadForLevel('C1').maxListenMs);
  });

  it('never gets less patient than a generic native-tuned endpointer', () => {
    // ~500ms is the usual voice-agent default, and it is tuned for natives.
    for (const band of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      expect(chatVadForLevel(band).silenceMs).toBeGreaterThan(1000);
    }
  });

  it('treats an unknown or missing level as a beginner, not as advanced', () => {
    const a1 = chatVadForLevel('A1');
    for (const unknown of [null, undefined, '', '   ', 'fluent', 'Z9']) {
      expect(chatVadForLevel(unknown).silenceMs).toBe(a1.silenceMs);
    }
  });

  it('accepts the levels the app actually stores, however they are cased', () => {
    expect(chatVadForLevel('b1').silenceMs).toBe(chatVadForLevel('B1').silenceMs);
    // cefrLabel() renders "B1 · can-do statement"; take the band off the front.
    expect(chatVadForLevel('B1 · Can hold a simple conversation').silenceMs).toBe(
      chatVadForLevel('B1').silenceMs,
    );
  });

  it('keeps the rest of the chat tuning intact', () => {
    const cfg = chatVadForLevel('B1');
    expect(cfg.speechMarginDb).toBe(CHAT_VAD.speechMarginDb);
    expect(cfg.minThresholdDb).toBe(CHAT_VAD.minThresholdDb);
    expect(cfg.maxThresholdDb).toBe(CHAT_VAD.maxThresholdDb);
    expect(cfg.calibrationMs).toBe(CHAT_VAD.calibrationMs);
  });
});
