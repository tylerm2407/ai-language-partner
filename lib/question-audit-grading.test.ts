import { gradeAnswer, normalize } from './grading';

describe('question audit: authored choices are not typing mistakes', () => {
  for (const exerciseType of ['multiple_choice', 'listening_choice'] as const) {
    it.each([
      ['To hire', 'To fire'], ['Formal', 'Informal'], ['Mother', 'Brother'],
      ['Grandfather', 'Grandmother'], ['Could', 'Would'],
    ])(`${exerciseType} rejects %s when the key is %s`, (answer, key) => {
      expect(gradeAnswer(answer, key, [], { exerciseHints: { exerciseType } }).isCorrect).toBe(false);
    });
    it(`${exerciseType} retains explicitly authored valid alternatives`, () => {
      expect(gradeAnswer('Good night', 'Good evening', ['Good night'], { exerciseHints: { exerciseType } }).isCorrect).toBe(true);
    });
  }

  it('retains the existing typo tolerance for typed answers', () => {
    expect(gradeAnswer('recieve', 'receive').isCorrect).toBe(true);
  });
});

describe('question audit: equivalent keyboard punctuation is not a language error', () => {
  it('normalizes typographic apostrophes even in strict grammar answers', () => {
    expect(gradeAnswer('J’ai fini.', "J'ai fini", [], { strict: true }).isCorrect).toBe(true);
  });
  it('normalizes canonically equivalent accented characters, not different accents', () => {
    expect(gradeAnswer('e\u0301tait', 'était', [], { strict: true }).isCorrect).toBe(true);
    expect(gradeAnswer('etait', 'était', [], { strict: true }).isCorrect).toBe(false);
  });
  it('treats Japanese/Chinese sentence-final punctuation like a full stop', () => {
    expect(normalize('私は学生です。')).toBe('私は学生です');
    expect(normalize('你好！')).toBe('你好');
  });
});

describe('question audit: numerical facts are not typing mistakes', () => {
  it.each([
    ['48.9°C', '48.8°C'], ['2046', '2045'], ['204', '2045'],
    ['I have 3 cats', 'I have 2 cats'], ['488°C', '48.8°C'], ['5 degrees', '-5 degrees'],
    ['−5 degrees', '5 degrees'], ['＋５ degrees', '−5 degrees'],
    ['We have １２ cats', 'We have １３ cats'], ['We have １２ cats', 'We have 13 cats'],
    ['1–3 hours', '1-2 hours'], ['-5–2 degrees', '-5--2 degrees'],
  ])('rejects %s when the numeric fact is %s', (answer, key) => {
    expect(gradeAnswer(answer, key).isCorrect).toBe(false);
  });
  it('retains an explicitly accepted numeric representation', () => {
    expect(gradeAnswer('1,000', '1000', ['1,000']).isCorrect).toBe(true);
  });
  it('retains decimal comma and decimal point tolerance in typed vocabulary', () => {
    expect(gradeAnswer('48,8°C', '48.8°C').isCorrect).toBe(true);
  });
  it('still permits a spelling typo when the numerical fact is unchanged', () => {
    expect(gradeAnswer('I have 2 ctas', 'I have 2 cats').isCorrect).toBe(true);
  });
  it.each([
    ['−5', '-5'], ['-5', '−5'], ['５', '5'], ['＋５', '+5'], ['－５', '-5'],
    ['+5', '5'], ['1–2', '1-2'], ['1 - 2', '1–2'],
    ['-5–-2 degrees', '-5--2 degrees'], ['１－２ hours', '1–2 hours'],
  ])('accepts equivalent numeric notation %s for %s without a typo penalty', (answer, key) => {
    expect(gradeAnswer(answer, key)).toMatchObject({ isCorrect: true, accuracy: 1 });
  });
  it('accepts the equivalent range typography in the frozen reading recommendation', () => {
    // Reading question b5c3ac55-779f-48c5-a85d-36558e223b52.
    expect(gradeAnswer(
      'Experts recommend using social media for 1–2 hours per day.',
      'Experts recommend using social media for 1-2 hours per day.',
    )).toMatchObject({ isCorrect: true, accuracy: 1 });
  });
  it('keeps strict and choice grading unchanged for numeric notation', () => {
    expect(gradeAnswer('−5', '-5', [], { strict: true }).isCorrect).toBe(false);
    expect(gradeAnswer('５', '5', [], { exerciseHints: { exerciseType: 'multiple_choice' } }).isCorrect).toBe(false);
    expect(gradeAnswer('５', '5', ['５'], { strict: true }).isCorrect).toBe(true);
  });
  it('does not compatibility-normalize surrounding language or global normalization', () => {
    expect(normalize('ＡＢＣ１２')).toBe('ａｂｃ１２');
    expect(gradeAnswer('ＡＢＣ 5', 'ABC 5').isCorrect).toBe(false);
  });
});
