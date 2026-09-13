/**
 * The mission ladder exists in two runtimes and must agree.
 *
 * `types/missions.ts` renders the checklist, the picker dots and the warm-up
 * heading. `supabase/functions/_shared/missions.ts` decides what the model
 * reports against and what passes. They cannot import each other — one is
 * bundled into the app, the other runs in Deno — so, like
 * `lib/scenario-keys.test.ts`, this reads the edge module as TEXT and checks
 * the two say the same thing.
 *
 * Drift here is silent: a renamed objective id on the server would leave the
 * client's checklist waiting for a tick that never arrives.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MISSION_META, MISSION_STAGE_COUNT } from '../types/missions';
import { SCENARIO_ORDER } from '../types/scenarios';

const EDGE_MODULE = resolve(__dirname, '../supabase/functions/_shared/missions.ts');
const CLIENT_MODULE = resolve(__dirname, '../types/missions.ts');

interface EdgeMission {
  stage: number;
  band: string;
  title: string;
  objectives: { id: string; text: string }[];
}

/** Parse the server's `MISSIONS` record by its authoring convention. */
function edgeMissions(): Record<string, EdgeMission[]> {
  const src = readFileSync(EDGE_MODULE, 'utf8');
  const start = src.indexOf('export const MISSIONS');
  expect(start).toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf('\n};', start));

  const out: Record<string, EdgeMission[]> = {};
  let scene: string | null = null;
  let mission: EdgeMission | null = null;
  for (const line of body.split('\n')) {
    const sceneMatch = /^\s{2}([a-z_]+): \[$/.exec(line);
    if (sceneMatch) {
      scene = sceneMatch[1];
      out[scene] = [];
      continue;
    }
    const missionMatch = /^\s{4}\{ stage: (\d), band: '([A-C][12])', title: '([^']+)', objectives: \[$/.exec(line);
    if (missionMatch && scene) {
      mission = { stage: Number(missionMatch[1]), band: missionMatch[2], title: missionMatch[3], objectives: [] };
      out[scene].push(mission);
      continue;
    }
    const objectiveMatch = /^\s{6}\{ id: '([a-z0-9_]+)', text: '([^']+)', detect: '([^']+)' \},$/.exec(line);
    if (objectiveMatch && mission) {
      mission.objectives.push({ id: objectiveMatch[1], text: objectiveMatch[2] });
    }
  }
  return out;
}

describe('mission ladders across the client/edge boundary', () => {
  const edge = edgeMissions();

  it('covers every scene except free_chat, on both sides', () => {
    const expected = SCENARIO_ORDER.filter((k) => k !== 'free_chat').sort();
    expect(Object.keys(edge).sort()).toEqual(expected);
    expect(Object.keys(MISSION_META).sort()).toEqual(expected);
  });

  it('mirrors stages, bands, titles and objectives exactly', () => {
    for (const [scene, ladder] of Object.entries(edge)) {
      const client = MISSION_META[scene as keyof typeof MISSION_META];
      expect(client).toBeDefined();
      expect(ladder.length).toBe(MISSION_STAGE_COUNT);
      expect(client.map((m) => ({ ...m, objectives: [...m.objectives] }))).toEqual(ladder);
    }
  });

  it('the parser actually saw objectives (guards against a silently empty parse)', () => {
    for (const ladder of Object.values(edge)) {
      for (const m of ladder) expect(m.objectives.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('detect strings never ship to the client', () => {
    const client = readFileSync(CLIENT_MODULE, 'utf8');
    // The word appears in the header comment explaining the rule; it must not
    // appear as a field.
    expect(client).not.toMatch(/^\s*detect:/m);
    expect(client).not.toMatch(/detect: '/);
  });
});
