/**
 * One live call per provider, to prove the keys and the request shapes work
 * before anyone commits to a 18,000-item run.
 *
 *   npx tsx scripts/warm-caches/smoke-check.ts
 *
 * WRITES NOTHING. It never constructs a Supabase client, never touches a cache
 * table and never uploads to the bucket, so it cannot leave a half-warmed
 * state behind. It costs a fraction of a cent: one ~40-token Haiku completion
 * and one six-byte synthesis.
 *
 * This exists because `--execute` is the one path a dry run cannot exercise,
 * and "the API key was wrong" is a thing worth discovering on call one rather
 * than on call 4,000.
 */

import { validateContentSafety } from '../../supabase/functions/_shared/content-safety';
import { asCitationForm } from './keys';
import { fishCostUsd, formatUsd, haikuCostUsd, utf8Bytes } from './cost';
import { loadEnv, parseFishVoiceMap, requireSecret, secret } from './env';
import { lessonFishVoiceId } from './keys';
import { buildTranslateSystemPrompt } from './prompts';
import { callFish, callHaiku, MAX_TOKENS } from './providers';

async function main(): Promise<void> {
  loadEnv();
  console.log('Smoke check — one call per provider. Nothing is written anywhere.\n');

  const text = 'perro';

  const haiku = await callHaiku({
    apiKey: requireSecret('anthropicKey'),
    system: buildTranslateSystemPrompt('es', 'en'),
    userMessage: text,
    maxTokens: MAX_TOKENS.translation,
  });
  const safety = await validateContentSafety(haiku.text, { language: 'en', fn: 'translate' });
  console.log(`Anthropic  "${text}" (es→en) → ${JSON.stringify(haiku.text)}`);
  console.log(
    `           ${haiku.usage.inputTokens} in / ${haiku.usage.outputTokens} out = ` +
      `${formatUsd(haikuCostUsd(haiku.usage.inputTokens, haiku.usage.outputTokens))}, ` +
      `safety ${safety.safe ? 'pass' : `FAIL (${safety.reasons.join(', ')})`}`,
  );

  const voiceId = lessonFishVoiceId('es', parseFishVoiceMap(secret('fishVoiceMap')));
  if (!voiceId) {
    console.log('fish.audio  no es voice in FISH_VOICE_MAP — skipped.');
    return;
  }
  const sent = asCitationForm(text);
  const audio = await callFish({ apiKey: requireSecret('fishKey'), referenceId: voiceId, text: sent });
  console.log(`\nfish.audio ${JSON.stringify(sent)} → ${audio.byteLength} bytes of mp3`);
  console.log(
    `           billed on ${utf8Bytes(sent)} UTF-8 input bytes = ${formatUsd(fishCostUsd(utf8Bytes(sent)))}`,
  );
  console.log('\nBoth providers answered. The audio was discarded, not uploaded.');
}

main().catch((err: unknown) => {
  console.error(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
