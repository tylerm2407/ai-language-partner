/**
 * Unit tests for the audio session owner.
 *
 * These lock the invariants that the five scattered `setAudioModeAsync` calls
 * violated in three different ways: every mode must be a COMPLETE AudioMode
 * (an omitted field is silently reset to its default by expo-av), recording
 * must never be left enabled, and concurrent mode changes must not race.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import {
  setAudioSessionMode,
  currentAudioSessionMode,
  restorePreviousAudioSessionMode,
  playbackModeFor,
  recordingModeFor,
  enterNewsPlaybackSession,
  releaseNewsPlaybackSession,
  enterTutorCallSession,
  releaseTutorCallSession,
  __resetAudioSessionForTests,
  type AudioSessionMode,
} from './audio-session';

jest.mock('expo-av', () => ({
  __esModule: true,
  Audio: { setAudioModeAsync: jest.fn(async () => undefined) },
  InterruptionModeIOS: { MixWithOthers: 0, DoNotMix: 1, DuckOthers: 2 },
  InterruptionModeAndroid: { DoNotMix: 1, DuckOthers: 2 },
}));

const setAudioModeAsync = Audio.setAudioModeAsync as jest.Mock;

const ALL_MODES: AudioSessionMode[] = [
  'idle',
  'playback',
  'record',
  'handsfree-play',
  'handsfree-record',
  // The two DELEGATED modes. They are expo-av standing down for another audio
  // owner (track-player, WebRTC) — which makes completeness matter more here,
  // not less: an omitted field is silently defaulted, and the default that
  // bites is the one that leaves the session claimed on the way out.
  'news-play',
  'tutor-call',
];

/** Every field expo-av's AudioMode requires. */
const REQUIRED_FIELDS = [
  'allowsRecordingIOS',
  'playsInSilentModeIOS',
  'staysActiveInBackground',
  'interruptionModeIOS',
  'interruptionModeAndroid',
  'shouldDuckAndroid',
  'playThroughEarpieceAndroid',
] as const;

beforeEach(() => {
  setAudioModeAsync.mockClear();
  setAudioModeAsync.mockImplementation(async () => undefined);
  __resetAudioSessionForTests();
});

describe('mode completeness', () => {
  it.each(ALL_MODES)('"%s" passes every required AudioMode field', async (mode) => {
    // 'idle' is the starting mode and would be skipped as a no-op, so step
    // away first to guarantee the call actually happens.
    if (mode === 'idle') await setAudioSessionMode('playback');
    setAudioModeAsync.mockClear();

    await setAudioSessionMode(mode);

    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
    const applied = setAudioModeAsync.mock.calls[0][0];
    for (const field of REQUIRED_FIELDS) {
      expect(applied).toHaveProperty(field);
      expect(applied[field]).toBeDefined();
    }
  });

  it.each(ALL_MODES)('"%s" never routes playback to the Android earpiece', async (mode) => {
    if (mode === 'idle') await setAudioSessionMode('playback');
    setAudioModeAsync.mockClear();
    await setAudioSessionMode(mode);
    expect(setAudioModeAsync.mock.calls[0][0].playThroughEarpieceAndroid).toBe(false);
  });
});

describe('recording is only enabled where intended', () => {
  it('enables recording for the two record modes', async () => {
    await setAudioSessionMode('record');
    expect(setAudioModeAsync.mock.calls[0][0].allowsRecordingIOS).toBe(true);

    setAudioModeAsync.mockClear();
    await setAudioSessionMode('handsfree-record');
    expect(setAudioModeAsync.mock.calls[0][0].allowsRecordingIOS).toBe(true);
  });

  it('disables recording everywhere else — the earpiece-routing bug', async () => {
    for (const mode of [
      'idle',
      'playback',
      'handsfree-play',
      'news-play',
      'tutor-call',
    ] as AudioSessionMode[]) {
      await setAudioSessionMode('record'); // ensure a real transition
      setAudioModeAsync.mockClear();
      await setAudioSessionMode(mode);
      expect(setAudioModeAsync.mock.calls[0][0].allowsRecordingIOS).toBe(false);
    }
  });

  it('keeps audio audible with the ringer switch off in every mode', async () => {
    for (const mode of ALL_MODES) {
      if (mode === currentAudioSessionMode()) continue;
      setAudioModeAsync.mockClear();
      await setAudioSessionMode(mode);
      expect(setAudioModeAsync.mock.calls[0][0].playsInSilentModeIOS).toBe(true);
    }
  });
});

describe('interruption policy', () => {
  it('ducks rather than interrupts during hands-free playback', async () => {
    // DoNotMix here would invert the intent: a navigation prompt must be able
    // to talk over the lesson, not be blocked by it.
    await setAudioSessionMode('handsfree-play');
    const applied = setAudioModeAsync.mock.calls[0][0];
    expect(applied.interruptionModeIOS).toBe(InterruptionModeIOS.DuckOthers);
    expect(applied.interruptionModeAndroid).toBe(InterruptionModeAndroid.DuckOthers);
    expect(applied.shouldDuckAndroid).toBe(true);
  });

  it('does not mix while recording — other audio must not bleed into the mic', async () => {
    await setAudioSessionMode('handsfree-record');
    const applied = setAudioModeAsync.mock.calls[0][0];
    expect(applied.interruptionModeIOS).toBe(InterruptionModeIOS.DoNotMix);
    expect(applied.shouldDuckAndroid).toBe(false);
  });
});

describe('transitions', () => {
  it('starts idle', () => {
    expect(currentAudioSessionMode()).toBe('idle');
  });

  it('tracks the applied mode', async () => {
    await setAudioSessionMode('handsfree-play');
    expect(currentAudioSessionMode()).toBe('handsfree-play');
  });

  it('skips redundant transitions', async () => {
    await setAudioSessionMode('playback');
    setAudioModeAsync.mockClear();
    await setAudioSessionMode('playback');
    expect(setAudioModeAsync).not.toHaveBeenCalled();
  });

  it('restores the previous mode', async () => {
    await setAudioSessionMode('playback');
    await setAudioSessionMode('record');
    await restorePreviousAudioSessionMode();
    expect(currentAudioSessionMode()).toBe('playback');
  });

  it('does not advance the current mode when the native call fails', async () => {
    await setAudioSessionMode('playback');
    setAudioModeAsync.mockRejectedValueOnce(new Error('session busy'));
    await setAudioSessionMode('record');
    // A failed change must not be recorded as applied, or the next call would
    // be skipped as redundant and the session would be stuck wrong.
    expect(currentAudioSessionMode()).toBe('playback');
  });

  it('survives a failed transition and applies the next one', async () => {
    setAudioModeAsync.mockRejectedValueOnce(new Error('boom'));
    await setAudioSessionMode('record');
    await setAudioSessionMode('playback');
    expect(currentAudioSessionMode()).toBe('playback');
  });
});

describe('mode selectors — what the chat screens request', () => {
  it('plays hands-free TTS in a background-capable mode and one-shot TTS in playback', () => {
    // chat/index.tsx speakReply: a hands-free reply has to survive the screen
    // locking; a one-shot reply must not hold the session afterwards.
    expect(playbackModeFor(true)).toBe('handsfree-play');
    expect(playbackModeFor(false)).toBe('playback');
  });

  it('records with silence detection in a background-capable mode', () => {
    // ChatInput startRecording: withSilenceDetection is the hands-free loop.
    expect(recordingModeFor(true)).toBe('handsfree-record');
    expect(recordingModeFor(false)).toBe('record');
  });

  it('never selects a recording mode for playback', async () => {
    for (const handsFree of [true, false]) {
      await setAudioSessionMode('record'); // ensure a real transition
      setAudioModeAsync.mockClear();
      await setAudioSessionMode(playbackModeFor(handsFree));
      expect(setAudioModeAsync.mock.calls[0][0].allowsRecordingIOS).toBe(false);
    }
  });
});

describe('sole ownership of setAudioModeAsync', () => {
  // Invariant 5 in docs/NEXT-SESSION.md §6: this module is the only place that
  // may touch the device audio session. Four call sites drifted out of it once
  // and produced the earpiece-routing bug; a grep gate is cheaper than review
  // discipline, and audio bugs are the category App Review rejects for.
  const ROOT = path.join(__dirname, '..');
  const SCANNED_DIRS = ['app', 'components', 'hooks', 'lib'];
  const ALLOWED = [path.join('lib', 'audio-session.ts'), path.join('lib', 'audio-session.test.ts')];

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sourceFiles(full));
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  /**
   * Strip comments before scanning.
   *
   * The gate used to substring-match the raw file, which meant it fired on a
   * COMMENT — `lib/realtime-transport.ts` documents that WebRTC configures the
   * native session itself and that "this file never touches
   * Audio.setAudioModeAsync", and got reported as an offender for saying so.
   *
   * A guard that punishes a file for correctly documenting the rule teaches
   * people to stop writing the documentation, which is the opposite of what
   * this is for. Match calls, not prose.
   */
  function stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')  // block comments, including JSDoc
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 '); // line comments, but not the // in a URL
  }

  it('is the only module that calls it', () => {
    const offenders = SCANNED_DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)))
      .filter((file) => !ALLOWED.some((allowed) => file.endsWith(allowed)))
      .filter((file) => {
        const code = stripComments(fs.readFileSync(file, 'utf8'));
        // Require the call shape. A bare mention that survived comment
        // stripping (a string literal, a type name) is not a call.
        return /setAudioModeAsync\s*\(/.test(code);
      });

    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it('still catches a real call, so the gate has not been softened into uselessness', () => {
    // Loosening a guard is only safe if you prove it still bites. These are the
    // shapes an actual violation takes.
    const violations = [
      'await Audio.setAudioModeAsync({ allowsRecordingIOS: true });',
      'Audio.setAudioModeAsync(mode)',
      'const f = () => setAudioModeAsync ({});',
    ];
    for (const v of violations) {
      expect(/setAudioModeAsync\s*\(/.test(stripComments(v))).toBe(true);
    }

    // And these are the shapes that must NOT trip it.
    const innocent = [
      '// this file never calls Audio.setAudioModeAsync',
      '/** Routing is audio-session.ts. Never setAudioModeAsync here. */',
      '/* setAudioModeAsync(  ) mentioned inside a block comment */',
    ];
    for (const i of innocent) {
      expect(/setAudioModeAsync\s*\(/.test(stripComments(i))).toBe(false);
    }
  });
});

describe('serialisation', () => {
  it('applies concurrent changes in request order, not completion order', async () => {
    // The hands-free loop flips play/record every turn, so out-of-order
    // completion would leave the session in whichever call happened to finish
    // last rather than whichever was asked for last.
    const order: string[] = [];
    setAudioModeAsync.mockImplementation(async (mode: { allowsRecordingIOS: boolean }) => {
      const delay = mode.allowsRecordingIOS ? 20 : 1;
      await new Promise((r) => setTimeout(r, delay));
      order.push(mode.allowsRecordingIOS ? 'record' : 'play');
    });

    await Promise.all([
      setAudioSessionMode('handsfree-record'),
      setAudioSessionMode('handsfree-play'),
    ]);

    expect(order).toEqual(['record', 'play']);
    expect(currentAudioSessionMode()).toBe('handsfree-play');
  });
});

describe('delegated handoffs — expo-av standing down for another audio owner', () => {
  // These two pairs exist so the handoff is a named event. The assertions are
  // about the shape of the stand-down, because the failure they prevent is
  // silent: a session left claimed does not error, it just routes the next
  // screen's audio somewhere wrong.

  it('"tutor-call" is a COMPLETE AudioMode', async () => {
    // The completeness invariant is the reason this module exists. A delegated
    // mode is the easiest place to get lazy about it — nothing is playing
    // through expo-av, so a missing field looks harmless right up until
    // expo-av defaults it.
    await setAudioSessionMode('tutor-call');
    const applied = setAudioModeAsync.mock.calls[0][0];
    for (const field of REQUIRED_FIELDS) {
      expect(applied).toHaveProperty(field);
      expect(applied[field]).toBeDefined();
    }
  });

  it('stands expo-av down rather than holding the session for the call', async () => {
    await enterTutorCallSession();
    const applied = setAudioModeAsync.mock.calls[0][0];
    // WebRTC configures playAndRecord + voiceChat natively; expo-av asserting
    // its own recording claim on top of that is the two-owners race.
    expect(applied.allowsRecordingIOS).toBe(false);
    expect(applied.interruptionModeIOS).toBe(InterruptionModeIOS.MixWithOthers);
    expect(applied.staysActiveInBackground).toBe(false);
  });

  it('enterTutorCallSession applies the tutor-call mode', async () => {
    await enterTutorCallSession();
    expect(currentAudioSessionMode()).toBe('tutor-call');
  });

  it('releaseTutorCallSession returns to idle, not to a stale previous mode', async () => {
    // The realistic path in: a speaking exercise left the session in `record`,
    // then the learner opens the tutor. Restoring `record` on hang-up would
    // re-assert allowsRecordingIOS and route the next screen to the earpiece.
    await setAudioSessionMode('record');
    await enterTutorCallSession();
    await releaseTutorCallSession();

    expect(currentAudioSessionMode()).toBe('idle');
    const applied = setAudioModeAsync.mock.calls.at(-1)?.[0];
    expect(applied.allowsRecordingIOS).toBe(false);
  });

  it('the news pair behaves the same way — one rule, two delegates', async () => {
    await setAudioSessionMode('handsfree-record');
    await enterNewsPlaybackSession();
    expect(currentAudioSessionMode()).toBe('news-play');
    await releaseNewsPlaybackSession();
    expect(currentAudioSessionMode()).toBe('idle');
  });

  it('is harmless if a later restorePrevious() reaches back into it', async () => {
    // Releasing leaves `previousMode` pointing at the delegated mode, so a
    // screen that tears down with restorePreviousAudioSessionMode() can walk
    // back into it after the call is over. That is fine ONLY because standing
    // down is idle-shaped: nothing is claimed, so re-applying it claims
    // nothing. Asserted rather than assumed — if a future stand-down mode ever
    // asserts a claim, this is where it gets caught.
    await enterTutorCallSession();
    await releaseTutorCallSession();
    setAudioModeAsync.mockClear();

    await restorePreviousAudioSessionMode();

    const applied = setAudioModeAsync.mock.calls[0][0];
    expect(applied.allowsRecordingIOS).toBe(false);
    expect(applied.staysActiveInBackground).toBe(false);
    expect(applied.interruptionModeIOS).toBe(InterruptionModeIOS.MixWithOthers);
  });
});
