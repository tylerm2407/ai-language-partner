/**
 * Tests for withTimeout (lib/purchases.ts).
 *
 * `Purchases.getOfferings()` has no timeout of its own, and the paywall used
 * to sit on a spinner forever when RevenueCat did not answer. The behaviour
 * worth pinning: a slow promise rejects at the deadline with a named error,
 * a fast one passes its value straight through, and the timer never outlives
 * the race (a leaked timer keeps a jest worker — and a screen — alive).
 */
import { OFFERINGS_TIMEOUT_MS, withTimeout } from './purchases';

// react-native-purchases is a native module; the mock keeps the module
// importable under jest. (babel-plugin-jest-hoist lifts this above imports.)
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {},
  LOG_LEVEL: { WARN: 1 },
}));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('withTimeout', () => {
  it('resolves with the value when the promise settles first', async () => {
    const result = withTimeout(Promise.resolve('offerings'), 1000, 'getOfferings');
    await expect(result).resolves.toBe('offerings');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects with a named error once the deadline passes', async () => {
    const never = new Promise<string>(() => {});
    const result = withTimeout(never, 1000, 'getOfferings');
    // Attach the handler before advancing so the rejection is not unhandled.
    const outcome = result.then(
      () => 'resolved',
      (err: Error) => err.message,
    );
    jest.advanceTimersByTime(1000);
    await expect(outcome).resolves.toBe('getOfferings timed out after 1000ms');
  });

  it('passes a rejection through unchanged', async () => {
    const boom = new Error('store unavailable');
    const outcome = withTimeout(Promise.reject(boom), 1000, 'getOfferings').catch((e: Error) => e);
    await expect(outcome).resolves.toBe(boom);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('uses a deadline a learner would actually wait out', () => {
    // Long enough for a cold StoreKit round trip, short enough that a stuck
    // paywall turns into the Continue card before the learner gives up.
    expect(OFFERINGS_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(OFFERINGS_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });
});
