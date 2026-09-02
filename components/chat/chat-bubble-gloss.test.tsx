/**
 * ChatBubble — Translate must not pay for a round trip we already paid for.
 *
 * ai-chat now returns a short native-language gloss of its own reply in the
 * same response. When that gloss is present, tapping Translate is a pure
 * toggle: no call to the `translate` edge function, no second paid model call,
 * no wait. When it is absent — a user's own message, a reloaded transcript,
 * the safety fallback reply — the old `translate` path still runs, unchanged.
 *
 * The assertion that matters is the NEGATIVE one: translateText not called.
 */

import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { ChatBubble } from './ChatBubble';
import type { ConversationMessage } from '../../types';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-av', () => ({ Audio: { Sound: { createAsync: jest.fn() } } }));
jest.mock('../ui/ReportContentSheet', () => ({ ReportContentSheet: () => null }));
jest.mock('../../lib/supabase-queries', () => ({ saveCorrectionAsCard: jest.fn() }));

const mockTranslateText = jest.fn(async () => 'translated by the translate function');
jest.mock('../../lib/ai', () => ({
  getTextToSpeech: jest.fn(),
  translateText: (...args: unknown[]) => mockTranslateText(...(args as [])),
  VoiceError: class VoiceError extends Error {},
}));

const ASSISTANT_MESSAGE: ConversationMessage = {
  id: 'msg-1',
  role: 'assistant',
  content: '¡Claro! ¿Qué te gusta cocinar los fines de semana?',
  audioUrl: null,
  correction: null,
  timestamp: '2026-09-02T10:00:00.000Z',
};

const GLOSS = 'Of course! What do you like to cook at the weekend?';

// ChatBubble memoises fetched translations in a module-level Map keyed by
// message id, so every test needs its own id or the second one silently reads
// the first one's cache entry instead of exercising the path under test.
let nextId = 0;
function render(props: { gloss?: string | null }) {
  const message: ConversationMessage = { ...ASSISTANT_MESSAGE, id: `msg-${++nextId}` };
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ChatBubble
        message={message}
        targetLanguage="es"
        nativeLanguage="en"
        userId="user-1"
        gloss={props.gloss}
      />,
    );
  });
  return tree;
}

/**
 * A Pressable renders as a composite plus a host View, both carrying the
 * accessibility label, so the onPress handler identifies the pressable one.
 */
function pressByLabel(tree: TestRenderer.ReactTestRenderer, label: string) {
  const nodes: ReactTestInstance[] = tree.root
    .findAll((n) => n.props?.accessibilityLabel === label, { deep: true })
    .filter((n) => typeof n.props.onPress === 'function');
  expect(nodes.length).toBeGreaterThan(0);
  act(() => {
    nodes[0].props.onPress();
  });
}

function visibleText(tree: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

describe('ChatBubble Translate', () => {
  beforeEach(() => {
    mockTranslateText.mockClear();
  });

  it('shows the pre-generated gloss with NO network call', async () => {
    const tree = render({ gloss: GLOSS });
    pressByLabel(tree, 'Translate this message');

    // The whole point of folding the gloss into the ai-chat response: this is
    // text we generated ourselves a moment ago, so paying a second model call
    // to translate it was buying something we already had.
    expect(mockTranslateText).not.toHaveBeenCalled();
    expect(visibleText(tree)).toContain(GLOSS);
  });

  it('still falls back to the translate function when there is no gloss', async () => {
    const tree = render({ gloss: undefined });
    pressByLabel(tree, 'Translate this message');
    await act(async () => {});

    expect(mockTranslateText).toHaveBeenCalledTimes(1);
    expect(mockTranslateText).toHaveBeenCalledWith(ASSISTANT_MESSAGE.content, 'es', 'en');
    expect(visibleText(tree)).toContain('translated by the translate function');
  });

  it('treats a null gloss the same as an absent one', async () => {
    // The server sends null rather than omitting the key, and null must route
    // to the fallback rather than rendering an empty caption.
    const tree = render({ gloss: null });
    pressByLabel(tree, 'Translate this message');
    await act(async () => {});

    expect(mockTranslateText).toHaveBeenCalledTimes(1);
  });

  it('hides the gloss again on a second tap, still without a network call', () => {
    const tree = render({ gloss: GLOSS });
    pressByLabel(tree, 'Translate this message');
    expect(visibleText(tree)).toContain(GLOSS);

    pressByLabel(tree, 'Hide translation');
    expect(visibleText(tree)).not.toContain(GLOSS);
    expect(mockTranslateText).not.toHaveBeenCalled();
  });
});
