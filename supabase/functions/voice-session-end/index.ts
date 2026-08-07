// Supabase Edge Function: Voice Session End
// Returns remaining voice minutes at the end of a voice session.
//
// NOTE: this endpoint does NOT increment usage — it only reads current totals
// and returns remaining minutes so the client can update its UI. Voice minutes
// are metered by `tts` (which calls increment_daily_usage after each successful
// generation) and gated by `transcribe`; both return DAILY_VOICE_LIMIT_REACHED
// when the plan cap is hit. Keeping the increment there and the read here is
// what avoids double-counting.
//
// HISTORY: metering used to live in a `voice-proxy` function that held a
// WebSocket open to Gemini Live. That architecture was replaced by the
// turn-based fish.audio TTS + transcribe loop, and voice-proxy was deleted
// (source recoverable at 21cabe2^). Nothing calls this endpoint today either —
// it is retained only as the limit-check surface if live voice returns.
//
// Deploy: npx supabase functions deploy voice-session-end

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getUserToday } from '../_shared/user-day.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Authenticate
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers }
      );
    }
    const userId = authUser.userId;

    // Accept the body but ignore durationMinutes — voice-proxy is the
    // source of truth for billing. We parse it to keep the API compatible.
    await req.json().catch(() => ({}));

    // Day key must match what increment_daily_usage writes (user-local
    // midnight rollover, migration 044) — not UTC.
    const date = await getUserToday(supabase, userId);

    // Read current usage (already incremented by voice-proxy)
    const { data: updatedUsage } = await supabase
      .from('daily_usage')
      .select('voice_minutes')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, is_active')
      .eq('user_id', userId)
      .single();

    const tier = sub?.is_active && sub.tier ? sub.tier : 'starter';
    const { getPlanLimits } = await import('../_shared/plan-limits.ts');
    const limits = getPlanLimits(tier);

    const totalUsed = updatedUsage?.voice_minutes ?? 0;
    // dailyVoiceMinutes is always a finite number — no unlimited tier exists
    // (see _shared/plan-limits.ts). The client's `number | 'unlimited'`
    // union still accepts a plain number.
    const remainingMinutes = Math.max(0, limits.dailyVoiceMinutes - totalUsed);

    return new Response(
      JSON.stringify({ remainingMinutes, totalUsedToday: totalUsed }),
      { headers }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[voice-session-end] unhandled error:', message);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch voice usage. Please try again.' }),
      { status: 500, headers }
    );
  }
});
