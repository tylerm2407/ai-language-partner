import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { MAX_CONTRACT_LANGUAGES, validateContractConfig } from './contract-config.ts';

Deno.test('contract config: null clears the contract', () => {
  assertEquals(validateContractConfig(null), { ok: true, value: null });
});

Deno.test('contract config: a config without maxLanguages passes through unchanged', () => {
  const config = { dailyVoiceMinutes: 10, dailyNewCards: 20, audiobookNarration: false };
  assertEquals(validateContractConfig(config), { ok: true, value: config });
});

Deno.test('contract config: maxLanguages accepts every integer from 1 to 9999', () => {
  assertEquals(MAX_CONTRACT_LANGUAGES, 9999);
  for (const n of [1, 2, 9, 9999]) {
    const config = { dailyVoiceMinutes: 10, maxLanguages: n };
    assertEquals(validateContractConfig(config), { ok: true, value: config }, `value ${n}`);
  }
});

Deno.test('contract config: maxLanguages refuses anything the ::int merge cannot take or should not store', () => {
  for (const bad of [0, -1, 10000, 1.5, '3', null, true, NaN, Infinity]) {
    const result = validateContractConfig({ maxLanguages: bad });
    assertEquals(result.ok, false, `value ${String(bad)}`);
  }
});

Deno.test('contract config: non-object configs are refused', () => {
  for (const bad of ['{}', 3, true, [], [{ maxLanguages: 2 }]]) {
    assertEquals(validateContractConfig(bad).ok, false, JSON.stringify(bad));
  }
});
