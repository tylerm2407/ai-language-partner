// AsyncStorage is reached transitively (read-cache -> word-lookup) but nothing
// here touches it: the chain takes its cache getters as injected dependencies,
// which is the whole reason it lives in a pure module.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

import {
  annotationMap,
  cardSourceFromLookup,
  isQuotaError,
  lookupWord,
  wordCacheKey,
  type WordLookupDeps,
} from './word-lookup';
import type { BookAnnotation, WordLookup } from '../types';

/** A server rejection as the client sees it — matches lib/ai.ts TranslateError
 *  without importing it, which would drag in the Supabase client. */
function serverError(message: string, code: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function annotation(word: string): BookAnnotation {
  return {
    id: `id-${word}`,
    bookId: 'book-1',
    wordOrPhrase: word,
    translation: `${word}-EN`,
    partOfSpeech: 'noun',
    audioUrl: 'https://example.test/a.mp3',
  };
}

function deps(overrides: Partial<WordLookupDeps> = {}) {
  const calls = { translate: 0, getCached: 0, setCached: 0 };
  const store = new Map<string, WordLookup>();
  const base: WordLookupDeps = {
    session: new Map(),
    annotations: new Map(),
    getCached: async (key) => {
      calls.getCached++;
      return store.get(key) ?? null;
    },
    setCached: async (key, value) => {
      calls.setCached++;
      store.set(key, value);
    },
    translate: async (word) => {
      calls.translate++;
      return `${word}-live`;
    },
    ...overrides,
  };
  return { deps: base, calls, store };
}

const req = { raw: 'Maison,', sourceLanguage: 'fr', targetLanguage: 'en' };

describe('lookupWord tier order', () => {
  it('an annotation answers without touching cache or network', async () => {
    const { deps: d, calls } = deps({
      annotations: annotationMap([annotation('maison')]),
    });
    const result = await lookupWord(req, d);

    expect(result).toEqual({
      ok: true,
      lookup: {
        word: 'maison',
        translation: 'maison-EN',
        partOfSpeech: 'noun',
        audioUrl: 'https://example.test/a.mp3',
        source: 'annotation',
      },
    });
    expect(calls.getCached).toBe(0);
    expect(calls.translate).toBe(0);
  });

  it('the session map answers before anything else, even for a stored word', async () => {
    const { deps: d, calls } = deps();
    await lookupWord(req, d);
    const before = calls.translate;
    await lookupWord(req, d);
    expect(calls.translate).toBe(before);
  });

  it('a device-cache hit skips the network', async () => {
    const cached: WordLookup = {
      word: 'maison',
      translation: 'house',
      partOfSpeech: null,
      audioUrl: null,
      source: 'translated',
    };
    const { deps: d, calls } = deps({
      getCached: async () => cached,
    });
    const result = await lookupWord(req, d);
    expect(result).toEqual({ ok: true, lookup: cached });
    expect(calls.translate).toBe(0);
  });

  it('a miss everywhere translates, and writes to both caches', async () => {
    const { deps: d, calls, store } = deps();
    const result = await lookupWord(req, d);

    expect(result.ok).toBe(true);
    expect(calls.translate).toBe(1);
    expect(calls.setCached).toBe(1);
    expect(store.get(wordCacheKey('fr', 'en', 'maison'))?.translation).toBe('maison-live');
    expect(d.session.get('maison')?.source).toBe('translated');
  });

  it('the word is normalised before every tier, so punctuation shares one entry', async () => {
    const { deps: d, calls } = deps();
    await lookupWord({ ...req, raw: '«Maison»' }, d);
    await lookupWord({ ...req, raw: 'maison.' }, d);
    expect(calls.translate).toBe(1);
  });
});

describe('lookupWord failures', () => {
  it('a token that normalises to nothing is refused without a call', async () => {
    const { deps: d, calls } = deps();
    const result = await lookupWord({ ...req, raw: '—' }, d);
    expect(result).toEqual({ ok: false, reason: 'not_a_word' });
    expect(calls.translate).toBe(0);
  });

  it('a quota rejection is reported as quota, not as a generic failure', async () => {
    // The reader stops asking after this; a retry button here would be a lie.
    const { deps: d } = deps({
      translate: async () => {
        throw serverError('Translation failed: out', 'DAILY_WORD_LOOKUP_LIMIT_REACHED');
      },
    });
    const result = await lookupWord(req, d);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('quota');
  });

  it('any other error is retryable', async () => {
    const { deps: d } = deps({
      translate: async () => {
        throw serverError('Translation failed: network', 'TRANSLATION_UNAVAILABLE');
      },
    });
    const result = await lookupWord(req, d);
    expect(result.ok === false && result.reason).toBe('failed');
  });

  it('a failure is never cached — one bad minute must not be permanent', async () => {
    const { deps: d, calls } = deps({
      translate: async () => {
        throw new Error('boom');
      },
    });
    await lookupWord(req, d);
    expect(calls.setCached).toBe(0);
    expect(d.session.size).toBe(0);
  });

  it('an empty translation is a failure, not a cached blank', async () => {
    const { deps: d, calls } = deps({ translate: async () => '   ' });
    const result = await lookupWord(req, d);
    expect(result.ok === false && result.reason).toBe('failed');
    expect(calls.setCached).toBe(0);
  });
});

describe('wordCacheKey', () => {
  it('is scoped to the language pair and the word, and to nothing else', () => {
    // Deliberately not book- or user-scoped: a word learned in one book is
    // then free in every other, and there is nothing personal in it.
    expect(wordCacheKey('fr', 'en', 'maison')).toBe('read-cache:wordxl:fr:en:maison');
    expect(wordCacheKey('fr', 'en', 'maison')).not.toBe(wordCacheKey('es', 'en', 'maison'));
  });
});

describe('annotationMap', () => {
  it('keys on the normalised word', () => {
    const map = annotationMap([annotation('Maison,')]);
    expect(map.has('maison')).toBe(true);
  });

  it('drops multi-word phrases — a per-word tap cannot select one', () => {
    const map = annotationMap([annotation('tout de suite')]);
    expect(map.size).toBe(0);
  });

  it('drops entries that normalise to nothing', () => {
    expect(annotationMap([annotation('...')]).size).toBe(0);
  });
});

describe('isQuotaError', () => {
  it('recognises both daily-limit codes and nothing else', () => {
    expect(isQuotaError(serverError('x', 'DAILY_WORD_LOOKUP_LIMIT_REACHED'))).toBe(true);
    expect(isQuotaError(serverError('x', 'DAILY_TRANSLATION_LIMIT_REACHED'))).toBe(true);
    expect(isQuotaError(serverError('x', 'RATE_LIMITED'))).toBe(false);
    expect(isQuotaError(new Error('x'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});

describe('cardSourceFromLookup', () => {
  it('produces exactly what addCardFromAnnotation consumes', () => {
    // This adapter is what keeps a tapped word under the same daily new-card
    // cap as a pre-authored annotation always was.
    const lookup: WordLookup = {
      word: 'maison',
      translation: 'house',
      partOfSpeech: 'noun',
      audioUrl: null,
      source: 'translated',
    };
    expect(cardSourceFromLookup(lookup)).toEqual({
      wordOrPhrase: 'maison',
      translation: 'house',
      partOfSpeech: 'noun',
      audioUrl: null,
    });
  });
});
