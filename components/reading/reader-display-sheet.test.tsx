/**
 * ReaderDisplaySheet — the accessibility contract and the one behaviour that
 * matters: every control writes the shared preference, and the sheet re-skins
 * under the warm palette it can switch on.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { ReaderDisplaySheet } from './ReaderDisplaySheet';
import { Ui2VariantProvider } from '../../hooks/useUi2Theme';
import { ui2Warm } from '../../config/theme';
import {
  getReadingPreferences,
  resetReadingPreferencesForTests,
  setReadingPreferences,
} from '../../lib/reading-preferences';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock('../../lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../../lib/haptics', () => ({ haptic: jest.fn() }));

function render(warm = false) {
  let tree!: TestRenderer.ReactTestRenderer;
  const sheet = <ReaderDisplaySheet visible onDismiss={jest.fn()} />;
  act(() => {
    tree = TestRenderer.create(warm ? <Ui2VariantProvider variant="warm">{sheet}</Ui2VariantProvider> : sheet);
  });
  return tree;
}

function pressable(tree: TestRenderer.ReactTestRenderer, label: string): ReactTestInstance {
  const nodes = tree.root
    .findAll((n) => n.props?.accessibilityLabel === label, { deep: true })
    .filter((n) => typeof n.props.onPress === 'function');
  expect(nodes.length).toBeGreaterThan(0);
  return nodes[0];
}

function press(node: ReactTestInstance) {
  act(() => {
    node.props.onPress();
  });
}

function checkedIn(tree: TestRenderer.ReactTestRenderer, role: string): string[] {
  return tree.root
    .findAll((n) => n.props?.accessibilityRole === role && n.props?.accessibilityState?.checked === true)
    .filter((n) => typeof n.props.onPress === 'function')
    .map((n) => n.props.accessibilityLabel as string);
}

beforeEach(() => {
  resetReadingPreferencesForTests();
});

describe('ReaderDisplaySheet', () => {
  it('exposes one checked radio per group and a switch for Night reading', () => {
    const tree = render();
    expect(checkedIn(tree, 'radio')).toEqual(['Normal', 'Sans font', 'Automatic brightness']);
    const night = pressable(tree, 'Night reading');
    expect(night.props.accessibilityRole).toBe('switch');
    expect(night.props.accessibilityState.checked).toBe(false);
  });

  it('writes every control to the shared preference', () => {
    const tree = render();
    press(pressable(tree, 'Larger text'));
    press(pressable(tree, 'Relaxed'));
    press(pressable(tree, 'Serif font'));
    press(pressable(tree, 'Brightness 40 percent'));
    press(pressable(tree, 'Night reading'));
    expect(getReadingPreferences()).toEqual({
      nightReading: true,
      fontSizeIndex: 2,
      lineSpacing: 'relaxed',
      font: 'serif',
      brightness: 0.4,
    });
    expect(checkedIn(tree, 'radio')).toEqual(['Relaxed', 'Serif font', 'Brightness 40 percent']);
  });

  it('disables the size step at either end', async () => {
    await act(async () => {
      await setReadingPreferences({ fontSizeIndex: 4 });
    });
    const tree = render();
    expect(pressable(tree, 'Larger text').props.accessibilityState.disabled).toBe(true);
    expect(pressable(tree, 'Smaller text').props.accessibilityState.disabled).toBe(false);
  });

  it('is adjustable to a screen reader, with the size in points', () => {
    const tree = render();
    const row = tree.root.find((n) => n.props?.accessibilityRole === 'adjustable');
    expect(row.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 1, text: '16 point' });
    act(() => {
      row.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    });
    expect(getReadingPreferences().fontSizeIndex).toBe(2);
  });

  it('re-skins under the warm palette it switches on', async () => {
    await act(async () => {
      await setReadingPreferences({ nightReading: true });
    });
    const tree = render(true);
    const style = pressable(tree, 'Night reading').props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.flat()) : style;
    expect(flat.backgroundColor).toBe(ui2Warm.primaryTint);
  });
});
