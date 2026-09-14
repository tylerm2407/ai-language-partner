/**
 * The ladder is the one decision in the explainer: which rung is the
 * learner's, and what colour each rung wears. Both are pure, so both are
 * asserted here; the sheet itself is checked on device. (The no-hex scan for
 * this file lives in ui2-primitives.test.tsx with the other primitives.)
 */
import { CEFR_LADDER } from '../../lib/cefr-proficiency';
import { CEFR_CAN_DO } from '../../lib/cefr-labels';
import { cefrLadderRows, cefrChipVariant } from './CefrExplainerSheet';

// Same three stand-ins as ui2-primitives.test.tsx: the sheet pulls in the
// icon font, the haptics module (which reaches native AsyncStorage) and the
// reanimated worklet runtime, none of which exist under jest.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
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

describe('cefrLadderRows', () => {
  it('lists every band in ladder order with its can-do line', () => {
    const rows = cefrLadderRows('B1');
    expect(rows.map((r) => r.band)).toEqual(CEFR_LADDER);
    for (const row of rows) {
      expect(row.canDo).toBe(CEFR_CAN_DO[row.band]);
      expect(row.name.length).toBeGreaterThan(0);
    }
  });

  it('marks exactly the learner rung, from a raw tag', () => {
    const current = cefrLadderRows(' b2 ').filter((r) => r.current);
    expect(current.map((r) => r.band)).toEqual(['B2']);
  });

  it('marks nothing when the band is missing or unreadable', () => {
    expect(cefrLadderRows(null).some((r) => r.current)).toBe(false);
    expect(cefrLadderRows('native').some((r) => r.current)).toBe(false);
  });
});

describe('cefrChipVariant', () => {
  it('climbs green to amber to pink, two rungs per tint', () => {
    expect(CEFR_LADDER.map(cefrChipVariant)).toEqual([
      'success', 'success', 'warning', 'warning', 'error', 'error',
    ]);
  });
});
