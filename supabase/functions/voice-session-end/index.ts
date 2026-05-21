// Supabase Edge Function: Voice Session End
// Returns remaining voice minutes after a Gemini Live session ends.
//
// NOTE: Voice minutes are counted server-side by the voice-proxy edge function
// (tick interval every 60s + fractional remainder on close). This endpoint does
// NOT increment usage — it only reads current totals and returns remaining
// minutes so the client can update its UI. This avoids double-counting.
//
// Deploy: npx supabase functions deploy voice-session-end

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

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

    const date = todayUTC();

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
    const remainingMinutes = limits.dailyVoiceMinutes === 'unlimited'
      ? 'unlimited'
      : Math.max(0, (limits.dailyVoiceMinutes as number) - totalUsed);

    return new Response(
      JSON.stringify({ remainingMinutes, totalUsedToday: totalUsed }),
      { headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers }
    );
  }
});
