import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useLanguageEnrollments, type UseLanguageEnrollments } from './useLanguageEnrollments';
import { languageAccessRefusal, type LanguageAccess } from '../lib/language-access';

/**
 * The hook side of the paid multi-language gate (migration 147).
 *
 * Asserted: the allowance is read alongside the list and is null (unknown,
 * never "unlimited") when that read fails; `addLanguage` forwards the free
 * tier's `lockCurrent` to the server call; `keep` sends the chosen languages
 * and adopts the profile it gets back; and a refusal reaches the caller with
 * its FLL0x code intact, with the in-flight marker cleared.
 */
const mockFetchEnrollments = jest.fn();
const mockFetchAccess = jest.fn();
const mockFetchCourses = jest.fn();
const mockSwitch = jest.fn();
const mockKeep = jest.fn();

jest.mock('../lib/supabase-queries', () => ({
  fetchLanguageEnrollments: () => mockFetchEnrollments(),
  fetchLanguageAccess: () => mockFetchAccess(),
  fetchCourses: (language: string) => mockFetchCourses(language),
  switchTargetLanguage: (...a: unknown[]) => mockSwitch(...a),
  keepLanguages: (languages: string[]) => mockKeep(languages),
}));

jest.mock('../lib/course-placement', () => ({
  resolvePlacement: () => ({ currentCourseId: 'c-fr', placementBand: 'A1' }),
}));

jest.mock('../lib/analytics', () => ({ trackEvent: jest.fn() }));

// Stable identities: the hook's reload effect depends on `user`, so a fresh
// object per render would re-read forever.
const mockAuth = { user: { id: 'u1' } };
jest.mock('./useAuth', () => ({ useAuth: () => mockAuth }));

const mockNavRef = { isReady: () => false };
jest.mock('expo-router', () => ({
  useNavigationContainerRef: () => mockNavRef,
}));

const mockSetProfile = jest.fn();
const mockStore = {
  profile: { targetLanguage: 'es' },
  setProfile: mockSetProfile,
  setMeasuredBand: jest.fn(),
  refreshReviewCount: jest.fn(),
};
jest.mock('../stores/useAppStore', () => ({
  useAppStore: (select: (s: typeof mockStore) => unknown) => select(mockStore),
}));

const FREE: LanguageAccess = { maxLanguages: 1, open: ['es'], locked: [], overLimit: false };

let hook: UseLanguageEnrollments;
function Probe() {
  hook = useLanguageEnrollments();
  return null;
}

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

async function mount() {
  await act(async () => {
    TestRenderer.create(<Probe />);
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchEnrollments.mockResolvedValue([]);
  mockFetchAccess.mockResolvedValue(FREE);
  mockFetchCourses.mockResolvedValue([]);
  mockSwitch.mockResolvedValue({ targetLanguage: 'fr' });
  mockKeep.mockResolvedValue({ targetLanguage: 'fr' });
});

describe('useLanguageEnrollments: language access', () => {
  it('reads the allowance alongside the list', async () => {
    await mount();
    expect(mockFetchAccess).toHaveBeenCalled();
    expect(hook.access).toEqual(FREE);
    expect(hook.error).toBeNull();
  });

  it('leaves access null — unknown, not unlimited — when the allowance read fails, and keeps the list', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetchEnrollments.mockResolvedValue([{ language: 'es' }, { language: 'fr' }]);
    mockFetchAccess.mockRejectedValue(new Error('offline'));
    await mount();
    expect(hook.access).toBeNull();
    // Switching between languages already studied is not gated on the
    // allowance, so its failure must not take the list away.
    expect(hook.enrollments).toHaveLength(2);
    expect(hook.error).toBeNull();
    warn.mockRestore();
  });

  it('reports an error and clears access when the LIST read fails', async () => {
    mockFetchEnrollments.mockRejectedValue(new Error('offline'));
    await mount();
    expect(hook.error).not.toBeNull();
    expect(hook.access).toBeNull();
  });

  it('addLanguage forwards lockCurrent to the server switch', async () => {
    await mount();
    await act(async () => {
      await hook.addLanguage('fr', 'beginner', { lockCurrent: true });
    });
    expect(mockSwitch).toHaveBeenCalledWith(
      'fr',
      { level: 'beginner', currentCourseId: 'c-fr', placementBand: 'A1' },
      { lockCurrent: true },
    );
    expect(mockSetProfile).toHaveBeenCalledWith({ targetLanguage: 'fr' });
  });

  it('addLanguage without options does not ask to lock', async () => {
    await mount();
    await act(async () => {
      await hook.addLanguage('fr', 'beginner');
    });
    const options = mockSwitch.mock.calls[0][2] as { lockCurrent?: boolean } | undefined;
    expect(options?.lockCurrent ?? false).toBe(false);
  });

  it('a refusal reaches the caller with its code intact and clears switching', async () => {
    const refusal = { code: 'FLL01', message: 'language_limit: plan allows 1 open language(s)' };
    mockSwitch.mockRejectedValue(refusal);
    await mount();
    let thrown: unknown;
    await act(async () => {
      thrown = await hook.addLanguage('fr', 'beginner').catch((e: unknown) => e);
    });
    expect(thrown).toBe(refusal);
    expect(languageAccessRefusal(thrown)).toBe('limit');
    expect(hook.switching).toBeNull();
    expect(mockSetProfile).not.toHaveBeenCalled();
  });

  it('switchTo rethrows a locked refusal', async () => {
    mockSwitch.mockRejectedValue({ code: 'FLL02', message: 'x' });
    await mount();
    let thrown: unknown;
    await act(async () => {
      thrown = await hook.switchTo('de').catch((e: unknown) => e);
    });
    expect(languageAccessRefusal(thrown)).toBe('locked');
  });

  it('keep sends the chosen languages and adopts the returned profile', async () => {
    await mount();
    await act(async () => {
      await hook.keep(['fr']);
    });
    expect(mockKeep).toHaveBeenCalledWith(['fr']);
    expect(mockSetProfile).toHaveBeenCalledWith({ targetLanguage: 'fr' });
  });

  it('keep with nothing chosen makes no call', async () => {
    await mount();
    await act(async () => {
      await hook.keep([]);
    });
    expect(mockKeep).not.toHaveBeenCalled();
  });
});
