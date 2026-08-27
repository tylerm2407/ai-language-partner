/**
 * Unit tests for lib/handsfree-storage.ts.
 *
 * AsyncStorage is replaced with the same in-memory mock shape used by
 * lesson-session-storage.test.ts and pending-onboarding.test.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HANDSFREE_STORAGE_VERSION,
  HANDSFREE_CONFIG_SCHEMA_VERSION,
  hasAcknowledgedDrivingSafety,
  acknowledgeDrivingSafety,
  loadHandsFreeConfig,
  saveHandsFreeConfig,
} from './handsfree-storage';

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
const configKey = `handsfree:config:v${HANDSFREE_STORAGE_VERSION}:${USER}`;
const ackKey = `handsfree:ack:v${HANDSFREE_STORAGE_VERSION}:${USER}`;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('hands-free config', () => {
  it('round-trips a valid config', async () => {
    await saveHandsFreeConfig(USER, { targetDurationMs: 600_000 });
    expect(await loadHandsFreeConfig(USER)).toEqual({ targetDurationMs: 600_000 });
  });

  it('stamps the schema version onto what it writes', async () => {
    await saveHandsFreeConfig(USER, { targetDurationMs: 300_000 });
    const raw = await AsyncStorage.getItem(configKey);
    expect(JSON.parse(raw as string)).toEqual({
      version: HANDSFREE_CONFIG_SCHEMA_VERSION,
      targetDurationMs: 300_000,
    });
  });

  it('returns null when nothing is stored', async () => {
    expect(await loadHandsFreeConfig(USER)).toBeNull();
  });

  it('discards a blob from a different schema version instead of parsing it', async () => {
    await AsyncStorage.setItem(
      configKey,
      JSON.stringify({
        version: HANDSFREE_CONFIG_SCHEMA_VERSION + 1,
        targetDurationMs: 600_000,
      }),
    );

    expect(await loadHandsFreeConfig(USER)).toBeNull();
    // ...and clears it, so the dead blob is not re-read on every launch.
    expect(await AsyncStorage.getItem(configKey)).toBeNull();
  });

  it('discards a pre-envelope blob that has no version at all', async () => {
    // Exactly what shipped builds wrote before the envelope existed.
    await AsyncStorage.setItem(configKey, JSON.stringify({ targetDurationMs: 600_000 }));

    expect(await loadHandsFreeConfig(USER)).toBeNull();
    expect(await AsyncStorage.getItem(configKey)).toBeNull();
  });

  it('does not throw on corrupt JSON', async () => {
    await AsyncStorage.setItem(configKey, 'not-json{');
    await expect(loadHandsFreeConfig(USER)).resolves.toBeNull();
  });

  it('does not throw on a JSON primitive or null', async () => {
    await AsyncStorage.setItem(configKey, 'null');
    await expect(loadHandsFreeConfig(USER)).resolves.toBeNull();

    await AsyncStorage.setItem(configKey, '42');
    await expect(loadHandsFreeConfig(USER)).resolves.toBeNull();
  });

  it.each([
    ['a non-numeric duration', { version: HANDSFREE_CONFIG_SCHEMA_VERSION, targetDurationMs: '600000' }],
    ['a zero duration', { version: HANDSFREE_CONFIG_SCHEMA_VERSION, targetDurationMs: 0 }],
    ['a negative duration', { version: HANDSFREE_CONFIG_SCHEMA_VERSION, targetDurationMs: -1 }],
    ['a missing duration', { version: HANDSFREE_CONFIG_SCHEMA_VERSION }],
  ])('discards an in-version blob with %s', async (_label, blob) => {
    await AsyncStorage.setItem(configKey, JSON.stringify(blob));
    expect(await loadHandsFreeConfig(USER)).toBeNull();
    expect(await AsyncStorage.getItem(configKey)).toBeNull();
  });

  it('keeps configs for different users apart', async () => {
    await saveHandsFreeConfig(USER, { targetDurationMs: 600_000 });
    await saveHandsFreeConfig('other-user', { targetDurationMs: 120_000 });

    expect(await loadHandsFreeConfig(USER)).toEqual({ targetDurationMs: 600_000 });
    expect(await loadHandsFreeConfig('other-user')).toEqual({ targetDurationMs: 120_000 });
  });

  it('swallows a storage failure rather than breaking the setup screen', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(loadHandsFreeConfig(USER)).resolves.toBeNull();

    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(saveHandsFreeConfig(USER, { targetDurationMs: 600_000 })).resolves.toBeUndefined();
  });
});

describe('driving-safety acknowledgement', () => {
  it('round-trips, and is not disturbed by discarding a foreign config', async () => {
    await acknowledgeDrivingSafety(USER);
    expect(await hasAcknowledgedDrivingSafety(USER)).toBe(true);

    await AsyncStorage.setItem(configKey, JSON.stringify({ targetDurationMs: 600_000 }));
    await loadHandsFreeConfig(USER);

    // The whole reason config versioning lives in the blob and not in the key:
    // retiring a config shape must never re-show a safety notice.
    expect(await hasAcknowledgedDrivingSafety(USER)).toBe(true);
    expect(await AsyncStorage.getItem(ackKey)).not.toBeNull();
  });

  it('is false before acknowledgement and scoped per user', async () => {
    expect(await hasAcknowledgedDrivingSafety(USER)).toBe(false);
    await acknowledgeDrivingSafety(USER);
    expect(await hasAcknowledgedDrivingSafety('other-user')).toBe(false);
  });

  it('fails closed when storage throws, so the notice is shown again', async () => {
    await acknowledgeDrivingSafety(USER);
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    expect(await hasAcknowledgedDrivingSafety(USER)).toBe(false);
  });
});
