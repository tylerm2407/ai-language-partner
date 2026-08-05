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
