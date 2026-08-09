/**
 * The single owner of the device audio session.
 *
 * WHY THIS EXISTS
 * `Audio.setAudioModeAsync` takes a complete `AudioMode` — every field is
 * required and any field you omit is reset to its default. The app previously
 * called it from five places across three files with partial-looking objects,
 * and the bugs that produced were exactly the ones you would predict:
 *
 *   - `useAudioRecorder` set `allowsRecordingIOS: true` on start and never set
 *     it back. On iOS that leaves the session in PlayAndRecord, which routes
 *     playback to the earpiece — so a learner who did a lesson speaking
 *     exercise and then played any audio heard it, faintly, out of the phone's
 *     earpiece instead of the speaker.
 *   - A chat teardown path set `{ allowsRecordingIOS: false }` alone, silently
 *     resetting `playsInSilentModeIOS` and `staysActiveInBackground` to false —
 *     which means audio stops in silent mode and dies on backgrounding.
 *   - Nothing anywhere set `interruptionModeIOS`, so navigation prompts and
 *     other apps interrupted playback rather than ducking it.
 *
 * Callers here choose a named mode, never a field. Passing a partial object is
 * not expressible, so that entire class of bug is gone structurally rather
 * than by review discipline.
 *
 * If you are adding a `setAudioModeAsync` call somewhere else: don't. Add a
 * mode here instead. There is a grep gate on this in the hands-free spec.
 */
import { Platform } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import type { AudioMode } from 'expo-av';

export type AudioSessionMode =
  /** Nothing playing or recording. Mixes with other apps; does not hold the session. */
  | 'idle'
  /** Foreground one-shot playback: lesson audio, listening prompts, TTS replay. */
  | 'playback'
  /** Foreground press-to-talk recording. */
  | 'record'
  /** Hands-free playback: survives backgrounding on iOS, ducks for nav prompts. */
  | 'handsfree-play'
  /** Hands-free recording: survives backgrounding on iOS. */
  | 'handsfree-record';

/**
 * Background audio is iOS-only for now. `UIBackgroundModes: ["audio"]` is
 * declared in app.json, but the Android manifest has no FOREGROUND_SERVICE /
 * FOREGROUND_SERVICE_MEDIA_PLAYBACK permission and no media service, so
 * `staysActiveInBackground` on Android 14+ does not reliably survive
 * backgrounding. Claiming otherwise here would just move the failure somewhere
 * harder to find. Android background arrives with the media-service work.
 */
const BACKGROUND_CAPABLE = Platform.OS === 'ios';

/**
 * Every mode is a COMPLETE AudioMode. Do not refactor these into a base object
 * plus overrides — the whole point is that each one is readable in full at the
 * point of definition, so an omission is visible rather than inherited.
 */
const MODES: Record<AudioSessionMode, AudioMode> = {
  idle: {
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    // Android has no MixWithOthers; DuckOthers is the closest non-interrupting
    // option and is the platform default anyway.
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  },

  playback: {
    allowsRecordingIOS: false,
    // Learners routinely have the ringer switch off. Audio exercises that go
    // silent in that case read as a broken app, not as a respected setting.
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  },

  record: {
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    // A recording cannot duck — mixing another app's audio into the mic input
    // is worse than briefly interrupting it.
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  },

  'handsfree-play': {
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: BACKGROUND_CAPABLE,
    // DuckOthers, deliberately not DoNotMix: a hands-free session runs while
    // the learner is driving or walking, and a navigation prompt must be able
    // to talk over us. DoNotMix would invert that — Maps would interrupt the
    // lesson instead of the lesson yielding to Maps.
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  },

  'handsfree-record': {
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: BACKGROUND_CAPABLE,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  },
};

let currentMode: AudioSessionMode = 'idle';
let previousMode: AudioSessionMode = 'idle';

/**
 * Serialises mode changes. Two concurrent `setAudioModeAsync` calls can land
 * out of order, leaving the session in whichever finished last rather than
 * whichever was requested last — and the hands-free loop flips between play
 * and record on every turn, so this is a real race, not a theoretical one.
 */
let chain: Promise<void> = Promise.resolve();

/**
 * Apply a named audio session mode.
 *
 * Errors are swallowed after logging. A failed mode change degrades audio
 * routing; throwing here would abort a lesson or a hands-free session over
 * something the learner can usually still hear through.
 */
export async function setAudioSessionMode(mode: AudioSessionMode): Promise<void> {
  const task = chain.then(async () => {
    if (mode === currentMode) return;
    try {
      await Audio.setAudioModeAsync(MODES[mode]);
      previousMode = currentMode;
      currentMode = mode;
    } catch (err) {
      console.warn(`[audio-session] failed to enter "${mode}":`, err);
    }
  });
  chain = task.catch(() => {});
  await task;
}

/** The mode currently applied. */
export function currentAudioSessionMode(): AudioSessionMode {
  return currentMode;
}

/**
 * Mode selectors for callers whose only variable is whether the session is
 * hands-free (chat TTS playback, chat recording).
 *
 * These are functions rather than ternaries inlined at the call sites because
 * there is no component-render test harness in this project: a screen's choice
 * of mode is otherwise unassertable, and choosing the wrong one is the exact
 * bug class this module exists to prevent.
 */
export function playbackModeFor(handsFree: boolean): AudioSessionMode {
  return handsFree ? 'handsfree-play' : 'playback';
}

export function recordingModeFor(handsFree: boolean): AudioSessionMode {
  return handsFree ? 'handsfree-record' : 'record';
}

/**
 * Return to the mode active before the last successful change. For teardown
 * and error paths, where the caller knows it is done but not what came before.
 */
export async function restorePreviousAudioSessionMode(): Promise<void> {
  await setAudioSessionMode(previousMode);
}

/**
 * Test-only reset. The module holds process-global state to mirror a
 * process-global device resource; tests need to clear it between cases.
 */
export function __resetAudioSessionForTests(): void {
  currentMode = 'idle';
  previousMode = 'idle';
  chain = Promise.resolve();
}
