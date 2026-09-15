import { conversationCefrBand } from './conversation-level';

describe('conversationCefrBand', () => {
  it('prefers the measured band over everything', () => {
    expect(conversationCefrBand({ measuredBand: 'B1', placementBand: 'A2', level: 'beginner' })).toBe('B1');
  });

  it('falls back to the placement band when nothing is measured', () => {
    expect(conversationCefrBand({ measuredBand: null, placementBand: 'a2', level: 'advanced' })).toBe('A2');
  });

  it('falls back to the declared level when unplaced', () => {
    expect(conversationCefrBand({ measuredBand: null, placementBand: null, level: 'intermediate' })).toBe('B1');
    expect(conversationCefrBand({ measuredBand: undefined, placementBand: undefined, level: undefined })).toBe('A1');
  });

  it('ignores an unparseable placement band', () => {
    expect(conversationCefrBand({ measuredBand: null, placementBand: 'unknown', level: 'elementary' })).toBe('A2');
  });
});
