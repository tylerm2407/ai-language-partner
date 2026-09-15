/**
 * The level card's eyebrow — four states, none of which may show a number
 * the report has not produced, and none of which may name the same band as
 * both held and being proved.
 */
// HomeSections pulls lib/haptics -> AsyncStorage, which has no native module
// under jest; this is the same mock the other UI suites use.
import { levelEyebrow } from './HomeSections';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { setItem: jest.fn(async () => {}), getItem: jest.fn(async () => null), removeItem: jest.fn(async () => {}) },
}));

describe('levelEyebrow', () => {
  it('says only "Level" until the report has loaded', () => {
    expect(levelEyebrow('B1', null, true)).toBe('Level');
    expect(levelEyebrow(null, null, false)).toBe('Level');
  });

  it('names the next band and the percentage once measured', () => {
    expect(levelEyebrow('B1', 62, true)).toBe('62% to B1');
    expect(levelEyebrow('A2', 0, true)).toBe('0% to A2');
  });

  it('says the band is being proved while nothing is measured', () => {
    // A placed-A2 learner: the ring counts work toward proving A2, and the
    // eyebrow must not read "15% to A2" under an "A2" that is only a placement.
    expect(levelEyebrow('A2', 15, false)).toBe('Proving A2 · 15%');
  });

  it('says top band at C2 instead of a percentage', () => {
    expect(levelEyebrow(null, 100, true)).toBe('Top band');
  });
});
