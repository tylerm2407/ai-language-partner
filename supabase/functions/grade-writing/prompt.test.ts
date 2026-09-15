import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { buildGradingPrompt, getCefrExpectations, getLanguageSpecificRules, languageName, lengthInstruction } from './prompt.ts';
import { countWritingUnits } from './writing-length.ts';

Deno.test('a Japanese task is measured in word segments, not characters or whitespace chunks', () => {
  const submissionLength = countWritingUnits('私は毎朝学校に行きます。', 'ja');
  const text = buildGradingPrompt({ targetLanguage: 'ja', cefrLevel: 'A2', promptText: '毎日の生活について書いてください。', minWords: 5, maxWords: 40, submissionLength });
  assertStringIncludes(text, '"unit":"segment"');
  assertStringIncludes(text, '"method":"intl_segmenter"');
  assertStringIncludes(text, `submission_length is ${submissionLength.count} dictionary word segments`);
  assertStringIncludes(text, 'never in characters and never in whitespace-separated chunks');
  assertStringIncludes(text, '"min_words":5');
});

Deno.test('a Chinese count from the server is what the grader sees', () => {
  const submissionLength = countWritingUnits('我每天早上去学校。', 'zh');
  const text = buildGradingPrompt({ targetLanguage: 'zh', cefrLevel: 'A1', promptText: '介绍你的一天。', submissionLength });
  assertStringIncludes(text, `"submission_length":{"count":${submissionLength.count},"unit":"segment","method":"intl_segmenter"}`);
  assert(submissionLength.count >= 3 && submissionLength.count <= 6);
});

Deno.test('a spaced language keeps whitespace words and says so', () => {
  const text = buildGradingPrompt({ targetLanguage: 'fr', cefrLevel: 'B1', promptText: 'Describe a trip.', minWords: 80, maxWords: 150, submissionLength: countWritingUnits('Je suis allé à Paris.', 'fr') });
  assertStringIncludes(text, '"submission_length":{"count":5,"unit":"word","method":"whitespace"}');
  assertStringIncludes(text, 'submission_length is 5 whitespace-separated words');
});

Deno.test('an unavailable segmentation is never presented as a word count', () => {
  const text = lengthInstruction({ count: 12, unit: 'character', method: 'unavailable' });
  assertStringIncludes(text, 'character count only (12 characters)');
  assertStringIncludes(text, 'never in characters');
  assertStringIncludes(lengthInstruction(null), 'No mechanical length count is available');
  assertStringIncludes(buildGradingPrompt({ targetLanguage: 'es', cefrLevel: 'A1', promptText: 'Hola.' }), '"submission_length":null');
});

Deno.test('writing grading recognizes all nine course language codes', () => {
  const names = { es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ru: 'Russian' };
  for (const [code, name] of Object.entries(names)) {
    assertEquals(languageName(code), name);
    assertEquals(getLanguageSpecificRules(code), getLanguageSpecificRules(name));
    assertStringIncludes(getLanguageSpecificRules(code), `(${name})`);
  }
});

Deno.test('CEFR descriptors do not invent universal task lengths or native perfection', () => {
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    const text = getCefrExpectations(level);
    assert(!text.includes('Expected length:'));
    assert(!/\d+\s*words/.test(text));
    assert(!text.includes('Flawless grammar'));
    assert(!text.includes('Near-native accuracy'));
  }
});

Deno.test('a B1 task keeps its actual 80–150-word bounds', () => {
  const text = buildGradingPrompt({ targetLanguage: 'fr', cefrLevel: 'B1', promptText: 'Describe a trip.', minWords: 80, maxWords: 150 });
  assertStringIncludes(text, '"min_words":80');
  assertStringIncludes(text, '"max_words":150');
  assertStringIncludes(text, 'French');
  assert(!text.includes('150-300'));
  assertStringIncludes(text, 'fluent answer to a different topic is not full task completion');
});

Deno.test('a scaffolded blank is not graded as an independent essay', () => {
  const text = buildGradingPrompt({ targetLanguage: 'es', cefrLevel: 'A1', promptText: 'Introduce yourself.', scaffoldType: 'fill_blank', scaffoldData: { sentence: 'Me llamo ___.' }, maxWords: 20 });
  assertStringIncludes(text, '"min_words":null');
  assertStringIncludes(text, 'Me llamo ___.');
  assertStringIncludes(text, 'Assess the learner’s additions');
  assertStringIncludes(text, 'does not require an essay');
});

Deno.test('examples and hints do not silently become unique required answers', () => {
  const text = buildGradingPrompt({ targetLanguage: 'pt', cefrLevel: 'A2', promptText: 'Describe your family.', exampleResponse: 'A minha família é pequena.', targetVocabulary: ['família'] });
  assertStringIncludes(text, 'not the only correct answer');
  assertStringIncludes(text, 'suggestions unless the instruction explicitly requires them');
  assertStringIncludes(text, 'Accept standard Brazilian and European variants');
});
