// Supabase Edge Function: Text-to-Speech via ElevenLabs
// Proxies TTS requests to ElevenLabs API and returns base64 JSON.
// Deploy: npx supabase functions deploy tts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_KEY');

// ElevenLabs voice IDs — natural-sounding voices per language.
const VOICE_MAP: Record<string, string> = {
  es: 'EXAVITQu4vr4xnSDxMaL',
  fr: 'EXAVITQu4vr4xnSDxMaL',
  de: 'EXAVITQu4vr4xnSDxMaL',
  it: 'EXAVITQu4vr4xnSDxMaL',
  pt: 'EXAVITQu4vr4xnSDxMaL',
  ja: 'EXAVITQu4vr4xnSDxMaL',
  ko: 'EXAVITQu4vr4xnSDxMaL',
  zh: 'EXAVITQu4vr4xnSDxMaL',
  en: 'EXAVITQu4vr4xnSDxMaL',
};

const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

const PLAN_LIMITS: Record<string, { dailyVoiceMinutes: number | 'unlimited' }> = {
  free:      { dailyVoiceMinutes: 5 },
  basic:     { dailyVoiceMinutes: 20 },
  premium:   { dailyVoiceMinutes: 45 },
  unlimited: { dailyVoiceMinutes: 60 },
};

interface TTSRequest {
  text: string;
  language: string;
  userId?: string;
}

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

async function getUserTier(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data } = await supabase
    .from('subscriptions')
    .select('tier, is_active')
    .eq('user_id', userId)
    .single();

  if (data?.is_active && data.tier) return data.tier;
  return 'free';
}

async function getVoiceMinutesUsed(supabase: ReturnType<typeof createClient>, userId: string): Promise<number> {
  const date = todayUTC();
  const { data } = await supabase
    .from('daily_usage')
    .select('voice_minutes')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  return data?.voice_minutes ?? 0;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  try {
    const { text, language, userId } = (await req.json()) as TTSRequest;

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ELEVENLABS_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!text || text.length === 0) {
      return new Response(
        JSON.stringify({ error: 'text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enforce daily voice minute limits
    if (userId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const tier = await getUserTier(supabase, userId);
      const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;

      if (limits.dailyVoiceMinutes !== 'unlimited') {
        const used = await getVoiceMinutesUsed(supabase, userId);
        if (used >= limits.dailyVoiceMinutes) {
          return new Response(
            JSON.stringify({
              error: "You've reached your daily voice limit. Upgrade your plan for more.",
              code: 'DAILY_VOICE_LIMIT_REACHED',
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const voiceId = VOICE_MAP[language] ?? DEFAULT_VOICE_ID;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text.replace(/\*\*/g, ''),
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    // Return base64-encoded JSON instead of raw binary
    const audioBuffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(audioBuffer);
    const CHUNK = 8192;
    let binary = '';
    for (let i = 0; i < uint8.length; i += CHUNK) {
      binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK));
    }
    const base64 = btoa(binary);

    return new Response(JSON.stringify({ audioBase64: base64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
