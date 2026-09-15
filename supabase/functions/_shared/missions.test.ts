// Deno tests for the mission registry.
//
// Run with: `deno test supabase/functions/_shared/missions.test.ts`
//
// The registry is authored content with a shape the model, the client and the
// prompt cache all depend on. These pin the shape: four stages per scene
// climbing A1→B2, 2-3 objectives each with unique ids, and a prompt block
// short enough not to worsen the beginner-recast crowding documented in
// `fluenci-conversation-loop`.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  MAX_MISSION_BLOCK_CHARS,
  MISSIONS,
  MISSION_STAGE_COUNT,
  buildMissionBlock,
  getMission,
  missionObjectiveIds,
} from './missions.ts';
import { SCENARIOS } from './scenarios.ts';

const BANDS = ['A1', 'A2', 'B1', 'B2'];
const ID_RE = /^[a-z][a-z0-9_]{0,39}$/;

Deno.test('every scene except free_chat has a ladder, and nothing else does', () => {
  const scenes = Object.keys(SCENARIOS).filter((k) => k !== 'free_chat').sort();
  assertEquals(Object.keys(MISSIONS).sort(), scenes);
});

Deno.test('each ladder is four stages, A1→B2, in order', () => {
  for (const [scene, ladder] of Object.entries(MISSIONS)) {
    assertEquals(ladder.length, MISSION_STAGE_COUNT, `${scene} should have 4 missions`);
    ladder.forEach((m, i) => {
      assertEquals(m.stage, i + 1, `${scene} stage order`);
      assertEquals(m.band, BANDS[i], `${scene} stage ${m.stage} band`);
      assert(m.title.trim().length > 0 && m.title.length <= 60, `${scene} stage ${m.stage} title`);
    });
  }
});

Deno.test('each mission has 2-3 objectives with unique, well-formed ids', () => {
  for (const [scene, ladder] of Object.entries(MISSIONS)) {
    for (const m of ladder) {
      assert(
        m.objectives.length >= 2 && m.objectives.length <= 3,
        `${scene} stage ${m.stage} should have 2-3 objectives`,
      );
      const ids = m.objectives.map((o) => o.id);
      assertEquals(new Set(ids).size, ids.length, `${scene} stage ${m.stage} duplicate ids`);
      for (const o of m.objectives) {
        assert(ID_RE.test(o.id), `${scene}/${o.id} must match the id whitelist`);
        assert(o.text.length > 0 && o.text.length <= 80, `${scene}/${o.id} text ≤ 80`);
        assert(o.detect.length > 0 && o.detect.length <= 160, `${scene}/${o.id} detect ≤ 160`);
        // No apostrophes: the client parity test parses this file as text
        // with single-quoted strings.
        assert(!o.text.includes("'") && !o.detect.includes("'"), `${scene}/${o.id} no apostrophes`);
      }
      assertEquals(missionObjectiveIds(m), new Set(ids));
    }
  }
});

Deno.test('the mission block stays under the cache-prefix budget', () => {
  for (const [scene, ladder] of Object.entries(MISSIONS)) {
    for (const m of ladder) {
      const block = buildMissionBlock(m, 'Spanish');
      assert(
        block.length <= MAX_MISSION_BLOCK_CHARS,
        `${scene} stage ${m.stage} block is ${block.length} chars (cap ${MAX_MISSION_BLOCK_CHARS})`,
      );
      assert(block.startsWith(`MISSION (stage ${m.stage} of 4, ${m.band}): ${m.title}`));
      for (const o of m.objectives) assert(block.includes(`- ${o.id}: `));
      // The over-awarding defence, stated to the model every time.
      assert(block.includes('LATEST message'));
      assert(block.includes('own words'));
      assert(block.includes('does not count'));
      assert(block.includes('"objectivesMet"'));
    }
  }
});

Deno.test('getMission resolves exactly integer stages 1..4 of a real scene', () => {
  assertEquals(getMission('restaurant', 1)?.title, 'A table and a drink');
  assertEquals(getMission('restaurant', 4)?.band, 'B2');
  assertEquals(getMission('free_chat', 1), null);
  assertEquals(getMission('not_a_scene', 1), null);
  assertEquals(getMission('restaurant', 0), null);
  assertEquals(getMission('restaurant', 5), null);
  assertEquals(getMission('restaurant', 1.5), null);
  assertEquals(getMission('restaurant', '1'), null);
  assertEquals(getMission('restaurant', 'open'), null);
  assertEquals(getMission('restaurant', undefined), null);
  assertEquals(getMission('restaurant', null), null);
  // Prototype keys are not scenes.
  assertEquals(getMission('constructor', 1), null);
  assertEquals(getMission('__proto__', 1), null);
});
