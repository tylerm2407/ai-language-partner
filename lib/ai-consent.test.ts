/**
 * Unit tests for lib/ai-consent.ts.
 *
 * AsyncStorage is replaced with an in-memory mock (same pattern as
 * lib/motion-preference.test.ts).
 *
 * The behaviours worth locking down are the ones with a compliance consequence:
 * consent must be per-user, per-kind, and per-version, and every failure path
 * must fail CLOSED — a storage error has to re-ask rather than silently let
 * learner content through to a third party.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AI_CONSENT_COPY,
  AI_CONSENT_VERSION,
  aiConsentGrantedAt,
  grantAiConsent,
  hasAiConsent,
  revokeAiConsent,
  revokeAllAiConsent,
} from './ai-consent';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      store[k] = v;
      return Promise.resolve();
    }),
    removeItem: jest.fn((k: string) => {
      delete store[k];
      return Promise.resolve();
    }),
    multiRemove: jest.fn((keys: string[]) => {
      keys.forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
    __reset: () => {
      store = {};
    },
    __seed: (k: string, v: string) => {
      store[k] = v;
    },
  };
});

const storage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  multiRemove: jest.Mock;
  __reset: () => void;
  __seed: (k: string, v: string) => void;
};

const USER = 'user-a';
const OTHER = 'user-b';

beforeEach(() => {
  storage.__reset();
  jest.clearAllMocks();
});

describe('ai consent', () => {
  it('has no consent before anything is granted', async () => {
    expect(await hasAiConsent('text', USER)).toBe(false);
    expect(await hasAiConsent('voice', USER)).toBe(false);
  });

  it('records consent and reads it back', async () => {
    await grantAiConsent('text', USER);
    expect(await hasAiConsent('text', USER)).toBe(true);
  });

  it('keeps text and voice consent independent', async () => {
    // Declining voice must never disable text chat — Apple 5.1.1(ii) forbids
    // making functionality depend on granting access to data.
    await grantAiConsent('text', USER);
    expect(await hasAiConsent('text', USER)).toBe(true);
    expect(await hasAiConsent('voice', USER)).toBe(false);
  });

  it('scopes consent to the user, not the device', async () => {
    await grantAiConsent('voice', USER);
    expect(await hasAiConsent('voice', OTHER)).toBe(false);
  });

  it('stores a timestamp, which is the audit value', async () => {
    await grantAiConsent('text', USER);
    const at = await aiConsentGrantedAt('text', USER);
    expect(at).not.toBeNull();
    expect(Number.isNaN(Date.parse(at as string))).toBe(false);
  });

  it('revokes a single kind without touching the other', async () => {
    await grantAiConsent('text', USER);
    await grantAiConsent('voice', USER);

    await revokeAiConsent('voice', USER);

    expect(await hasAiConsent('voice', USER)).toBe(false);
    expect(await hasAiConsent('text', USER)).toBe(true);
  });

  it('revokes both kinds together', async () => {
    await grantAiConsent('text', USER);
    await grantAiConsent('voice', USER);

    await revokeAllAiConsent(USER);

    expect(await hasAiConsent('text', USER)).toBe(false);
    expect(await hasAiConsent('voice', USER)).toBe(false);
  });

  it('ignores consent recorded against any other version', async () => {
    // A processor-list change bumps the version. Consent to the old list is
    // not consent to the new one (GDPR Art. 28(2)), so the learner is re-asked.
    storage.__seed(`ai-consent:text:v${AI_CONSENT_VERSION + 1}:${USER}`, new Date().toISOString());
    storage.__seed(`ai-consent:text:v0:${USER}`, new Date().toISOString());
    expect(await hasAiConsent('text', USER)).toBe(false);
  });

  it('revoke clears the current version and every superseded one', async () => {
    await grantAiConsent('text', USER);
    await revokeAiConsent('text', USER);

    const removed = storage.multiRemove.mock.calls[0][0] as string[];
    expect(removed).toContain(`ai-consent:text:v${AI_CONSENT_VERSION}:${USER}`);
    // One key per version that has ever existed — current plus all priors.
    // Holds at v1 (no priors) and stays true after any bump, so a bug in the
    // stale-key sweep surfaces here rather than as a resurrected consent.
    expect(removed).toHaveLength(AI_CONSENT_VERSION);
    expect(new Set(removed).size).toBe(removed.length);
  });

  it('fails CLOSED when storage read throws', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('disk on fire'));
    // Re-asking is a minor annoyance; sending audio to a third party because
    // AsyncStorage hiccuped is not.
    expect(await hasAiConsent('voice', USER)).toBe(false);
  });

  it('reports no timestamp when storage read throws', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('disk on fire'));
    expect(await aiConsentGrantedAt('text', USER)).toBeNull();
  });
});

describe('consent copy', () => {
  it('names the actual providers, because vague disclosure fails review', () => {
    expect(AI_CONSENT_COPY.text.points.join(' ')).toContain('Anthropic');
    expect(AI_CONSENT_COPY.voice.points.join(' ')).toContain('OpenAI');
  });

  it('does not claim a provider that receives nothing', () => {
    // voice-session-token is a dead stub; no data reaches Google. Listing it
    // would be a false disclosure in the opposite direction.
    const all = JSON.stringify(AI_CONSENT_COPY);
    expect(all).not.toContain('Google');
    expect(all).not.toContain('Gemini');
  });

  it('keeps the voiceprint disclaimer, which the legal position depends on', () => {
    // GDPR Art. 9, CCPA sensitive-PI and Illinois BIPA all turn on the PURPOSE
    // of processing. If speaker verification is ever built, this sentence stops
    // being true and this test should fail loudly rather than be deleted.
    expect(AI_CONSENT_COPY.voice.points.join(' ')).toContain('do not create voiceprints');
  });

  it('offers a real decline path on both kinds', () => {
    expect(AI_CONSENT_COPY.text.declineLabel).toBeTruthy();
    expect(AI_CONSENT_COPY.voice.declineLabel).toBeTruthy();
    expect(AI_CONSENT_COPY.text.declinedNote).toBeTruthy();
    expect(AI_CONSENT_COPY.voice.declinedNote).toBeTruthy();
  });
});
