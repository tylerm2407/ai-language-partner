/**
 * Unit tests for call audio routing.
 *
 * The failure being prevented: WebRTC's voice-chat mode routes to the earpiece,
 * so the tutor plays audibly-nothing into the learner's cheek while they read
 * the transcript. That reads as "the tutor never answered" and gets the app
 * uninstalled rather than reported. The counter-failure is just as real —
 * forcing the loudspeaker over someone's connected AirPods on a train.
 *
 * Every combination is covered because the table is small enough that there is
 * no excuse for a gap in it.
 */

import { isForcedSpeaker, preferredRoute, type AudioDevice, type AudioRoute } from './call-audio-route';

const dev = (kind: AudioRoute): AudioDevice => ({ kind, name: `${kind} device` });

const ALL: AudioRoute[] = ['speaker', 'earpiece', 'wired', 'bluetooth'];

describe('preferredRoute', () => {
  it('forces the speaker when nothing is connected', () => {
    expect(preferredRoute([])).toBe('speaker');
    expect(preferredRoute([dev('speaker')])).toBe('speaker');
    expect(preferredRoute([dev('earpiece')])).toBe('speaker');
    expect(preferredRoute([dev('speaker'), dev('earpiece')])).toBe('speaker');
  });

  it('follows a wired headset', () => {
    expect(preferredRoute([dev('wired')])).toBe('wired');
    expect(preferredRoute([dev('speaker'), dev('earpiece'), dev('wired')])).toBe('wired');
  });

  it('prefers bluetooth over everything', () => {
    // On iOS a wired route is often still listed while AirPods are connected,
    // and the pairing is the more recent deliberate act.
    expect(preferredRoute([dev('bluetooth')])).toBe('bluetooth');
    expect(preferredRoute([dev('wired'), dev('bluetooth')])).toBe('bluetooth');
    expect(preferredRoute(ALL.map(dev))).toBe('bluetooth');
  });

  it('never chooses the earpiece, in any combination', () => {
    // The earpiece is in the type because the platform reports it and because
    // a learner may pick it deliberately. It is never our answer.
    for (const devices of everyCombination()) {
      expect(preferredRoute(devices)).not.toBe('earpiece');
    }
  });

  it('covers all sixteen combinations with the documented precedence', () => {
    for (const devices of everyCombination()) {
      const kinds = new Set(devices.map((d) => d.kind));
      const expected: AudioRoute = kinds.has('bluetooth')
        ? 'bluetooth'
        : kinds.has('wired')
          ? 'wired'
          : 'speaker';
      expect(preferredRoute(devices)).toBe(expected);
    }
  });

  it('does not depend on the order the platform lists devices in', () => {
    expect(preferredRoute([dev('bluetooth'), dev('wired')])).toBe(
      preferredRoute([dev('wired'), dev('bluetooth')]),
    );
  });

  it('ignores the name field entirely', () => {
    expect(preferredRoute([{ kind: 'wired', name: 'Bluetooth Speaker' }])).toBe('wired');
    expect(preferredRoute([{ kind: 'speaker' }])).toBe('speaker');
  });
});

describe('isForcedSpeaker', () => {
  it('is true only when we are overriding rather than following the learner', () => {
    expect(isForcedSpeaker([])).toBe(true);
    expect(isForcedSpeaker([dev('earpiece')])).toBe(true);
    expect(isForcedSpeaker([dev('wired')])).toBe(false);
    expect(isForcedSpeaker([dev('bluetooth')])).toBe(false);
  });
});

/** All 16 subsets of the four device kinds, including the empty list. */
function everyCombination(): AudioDevice[][] {
  const out: AudioDevice[][] = [];
  for (let mask = 0; mask < 1 << ALL.length; mask++) {
    out.push(ALL.filter((_, i) => mask & (1 << i)).map(dev));
  }
  return out;
}
