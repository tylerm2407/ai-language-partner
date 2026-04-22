// Supabase Edge Function: Daily News (user-facing, read + mark-read only)
//
// The Claude-powered generation path moved to `daily-news-cron`, which is
// triggered by pg_cron at 05:00 Eastern every day. This function now only
// serves shared articles from the `daily_news` table and records per-user
// read state in `user_news_reads`.
//
// GET  ?language=es&tier=easy&date=2026-04-22
//   → { article: DailyNewsRow | null }
//   If date is omitted, returns today's UTC article.
//   If no article exists yet (cron hasn't fired or failed), returns null
//   and the client shows a calm "on its way" state — no error.
//
// POST { action: 'mark-read', articleId: UUID }
//   → { readAt: ISOString }
//   Upserts into user_news_reads. RLS enforces auth.uid() = user_id.
//
// Auth: deployed with verify_jwt: false. User auth for POST is done via
// _shared/auth.ts::getAuthenticatedUser, which works with any JWT signing
// algorithm.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  // Every path requires an authenticated user (both read + mark-read).
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return json({ error: 'Unauthorized' }, 401);
  const userId = authUser.userId;

  // Service-role client so GETs aren't gated by RLS on daily_news (RLS
  // already allows authenticated reads, but using service-role keeps this
  // function symmetric with the cron writer and avoids surprises).
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── GET: return shared article ─────────────────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const date = url.searchParams.get('date') ?? todayUTC();
      const language = url.searchParams.get('language');
      const tier = url.searchParams.get('tier');

      if (!language || !tier) {
        return json({ error: 'Missing required query params: language, tier' }, 400);
      }
      if (tier !== 'easy' && tier !== 'hard') {
        return json({ error: "tier must be 'easy' or 'hard'" }, 400);
      }

      const { data, error } = await supabase
        .from('daily_news')
        .select('*')
        .eq('date', date)
        .eq('language', language)
        .eq('tier', tier)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      return json({ article: data ?? null });
    }

    // ── POST: mark article as read ─────────────────────────────────
    if (req.method === 'POST') {
      let body: { action?: string; articleId?: string };
      try {
        body = await req.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }

      const { action, articleId } = body;
      if (action !== 'mark-read') {
        return json({ error: "Unsupported action. Use { action: 'mark-read', articleId }." }, 400);
      }
      if (!articleId) {
        return json({ error: 'Missing articleId' }, 400);
      }

      // Upsert on (user_id, article_id). If already read, preserve the
      // original read_at timestamp — re-reading doesn't overwrite history.
      const { data, error } = await supabase
        .from('user_news_reads')
        .upsert(
          { user_id: userId, article_id: articleId },
          { onConflict: 'user_id,article_id', ignoreDuplicates: true },
        )
        .select('read_at')
        .maybeSingle();

      if (error) throw error;

      // If ignoreDuplicates skipped the write, maybeSingle returns null —
      // read the existing row so we can return its read_at.
      let readAt: string;
      if (data?.read_at) {
        readAt = data.read_at as string;
      } else {
        const { data: existing, error: exErr } = await supabase
          .from('user_news_reads')
          .select('read_at')
          .eq('user_id', userId)
          .eq('article_id', articleId)
          .single();
        if (exErr) throw exErr;
        readAt = existing.read_at as string;
      }

      return json({ readAt });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});
