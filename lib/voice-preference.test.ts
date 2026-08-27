/**
 * Unit tests for lib/voice-preference.ts.
 *
 * These pin the DELIBERATE decisions in that file: the key is device-wide (not
 * user-scoped — see the module comment for why that is correct here), and no
 * read path can throw, because a taste preference must never block playback.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  VOICE_GENDER_KEY,
  DEFAULT_VOICE_GENDER,
  loadVoiceGender,
  saveVoiceGender,
} from './voice-preference';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      getItem: jest.fn(async (key: string) => (key in store ? store[key] : null)),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      clear: jest.fn(async () => {
        store = {};
      }),
    },
  };
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('voice preference', () => {
  it('round-trips both genders', async () => {
    await saveVoiceGender('male');
    expect(await loadVoiceGender()).toBe('male');

    await saveVoiceGender('female');
    expect(await loadVoiceGender()).toBe('female');
  });

  it('falls back to the default when nothing is stored', async () => {
    expect(await loadVoiceGender()).toBe(DEFAULT_VOICE_GENDER);
  });

  it('falls back to the default on a value outside the enum', async () => {
    await AsyncStorage.setItem(VOICE_GENDER_KEY, 'nonbinary-robot');
    expect(await loadVoiceGender()).toBe(DEFAULT_VOICE_GENDER);
  });

  it('does not throw when the read fails', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(loadVoiceGender()).resolves.toBe(DEFAULT_VOICE_GENDER);
  });

  it('is stored device-wide, with no user id in the key', async () => {
    // Asserted on purpose. If a future change scopes this per user it must be
    // a considered decision with the module comment updated, not a drive-by.
    await saveVoiceGender('male');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(VOICE_GENDER_KEY, 'male');
    expect(VOICE_GENDER_KEY).toBe('tutor-voice-gender');
  });
});
