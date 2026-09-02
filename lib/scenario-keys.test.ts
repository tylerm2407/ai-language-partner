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
import { SCENARIO_META, SCENARIO_ORDER } from '../types/scenarios';
import type { ScenarioKey } from '../types/scenarios';

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
  it('every scenario the learner can pick resolves to an authored prompt', () => {
    const edge = edgeScenarioKeys();
    for (const key of SCENARIO_ORDER) {
      expect(edge).toContain(key);
    }
  });

  it('every authored prompt is reachable from the picker', () => {
    // The other direction matters too: a scenario written server-side but
    // absent from SCENARIO_ORDER is work nobody can ever run.
    const clientKeys = SCENARIO_ORDER as readonly string[];
    for (const key of edgeScenarioKeys()) {
      expect(clientKeys).toContain(key);
    }
  });

  it('the two ScenarioKey unions have the same members', () => {
    expect([...edgeUnionKeys()].sort()).toEqual([...SCENARIO_ORDER].sort());
  });

  it('SCENARIO_ORDER and SCENARIO_META cover exactly the same keys', () => {
    expect([...SCENARIO_ORDER].sort()).toEqual(
      (Object.keys(SCENARIO_META) as ScenarioKey[]).sort(),
    );
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
