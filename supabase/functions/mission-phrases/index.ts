// Supabase Edge Function: Mission Phrases
// The 4-6 warm-up phrases a learner sees before a mission starts: the lines
// they will need to complete the mission's objectives, in the target language
// with a native-language meaning, pitched at the mission's CEFR band.
// Deploy: npx supabase functions deploy mission-phrases
//
// Auth: deployed with verify_jwt: false (config.toml). Authentication is
// performed in the body via _shared/auth.ts getAuthenticatedUser(), which
// calls supabase.auth.getUser(token) and works with any JWT signing
// algorithm. Same posture as translate and ai-chat.
//
// NO DAILY METERING, deliberately. The input is entirely ours — a scene key,
// a stage, two language codes from a closed list — so the keyspace is
// curriculum-capped: 8 scenes × 4 stages × language pairs × version. Once a
// tuple has been generated it is served from `mission_phrase_cache` for
// everyone, forever (until the version bumps). A learner cannot spend money
// here beyond the first miss per tuple, which the burst limit bounds. What IS
// gated is the tier: warm-up phrases are part of the paid mission feature, so
// `dailyTextMessages > 0` is required — the same boundary ai-chat draws, and
// it includes a classroom student whose contract grants a text allowance.
//
// NO GENERATION LOCK. Two learners missing the same tuple at the same moment
// both generate; both upserts land on the same primary key; the second
// overwrites the first with an equivalent list. That is a few cents of Haiku
// once per tuple in the life of the app, and a claim/lock would be more code
// than the cost it saves. Idempotent by construction.
//
// A FALLBACK IS NEVER CACHED. `generateValidated` returns pre-authored
// content ('' here) when the provider is down or the output fails safety;
// caching that would serve an empty warm-up to every learner of that tuple
// until someone bumped the version. Fallback and thin lists both answer 502,
// and the next learner tries again.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { resolveEntitlement } from '../_shared/entitlement.ts';
import { getMission, type Mission } from '../_shared/missions.ts';
import { isValidLanguage } from '../_shared/validation.ts';
import { generateValidated } from '../_shared/validated-generate.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import { MISSION_PHRASES_VERSION, missionPhrasesKey } from '../_shared/mission-phrases-key.ts';
import { MIN_PHRASES, normalizePhrases, type MissionPhrase } from './normalize.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

interface MissionPhrasesRequest {
  scenarioKey: string;
  stage: number;
  targetLanguage: string;
  nativeLanguage: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return json({ error: 'Unauthorized' }, 401);

  let body: MissionPhrasesRequest;
  try {
    body = (await req.json()) as MissionPhrasesRequest;
  } catch {
    return json({ error: 'Invalid JSON body', code: 'INVALID_REQUEST' }, 400);
  }
  const { scenarioKey, stage, targetLanguage, nativeLanguage } = body;

  // Every field reaches the cache key or the prompt, so every field is
  // checked against its closed set. `getMission` refuses anything that is
  // not an integer 1..4 of a real scene, and free_chat has no ladder.
  const mission: Mission | null =
    typeof scenarioKey === 'string' ? getMission(scenarioKey, stage) : null;
  if (!mission || !isValidLanguage(targetLanguage) || !isValidLanguage(nativeLanguage)) {
    return json({ error: 'Invalid request', code: 'INVALID_REQUEST' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Burst first: the only paid path here is a cache miss, and this is what
    // bounds how many of those one account can force in a minute.
    const burstOk = await checkBurstLimit(supabase, authUser.userId, 'mission-phrases', 10, 60);
    if (!burstOk) {
      return json({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }, 429);
    }

    const { limits } = await resolveEntitlement(supabase, authUser.userId);
    if (limits.dailyTextMessages <= 0) {
      return json({ error: 'Missions are part of a paid plan.', code: 'MISSION_PAID_ONLY' }, 403);
    }

    if (!ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    }

    const hash = await missionPhrasesKey(scenarioKey, stage, targetLanguage, nativeLanguage);
    const { data: cached, error: cacheErr } = await supabase
      .from('mission_phrase_cache')
      .select('phrases')
      .eq('hash', hash)
      .maybeSingle();
    if (cacheErr) {
      console.warn('[mission-phrases] cache lookup failed (non-fatal):', cacheErr.message);
    }
    if (cached && Array.isArray(cached.phrases)) {
      return json({ phrases: cached.phrases as MissionPhrase[], cached: true });
    }

    const phrases = await generatePhrases(mission, targetLanguage, nativeLanguage);
    if (!phrases) {
      return json(
        { error: 'Warm-up phrases are temporarily unavailable. Please try again.', code: 'PHRASES_UNAVAILABLE' },
        502,
      );
    }

    // Non-fatal: the phrases still ship; the next learner may regenerate.
    const { error: writeErr } = await supabase.from('mission_phrase_cache').upsert(
      {
        hash,
        scenario_key: scenarioKey,
        stage,
        target_language: targetLanguage,
        native_language: nativeLanguage,
        version: MISSION_PHRASES_VERSION,
        phrases,
      },
      { onConflict: 'hash' },
    );
    if (writeErr) {
      console.warn('[mission-phrases] cache write failed (non-fatal):', writeErr.message);
    }

    return json({ phrases, cached: false });
  } catch (error: unknown) {
    // A Postgres or provider message names columns or quotes the prompt —
    // neither is the client's business (CLAUDE.md §6).
    const message = error instanceof Error ? error.message : String(error);
    console.error('[mission-phrases] unhandled error:', message);
    return json({ error: 'Warm-up phrases are temporarily unavailable.', code: 'PHRASES_FAILED' }, 500);
  }
});

/**
 * Null when the model could not be relied on: the safety/provider fallback
 * fired, or fewer than MIN_PHRASES survived normalisation. Never a partial
 * list — the caller must not cache either outcome.
 */
async function generatePhrases(
  mission: Mission,
  targetLanguage: string,
  nativeLanguage: string,
): Promise<MissionPhrase[] | null> {
  const systemPrompt =
    `You write warm-up phrases for a language learner who is about to practise a spoken scene. ` +
    `Respond ONLY with a JSON array of objects with exactly two string keys, "phrase" and "meaning": ` +
    `[{"phrase":"...","meaning":"..."}]. No prose, no code fences, no numbering.`;

  const objectiveLines = mission.objectives.map((o) => `- ${o.text}`).join('\n');
  const userMessage = [
    `Scene: ${mission.title}`,
    `The learner must, in their own words:`,
    objectiveLines,
    '',
    `Write 4 to 6 short phrases the learner will need to do those things. Each "phrase" is in ${targetLanguage}, ` +
      `at CEFR ${mission.band} — natural, everyday, the register a person would actually use in this scene. ` +
      `Each "meaning" is what it means, in ${nativeLanguage}, in a few words. ` +
      `Keep every phrase under 80 characters and every meaning under 120. Cover each objective at least once. ` +
      `Do not number them and do not add anything outside the JSON array.`,
  ].join('\n');

  const { text, usedFallback } = await generateValidated({
    fn: 'mission-phrases',
    targetLevel: mission.band,
    language: targetLanguage,
    safetyRetries: 2,
    generate: async () => {
      const response = await providerFetch(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: TEXT_MODEL,
            max_tokens: 400,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          }),
        },
        { provider: 'anthropic', timeoutMs: PROVIDER_TIMEOUT_MS.textShort },
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      const out = data.content?.[0]?.text ?? '';
      if (!out) throw new Error('Empty response from Claude');
      return out;
    },
    // There is no sensible pre-authored warm-up for an arbitrary tuple; the
    // empty string is the sentinel the caller turns into a 502.
    fallback: async () => '',
  });

  if (usedFallback) return null;
  const phrases = normalizePhrases(text);
  if (phrases.length < MIN_PHRASES) {
    console.warn(`[mission-phrases] only ${phrases.length} phrases survived normalisation; not caching`);
    return null;
  }
  return phrases;
}
