/**
 * The level card's eyebrow — three states, none of which may show a number
 * the report has not produced.
 */
// HomeSections pulls lib/haptics -> AsyncStorage, which has no native module
// under jest; this is the same mock the other UI suites use.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { setItem: jest.fn(async () => {}), getItem: jest.fn(async () => null), removeItem: jest.fn(async () => {}) },
}));

import { levelEyebrow } from './HomeSections';

describe('levelEyebrow', () => {
  it('says only "Level" until the report has loaded', () => {
    expect(levelEyebrow('B1', null)).toBe('Level');
    expect(levelEyebrow(null, null)).toBe('Level');
  });

  it('names the next band and the percentage once known', () => {
    expect(levelEyebrow('B1', 62)).toBe('62% to B1');
    expect(levelEyebrow('A2', 0)).toBe('0% to A2');
  });

  it('says top band at C2 instead of a percentage', () => {
    expect(levelEyebrow(null, 100)).toBe('Top band');
  });
});
