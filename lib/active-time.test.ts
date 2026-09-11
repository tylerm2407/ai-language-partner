/**
 * The point of these is the clamps. A clock that just adds up wall time is a
 * one-liner; what makes this one safe to write into `daily_stats` is that it
 * refuses to credit a screen left open, a backgrounded app, or a system clock
 * that jumped — and those are exactly the paths nothing exercises by accident.
 */
import {
  createActiveClock,
  goalProgress,
  displayMinutes,
  MAX_CONTINUOUS_STRETCH_MS,
  MAX_SESSION_MS,
  DEFAULT_DAILY_GOAL_MINUTES,
} from './active-time';

/** A hand-cranked clock: `at` is the value `now()` returns next. */
function fakeNow() {
  const state = { at: 0 };
  return { state, now: () => state.at };
}

const MINUTE = 60_000;

describe('createActiveClock', () => {
  it('counts nothing before start', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    state.at = 5 * MINUTE;
    expect(clock.peekSeconds()).toBe(0);
    expect(clock.stop()).toBe(0);
    expect(clock.isRunning()).toBe(false);
  });

  it('counts elapsed time while started', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    clock.start();
    state.at = 90_000;
    expect(clock.isRunning()).toBe(true);
    expect(clock.peekSeconds()).toBe(90);
    expect(clock.stop()).toBe(90);
  });

  it('excludes paused time', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    clock.start();
    state.at = 2 * MINUTE; // 2 minutes of work
    clock.pause();
    state.at = 40 * MINUTE; // 38 minutes backgrounded
    clock.resume();
    state.at = 41 * MINUTE; // 1 more minute of work
    expect(clock.stop()).toBe(180);
  });

  it('reports nothing while paused, and does not double-bank a second pause', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    clock.start();
    state.at = MINUTE;
    clock.pause();
    expect(clock.isRunning()).toBe(false);
    state.at = 10 * MINUTE;
    clock.pause(); // idempotent — the stretch is already banked
    expect(clock.stop()).toBe(60);
  });

  it('ignores resume() before start and pause() after stop', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    clock.resume();
    state.at = 10 * MINUTE;
    expect(clock.stop()).toBe(0);

    clock.start();
    state.at = 11 * MINUTE;
    expect(clock.stop()).toBe(60);
    clock.pause();
    expect(clock.stop()).toBe(0);
  });

  it('does not restart an already-started clock', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    clock.start();
    state.at = MINUTE;
    clock.start(); // a re-render must not throw the first minute away
    state.at = 2 * MINUTE;
    expect(clock.stop()).toBe(120);
  });

  it('clamps one uninterrupted stretch — a screen left open in the foreground', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    clock.start();
    state.at = 3 * 60 * MINUTE; // three hours untouched
    expect(clock.stop()).toBe(MAX_CONTINUOUS_STRETCH_MS / 1000);
  });

  it('clamps each stretch separately, so real work past the limit still counts', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    clock.start();
    state.at = 60 * MINUTE; // stretch 1: clamped to 20
    clock.pause();
    clock.resume();
    state.at = 65 * MINUTE; // stretch 2: a real 5 minutes
    expect(clock.stop()).toBe((MAX_CONTINUOUS_STRETCH_MS + 5 * MINUTE) / 1000);
  });

  it('caps the session total however many stretches there were', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    clock.start();
    for (let i = 0; i < 10; i += 1) {
      state.at += 20 * MINUTE;
      clock.pause();
      clock.resume();
    }
    expect(clock.stop()).toBe(MAX_SESSION_MS / 1000);
  });

  it('credits nothing for a clock that jumped backwards', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    state.at = 10 * MINUTE;
    clock.start();
    state.at = 0; // timezone change, NTP correction
    expect(clock.stop()).toBe(0);
  });

  it('hands the total over exactly once', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    clock.start();
    state.at = 5 * MINUTE;
    expect(clock.stop()).toBe(300);
    // An explicit stop followed by the unmount flush must not write twice.
    expect(clock.stop()).toBe(0);
  });

  it('can be restarted after stopping', () => {
    const { state, now } = fakeNow();
    const clock = createActiveClock({ now });
    clock.start();
    state.at = MINUTE;
    clock.stop();
    clock.start();
    state.at = 3 * MINUTE;
    expect(clock.stop()).toBe(120);
  });
});

describe('goalProgress', () => {
  it('reports partial progress', () => {
    expect(goalProgress(4, 10)).toEqual({ pct: 0.4, remainingMinutes: 6, met: false });
  });

  it('rounds the remainder up, so a nearly-met goal never reads as zero left', () => {
    expect(goalProgress(9.6, 10).remainingMinutes).toBe(1);
    expect(goalProgress(9.6, 10).met).toBe(false);
  });

  it('treats the goal as met at exactly the goal', () => {
    expect(goalProgress(10, 10)).toEqual({ pct: 1, remainingMinutes: 0, met: true });
  });

  it('clamps overshoot to a full ring', () => {
    expect(goalProgress(40, 10)).toEqual({ pct: 1, remainingMinutes: 0, met: true });
  });

  it('starts empty', () => {
    expect(goalProgress(0, DEFAULT_DAILY_GOAL_MINUTES)).toEqual({
      pct: 0,
      remainingMinutes: DEFAULT_DAILY_GOAL_MINUTES,
      met: false,
    });
  });

  it('treats a non-positive or non-finite goal as no goal at all', () => {
    for (const goal of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(goalProgress(5, goal)).toEqual({ pct: 0, remainingMinutes: 0, met: false });
    }
  });

  it('never lets a junk minutes value produce a NaN ring', () => {
    for (const minutes of [Number.NaN, -3, Number.POSITIVE_INFINITY]) {
      const { pct } = goalProgress(minutes, 10);
      expect(Number.isFinite(pct)).toBe(true);
      expect(pct).toBe(0);
    }
  });
});

describe('displayMinutes', () => {
  it('rounds fractional minutes for display', () => {
    expect(displayMinutes(23.466666666666665)).toBe(23);
    expect(displayMinutes(9.5)).toBe(10);
  });

  it('shows any real practice as at least one minute', () => {
    expect(displayMinutes(0.2)).toBe(1);
  });

  it('shows nothing as zero', () => {
    expect(displayMinutes(0)).toBe(0);
    expect(displayMinutes(-1)).toBe(0);
    expect(displayMinutes(Number.NaN)).toBe(0);
  });
});
