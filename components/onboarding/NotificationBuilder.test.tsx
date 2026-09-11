/**
 * NotificationBuilder — the contract Settings will depend on when it adopts
 * this component, asserted on the rendered tree rather than on the source.
 *
 * Three things are worth pinning and nothing else is:
 *
 *  1. ALL FOUR KINDS ARE THERE, in `NOTIFICATION_KINDS` order. A row that is
 *     silently missing is a preference the learner can never reach — and the
 *     scheduler in `hooks/useNotifications.ts` iterates the kinds, not the
 *     rows, so a dropped row would keep firing a reminder nobody can turn off.
 *
 *  2. A TOGGLE CHANGES ONE KIND AND NOTHING ELSE. The component is controlled,
 *     so every change is a whole new prefs object; the bug that shape invites
 *     is an `onChange` that rebuilds the object from defaults and quietly
 *     resets the other three rows.
 *
 *  3. A TIME PICK WRITES HOUR AND MINUTE TOGETHER. They come from one chip and
 *     must land as one patch — writing the hour and leaving yesterday's minute
 *     is how a 7:30 reminder becomes 8:30.
 *
 * The weekday ordering deserves its own assertion because it is the one place
 * two conventions meet: the chips read Mon-first, the stored values are
 * 1 = Sunday (expo-notifications' WEEKLY trigger).
 */
import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Switch, Text } from 'react-native';

import {
  NotificationBuilder,
  NOTIFICATION_ROWS,
  PICKER_HOURS,
  WEEKDAY_OPTIONS,
  formatClock,
  formatPrefTime,
} from './NotificationBuilder';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_KINDS,
  SUNDAY,
  type NotificationPrefs,
} from '../../lib/notification-prefs';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// `lib/haptics` reads a stored preference at import time, so the native
// AsyncStorage module is pulled in by Chip before any test body runs.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));

// `haptic` reaches expo-haptics, which has no native module under jest. Chip
// calls it on every press, so every interaction below goes through it.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

function render(prefs: NotificationPrefs, onChange = jest.fn()) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NotificationBuilder prefs={prefs} onChange={onChange} />);
  });
  return { tree, onChange };
}

/** Every string rendered anywhere in the tree, flattened. */
function texts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .flatMap((node) => node.props.children)
    .filter((child): child is string => typeof child === 'string');
}

/** The pressable whose accessibility label is exactly `label` (a Chip). */
function chip(tree: TestRenderer.ReactTestRenderer, label: string): ReactTestInstance {
  const match = tree.root
    .findAll((node) => node.props?.accessibilityLabel === label && !!node.props?.onPress)
    .at(0);
  if (!match) throw new Error(`no chip labelled "${label}"`);
  return match;
}

describe('the four rows', () => {
  it('renders one row per kind, in NOTIFICATION_KINDS order', () => {
    const { tree } = render(DEFAULT_NOTIFICATION_PREFS);
    expect(NOTIFICATION_ROWS.map((row) => row.kind)).toEqual([...NOTIFICATION_KINDS]);
    expect(tree.root.findAllByType(Switch)).toHaveLength(NOTIFICATION_KINDS.length);

    const rendered = texts(tree);
    for (const row of NOTIFICATION_ROWS) expect(rendered).toContain(row.title);
  });

  it('names the learner’s own daily goal in the first row', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NotificationBuilder
          prefs={DEFAULT_NOTIFICATION_PREFS}
          onChange={jest.fn()}
          dailyGoalMinutes={20}
        />,
      );
    });
    expect(texts(tree)).toContain('20 minutes · silent once you hit it');
  });

  it('says nothing is sent yet, and drops that note in compact mode', () => {
    const promise = 'Nothing is sent until you allow notifications after sign-up. No streaks, no guilt.';
    const { tree } = render(DEFAULT_NOTIFICATION_PREFS);
    expect(texts(tree)).toContain(promise);

    let compact!: TestRenderer.ReactTestRenderer;
    act(() => {
      compact = TestRenderer.create(
        <NotificationBuilder prefs={DEFAULT_NOTIFICATION_PREFS} onChange={jest.fn()} compact />,
      );
    });
    expect(texts(compact)).not.toContain(promise);
  });
});

describe('toggling', () => {
  it('reports the kind that changed and leaves the other three alone', () => {
    const { tree, onChange } = render(DEFAULT_NOTIFICATION_PREFS);
    // `weeklyRecap` is the one kind that ships OFF, so switching it on is a
    // real change rather than a re-assertion of the default.
    const index = NOTIFICATION_KINDS.indexOf('weeklyRecap');
    act(() => {
      tree.root.findAllByType(Switch)[index].props.onValueChange(true);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const next: NotificationPrefs = onChange.mock.calls[0][0];
    expect(next.weeklyRecap.enabled).toBe(true);
    expect(next.dailyGoal).toEqual(DEFAULT_NOTIFICATION_PREFS.dailyGoal);
    expect(next.reviewsDue).toEqual(DEFAULT_NOTIFICATION_PREFS.reviewsDue);
    expect(next.idealMoment).toEqual(DEFAULT_NOTIFICATION_PREFS.idealMoment);
  });

  it('keeps the row’s time when it is switched off', () => {
    const { tree, onChange } = render(DEFAULT_NOTIFICATION_PREFS);
    act(() => {
      tree.root.findAllByType(Switch)[0].props.onValueChange(false);
    });

    const next: NotificationPrefs = onChange.mock.calls[0][0];
    expect(next.dailyGoal.enabled).toBe(false);
    expect(next.dailyGoal.hour).toBe(DEFAULT_NOTIFICATION_PREFS.dailyGoal.hour);
    expect(next.dailyGoal.minute).toBe(DEFAULT_NOTIFICATION_PREFS.dailyGoal.minute);
  });
});

describe('the time picker', () => {
  it('stays closed until the row’s time chip is tapped', () => {
    const { tree } = render(DEFAULT_NOTIFICATION_PREFS);
    // 6:00 am is in the picker and in none of the four default times.
    expect(() => chip(tree, formatClock(6, 0))).toThrow();

    act(() => {
      chip(tree, formatPrefTime('dailyGoal', DEFAULT_NOTIFICATION_PREFS.dailyGoal)).props.onPress();
    });
    expect(() => chip(tree, formatClock(6, 0))).not.toThrow();
  });

  it('writes hour and minute together', () => {
    const { tree, onChange } = render(DEFAULT_NOTIFICATION_PREFS);
    act(() => {
      chip(tree, formatPrefTime('dailyGoal', DEFAULT_NOTIFICATION_PREFS.dailyGoal)).props.onPress();
    });
    act(() => {
      chip(tree, formatClock(6, 30)).props.onPress();
    });

    const next: NotificationPrefs = onChange.mock.calls[0][0];
    expect(next.dailyGoal.hour).toBe(6);
    expect(next.dailyGoal.minute).toBe(30);
    expect(next.dailyGoal.enabled).toBe(DEFAULT_NOTIFICATION_PREFS.dailyGoal.enabled);
  });

  it('offers a weekday only for the weekly kinds, Mon first but 1 = Sunday', () => {
    const { tree, onChange } = render(DEFAULT_NOTIFICATION_PREFS);

    // The daily row's picker has no day chips at all.
    act(() => {
      chip(tree, formatPrefTime('dailyGoal', DEFAULT_NOTIFICATION_PREFS.dailyGoal)).props.onPress();
    });
    expect(() => chip(tree, 'Mon')).toThrow();

    // Both weekly kinds default to Sunday 18:00, so their chips carry the same
    // label; the first match is `idealMoment`, the earlier of the two rows.
    act(() => {
      chip(
        tree,
        formatPrefTime('idealMoment', DEFAULT_NOTIFICATION_PREFS.idealMoment),
      ).props.onPress();
    });
    act(() => {
      chip(tree, 'Mon').props.onPress();
    });

    const next: NotificationPrefs = onChange.mock.calls.at(-1)?.[0];
    // Monday is the FIRST chip and the value 2 — the display order and the
    // storage convention are different questions.
    expect(WEEKDAY_OPTIONS[0].label).toBe('Mon');
    expect(next.idealMoment.weekday).toBe(2);
    // …and the other weekly row keeps its own day.
    expect(next.weeklyRecap.weekday).toBe(SUNDAY);
    expect(WEEKDAY_OPTIONS.at(-1)).toEqual({ value: SUNDAY, label: 'Sun' });
  });
});

describe('formatting', () => {
  it('reads a 24-hour pref as a 12-hour clock', () => {
    expect(formatClock(6, 0)).toBe('6:00 am');
    expect(formatClock(12, 30)).toBe('12:30 pm');
    expect(formatClock(19, 0)).toBe('7:00 pm');
    // Midnight is not in the picker, but the helper must not print "0:00 am".
    expect(formatClock(0, 0)).toBe('12:00 am');
  });

  it('prefixes the weekday for weekly kinds only', () => {
    expect(formatPrefTime('dailyGoal', { enabled: true, hour: 8, minute: 30 })).toBe('8:30 am');
    expect(
      formatPrefTime('idealMoment', { enabled: true, hour: 18, minute: 0, weekday: SUNDAY }),
    ).toBe('Sun 6:00 pm');
  });

  it('offers no hour outside the picker list', () => {
    // A guard on the list itself: every entry has to be a real hour, or
    // `formatClock` prints something a learner cannot act on.
    for (const hour of PICKER_HOURS) {
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThan(24);
    }
  });
});
