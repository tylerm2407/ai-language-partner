/**
 * Unit tests for the hearts pure logic: optimistic spend (`spendHeartLocally`)
 * and server reconciliation (`computeHearts`). The optimistic/revert contract
 * used by `useHearts.loseHeart` is: snapshot state → spendHeartLocally →
 * on RPC failure restore the snapshot verbatim; on success recompute from the
 * RPC's authoritative row via computeHearts.
 */

import { computeHearts, spendHeartLocally, type HeartsState } from './hearts';

const REGEN_INTERVAL_MS = 4 * 60 * 60 * 1000; // mirror of lib/hearts.ts constant

describe('spendHeartLocally', () => {
  const now = 1_700_000_000_000;

  it('decrements current by one and schedules next regen 4h out', () => {
    const state: HeartsState = { current: 5, max: 5, nextRegenAt: null };
    const next = spendHeartLocally(state, now);
    expect(next.current).toBe(4);
    expect(next.max).toBe(5);
    expect(next.nextRegenAt?.getTime()).toBe(now + REGEN_INTERVAL_MS);
  });

  it('clamps at zero — spending with no hearts left stays at 0', () => {
    const state: HeartsState = { current: 0, max: 5, nextRegenAt: null };
    expect(spendHeartLocally(state, now).current).toBe(0);
  });

  it('does not mutate the input, so a snapshot can be restored on RPC failure', () => {
    const state: HeartsState = { current: 3, max: 5, nextRegenAt: null };
    const snapshot = { ...state };
    spendHeartLocally(state, now);
    expect(state).toEqual(snapshot);
  });

  it('sequential spends chain correctly (no interleaving math)', () => {
    let state: HeartsState = { current: 3, max: 5, nextRegenAt: null };
    state = spendHeartLocally(state, now);
    state = spendHeartLocally(state, now);
    state = spendHeartLocally(state, now);
    expect(state.current).toBe(0);
    // A fourth spend still clamps at 0.
    expect(spendHeartLocally(state, now).current).toBe(0);
  });
});

describe('computeHearts (reconciliation from the authoritative server row)', () => {
  it('returns server value as-is when at max, with no regen scheduled', () => {
    const state = computeHearts(5, 5, null);
    expect(state).toEqual({ current: 5, max: 5, nextRegenAt: null });
  });

  it('returns server value when below max with no loss timestamp', () => {
    const state = computeHearts(2, 5, null);
    expect(state).toEqual({ current: 2, max: 5, nextRegenAt: null });
  });

  it('applies one regenerated heart per elapsed 4h interval', () => {
    const lostAt = new Date(Date.now() - REGEN_INTERVAL_MS - 60_000).toISOString();
    const state = computeHearts(2, 5, lostAt);
    expect(state.current).toBe(3);
    expect(state.nextRegenAt).not.toBeNull();
  });

  it('caps regenerated hearts at max and clears nextRegenAt', () => {
    const lostAt = new Date(Date.now() - 10 * REGEN_INTERVAL_MS).toISOString();
    const state = computeHearts(2, 5, lostAt);
    expect(state.current).toBe(5);
    expect(state.nextRegenAt).toBeNull();
  });

  it('reconciling an RPC row after a reverted optimistic spend restores server truth', () => {
    // Simulate: local optimistic 4→3, RPC fails, snapshot 4 restored, then a
    // sync returns the server row (hearts=4, recent loss) — local must match.
    const lostAt = new Date(Date.now() - 5 * 60_000).toISOString(); // 5 min ago
    const state = computeHearts(4, 5, lostAt);
    expect(state.current).toBe(4);
    expect(state.max).toBe(5);
    expect(state.nextRegenAt).not.toBeNull();
  });
});
