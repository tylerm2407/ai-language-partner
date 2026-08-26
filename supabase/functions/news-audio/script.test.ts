// Deno tests for the pure narration-script logic in ./script.ts.
//
// Run with: `deno test supabase/functions/news-audio/script.test.ts`
//
// The load-bearing assertion in this file is the 2,096-character case. That
// is the observed p100 across 2,262 production `daily_news` rows spanning
// 126 days, and the whole single-pass design rests on it staying inside one
// chunk. If that test ever fails, the splitter is live in production and the
// seam-gap caveat in ./synth.ts is now something listeners can hear.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  buildNarrationScript,
  didSplit,
  estimateDurationMs,
  MAX_NEWS_SCRIPT_CHARS,
  splitForSynthesis,
} from './script.ts';

Deno.test('buildNarrationScript: title, summary, then body, separated by a beat', () => {
  const script = buildNarrationScript({
    title: 'El tiempo cambia',
    summary: 'Hace frío. Llueve mucho.',
    content: 'Los meteorólogos dicen que la semana será húmeda.',
  });

  assertEquals(
    script,
    'El tiempo cambia.\n\nHace frío. Llueve mucho.\n\nLos meteorólogos dicen que la semana será húmeda.',
  );
  // Order matters: a listener has no headline to glance back at.
  assert(script.indexOf('El tiempo') < script.indexOf('Hace frío'));
  assert(script.indexOf('Hace frío') < script.indexOf('Los meteorólogos'));
});

Deno.test('buildNarrationScript: strips markdown emphasis', () => {
  const script = buildNarrationScript({
    title: '**Noticias** de hoy',
    summary: 'Un **gran** día.',
    content: 'El **presidente** habló.',
  });
  assertEquals(script.includes('*'), false);
  assert(script.includes('Noticias de hoy'));
});

Deno.test('buildNarrationScript: adds terminal punctuation only when missing', () => {
  assertEquals(
    buildNarrationScript({ title: 'Hola', summary: '', content: '' }),
    'Hola.',
  );
  // Already punctuated in any of the scripts we teach — no doubled stop.
  assertEquals(
    buildNarrationScript({ title: '¿Qué pasa?', summary: '', content: '' }),
    '¿Qué pasa?',
  );
  assertEquals(
    buildNarrationScript({ title: '今日のニュース。', summary: '', content: '' }),
    '今日のニュース。',
  );
});

Deno.test('buildNarrationScript: drops empty sections instead of emitting stray breaks', () => {
  const script = buildNarrationScript({
    title: 'Titular',
    summary: '   ',
    content: 'Cuerpo del texto.',
  });
  assertEquals(script, 'Titular.\n\nCuerpo del texto.');
  assertEquals(script.includes('\n\n\n'), false);
});

Deno.test('splitForSynthesis: the observed prod p100 (2,096 chars) is ONE chunk', () => {
  // This is the number the single-pass design was sized against.
  const script = 'a'.repeat(2096);
  assertEquals(script.length, 2096);
  const chunks = splitForSynthesis(script);
  assertEquals(chunks.length, 1);
  assertEquals(chunks[0], script);
  assertEquals(didSplit(chunks), false);
});

Deno.test('splitForSynthesis: a realistic 2,096-char ARTICLE is still one chunk', () => {
  // The same budget spent the way a real row spends it — the assembled
  // script is slightly longer than its source because of the added stops
  // and section breaks, and must still fit.
  const source = {
    title: 'T'.repeat(80),
    summary: 'S'.repeat(200),
    content: `${'C'.repeat(900)}\n\n${'D'.repeat(916)}`,
  };
  assertEquals(source.title.length + source.summary.length + source.content.length, 2098);
  const chunks = splitForSynthesis(buildNarrationScript(source));
  assertEquals(chunks.length, 1);
});

Deno.test('splitForSynthesis: exactly at the cap is one chunk; one over is two', () => {
  assertEquals(splitForSynthesis('x'.repeat(MAX_NEWS_SCRIPT_CHARS)).length, 1);
  const over = splitForSynthesis('x'.repeat(MAX_NEWS_SCRIPT_CHARS + 1));
  assert(over.length > 1);
  assertEquals(didSplit(over), true);
});

Deno.test('splitForSynthesis: never returns a chunk over the cap', () => {
  const paragraphs = Array.from({ length: 12 }, (_, i) => `${'w'.repeat(700)} ${i}.`);
  for (const chunk of splitForSynthesis(paragraphs.join('\n\n'))) {
    assert(chunk.length <= MAX_NEWS_SCRIPT_CHARS, `chunk was ${chunk.length}`);
    assert(chunk.trim().length > 0);
  }
});

Deno.test('splitForSynthesis: splits on paragraphs before sentences', () => {
  const a = `${'a'.repeat(1800)}.`;
  const b = `${'b'.repeat(1800)}.`;
  const chunks = splitForSynthesis(`${a}\n\n${b}`);
  assertEquals(chunks.length, 2);
  assertEquals(chunks[0], a);
  assertEquals(chunks[1], b);
});

Deno.test('splitForSynthesis: falls back to sentences, then to a hard cut', () => {
  // One paragraph, two long sentences — must break at the sentence.
  const sentences = `${'a'.repeat(2000)}. ${'b'.repeat(2000)}.`;
  const bySentence = splitForSynthesis(sentences);
  assertEquals(bySentence.length, 2);

  // One unbroken 7,000-character "sentence" — nothing to split on but
  // characters. Still must not exceed the cap or lose content.
  const brutal = splitForSynthesis('z'.repeat(7000));
  assertEquals(brutal.length, 3);
  assertEquals(brutal.join('').length, 7000);
  for (const chunk of brutal) assert(chunk.length <= MAX_NEWS_SCRIPT_CHARS);
});

Deno.test('splitForSynthesis: empty input yields no chunks, never an empty one', () => {
  assertEquals(splitForSynthesis(''), []);
  assertEquals(splitForSynthesis('   \n\n  '), []);
});

Deno.test('estimateDurationMs: CJK reads far slower per character than Latin', () => {
  const latin = estimateDurationMs('a'.repeat(140));
  const cjk = estimateDurationMs('日'.repeat(140));
  assertEquals(latin, 10_000); // 140 chars ÷ 14 chars/s
  assert(cjk > latin * 2, `expected CJK to be much slower, got ${cjk} vs ${latin}`);
});

Deno.test('estimateDurationMs: whitespace is free, empty is zero', () => {
  assertEquals(estimateDurationMs(''), 0);
  assertEquals(estimateDurationMs('   \n\n\t '), 0);
  assertEquals(estimateDurationMs('abcdefg hijklmn'), estimateDurationMs('abcdefghijklmn'));
});

Deno.test('estimateDurationMs: mixed script counts each class at its own rate', () => {
  // A Japanese article quoting an English name must not be scored at one
  // rate for the whole string.
  const mixed = estimateDurationMs(`${'日'.repeat(50)}${'a'.repeat(50)}`);
  const allCjk = estimateDurationMs('日'.repeat(100));
  const allLatin = estimateDurationMs('a'.repeat(100));
  assert(mixed < allCjk && mixed > allLatin);
});
