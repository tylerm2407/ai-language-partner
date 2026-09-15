// Supabase Edge Function: daily-news-cron (service-role only)
//
// Fired by pg_cron at 09:00 and 10:00 UTC daily. Generates shared daily
// news articles across all supported languages × 2 tiers (easy, hard) in
// a single invocation. Idempotent via ON CONFLICT (date, language, tier)
// DO NOTHING — the second cron fire simply skips already-populated rows.
//
// Each article is followed by a second, smaller call for three comprehension
// questions (`questions.ts`, migration 129) through the same safety gate at
// the same band. A failed question call stores the article with
// `questions: null` — the article is the product, the quiz is the evidence
// hook, and losing the former over the latter would be backwards.
//
// Auth: validated inside the function body via bearer = SERVICE_ROLE_KEY.
// Registered with verify_jwt = false in config.toml because user JWTs
// are not involved (pg_cron authenticates as the project's service role
// via Vault-decrypted secret).
//
// Deploy:    deployed via MCP `deploy_edge_function` (or `supabase functions deploy daily-news-cron`).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { generateValidated } from '../_shared/validated-generate.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import type { CEFR } from '../_shared/level-checker.ts';
import { generateQuestions, stripCodeFences, type NewsQuestion } from './questions.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

// Sentinel used by the generateValidated fallback — see generateOne.
const SAFETY_FALLBACK_SENTINEL = '__DAILY_NEWS_SAFETY_FALLBACK__';

// Mirrors client-side SUPPORTED_LANGUAGES in config/app.ts. Kept in sync
// manually; changes are rare enough that duplication is cheaper than the
// cross-runtime import.
const SUPPORTED_LANGUAGES: { code: string; name: string }[] = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ru', name: 'Russian' },
];

type Tier = 'easy' | 'hard';
const TIERS: Tier[] = ['easy', 'hard'];

// Representative CEFR label per tier — stored on the row so the UI can
// display "B1 level" without recomputing from tier.
const TIER_CEFR: Record<Tier, string> = {
  easy: 'B1',
  hard: 'C1',
};

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function tierPromptDescriptor(tier: Tier, languageName: string): string {
  if (tier === 'easy') {
    return `Write a short news article (~180 words) in ${languageName} about a current real-world topic. The article must be appropriate for A1–B1 (beginner to intermediate) language learners: short sentences, common everyday vocabulary, present-tense where possible, avoid idioms and complex subordinate clauses.`;
  }
  return `Write a news article (~250 words) in ${languageName} about a current real-world topic. The article should be appropriate for B2–C1 (upper-intermediate to advanced) language learners: varied sentence structures, idiomatic expressions, lower-frequency vocabulary, nuanced register. Still accessible — avoid highly technical jargon.`;
}

/**
 * One Anthropic text call, fences stripped. Shared by the article and its
 * questions so the two cannot drift on model, headers or timeout.
 */
async function callAnthropic(system: string, user: string, maxTokens: number): Promise<string> {
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
        max_tokens: maxTokens,
        system: [
          { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: user }],
      }),
    },
    { provider: 'anthropic', timeoutMs: PROVIDER_TIMEOUT_MS.textLong },
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errorText.slice(0, 200)}`);
  }
  const data = await response.json();
  const raw: string = data.content?.[0]?.text ?? '';
  return stripCodeFences(raw);
}

interface GeneratedArticle {
  title?: string;
  titleTranslation?: string | null;
  summary?: string;
  content?: string;
  contentTranslation?: string | null;
  vocabularyHighlights?: unknown[];
  sourceTopic?: string | null;
}

async function generateOne(language: { code: string; name: string }, tier: Tier): Promise<GeneratedArticle | null> {
  const systemPrompt = `You are a language-learning content generator. Write news articles appropriate for ${tier === 'easy' ? 'A1–B1 (beginner to intermediate)' : 'B2–C1 (upper-intermediate to advanced)'} level language learners. Adjust vocabulary complexity and sentence structure to match the CEFR range. Always respond with valid JSON only, no markdown or extra text.`;

  const userPrompt = `${tierPromptDescriptor(tier, language.name)} Include 3–5 vocabulary words with English translations and part-of-speech. Return JSON with fields: title, titleTranslation (English), summary (2 sentences in ${language.name}), content, contentTranslation (English), vocabularyHighlights (array of {word, translation, partOfSpeech}), sourceTopic (short English phrase naming the topic).`;

  const { text: cleaned, usedFallback } = await generateValidated({
    fn: 'daily-news-cron',
    targetLevel: TIER_CEFR[tier] as CEFR,
    language: language.code,
    safetyRetries: 2,
    generate: () => callAnthropic(systemPrompt, userPrompt, tier === 'easy' ? 1400 : 1800),
    fallback: async () => SAFETY_FALLBACK_SENTINEL,
  });

  if (usedFallback || cleaned === SAFETY_FALLBACK_SENTINEL) {
    // Safety rejection exhausted retries. Caller skips this row;
    // tomorrow's cron will try again. Avoids shipping a leaked prompt.
    return null;
  }

  let article: GeneratedArticle;
  try {
    article = JSON.parse(cleaned);
  } catch {
    throw new Error(`JSON parse failed: ${cleaned.slice(0, 200)}`);
  }
  return article;
}

/**
 * The comprehension check for a generated article. Null when the article has
 * no usable body (nothing to ask about) or when generation failed for any
 * reason — `generateQuestions` never throws, so the article's insert below is
 * never at the mercy of this call.
 */
async function questionsFor(
  article: GeneratedArticle,
  language: { code: string; name: string },
  tier: Tier,
): Promise<NewsQuestion[] | null> {
  const title = article.title ?? '';
  const content = article.content ?? '';
  if (!content.trim()) return null;
  return generateQuestions({
    article: { title, content },
    language,
    band: TIER_CEFR[tier] as CEFR,
    callModel: (system, user) => callAnthropic(system, user, 900),
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  const startedAt = Date.now();
  const today = todayUTC();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Cron-shared-secret auth ───────────────────────────────────────
  // The secret lives ONLY in Vault (see migration 020 + get_cron_secret
  // RPC). Both pg_cron and this function read the same Vault value —
  // no separate edge-function env var, no service-role-key dependency.
  const { data: secretData, error: secretErr } = await supabase.rpc('get_cron_secret');
  if (secretErr || !secretData) {
    return json({ error: 'Cron secret unavailable — Vault entry missing' }, 500);
  }
  const cronSecret = secretData as string;

  // Validate the secret is strong enough — catch misconfiguration early
  if (!cronSecret || cronSecret.length < 16) {
    console.error('[SECURITY] CRON_SECRET is missing or too short. Set a 32+ byte random value in Vault.');
    return json({ error: 'Cron secret is not configured securely' }, 500);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const providedKey = authHeader.replace(/^Bearer\s+/i, '');

  // Constant-time comparison to prevent timing attacks
  if (!providedKey || providedKey.length !== cronSecret.length) {
    return json({ error: 'Unauthorized — cron invocation only' }, 401);
  }
  const encoder = new TextEncoder();
  const a = encoder.encode(providedKey);
  const b = encoder.encode(cronSecret);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }
  if (mismatch !== 0) {
    return json({ error: 'Unauthorized — cron invocation only' }, 401);
  }

  // Short-circuit: look up all (language, tier) rows that already exist
  // for today in ONE query so we skip duplicates without 18 round-trips.
  const { data: existingRows, error: existingErr } = await supabase
    .from('daily_news')
    .select('language, tier')
    .eq('date', today);

  if (existingErr) {
    return json({ error: `Failed to read existing articles: ${existingErr.message}` }, 500);
  }

  const existingSet = new Set(
    (existingRows ?? []).map((r: { language: string; tier: string }) => `${r.language}:${r.tier}`),
  );

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let withoutQuestions = 0;
  const failures: { language: string; tier: Tier; error: string }[] = [];

  // Build the pending (language, tier) work list, skipping rows that exist.
  const pending: { language: { code: string; name: string }; tier: Tier }[] = [];
  for (const language of SUPPORTED_LANGUAGES) {
    for (const tier of TIERS) {
      if (existingSet.has(`${language.code}:${tier}`)) {
        skipped += 1;
      } else {
        pending.push({ language, tier });
      }
    }
  }

  const processOne = async (language: { code: string; name: string }, tier: Tier): Promise<void> => {
    try {
      const article = await generateOne(language, tier);
      if (!article) {
        // Safety fallback returned null — record as skipped, cron will retry.
        skipped += 1;
        return;
      }

      // Second call, same gate, same band. Null on any failure — see
      // questionsFor. Counted separately in the run summary so a day where
      // every article shipped without a quiz is visible in the logs.
      const questions = await questionsFor(article, language, tier);
      if (questions === null) withoutQuestions += 1;

      const row = {
        date: today,
        language: language.code,
        tier,
        cefr_level: TIER_CEFR[tier],
        title: article.title ?? '',
        title_translation: article.titleTranslation ?? null,
        summary: article.summary ?? '',
        content: article.content ?? '',
        content_translation: article.contentTranslation ?? null,
        vocabulary_highlights: article.vocabularyHighlights ?? [],
        source_topic: article.sourceTopic ?? null,
        questions,
        // Enlist the row in the podcast render queue. Set here, on the
        // insert, rather than as a column DEFAULT — a default would have
        // swept all 2,262 pre-existing rows into the queue too (migration
        // 079). Synthesis itself is daily-news-audio-cron's job, 20 minutes
        // behind this one: inlining it would add minutes to a run that
        // already takes 90–120s, and would let a fish.audio outage stop the
        // articles themselves.
        audio_status: 'pending',
      };

      const { error: insertErr } = await supabase
        .from('daily_news')
        .insert(row);

      if (insertErr) {
        // 23505 = unique_violation — a concurrent fire already inserted.
        // Treat as success.
        if (insertErr.code === '23505') {
          skipped += 1;
        } else {
          failed += 1;
          failures.push({ language: language.code, tier, error: insertErr.message });
        }
      } else {
        generated += 1;
      }
    } catch (err) {
      failed += 1;
      failures.push({
        language: language.code,
        tier,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Bounded concurrency: batches of 3 instead of 18 serial awaits.
  // processOne never rejects (all errors are recorded in `failures`), but
  // allSettled guarantees one bad promise can never kill the whole run.
  const BATCH_SIZE = 3;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    await Promise.allSettled(
      pending.slice(i, i + BATCH_SIZE).map(({ language, tier }) => processOne(language, tier)),
    );
  }

  const durationMs = Date.now() - startedAt;
  console.log(JSON.stringify({
    fn: 'daily-news-cron',
    date: today,
    generated,
    skipped,
    failed,
    withoutQuestions,
    durationMs,
    failures,
  }));

  return json({
    date: today,
    generated,
    skipped,
    failed,
    withoutQuestions,
    durationMs,
    failures,
  });
});
