/**
 * The cost model. This is what the operator reads before deciding to spend, so
 * the two things it must never do are under-count and silently disagree with
 * the provider's own unit.
 *
 * The specific trap these tests exist for: fish.audio bills per UTF-8 BYTE.
 * A third of the curriculum is Japanese, Korean and Chinese, where a character
 * is three bytes — so a `.length` in place of a byte count passes every check
 * anyone would run on Spanish and then under-reports the CJK third by ~3x.
 */

import {
  CostLedger,
  estimateTokens,
  FISH_USD_PER_MBYTE,
  fishCostUsd,
  formatUsd,
  haikuCostUsd,
  HAIKU_USD_PER_MTOK_IN,
  HAIKU_USD_PER_MTOK_OUT,
  utf8Bytes,
} from './cost';

describe('utf8Bytes — the fish.audio billing unit', () => {
  it('agrees with String.length only for ASCII', () => {
    expect(utf8Bytes('perro')).toBe(5);
    expect(utf8Bytes('perro')).toBe('perro'.length);
  });

  it('counts CJK at ~3 bytes per character, not 1', () => {
    expect('犬'.length).toBe(1);
    expect(utf8Bytes('犬')).toBe(3);
    expect(utf8Bytes('こんにちは')).toBe(15);
    expect(utf8Bytes('안녕하세요')).toBe(15);
  });

  it('counts accented Latin and Cyrillic above their character count', () => {
    expect(utf8Bytes('Grüße')).toBeGreaterThan('Grüße'.length);
    expect(utf8Bytes('привет')).toBe(12);
  });

  it('would under-report a CJK run by ~3x if characters were counted', () => {
    const japanese = 'ありがとうございます';
    expect(utf8Bytes(japanese) / japanese.length).toBeCloseTo(3, 5);
  });
});

describe('prices', () => {
  it('uses the verified Haiku 4.5 rates', () => {
    expect(HAIKU_USD_PER_MTOK_IN).toBe(1);
    expect(HAIKU_USD_PER_MTOK_OUT).toBe(5);
    // 1M in + 1M out = $1 + $5
    expect(haikuCostUsd(1_000_000, 1_000_000)).toBeCloseTo(6, 10);
    expect(haikuCostUsd(0, 0)).toBe(0);
  });

  it('uses the verified fish.audio rate, per million BYTES', () => {
    expect(FISH_USD_PER_MBYTE).toBe(15);
    expect(fishCostUsd(1_000_000)).toBeCloseTo(15, 10);
    expect(fishCostUsd(utf8Bytes('犬'))).toBeCloseTo((3 / 1_000_000) * 15, 12);
  });

  it('shows sub-cent totals rather than rounding them to nothing', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(0.0012)).toBe('$0.0012');
    expect(formatUsd(23.456)).toBe('$23.46');
  });
});

describe('estimateTokens', () => {
  it('scores CJK far denser than Latin for the same character count', () => {
    const latin = 'abcdefghij';
    const cjk = '一二三四五六七八九十';
    expect(latin.length).toBe(cjk.length);
    expect(estimateTokens(cjk)).toBeGreaterThan(estimateTokens(latin));
  });

  it('is roughly one token per CJK character', () => {
    expect(estimateTokens('一二三四五六七八九十')).toBe(10);
  });

  it('is roughly one token per 3.5 Latin characters', () => {
    expect(estimateTokens('a'.repeat(35))).toBe(10);
  });

  it('handles mixed scripts additively and never returns a negative', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('犬 dog')).toBeGreaterThan(0);
  });
});

describe('CostLedger', () => {
  it('accumulates per cache and in total', () => {
    const ledger = new CostLedger();
    ledger.addHaiku('translation', 1_000_000, 0);
    ledger.addHaiku('hint', 0, 1_000_000);
    ledger.addFish('tts', 1_000_000);

    expect(ledger.get('translation').usd).toBeCloseTo(1, 10);
    expect(ledger.get('hint').usd).toBeCloseTo(5, 10);
    expect(ledger.get('tts').usd).toBeCloseTo(15, 10);
    expect(ledger.total().usd).toBeCloseTo(21, 10);
    expect(ledger.total().calls).toBe(3);
  });

  it('counts fish spend in bytes and Haiku spend in tokens, never mixed', () => {
    const ledger = new CostLedger();
    ledger.addFish('tts', 42);
    expect(ledger.get('tts').ttsBytes).toBe(42);
    expect(ledger.get('tts').inputTokens).toBe(0);
  });

  it('reports zeroes for a cache nothing was recorded against', () => {
    const ledger = new CostLedger();
    expect(ledger.get('explanation')).toEqual({
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      ttsBytes: 0,
      usd: 0,
    });
    expect(ledger.caches()).toEqual([]);
  });
});
