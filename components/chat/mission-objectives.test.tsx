/**
 * MissionObjectives — what a learner is told, not how it looks.
 *
 * Three contracts: the header counts objectives in words, a newly met
 * objective buzzes exactly once (a re-render must not buzz again), and the
 * live region announces the objective that was just done.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { MissionObjectives, objectivesHeaderLine } from './MissionObjectives';
import type { MissionMeta } from '../../types/missions';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-av', () => ({ Audio: { Sound: { createAsync: jest.fn() } } }));
// `useMotion` -> `lib/motion-preference` reaches for the native AsyncStorage
// module, which does not exist under jest.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));
const mockHaptic = jest.fn();
jest.mock('../../lib/haptics', () => ({ haptic: (...args: unknown[]) => mockHaptic(...args) }));

const MISSION: MissionMeta = {
  stage: 2,
  band: 'A2',
  title: 'Order a full meal',
  objectives: [
    { id: 'ask_dish', text: 'Ask a question about a dish' },
    { id: 'order_meal', text: 'Order a main course and a drink' },
    { id: 'ask_bill', text: 'Ask for the bill' },
  ],
};

function render(props: { met: string[]; lastTicked: string[] }) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<MissionObjectives mission={MISSION} {...props} />);
  });
  return tree;
}

function visibleText(tree: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

describe('MissionObjectives', () => {
  beforeEach(() => {
    mockHaptic.mockClear();
  });

  it('counts objectives in words', () => {
    expect(objectivesHeaderLine(2, 1, 3)).toBe('Mission 2 · 1 of 3 done');
    const tree = render({ met: ['ask_dish'], lastTicked: [] });
    expect(visibleText(tree)).toContain('Mission 2 · 1 of 3 done');
    const header = tree.root.findAll(
      (n) => n.props?.accessibilityRole === 'button' && typeof n.props.onPress === 'function',
    )[0];
    expect(header.props.accessibilityState).toEqual({ expanded: true });
  });

  it('ticks a met objective with an icon and a label, never colour alone', () => {
    const tree = render({ met: ['ask_dish'], lastTicked: [] });
    // Host views only: a composite View renders a host View with the same
    // props, so an unfiltered scan sees every row twice.
    const rows = tree.root.findAll(
      (n) =>
        String(n.type) === 'View' &&
        typeof n.props?.accessibilityLabel === 'string' &&
        /^(Done|Not done): /.test(n.props.accessibilityLabel),
    );
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual([
      'Done: Ask a question about a dish',
      'Not done: Order a main course and a drink',
      'Not done: Ask for the bill',
    ]);
    const icons = tree.root.findAll((n) => String(n.type) === 'Ionicons').map((n) => n.props.name);
    expect(icons).toContain('checkmark-circle');
    expect(icons.filter((name) => name === 'ellipse-outline')).toHaveLength(2);
  });

  it('buzzes once per newly met objective and not again on re-render', () => {
    const tree = render({ met: [], lastTicked: [] });
    expect(mockHaptic).not.toHaveBeenCalled();

    act(() => {
      tree.update(<MissionObjectives mission={MISSION} met={['ask_dish']} lastTicked={['ask_dish']} />);
    });
    expect(mockHaptic).toHaveBeenCalledTimes(1);
    expect(mockHaptic).toHaveBeenCalledWith('correct');

    // Same props again — a re-render is not a second success.
    act(() => {
      tree.update(<MissionObjectives mission={MISSION} met={['ask_dish']} lastTicked={['ask_dish']} />);
    });
    expect(mockHaptic).toHaveBeenCalledTimes(1);

    // A resumed checklist seeds `met` with nothing ticked: no buzz either.
    act(() => {
      tree.update(<MissionObjectives mission={MISSION} met={['ask_dish', 'order_meal']} lastTicked={[]} />);
    });
    expect(mockHaptic).toHaveBeenCalledTimes(1);
  });

  it('announces the objective that was just done', () => {
    const tree = render({ met: ['ask_bill'], lastTicked: ['ask_bill'] });
    const live = tree.root.findAll((n) => n.props?.accessibilityLiveRegion === 'polite');
    expect(live.length).toBeGreaterThan(0);
    expect(visibleText(tree)).toContain('Objective done: Ask for the bill');
  });
});
