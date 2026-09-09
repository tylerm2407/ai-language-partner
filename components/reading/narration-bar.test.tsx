import { narrationStatus } from './NarrationBar';

// Chip -> lib/haptics reaches for the native AsyncStorage module.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { setItem: jest.fn(async () => {}), getItem: jest.fn(async () => null), removeItem: jest.fn(async () => {}) },
}));

describe('narrationStatus', () => {
  // The icon flips between play and pause; the words are what a screen
  // reader and a colour-blind learner actually get.
  it('names the state in words', () => {
    expect(narrationStatus(true, false, 3)).toBe('Reading page 3 aloud');
    expect(narrationStatus(true, true, 3)).toBe('Paused');
    expect(narrationStatus(false, false, 3)).toBe('Read this page aloud');
  });
});
