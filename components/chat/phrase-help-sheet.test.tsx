/**
 * PhraseHelpSheet — the contract the chat screen relies on.
 *
 * The assertions that matter most are the NEGATIVE ones: the learner's own
 * question and the phrase they got back must never reach analytics. The rest
 * pins the mode split (Insert vs. Got it) and the two refusals that need
 * different treatment — a hint-quota hit is terminal for the day and gets the
 * shared limit alert, a rate limit is transient and gets an inline caption.
 */

import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { PhraseHelpSheet } from './PhraseHelpSheet';
import { MissionApiError } from '../../lib/ai';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
// SlabButton -> useMotion -> lib/motion-preference reaches for the native
// AsyncStorage module, which does not exist under jest.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    playing: false,
    loading: false,
    error: null,
    play: jest.fn(async () => {}),
    stop: jest.fn(async () => {}),
    cleanup: jest.fn(async () => {}),
  }),
}));

const mockGetPhraseHelp = jest.fn();
jest.mock('../../lib/ai', () => {
  class MissionApiError extends Error {
    readonly code?: string;
    readonly status?: number;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.name = 'MissionApiError';
      this.code = code;
      this.status = status;
    }
  }
  class VoiceError extends Error {
    code: string;
    constructor(message: string, code = 'UNKNOWN') {
      super(message);
      this.code = code;
    }
  }
  return {
    getPhraseHelp: (...args: unknown[]) => mockGetPhraseHelp(...(args as [])),
    MissionApiError,
    VoiceError,
  };
});

const mockGetLessonAudioUri = jest.fn(async () => 'file:///clip.mp3');
jest.mock('../../lib/lesson-audio', () => ({
  getLessonAudioUri: (...args: unknown[]) => mockGetLessonAudioUri(...(args as [])),
}));

const mockShowLimitAlert = jest.fn();
jest.mock('../../lib/limit-messaging', () => ({
  showLimitAlert: (...args: unknown[]) => mockShowLimitAlert(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock('../../lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const ASK = 'where is the bathroom';
const PHRASE = '¿Dónde está el baño?';
const GLOSS = 'Where is the bathroom?';

function render(overrides: { mode?: 'text' | 'voice' } = {}) {
  const onInsert = jest.fn();
  const onClose = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <PhraseHelpSheet
        visible
        mode={overrides.mode ?? 'text'}
        targetLanguage="es"
        nativeLanguage="en"
        level="beginner"
        scenarioKey="restaurant"
        userId="user-1"
        tier="starter"
        onInsert={onInsert}
        onClose={onClose}
      />,
    );
  });
  return { tree, onInsert, onClose };
}

/** A Pressable renders as a composite plus a host View, both carrying the
 *  label, so the onPress handler identifies the pressable one. */
function findPressable(tree: TestRenderer.ReactTestRenderer, label: string): ReactTestInstance {
  const nodes = tree.root
    .findAll((n) => n.props?.accessibilityLabel === label, { deep: true })
    .filter((n) => typeof n.props.onPress === 'function');
  expect(nodes.length).toBeGreaterThan(0);
  return nodes[0];
}

function pressByLabel(tree: TestRenderer.ReactTestRenderer, label: string) {
  const node = findPressable(tree, label);
  act(() => {
    node.props.onPress();
  });
}

function typeAsk(tree: TestRenderer.ReactTestRenderer, text: string) {
  const input = tree.root
    .findAll((n) => n.props?.accessibilityLabel === 'Your question', { deep: true })
    .find((n) => typeof n.props.onChangeText === 'function');
  expect(input).toBeDefined();
  act(() => {
    input!.props.onChangeText(text);
  });
}

async function ask(tree: TestRenderer.ReactTestRenderer) {
  typeAsk(tree, ASK);
  pressByLabel(tree, 'Ask');
  await act(async () => {});
}

function visibleText(tree: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

function isDisabled(node: ReactTestInstance): boolean {
  return node.props.accessibilityState?.disabled === true || node.props.disabled === true;
}

describe('PhraseHelpSheet', () => {
  beforeEach(() => {
    mockGetPhraseHelp.mockReset();
    mockGetLessonAudioUri.mockClear();
    mockShowLimitAlert.mockClear();
    mockTrackEvent.mockClear();
  });

  it('asks with the typed question and keeps the question and phrase out of analytics', async () => {
    mockGetPhraseHelp.mockResolvedValue({ phrase: PHRASE, gloss: GLOSS });
    const { tree } = render();

    await ask(tree);

    expect(mockGetPhraseHelp).toHaveBeenCalledTimes(1);
    expect(mockGetPhraseHelp).toHaveBeenCalledWith({
      ask: ASK,
      targetLanguage: 'es',
      nativeLanguage: 'en',
      level: 'beginner',
      scenarioKey: 'restaurant',
    });
    expect(mockTrackEvent).toHaveBeenCalledWith('phrase_help_requested', { ok: true });

    // The learner's own words and the phrase derived from them are not
    // closed keys. Nothing that reaches analytics may contain either.
    const sent = JSON.stringify(mockTrackEvent.mock.calls);
    expect(sent).not.toContain(ASK);
    expect(sent).not.toContain(PHRASE);
    expect(sent).not.toContain(GLOSS);
  });

  it('renders the phrase and its gloss, with audio only on tap', async () => {
    mockGetPhraseHelp.mockResolvedValue({ phrase: PHRASE, gloss: GLOSS });
    const { tree } = render();

    await ask(tree);

    const text = visibleText(tree);
    expect(text).toContain(PHRASE);
    expect(text).toContain(GLOSS);
    // A play costs a lesson-audio slot, so arrival must not synthesise.
    expect(mockGetLessonAudioUri).not.toHaveBeenCalled();

    pressByLabel(tree, 'Play phrase');
    await act(async () => {});
    expect(mockGetLessonAudioUri).toHaveBeenCalledWith({
      text: PHRASE,
      language: 'es',
      userId: 'user-1',
    });
  });

  it('Insert hands the phrase back and closes, in text mode', async () => {
    mockGetPhraseHelp.mockResolvedValue({ phrase: PHRASE, gloss: GLOSS });
    const { tree, onInsert, onClose } = render({ mode: 'text' });

    await ask(tree);
    pressByLabel(tree, 'Insert');

    expect(onInsert).toHaveBeenCalledWith(PHRASE);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Got it just closes, in voice mode — there is no draft to insert into', async () => {
    mockGetPhraseHelp.mockResolvedValue({ phrase: PHRASE, gloss: GLOSS });
    const { tree, onInsert, onClose } = render({ mode: 'voice' });

    await ask(tree);
    expect(
      tree.root.findAll((n) => n.props?.accessibilityLabel === 'Insert', { deep: true }),
    ).toHaveLength(0);

    pressByLabel(tree, 'Got it');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('HINT_QUOTA_REACHED disables Ask, shows the limit alert and files a quota event', async () => {
    mockGetPhraseHelp.mockRejectedValue(
      new MissionApiError('Phrase help failed: quota', 'HINT_QUOTA_REACHED', 429),
    );
    const { tree } = render();

    await ask(tree);

    expect(isDisabled(findPressable(tree, 'Ask'))).toBe(true);
    expect(visibleText(tree)).toContain('You are out of hints for today');
    expect(mockShowLimitAlert).toHaveBeenCalledTimes(1);
    expect(mockShowLimitAlert.mock.calls[0][0]).toBe('hints');
    expect(mockShowLimitAlert.mock.calls[0][1]).toBe('starter');
    expect(mockTrackEvent).toHaveBeenCalledWith('phrase_help_requested', {
      ok: false,
      code: 'HINT_QUOTA_REACHED',
    });
    // Filed as a quota, not an outage — see the header of PhraseHelpSheet
    // for why this does not go through trackRefusal.
    expect(mockTrackEvent).toHaveBeenCalledWith('quota_exhausted', {
      code: 'HINT_QUOTA_REACHED',
      quota: 'hints',
    });
  });

  it('RATE_LIMITED shows the inline caption and leaves Ask enabled for a retry', async () => {
    mockGetPhraseHelp.mockRejectedValue(
      new MissionApiError('Phrase help failed: slow down', 'RATE_LIMITED', 429),
    );
    const { tree } = render();

    await ask(tree);

    expect(visibleText(tree)).toContain('Too fast — try again in a moment');
    expect(isDisabled(findPressable(tree, 'Ask'))).toBe(false);
    expect(mockShowLimitAlert).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('phrase_help_requested', {
      ok: false,
      code: 'RATE_LIMITED',
    });
  });
});
