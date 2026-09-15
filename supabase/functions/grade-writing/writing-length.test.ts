// Run with: deno test --allow-read --allow-env supabase/functions/grade-writing
import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { countWritingUnits, isSegmentedLanguage, normalizeLanguageCode } from './writing-length.ts';

// Segment counts are asserted as ranges: they come from the runtime's ICU
// dictionary and can drift between ICU versions. A sentence must be several
// units, never one whitespace chunk and never one unit per character.

Deno.test('Deno provides Intl.Segmenter, so the server count is authoritative', () => {
  assertEquals(typeof Intl.Segmenter, 'function');
});

Deno.test('whitespace words for spaced languages', () => {
  assertEquals(countWritingUnits('Me llamo Ana y vivo en Madrid.', 'es'), { count: 7, unit: 'word', method: 'whitespace' });
  assertEquals(countWritingUnits("  Je m'appelle   Camille.\n", 'fr').count, 3);
  assertEquals(countWritingUnits('', 'de').count, 0);
  assertEquals(countWritingUnits('저는 학생입니다.', 'ko').count, 2);
  assertEquals(isSegmentedLanguage('ko'), false);
});

Deno.test('我每天早上去学校 is several segments, not one chunk and not eight characters', () => {
  const result = countWritingUnits('我每天早上去学校', 'zh');
  assertEquals(result.unit, 'segment');
  assertEquals(result.method, 'intl_segmenter');
  assert(result.count >= 3 && result.count <= 6, `got ${result.count}`);
});

Deno.test('Chinese punctuation and spaces are not segments', () => {
  const plain = countWritingUnits('今天和朋友一起学习中文', 'zh');
  const punctuated = countWritingUnits('今天，和朋友一起学习中文。 ', 'zh');
  assert(plain.count >= 4, `got ${plain.count}`);
  assertEquals(punctuated.count, plain.count);
});

Deno.test('Japanese is counted in word segments and a whitespace count would be one', () => {
  const result = countWritingUnits('私は毎朝学校に行きます。', 'ja');
  assertEquals(result.method, 'intl_segmenter');
  assert(result.count >= 4 && result.count <= 9, `got ${result.count}`);
  assertEquals(countWritingUnits('私は毎朝学校に行きます。', 'es').count, 1);
});

Deno.test('without Intl.Segmenter ja/zh report unavailable with a character count', () => {
  const original = Intl.Segmenter;
  Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true, writable: true });
  try {
    assertEquals(countWritingUnits('我每天早上去学校。', 'zh'), { count: 8, unit: 'character', method: 'unavailable' });
    assertEquals(countWritingUnits('uno dos tres', 'es').method, 'whitespace');
  } finally {
    Object.defineProperty(Intl, 'Segmenter', { value: original, configurable: true, writable: true });
  }
  assertEquals(countWritingUnits('我每天早上去学校', 'zh').method, 'intl_segmenter');
});

Deno.test('language codes are normalised to their primary subtag', () => {
  const plain = countWritingUnits('我每天早上去学校', 'zh');
  for (const code of ['zh-CN', 'zh_Hans_CN', 'ZH', ' zh-Hant ']) {
    assertEquals(isSegmentedLanguage(code), true, code);
    const result = countWritingUnits('我每天早上去学校', code);
    assertEquals(result.method, 'intl_segmenter', code);
    // The bug this closes: an unnormalised code counted the sentence as 1.
    assertEquals(result.count, plain.count, code);
    assert(result.count > 1, `${code} gave ${result.count}`);
  }
  for (const code of ['JA', 'ja-JP']) {
    assertEquals(countWritingUnits('私は毎朝学校に行きます。', code).method, 'intl_segmenter', code);
  }
  assertEquals(countWritingUnits('uno dos tres', 'es-MX'), { count: 3, unit: 'word', method: 'whitespace' });
  for (const junk of ['', '   ', 'jap', 'constructor']) {
    assertEquals(isSegmentedLanguage(junk), false, junk);
  }
  assertEquals(normalizeLanguageCode('zh-Hans-CN'), 'zh');
  assertEquals(normalizeLanguageCode('  PT_BR '), 'pt');
  assertEquals(normalizeLanguageCode(''), null);
  assertEquals(normalizeLanguageCode('-'), null);
  assertEquals(normalizeLanguageCode(null), null);
});

// The client and the server keep separate copies of this module because the
// edge function cannot import from lib/. A comment asking the next editor to
// keep them identical guarantees nothing, so the contract is asserted here and
// in the jest suite beside the client copy: everything below the header comment
// must match byte for byte, so a one-sided edit fails whichever suite runs.
function bodyAfterHeader(source: string, label: string): string {
  const normalised = source.replace(/\r\n/g, '\n');
  const headerEnd = normalised.indexOf('*/');
  if (headerEnd === -1) throw new Error(`${label} has no header comment block`);
  return normalised.slice(headerEnd + 2).trim();
}

Deno.test('the client and server copies of writing-length have not drifted', async () => {
  const serverPath = new URL('./writing-length.ts', import.meta.url);
  const clientPath = new URL('../../../lib/writing-length.ts', import.meta.url);
  const server = await Deno.readTextFile(serverPath);
  const client = await Deno.readTextFile(clientPath);
  assertEquals(
    bodyAfterHeader(server, 'supabase/functions/grade-writing/writing-length.ts'),
    bodyAfterHeader(client, 'lib/writing-length.ts'),
  );
  assert(server.includes('TWIN: lib/writing-length.ts'), 'server header lost its TWIN pointer');
  assert(
    client.includes('TWIN: supabase/functions/grade-writing/writing-length.ts'),
    'client header lost its TWIN pointer',
  );
});
