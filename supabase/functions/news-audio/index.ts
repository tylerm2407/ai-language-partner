// Supabase Edge Function: news-audio (user-facing)
//
// Hands a signed, short-lived playback URL for a daily article's narration.
// Structurally a copy of ../tts/index.ts: OPTIONS → auth → validate →
// service client → row lookup → burst → work → response, with one typed
// catch at the bottom.
//
// ── Two precedents this function sets, both deliberate ──
//
// 1) It returns a URL, not base64. Every other audio path in the app
//    (../tts/index.ts) base64-encodes the bytes into JSON. A narration is
//    1–3 MB — 4 MB of base64 held in function memory and again on the
//    device — so this mints a signed URL against the private `news-audio`
//    bucket and lets the platform stream it. See signNewsAudioUrl.
//
// 2) It is the first function to mint a signed URL with the service-role
//    client for content the CALLER may read but the caller's own token
//    cannot fetch. The bucket has no storage.objects policies at all, so
//    signing here is the only way in. What gates access is this function's
//    auth check, nothing else — which is why the 401 below comes before
//    anything reads a row.
//
// ── Why there is no quota counter ──
//
// Cost is fixed at GENERATION time: every learner of a (language, tier)
// shares one article and one MP3, so the hundredth listener costs a storage
// read and nothing else. Metering playback against `voice_minutes` would
// drain a paying learner's *conversation* allowance on a two-minute article
// — precisely the leak migration 077 created `lesson_tts_plays` to stop.
// Protection is therefore auth + a burst limit + a 30-minute URL, not quota.
//
// The lazy-generation branch is the one place a caller CAN spend money, and
// it carries its own much tighter burst limit plus an atomic claim.
//
// Deploy: npx supabase functions deploy news-audio

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { isValidUUID } from '../_shared/validation.ts';
import {
  NewsAudioError,
  renderNewsAudio,
  signNewsAudioUrl,
  SIGNED_URL_TTL_SECONDS,
  type NewsRow,
} from './synth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Playback burst limit. 20/minute is far above any human listening pattern
 *  (one tap loads one article) and far below anything that could matter —
 *  a hit is a storage read. It exists to bound a client render loop, not to
 *  ration listening. */
const PLAY_BURST_MAX = 20;
const PLAY_BURST_WINDOW_SECONDS = 60;

/** Lazy-generation burst limit — much tighter, because THIS path spends
 *  provider money. 3 per 5 minutes per user is enough for a person whose
 *  article the cron missed, and useless as a spend amplifier. */
const GENERATE_BURST_MAX = 3;
const GENERATE_BURST_WINDOW_SECONDS = 300;

/** How long a `generating` claim is honoured before another caller may
 *  reclaim it. Long enough for a real render (a 2,000-char narration takes
 *  well under a minute), short enough that a render killed mid-flight does
 *  not wedge the row until the next cron fire. */
const CLAIM_STALE_MINUTES = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface NewsAudioRequest {
  articleId?: string;
}

/** The row shape this function reads. `select('*')` would drag two
 *  translation columns and a vocabulary blob across the wire for nothing. */
const ROW_COLUMNS =
  'id, date, language, title, summary, content, audio_path, audio_status, audio_duration_ms, audio_generated_at';

interface AudioRow extends NewsRow {
  audio_path: string | null;
  audio_status: string | null;
  audio_duration_ms: number | null;
  audio_generated_at: string | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = authUser.userId;

    const { articleId } = (await req.json()) as NewsAudioRequest;
    if (!articleId || !isValidUUID(articleId)) {
      return json({ error: 'articleId must be a UUID' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: row, error: rowError } = await supabase
      .from('daily_news')
      .select(ROW_COLUMNS)
      .eq('id', articleId)
      .maybeSingle();

    if (rowError) {
      console.error('[news-audio] row lookup failed:', rowError.message);
      return json({ error: 'Could not load this article. Try again shortly.' }, 503);
    }
    if (!row) {
      return json({ error: 'Article not found' }, 404);
    }
    const article = row as AudioRow;

    // ── Burst limit ── before any work, including the storage read.
    const playOk = await checkBurstLimit(
      supabase,
      userId,
      'news-audio',
      PLAY_BURST_MAX,
      PLAY_BURST_WINDOW_SECONDS,
    );
    if (!playOk) {
      return json({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }, 429);
    }

    // ── Happy path: already rendered ──
    if (article.audio_status === 'ready' && article.audio_path) {
      const signedUrl = await signNewsAudioUrl(supabase, article.audio_path);
      if (signedUrl) {
        return json({
          status: 'ready',
          url: signedUrl,
          durationMs: article.audio_duration_ms,
          expiresInSeconds: SIGNED_URL_TTL_SECONDS,
        });
      }
      // The row says ready but the object is gone — almost certainly the
      // 30-day sweep on an article someone came back to. Fall through and
      // re-render rather than returning a broken URL; the claim below makes
      // that safe under concurrency.
      console.warn(`[news-audio] ${articleId} is ready but ${article.audio_path} is missing`);
    }

    // ── Lazy generation ── the cron missed this row, or the object is gone.
    const generateOk = await checkBurstLimit(
      supabase,
      userId,
      'news-audio-generate',
      GENERATE_BURST_MAX,
      GENERATE_BURST_WINDOW_SECONDS,
    );
    if (!generateOk) {
      return json(
        { error: 'Still preparing this audio. Try again in a minute.', code: 'RATE_LIMITED' },
        429,
      );
    }

    // Atomic claim. A read-then-write here would let N concurrent listeners
    // each see "not generating" and each trigger a full paid render of the
    // same article. claim_news_audio's predicate re-evaluates under the row
    // lock, so exactly one caller gets true back — the same mechanism as
    // consume_free_avatar (migration 077).
    //
    // It has to be an RPC: PostgREST cannot express a logical OR in the
    // WHERE clause of a mutation. `.update(...).or(...)` compiles to a
    // table-qualified column reference the UPDATE's aliased target does not
    // expose, and Postgres answers 42703 "column daily_news.<x> does not
    // exist" for ANY column, new or old. Verified against this project.
    //
    // A row whose audio_status is NULL is claimable here on purpose, even
    // though the cron skips those. NULL means "back catalogue, do not
    // render in bulk" — it does not mean "refuse a person who explicitly
    // tapped play on an old article".
    const { data: claimed, error: claimError } = await supabase.rpc('claim_news_audio', {
      p_article_id: articleId,
      p_stale_minutes: CLAIM_STALE_MINUTES,
    });

    if (claimError) {
      console.error('[news-audio] claim failed:', claimError.message);
      return json({ error: 'Could not start audio for this article.' }, 503);
    }

    if (claimed !== true) {
      // Someone else is rendering it right now. 202 rather than an error:
      // nothing is wrong, the answer just is not ready. The client polls once.
      return json({ status: 'generating' }, 202);
    }

    try {
      const result = await renderNewsAudio(supabase, {
        id: article.id,
        date: article.date,
        language: article.language,
        title: article.title,
        summary: article.summary,
        content: article.content,
      });
      const signedUrl = await signNewsAudioUrl(supabase, result.audioPath);
      if (!signedUrl) {
        return json({ error: 'Audio was created but could not be served. Try again.' }, 503);
      }
      return json({
        status: 'ready',
        url: signedUrl,
        durationMs: result.durationMs,
        expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      });
    } catch (renderError) {
      // Record the failure so the next caller does not immediately re-spend
      // on the same broken row, and so the cron can see it in the queue.
      // Not swallowed: it is logged here and surfaced to the caller below.
      const message = renderError instanceof Error ? renderError.message : String(renderError);
      console.error(`[news-audio] render failed for ${articleId}:`, message);
      const { error: markError } = await supabase
        .from('daily_news')
        .update({ audio_status: 'failed' })
        .eq('id', articleId);
      if (markError) {
        console.error('[news-audio] could not mark row failed:', markError.message);
      }
      const isPermanent = renderError instanceof NewsAudioError;
      return json(
        {
          error: isPermanent
            ? 'This article cannot be narrated.'
            : 'Could not create the audio. Please try again.',
          code: 'GENERATION_FAILED',
        },
        isPermanent ? 422 : 502,
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[news-audio] unhandled error:', message);
    return json({ error: 'Failed to load the audio. Please try again.' }, 500);
  }
});
