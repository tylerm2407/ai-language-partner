/**
 * MissionWarmupSheet — the contract the chat screen relies on.
 *
 * What is asserted is behaviour, not layout: the phrases render after the
 * fetch resolves, Skip reaches the parent AND analytics, a row tap requests
 * exactly that phrase's clip (and nothing is requested before a tap — the
 * whole reason audio is on-tap), a 'DAILY_LIMIT' mutes every row after ONE
 * ceiling alert, a failed fetch offers a retry, a paid-only refusal does not,
 * and `starting` disables both ways out.
 */

import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { MissionWarmupSheet, rowGlyph, warmupErrorCopy } from './MissionWarmupSheet';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withSpring: (to: number) => to,
  };
});
jest.mock('../../lib/haptics', () => ({ haptic: jest.fn() }));

// Real classes, declared INSIDE the factory: the component's `instanceof`
// must see the same constructor the test throws, and the factory runs during
// the hoisted import — before any class declared at module level exists.
// `lib/ai` itself reaches `lib/supabase`, which throws without env vars.
const mockFetchMissionPhrases = jest.fn();
jest.mock('../../lib/ai', () => {
  class MissionApiError extends Error {
    code?: string;
    status?: number;
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
      this.name = 'VoiceError';
      this.code = code;
    }
  }
  return {
    fetchMissionPhrases: (...args: unknown[]) => mockFetchMissionPhrases(...args),
    MissionApiError,
    VoiceError,
  };
});
// Resolve to the mock above, so the test throws the constructor the component checks.
const { MissionApiError: MockMissionApiError, VoiceError: MockVoiceError } =
  jest.requireMock<typeof import('../../lib/ai')>('../../lib/ai');

const mockGetLessonAudioUri = jest.fn(async () => 'file:///stub.mp3');
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

const mockPlay = jest.fn(async () => {});
const mockStop = jest.fn(async () => {});
const mockCleanup = jest.fn(async () => {});
jest.mock('../../hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    playing: false,
    loading: false,
    error: null,
    play: mockPlay,
    stop: mockStop,
    cleanup: mockCleanup,
  }),
}));

const PHRASES = [
  { phrase: 'Una mesa para dos, por favor', meaning: 'A table for two, please' },
  { phrase: '¿Cuánto cuesta?', meaning: 'How much does it cost?' },
];

const onStart = jest.fn();
const onSkip = jest.fn();

function render(over: Partial<React.ComponentProps<typeof MissionWarmupSheet>> = {}) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <MissionWarmupSheet
        visible
        scenarioKey="restaurant"
        stage={1}
        targetLanguage="es"
        nativeLanguage="en"
        userId="user-1"
        tier="basic"
        onStart={onStart}
        onSkip={onSkip}
        {...over}
      />,
    );
  });
  return tree;
}

/** Let the fetch promise and the state it sets settle. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/**
 * A Pressable renders as a composite plus a host View, both carrying the
 * accessibility label, so the onPress handler identifies the pressable one.
 */
function pressables(tree: TestRenderer.ReactTestRenderer, label: string): ReactTestInstance[] {
  return tree.root
    .findAll((n) => n.props?.accessibilityLabel === label, { deep: true })
    .filter((n) => typeof n.props.onPress === 'function');
}

async function press(tree: TestRenderer.ReactTestRenderer, label: string) {
  const nodes = pressables(tree, label);
  expect(nodes.length).toBeGreaterThan(0);
  await act(async () => {
    await nodes[0].props.onPress();
  });
}

function visibleText(tree: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

const ROW_1 = `Play: ${PHRASES[0].phrase}. ${PHRASES[0].meaning}`;
const ROW_2 = `Play: ${PHRASES[1].phrase}. ${PHRASES[1].meaning}`;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchMissionPhrases.mockResolvedValue({ phrases: PHRASES, cached: true });
  mockGetLessonAudioUri.mockResolvedValue('file:///stub.mp3');
});

describe('MissionWarmupSheet', () => {
  it('renders the heading, caption and one row per phrase once the fetch resolves', async () => {
    const tree = render();
    expect(visibleText(tree)).toContain('Before you start');
    expect(visibleText(tree)).toContain('Mission 1 of 4 · A table and a drink');
    expect(visibleText(tree)).toContain('Getting your phrases');

    await settle();

    expect(mockFetchMissionPhrases).toHaveBeenCalledTimes(1);
    expect(mockFetchMissionPhrases).toHaveBeenCalledWith({
      scenarioKey: 'restaurant',
      stage: 1,
      targetLanguage: 'es',
      nativeLanguage: 'en',
    });
    expect(pressables(tree, ROW_1).length).toBeGreaterThan(0);
    expect(pressables(tree, ROW_2).length).toBeGreaterThan(0);
    expect(visibleText(tree)).toContain(PHRASES[1].meaning);
    // The load-bearing negative: nothing was prewarmed.
    expect(mockGetLessonAudioUri).not.toHaveBeenCalled();
  });

  it('Skip calls onSkip and tracks the event with the scene and stage', async () => {
    const tree = render();
    await settle();
    await press(tree, 'Skip');

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('mission_warmup_skipped', { contentId: 'restaurant', step: 1 });
  });

  it('a backdrop dismiss is a Skip, never an orphan state', async () => {
    const tree = render();
    await settle();
    await press(tree, 'Dismiss sheet');

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('mission_warmup_skipped', expect.objectContaining({ step: 1 }));
  });

  it('tapping a row requests that phrase through getLessonAudioUri and plays it', async () => {
    const tree = render();
    await settle();
    await press(tree, ROW_2);

    expect(mockGetLessonAudioUri).toHaveBeenCalledTimes(1);
    expect(mockGetLessonAudioUri).toHaveBeenCalledWith({
      text: PHRASES[1].phrase,
      language: 'es',
      userId: 'user-1',
    });
    expect(mockPlay).toHaveBeenCalledWith('file:///stub.mp3');
  });

  it('Start calls onStart without tracking a skip', async () => {
    const tree = render();
    await settle();
    await press(tree, 'Start mission 1');

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('a DAILY_LIMIT shows the ceiling alert once and mutes every row, phrases still readable', async () => {
    mockGetLessonAudioUri.mockRejectedValue(new MockVoiceError('quota', 'DAILY_LIMIT'));
    const tree = render();
    await settle();
    await press(tree, ROW_1);

    expect(mockShowLimitAlert).toHaveBeenCalledTimes(1);
    expect(mockShowLimitAlert.mock.calls[0][0]).toBe('lesson audio');
    expect(mockShowLimitAlert.mock.calls[0][1]).toBe('basic');
    expect(mockPlay).not.toHaveBeenCalled();

    // Every row is now disabled, not just the one that hit the wall.
    for (const label of [ROW_1, ROW_2]) {
      const row = pressables(tree, label)[0];
      expect(row.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    }
    expect(visibleText(tree)).toContain(PHRASES[0].phrase);
    expect(visibleText(tree)).toContain(PHRASES[1].phrase);

    // A second tap on a muted row must not re-alert or re-request.
    const row = pressables(tree, ROW_2)[0];
    await act(async () => {
      await row.props.onPress();
    });
    expect(mockShowLimitAlert).toHaveBeenCalledTimes(1);
    expect(mockGetLessonAudioUri).toHaveBeenCalledTimes(1);

    // Start and Skip are untouched by the quota.
    await press(tree, 'Start mission 1');
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('a failed fetch shows a retry that fetches again, and Start still works', async () => {
    mockFetchMissionPhrases.mockRejectedValueOnce(new Error('fetch failed'));
    const tree = render();
    await settle();

    expect(visibleText(tree)).toContain("Couldn't reach Fluenci");
    expect(pressables(tree, 'Try again').length).toBeGreaterThan(0);

    await press(tree, 'Try again');
    await settle();
    expect(mockFetchMissionPhrases).toHaveBeenCalledTimes(2);
    expect(pressables(tree, ROW_1).length).toBeGreaterThan(0);
  });

  it('MISSION_PAID_ONLY is settled: the plans sentence, no retry, buttons live', async () => {
    mockFetchMissionPhrases.mockRejectedValue(new MockMissionApiError('nope', 'MISSION_PAID_ONLY', 403));
    const tree = render();
    await settle();

    expect(visibleText(tree)).toContain('Missions are part of the paid plans');
    expect(pressables(tree, 'Try again')).toHaveLength(0);
    await press(tree, 'Skip');
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('fewer than one phrase is the empty state with both buttons', async () => {
    mockFetchMissionPhrases.mockResolvedValue({ phrases: [], cached: false });
    const tree = render();
    await settle();

    expect(visibleText(tree)).toContain('No warm-up this time');
    expect(pressables(tree, 'Start mission 1').length).toBeGreaterThan(0);
    expect(pressables(tree, 'Skip').length).toBeGreaterThan(0);
  });

  it('starting disables both buttons and the backdrop', async () => {
    const tree = render({ starting: true });
    await settle();

    for (const label of ['Start mission 1', 'Skip']) {
      const node = pressables(tree, label)[0];
      expect(node.props.disabled).toBe(true);
    }
    // Ui2Sheet drops the backdrop's onPress entirely when dismissal is off, so
    // "no pressable backdrop" is the assertion, not a disabled flag.
    expect(pressables(tree, 'Dismiss sheet')).toHaveLength(0);
  });

  it('startError shows under the buttons with a retry that calls onStart again', async () => {
    const tree = render({ startError: 'The server did not answer.' });
    await settle();

    expect(visibleText(tree)).toContain("Couldn't start the mission");
    expect(visibleText(tree)).toContain('The server did not answer.');
    await press(tree, 'Try again');
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('closing stops playback', async () => {
    const tree = render();
    await settle();
    act(() => {
      tree.update(
        <MissionWarmupSheet
          visible={false}
          scenarioKey="restaurant"
          stage={1}
          targetLanguage="es"
          nativeLanguage="en"
          userId="user-1"
          tier="basic"
          onStart={onStart}
          onSkip={onSkip}
        />,
      );
    });
    expect(mockCleanup).toHaveBeenCalled();
  });
});

describe('rowGlyph precedence', () => {
  const base = { quotaExhausted: false, active: true, fetching: false, loading: false, playing: false, failed: false };

  it('quota beats everything', () => {
    expect(rowGlyph({ ...base, quotaExhausted: true, playing: true })).toBe('muted');
  });
  it('an inactive row is idle even while another plays', () => {
    expect(rowGlyph({ ...base, active: false, playing: true })).toBe('idle');
  });
  it('loading beats failed beats playing', () => {
    expect(rowGlyph({ ...base, fetching: true, failed: true })).toBe('loading');
    expect(rowGlyph({ ...base, loading: true, playing: true })).toBe('loading');
    expect(rowGlyph({ ...base, failed: true, playing: true })).toBe('failed');
    expect(rowGlyph({ ...base, playing: true })).toBe('playing');
  });
});

describe('warmupErrorCopy', () => {
  it('paid-only is not retryable and names the plans', () => {
    const r = warmupErrorCopy(new MockMissionApiError('x', 'MISSION_PAID_ONLY', 403));
    expect(r.retryable).toBe(false);
    expect(r.copy.message).toBe('Missions are part of the paid plans');
  });
  it('rate-limited is retryable', () => {
    expect(warmupErrorCopy(new MockMissionApiError('x', 'RATE_LIMITED', 429)).retryable).toBe(true);
  });
  it('anything else falls through to the load copy', () => {
    const r = warmupErrorCopy(new Error('boom'));
    expect(r.retryable).toBe(true);
    expect(r.copy.message).toContain('the warm-up phrases');
  });
});
