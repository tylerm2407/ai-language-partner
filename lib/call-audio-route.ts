/**
 * Which output the tutor's voice comes out of.
 *
 * ── WHY THIS EXISTS AT ALL ──
 *
 * WebRTC's voice-chat audio mode routes to the EARPIECE by default, and it is
 * right to: it is built for phone calls, where the device is against your head.
 * A tutor call is not that. The learner is holding the phone in front of them
 * reading a live transcript, and the earpiece points at their cheek. The
 * symptom is not silence — it is audio that is technically playing and
 * inaudible, which reads as "the tutor never answered" and gets the feature
 * uninstalled rather than reported.
 *
 * So we override to the speaker. But only when there is nowhere better to send
 * it: someone on AirPods, or wired into a headset on a train, has already told
 * us where they want the audio, and blasting a language lesson out of the
 * loudspeaker in a quiet carriage is a far worse failure than a quiet one.
 * Their choice wins over our default.
 *
 * The earpiece is therefore never chosen here. It is in the type because the
 * platform reports it as a device and because a learner can still select it
 * deliberately — this function answers "where should it go if nobody has said
 * otherwise", not "where is it allowed to go".
 *
 * A pure truth table, so `call-audio-route.test.ts` covers every combination
 * without a device.
 */

export type AudioRoute = 'speaker' | 'earpiece' | 'wired' | 'bluetooth';

/**
 * One available output, as the platform reports it.
 *
 * Deliberately minimal: `kind` is the only field the decision depends on, and
 * a type that carries more invites a rule that depends on more.
 */
export interface AudioDevice {
  kind: AudioRoute;
  /** For logs and any future picker UI. Never used in the decision. */
  name?: string;
}

/**
 * Where to send the call audio when the learner has not chosen.
 *
 * Precedence, highest first:
 *   1. Bluetooth — the learner deliberately paired and connected something.
 *   2. Wired — they deliberately plugged something in.
 *   3. Speaker — our override of the WebRTC earpiece default.
 *
 * Bluetooth beats wired because on iOS a wired route is often still listed
 * while AirPods are connected, and the more recent deliberate act is the
 * pairing. An empty list still yields `speaker`: a device that reports no
 * outputs at all has a speaker, and returning `earpiece` on no evidence would
 * reintroduce the exact silent failure this module prevents.
 */
export function preferredRoute(devices: AudioDevice[]): AudioRoute {
  if (devices.some((d) => d.kind === 'bluetooth')) return 'bluetooth';
  if (devices.some((d) => d.kind === 'wired')) return 'wired';
  return 'speaker';
}

/**
 * True when we are overriding the platform's own choice rather than following
 * the learner's. Worth knowing at the call site: it is the only case where a
 * "speaker on" affordance should be shown as something we did.
 */
export function isForcedSpeaker(devices: AudioDevice[]): boolean {
  return preferredRoute(devices) === 'speaker';
}
