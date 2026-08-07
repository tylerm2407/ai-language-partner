// Supabase Edge Function: Voice Session Token
// Authenticates user, checks voice limits, returns remaining minutes.
//
// Despite the name it mints no token: it is purely an auth + quota pre-check.
// It dates from the Gemini Live architecture, where a `voice-proxy` function
// built the voice config and system prompt server-side. That was replaced by
// the turn-based fish.audio TTS + transcribe loop and voice-proxy was deleted
// (source recoverable at 21cabe2^). Nothing in the app calls this endpoint
// today — it is retained only as the limit-check surface if live voice returns.
//
// Deploy: npx supabase functions deploy voice-session-token

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getPlanLimits } from '../_shared/plan-limits.ts';
import { getUserToday } from '../_shared/user-day.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

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

    if (!GOOGLE_AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_AI_API_KEY not configured' }),
        { status: 500, headers }
      );
    }

    // Check subscription tier and voice limits
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, is_active')
      .eq('user_id', userId)
      .single();

    const tier = sub?.is_active && sub.tier ? sub.tier : 'starter';
    const limits = getPlanLimits(tier);

    // Check remaining voice minutes. dailyVoiceMinutes is always a finite
    // number — no unlimited tier exists (see _shared/plan-limits.ts).
    // Day key must match what increment_daily_usage writes (user-local
    // midnight rollover, migration 044) — not UTC.
    const date = await getUserToday(supabase, userId);
    const { data: usage } = await supabase
      .from('daily_usage')
      .select('voice_minutes')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    const usedMinutes = usage?.voice_minutes ?? 0;
    const remainingMinutes = Math.max(0, limits.dailyVoiceMinutes - usedMinutes);

    if (remainingMinutes <= 0) {
      return new Response(
        JSON.stringify({
          error: "You've reached your daily voice minutes limit. Upgrade your plan for more.",
          code: 'DAILY_VOICE_LIMIT_REACHED',
        }),
        { status: 429, headers }
      );
    }

    // Auth and limit checking only — there is no voice config to hand back
    // since the turn-based path builds its prompt in ai-chat and its audio in tts.
    return new Response(
      JSON.stringify({ remainingMinutes }),
      { headers }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[voice-session-token] unhandled error:', message);
    return new Response(
      JSON.stringify({ error: 'Failed to start voice session. Please try again.' }),
      { status: 500, headers }
    );
  }
});
