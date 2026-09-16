import { conversationCefrBand, stretchBand } from './conversation-level';

describe('conversationCefrBand', () => {
  it('stretches one rung above the measured band', () => {
    // Not B1. A measured band is one the learner has already proved, so
    // holding the conversation there measures nothing new — and since this
    // function also stamps `conversation_evidence.cefr_level`, a learner whose
    // every turn was tagged at the band they already hold would accumulate no
    // evidence at all for the band above it and could never be promoted.
    expect(conversationCefrBand({ measuredBand: 'B1', placementBand: 'A2', level: 'beginner' })).toBe('B2');
  });

  it('does not stretch an unproven placement or declared level', () => {
    // Placement and declared levels have not been demonstrated, so taking them
    // at face value is already informative. Stretching one would pitch a new
    // learner's first conversation a rung above anything they have shown.
    expect(conversationCefrBand({ measuredBand: null, placementBand: 'B1', level: 'beginner' })).toBe('B1');
    expect(conversationCefrBand({ measuredBand: null, placementBand: null, level: 'intermediate' })).toBe('B1');
  });

  it('cannot stretch past the top of the ladder', () => {
    expect(conversationCefrBand({ measuredBand: 'C2', placementBand: null, level: 'advanced' })).toBe('C2');
    expect(stretchBand('C2')).toBe('C2');
    expect(stretchBand('A1')).toBe('A2');
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
