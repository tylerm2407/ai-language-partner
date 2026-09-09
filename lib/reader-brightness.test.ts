/**
 * The bookkeeping that makes an in-app brightness change reversible. The
 * native module is mocked; what is asserted is WHEN it is written and with
 * what, which is the part that leaves a phone dimmed if it is wrong.
 */
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  RELEASE_GRACE_MS,
  acquireReaderBrightness,
  isReaderBrightnessAvailable,
  resetReaderBrightnessForTests,
  setReaderBrightnessStep,
} from './reader-brightness';

// Built inside the factory: the module under test resolves the native module
// at import time, which runs before any top-level const in this file exists.
jest.mock('expo-modules-core', () => {
  const native = {
    getBrightnessAsync: jest.fn(async () => 0.9),
    setBrightnessAsync: jest.fn(async () => {}),
  };
  return {
    requireOptionalNativeModule: jest.fn((name: string) => (name === 'ExpoBrightness' ? native : null)),
  };
});

const native = requireOptionalNativeModule<{ getBrightnessAsync: jest.Mock; setBrightnessAsync: jest.Mock }>(
  'ExpoBrightness',
)!;
const get = native.getBrightnessAsync;
const set = native.setBrightnessAsync;

let appStateHandler: ((s: string) => void) | null = null;
const remove = jest.fn();
jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
  appStateHandler = h;
  return { remove };
}) as never);

beforeEach(() => {
  jest.useFakeTimers();
  resetReaderBrightnessForTests();
  get.mockClear();
  set.mockClear();
  remove.mockClear();
  appStateHandler = null;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('reader brightness', () => {
  it('resolves the mockNative module through the optional form', () => {
    // The non-optional form throws at import on a build without the module,
    // which would take the whole reader down with it.
    expect(requireOptionalNativeModule).toHaveBeenCalledWith('ExpoBrightness');
    expect(isReaderBrightnessAvailable()).toBe(true);
  });

  it('writes nothing when the step is null', async () => {
    const release = acquireReaderBrightness(null);
    await jest.advanceTimersByTimeAsync(0);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    release();
    await jest.advanceTimersByTimeAsync(RELEASE_GRACE_MS + 1);
    expect(set).not.toHaveBeenCalled();
  });

  it('captures the phone value, applies the step, and restores on the last release', async () => {
    const release = acquireReaderBrightness(0.4);
    await jest.advanceTimersByTimeAsync(0);
    expect(get).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenLastCalledWith(0.4);

    release();
    await jest.advanceTimersByTimeAsync(RELEASE_GRACE_MS + 1);
    expect(set).toHaveBeenLastCalledWith(0.9);
    expect(remove).toHaveBeenCalled();
  });

  it('does not restore across a surface handoff inside the grace window', async () => {
    const first = acquireReaderBrightness(0.4);
    await jest.advanceTimersByTimeAsync(0);
    first();
    const second = acquireReaderBrightness(0.4);
    await jest.advanceTimersByTimeAsync(RELEASE_GRACE_MS + 1);
    // Still held by the second surface: the 0.9 restore never fired.
    expect(set.mock.calls.map((c) => c[0])).toEqual([0.4, 0.4]);
    second();
    await jest.advanceTimersByTimeAsync(RELEASE_GRACE_MS + 1);
    expect(set).toHaveBeenLastCalledWith(0.9);
  });

  it('restores on background and re-applies on foreground', async () => {
    acquireReaderBrightness(0.2);
    await jest.advanceTimersByTimeAsync(0);
    appStateHandler?.('background');
    await jest.advanceTimersByTimeAsync(0);
    expect(set).toHaveBeenLastCalledWith(0.9);
    appStateHandler?.('active');
    await jest.advanceTimersByTimeAsync(0);
    expect(set).toHaveBeenLastCalledWith(0.2);
  });

  it('switching the step to null hands the phone back while still held', async () => {
    acquireReaderBrightness(0.6);
    await jest.advanceTimersByTimeAsync(0);
    setReaderBrightnessStep(null);
    await jest.advanceTimersByTimeAsync(0);
    expect(set).toHaveBeenLastCalledWith(0.9);
    setReaderBrightnessStep(0.8);
    await jest.advanceTimersByTimeAsync(0);
    expect(set).toHaveBeenLastCalledWith(0.8);
  });

  it('survives a native failure without throwing', async () => {
    get.mockRejectedValueOnce(new Error('no display'));
    set.mockRejectedValueOnce(new Error('no display'));
    const release = acquireReaderBrightness(0.4);
    await jest.advanceTimersByTimeAsync(0);
    release();
    await expect(jest.advanceTimersByTimeAsync(RELEASE_GRACE_MS + 1)).resolves.toBeUndefined();
  });
});
