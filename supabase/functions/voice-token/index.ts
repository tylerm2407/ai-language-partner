// Supabase Edge Function: Voice Token
// Generates a LiveKit access token for real-time voice conversation sessions.
// Enforces per-plan daily voice minute limits before issuing a token.
// Deploy: npx supabase functions deploy voice-token

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create } from 'https://deno.land/x/djwt@v3.0.1/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY');
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET');
const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL');

// Plan daily limits — must match lib/plans.ts and ai-chat/index.ts
const PLAN_LIMITS: Record<string, { dailyVoiceMinutes: number | 'unlimited' }> = {
  free:      { dailyVoiceMinutes: 5 },
  basic:     { dailyVoiceMinutes: 20 },
  premium:   { dailyVoiceMinutes: 45 },
  unlimited: { dailyVoiceMinutes: 60 },
};

// ─── Usage helpers ──────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

async function getOrCreateDailyUsage(supabase: ReturnType<typeof createClient>, userId: string) {
  const date = todayUTC();
  const { data } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (data) return data;

  const { data: created, error: insertErr } = await supabase
    .from('daily_usage')
    .upsert({ user_id: userId, date, text_messages: 0, voice_minutes: 0 }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (insertErr) throw insertErr;
  return created;
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

// ─── LiveKit token generation ───────────────────────────────────

async function generateLiveKitToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
  participantIdentity: string,
  metadata: string,
  ttlSeconds: number = 3600,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Import the secret key for HMAC signing
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiSecret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const payload = {
    iss: apiKey,
    sub: participantIdentity,
    iat: now,
    nbf: now,
    exp: now + ttlSeconds,
    jti: `${participantIdentity}-${now}`,
    metadata,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const token = await create(
    { alg: 'HS256', typ: 'JWT' },
    payload,
    cryptoKey,
  );

  return token;
}

// ─── Main handler ───────────────────────────────────────────────

interface VoiceTokenRequest {
  userId: string;
  language?: string;
  level?: string;
  nativeLanguage?: string;
  topic?: string;
  personalityId?: string;
  scenarioId?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      return new Response(
        JSON.stringify({ error: 'LiveKit environment variables not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate auth from the Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { language, level, nativeLanguage, topic, personalityId, scenarioId } = (await req.json()) as VoiceTokenRequest;

    // ── Enforce daily voice minute limit ──────────────────────
    const tier = await getUserTier(supabase, user.id);
    const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;

    if (limits.dailyVoiceMinutes !== 'unlimited') {
      const usage = await getOrCreateDailyUsage(supabase, user.id);
      const usedMinutes = parseFloat(usage.voice_minutes ?? 0);

      if (usedMinutes >= (limits.dailyVoiceMinutes as number)) {
        return new Response(
          JSON.stringify({
            error: "You've reached your daily voice practice limit. Upgrade your plan for more voice minutes.",
            code: 'DAILY_VOICE_LIMIT_REACHED',
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Generate LiveKit token ────────────────────────────────
    const timestamp = Date.now();
    const roomName = `voice-${user.id}-${timestamp}`;

    const metadata = JSON.stringify({
      language: language ?? 'es',
      level: level ?? 'beginner',
      nativeLanguage: nativeLanguage ?? 'en',
      topic: topic ?? 'Free Conversation',
      userId: user.id,
      personalityId: personalityId ?? 'sofia',
      scenarioId: scenarioId ?? null,
    });

    const livekitToken = await generateLiveKitToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      roomName,
      user.id,
      metadata,
    );

    return new Response(
      JSON.stringify({
        token: livekitToken,
        roomName,
        serverUrl: LIVEKIT_URL,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
