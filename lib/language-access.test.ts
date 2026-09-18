/**
 * The client half of the paid multi-language gate (migration 147).
 *
 * The server decides; these functions only read its answers. What has to hold
 * is that every reading FAILS CLOSED — a malformed allowance is one language,
 * never unlimited — and that a refusal is recognised by its SQLSTATE alone, so
 * rewording a server message can never change what the learner is shown.
 */
import {
  UNLIMITED_LANGUAGES,
  canOpenAnother,
  isUnlimitedLanguages,
  languageAccessRefusal,
  parseLanguageAccess,
  type LanguageAccess,
} from './language-access';

describe('parseLanguageAccess', () => {
  it('reads a well-formed get_language_access() answer', () => {
    expect(
      parseLanguageAccess({ maxLanguages: 9999, open: ['es', 'fr'], locked: ['de'], overLimit: false }),
    ).toEqual({ maxLanguages: 9999, open: ['es', 'fr'], locked: ['de'], overLimit: false });
  });

  it.each([
    ['missing', {}],
    ['a string', { maxLanguages: '9999' }],
    ['zero', { maxLanguages: 0 }],
    ['negative', { maxLanguages: -3 }],
    ['NaN', { maxLanguages: NaN }],
    ['Infinity', { maxLanguages: Infinity }],
    ['null', { maxLanguages: null }],
    ['a boolean', { maxLanguages: true }],
  ])('fails closed to one language when maxLanguages is %s', (_label, raw) => {
    expect(parseLanguageAccess(raw).maxLanguages).toBe(1);
  });

  it('floors a fractional allowance rather than rounding it up', () => {
    expect(parseLanguageAccess({ maxLanguages: 2.9 }).maxLanguages).toBe(2);
    expect(parseLanguageAccess({ maxLanguages: 1.5 }).maxLanguages).toBe(1);
  });

  it.each([null, undefined, 'x', 42, true, []])('treats a non-object answer (%p) as an empty free account', (raw) => {
    expect(parseLanguageAccess(raw)).toEqual({ maxLanguages: 1, open: [], locked: [], overLimit: false });
  });

  it('drops non-string entries from open and locked', () => {
    const access = parseLanguageAccess({
      maxLanguages: 9999,
      open: ['es', 3, null, { code: 'fr' }, 'fr'],
      locked: [undefined, 'de', ['it']],
    });
    expect(access.open).toEqual(['es', 'fr']);
    expect(access.locked).toEqual(['de']);
  });

  it('reads non-array lists as empty', () => {
    const access = parseLanguageAccess({ maxLanguages: 1, open: 'es', locked: { de: true } });
    expect(access.open).toEqual([]);
    expect(access.locked).toEqual([]);
  });

  it('recomputes overLimit from the lists instead of trusting the flag', () => {
    // A lapsed plan: three open, one allowed — the server's flag is ignored
    // in both directions so the two can never disagree.
    expect(parseLanguageAccess({ maxLanguages: 1, open: ['es', 'fr', 'de'], overLimit: false }).overLimit).toBe(true);
    expect(parseLanguageAccess({ maxLanguages: 1, open: ['es'], overLimit: true }).overLimit).toBe(false);
    expect(parseLanguageAccess({ maxLanguages: 2, open: ['es', 'fr'] }).overLimit).toBe(false);
  });

  it('a malformed allowance with several open languages reads as over the limit, not unlimited', () => {
    expect(parseLanguageAccess({ maxLanguages: 'lots', open: ['es', 'fr'] }).overLimit).toBe(true);
  });
});

describe('languageAccessRefusal', () => {
  it.each([
    ['FLL01', 'limit'],
    ['FLL02', 'locked'],
    ['FLL03', 'resolve'],
  ])('maps %s to %s', (code, refusal) => {
    expect(languageAccessRefusal({ code, message: 'anything' })).toBe(refusal);
  });

  it.each(['42501', '22023', 'P0002', 'PGRST116', 'FLL04', 'fll01', ''])(
    'returns null for the unrelated code %p',
    (code) => {
      expect(languageAccessRefusal({ code, message: 'language_limit: plan allows 1' })).toBeNull();
    },
  );

  it.each([null, undefined, 'FLL01', 42, true])('returns null for the non-object %p', (err) => {
    expect(languageAccessRefusal(err)).toBeNull();
  });

  it('returns null when the code is missing or not a string', () => {
    expect(languageAccessRefusal({ message: 'language_locked: fr is locked' })).toBeNull();
    expect(languageAccessRefusal({ code: 1 })).toBeNull();
    expect(languageAccessRefusal({ code: null })).toBeNull();
  });

  it('never reads the message: the code alone decides', () => {
    // A server message that names another refusal, or none, changes nothing.
    expect(languageAccessRefusal({ code: 'FLL01', message: 'language_locked: fr is locked' })).toBe('limit');
    expect(languageAccessRefusal({ code: 'FLL02', message: '' })).toBe('locked');
    const err = Object.assign(new Error('network down'), { code: 'FLL03' });
    expect(languageAccessRefusal(err)).toBe('resolve');
    // A getter on `message` would throw if it were ever touched.
    const trap = {
      code: 'FLL01',
      get message(): string {
        throw new Error('message must not be read');
      },
    };
    expect(languageAccessRefusal(trap)).toBe('limit');
  });
});

describe('canOpenAnother', () => {
  const access = (maxLanguages: number, open: LanguageAccess['open']): LanguageAccess => ({
    maxLanguages,
    open,
    locked: [],
    overLimit: open.length > maxLanguages,
  });

  it('is true while the plan has room', () => {
    expect(canOpenAnother(access(1, []))).toBe(true);
    expect(canOpenAnother(access(3, ['es', 'fr']))).toBe(true);
    expect(canOpenAnother(access(UNLIMITED_LANGUAGES, ['es', 'fr', 'de']))).toBe(true);
  });

  it('is false at the limit — the free learner who already studies one', () => {
    expect(canOpenAnother(access(1, ['es']))).toBe(false);
    expect(canOpenAnother(access(2, ['es', 'fr']))).toBe(false);
  });

  it('is false over the limit (a lapsed plan)', () => {
    expect(canOpenAnother(access(1, ['es', 'fr']))).toBe(false);
  });
});

describe('isUnlimitedLanguages', () => {
  const withMax = (maxLanguages: number): LanguageAccess => ({ maxLanguages, open: [], locked: [], overLimit: false });

  it('uses the same 9999 sentinel as the plan matrix', () => {
    expect(UNLIMITED_LANGUAGES).toBe(9999);
  });

  it('is true at or above the sentinel and false below it', () => {
    expect(isUnlimitedLanguages(withMax(9999))).toBe(true);
    expect(isUnlimitedLanguages(withMax(10000))).toBe(true);
    expect(isUnlimitedLanguages(withMax(9998))).toBe(false);
    expect(isUnlimitedLanguages(withMax(1))).toBe(false);
  });

  it('a parsed malformed answer is never unlimited', () => {
    expect(isUnlimitedLanguages(parseLanguageAccess({ maxLanguages: 'unlimited' }))).toBe(false);
  });
});
