// Supabase Edge Function: Voice Session Token
// Authenticates user, checks voice limits, returns Gemini Live session config.
// The Google AI API key never leaves the server — client gets a session URI.
// Deploy: npx supabase functions deploy voice-session-token

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getPlanLimits } from '../_shared/plan-limits.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

const GEMINI_LIVE_MODEL = 'gemini-2.0-flash-live';

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

    const tier = sub?.is_active && sub.tier ? sub.tier : 'free';
    const limits = getPlanLimits(tier);

    // Check remaining voice minutes
    let remainingMinutes = typeof limits.dailyVoiceMinutes === 'number' ? limits.dailyVoiceMinutes : 60;

    if (limits.dailyVoiceMinutes !== 'unlimited') {
      const date = todayUTC();
      const { data: usage } = await supabase
        .from('daily_usage')
        .select('voice_minutes')
        .eq('user_id', userId)
        .eq('date', date)
        .single();

      const usedMinutes = usage?.voice_minutes ?? 0;
      remainingMinutes = Math.max(0, (limits.dailyVoiceMinutes as number) - usedMinutes);

      if (remainingMinutes <= 0) {
        return new Response(
          JSON.stringify({
            error: "You've reached your daily voice minutes limit. Upgrade your plan for more.",
            code: 'DAILY_VOICE_LIMIT_REACHED',
          }),
          { status: 429, headers }
        );
      }
    }

    // Parse optional body for system prompt context
    let targetLanguage = 'es';
    let level = 'beginner';
    let topic = '';
    try {
      const body = await req.json();
      targetLanguage = body.targetLanguage ?? targetLanguage;
      level = body.level ?? level;
      topic = body.topic ?? topic;
    } catch {
      // No body is fine — defaults are used
    }

    // Build the Gemini Live WebSocket URI with API key
    // Client connects directly to this URI for real-time bidirectional audio
    const sessionUri = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GOOGLE_AI_API_KEY}`;

    // Voice configuration for the client
    const voiceConfig = {
      model: `models/${GEMINI_LIVE_MODEL}`,
      targetLanguage,
      level,
      topic,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Aoede',
            },
          },
        },
      },
    };

    return new Response(
      JSON.stringify({
        sessionUri,
        remainingMinutes,
        voiceConfig,
      }),
      { headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers }
    );
  }
});
