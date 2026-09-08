/**
 * "Your patterns" on Home — the accessibility contract and the three states
 * that must not be confused: nothing to say, could not load, something to say.
 *
 * Layout is verified on device; what is pinned here is what a screen reader
 * is told and, above all, that an empty list and a failed read never render
 * the same thing (CLAUDE.md §5).
 */
import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { HOME_MISTAKE_ROWS, HOME_WORD_CHIPS, PatternsCard } from './HomeInsights';
import type { RecurringMistake, StrugglingWord } from '../../../lib/insights';
import type { Card, ReviewItem } from '../../../types';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { setItem: jest.fn(async () => {}), getItem: jest.fn(async () => null), removeItem: jest.fn(async () => {}) },
}));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withSpring: (to: number) => to,
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
  };
});
jest.mock('../../../lib/haptics', () => ({ haptic: jest.fn() }));

function mistake(label: string, count: number): RecurringMistake {
  return { label, errorType: 'grammar', count, latest: '2026-09-01T00:00:00.000Z', example: null };
}

function word(text: string): StrugglingWord {
  const item: ReviewItem = {
    id: `ri-${text}`, userId: 'u', cardId: `c-${text}`, easeFactor: 1.9, interval: 1, repetitions: 0,
    nextDue: '2026-09-01T00:00:00.000Z', lastReviewedAt: '2026-09-01T00:00:00.000Z', status: 'learning',
  };
  const card: Card = {
    id: `c-${text}`, courseId: 'co', unitId: null, nativeText: 'x', targetText: text, audioUrl: null, imageUrl: null,
    exampleSentence: null, exampleSentenceTranslation: null, partOfSpeech: null, tags: [], createdAt: '2026-01-01T00:00:00.000Z',
  };
  return { item, card, reason: 'keeps_slipping' };
}

/** Host nodes only — a composite and the host it renders carry the same props. */
function labels(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll((n: ReactTestInstance) => typeof n.type === 'string' && typeof n.props?.accessibilityLabel === 'string')
    .map((n) => n.props.accessibilityLabel as string);
}

function texts(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root
    .findAll((n: ReactTestInstance) => typeof n.type === 'string' && String(n.type) === 'Text')
    .map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? '')))
    .join('\n');
}

const noop = () => {};

/** `create` inside `act`, or React 19's test renderer commits nothing. */
function render(element: React.ReactElement): TestRenderer.ReactTestRenderer {
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

describe('PatternsCard', () => {
  it('renders nothing while loading and nothing when there is nothing to say', () => {
    const loading = render(
      <PatternsCard mistakes={[]} words={[]} loading error={null} onRetry={noop} onOpen={noop} onReviewWords={noop} />,
    );
    expect(loading.toJSON()).toBeNull();
    const empty = render(
      <PatternsCard mistakes={[]} words={[]} loading={false} error={null} onRetry={noop} onOpen={noop} onReviewWords={noop} />,
    );
    expect(empty.toJSON()).toBeNull();
  });

  it('renders a failed read as an error with a retry, never as an empty card', () => {
    const onRetry = jest.fn();
    const r = render(
      <PatternsCard
        mistakes={[]} words={[]} loading={false}
        error={{ title: 'Could not load your patterns', message: 'Check your connection.' }}
        onRetry={onRetry} onOpen={noop} onReviewWords={noop}
      />,
    );
    expect(r.toJSON()).not.toBeNull();
    expect(texts(r)).toContain('Could not load your patterns');
    const retry = r.root.find((n) => n.props?.accessibilityLabel === 'Try loading your patterns again');
    TestRenderer.act(() => retry.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('caps the rows and chips, counts the rest, and says so to a screen reader', () => {
    const mistakes = ['a', 'b', 'c', 'd', 'e'].map((l, i) => mistake(`mistake ${l}`, 5 - i));
    const words = ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'].map(word);
    const r = render(
      <PatternsCard mistakes={mistakes} words={words} loading={false} error={null} onRetry={noop} onOpen={noop} onReviewWords={noop} />,
    );
    const all = labels(r);
    expect(all.filter((l) => l.startsWith('mistake '))).toHaveLength(HOME_MISTAKE_ROWS);
    expect(all).toContain('mistake a. Grammar, 5 times in 30 days');
    // Chips: the first N words plus a "+rest" chip.
    const chipLabels = all.filter((l) => ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'].includes(l));
    expect(chipLabels).toHaveLength(HOME_WORD_CHIPS);
    expect(all).toContain(`+${words.length - HOME_WORD_CHIPS}`);
    // The reader hears every word, not only the ones that fit.
    expect(all).toContain('Words: uno, dos, tres, cuatro, cinco, seis');
    expect(all).toContain('Review these 6 words now');
  });

  it('routes the two actions separately: the card opens, the inline link reviews', () => {
    const onOpen = jest.fn();
    const onReviewWords = jest.fn();
    const r = render(
      <PatternsCard mistakes={[mistake('ser vs estar', 3)]} words={[word('hola')]} loading={false} error={null} onRetry={noop} onOpen={onOpen} onReviewWords={onReviewWords} />,
    );
    TestRenderer.act(() => r.root.find((n) => n.props?.accessibilityLabel === 'Review this word now').props.onPress());
    expect(onReviewWords).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    TestRenderer.act(() => r.root.find((n) => n.props?.accessibilityLabel === 'See all').props.onPress());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
