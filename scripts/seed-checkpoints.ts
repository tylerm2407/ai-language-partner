/**
 * Seed the checkpoint item pool for every (language, band) segment.
 *
 * Run with:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-checkpoints.ts
 *
 * Optional filters, for topping up a subset rather than the whole grid:
 *   npx tsx scripts/seed-checkpoints.ts --languages es,fr --bands A1,A2
 *   npx tsx scripts/seed-checkpoints.ts --dry-run
 *
 * ── WHY A SCRIPT ──
 *
 * The `checkpoint` edge function seeds ONE segment per call, because each call
 * is a single model generation plus a dozen TTS syntheses and belongs inside
 * one request's timeout. There are 9 languages × 6 bands = 54 segments, and
 * nobody should run 54 curls by hand.
 *
 * ── IT IS SAFE TO RUN TWICE ──
 *
 * `handleSeed` counts the existing pool for the segment first and returns
 * `{ seeded: 0, skipped: true }` without generating anything when one exists.
 * So a re-run costs nothing for segments already done, and a run interrupted
 * half way can simply be started again. `--force` exists to regenerate a
 * segment deliberately; it does NOT delete the old items, it adds to them, so
 * use it only when you mean to widen a pool.
 *
 * ── SEQUENTIAL, ON PURPOSE ──
 *
 * One segment at a time. Each call spends real money at a provider and
 * synthesises audio; running 54 in parallel would turn a rate limit or a
 * provider outage into 54 failures instead of one, and the whole run is under
 * a dollar, so there is nothing to gain by rushing it.
 */

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Mirrors SUPPORTED_LANGUAGES in config/app.ts. */
const LANGUAGES = ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru'] as const;
/** Mirrors BANDS in supabase/functions/checkpoint/checkpoint-core.ts. */
const BANDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/**
 * Pause between segments.
 *
 * Not a rate limit we have measured — a courtesy gap so a burst of 54 calls
 * does not look like an attack to either provider, and so a failing run is
 * interruptible with Ctrl-C at a predictable point.
 */
const GAP_MS = 1_000;

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : null;
}

const flag = (name: string) => process.argv.includes(`--${name}`);

interface SeedOutcome {
  language: string;
  band: string;
  status: 'seeded' | 'skipped' | 'failed';
  items?: number;
  existing?: number;
  detail?: string;
}

async function seedSegment(language: string, band: string, force: boolean): Promise<SeedOutcome> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/checkpoint`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'seed', language, band, ...(force ? { force: true } : {}) }),
  });

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // A non-JSON body is a gateway or timeout page. Keep the status, which is
    // the only useful thing in it.
  }

  if (!response.ok) {
    return {
      language,
      band,
      status: 'failed',
      // The function never returns a provider message to a caller, so this is
      // its own bland string — enough to tell a 4xx from a 5xx and retry.
      detail: `HTTP ${response.status}${body.code ? ` ${String(body.code)}` : ''}`,
    };
  }
  if (body.skipped === true) {
    return { language, band, status: 'skipped', existing: Number(body.existing ?? 0) };
  }
  return { language, band, status: 'seeded', items: Number(body.seeded ?? 0) };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
      'Missing SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.\n' +
        'Seeding writes the shared item pool, so it needs the service role — the anon key cannot do it.',
    );
    process.exit(1);
  }

  const languages = (arg('languages')?.split(',').map((s) => s.trim()) ?? [...LANGUAGES]).filter(
    (l) => LANGUAGES.includes(l as (typeof LANGUAGES)[number]),
  );
  const bands = (arg('bands')?.split(',').map((s) => s.trim()) ?? [...BANDS]).filter((b) =>
    BANDS.includes(b as (typeof BANDS)[number]),
  );
  const force = flag('force');
  const dryRun = flag('dry-run');

  const segments = languages.flatMap((l) => bands.map((b) => ({ language: l, band: b })));
  console.log(
    `${dryRun ? '[dry run] ' : ''}${segments.length} segment(s): ${languages.join(',')} × ${bands.join(',')}` +
      (force ? '  (force: existing pools will be ADDED TO, not replaced)' : ''),
  );
  if (dryRun) return;

  const outcomes: SeedOutcome[] = [];
  for (const [i, segment] of segments.entries()) {
    const label = `${segment.language} ${segment.band}`.padEnd(6);
    process.stdout.write(`[${String(i + 1).padStart(2)}/${segments.length}] ${label} … `);
    try {
      const outcome = await seedSegment(segment.language, segment.band, force);
      outcomes.push(outcome);
      console.log(
        outcome.status === 'seeded'
          ? `seeded ${outcome.items} items`
          : outcome.status === 'skipped'
            ? `already has ${outcome.existing}, skipped`
            : `FAILED — ${outcome.detail}`,
      );
    } catch (err) {
      // One segment failing must not end the run: the other 53 are independent
      // and a re-run skips whatever already landed.
      outcomes.push({
        language: segment.language,
        band: segment.band,
        status: 'failed',
        detail: err instanceof Error ? err.message : String(err),
      });
      console.log(`FAILED — ${err instanceof Error ? err.message : String(err)}`);
    }
    if (i < segments.length - 1) await new Promise((r) => setTimeout(r, GAP_MS));
  }

  const seeded = outcomes.filter((o) => o.status === 'seeded');
  const failed = outcomes.filter((o) => o.status === 'failed');
  const items = seeded.reduce((sum, o) => sum + (o.items ?? 0), 0);

  console.log(
    `\n${seeded.length} seeded (${items} items), ` +
      `${outcomes.filter((o) => o.status === 'skipped').length} already present, ${failed.length} failed.`,
  );
  if (failed.length > 0) {
    console.log('\nFailed segments — re-run the script to retry just these:');
    for (const f of failed) console.log(`  ${f.language} ${f.band}  ${f.detail}`);
    // Non-zero so a CI or a shell `&&` chain notices.
    process.exit(1);
  }
}

void main();
