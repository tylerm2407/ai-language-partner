/**
 * Reduce motion has to reach the answer feedback and the typing indicator.
 *
 * The in-app switch was honored by the UI 2.0 chrome — home entrances, the
 * mascot, the progress bar, the tutor visualisers — but three surfaces never
 * read it: the sparkle and shake that fire on every graded answer, and the chat
 * typing dots, which loop for as long as the tutor is composing. A learner who turned
 * the setting on still got all three, which is the same as the setting not
 * working: they are the animations a lesson actually shows you.
 *
 * These tests assert the gate, not the choreography. What each animation looks
 * like when it does run is a device question; whether it runs at all when the
 * learner asked for no motion is a correctness question.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Animated, Text } from 'react-native';

import { CorrectSparkle } from './CorrectSparkle';
import { WrongShake } from './WrongShake';
import { TypingIndicator } from '../chat/TypingIndicator';
import { resetMotionPreferenceForTests, setReduceMotion } from '../../lib/motion-preference';

// The icon set resolves its font asynchronously and setState()s afterwards,
// which lands after the test has already asserted.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
// useMotion -> lib/motion-preference reaches for the native AsyncStorage
// module, which does not exist under jest.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));

const child = <Text>exercise</Text>;

/** Render inside act(), so the animation effects run before the assertion. */
function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

/**
 * Records which composite animations were actually STARTED, by name.
 *
 * Asserting on the start rather than the construction matters: a component can
 * legitimately build an animation it then decides not to run, and what the
 * learner feels is only ever the ones that ran.
 */
type CompositeFactory = (...args: never[]) => Animated.CompositeAnimation;

function trackStarts() {
  const started: string[] = [];
  const names = ['loop', 'parallel', 'sequence'] as const;
  const spies = names.map((name) => {
    const original = Animated[name] as unknown as CompositeFactory;
    const spy = jest.spyOn(Animated, name);
    spy.mockImplementation(((...args: unknown[]) => {
      const composite = original(...(args as never[]));
      return {
        ...composite,
        start: (cb?: Animated.EndCallback) => {
          started.push(name);
          return composite.start(cb);
        },
      };
    }) as never);
    return spy;
  });
  return { started, restore: () => spies.forEach((s) => s.mockRestore()) };
}

afterEach(() => {
  resetMotionPreferenceForTests();
  jest.restoreAllMocks();
});

describe('reduce motion reaches the answer feedback', () => {
  it('CorrectSparkle throws no particles when motion is reduced', async () => {
    await setReduceMotion(true);
    const tree = render(<CorrectSparkle trigger>{child}</CorrectSparkle>);
    expect(tree.root.findAllByType('Ionicons' as unknown as React.ComponentType)).toHaveLength(0);
    tree.unmount();
  });

  it('CorrectSparkle still throws particles when motion is allowed', () => {
    const tree = render(<CorrectSparkle trigger>{child}</CorrectSparkle>);
    // Eight stars: the celebration is intact for everyone who did not opt out.
    expect(tree.root.findAllByType('Ionicons' as unknown as React.ComponentType)).toHaveLength(8);
    tree.unmount();
  });

  it('WrongShake keeps the red tint but stops moving the exercise', async () => {
    await setReduceMotion(true);
    const { started, restore } = trackStarts();
    const tree = render(<WrongShake trigger>{child}</WrongShake>);
    // The tint sequence still runs; the shake's parallel wrapper never does.
    expect(started).toContain('sequence');
    expect(started).not.toContain('parallel');
    restore();
    tree.unmount();
  });

  it('WrongShake shakes when motion is allowed', () => {
    const { started, restore } = trackStarts();
    const tree = render(<WrongShake trigger>{child}</WrongShake>);
    expect(started).toContain('parallel');
    restore();
    tree.unmount();
  });
});

describe('reduce motion reaches the chat typing dots', () => {
  it('starts no loop when motion is reduced', async () => {
    await setReduceMotion(true);
    const { started, restore } = trackStarts();
    const tree = render(<TypingIndicator />);
    expect(started).toHaveLength(0);
    restore();
    tree.unmount();
  });

  it('loops when motion is allowed', () => {
    const { started, restore } = trackStarts();
    const tree = render(<TypingIndicator />);
    expect(started).toContain('parallel');
    restore();
    tree.unmount();
  });
});
