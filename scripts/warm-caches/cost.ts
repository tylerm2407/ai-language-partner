/**
 * What warming the shared caches costs, and how that is counted.
 *
 * Pure — no network, no Supabase, no env. Everything here is arithmetic over
 * strings, which is exactly the part that has to be right before anyone types
 * `--execute`: the estimate is the only thing standing between the operator
 * and an unbounded bill.
 *
 * The one thing in this file that is genuinely easy to get wrong, and silently:
 * fish.audio bills per UTF-8 BYTE, not per character. A Japanese lesson prompt
 * is ~3 bytes per character, so counting `text.length` would under-report the
 * CJK half of the curriculum by roughly a factor of three — and CJK is a third
 * of it. `utf8Bytes` is the only counter this file exposes for money, and
 * `estimateTokens` is deliberately named so it cannot be mistaken for one.
 */

// ─── Verified provider prices ────────────────────────────────────────────
//
// Anthropic Claude Haiku 4.5 (`claude-haiku-4-5-20251001`, the model every
// one of the three text edge functions pins). Prices are per million tokens.
// The model is NOT a free choice here: the point of warming is to write rows
// the edge functions will read back, so the script must produce what those
// functions would have produced, from the same model and the same prompt.
export const HAIKU_USD_PER_MTOK_IN = 1;
export const HAIKU_USD_PER_MTOK_OUT = 5;

/** fish.audio s2-pro: $15 per 1,000,000 UTF-8 bytes of input text. */
export const FISH_USD_PER_MBYTE = 15;

// ─── Counting ────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

/**
 * UTF-8 byte length. This is the fish.audio billing unit.
 *
 * Never substitute `text.length`: for the Latin curriculum the two agree, so a
 * char-count bug passes every eyeball test on Spanish and then under-charges
 * Japanese, Korean and Chinese — a third of the cards — by ~3x.
 */
export function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Characters that a tokenizer treats as roughly one token each: Han, the two
 * Japanese kana, and Hangul. Everything else is scored at the Latin rate.
 */
const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/u;

/**
 * Characters per token, by script.
 *
 * These are estimates and are labelled as such everywhere they surface. The
 * Latin figure is the usual ~3.5 for non-English European text (English runs
 * nearer 4; Spanish, French, German and Russian all run shorter). CJK is
 * ~1 token per character.
 *
 * They exist so a dry run can price itself with no network and no API key.
 * During `--execute` the ledger is fed the provider's OWN reported `usage`
 * instead, and the run prints estimate against actual — so a bad constant here
 * shows up as a visible discrepancy rather than as a quiet wrong number.
 */
export const CHARS_PER_TOKEN_LATIN = 3.5;
export const CHARS_PER_TOKEN_CJK = 1;

/** Rough token count for a string, script-aware. An ESTIMATE, never a charge. */
export function estimateTokens(text: string): number {
  let cjk = 0;
  for (const ch of text) if (CJK.test(ch)) cjk++;
  const latin = [...text].length - cjk;
  return Math.ceil(cjk / CHARS_PER_TOKEN_CJK + latin / CHARS_PER_TOKEN_LATIN);
}

// ─── Prices ──────────────────────────────────────────────────────────────

export function haikuCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * HAIKU_USD_PER_MTOK_IN +
    (outputTokens / 1_000_000) * HAIKU_USD_PER_MTOK_OUT
  );
}

export function fishCostUsd(bytes: number): number {
  return (bytes / 1_000_000) * FISH_USD_PER_MBYTE;
}

/** Money, formatted so a sub-cent total is still legible rather than "$0.00". */
export function formatUsd(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

// ─── Ledger ──────────────────────────────────────────────────────────────

export interface LedgerTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  ttsBytes: number;
  usd: number;
}

function emptyTotals(): LedgerTotals {
  return { calls: 0, inputTokens: 0, outputTokens: 0, ttsBytes: 0, usd: 0 };
}

/**
 * Running cost, per cache and in total.
 *
 * Used twice over one run with the same code path: once to build the dry-run
 * estimate from `estimateTokens`, and once during execution from the provider's
 * reported usage. Sharing the arithmetic is the point — an estimator that
 * cannot be compared against the real thing is a number nobody can check.
 */
export class CostLedger {
  private readonly byCache = new Map<string, LedgerTotals>();

  private bucket(cache: string): LedgerTotals {
    let t = this.byCache.get(cache);
    if (!t) {
      t = emptyTotals();
      this.byCache.set(cache, t);
    }
    return t;
  }

  addHaiku(cache: string, inputTokens: number, outputTokens: number): void {
    const t = this.bucket(cache);
    t.calls += 1;
    t.inputTokens += inputTokens;
    t.outputTokens += outputTokens;
    t.usd += haikuCostUsd(inputTokens, outputTokens);
  }

  addFish(cache: string, bytes: number): void {
    const t = this.bucket(cache);
    t.calls += 1;
    t.ttsBytes += bytes;
    t.usd += fishCostUsd(bytes);
  }

  get(cache: string): LedgerTotals {
    return { ...(this.byCache.get(cache) ?? emptyTotals()) };
  }

  caches(): string[] {
    return [...this.byCache.keys()];
  }

  total(): LedgerTotals {
    const out = emptyTotals();
    for (const t of this.byCache.values()) {
      out.calls += t.calls;
      out.inputTokens += t.inputTokens;
      out.outputTokens += t.outputTokens;
      out.ttsBytes += t.ttsBytes;
      out.usd += t.usd;
    }
    return out;
  }
}
