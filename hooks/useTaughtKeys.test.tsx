import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { useTaughtKeys } from './useTaughtKeys';

/**
 * The hook decides how wide the grader's sibling-key refusal reaches, and every
 * one of its failure modes is silent by design: it returns `[]` while loading
 * and `[]` on error, because a lesson must not stop for a cache miss. Silent
 * degradation is the right behaviour and exactly why it needs a test — nothing
 * on a screen would ever show that the rule had narrowed.
 *
 * What is asserted: that a success widens the set, that the fill-blank welding
 * is applied (a stored fragment is not a string anyone can type on another
 * row), that a failure degrades rather than throws, that a missing language
 * fetches nothing, and that a language change does not let a slow first
 * response overwrite a faster second one.
 */
const mockFetch = jest.fn();
jest.mock('../lib/supabase-queries', () => ({
  fetchTaughtKeysForLanguage: (language: string) => mockFetch(language),
}));

// read-cache reaches AsyncStorage; the hook's contract is what it does with the
// resolved value, so the cache is a pass-through here.
jest.mock('../lib/read-cache', () => ({
  readCacheKey: (...parts: string[]) => `read-cache:${parts.join(':')}`,
  cachedFetch: async (_key: string, fetcher: () => Promise<unknown>) => ({
    data: await fetcher(),
    stale: false,
  }),
}));

function Probe({ language }: { language: string | undefined }) {
  const keys = useTaughtKeys(language as never);
  return <Text>{keys.join('|')}</Text>;
}

const rendered = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findByType(Text).props.children as string;

/** Lets the hook's promise chain settle inside act. */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  (console.warn as jest.Mock).mockRestore?.();
});

describe('useTaughtKeys', () => {
  it('returns the language\'s taught answers, with fill-blank keys welded into whole words', async () => {
    mockFetch.mockResolvedValue([
      { type: 'translate_to_target', prompt: 'Translate to Spanish: Hello', correctAnswer: 'Hola' },
      // A fill-blank stores only the filler. `rino` is nobody's answer to
      // another question; `Sobrino` is what the lesson teaches.
      { type: 'fill_blank', prompt: 'Sob_____ — nephew', correctAnswer: 'rino' },
    ]);

    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<Probe language="es" />);
    });
    await flush();

    expect(mockFetch).toHaveBeenCalledWith('es');
    expect(rendered(r).split('|').sort()).toEqual(['Hola', 'Sobrino']);
  });

  it('degrades to an empty set when the fetch fails, rather than throwing into the lesson', async () => {
    mockFetch.mockRejectedValue(new Error('network'));

    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<Probe language="fr" />);
    });
    await flush();

    // The runner still applies the lesson's own keys, so the rule narrows
    // rather than disappearing. Nothing is shown to the learner.
    expect(rendered(r)).toBe('');
    expect(console.warn).toHaveBeenCalled();
  });

  it('fetches nothing when there is no language', async () => {
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<Probe language={undefined} />);
    });
    await flush();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(rendered(r)).toBe('');
  });

  it('does not let a slow first language overwrite the one the learner switched to', async () => {
    let releaseSpanish!: (rows: unknown[]) => void;
    mockFetch.mockImplementation((language: string) =>
      language === 'es'
        ? new Promise((resolve) => {
            releaseSpanish = resolve as (rows: unknown[]) => void;
          })
        : Promise.resolve([
            { type: 'translate_to_target', prompt: '', correctAnswer: 'Guten Tag' },
          ]),
    );

    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<Probe language="es" />);
    });
    await act(async () => {
      r.update(<Probe language="de" />);
    });
    await flush();
    expect(rendered(r)).toBe('Guten Tag');

    // Spanish now answers, late. Its effect was cleaned up, so it must not
    // hand the grader another language's answers as this language's siblings.
    await act(async () => {
      releaseSpanish([{ type: 'translate_to_target', prompt: '', correctAnswer: 'Hola' }]);
    });
    await flush();
    expect(rendered(r)).toBe('Guten Tag');
  });
});
