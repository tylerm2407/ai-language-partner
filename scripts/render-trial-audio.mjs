#!/usr/bin/env node
/**
 * Render the tutor-voice clips for the bundled onboarding topic packs, then
 * regenerate `components/onboarding/topic-packs/audio-manifest.ts` from the
 * files that actually exist on disk.
 *
 * WHY A SCRIPT AND NOT RUNTIME TTS — the trial lesson plays before the learner
 * has an account, and the `tts` edge function requires a JWT. Pre-rendering is
 * the only way a listening exercise can exist pre-auth (see
 * `components/onboarding/topic-packs/spec.ts`). It also means the clips cost
 * money exactly once, at build time, instead of once per install.
 *
 * WHY IT TALKS TO THE DEPLOYED FUNCTION — the voice a learner hears in the
 * trial has to be the same voice they hear in lesson one, and that voice is
 * decided by `FISH_VOICE_MAP`, `VOICE_MAP` and the `lesson` synthesis profile,
 * all of which live in the function. Reimplementing the provider call here
 * would mean two definitions of "the tutor's voice" drifting apart.
 *
 *   SUPABASE_URL         https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY    publishable key
 *   FLUENCI_EMAIL        an account to sign in as (the function needs a JWT,
 *   FLUENCI_PASSWORD     and meters the clip against that account's quota)
 *
 * Usage:
 *   node scripts/render-trial-audio.mjs --dry-run     # list work + size estimate
 *   node scripts/render-trial-audio.mjs               # render missing clips
 *   node scripts/render-trial-audio.mjs --manifest    # regenerate manifest only
 *   node scripts/render-trial-audio.mjs --only es,fr  # limit to some languages
 *
 * DO NOT run this casually. Every clip is a real paid synthesis metered on the
 * signed-in account's `lesson_tts_plays` allowance, and the cache is
 * content-addressed server-side, so a re-run after an edit to one word pays
 * only for that word — but a re-run after changing the voice pays for all 180.
 *
 * Requires Node >= 22.6: the pack data lives in `.ts` files and is imported
 * with `--experimental-strip-types`, which the script re-execs itself to get.
 * The data files use `import type` only, so stripping leaves no imports to
 * resolve — that is a constraint on those files, not an accident.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const PACKS_DIR = join(REPO_ROOT, 'components', 'onboarding', 'topic-packs');
const AUDIO_ROOT = join(REPO_ROOT, 'assets', 'audio', 'trial');
const MANIFEST_PATH = join(PACKS_DIR, 'audio-manifest.ts');

const LANGUAGES = ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru'];
const TOPICS = ['travel', 'family', 'work', 'media_culture', 'housing_admin'];
const EXPORT_NAMES = {
  es: 'ES_PACKS', fr: 'FR_PACKS', de: 'DE_PACKS', it: 'IT_PACKS', pt: 'PT_PACKS',
  ja: 'JA_PACKS', ko: 'KO_PACKS', zh: 'ZH_PACKS', ru: 'RU_PACKS',
};

/** Rough mp3 size for one A1 word or short sentence at the lesson profile. */
const ESTIMATED_BYTES_PER_CLIP = 20 * 1024;

// ── argv ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const MANIFEST_ONLY = args.includes('--manifest');
const FORCE = args.includes('--force');
const onlyArg = args.find((a) => a.startsWith('--only'));
const ONLY = onlyArg
  ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : LANGUAGES;

for (const code of ONLY) {
  if (!LANGUAGES.includes(code)) {
    console.error(`Unknown language "${code}". Known: ${LANGUAGES.join(', ')}`);
    process.exit(1);
  }
}

// ── type stripping ──────────────────────────────────────────────────────────

/**
 * Re-exec under `--experimental-strip-types` so the `.ts` pack files import.
 * Checked by probing the flag rather than parsing the version string, because
 * the flag moved from opt-in to default across the 22.x line.
 */
function ensureTypeStripping() {
  if (process.env.FLUENCI_TRIAL_AUDIO_RESPAWNED === '1') return;
  const probe = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '-e', '""'],
    { encoding: 'utf8' },
  );
  const flag = probe.status === 0 ? ['--experimental-strip-types'] : [];
  const result = spawnSync(
    process.execPath,
    [...flag, '--no-warnings', fileURLToPath(import.meta.url), ...args],
    { stdio: 'inherit', env: { ...process.env, FLUENCI_TRIAL_AUDIO_RESPAWNED: '1' } },
  );
  process.exit(result.status ?? 1);
}

// ── pack loading ────────────────────────────────────────────────────────────

/**
 * Every clip that should exist: one per word and one per sentence, for each
 * language × topic. 9 × 5 × 4 = 180.
 */
async function collectClips(languages) {
  const clips = [];
  for (const language of languages) {
    const url = pathToFileURL(join(PACKS_DIR, `${language}.ts`)).href;
    const mod = await import(url);
    const packs = mod[EXPORT_NAMES[language]];
    if (!packs) throw new Error(`${language}.ts does not export ${EXPORT_NAMES[language]}`);

    for (const topic of TOPICS) {
      const spec = packs[topic];
      if (!spec) throw new Error(`${language}.ts has no "${topic}" pack`);
      spec.words.forEach((word, i) => {
        clips.push({ language, topic, slot: `w${i + 1}`, text: word.target });
      });
      clips.push({ language, topic, slot: 'sentence', text: spec.sentence.target });
    }
  }
  return clips;
}

function filePathFor(clip) {
  return join(AUDIO_ROOT, clip.language, clip.topic, `${clip.slot}.mp3`);
}

function audioKeyFor(clip) {
  return `${clip.language}/${clip.topic}/${clip.slot}`;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// ── synthesis ───────────────────────────────────────────────────────────────

async function signIn() {
  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const email = requireEnv('FLUENCI_EMAIL');
  const password = requireEnv('FLUENCI_PASSWORD');

  // Resolved from the repo's own install so the script cannot drift onto a
  // different client version than the app ships.
  const require = createRequire(join(REPO_ROOT, 'package.json'));
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign-in returned no access token');
  return { url, anonKey, token };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}. See the header of this file.`);
    process.exit(1);
  }
  return value;
}

/**
 * One clip via the deployed `tts` function.
 *
 * `purpose: 'lesson'` is what makes this the SAME audio a lesson would play:
 * it selects the higher-fidelity synthesis profile, the lesson cache
 * namespace, and `asCitationForm` on a bare word (a single word with no
 * terminal punctuation has no prosodic target). `rate: 1` is the canonical
 * lesson speed — the slower rate is a per-learner affordance, not something to
 * bake into the bundle. `preferUrl: false` asks for base64: the function's
 * signed URLs are short-lived and we want the bytes now.
 */
async function synthesise({ url, anonKey, token }, clip) {
  const response = await fetch(`${url}/functions/v1/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      text: clip.text,
      language: clip.language,
      purpose: 'lesson',
      rate: 1,
      preferUrl: false,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`tts ${response.status}: ${body?.error ?? '(no body)'}`);
  }
  if (typeof body?.audioBase64 !== 'string' || body.audioBase64.length === 0) {
    throw new Error('tts returned no audioBase64 — is preferUrl being honoured?');
  }
  return Buffer.from(body.audioBase64, 'base64');
}

// ── manifest ────────────────────────────────────────────────────────────────

/** Walk `assets/audio/trial` and rebuild the manifest from what is there. */
async function regenerateManifest() {
  const entries = [];
  for (const language of LANGUAGES) {
    for (const topic of TOPICS) {
      const dir = join(AUDIO_ROOT, language, topic);
      let files;
      try {
        files = await readdir(dir);
      } catch {
        continue;
      }
      for (const slot of ['w1', 'w2', 'w3', 'sentence']) {
        if (!files.includes(`${slot}.mp3`)) continue;
        entries.push({
          key: `${language}/${topic}/${slot}`,
          path: `../../../assets/audio/trial/${language}/${topic}/${slot}.mp3`,
        });
      }
    }
  }

  const source = await readFile(MANIFEST_PATH, 'utf8');
  const open = '  // --- generated entries go here ---';
  const startMarker = 'const TRIAL_AUDIO_MODULES: Record<string, number> = {';
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Cannot find TRIAL_AUDIO_MODULES in ${MANIFEST_PATH}`);
  const bodyStart = start + startMarker.length;
  const end = source.indexOf('\n};', bodyStart);
  if (end === -1) throw new Error(`Cannot find the end of TRIAL_AUDIO_MODULES in ${MANIFEST_PATH}`);

  const body = entries.length === 0
    ? `\n${open}\n`
    : `\n${entries.map((e) => `  '${e.key}': require('${e.path}'),`).join('\n')}\n`;

  await writeFile(MANIFEST_PATH, source.slice(0, bodyStart) + body + source.slice(end + 1), 'utf8');
  return entries.length;
}

// ── main ────────────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  ensureTypeStripping();

  if (MANIFEST_ONLY) {
    const count = await regenerateManifest();
    console.log(`Manifest regenerated: ${count} clip(s) bundled.`);
    return;
  }

  const clips = await collectClips(ONLY);
  const pending = [];
  for (const clip of clips) {
    if (!FORCE && (await exists(filePathFor(clip)))) continue;
    pending.push(clip);
  }

  console.log(`${clips.length} clip(s) defined across ${ONLY.length} language(s).`);
  console.log(`${clips.length - pending.length} already rendered, ${pending.length} to render.`);
  console.log(
    `Estimated bundle cost once all ${LANGUAGES.length * TOPICS.length * 4} clips exist: ` +
      `${formatSize(LANGUAGES.length * TOPICS.length * 4 * ESTIMATED_BYTES_PER_CLIP)} ` +
      `(at ~${formatSize(ESTIMATED_BYTES_PER_CLIP)} per clip).`,
  );

  if (DRY_RUN) {
    for (const clip of pending) {
      console.log(`  would render ${audioKeyFor(clip)}  "${clip.text}"`);
    }
    console.log('\n--dry-run: nothing was synthesised and no file was written.');
    return;
  }

  if (pending.length === 0) {
    const count = await regenerateManifest();
    console.log(`Nothing to render. Manifest regenerated: ${count} clip(s) bundled.`);
    return;
  }

  const session = await signIn();
  let written = 0;
  let bytes = 0;
  const failures = [];

  for (const clip of pending) {
    const key = audioKeyFor(clip);
    try {
      const audio = await synthesise(session, clip);
      const path = filePathFor(clip);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, audio);
      written += 1;
      bytes += audio.byteLength;
      console.log(`  ✓ ${key}  ${formatSize(audio.byteLength)}  "${clip.text}"`);
    } catch (error) {
      // Not fatal, and NOT swallowed: one language's voice being misconfigured
      // must not throw away the 170 clips that did render, but the run has to
      // end non-zero so CI or a human notices.
      failures.push({ key, message: error instanceof Error ? error.message : String(error) });
      console.error(`  ✗ ${key}  ${error instanceof Error ? error.message : error}`);
    }
  }

  const bundled = await regenerateManifest();
  console.log(
    `\nRendered ${written} clip(s), ${formatSize(bytes)}. Manifest now bundles ${bundled}.`,
  );

  if (failures.length > 0) {
    console.error(`\n${failures.length} clip(s) failed:`);
    for (const failure of failures) console.error(`  ${failure.key}: ${failure.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
