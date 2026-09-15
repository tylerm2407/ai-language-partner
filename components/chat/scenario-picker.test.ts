/**
 * The picker's pure parts: the tile tint rotation, the identity a saved
 * conversation is keyed on, and the resume line's two branches.
 */
// The component pulls SlabButton -> lib/haptics -> AsyncStorage, which has no
// native module under jest; these are the same mocks the other UI suites use.
import { questionForDay, resumeHint, scenarioIdentity, tileTone } from './ScenarioPicker';
import { paletteForScheme } from '../../hooks/useUi2Theme';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { setItem: jest.fn(async () => {}), getItem: jest.fn(async () => null), removeItem: jest.fn(async () => {}) },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const c = paletteForScheme('light');

describe('tileTone', () => {
  it('rotates through four tints and wraps', () => {
    expect(tileTone(0, c).bg).toBe(c.primaryTint);
    expect(tileTone(1, c).bg).toBe(c.greenTint);
    expect(tileTone(2, c).bg).toBe(c.yellowTint);
    expect(tileTone(3, c).bg).toBe(c.pinkTint);
    expect(tileTone(4, c)).toEqual(tileTone(0, c));
  });
});

describe('scenarioIdentity', () => {
  it('keys built-in scenes on their key and custom scenes on their label', () => {
    expect(scenarioIdentity({ key: 'restaurant', label: 'Ordering at a Restaurant' })).toBe('restaurant');
    expect(scenarioIdentity({ key: null, label: 'Bryant pilot: campus tour' })).toBe('Bryant pilot: campus tour');
  });
});

describe('questionForDay', () => {
  it('asks the same question all day and a different one the next', () => {
    const a = questionForDay(new Date(Date.UTC(2026, 8, 8, 9)));
    const b = questionForDay(new Date(Date.UTC(2026, 8, 8, 22)));
    const c2 = questionForDay(new Date(Date.UTC(2026, 8, 9, 9)));
    expect(a).toBe(b);
    expect(c2).not.toBe(a);
    expect(a.endsWith('?')).toBe(true);
  });
});

describe('resumeHint', () => {
  it('tells the learner whether a saved conversation resumes', () => {
    expect(resumeHint(true)).toContain('left off');
    expect(resumeHint(false)).toContain('new');
  });
});
