/**
 * Everything the run prints, and the estimate it prints.
 *
 * Split out of warm-shared-caches.ts to keep that file inside the 500-line
 * limit, and because it genuinely is a separate concern: the orchestration
 * decides what to generate, this decides what an operator is told about it
 * before they agree to pay for it.
 */

import { CostLedger, estimateTokens, formatUsd } from './cost';
import { ALL_CACHES, type CacheName, type ExplanationItem, type WorkItem } from './plan';

export function printUsage(): void {
  console.log(`
Warm the shared, curriculum-keyed AI caches. DRY RUN unless --execute is given.

  --execute            Actually call the providers and write. Without this,
                       nothing is generated and nothing is spent.
  --only  <a,b>        Warm only these caches: ${ALL_CACHES.join(', ')}
  --skip  <a,b>        Warm everything except these.
  --native <code>      Learner native language for translations (default: en).
  --concurrency <n>    In-flight requests per cache (default: 4).
  --limit <n>          Cap items per cache. Use for a small paid trial first.
  --include-slow       Also warm the 0.75-rate "play it slower" lesson clips.
  --samples <n>        Example lines printed per cache (default: 5).
`);
}

// ─── Estimation ──────────────────────────────────────────────────────────

/**
 * Typical output length per call. Estimates, labelled as such wherever they
 * surface, and deliberately on the high side.
 *
 * `translation` is calibrated against a real measurement rather than guessed:
 * `scripts/warm-caches/smoke-check.ts` translating "perro" es→en reported
 * 78 input / 4 output tokens. The curriculum is single words and short
 * phrases, so 4 is close to the floor; 12 leaves room for the longer entries
 * without pretending to a precision this does not have. The other two are
 * held at roughly two thirds of their function's max_tokens.
 *
 * The run also prints the CEILING — what it would cost if every call ran to
 * max_tokens — so the operator sees the expected number and the worst case
 * before deciding. During `--execute` the ledger is fed the provider's own
 * reported usage instead, and actual is printed next to estimate, so a bad
 * constant here shows up as a visible discrepancy rather than a quiet lie.
 */
export const TYPICAL_OUTPUT_TOKENS = { translation: 12, hint: 55, explanation: 220 } as const;

export function estimateHaiku(ledger: CostLedger, cache: CacheName, system: string, user: string, out: number): void {
  ledger.addHaiku(cache, estimateTokens(system) + estimateTokens(user), out);
}

// ─── Reporting ───────────────────────────────────────────────────────────

export function reportPlan(
  cache: CacheName,
  planned: number,
  alreadyCached: number,
  duplicates: number,
  candidates: number,
  ledger: CostLedger,
  ceiling: CostLedger,
  samples: readonly WorkItem[],
  sampleCount: number,
): void {
  const totals = ledger.get(cache);
  console.log(`\n── ${cache} ${'─'.repeat(Math.max(0, 58 - cache.length))}`);
  console.log(`   candidates      ${candidates}`);
  console.log(`   already cached  ${alreadyCached}`);
  console.log(`   duplicate keys  ${duplicates}`);
  console.log(`   TO GENERATE     ${planned}`);
  if (planned === 0) {
    console.log('   nothing to do.');
    return;
  }
  if (cache === 'tts') {
    console.log(`   fish.audio      ${totals.ttsBytes.toLocaleString()} UTF-8 bytes`);
  } else {
    console.log(
      `   tokens (est.)   ${totals.inputTokens.toLocaleString()} in / ${totals.outputTokens.toLocaleString()} out`,
    );
  }
  console.log(
    `   estimated       ${formatUsd(totals.usd)}` +
      (cache === 'tts' ? '' : `   (ceiling if every call maxed out: ${formatUsd(ceiling.get(cache).usd)})`),
  );
  for (const item of samples.slice(0, sampleCount)) {
    console.log(`     · ${item.label.slice(0, 100)}`);
  }
  if (planned > sampleCount) console.log(`     … and ${planned - sampleCount} more`);
}

/**
 * A paragraph that is byte-identical across several course languages is the
 * same prose filed under several different learners' target languages — and
 * the explanation cache key contains the language, so it will be explained
 * once per language, at full price, for text that is only in one of them.
 *
 * This is worth stopping to look at rather than quietly paying 9x for. It
 * is reported, not enforced: if the duplication is intentional the run is
 * still correct, and if it is not, the fix is in the content, not here.
 */
export function warnAboutClonedPassages(items: readonly ExplanationItem[]): void {
  const languagesBySpan = new Map<string, Set<string>>();
  for (const item of items) {
    const set = languagesBySpan.get(item.span) ?? new Set<string>();
    set.add(item.language);
    languagesBySpan.set(item.span, set);
  }
  const cloned = [...languagesBySpan.values()].filter((set) => set.size > 1);
  if (cloned.length === 0) return;

  const worst = Math.max(...cloned.map((set) => set.size));
  console.log(
    `   WARNING: ${cloned.length} of ${languagesBySpan.size} distinct paragraphs appear under`,
  );
  console.log(
    `   up to ${worst} different course languages with identical text — i.e. the same prose`,
  );
  console.log('   is filed as several languages\' reading content. Each copy is a separate cache');
  console.log('   key and a separate paid explanation, describing text that is not in the');
  console.log('   language the learner is being told it is. Check the passage content before');
  console.log('   paying for this cache.');
}
