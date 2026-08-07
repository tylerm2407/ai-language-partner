/**
 * Tests for the pure half of interruption handling.
 *
 * The detection itself is native and cannot be exercised here — this covers
 * the policy, which is where the judgement calls live: backgrounding is not an
 * interruption, a finished clip is not a stall.
 */

import { stallIsInterruption } from './useAudioInterruptions';

describe('stallIsInterruption', () => {
  it('ignores a clip that finished normally', () => {
    // The single most important case: every prompt ends this way, and calling
    // it an interruption would pause the session on every card.
    expect(
      stallIsInterruption({
        isLoaded: true,
        isPlaying: false,
        didJustFinish: true,
        positionMillis: 3000,
        previousPositionMillis: 3000,
      }),
    ).toBe(false);
  });

  it('ignores audio that is still playing', () => {
    expect(
      stallIsInterruption({
        isLoaded: true,
        isPlaying: true,
        positionMillis: 900,
        previousPositionMillis: 700,
      }),
    ).toBe(false);
  });

  it('ignores an unloaded sound', () => {
    expect(stallIsInterruption({ isLoaded: false })).toBe(false);
  });

  it('detects playback that stopped without finishing', () => {
    // A call, Siri, another app, or headphones being pulled all land here.
    expect(
      stallIsInterruption({
        isLoaded: true,
        isPlaying: false,
        didJustFinish: false,
        positionMillis: 1200,
        previousPositionMillis: 1200,
      }),
    ).toBe(true);
  });

  it('does not treat a still-advancing position as a stall', () => {
    // Paused-but-draining, or a status sampled mid-transition. Position moving
    // means audio is still flowing.
    expect(
      stallIsInterruption({
        isLoaded: true,
        isPlaying: false,
        didJustFinish: false,
        positionMillis: 1400,
        previousPositionMillis: 1200,
      }),
    ).toBe(false);
  });
});
