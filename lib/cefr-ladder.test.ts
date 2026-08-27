/**
 * The ProficiencyLevel -> CEFR ladder exists in two runtimes and must agree.
 *
 * There used to be four copies of this table: `lib/cefr-proficiency.ts`,
 * `allowedCefrLevelsFor` in `lib/supabase-queries.ts`, the chat header, and
 * `supabase/functions/_shared/cefr.ts`. Three have been collapsed into
 * `CEFR_BAND_BY_LEVEL`. The fourth cannot be — it runs in Deno and cannot
 * import from `lib/`.
 *
 * That copy is not cosmetic. It decides the level every server-side prompt is
 * written for, while the client copy decides which content the learner is shown
 * and what the proficiency report claims. If they drift, a learner is served
 * B2 reading material by a tutor briefed to speak B1, and nothing anywhere
 * fails — which is precisely why this is asserted rather than trusted.
 *
 * This test reads the edge module as TEXT rather than importing it, because
 * importing Deno source under jest is not worth the tooling.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CEFR_BAND_BY_LEVEL } from './cefr-proficiency';
import type { ProficiencyLevel } from '../types';

const EDGE_MODULE = resolve(__dirname, '../supabase/functions/_shared/cefr.ts');

/** Pull the `MAP` object literal out of the edge module's source. */
function parseEdgeLadder(): Record<string, string> {
  const src = readFileSync(EDGE_MODULE, 'utf8');
  const block = src.match(/const MAP: Record<ProficiencyLevel, CEFR> = \{([\s\S]*?)\};/);
  if (!block) {
    throw new Error(
      'Could not find the MAP literal in _shared/cefr.ts — if it was renamed or ' +
        'restructured, update this test rather than deleting it.',
    );
  }
  const out: Record<string, string> = {};
  for (const line of block[1].split('\n')) {
    const entry = line.match(/^\s*(\w+)\s*:\s*'([A-C][12])'\s*,?\s*$/);
    if (entry) out[entry[1]] = entry[2];
  }
  return out;
}

describe('CEFR ladder parity across runtimes', () => {
  it('finds a parseable ladder in the edge module', () => {
    // A guard that silently parses nothing would pass forever.
    expect(Object.keys(parseEdgeLadder()).length).toBeGreaterThan(0);
  });

  it('maps every proficiency level identically on client and edge', () => {
    expect(parseEdgeLadder()).toEqual(CEFR_BAND_BY_LEVEL);
  });

  it('covers every ProficiencyLevel the app can store', () => {
    const levels: ProficiencyLevel[] = [
      'beginner',
      'elementary',
      'intermediate',
      'upper_intermediate',
      'advanced',
    ];
    for (const level of levels) {
      expect(CEFR_BAND_BY_LEVEL[level]).toMatch(/^[A-C][12]$/);
    }
    expect(Object.keys(CEFR_BAND_BY_LEVEL).sort()).toEqual([...levels].sort());
  });
});
