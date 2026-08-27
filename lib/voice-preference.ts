/**
 * Tutor voice preference.
 *
 * Which voice a learner wants to practise against is a taste call, not a
 * learning one — some people find one register easier to follow, and hearing a
 * voice you dislike for twenty minutes a day is a reason to stop showing up.
 *
 * Device-local by design: it's a playback preference, not part of the learning
 * record, so it doesn't belong in the shared profile table. The server treats
 * it as a hint — if a language has no vetted voice in the chosen gender, TTS
 * falls back to that language's default rather than refusing to speak.
 *
 * Deliberately NOT user-scoped, unlike the hands-free config next door. This
 * was reviewed as part of the shared-device leak that scoped down
 * `pending-onboarding`, and the conclusion is that it does not belong in that
 * category: the stored value is one bit from a closed two-value enum. It
 * carries no text the previous learner wrote, names nobody, and reveals
 * nothing about them beyond a taste in synthetic timbre — so a second learner
 * inheriting it is a preference mismatch, not a disclosure. It behaves like
 * volume or playback speed, which are device settings everywhere else too.
 *
 * The cost of leaving it device-wide is bounded and self-correcting: the
 * control lives on the chat screen where the voice is actually heard, so a
 * learner who dislikes the inherited voice fixes it in one tap, in the same
 * place they noticed it. Scoping it per user would instead cost every learner
 * their choice each time they moved between their own devices, for no privacy
 * gain.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VoiceGender = 'male' | 'female';

export const VOICE_GENDER_KEY = 'tutor-voice-gender';

/** Used until the learner expresses a preference. */
export const DEFAULT_VOICE_GENDER: VoiceGender = 'female';

function isVoiceGender(value: unknown): value is VoiceGender {
  return value === 'male' || value === 'female';
}

/** Read the stored preference. Falls back to the default on any read error —
 *  a corrupt preference must never block audio playback. */
export async function loadVoiceGender(): Promise<VoiceGender> {
  try {
    const stored = await AsyncStorage.getItem(VOICE_GENDER_KEY);
    return isVoiceGender(stored) ? stored : DEFAULT_VOICE_GENDER;
  } catch {
    return DEFAULT_VOICE_GENDER;
  }
}

export async function saveVoiceGender(gender: VoiceGender): Promise<void> {
  await AsyncStorage.setItem(VOICE_GENDER_KEY, gender);
}
