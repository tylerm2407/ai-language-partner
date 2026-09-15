// Deno tests for how ai-chat/index.ts decides the band a turn runs at.
//
// Run with: `deno test supabase/functions/ai-chat/band-resolution.test.ts`
//
// index.ts is source-parsed rather than imported, for the reason
// streaming-contract.test.ts gives: it calls serve() at module scope. The
// resolver itself is unit-tested in _shared/cefr.test.ts; what is locked here
// is that index.ts actually USES it, once, and threads the one result into
// every place that used to read the declared level — because the failure
// this guards against is a partial fix: a prompt pitched at the measured
// band while the evidence is still stamped with the declared one, or the
// other way round. Either half alone reintroduces the ceiling.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

const INDEX_SRC = await Deno.readTextFile(new URL('./index.ts', import.meta.url));

function codeOnly(src: string): string {
  return src
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

const CODE = codeOnly(INDEX_SRC);

Deno.test('the request carries an optional cefrLevel and it is read off the body', () => {
  assert(CODE.includes('cefrLevel?: string;'), 'ChatRequest must declare cefrLevel');
  assert(CODE.includes('cefrLevel: rawCefrLevel,'), 'cefrLevel must be destructured from the body');
});

Deno.test('the band is resolved exactly once, through the shared resolver, with the declared level as fallback', () => {
  assert(
    CODE.includes('const cefrLevel = resolveCefrLevel(level, rawCefrLevel);'),
    'the band must come from resolveCefrLevel(level, rawCefrLevel)',
  );
  assertEquals(
    (CODE.match(/const cefrLevel = /g) ?? []).length,
    1,
    'cefrLevel must be assigned in one place — a second assignment is how the two halves drift',
  );
  // The old direct mapping is gone from the request path. If it comes back,
  // some consumer is reading the declared level again.
  assert(!CODE.includes('proficiencyToCefr('), 'index.ts must not map the declared level directly');
});

Deno.test('the prompt and the level-keyed policy read the band, not the declared level', () => {
  assert(CODE.includes('const effectiveLevel = cefrToProficiency(cefrLevel);'));
  const start = CODE.indexOf('const systemPrompt = buildSystemPrompt(');
  assert(start !== -1);
  const args = CODE.slice(start, CODE.indexOf(');', start));
  assert(args.includes('effectiveLevel'), 'buildSystemPrompt must be handed the band-derived level');
  assert(!/\n\s+level,\n/.test(args), 'buildSystemPrompt must not be handed the declared level');
  assert(CODE.includes('level: effectiveLevel,'), 'TurnContext.level must be band-derived');
});

Deno.test('both transports validate against, and stamp evidence with, the same band', () => {
  // Safety pipeline: the streaming response and generateValidated.
  assertEquals((CODE.match(/targetLevel: cefrLevel,/g) ?? []).length, 2);
  // Evidence: the fallback path on the stream and finalizeTurn on both.
  assert(CODE.includes('cefrLevel: turnContext.cefrLevel,'));
  assert(CODE.includes('cefrLevel: ctx.cefrLevel,'));
  // And the push governor reads the same band it will be pitched at.
  const push = CODE.indexOf('selectPushStance(await fetchPushSignal(supabase, {');
  assert(push !== -1);
  assert(CODE.slice(push, push + 200).includes('cefrLevel,'));
});
