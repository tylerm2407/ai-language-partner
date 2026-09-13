/**
 * ScenarioPicker — the mission ladder on the tiles, and the one button.
 *
 * Two contracts are pinned. First, ADDITIVITY: with none of the new props the
 * picker is the picker it was, so the chat screen compiles and behaves
 * untouched. Second, what a screen reader is told — the tile label carries
 * the stage, the dots are hidden from it, each objective reads its state —
 * because that is invisible in a screenshot and silently lost in a refactor.
 * Layout is verified on device.
 */

import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { ui2Light } from '../../config/theme';
import { cefrLabel } from '../../lib/cefr-labels';
import { SCENARIO_META, type ScenarioKey } from '../../types/scenarios';
import {
  ScenarioPicker,
  bestAccuracyLine,
  dotStyle,
  orderPickerScenarios,
  tileAccessibilityLabel,
  type PickerMissionState,
  type PickerScenario,
} from './ScenarioPicker';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

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

// `useMotion` reads AccessibilityInfo asynchronously and sets state after the
// render — an act() warning on every test and nothing under assertion. Motion
// is left ON so the dots' entering animation path is the one exercised.
jest.mock('../../hooks/useMotion', () => ({
  useMotion: () => ({
    shouldReduce: false,
    duration: { instant: 100, micro: 150, short: 200, medium: 300, long: 450, celebration: 600 },
    easing: {},
    durationOr0: () => 0,
  }),
}));

// Reanimated has no worklet runtime under the test renderer. A shared value is
// a plain box, an animated style is its factory evaluated once, a spring
// settles instantly, and an entering animation is an inert token.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withSpring: (to: number) => to,
    FadeIn: { duration: () => ({}) },
  };
});

// The tab bar module pulls in a gradient and the immersive hook; the picker
// only needs its clearance number.
jest.mock('../navigation/FloatingTabBar', () => ({ floatingTabBarSpace: () => 96 }));

const ORDER: ScenarioKey[] = [
  'restaurant', 'job_interview', 'directions', 'shopping',
  'making_friends', 'doctor', 'phone_call', 'airport_hotel', 'free_chat',
];
const SCENARIOS: PickerScenario[] = ORDER.map((key) => ({
  key,
  label: SCENARIO_META[key].label,
  description: SCENARIO_META[key].description,
  icon: SCENARIO_META[key].icon,
}));

const state = (over: Partial<PickerMissionState>): PickerMissionState => ({
  dots: ['current', 'locked', 'locked', 'locked'],
  cta: 'start',
  stage: 1,
  mission: { stage: 1, band: 'A1', title: 'A table and a drink', objectives: [
    { id: 'greet_table', text: 'Greet the server and ask for a table' },
    { id: 'order_drink', text: 'Order a drink' },
    { id: 'ask_price', text: 'Ask how much something costs' },
  ] },
  objectivesMet: [],
  bestAccuracy: null,
  ...over,
});

const baseProps = {
  scenarios: SCENARIOS,
  languageName: 'Spanish',
  levelLine: cefrLabel('A2'),
  levelBand: 'A2',
  levelAccessibilityLabel: 'Level A2.',
  resumable: new Set<string>(),
};

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

/** Host nodes only — a composite and the host it renders both carry the same props. */
function hosts(r: TestRenderer.ReactTestRenderer, predicate: (n: ReactTestInstance) => boolean) {
  return r.root.findAll((n) => typeof n.type === 'string' && predicate(n));
}

function pressableByLabel(r: TestRenderer.ReactTestRenderer, label: string): ReactTestInstance[] {
  return r.root.findAll(
    (n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function',
    { deep: true },
  );
}

function press(node: ReactTestInstance) {
  TestRenderer.act(() => {
    node.props.onPress();
  });
}

function texts(r: TestRenderer.ReactTestRenderer): string[] {
  return r.root
    .findAll((n) => String(n.type) === 'Text')
    .flatMap((n) => n.children.filter((ch): ch is string => typeof ch === 'string'));
}

/** The dot containers: hidden from VoiceOver, one per tile that has loaded dots. */
function dotRows(r: TestRenderer.ReactTestRenderer) {
  return hosts(r, (n) => n.props?.importantForAccessibility === 'no-hide-descendants');
}

function tileLabels(r: TestRenderer.ReactTestRenderer): string[] {
  return hosts(r, (n) => n.props?.accessibilityRole === 'button' && typeof n.props?.accessibilityLabel === 'string')
    .map((n) => n.props.accessibilityLabel as string)
    .filter((l) => SCENARIOS.some((s) => l.startsWith(s.label)));
}

describe('without the mission props the picker is unchanged', () => {
  it('draws no dots, labels tiles plainly, and Continue calls onStart with the scene', () => {
    const onStart = jest.fn();
    const r = render(<ScenarioPicker {...baseProps} onStart={onStart} />);

    expect(dotRows(r)).toHaveLength(0);
    expect(tileLabels(r)[0]).toBe('Ordering at a Restaurant');

    press(pressableByLabel(r, 'Ordering at a Restaurant')[0]);
    expect(texts(r)).toContain(SCENARIO_META.restaurant.description);
    expect(texts(r)).toContain('A new conversation.');

    press(pressableByLabel(r, 'Continue')[0]);
    expect(onStart).toHaveBeenCalledWith(SCENARIOS[0]);
  });
});

describe('with missions', () => {
  it('the tile label carries the stage and the dots are shape-coded and hidden from VoiceOver', () => {
    const missions = new Map([['restaurant', state({ dots: ['done', 'current', 'locked', 'locked'], stage: 2 })]]);
    const r = render(<ScenarioPicker {...baseProps} onStart={jest.fn()} missions={missions} />);

    expect(tileLabels(r)[0]).toBe('Ordering at a Restaurant. Mission 2 of 4.');
    // Only the one scene with an entry has dots; the others are as they were.
    const rows = dotRows(r);
    expect(rows).toHaveLength(1);
    expect(rows[0].props.accessibilityElementsHidden).toBe(true);
    const widths = rows[0].children
      .filter((ch): ch is ReactTestInstance => typeof ch !== 'string')
      .map((dot) => (StyleSheet.flatten(dot.props.style) as { borderWidth: number }).borderWidth);
    expect(widths).toEqual([0, 2, 1, 1]);
  });

  it('the sheet lists the mission, its can-do band, the objectives with met ones ticked, and resumes', () => {
    const onMissionStart = jest.fn();
    const onStart = jest.fn();
    const missions = new Map([
      ['restaurant', state({ cta: 'resume', stage: 1, objectivesMet: ['greet_table'], bestAccuracy: 0.815 })],
    ]);
    const r = render(
      <ScenarioPicker {...baseProps} onStart={onStart} missions={missions} onMissionStart={onMissionStart} />,
    );

    press(pressableByLabel(r, 'Ordering at a Restaurant. Mission 1 of 4.')[0]);
    const shown = texts(r);
    expect(shown).toContain('Mission 1 of 4');
    expect(shown).toContain('A table and a drink');
    expect(shown).toContain(cefrLabel('A1'));
    expect(shown).not.toContain(SCENARIO_META.restaurant.description);
    expect(shown).toContain('Best so far: 82% accuracy');
    expect(shown).toContain('You have done 1 of 3 objectives. Pick up where you left off.');

    const rows = hosts(r, (n) => typeof n.props?.accessibilityLabel === 'string' && /^(Done|To do)\. /.test(n.props.accessibilityLabel));
    expect(rows.map((n) => n.props.accessibilityLabel)).toEqual([
      'Done. Greet the server and ask for a table',
      'To do. Order a drink',
      'To do. Ask how much something costs',
    ]);
    const glyphs = r.root.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name as string);
    expect(glyphs.filter((g) => g === 'checkmark-circle')).toHaveLength(1);
    expect(glyphs.filter((g) => g === 'ellipse-outline')).toHaveLength(2);

    press(pressableByLabel(r, 'Continue mission 1')[0]);
    expect(onMissionStart).toHaveBeenCalledWith('restaurant', 'resume', 1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('ladder done: the tile says so and the button replays mission 4', () => {
    const missions = new Map([
      ['restaurant', state({ dots: ['done', 'done', 'done', 'done'], cta: 'replay', stage: null })],
    ]);
    const r = render(<ScenarioPicker {...baseProps} onStart={jest.fn()} missions={missions} />);
    expect(tileLabels(r)[0]).toBe('Ordering at a Restaurant. All missions passed.');
    press(pressableByLabel(r, 'Ordering at a Restaurant. All missions passed.')[0]);
    expect(texts(r)).toContain('All missions passed');
    expect(pressableByLabel(r, 'Play mission 4 again')).toHaveLength(1);
  });

  it('unpaid: the one button says See plans and hands the cta to the integrator', () => {
    const onMissionStart = jest.fn();
    const missions = new Map([['restaurant', state({ cta: 'plans' })]]);
    const r = render(<ScenarioPicker {...baseProps} onStart={jest.fn()} missions={missions} onMissionStart={onMissionStart} />);
    press(pressableByLabel(r, 'Ordering at a Restaurant. Mission 1 of 4.')[0]);
    press(pressableByLabel(r, 'See plans')[0]);
    expect(onMissionStart).toHaveBeenCalledWith('restaurant', 'plans', 1);
  });

  it('while loading there are no dots, but the sheet still shows the mission with a live button', () => {
    const missions = new Map([['restaurant', state({ dots: null })]]);
    const r = render(<ScenarioPicker {...baseProps} onStart={jest.fn()} missions={missions} />);
    expect(dotRows(r)).toHaveLength(0);
    expect(tileLabels(r)[0]).toBe('Ordering at a Restaurant');
    press(pressableByLabel(r, 'Ordering at a Restaurant')[0]);
    const button = pressableByLabel(r, 'Start mission 1')[0];
    expect(button).toBeDefined();
    expect(button.props.accessibilityState?.disabled).toBe(false);
  });

  it('falls back to onStart when no onMissionStart is given, and Free Chat keeps its sheet', () => {
    const onStart = jest.fn();
    const missions = new Map([['restaurant', state({})]]);
    const r = render(<ScenarioPicker {...baseProps} onStart={onStart} missions={missions} />);
    press(pressableByLabel(r, 'Ordering at a Restaurant. Mission 1 of 4.')[0]);
    press(pressableByLabel(r, 'Start mission 1')[0]);
    expect(onStart).toHaveBeenCalledWith(SCENARIOS[0]);

    press(pressableByLabel(r, 'Free Chat')[0]);
    expect(texts(r)).toContain(SCENARIO_META.free_chat.description);
    expect(pressableByLabel(r, 'Continue')).toHaveLength(1);
  });

  it('a failed progress read shows an inline error with retry and leaves the tiles tappable', () => {
    const onRetryMissions = jest.fn();
    const r = render(
      <ScenarioPicker
        {...baseProps}
        onStart={jest.fn()}
        missionsError="We couldn't load your mission progress."
        onRetryMissions={onRetryMissions}
      />,
    );
    expect(texts(r)).toContain("We couldn't load your mission progress.");
    press(pressableByLabel(r, 'Try again')[0]);
    expect(onRetryMissions).toHaveBeenCalledTimes(1);

    press(pressableByLabel(r, 'Ordering at a Restaurant')[0]);
    expect(pressableByLabel(r, 'Continue')).toHaveLength(1);
  });

  it('goal scenes lead the grid and Free Chat stays last', () => {
    const r = render(<ScenarioPicker {...baseProps} onStart={jest.fn()} goalScenes={['doctor', 'phone_call']} />);
    const labels = tileLabels(r);
    expect(labels.slice(0, 3)).toEqual([
      SCENARIO_META.doctor.label,
      SCENARIO_META.phone_call.label,
      SCENARIO_META.restaurant.label,
    ]);
    expect(labels[labels.length - 1]).toBe(SCENARIO_META.free_chat.label);
  });
});

describe('pure helpers', () => {
  it('dotStyle: shape carries the state — fill, 2px ring, 1px ring', () => {
    expect(dotStyle('done', ui2Light)).toEqual({ backgroundColor: ui2Light.primary, borderColor: ui2Light.primary, borderWidth: 0 });
    expect(dotStyle('current', ui2Light)).toMatchObject({ borderColor: ui2Light.primary, borderWidth: 2 });
    expect(dotStyle('locked', ui2Light)).toMatchObject({ borderColor: ui2Light.idle, borderWidth: 1 });
  });

  it('tileAccessibilityLabel: nothing while loading, the stage once loaded, done at the top', () => {
    expect(tileAccessibilityLabel('Shopping', undefined)).toBe('Shopping');
    expect(tileAccessibilityLabel('Shopping', state({ dots: null }))).toBe('Shopping');
    expect(tileAccessibilityLabel('Shopping', state({ stage: 3 }))).toBe('Shopping. Mission 3 of 4.');
    expect(tileAccessibilityLabel('Shopping', state({ stage: null, cta: 'replay' }))).toBe('Shopping. All missions passed.');
  });

  it('bestAccuracyLine clamps and rounds', () => {
    expect(bestAccuracyLine(0.815)).toBe('Best so far: 82% accuracy');
    expect(bestAccuracyLine(1.4)).toBe('Best so far: 100% accuracy');
  });

  it('orderPickerScenarios keeps a keyless scene in place among the unranked', () => {
    const custom: PickerScenario = { key: null, label: 'Bank visit', description: '', icon: 'card' };
    const ordered = orderPickerScenarios([SCENARIOS[8], custom, SCENARIOS[0], SCENARIOS[5]], ['doctor']);
    expect(ordered.map((s) => s.label)).toEqual([
      SCENARIO_META.doctor.label, 'Bank visit', SCENARIO_META.restaurant.label, SCENARIO_META.free_chat.label,
    ]);
  });
});
