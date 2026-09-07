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
  | 'handsfree-record'
  /**
   * A news article is being narrated by react-native-track-player.
   *
   * This mode is DELEGATED: expo-av must not hold the session while RNTP has
   * it. RNTP configures the native session itself (AVAudioSession on iOS, a
   * media-playback foreground service on Android), and two owners racing over
   * one device resource is the exact class of bug this module was written to
   * end — so entering this mode deliberately releases expo-av to `idle`
   * settings and then leaves it alone. See enterNewsPlaybackSession below.
   */
  | 'news-play'
  /**
   * A live voice-tutor call is running on react-native-webrtc.
   *
   * DELEGATED, for the same reason as `news-play` but with a sharper edge.
   * WebRTC configures the native session itself — AVAudioSession
   * `playAndRecord` + `voiceChat` on iOS, `MODE_IN_COMMUNICATION` on Android —
   * because that is what routes the mic through the VoiceProcessingIO unit and
   * gets hardware acoustic echo cancellation. The AEC is the entire reason
   * barge-in works in a call and does not work in chat: without it the tutor's
   * own voice comes back in through the mic and the model interrupts itself.
   *
   * So expo-av must not be holding a competing configuration when WebRTC takes
   * the session. This mode is expo-av standing down. See
   * enterTutorCallSession below.
   */
  | 'tutor-call';

/**
 * Background audio through EXPO-AV is iOS-only. `UIBackgroundModes: ["audio"]`
 * is declared, but expo-av has no Android foreground service of its own, so
 * `staysActiveInBackground` on Android 14+ does not reliably survive
 * backgrounding. Claiming otherwise here would just move the failure somewhere
 * harder to find.
 *
 * This does NOT apply to the `news-play` mode. That path runs on
 * react-native-track-player, which ships a real media-playback foreground
 * service (declared in AndroidManifest.xml), so news narration backgrounds
 * correctly on both platforms. The two facts are separate on purpose: this
 * constant is about what expo-av can promise, not about the app.
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

  /**
   * Delegated to react-native-track-player.
   *
   * These are expo-av's STAND-DOWN settings, not the settings the narration
   * plays under — RNTP sets those natively. expo-av is told to hold nothing
   * and mix with whatever else is happening, so that when RNTP takes the
   * session there is no second claimant to fight with. `allowsRecordingIOS`
   * false in particular matters: leaving PlayAndRecord set here would route
   * RNTP's output to the earpiece, which is the original bug in this file's
   * header wearing a different hat.
   */
  'news-play': {
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  },

  /**
   * Delegated to react-native-webrtc.
   *
   * Same shape as `news-play`, and for the same structural reason: these are
   * expo-av's STAND-DOWN settings, not the settings the call runs under. WebRTC
   * sets those natively, and it has to — the VoiceProcessingIO route it asks
   * for is what supplies echo cancellation, and expo-av cannot ask for it.
   *
   * Written out in full rather than aliased to `news-play` even though the
   * fields are currently identical. They are the same by coincidence of what
   * standing down means today; collapsing them would make a future divergence
   * an edit to two callers' behaviour instead of one.
   *
   * `allowsRecordingIOS: false` is the field that matters on the way out. Leave
   * PlayAndRecord asserted here and the NEXT screen's playback routes to the
   * earpiece — the original bug in this file's header, wearing a third hat.
   */
  'tutor-call': {
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
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
 * Hand the device audio session to react-native-track-player.
 *
 * Call this before RNTP starts playing, and `releaseNewsPlaybackSession()`
 * when it stops. The two exist so the handoff is a named, greppable event
 * rather than an implicit consequence of whichever screen happened to mount:
 * an article player left holding the session is how the next lesson ends up
 * playing out of the earpiece.
 */
export async function enterNewsPlaybackSession(): Promise<void> {
  await setAudioSessionMode('news-play');
}

/**
 * Take the session back from react-native-track-player.
 *
 * Returns to `idle` rather than to the previous mode: the screen that was
 * playing is gone, and whatever comes next (a lesson, a chat reply) sets the
 * mode it needs on its own way in. Restoring a stale mode here would reassert
 * a claim nobody currently wants.
 */
export async function releaseNewsPlaybackSession(): Promise<void> {
  await setAudioSessionMode('idle');
}

/**
 * Hand the device audio session to react-native-webrtc for a tutor call.
 *
 * ORDER MATTERS, and it is not symmetric:
 *
 *   - Call this BEFORE `getUserMedia`. WebRTC configures the native session as
 *     part of acquiring the mic track, so expo-av has to have let go by then;
 *     standing down afterwards means two owners raced over the route and the
 *     call may already be running through the wrong one.
 *   - Call `releaseTutorCallSession()` in a `finally`, AFTER the peer
 *     connection is closed and every track is stopped. Releasing while a track
 *     is live hands back a session WebRTC is still using.
 *
 * The pair exists so the handoff is a named, greppable event rather than an
 * implicit consequence of whichever screen happened to mount.
 */
export async function enterTutorCallSession(): Promise<void> {
  await setAudioSessionMode('tutor-call');
}

/**
 * Take the session back from react-native-webrtc.
 *
 * Returns to `idle` rather than to the previous mode, for the same reason as
 * the news pair: the call screen is gone, and whatever comes next sets the mode
 * it needs on its own way in. Restoring a stale mode here would reassert a claim
 * nobody currently wants — and if that stale mode were `record` or
 * `handsfree-record`, it would reassert `allowsRecordingIOS` and route the next
 * screen's playback to the earpiece.
 */
export async function releaseTutorCallSession(): Promise<void> {
  await setAudioSessionMode('idle');
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
