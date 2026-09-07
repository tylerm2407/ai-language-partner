/**
 * Unit tests for tutor preference storage.
 *
 * Two rules are being pinned. Preferences are USER-scoped, because correction
 * mode is a statement about how this person copes with being interrupted mid
 * -struggle and not a property of the glass. And "never chosen" survives as a
 * state distinct from any default, because the plan is to ask rather than
 * impose — which is only possible if the two can be told apart.
 *
 * AsyncStorage is replaced with the same in-memory mock shape used by
 * handsfree-storage.test.ts and lesson-session-storage.test.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  NOTHING_CHOSEN,
  TUTOR_PREFS_SCHEMA_VERSION,
  TUTOR_STORAGE_VERSION,
  loadTutorPreferences,
  needsCorrectionModeChoice,
  saveCorrectionMode,
  saveTutorPersona,
  saveTutorPreferences,
} from './tutor-storage';

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

const USER = 'user-abc';
const OTHER = 'user-xyz';
const key = (userId: string) => `tutor:prefs:v${TUTOR_STORAGE_VERSION}:${userId}`;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('user scoping', () => {
  it('keys on the learner, not the device', () => {
    expect(key(USER)).toContain(USER);
    expect(key(USER)).not.toBe(key(OTHER));
  });

  it('does not leak a correction mode between learners on a shared device', async () => {
    await saveCorrectionMode(USER, 'let_me_talk');
    expect(await loadTutorPreferences(OTHER)).toEqual(NOTHING_CHOSEN);
    // And the first learner still has theirs.
    expect((await loadTutorPreferences(USER)).correctionMode).toBe('let_me_talk');
  });
});

describe('"not chosen" is its own state', () => {
  it('reads back null for both fields before anything is stored', async () => {
    expect(await loadTutorPreferences(USER)).toEqual({ personaId: null, correctionMode: null });
  });

  it('reports that the first-launch question still needs asking', async () => {
    expect(needsCorrectionModeChoice(await loadTutorPreferences(USER))).toBe(true);
    await saveCorrectionMode(USER, 'as_you_go');
    expect(needsCorrectionModeChoice(await loadTutorPreferences(USER))).toBe(false);
  });

  it('treats an explicitly chosen mode as chosen even when it matches nothing', async () => {
    // There is no default to collide with — that is the point.
    await saveCorrectionMode(USER, 'let_me_talk');
    expect(await loadTutorPreferences(USER)).toEqual({
      personaId: null,
      correctionMode: 'let_me_talk',
    });
  });
});

describe('round trip', () => {
  it('stores and reads both fields', async () => {
    await saveTutorPreferences(USER, { personaId: 'theo', correctionMode: 'as_you_go' });
    expect(await loadTutorPreferences(USER)).toEqual({
      personaId: 'theo',
      correctionMode: 'as_you_go',
    });
  });

  it('stamps the schema version onto what it writes', async () => {
    await saveTutorPersona(USER, 'mara');
    expect(JSON.parse((await AsyncStorage.getItem(key(USER))) as string)).toEqual({
      version: TUTOR_PREFS_SCHEMA_VERSION,
      personaId: 'mara',
      correctionMode: null,
    });
  });

  it('does not erase the other field when only one is saved', async () => {
    // The persona is chosen on one screen and the mode on another.
    await saveTutorPersona(USER, 'nico');
    await saveCorrectionMode(USER, 'let_me_talk');
    expect(await loadTutorPreferences(USER)).toEqual({
      personaId: 'nico',
      correctionMode: 'let_me_talk',
    });
  });

  it('allows a field to be cleared back to "not chosen" explicitly', async () => {
    await saveTutorPreferences(USER, { personaId: 'nico', correctionMode: 'as_you_go' });
    await saveTutorPreferences(USER, { personaId: null });
    expect(await loadTutorPreferences(USER)).toEqual({
      personaId: null,
      correctionMode: 'as_you_go',
    });
  });
});

describe('rejecting what it cannot vouch for', () => {
  it('discards a blob from a foreign schema version', async () => {
    await AsyncStorage.setItem(
      key(USER),
      JSON.stringify({ version: 99, personaId: 'mara', correctionMode: 'as_you_go' }),
    );
    expect(await loadTutorPreferences(USER)).toEqual(NOTHING_CHOSEN);
    expect(await AsyncStorage.getItem(key(USER))).toBeNull();
  });

  it('discards a pre-envelope blob with no version at all', async () => {
    await AsyncStorage.setItem(key(USER), JSON.stringify({ personaId: 'mara' }));
    expect(await loadTutorPreferences(USER)).toEqual(NOTHING_CHOSEN);
  });

  it('survives unparseable JSON', async () => {
    await AsyncStorage.setItem(key(USER), 'not json {');
    expect(await loadTutorPreferences(USER)).toEqual(NOTHING_CHOSEN);
  });

  it('survives a stored primitive where an object was expected', async () => {
    await AsyncStorage.setItem(key(USER), '"mara"');
    expect(await loadTutorPreferences(USER)).toEqual(NOTHING_CHOSEN);
  });

  it('drops a retired persona id but keeps the correction mode', async () => {
    // Validated independently: re-ask only the question we cannot answer.
    await AsyncStorage.setItem(
      key(USER),
      JSON.stringify({
        version: TUTOR_PREFS_SCHEMA_VERSION,
        personaId: 'someone-who-left',
        correctionMode: 'let_me_talk',
      }),
    );
    expect(await loadTutorPreferences(USER)).toEqual({
      personaId: null,
      correctionMode: 'let_me_talk',
    });
  });

  it('drops an unrecognised correction mode but keeps the persona', async () => {
    await AsyncStorage.setItem(
      key(USER),
      JSON.stringify({
        version: TUTOR_PREFS_SCHEMA_VERSION,
        personaId: 'amira',
        correctionMode: 'whenever',
      }),
    );
    expect(await loadTutorPreferences(USER)).toEqual({
      personaId: 'amira',
      correctionMode: null,
    });
  });
});

describe('degrading when storage throws', () => {
  it('reads as "not chosen" when the store is unavailable', async () => {
    // Private mode, cleared data, a full disk. Being asked again is the worst
    // acceptable outcome; taking down the call is not.
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
    expect(await loadTutorPreferences(USER)).toEqual(NOTHING_CHOSEN);
  });

  it('reads as "not chosen" when the store throws synchronously', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(await loadTutorPreferences(USER)).toEqual(NOTHING_CHOSEN);
  });

  it('does not reject when the write fails', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(saveCorrectionMode(USER, 'as_you_go')).resolves.toBeUndefined();
    expect(await loadTutorPreferences(USER)).toEqual(NOTHING_CHOSEN);
  });

  it('does not reject when the removal of a bad blob fails', async () => {
    await AsyncStorage.setItem(key(USER), JSON.stringify({ version: 99 }));
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    expect(await loadTutorPreferences(USER)).toEqual(NOTHING_CHOSEN);
  });

  it('still saves the new choice when the read half fails', async () => {
    // Accepted consequence: the untouched field is written back as null and
    // that one question is asked again. Refusing to save would throw away the
    // choice the learner just made in favour of one we cannot see.
    await saveTutorPersona(USER, 'mara');
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('flaky'));
    await saveCorrectionMode(USER, 'as_you_go');
    expect(await loadTutorPreferences(USER)).toEqual({
      personaId: null,
      correctionMode: 'as_you_go',
    });
  });
});
