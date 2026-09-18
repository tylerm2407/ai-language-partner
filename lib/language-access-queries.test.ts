/**
 * The three RPC wrappers behind the multi-language gate (migration 147):
 * `switchTargetLanguage`, `keepLanguages` and `fetchLanguageAccess`.
 *
 * What has to hold:
 *  - `p_lock_current` is always sent, false unless the caller asks. Omitting
 *    it would still work today (the SQL defaults it), but sending it pins the
 *    named-argument call to the one five-argument signature.
 *  - a refusal is RETHROWN with its SQLSTATE intact, because the switcher
 *    tells "locked" from "over the limit" by `code` alone
 *    (lib/language-access.ts `languageAccessRefusal`).
 */
import { fetchLanguageAccess, keepLanguages, switchTargetLanguage } from './supabase-queries';
import { languageAccessRefusal } from './language-access';

const mockRpc = jest.fn();

jest.mock('./supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
  },
}));

const PROFILE_ROW = {
  user_id: 'u1',
  display_name: 'Ana',
  target_language: 'fr',
  native_language: 'en',
  level: 'beginner',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

/** The shape supabase-js hands back for a PostgREST error. */
const pgError = (code: string, message: string) => ({ code, message, details: null, hint: null });

beforeEach(() => {
  mockRpc.mockReset();
});

describe('switchTargetLanguage', () => {
  it('sends p_lock_current: false by default', async () => {
    mockRpc.mockResolvedValue({ data: PROFILE_ROW, error: null });
    await switchTargetLanguage('fr');
    expect(mockRpc).toHaveBeenCalledWith('switch_target_language', {
      p_language: 'fr',
      p_level: null,
      p_current_course_id: null,
      p_placement_band: null,
      p_lock_current: false,
    });
  });

  it('sends p_lock_current: true for the free tier’s "switch instead"', async () => {
    mockRpc.mockResolvedValue({ data: PROFILE_ROW, error: null });
    const profile = await switchTargetLanguage(
      'fr',
      { level: 'beginner', currentCourseId: 'c-fr', placementBand: 'A1' },
      { lockCurrent: true },
    );
    expect(mockRpc).toHaveBeenCalledWith('switch_target_language', {
      p_language: 'fr',
      p_level: 'beginner',
      p_current_course_id: 'c-fr',
      p_placement_band: 'A1',
      p_lock_current: true,
    });
    expect(profile.targetLanguage).toBe('fr');
  });

  it('sends false when options are passed without lockCurrent', async () => {
    mockRpc.mockResolvedValue({ data: PROFILE_ROW, error: null });
    await switchTargetLanguage('fr', undefined, {});
    expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_lock_current: false });
  });

  it.each([
    ['FLL01', 'limit'],
    ['FLL02', 'locked'],
    ['FLL03', 'resolve'],
  ] as const)('rethrows a %s refusal with its code intact', async (code, refusal) => {
    const err = pgError(code, 'refused');
    mockRpc.mockResolvedValue({ data: null, error: err });
    const thrown = await switchTargetLanguage('fr').catch((e: unknown) => e);
    expect(thrown).toBe(err);
    expect(languageAccessRefusal(thrown)).toBe(refusal);
  });

  it('throws when the RPC returns no row', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(switchTargetLanguage('fr')).rejects.toThrow('switch_target_language returned no row');
  });
});

describe('keepLanguages', () => {
  it('sends the kept languages as p_languages, in order', async () => {
    mockRpc.mockResolvedValue({ data: PROFILE_ROW, error: null });
    const profile = await keepLanguages(['fr', 'es']);
    expect(mockRpc).toHaveBeenCalledWith('keep_languages', { p_languages: ['fr', 'es'] });
    expect(profile.targetLanguage).toBe('fr');
  });

  it.each(['FLL01', 'FLL02'])('rethrows a %s refusal with its code intact', async (code) => {
    const err = pgError(code, 'refused');
    mockRpc.mockResolvedValue({ data: null, error: err });
    const thrown = await keepLanguages(['de']).catch((e: unknown) => e);
    expect(thrown).toBe(err);
    expect((thrown as { code: string }).code).toBe(code);
  });

  it('throws when the RPC returns no row', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(keepLanguages(['fr'])).rejects.toThrow('keep_languages returned no row');
  });
});

describe('fetchLanguageAccess', () => {
  it('calls get_language_access and parses the answer', async () => {
    mockRpc.mockResolvedValue({
      data: { maxLanguages: 1, open: ['es', 'fr'], locked: ['de'], overLimit: false },
      error: null,
    });
    const access = await fetchLanguageAccess();
    expect(mockRpc).toHaveBeenCalledWith('get_language_access');
    // overLimit recomputed from the lists, not taken from the server flag.
    expect(access).toEqual({ maxLanguages: 1, open: ['es', 'fr'], locked: ['de'], overLimit: true });
  });

  it('rethrows an error rather than reporting an empty allowance', async () => {
    const err = pgError('42501', 'authentication required');
    mockRpc.mockResolvedValue({ data: null, error: err });
    await expect(fetchLanguageAccess()).rejects.toBe(err);
  });
});
