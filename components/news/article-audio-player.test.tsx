/**
 * The accessibility contract for the narration controls.
 *
 * These assert labels and roles rather than pixels because the scrubber is the
 * one control here that is genuinely unusable without them: a pan gesture
 * means nothing when VoiceOver owns touch, so `adjustable` plus real
 * increment/decrement actions is the difference between a blind learner being
 * able to move within an article and not.
 */
import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { AudioScrubber } from './AudioScrubber';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => {
      const chain = {
        enabled: () => chain,
        onBegin: () => chain,
        onUpdate: () => chain,
        onEnd: () => chain,
        onFinalize: () => chain,
      };
      return chain;
    },
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-reanimated', () => ({ runOnJS: (fn: unknown) => fn }));

function render(element: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    r = TestRenderer.create(element);
  });
  return r;
}

function byLabel(r: TestRenderer.ReactTestRenderer, label: string) {
  return r.root.findAll(
    (n: ReactTestInstance) => n.props?.accessibilityLabel === label,
    { deep: true },
  )[0];
}

describe('AudioScrubber accessibility', () => {
  const base = { positionMs: 30_000, durationMs: 120_000, stepSeconds: 15 };

  it('is adjustable, so a screen reader can move within the article', () => {
    const node = byLabel(render(<AudioScrubber {...base} onSeek={() => {}} />), 'Playback position');
    expect(node.props.accessibilityRole).toBe('adjustable');
  });

  it('reports position and duration in seconds, not as an opaque percentage', () => {
    const node = byLabel(render(<AudioScrubber {...base} onSeek={() => {}} />), 'Playback position');
    expect(node.props.accessibilityValue).toEqual({ min: 0, max: 120, now: 30 });
  });

  it('offers increment and decrement actions — a pan gesture is not reachable', () => {
    const node = byLabel(render(<AudioScrubber {...base} onSeek={() => {}} />), 'Playback position');
    expect(node.props.accessibilityActions).toEqual([
      { name: 'increment', label: 'Forward 15 seconds' },
      { name: 'decrement', label: 'Back 15 seconds' },
    ]);
  });

  it('seeks forward by the step, clamped to the end', () => {
    const onSeek = jest.fn();
    const node = byLabel(
      render(<AudioScrubber {...base} positionMs={115_000} onSeek={onSeek} />),
      'Playback position',
    );
    node.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    expect(onSeek).toHaveBeenCalledWith(120_000);
  });

  it('seeks backward by the step, clamped to zero', () => {
    const onSeek = jest.fn();
    const node = byLabel(
      render(<AudioScrubber {...base} positionMs={5_000} onSeek={onSeek} />),
      'Playback position',
    );
    node.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('ignores accessibility actions when there is nothing loaded to seek in', () => {
    const onSeek = jest.fn();
    const node = byLabel(
      render(<AudioScrubber {...base} durationMs={0} onSeek={onSeek} />),
      'Playback position',
    );
    node.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    expect(onSeek).not.toHaveBeenCalled();
  });
});
