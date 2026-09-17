// Supabase Edge Function: Checkpoint
//
// One ~5 minute, four-strand instrument with two readouts: the learner's CEFR
// band, and the anchor their weekly cohort board is ranked against. Taken once
// at onboarding as a placement test — replacing the bundled trial lesson,
// which measured nothing — and on a seven-day cooldown after that.
//
// It is a STAIRCASE, not a single-level quiz: each strand is asked at the band
// below, at the band, and at the band above, and the result is read off where
// the learner stops passing. See `bandFromStaircase` in checkpoint-core.ts for
// what that replaced (four items, one per strand, all at one band) and why four
// items could confirm a band but never locate one.
//
// Actions:
//   seed   — build the shared item pool for one (language, band). Service-role
//            only; run once per segment, not per learner.
//   start  — open an attempt and return its items, ANSWERS STRIPPED.
//   submit — grade server-side, write the scores, place the learner in a cohort.
//
// WHY GRADING IS SERVER-SIDE
//
// A checkpoint sets the band that picks a leaderboard and the score that ranks
// on it. A client-supplied score is a self-assigned rank, and a client-visible
// answer key is a competitive advantage anyone can query. So items are served
// without `correct_answer`, `accepted_answers` or `audio_text` — for a
// listening item the text IS the answer — and every score is computed here.
//
// QUOTA-EXEMPT, INCLUDING FREE ACCOUNTS
//
// Spend is bounded by cadence, not usage: one placement plus a seven-day
// cooldown is at most ~52 a year, the items are pre-rendered so there is no
// synthesis cost per attempt, and only the writing strand costs a model call
// (two per attempt under the staircase). Metering it would mean a learner who
// ran out of chat could not find out how they were doing, which is the one
// thing the app is for.
//
// That cadence is now ENFORCED (`checkCooldown`). It previously was not: this
// header claimed a monthly limit and nothing in the function or the client
// implemented one, so the real ceiling was `DAILY_CHECKPOINT_GRADES` and a
// learner could take thirty attempts in an afternoon.
//
// Deploy: npx supabase functions deploy checkpoint --project-ref <ref>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { generateValidated } from '../_shared/validated-generate.ts';
import { isValidCefrLevel, isValidLanguage, isValidUUID, sanitizeText } from '../_shared/validation.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import { synthesizeSpeech } from '../_shared/tts-synth.ts';
import type { CEFR } from '../_shared/level-checker.ts';
import {
  COHORT_TARGET_SIZE,
  MAX_ANSWER_CHARS,
  aliasFor,
  bandFromStaircase,
  bandsForAttempt,
  buildCheckpointWritingPrompt,
  composite,
  isCorrect,
  selectAdaptiveItems,
  serveItem,
  strandMeans,
  type Band,
  type GradedItem,
  type PoolItem,
  type Strand,
} from './checkpoint-core.ts';
import { buildSeedPrompt, parseSeeded } from './seed-core.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

const CHECKPOINT_BUCKET = 'checkpoint-audio';

/** Language value used by the seed authorisation probe. Not a real language,
 *  so a probe row that escapes cleanup can never be selected into a pool. */
const SEED_PROBE_MARKER = '__seed_probe__';
const SIGNED_URL_TTL_SECONDS = 1800;

/** A checkpoint is minutes of work; nobody opens four in five minutes. */
const BURST_MAX = 6;
const BURST_WINDOW_SECONDS = 300;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// deno-lint-ignore no-explicit-any
type Db = any;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const action = body.action;

  // Seeding builds shared curriculum and costs real synthesis, so it is not a
  // learner action at all — it requires the service role.
  //
  // Checked by CAPABILITY, and specifically by a WRITE.
  //
  // Two wrong ways to do this, both tried:
  //   - Comparing the bearer to SUPABASE_SERVICE_ROLE_KEY. A project can hold
  //     more than one valid service key (this one has a legacy JWT and the
  //     newer secret-key format), so a string compare rejects an authorised
  //     caller holding the other one.
  //   - Probing with a SELECT. An RLS-denied read returns an EMPTY RESULT, not
  //     an error, so the anon key sailed through and could trigger 48 model
  //     generations and 12 syntheses. That is the hole this replaced.
  //
  // A write is unambiguous: `checkpoint_items` has RLS on with no policies, so
  // an INSERT errors for every client role and succeeds only for a caller that
  // bypasses RLS. Claim-checking the JWT would not do — an unsigned `role`
  // claim is trivially forged.
  if (action === 'seed') {
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!bearer) return json({ error: 'Unauthorized' }, 401);

    const probeId = crypto.randomUUID();
    const asCaller = createClient(SUPABASE_URL, bearer);
    const { error: probeError } = await asCaller.from('checkpoint_items').insert({
      id: probeId,
      language: SEED_PROBE_MARKER,
      band: 'A1',
      strand: 'reading',
      prompt: SEED_PROBE_MARKER,
    });
    // Cleaned up with the service client either way: if the caller was
    // authorised the row exists, and a stray probe row must not sit in a pool.
    await supabase.from('checkpoint_items').delete().eq('id', probeId);
    if (probeError) {
      // Logged, never returned. The 401 body stays bland because this endpoint
      // is reachable by anyone — but throwing the reason away entirely made a
      // failed seed run indistinguishable from a wrong key, a schema drift, or
      // an outage, and cost an hour of guessing at exactly that. The operator
      // running a seed can read this in the function logs; the caller cannot.
      console.warn('[checkpoint] seed probe rejected:', probeError.message);
      return json({ error: 'Unauthorized' }, 401);
    }

    return handleSeed(supabase, body);
  }

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return json({ error: 'Unauthorized' }, 401);

  const burstOk = await checkBurstLimit(
    supabase, authUser.userId, 'checkpoint', BURST_MAX, BURST_WINDOW_SECONDS,
  );
  if (!burstOk) {
    return json({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }, 429);
  }

  if (action === 'start') return handleStart(supabase, authUser.userId, body);
  if (action === 'submit') return handleSubmit(supabase, authUser.userId, body);
  return json({ error: 'Unknown action' }, 400);
});

// ─── seed ──────────────────────────────────────────────────────────────────

async function handleSeed(supabase: Db, body: Record<string, unknown>): Promise<Response> {
  const language = String(body.language ?? '');
  const band = String(body.band ?? '');
  if (!isValidLanguage(language) || !isValidCefrLevel(band)) {
    return json({ error: 'Invalid request' }, 400);
  }
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  const { count } = await supabase
    .from('checkpoint_items')
    .select('id', { count: 'exact', head: true })
    .eq('language', language)
    .eq('band', band);
  if ((count ?? 0) > 0 && body.force !== true) {
    return json({ seeded: 0, existing: count, skipped: true });
  }

  const result = await generateValidated({
    fn: 'checkpoint-seed',
    targetLevel: band as CEFR,
    language,
    safetyRetries: 1,
    skipLevelCheck: true,
    fallback: () => Promise.resolve(''),
    generate: async () => {
      const response = await providerFetch(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: TEXT_MODEL,
            // 3000, not 8000. A checkpoint is a progress summary the learner reads in a
            // sitting, and output runs $5/MTok against $1 for input — so this ceiling
            // cost more than everything fed into it. 8000 tokens is ~6,000 words of
            // report nobody asked for.
            // 8000, and it must stay there. A cost-optimisation pass cut this to
            // 3000 with a comment about "a progress summary the learner reads in
            // a sitting" — but this call does not write a summary, it writes the
            // whole 48-item pool for one (language, band). The ceiling silently
            // broke seeding for every band above A1: A1 items are short enough to
            // fit, everything longer got truncated mid-JSON, `JSON.parse` threw,
            // and the caller saw a bland 502 SEED_FAILED with nothing in the logs.
            //
            // Seeding is a once-per-segment operation — 54 of them, ever — so the
            // ceiling is worth at most a couple of dollars in total even if every
            // call ran to the limit. Do not "optimise" it again without seeding a
            // C2 segment to prove the new ceiling holds.
            max_tokens: 8000,
            system: buildSeedPrompt(language, band),
            messages: [{ role: 'user', content: `Generate the ${language} ${band} item pool.` }],
          }),
        },
        { provider: 'anthropic', timeoutMs: PROVIDER_TIMEOUT_MS.textLong },
      );
      if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
      const data = await response.json();
      const text = (data.content?.[0]?.text ?? '').trim();
      if (!text) throw new Error('Empty completion');
      return text;
    },
  });

  if (result.usedFallback || !result.text) {
    return json({ error: 'Seeding is unavailable right now.', code: 'SEED_UNAVAILABLE' }, 503);
  }

  let parsed: unknown;
  try {
    const t = result.text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  } catch (err) {
    // Every seed exit logs its reason. A bare 502 made a truncated completion,
    // a model outage and a wrong key indistinguishable from each other, and
    // that ambiguity cost two separate debugging rounds on this one function.
    console.error(
      `[checkpoint] seed parse failed for ${language} ${band} (${result.text.length} chars):`,
      (err as Error).message,
    );
    return json({ error: 'Seeding produced unusable output.', code: 'SEED_FAILED' }, 502);
  }

  const items = parseSeeded(parsed);
  if (items.length === 0) {
    // Parsed but nothing usable: the model returned a shape `parseSeeded`
    // rejects wholesale. Logging a slice of what arrived is the only way to
    // tell that from an empty completion without reproducing it.
    console.error(
      `[checkpoint] seed parsed but no items survived for ${language} ${band}:`,
      result.text.slice(0, 400),
    );
    return json({ error: 'Seeding produced no usable items.', code: 'SEED_FAILED' }, 502);
  }

  const rows: Record<string, unknown>[] = [];
  for (const item of items) {
    let audioPath: string | null = null;

    // Listening audio is rendered ONCE, here, because the pool is fixed and
    // shared — so a checkpoint attempt costs no synthesis at all.
    if (item.strand === 'listening' && item.audioText) {
      try {
        const speech = await synthesizeSpeech(item.audioText, language);
        const path = `${language}/${band}/${crypto.randomUUID()}.mp3`;
        const { error } = await supabase.storage
          .from(CHECKPOINT_BUCKET)
          .upload(path, new Uint8Array(speech.audio), { contentType: 'audio/mpeg', upsert: true });
        if (error) throw new Error(error.message);
        audioPath = path;
      } catch (err) {
        // A listening item with no audio is unanswerable, so it is dropped
        // rather than stored broken.
        console.warn('[checkpoint] listening synthesis failed, dropping item:', (err as Error).message);
        continue;
      }
    }

    rows.push({
      language,
      band,
      strand: item.strand,
      prompt: item.prompt,
      audio_text: item.audioText,
      audio_path: audioPath,
      correct_answer: item.correctAnswer,
      accepted_answers: item.acceptedAnswers,
    });
  }

  if (rows.length === 0) {
    console.error(`[checkpoint] seed produced no storable rows for ${language} ${band}`);
    return json({ error: 'No items survived validation.', code: 'SEED_FAILED' }, 502);
  }

  const { error: insertError } = await supabase.from('checkpoint_items').insert(rows);
  if (insertError) {
    console.error('[checkpoint] seed insert failed:', insertError.message);
    return json({ error: 'Seeding failed to save.', code: 'SEED_FAILED' }, 502);
  }

  const byStrand: Record<string, number> = {};
  for (const r of rows) byStrand[String(r.strand)] = (byStrand[String(r.strand)] ?? 0) + 1;
  return json({ seeded: rows.length, byStrand });
}

// ─── cadence ───────────────────────────────────────────────────────────────

/**
 * Days between checkpoints, once the learner has completed one.
 *
 * There was NO server-side cadence gate before this. The function header
 * claimed "one placement plus one a month" and nothing enforced it: the only
 * ceiling on spend was `DAILY_CHECKPOINT_GRADES`, which caps writing grades per
 * day rather than attempts, so a learner could take thirty checkpoints in an
 * afternoon. The staircase raises the per-attempt cost (two writing grades now,
 * not one), so the gate had to become real.
 *
 * Seven days rather than the thirty the header claimed, deliberately. The
 * staircase moves at most one band per attempt, so a learner placed two bands
 * wrong needs two attempts to converge; at a monthly cadence that is two months
 * spent looking at a level that is wrong, on the one screen whose entire job is
 * to be right about it. A week bounds the worst case at ~52 attempts a year —
 * ~104 writing grades, which is inside a single day's grade allowance.
 *
 * The first checkpoint in a language has NO cooldown. An unassessed learner
 * taking the test is exactly the path this work exists to open, and making them
 * wait for a level they have never had would be the old dead end with a timer
 * on it.
 */
const CHECKPOINT_COOLDOWN_DAYS = 7;

/**
 * 429 with the wait remaining, or null to proceed.
 *
 * Reads only COMPLETED attempts: an abandoned checkpoint must not lock the
 * learner out for a week, and the deterministic rotation already means
 * abandoning cannot reroll into an easier set.
 */
async function checkCooldown(
  supabase: Db,
  userId: string,
  language: string,
): Promise<Response | null> {
  const { data: last } = await supabase
    .from('checkpoints')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('language', language)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last?.completed_at) return null;

  const elapsedMs = Date.now() - new Date(last.completed_at as string).getTime();
  const cooldownMs = CHECKPOINT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  if (elapsedMs >= cooldownMs) return null;

  const daysLeft = Math.max(1, Math.ceil((cooldownMs - elapsedMs) / (24 * 60 * 60 * 1000)));
  return json(
    {
      error: `You can take the level test again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
      code: 'COOLDOWN',
      daysLeft,
    },
    429,
  );
}

// ─── start ─────────────────────────────────────────────────────────────────

async function handleStart(supabase: Db, userId: string, body: Record<string, unknown>): Promise<Response> {
  const language = String(body.language ?? '');
  const band = String(body.band ?? '');
  const kind = body.kind === 'placement' ? 'placement' : 'monthly';
  if (!isValidLanguage(language) || !isValidCefrLevel(band)) {
    return json({ error: 'Invalid request' }, 400);
  }

  const cooldown = await checkCooldown(supabase, userId, language);
  if (cooldown) return cooldown;

  // The staircase asks each strand at the band below, at the band, and at the
  // band above, so the pool query spans the spread rather than one band. A band
  // in the spread that has never been seeded simply contributes no rungs — see
  // `bandFromStaircase`, which falls back to the single-band rule rather than
  // freezing the learner when the spread collapses to one rung.
  const { data: pool } = await supabase
    .from('checkpoint_items')
    .select('id, strand, band, prompt, audio_text, audio_path, correct_answer, accepted_answers, options')
    .eq('language', language)
    .in('band', bandsForAttempt(band as Band));

  if (!pool || pool.length === 0) {
    return json({ error: 'No checkpoint is available for this level yet.', code: 'NO_POOL' }, 404);
  }

  // Rotate on how many the learner has already taken, so the nth attempt
  // always gets the nth item and abandoning cannot reroll into an easier set.
  const { count: priorAttempts } = await supabase
    .from('checkpoints')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('language', language);

  const chosen = selectAdaptiveItems(pool as PoolItem[], band as Band, priorAttempts ?? 0);
  if (chosen.length === 0) {
    return json({ error: 'No checkpoint is available for this level yet.', code: 'NO_POOL' }, 404);
  }

  const { data: attempt, error } = await supabase
    .from('checkpoints')
    .insert({
      user_id: userId,
      language,
      band,
      kind,
      item_ids: chosen.map((i) => i.id),
    })
    .select('id')
    .single();
  if (error) {
    console.error('[checkpoint] attempt insert failed:', error.message);
    return json({ error: 'Could not start the checkpoint.', code: 'START_FAILED' }, 502);
  }

  // Signed URLs for the listening items only. The bucket is private, so this
  // is the only way in, and it expires.
  const served = await Promise.all(
    chosen.map(async (item) => {
      const base = serveItem(item);
      const path = (item as PoolItem & { audio_path?: string | null }).audio_path;
      if (item.strand !== 'listening' || !path) return base;
      const { data: signed } = await supabase.storage
        .from(CHECKPOINT_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      return { ...base, audioUrl: signed?.signedUrl ?? null };
    }),
  );

  return json({ checkpointId: attempt.id, band, kind, items: served });
}

// ─── submit ────────────────────────────────────────────────────────────────

/** Writing grades per learner per day, every tier. One Haiku call each; a
 *  placement test needs a handful, and this was the only paid call in the
 *  app with no daily ceiling at all. */
const DAILY_CHECKPOINT_GRADES = 30;

async function gradeWriting(
  supabase: Db,
  userId: string,
  response: string,
  language: string,
  band: string,
  prompt: string,
): Promise<number | null> {
  if (!ANTHROPIC_API_KEY) return null;
  const { data: allowed, error: quotaErr } = await supabase.rpc('consume_daily_quota', {
    p_user_id: userId,
    p_counter: 'checkpoint_grades',
    p_limit: DAILY_CHECKPOINT_GRADES,
  });
  if (quotaErr) {
    // Fail CLOSED: an outage in the meter is not a reason to grade unmetered.
    console.error('[checkpoint] consume_daily_quota failed:', quotaErr.message);
    return null;
  }
  if (allowed !== true) {
    console.warn(`[checkpoint] daily writing-grade cap reached for ${userId}; writing left ungraded`);
    return null;
  }
  const result = await generateValidated({
    fn: 'checkpoint-writing',
    targetLevel: band as CEFR,
    language,
    safetyRetries: 1,
    skipLevelCheck: true,
    fallback: () => Promise.resolve(''),
    generate: async () => {
      const res = await providerFetch(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: TEXT_MODEL,
            max_tokens: 100,
            system: buildCheckpointWritingPrompt(language, band, prompt),
            messages: [{ role: 'user', content: response }],
          }),
        },
        { provider: 'anthropic', timeoutMs: PROVIDER_TIMEOUT_MS.textShort },
      );
      if (!res.ok) throw new Error(`Anthropic ${res.status}`);
      const data = await res.json();
      const text = (data.content?.[0]?.text ?? '').trim();
      if (!text) throw new Error('Empty completion');
      return text;
    },
  });

  if (result.usedFallback || !result.text) return null;
  try {
    const t = result.text;
    const parsed = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    const score = Number(parsed.score);
    if (!Number.isFinite(score)) return null;
    return Math.min(1, Math.max(0, score));
  } catch {
    return null;
  }
}

/**
 * Put the learner in a cohort for their language and band.
 *
 * Joins the smallest cohort under target size, creating one when every
 * existing cohort is full. Moving band means a new cohort — the whole premise
 * is that you are compared with people at your level.
 */
async function placeInCohort(supabase: Db, userId: string, language: string, band: Band): Promise<void> {
  // Every cohort this learner is in for THIS language. A learner belongs to
  // exactly one: bands move, and without this a demotion followed by a
  // promotion leaves them on the old board forever as a member who never does
  // anything, inflating its roster and their own history.
  const { data: current } = await supabase
    .from('cohort_members')
    .select('cohort_id, cohorts!inner(id, language, band)')
    .eq('user_id', userId)
    .eq('cohorts.language', language);

  const stale: string[] = [];
  let alreadyRight = false;
  for (const row of current ?? []) {
    const c = row.cohorts as unknown as { band: string };
    if (c.band === band) alreadyRight = true;
    else stale.push(row.cohort_id as string);
  }

  if (stale.length > 0) {
    const { error } = await supabase
      .from('cohort_members')
      .delete()
      .eq('user_id', userId)
      .in('cohort_id', stale);
    if (error) console.error('[checkpoint] leaving stale cohorts failed:', error.message);
  }

  if (alreadyRight) return;

  const { data: candidates } = await supabase
    .from('cohorts')
    .select('id, cohort_members(count)')
    .eq('language', language)
    .eq('band', band);

  let target: string | null = null;
  let smallest = COHORT_TARGET_SIZE;
  for (const c of candidates ?? []) {
    const size = (c.cohort_members?.[0]?.count as number) ?? 0;
    if (size < smallest) {
      smallest = size;
      target = c.id as string;
    }
  }

  if (!target) {
    const { data: created, error } = await supabase
      .from('cohorts')
      .insert({ language, band })
      .select('id')
      .single();
    if (error) {
      console.error('[checkpoint] cohort create failed:', error.message);
      return;
    }
    target = created.id as string;
  }

  const { error } = await supabase
    .from('cohort_members')
    .upsert(
      { cohort_id: target, user_id: userId, alias: aliasFor(userId) },
      { onConflict: 'cohort_id,user_id' },
    );
  if (error) console.error('[checkpoint] cohort join failed:', error.message);
}

/**
 * Append a row to `level_history` when this attempt CHANGED the tested band.
 *
 * One row per change, not per attempt. A learner who tests at B1 four times
 * running has one history row, because four identical measurements are one
 * fact; `checkpoints` already keeps every attempt for anyone who wants the
 * scores behind it.
 *
 * `previous_band` comes from the last recorded row rather than from
 * `attempt.band`. The attempt's band is where the instrument was POINTED —
 * seeded from the learner's self-declaration at onboarding, and unchanged
 * between attempts — so reading it would record "B1, previously B1" on a real
 * promotion. Null on the first row: there was nothing before it.
 *
 * Failure is logged and swallowed. The learner's band, scores and cohort are
 * already written at this point, and losing one history row is not worth
 * turning a completed checkpoint into an error the learner has to retake.
 */
async function recordLevelChange(
  supabase: Db,
  userId: string,
  language: string,
  band: Band,
  checkpointId: string,
): Promise<void> {
  const { data: previous } = await supabase
    .from('level_history')
    .select('band')
    .eq('user_id', userId)
    .eq('language', language)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousBand = typeof previous?.band === 'string' ? previous.band : null;
  if (previousBand === band) return;

  const { error } = await supabase.from('level_history').insert({
    user_id: userId,
    language,
    band,
    previous_band: previousBand,
    source: 'test',
    checkpoint_id: checkpointId,
  });
  if (error) console.error('[checkpoint] level_history insert failed:', error.message);
}

async function handleSubmit(supabase: Db, userId: string, body: Record<string, unknown>): Promise<Response> {
  const checkpointId = String(body.checkpointId ?? '');
  if (!isValidUUID(checkpointId)) return json({ error: 'Invalid request' }, 400);

  const { data: attempt } = await supabase
    .from('checkpoints')
    .select('id, user_id, language, band, item_ids, started_at, completed_at')
    .eq('id', checkpointId)
    .maybeSingle();

  if (!attempt || attempt.user_id !== userId) return json({ error: 'Not found' }, 404);
  if (attempt.completed_at) return json({ error: 'Already submitted.', code: 'ALREADY_DONE' }, 409);

  const answers = (body.answers ?? {}) as Record<string, unknown>;

  const { data: items } = await supabase
    .from('checkpoint_items')
    .select('id, strand, band, prompt, audio_text, correct_answer, accepted_answers, options')
    .in('id', attempt.item_ids as string[]);

  // One graded entry per SERVED item, keeping its band. The band is what makes
  // the result a measurement rather than a nudge — see `bandFromStaircase`.
  // A blank answer is `null`, never 0: an unanswered rung is not a failed one,
  // and the difference decides whether the learner can be demoted on it.
  const graded: GradedItem[] = [];
  const served = ((items ?? []) as PoolItem[]).slice();

  for (const item of served) {
    if (item.strand === 'speaking') continue; // scored from pronunciation_scores below
    const given = answers[item.id];
    const answer = typeof given === 'string' ? sanitizeText(given, MAX_ANSWER_CHARS) : '';
    if (!answer) {
      graded.push({ strand: item.strand, band: item.band, score: null });
      continue;
    }

    if (item.strand === 'listening' || item.strand === 'reading') {
      graded.push({ strand: item.strand, band: item.band, score: isCorrect(answer, item) ? 1 : 0 });
    } else if (item.strand === 'writing') {
      const score = await gradeWriting(
        supabase,
        userId,
        answer,
        attempt.language as string,
        // Graded AGAINST THE ITEM'S band, not the attempt's. The staircase asks
        // writing at two bands and a B2 task judged against a B1 rubric would
        // score high for the wrong reason, which would promote on nothing.
        item.band,
        item.prompt,
      );
      graded.push({ strand: 'writing', band: item.band, score });
    }
  }

  // Speaking is scored by `score-pronunciation`, which the client calls with
  // source 'checkpoint' and which writes to `pronunciation_scores` under the
  // service role. Read back rather than trusting a client-supplied number: a
  // self-reported speaking score is a self-assigned leaderboard rank.
  //
  // Attempts are matched to rungs by `expected_text`, which the checkpoint
  // screen sets to the item's own prompt — so two speaking rungs in one attempt
  // are attributed to the right band instead of the newest row standing in for
  // both. `limit` is generous because a learner may re-record a rung; the
  // LATEST row per prompt wins (rows come back newest first).
  const { data: spokenRows } = await supabase
    .from('pronunciation_scores')
    .select('score, expected_text, created_at')
    .eq('user_id', userId)
    .eq('source', 'checkpoint')
    .gte('created_at', attempt.started_at as string)
    .order('created_at', { ascending: false })
    .limit(20);

  const spokenByPrompt = new Map<string, number>();
  for (const row of spokenRows ?? []) {
    const text = typeof row.expected_text === 'string' ? row.expected_text : null;
    if (!text || spokenByPrompt.has(text)) continue;
    // `pronunciation_scores.score` is a smallint 0–100 (migration 089; see
    // `calculatePronunciationScore` in score-pronunciation/scoring.ts), while
    // `composite` and SPEAKING_PASS_SCORE (0.7) speak 0–1. This used to clamp
    // the raw column as if it were already 0–1, so every real score above 1
    // became exactly 1.0 and the speaking strand passed unconditionally. The
    // clamp stays, for a malformed row.
    if (typeof row.score === 'number') {
      spokenByPrompt.set(text, Math.min(1, Math.max(0, row.score / 100)));
    }
  }

  for (const item of served) {
    if (item.strand !== 'speaking') continue;
    graded.push({ strand: 'speaking', band: item.band, score: spokenByPrompt.get(item.prompt) ?? null });
  }

  const scores = strandMeans(graded);
  const value = composite(scores);
  const newBand = bandFromStaircase(attempt.band as Band, graded);

  const { error: updateError } = await supabase
    .from('checkpoints')
    .update({
      completed_at: new Date().toISOString(),
      listening_score: scores.listening ?? null,
      reading_score: scores.reading ?? null,
      speaking_score: scores.speaking ?? null,
      writing_score: scores.writing ?? null,
      composite: value,
    })
    .eq('id', checkpointId);
  if (updateError) {
    console.error('[checkpoint] score write failed:', updateError.message);
    return json({ error: 'Could not save your checkpoint.', code: 'SUBMIT_FAILED' }, 502);
  }

  await placeInCohort(supabase, userId, attempt.language as string, newBand);
  await recordLevelChange(
    supabase,
    userId,
    attempt.language as string,
    newBand,
    checkpointId,
  );

  return json({
    composite: value,
    band: newBand,
    movedFrom: attempt.band,
    scores: {
      listening: scores.listening ?? null,
      reading: scores.reading ?? null,
      speaking: scores.speaking ?? null,
      writing: scores.writing ?? null,
    },
  });
}
