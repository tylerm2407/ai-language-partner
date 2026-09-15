import { completeWritingBlank, completeWritingFrame, writingBlankParts } from './writing-scaffolds';

test.each([
  ['My name is ___ and I live here.', 'Ada', 'My name is Ada and I live here.'],
  ['私は___に住んでいます。', '東京', '私は東京に住んでいます。'],
  ['我叫___。', '小王', '我叫小王。'],
  ["Je m'appelle ___.", 'Camille', "Je m'appelle Camille."],
])('fills the actual marker without losing suffixes: %s', (sentence, answer, expected) => {
  expect(completeWritingBlank({ sentence, blank_index: 999 }, answer)).toBe(expected);
});

test('an old explicit word index still works when there is no marker', () => {
  expect(completeWritingBlank({ sentence: 'I have two cats.', blank_index: 2 }, 'three')).toBe('I have three cats.');
});

test('blank display and submitted text use identical boundaries', () => {
  expect(writingBlankParts({ sentence: '我住在___。', blank_index: 0 })).toEqual({ before: '我住在', after: '。' });
});

test('frames preserve post-answer endings and literal dollar signs', () => {
  expect(completeWritingFrame('私の名前は___です。', 'さくら')).toBe('私の名前はさくらです。');
  expect(completeWritingFrame('The price is ___.', '$&')).toBe('The price is $&.');
  expect(completeWritingFrame('Me llamo', 'Ana.')).toBe('Me llamo Ana.');
});
