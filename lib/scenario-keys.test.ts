/**
 * The scenario key list exists in two runtimes and must agree.
 *
 * `types/scenarios.ts` decides which scenarios a learner can pick and what
 * they are called. `supabase/functions/_shared/scenarios.ts` decides which
 * keys resolve to an authored prompt. They cannot import each other: one is
 * bundled into the app, the other runs in Deno.
 *
 * Drift here fails silently and expensively. `ai-chat` falls back to the
 * free-form `topic` path for an unknown key (`prompt.ts`, which logs a warn
 * nobody reads), so a scenario present on the client but missing on the
 * server still *works* — the learner picks "Job Interview", gets a generic
 * chat partner instead of the authored interviewer with its conversation arc
 * and failure modes, and nothing anywhere errors. The authored scenarios are
 * the thing that distinguishes this product from a chat box; losing one to a
 * typo is not a failure we should have to notice by hand.
 *
 * Reads the edge module as TEXT rather than importing it, because importing
 * Deno source under jest is not worth the tooling. Same approach as
 * lib/cefr-ladder.test.ts.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { SCENARIO_META, SCENARIO_ORDER, SERVER_ONLY_SCENARIOS } from '../types/scenarios';
import type { ScenarioKey } from '../types/scenarios';

/**
 * Every key that must exist on both sides: the pickable ones plus the
 * server-only ones.
 *
 * `SCENARIO_ORDER` alone used to be that list, because every scenario was
 * pickable. `level_test` is not — the checkpoint opens it, and making it
 * pickable would let the practice screen resume an assessment session whose
 * turns the checkpoint then reads back as its own evidence. The exception is
 * an explicit list rather than a loosened assertion: a key missing from BOTH
 * lists is still caught, which is the drift this file exists to stop.
 */
const ALL_KEYS: ScenarioKey[] = [...SCENARIO_ORDER, ...SERVER_ONLY_SCENARIOS];

const EDGE_MODULE = resolve(__dirname, '../supabase/functions/_shared/scenarios.ts');

function edgeSource(): string {
  return readFileSync(EDGE_MODULE, 'utf8');
}

/** Keys in the server's `SCENARIOS` record. */
function edgeScenarioKeys(): string[] {
  const src = edgeSource();
  const start = src.indexOf('export const SCENARIOS');
  expect(start).toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf('\n};', start));
  return [...body.matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map((m) => m[1]);
}

/** Members of the server's `ScenarioKey` union. */
function edgeUnionKeys(): string[] {
  const src = edgeSource();
  const start = src.indexOf('export type ScenarioKey');
  expect(start).toBeGreaterThan(-1);
  const decl = src.slice(start, src.indexOf(';', start));
  return [...decl.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe('scenario keys across the client/edge boundary', () => {
  it('every scenario the client knows resolves to an authored prompt', () => {
    const edge = edgeScenarioKeys();
    for (const key of ALL_KEYS) {
      expect(edge).toContain(key);
    }
  });

  it('every authored prompt is reachable', () => {
    // The other direction matters too: a scenario written server-side but
    // absent from both client lists is work nobody can ever run.
    const clientKeys = ALL_KEYS as readonly string[];
    for (const key of edgeScenarioKeys()) {
      expect(clientKeys).toContain(key);
    }
  });

  it('the two ScenarioKey unions have the same members', () => {
    expect([...edgeUnionKeys()].sort()).toEqual([...ALL_KEYS].sort());
  });

  it('SCENARIO_META covers every key, pickable or not', () => {
    // Keyed by the full union, so a surface resolving a stored session's key
    // to a label does not fall off a missing entry.
    expect([...ALL_KEYS].sort()).toEqual(
      (Object.keys(SCENARIO_META) as ScenarioKey[]).sort(),
    );
  });

  it('a server-only scenario stays out of the picker', () => {
    // The thing that would actually break: fetchOrCreateChatSession resumes
    // the newest session for a (scenario, language) pair, so a pickable
    // level_test would hand the practice screen an assessment session.
    for (const key of SERVER_ONLY_SCENARIOS) {
      expect(SCENARIO_ORDER).not.toContain(key);
    }
  });

  it('labels and descriptions live only on the client', () => {
    // They used to be duplicated verbatim in the edge module, where nothing
    // read them — two strings per scenario that could drift from the ones
    // actually shown. If they come back, this is the reminder why they left.
    const src = edgeSource();
    const scenarios = src.slice(src.indexOf('export const SCENARIOS'));
    expect(scenarios).not.toMatch(/^\s*label:/m);
    expect(scenarios).not.toMatch(/^\s*description:/m);
  });
});
