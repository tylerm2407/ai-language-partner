import { enterImmersive, isImmersive, resetImmersiveForTests, subscribeImmersive } from './immersive-mode';

beforeEach(() => {
  resetImmersiveForTests();
});

describe('immersive mode', () => {
  it('is off until a surface enters, and off again after the last leaves', () => {
    expect(isImmersive()).toBe(false);
    const releaseA = enterImmersive();
    const releaseB = enterImmersive();
    expect(isImmersive()).toBe(true);
    releaseA();
    // The passage -> questions handoff: one surface gone, one still up.
    expect(isImmersive()).toBe(true);
    releaseB();
    expect(isImmersive()).toBe(false);
  });

  it('notifies only on the 0-to-1 and 1-to-0 transitions', () => {
    const seen: boolean[] = [];
    subscribeImmersive((v) => seen.push(v));
    const releaseA = enterImmersive();
    const releaseB = enterImmersive();
    releaseA();
    releaseB();
    expect(seen).toEqual([true, false]);
  });

  it('ignores a double release', () => {
    const release = enterImmersive();
    const other = enterImmersive();
    release();
    release();
    expect(isImmersive()).toBe(true);
    other();
    expect(isImmersive()).toBe(false);
  });

  it('stops notifying after unsubscribe', () => {
    const seen: boolean[] = [];
    const off = subscribeImmersive((v) => seen.push(v));
    const release = enterImmersive();
    off();
    release();
    expect(seen).toEqual([true]);
  });
});
