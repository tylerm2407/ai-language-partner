/**
 * Unit tests for the on-device TTS cache and the phrase bank.
 *
 * expo-file-system is mocked with an in-memory filesystem. The behaviours that
 * matter are the ones that would be invisible on a device until they bit: a
 * hash collision must never serve the wrong sentence, and a missing sidecar
 * must be a miss rather than unverifiable audio.
 */

import {
  TTS_CACHE_MAX_BYTES,
  TTS_CACHE_TTL_MS,
  clearTtsCache,
  getCachedTts,
  pruneTtsCache,
  putCachedTts,
  ttsCacheKey,
} from './tts-cache';
import {
  announcePhrase,
  constantPhrases,
  feedbackPhrase,
  summaryPhrase,
} from './handsfree-phrases';

// ── In-memory filesystem ────────────────────────────────────────────────
const mockFiles = new Map<string, string>();
const mockDirs = new Set<string>();

jest.mock('expo-file-system', () => {
  const join = (...parts: unknown[]): string =>
    parts
      .map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri))
      .join('/')
      .replace(/\/+/g, '/');

  class MockFile {
    uri: string;
    constructor(...uris: unknown[]) {
      this.uri = join(...uris);
    }
    get name(): string {
      return this.uri.slice(this.uri.lastIndexOf('/') + 1);
    }
    get exists(): boolean {
      return mockFiles.has(this.uri);
    }
    create(): void {
      if (!mockFiles.has(this.uri)) mockFiles.set(this.uri, '');
    }
    write(content: string): void {
      mockFiles.set(this.uri, content);
    }
    textSync(): string {
      const v = mockFiles.get(this.uri);
      if (v === undefined) throw new Error('ENOENT');
      return v;
    }
    delete(): void {
      mockFiles.delete(this.uri);
    }
  }

  class MockDirectory {
    uri: string;
    constructor(...uris: unknown[]) {
      this.uri = join(...uris);
    }
    get exists(): boolean {
      return mockDirs.has(this.uri);
    }
    create(): void {
      mockDirs.add(this.uri);
    }
    delete(): void {
      mockDirs.delete(this.uri);
      for (const key of [...mockFiles.keys()]) {
        if (key.startsWith(this.uri)) mockFiles.delete(key);
      }
    }
    list(): MockFile[] {
      return [...mockFiles.keys()]
        .filter((k) => k.startsWith(`${this.uri}/`))
        .map((k) => new MockFile(k));
    }
  }

  return {
    __esModule: true,
    File: MockFile,
    Directory: MockDirectory,
    Paths: { cache: { uri: '/cache' } },
  };
});

// `instanceof File` inside pruneTtsCache must see the mock class.
const { File: MockFileClass } = jest.requireMock('expo-file-system') as { File: unknown };
void MockFileClass;

const NOW = 1_700_000_000_000;

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
});

describe('ttsCacheKey', () => {
  it('is stable for identical inputs', () => {
    expect(ttsCacheKey('hola', 'es', 'v1', 1)).toBe(ttsCacheKey('hola', 'es', 'v1', 1));
  });

  it('distinguishes voice, language, rate and text', () => {
    const base = ttsCacheKey('hola', 'es', 'v1', 1);
    expect(ttsCacheKey('hola', 'es', 'v2', 1)).not.toBe(base);
    expect(ttsCacheKey('hola', 'fr', 'v1', 1)).not.toBe(base);
    expect(ttsCacheKey('hola', 'es', 'v1', 0.8)).not.toBe(base);
    expect(ttsCacheKey('adios', 'es', 'v1', 1)).not.toBe(base);
  });

  it('ignores surrounding whitespace so the same sentence is one entry', () => {
    expect(ttsCacheKey('  hola  ', 'es', 'v1', 1)).toBe(ttsCacheKey('hola', 'es', 'v1', 1));
  });
});

describe('round trip', () => {
  it('stores and returns a playable uri', () => {
    const key = ttsCacheKey('hola', 'es', 'v1', 1);
    const uri = putCachedTts(key, 'BASE64DATA', NOW);
    expect(uri).toMatch(/\.mp3$/);
    expect(getCachedTts(key, NOW)).toBe(uri);
  });

  it('misses for a key that was never stored', () => {
    expect(getCachedTts(ttsCacheKey('nope', 'es', 'v1', 1), NOW)).toBeNull();
  });

  it('keeps distinct keys separate', () => {
    const a = ttsCacheKey('hola', 'es', 'v1', 1);
    const b = ttsCacheKey('adios', 'es', 'v1', 1);
    putCachedTts(a, 'AAA', NOW);
    putCachedTts(b, 'BBB', NOW);
    expect(getCachedTts(a, NOW)).not.toBe(getCachedTts(b, NOW));
  });
});

describe('expiry', () => {
  it('misses once past the TTL', () => {
    const key = ttsCacheKey('hola', 'es', 'v1', 1);
    putCachedTts(key, 'AAA', NOW);
    expect(getCachedTts(key, NOW + TTS_CACHE_TTL_MS + 1)).toBeNull();
  });

  it('hits just inside the TTL', () => {
    const key = ttsCacheKey('hola', 'es', 'v1', 1);
    putCachedTts(key, 'AAA', NOW);
    expect(getCachedTts(key, NOW + TTS_CACHE_TTL_MS - 1)).not.toBeNull();
  });

  it('removes the expired entry rather than leaving it to rot', () => {
    const key = ttsCacheKey('hola', 'es', 'v1', 1);
    putCachedTts(key, 'AAA', NOW);
    getCachedTts(key, NOW + TTS_CACHE_TTL_MS + 1);
    expect(mockFiles.size).toBe(0);
  });
});

describe('integrity', () => {
  it('treats a missing sidecar as a miss', () => {
    // Audio we cannot verify the key or age of is not safe to play: it might
    // be a different sentence entirely.
    const key = ttsCacheKey('hola', 'es', 'v1', 1);
    putCachedTts(key, 'AAA', NOW);
    for (const k of [...mockFiles.keys()]) if (k.endsWith('.json')) mockFiles.delete(k);
    expect(getCachedTts(key, NOW)).toBeNull();
  });

  it('treats a corrupt sidecar as a miss', () => {
    const key = ttsCacheKey('hola', 'es', 'v1', 1);
    putCachedTts(key, 'AAA', NOW);
    for (const k of [...mockFiles.keys()]) if (k.endsWith('.json')) mockFiles.set(k, 'not json{');
    expect(getCachedTts(key, NOW)).toBeNull();
  });

  it('never serves audio belonging to a different key', () => {
    // Simulates a hash collision by rewriting the sidecar's recorded key.
    const key = ttsCacheKey('hola', 'es', 'v1', 1);
    putCachedTts(key, 'AAA', NOW);
    for (const k of [...mockFiles.keys()]) {
      if (k.endsWith('.json')) {
        mockFiles.set(k, JSON.stringify({ at: NOW, bytes: 3, key: 'a-completely-different-key' }));
      }
    }
    expect(getCachedTts(key, NOW)).toBeNull();
  });

  it('does not evict on a collision, so two keys cannot thrash each other', () => {
    const key = ttsCacheKey('hola', 'es', 'v1', 1);
    putCachedTts(key, 'AAA', NOW);
    const before = mockFiles.size;
    for (const k of [...mockFiles.keys()]) {
      if (k.endsWith('.json')) {
        mockFiles.set(k, JSON.stringify({ at: NOW, bytes: 3, key: 'other' }));
      }
    }
    getCachedTts(key, NOW);
    expect(mockFiles.size).toBe(before);
  });
});

describe('pruning', () => {
  it('drops expired entries', () => {
    putCachedTts(ttsCacheKey('old', 'es', 'v1', 1), 'AAA', NOW);
    putCachedTts(ttsCacheKey('new', 'es', 'v1', 1), 'BBB', NOW + TTS_CACHE_TTL_MS);
    pruneTtsCache(NOW + TTS_CACHE_TTL_MS + 1);
    expect(getCachedTts(ttsCacheKey('old', 'es', 'v1', 1), NOW + TTS_CACHE_TTL_MS + 1)).toBeNull();
    expect(
      getCachedTts(ttsCacheKey('new', 'es', 'v1', 1), NOW + TTS_CACHE_TTL_MS + 1),
    ).not.toBeNull();
  });

  it('reclaims orphaned audio with no sidecar', () => {
    putCachedTts(ttsCacheKey('hola', 'es', 'v1', 1), 'AAA', NOW);
    for (const k of [...mockFiles.keys()]) if (k.endsWith('.json')) mockFiles.delete(k);
    pruneTtsCache(NOW);
    expect(mockFiles.size).toBe(0);
  });

  it('evicts oldest first when over the size ceiling', () => {
    const big = 'x'.repeat(Math.ceil(TTS_CACHE_MAX_BYTES / 2) + 1);
    putCachedTts(ttsCacheKey('oldest', 'es', 'v1', 1), big, NOW);
    putCachedTts(ttsCacheKey('newest', 'es', 'v1', 1), big, NOW + 10_000);
    pruneTtsCache(NOW + 20_000);
    expect(getCachedTts(ttsCacheKey('oldest', 'es', 'v1', 1), NOW + 20_000)).toBeNull();
    expect(getCachedTts(ttsCacheKey('newest', 'es', 'v1', 1), NOW + 20_000)).not.toBeNull();
  });

  it('leaves a cache under the ceiling alone', () => {
    putCachedTts(ttsCacheKey('a', 'es', 'v1', 1), 'AAA', NOW);
    putCachedTts(ttsCacheKey('b', 'es', 'v1', 1), 'BBB', NOW);
    pruneTtsCache(NOW);
    expect(getCachedTts(ttsCacheKey('a', 'es', 'v1', 1), NOW)).not.toBeNull();
    expect(getCachedTts(ttsCacheKey('b', 'es', 'v1', 1), NOW)).not.toBeNull();
  });

  it('is a no-op on an empty cache', () => {
    expect(() => pruneTtsCache(NOW)).not.toThrow();
  });
});

describe('clearTtsCache', () => {
  it('removes everything', () => {
    putCachedTts(ttsCacheKey('a', 'es', 'v1', 1), 'AAA', NOW);
    clearTtsCache();
    expect(getCachedTts(ttsCacheKey('a', 'es', 'v1', 1), NOW)).toBeNull();
  });
});

describe('phrase bank', () => {
  it('keeps the common lines constant so they stay cache hits', () => {
    // Every distinct string is a separate billed generation, so these must not
    // vary by card, by score, or by anything else.
    expect(feedbackPhrase('correct', 'en')).toBe(feedbackPhrase('correct', 'en'));
    expect(feedbackPhrase('correct', 'en', 'la manzana')).toBe(feedbackPhrase('correct', 'en'));
    expect(feedbackPhrase('not_caught', 'en', 'anything')).toBe(feedbackPhrase('not_caught', 'en'));
  });

  it('speaks the expected answer only on the incorrect line', () => {
    expect(feedbackPhrase('incorrect', 'en', 'la manzana')).toContain('la manzana');
  });

  it('does not emit a dangling sentence when the answer is missing', () => {
    const line = feedbackPhrase('incorrect', 'en');
    expect(line).not.toMatch(/is\.?$/);
    expect(line.length).toBeGreaterThan(0);
  });

  it('falls back to English for an unsupported language', () => {
    expect(feedbackPhrase('correct', 'ja')).toBe(feedbackPhrase('correct', 'en'));
    expect(announcePhrase(1, 10, 'ja')).toBe(announcePhrase(1, 10, 'en'));
  });

  it('omits the total for an unbounded session', () => {
    expect(announcePhrase(3, null, 'en')).not.toContain('of');
    expect(announcePhrase(3, 20, 'en')).toContain('20');
  });

  it('summarises an empty session without claiming a score', () => {
    expect(summaryPhrase(0, 0, 'en')).toContain('Nothing reviewed');
    expect(summaryPhrase(10, 7, 'en')).toContain('7 of 10');
  });

  it('exposes the always-cacheable lines for pre-warming', () => {
    const constants = constantPhrases('en');
    expect(constants.length).toBeGreaterThan(0);
    // None of them may interpolate anything, or pre-warming is pointless.
    for (const phrase of constants) expect(phrase).not.toMatch(/\{|\$/);
  });
});
