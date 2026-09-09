/**
 * In-app brightness for the reader, with the phone's own setting restored
 * on the way out.
 *
 * `expo-brightness` on iOS writes the SYSTEM brightness, and the value it
 * writes outlives the app: leave the reader dimmed and the home screen stays
 * dimmed until the phone locks. So this module is the only caller, and its
 * whole job is the bookkeeping that makes the change reversible:
 *
 *   • The FIRST reading surface to mount captures the phone's brightness and
 *     applies the learner's step. The LAST to unmount restores it.
 *   • Backgrounding restores it too (the learner is now looking at something
 *     else), and returning to the foreground re-applies it.
 *   • A `null` step means "leave the phone alone", and nothing is written.
 *
 * Reference counting rather than per-surface effects because a passage hands
 * off to its questions screen in one React commit — the old surface unmounts
 * and the new one mounts — and a naive pair of effects would restore and
 * re-dim across that boundary. The release is also deferred a beat so the
 * count never touches zero during such a handoff.
 *
 * Every native call is wrapped: the module is absent under jest, permission
 * is not needed for the app window on either platform, and a failure here
 * must never take the page down with it.
 */
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import * as Brightness from 'expo-brightness';
import type { ReaderBrightness } from './reading-preferences';

/** How long a release waits before restoring, so a surface handoff that
 *  releases and re-acquires in the same commit is not a flicker. */
export const RELEASE_GRACE_MS = 250;

let holders = 0;
let original: number | null = null;
let desired: ReaderBrightness = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: NativeEventSubscription | null = null;

async function write(value: number): Promise<void> {
  try {
    await Brightness.setBrightnessAsync(value);
  } catch {
    // Unsupported or refused — the page still renders.
  }
}

async function captureOriginal(): Promise<void> {
  if (original !== null) return;
  try {
    original = await Brightness.getBrightnessAsync();
  } catch {
    original = null;
  }
}

async function apply(): Promise<void> {
  if (desired === null) return;
  await captureOriginal();
  await write(desired);
}

async function restore(): Promise<void> {
  if (original === null) return;
  const value = original;
  original = null;
  await write(value);
}

function onAppState(state: AppStateStatus): void {
  if (holders === 0) return;
  if (state === 'active') void apply();
  else void restore();
}

/**
 * A reading surface is on screen with this brightness step. Returns the
 * release to call on unmount. Call again with a new step to change it.
 */
export function acquireReaderBrightness(step: ReaderBrightness): () => void {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  holders += 1;
  if (!appStateSub) appStateSub = AppState.addEventListener('change', onAppState);
  setReaderBrightnessStep(step);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders > 0) return;
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      if (holders > 0) return;
      appStateSub?.remove();
      appStateSub = null;
      void restore();
    }, RELEASE_GRACE_MS);
  };
}

/** Change the step while a surface is held. `null` hands the phone back. */
export function setReaderBrightnessStep(step: ReaderBrightness): void {
  desired = step;
  if (holders === 0) return;
  if (step === null) void restore();
  else void apply();
}

/** Test-only: drop all state, including a pending release. */
export function resetReaderBrightnessForTests(): void {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
  holders = 0;
  original = null;
  desired = null;
  appStateSub?.remove();
  appStateSub = null;
}
