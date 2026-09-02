/**
 * Pre-generate the AI content that is identical for every learner.
 *
 *   npx tsx scripts/warm-shared-caches.ts                 # DRY RUN — prints a plan, spends nothing
 *   npx tsx scripts/warm-shared-caches.ts --execute       # actually generates and writes
 *   npx tsx scripts/warm-shared-caches.ts --only tts --limit 20 --execute
 *
 * Before the first real run, `npx tsx scripts/warm-caches/smoke-check.ts`
 * makes one call to each provider and writes nothing — it proves the keys and
 * the request shapes work for a fraction of a cent.
 *
 * WHY THIS EXISTS
 * ---------------
 * Four of the app's paid surfaces are keyed on fixed curriculum, not on the
 * learner: the translation of a vocabulary word, the hint for a card, the
 * audio of a lesson prompt, and the explanation of a published passage. All
 * four already have shared, content-addressed caches — and all four are cold,
 * so the cost is currently paid again by every learner who reaches them, every
 * month. Warming them converts a recurring per-user bill into a one-time one
 * measured in single-digit dollars.
 *
 * DRY RUN IS THE DEFAULT, and that is load-bearing rather than polite. The
 * script's whole job is to spend money in bulk; the only version of it that is
 * safe to leave lying around in a repo is one that has to be told, explicitly,
 * to do so. Without `--execute` it makes zero provider calls.
 *
 * RE-RUNNABLE BY DESIGN. Every item is skipped if its key is already cached,
 * so this is safe to run after new curriculum lands (it warms only the new
 * rows) and safe to re-run after a crash (everything already generated is
 * durable). It should be re-run periodically for a second reason: the
 * translation and explanation caches carry a 90-day expiry refreshed on use
 * (supabase/functions/_shared/cache-retention.ts), so a warmed row that no
 * learner reaches within 90 days is swept — cheap to lose, cheap to redo.
 *
 * Keys come from the edge functions themselves (see warm-caches/keys.ts); a
 * key that drifted by one byte would write rows nothing could ever read, with
 * no error anywhere to say so.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { validateContentSafety } from '../supabase/functions/_shared/content-safety';
import { cacheExpiryIso } from '../supabase/functions/_shared/cache-retention';
import { buildExplainSystemPrompt, DEFAULT_RATE, SLOW_RATE } from './warm-caches/keys';
import { CostLedger, formatUsd } from './warm-caches/cost';
import {
  ALL_CACHES,
  dedupeAndSkip,
  planExplanations,
  planHints,
  planTranslations,
  planTts,
  type CacheName,
  type ExplanationItem,
  type HintItem,
  type TranslationItem,
  type TtsItem,
} from './warm-caches/plan';
import { describeSecrets, loadEnv, parseFishVoiceMap, requireSecret, secret } from './warm-caches/env';
import {
  estimateHaiku,
  printUsage,
  reportPlan,
  TYPICAL_OUTPUT_TOKENS,
  warnAboutClonedPassages,
} from './warm-caches/report';
import { buildHintUserMessage, buildTranslateSystemPrompt, HINT_SYSTEM_PROMPT } from './warm-caches/prompts';
import { callFish, callHaiku, mapWithConcurrency, MAX_TOKENS, withRetry } from './warm-caches/providers';
import {
  existingExplanationKeys,
  existingHintKeys,
  existingTranslationKeys,
  existingTtsPaths,
  fetchAudioPrompts,
  fetchCurriculumCards,
  fetchHintTargets,
  fetchPassageParagraphs,
  getServiceClient,
  TTS_BUCKET,
} from './warm-caches/sources';

// ─── Arguments ───────────────────────────────────────────────────────────

interface Options {
  execute: boolean;
  caches: CacheName[];
  nativeLanguage: string;
  concurrency: number;
  limit: number | null;
  includeSlow: boolean;
  samples: number;
}

function parseArgs(argv: readonly string[]): Options {
  const opts: Options = {
    execute: false,
    caches: [...ALL_CACHES],
    nativeLanguage: 'en',
    concurrency: 4,
    limit: null,
    includeSlow: false,
    samples: 5,
  };

  const value = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`${flag} needs a value`);
    return v;
  };
  const asCaches = (raw: string): CacheName[] =>
    raw.split(',').map((s) => {
      const name = s.trim() as CacheName;
      if (!ALL_CACHES.includes(name)) {
        throw new Error(`Unknown cache "${name}". Known: ${ALL_CACHES.join(', ')}`);
      }
      return name;
    });

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--execute': opts.execute = true; break;
      case '--include-slow': opts.includeSlow = true; break;
      case '--only': opts.caches = asCaches(value(i, arg)); i++; break;
      case '--skip': {
        const drop = new Set(asCaches(value(i, arg)));
        opts.caches = opts.caches.filter((c) => !drop.has(c));
        i++;
        break;
      }
      case '--native': opts.nativeLanguage = value(i, arg); i++; break;
      case '--concurrency': opts.concurrency = Math.max(1, Number(value(i, arg))); i++; break;
      case '--limit': opts.limit = Math.max(1, Number(value(i, arg))); i++; break;
      case '--samples': opts.samples = Math.max(0, Number(value(i, arg))); i++; break;
      case '--help': case '-h': printUsage(); process.exit(0); break;
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown flag ${arg}. Try --help.`);
    }
  }
  return opts;
}

// ─── Generation ──────────────────────────────────────────────────────────

/**
 * Generate, then hold the result to the same content-safety gate the edge
 * functions hold it to.
 *
 * CLAUDE.md §1 says every AI interaction passes through the safety pipeline,
 * and a script that wrote straight into a shared cache would be the one path
 * in the app that skipped it — while being the path whose output reaches the
 * most learners. `validateContentSafety` is imported from the same _shared
 * module `validated-generate.ts` calls, so this is the same gate, not a
 * lookalike.
 *
 * Unsafe output is regenerated once and then ABANDONED rather than written.
 * The edge functions fall back to pre-authored text at this point, but a
 * fallback belongs at request time where a learner is waiting — writing one
 * into the shared cache would freeze the fallback in for everyone.
 */
async function generateSafely(
  fn: string,
  language: string,
  generate: () => Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }>,
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } } | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await withRetry(generate);
    const safety = await validateContentSafety(result.text, { language, fn });
    if (safety.safe) return result;
    console.warn(`   [${fn}] safety rejected (attempt ${attempt}): ${safety.reasons.join(', ')}`);
  }
  return null;
}

async function warmTranslations(
  db: SupabaseClient,
  items: readonly TranslationItem[],
  apiKey: string,
  ledger: CostLedger,
  concurrency: number,
): Promise<number> {
  const done = await mapWithConcurrency(items, concurrency, async (item) => {
    const result = await generateSafely('translate', item.targetLanguage, () =>
      callHaiku({
        apiKey,
        system: buildTranslateSystemPrompt(item.sourceLanguage, item.targetLanguage),
        userMessage: item.text,
        maxTokens: MAX_TOKENS.translation,
      }),
    );
    if (!result) return 0;
    ledger.addHaiku('translation', result.usage.inputTokens, result.usage.outputTokens);

    const { error } = await db
      .from('translation_cache')
      .upsert(
        { hash: item.key, translation: result.text, expires_at: cacheExpiryIso() },
        { onConflict: 'hash', ignoreDuplicates: true },
      );
    if (error) throw new Error(`translation_cache write failed: ${error.message}`);
    return 1;
  });
  return report('translation', done);
}

async function warmHints(
  db: SupabaseClient,
  items: readonly HintItem[],
  apiKey: string,
  ledger: CostLedger,
  concurrency: number,
): Promise<number> {
  const done = await mapWithConcurrency(items, concurrency, async (item) => {
    const result = await generateSafely('get-hint', item.targetLanguage, () =>
      callHaiku({
        apiKey,
        system: HINT_SYSTEM_PROMPT,
        userMessage: buildHintUserMessage(item.card, item.exerciseType, item.targetLanguage),
        maxTokens: MAX_TOKENS.hint,
      }),
    );
    if (!result) return 0;
    ledger.addHaiku('hint', result.usage.inputTokens, result.usage.outputTokens);

    const { error } = await db
      .from('hint_cache')
      .upsert({ card_id: item.cardId, exercise_type: item.exerciseType, hint: result.text });
    if (error) throw new Error(`hint_cache write failed: ${error.message}`);
    return 1;
  });
  return report('hint', done);
}

async function warmExplanations(
  db: SupabaseClient,
  items: readonly ExplanationItem[],
  apiKey: string,
  ledger: CostLedger,
  concurrency: number,
): Promise<number> {
  const done = await mapWithConcurrency(items, concurrency, async (item) => {
    const result = await generateSafely('explain-passage', item.nativeLanguage, () =>
      callHaiku({
        apiKey,
        system: buildExplainSystemPrompt(item.language, item.nativeLanguage, item.cefrLevel),
        userMessage: item.span,
        maxTokens: MAX_TOKENS.explanation,
      }),
    );
    if (!result) return 0;
    ledger.addHaiku('explanation', result.usage.inputTokens, result.usage.outputTokens);

    const { error } = await db.from('explanation_cache').upsert(
      { hash: item.key, explanation: result.text, book_id: null, expires_at: cacheExpiryIso() },
      { onConflict: 'hash', ignoreDuplicates: true },
    );
    if (error) throw new Error(`explanation_cache write failed: ${error.message}`);
    return 1;
  });
  return report('explanation', done);
}

async function warmTts(
  db: SupabaseClient,
  items: readonly TtsItem[],
  apiKey: string,
  ledger: CostLedger,
  concurrency: number,
): Promise<number> {
  const done = await mapWithConcurrency(items, concurrency, async (item) => {
    const audio = await withRetry(() =>
      callFish({ apiKey, referenceId: item.voiceId, text: item.sentText }),
    );
    ledger.addFish('tts', item.bytes);

    // `upsert: false` so a clip another process wrote while this ran is left
    // alone rather than paid for twice and overwritten.
    const { error } = await db.storage
      .from(TTS_BUCKET)
      .upload(item.path, audio, { contentType: 'audio/mpeg', upsert: false });
    if (error && !/exists/i.test(error.message)) {
      throw new Error(`tts-cache upload failed: ${error.message}`);
    }
    return 1;
  });
  return report('tts', done);
}

function report<T>(cache: string, done: { ok: number[]; failed: { item: T; error: unknown }[] }): number {
  const written = done.ok.reduce((a, b) => a + b, 0);
  if (done.failed.length > 0) {
    console.warn(`   [${cache}] ${done.failed.length} failed — re-run to retry them:`);
    for (const f of done.failed.slice(0, 5)) {
      console.warn(`     ! ${f.error instanceof Error ? f.error.message : String(f.error)}`);
    }
  }
  return written;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const envPath = loadEnv();

  console.log('Fluenci — shared cache warmer');
  console.log(opts.execute ? '*** EXECUTE: this run WILL spend money ***' : 'DRY RUN — nothing will be generated or written. Pass --execute to spend.');
  console.log(`env file: ${envPath ?? 'none found (using exported vars)'}`);
  console.log(`secrets: ${Object.entries(describeSecrets()).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log(`caches: ${opts.caches.join(', ')}   native: ${opts.nativeLanguage}   concurrency: ${opts.concurrency}${opts.limit ? `   limit: ${opts.limit}/cache` : ''}`);

  const db = getServiceClient();
  const fishVoiceMap = parseFishVoiceMap(secret('fishVoiceMap'));

  const estimate = new CostLedger();
  const ceiling = new CostLedger();
  const cap = <T>(items: T[]): T[] => (opts.limit ? items.slice(0, opts.limit) : items);

  const work: {
    translation: TranslationItem[];
    hint: HintItem[];
    tts: TtsItem[];
    explanation: ExplanationItem[];
  } = { translation: [], hint: [], tts: [], explanation: [] };

  const cards = await fetchCurriculumCards(db);
  console.log(`\ncurriculum: ${cards.length} shared cards`);

  if (opts.caches.includes('translation')) {
    const candidates = await planTranslations(cards, opts.nativeLanguage);
    const existing = await existingTranslationKeys(db, candidates.map((c) => c.key));
    const { items, alreadyCached, duplicates } = dedupeAndSkip(candidates, existing);
    work.translation = cap(items);
    for (const item of work.translation) {
      const system = buildTranslateSystemPrompt(item.sourceLanguage, item.targetLanguage);
      estimateHaiku(estimate, 'translation', system, item.text, TYPICAL_OUTPUT_TOKENS.translation);
      estimateHaiku(ceiling, 'translation', system, item.text, MAX_TOKENS.translation);
    }
    reportPlan('translation', work.translation.length, alreadyCached, duplicates, candidates.length, estimate, ceiling, work.translation, opts.samples);
  }

  if (opts.caches.includes('hint')) {
    const candidates = planHints(await fetchHintTargets(db, cards));
    const { items, alreadyCached, duplicates } = dedupeAndSkip(candidates, await existingHintKeys(db));
    work.hint = cap(items);
    for (const item of work.hint) {
      const user = buildHintUserMessage(item.card, item.exerciseType, item.targetLanguage);
      estimateHaiku(estimate, 'hint', HINT_SYSTEM_PROMPT, user, TYPICAL_OUTPUT_TOKENS.hint);
      estimateHaiku(ceiling, 'hint', HINT_SYSTEM_PROMPT, user, MAX_TOKENS.hint);
    }
    reportPlan('hint', work.hint.length, alreadyCached, duplicates, candidates.length, estimate, ceiling, work.hint, opts.samples);
    if (work.hint.length > 0) {
      console.log('   NOTE: nothing in the app calls `get-hint` today — lib/ai.ts exports');
      console.log('   getHint() but no screen imports it, and lesson hints render from the');
      console.log('   static exercises.hint_text column. Warming this cache prepays for a');
      console.log('   feature that is not wired up. Consider --skip hint until it is.');
    }
  }

  if (opts.caches.includes('tts')) {
    const prompts = await fetchAudioPrompts(db, cards);
    const rates = opts.includeSlow ? [DEFAULT_RATE, SLOW_RATE] : [DEFAULT_RATE];
    const candidates: TtsItem[] = [];
    const unwarmable = new Set<string>();
    const existing = new Set<string>();
    for (const rate of rates) {
      const plan = await planTts(prompts, fishVoiceMap, rate);
      candidates.push(...plan.items);
      plan.unwarmableLanguages.forEach((l) => unwarmable.add(l));
      const prefix = plan.items[0]?.path.split('/').slice(0, -1).join('/');
      if (prefix) for (const p of await existingTtsPaths(db, prefix)) existing.add(p);
    }
    const { items, alreadyCached, duplicates } = dedupeAndSkip(candidates, existing);
    work.tts = cap(items);
    for (const item of work.tts) {
      estimate.addFish('tts', item.bytes);
      ceiling.addFish('tts', item.bytes);
    }
    reportPlan('tts', work.tts.length, alreadyCached, duplicates, candidates.length, estimate, ceiling, work.tts, opts.samples);
    if (unwarmable.size > 0) {
      console.log(`   NOT warmable — no fish.audio voice in FISH_VOICE_MAP: ${[...unwarmable].join(', ')}`);
    }
  }

  if (opts.caches.includes('explanation')) {
    const candidates = await planExplanations(await fetchPassageParagraphs(db), opts.nativeLanguage);
    const existing = await existingExplanationKeys(db, candidates.map((c) => c.key));
    const { items, alreadyCached, duplicates } = dedupeAndSkip(candidates, existing);
    work.explanation = cap(items);
    for (const item of work.explanation) {
      const system = buildExplainSystemPrompt(item.language, item.nativeLanguage, item.cefrLevel);
      estimateHaiku(estimate, 'explanation', system, item.span, TYPICAL_OUTPUT_TOKENS.explanation);
      estimateHaiku(ceiling, 'explanation', system, item.span, MAX_TOKENS.explanation);
    }
    reportPlan('explanation', work.explanation.length, alreadyCached, duplicates, candidates.length, estimate, ceiling, work.explanation, opts.samples);
    warnAboutClonedPassages(candidates);
  }

  const planned = estimate.total();
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`TOTAL to generate: ${planned.calls} items`);
  console.log(`  Haiku 4.5   ${planned.inputTokens.toLocaleString()} in / ${planned.outputTokens.toLocaleString()} out tokens (estimated)`);
  console.log(`  fish.audio  ${planned.ttsBytes.toLocaleString()} UTF-8 bytes`);
  console.log(`  ESTIMATED TOTAL   ${formatUsd(planned.usd)}`);
  console.log(`  worst case        ${formatUsd(ceiling.total().usd)}  (every text call runs to max_tokens)`);
  console.log('═'.repeat(64));

  if (!opts.execute) {
    console.log('\nDry run complete. Nothing was generated and nothing was written.');
    console.log('Re-run with --execute to spend the amount above.');
    return;
  }
  if (planned.calls === 0) {
    console.log('\nEverything is already warm. Nothing to do.');
    return;
  }

  const anthropicKey = work.translation.length + work.hint.length + work.explanation.length > 0
    ? requireSecret('anthropicKey')
    : '';
  const fishKey = work.tts.length > 0 ? requireSecret('fishKey') : '';

  console.log('\nGenerating…');
  const actual = new CostLedger();
  let written = 0;
  const started = Date.now();

  if (work.translation.length) written += await warmTranslations(db, work.translation, anthropicKey, actual, opts.concurrency);
  if (work.hint.length) written += await warmHints(db, work.hint, anthropicKey, actual, opts.concurrency);
  if (work.tts.length) written += await warmTts(db, work.tts, fishKey, actual, opts.concurrency);
  if (work.explanation.length) written += await warmExplanations(db, work.explanation, anthropicKey, actual, opts.concurrency);

  const spent = actual.total();
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`Wrote ${written} of ${planned.calls} planned items in ${Math.round((Date.now() - started) / 1000)}s`);
  for (const cache of actual.caches()) {
    console.log(`  ${cache.padEnd(12)} ${formatUsd(actual.get(cache).usd)}`);
  }
  console.log(`  ACTUAL TOTAL      ${formatUsd(spent.usd)}   (estimated ${formatUsd(planned.usd)})`);
  console.log('═'.repeat(64));
  console.log('Re-run any time — everything above is now skipped as already cached.');
}

main().catch((err: unknown) => {
  console.error(`\nFAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
