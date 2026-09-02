/**
 * Secrets, loaded from the repo `.env` and never repeated back.
 *
 * Two things this does that the existing `content-pipeline/shared/supabase-client.ts`
 * loader does not, both because this script is meant to be run from an agent
 * worktree as well as from the checkout root:
 *
 *   1. It walks UP from the script towards the filesystem root looking for a
 *      `.env`, so `.claude/worktrees/<id>/scripts/…` finds the real one at the
 *      repository root instead of silently finding nothing and then failing
 *      with a confusing "missing SUPABASE_URL".
 *   2. It reports presence, never value. `describeSecrets()` returns the words
 *      "present" and "missing" and nothing else. No code path in this script
 *      prints, logs, or writes a key.
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';

/** Names accepted for each secret. Edge-function secrets and the repo `.env`
 *  do not agree on all of them — the function reads `FISH_KEY`, the `.env`
 *  file has `FISH_API_KEY` — so both spellings are honoured. */
const ALIASES = {
  supabaseUrl: ['SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL'],
  serviceRoleKey: ['SUPABASE_SERVICE_ROLE_KEY'],
  anthropicKey: ['ANTHROPIC_API_KEY'],
  fishKey: ['FISH_KEY', 'FISH_API_KEY'],
  fishVoiceMap: ['FISH_VOICE_MAP'],
} as const;

export type SecretName = keyof typeof ALIASES;

let loaded = false;

/** Parse a `.env` into process.env without overwriting anything already set —
 *  a real exported env var must always win over a file on disk. */
export function loadEnv(startDir: string = __dirname): string | null {
  if (loaded) return null;
  loaded = true;

  let dir = resolve(startDir);
  for (let depth = 0; depth < 12; depth++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      for (const line of readFileSync(candidate, 'utf-8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function secret(name: SecretName): string | undefined {
  for (const alias of ALIASES[name]) {
    const value = process.env[alias]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function requireSecret(name: SecretName): string {
  const value = secret(name);
  if (!value) {
    throw new Error(
      `Missing ${ALIASES[name].join(' / ')}. Add it to the repository .env or export it.`,
    );
  }
  return value;
}

/** Presence only. Never the value, never a prefix, never a length. */
export function describeSecrets(): Record<SecretName, 'present' | 'missing'> {
  const out = {} as Record<SecretName, 'present' | 'missing'>;
  for (const name of Object.keys(ALIASES) as SecretName[]) {
    out[name] = secret(name) ? 'present' : 'missing';
  }
  return out;
}

/** Re-exported from keys.ts so there is one definition, not two that can drift.
 *  Type-only, so this adds no runtime dependency on the edge-function modules. */
export type { FishVoiceMap } from './keys';
import type { FishVoiceMap } from './keys';

/**
 * Parse FISH_VOICE_MAP with the same tolerance the edge function has: a
 * malformed value degrades to "no fish voices" rather than throwing, because
 * in the function a bad value must not take voice down. Here it means the
 * script reports every language as unwarmable instead of crashing — which is
 * the same information, delivered as a plan rather than a stack trace.
 */
export function parseFishVoiceMap(raw: string | undefined): FishVoiceMap {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const map: FishVoiceMap = {};
  for (const [lang, byGender] of Object.entries(parsed as Record<string, unknown>)) {
    if (!byGender || typeof byGender !== 'object' || Array.isArray(byGender)) continue;
    const entry: Partial<Record<'male' | 'female', string[]>> = {};
    for (const gender of ['male', 'female'] as const) {
      const ids = (byGender as Record<string, unknown>)[gender];
      const valid = Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [];
      if (valid.length > 0) entry[gender] = valid;
    }
    if (Object.keys(entry).length > 0) map[lang] = entry;
  }
  return map;
}
