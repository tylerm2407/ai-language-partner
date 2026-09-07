import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { MODE_CONTROL, CLOSING_CUE } from './instructions.ts';

/**
 * The control tokens live on BOTH sides of a network boundary, in two different
 * runtimes, and neither can import the other: the server bakes them into the
 * frozen Realtime instructions, and the React Native client sends them as
 * conversation items. A TypeScript type cannot span that gap and a shared
 * constant cannot either.
 *
 * So this test reads the client's source and compares the literals. It is a
 * crude mechanism and it earns its place: the two files disagreed once already.
 * The server said 'MODE:WRAP_UP' and the client sent 'CUE:WRAP_UP', which would
 * have meant the tutor silently never recognised the wrap-up cue — the audio
 * would simply stop at the budget instead of the tutor closing warmly, which is
 * exactly the failure the closing cue exists to prevent. Nothing would have
 * thrown, no test would have failed, and it would have looked like a model
 * behaviour problem rather than a mismatched string.
 */
const CLIENT_SOURCE = new URL('../../../lib/realtime-events.ts', import.meta.url);

async function clientConstant(name: string): Promise<string> {
  const source = await Deno.readTextFile(CLIENT_SOURCE);
  const match = source.match(new RegExp(`export const ${name} = '([^']+)'`));
  assert(match, `could not find "export const ${name}" in lib/realtime-events.ts`);
  return match[1];
}

Deno.test('the live-correction token matches the client', async () => {
  assertEquals(await clientConstant('MODE_CONTROL_LIVE'), MODE_CONTROL.as_you_go);
});

Deno.test('the listen-only token matches the client', async () => {
  assertEquals(await clientConstant('MODE_CONTROL_DEBRIEF'), MODE_CONTROL.let_me_talk);
});

Deno.test('the closing cue matches the client', async () => {
  // This is the one that was actually broken.
  assertEquals(await clientConstant('CLOSING_CUE'), CLOSING_CUE);
});

Deno.test('the three tokens are mutually distinct', async () => {
  // A collision would make a mode switch ambiguous to the model.
  const tokens = [MODE_CONTROL.as_you_go, MODE_CONTROL.let_me_talk, CLOSING_CUE];
  assertEquals(new Set(tokens).size, tokens.length);
});
