// Supabase Edge Function: Voice Session End
// Tracks voice minutes used after a Gemini Live session ends.
// Deploy: npx supabase functions deploy voice-session-end

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, getCorsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SessionEndRequest {
  durationMinutes: number;
}

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req);
  }

  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };
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

    const { durationMinutes } = (await req.json()) as SessionEndRequest;

    if (typeof durationMinutes !== 'number' || durationMinutes < 0 || durationMinutes > 120) {
      return new Response(
        JSON.stringify({ error: 'Invalid duration' }),
        { status: 400, headers }
      );
    }

    // Round up to nearest 0.5 minutes
    const rounded = Math.ceil(durationMinutes * 2) / 2;
    const date = todayUTC();

    // Atomically increment voice_minutes using RPC if available, else upsert
    const { data: usage, error: rpcError } = await supabase.rpc('increment_daily_usage', {
      p_user_id: userId,
      p_date: date,
      p_text_messages: 0,
      p_voice_minutes: rounded,
    });

    if (rpcError) {
      // Fallback: manual upsert
      const { data: existing } = await supabase
        .from('daily_usage')
        .select('voice_minutes')
        .eq('user_id', userId)
        .eq('date', date)
        .single();

      if (existing) {
        await supabase
          .from('daily_usage')
          .update({ voice_minutes: (existing.voice_minutes ?? 0) + rounded })
          .eq('user_id', userId)
          .eq('date', date);
      } else {
        await supabase
          .from('daily_usage')
          .upsert({ user_id: userId, date, text_messages: 0, voice_minutes: rounded }, { onConflict: 'user_id,date' });
      }
    }

    // Get updated remaining minutes
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

    const tier = sub?.is_active && sub.tier ? sub.tier : 'free';
    const { getPlanLimits } = await import('../_shared/plan-limits.ts');
    const limits = getPlanLimits(tier);

    const totalUsed = updatedUsage?.voice_minutes ?? rounded;
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
