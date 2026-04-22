/**
 * usePhonemeDrill — rotation contract tests
 *
 * RUN: `npm test` (once jest is added) or `npx jest hooks/usePhonemeDrill.test.ts`.
 *
 * The repo currently declares `"test": "jest"` in package.json but does not
 * install jest. These tests are scaffolded in jest syntax so they drop in
 * cleanly when the test runner is added. Until then they still document the
 * contract that `playNext` N times cycles through indices 0..N-1 modulo
 * voiceCount. We avoid importing the hook itself because expo-av and
 * expo-speech are native-only modules that cannot be loaded under Node.
 *
 * The rotation math is the load-bearing invariant for HVPT correctness —
 * if it drifts, learners stop hearing the target in distinct voices.
 */

// Use global declarations so this file type-checks even when @types/jest is
// absent. When jest is installed, it augments the global scope itself.
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: unknown) => {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
};

/** Mirrors the rotation logic in hooks/usePhonemeDrill.ts. If this expression
 *  ever changes in the hook, update it here too. */
function voiceIndexForCall(callNumber: number, voiceCount: number): number {
  return callNumber % Math.max(1, voiceCount);
}

describe('usePhonemeDrill rotation math', () => {
  it('cycles indices 0..N-1 over N successive calls', () => {
    const N = 4;
    const seen: number[] = [];
    for (let i = 0; i < N; i++) {
      seen.push(voiceIndexForCall(i, N));
    }
    expect(seen).toEqual([0, 1, 2, 3]);
  });

  it('wraps back to 0 after N calls', () => {
    const N = 4;
    expect(voiceIndexForCall(4, N)).toBe(0);
    expect(voiceIndexForCall(5, N)).toBe(1);
    expect(voiceIndexForCall(8, N)).toBe(0);
  });

  it('handles voiceCount=1 (no variability) without divide-by-zero', () => {
    expect(voiceIndexForCall(0, 1)).toBe(0);
    expect(voiceIndexForCall(99, 1)).toBe(0);
  });

  it('handles voiceCount=0 defensively by treating it as 1', () => {
    // Hook uses Math.max(1, voiceCount), so 0 collapses to 1 (index 0 only).
    expect(voiceIndexForCall(0, 0)).toBe(0);
    expect(voiceIndexForCall(1, 0)).toBe(0);
  });

  it('covers the HVPT minimum of 4 distinct voices across 4+ reps', () => {
    const N = 4;
    const reps = 12;
    const seen = new Set<number>();
    for (let i = 0; i < reps; i++) {
      seen.add(voiceIndexForCall(i, N));
    }
    // All 4 indices visited within 12 repetitions.
    expect(seen.size).toBe(4);
  });
});
