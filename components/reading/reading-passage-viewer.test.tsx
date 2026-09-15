import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ReadingPassageViewer } from './ReadingPassageViewer';
import type { ReadingPassage } from '../../types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock('../../lib/haptics', () => ({ haptic: jest.fn() }));
jest.mock('../audio/AudioPlayButton', () => ({ AudioPlayButton: () => null }));

function passage(overrides: Partial<ReadingPassage> = {}): ReadingPassage {
  return {
    id: 'p', courseId: 'c', unitId: null, cefrLevel: 'B1', title: 'Sport und Gesundheit',
    content: 'Ein Satz.\n\nNoch ein Satz.', contentTranslation: null, wordCount: 92,
    audioUrl: null, imageUrl: null, sourceAttribution: null, tags: [], isPublished: true, createdAt: '',
    ...overrides,
  };
}

const METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function render(props: { passage?: ReadingPassage; language?: string | null } = {}) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      // The viewer reads safe-area insets since UI 2.0, so it needs a provider.
      <SafeAreaProvider initialMetrics={METRICS}>
      <ReadingPassageViewer
        passage={props.passage ?? passage()}
        language={props.language}
        selectedRef={null}
        lookup={null}
        explanation={null}
        onWordPress={jest.fn()}
        onExplain={jest.fn()}
        onRetryLookup={jest.fn()}
        onDismissHelp={jest.fn()}
        onAddToReview={jest.fn()}
        onContinue={jest.fn()}
        onExit={jest.fn()}
      />
      </SafeAreaProvider>,
    );
  });
  return tree;
}

/** The meta line: its own visible text plus the accessibility label it carries. */
function metaLine(tree: TestRenderer.ReactTestRenderer) {
  const node = tree.root.findAll(n => typeof n.props.accessibilityLabel === 'string'
    && / words?\.|word segments?\./.test(n.props.accessibilityLabel))[0];
  const visible = node.findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children.filter((c): c is string => typeof c === 'string'))
    .join('');
  return { visible, label: node.props.accessibilityLabel as string };
}

test('a spaced language names the count words', () => {
  const { visible, label } = metaLine(render({ language: 'de' }));
  expect(visible).toContain('92 words');
  expect(label).toContain('92 words.');
});

test('no language given still names the count words', () => {
  expect(metaLine(render()).visible).toContain('92 words');
});

test.each(['ja', 'zh'])('%s names the count word segments, never words', (language) => {
  const { visible, label } = metaLine(render({ passage: passage({ wordCount: 286 }), language }));
  expect(visible).toContain('286 word segments');
  expect(visible).not.toMatch(/\d+ words/);
  expect(label).toContain('286 word segments.');
  expect(label).not.toMatch(/\d+ words/);
});

test('the accessibility label matches the visible length text', () => {
  for (const language of ['de', 'ja', 'ko', 'zh']) {
    const { visible, label } = metaLine(render({ passage: passage({ wordCount: 7 }), language }));
    const shown = label.split('.')[0];
    expect(visible).toContain(shown);
  }
});

test('one unit is singular', () => {
  expect(metaLine(render({ passage: passage({ wordCount: 1 }), language: 'ja' })).visible).toContain('1 word segment ');
  expect(metaLine(render({ passage: passage({ wordCount: 1 }), language: 'es' })).visible).toContain('1 word ');
});

test('the CEFR level and its can-do line still render', () => {
  const tree = render({ language: 'es' });
  const text = tree.root.findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children.filter((c): c is string => typeof c === 'string')).join(' ');
  expect(text).toContain('B1');
  expect(text).toContain('Handle most situations while travelling');
  expect(text).toContain('Sport und Gesundheit');
  expect(text).toContain('Continue to Questions');
});
