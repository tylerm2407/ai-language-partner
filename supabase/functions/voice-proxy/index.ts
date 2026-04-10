// Supabase Edge Function: Voice Proxy
// Server-side WebSocket proxy for Gemini Live API.
// The Google AI API key AND system prompt are constructed server-side.
// Client sends only audio/text input — cannot override model config or prompt.
// Deploy: npx supabase functions deploy voice-proxy

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getPlanLimits } from '../_shared/plan-limits.ts';
import { isValidLanguage, isValidProficiencyLevel, sanitizeText } from '../_shared/validation.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
const GEMINI_LIVE_MODEL = 'gemini-2.0-flash-live';

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  beginner: 'Use very simple vocabulary and short sentences. Speak slowly and clearly.',
  elementary: 'Use basic vocabulary and simple grammar. Keep sentences short.',
  intermediate: 'Use natural conversational language. Introduce some complex grammar.',
  upper_intermediate: 'Use rich vocabulary and complex sentences. Be natural.',
  advanced: 'Speak as a native would. Use idioms and complex structures.',
};

function buildSystemPrompt(targetLanguage: string, level: string, topic: string): string {
  const levelGuide = LEVEL_DESCRIPTIONS[level] ?? LEVEL_DESCRIPTIONS.beginner;
  const topicGuide = topic ? `\nSCENARIO CONTEXT: ${topic}` : '';

  return `You are a warm, fun language practice partner helping a student practice ${targetLanguage}. You're like a friend who happens to speak the language natively.

PROFICIENCY LEVEL: ${level}
${levelGuide}
${topicGuide}

CONVERSATION STYLE:
- Respond primarily in ${targetLanguage}
- Keep responses concise (1-3 sentences)
- Ask ONE follow-up question per turn
- If the student makes an error, naturally recast (rephrase correctly) in your reply
- If the student speaks in English, gently encourage them to try in ${targetLanguage}
- Speak at an appropriate speed for a ${level} learner
- Be encouraging without being over-the-top

SAFETY:
- Stay on topic. Do not discuss anything inappropriate.
- Never generate harmful or offensive content.`;
}

function buildSetupMessage(targetLanguage: string, level: string, topic: string): string {
  return JSON.stringify({
    setup: {
      model: `models/${GEMINI_LIVE_MODEL}`,
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
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(targetLanguage, level, topic) }],
      },
    },
  });
}

/** Only allow audio input and text content messages from client. Block setup overrides. */
function isAllowedClientMessage(raw: string): boolean {
  try {
    const msg = JSON.parse(raw);
    // Allow realtimeInput (audio chunks) and clientContent (text turns)
    if (msg.realtimeInput || msg.clientContent) return true;
    // Block everything else (setup, toolResponse, etc.)
    return false;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  // Only accept WebSocket upgrade requests
  const upgradeHeader = req.headers.get('upgrade') ?? '';
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response(
      JSON.stringify({ error: 'Expected WebSocket upgrade' }),
      { status: 426, headers: jsonHeaders }
    );
  }

  // Parse and validate query params
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const targetLanguage = url.searchParams.get('lang') ?? 'es';
  const level = url.searchParams.get('level') ?? 'beginner';
  const rawTopic = url.searchParams.get('topic') ?? '';

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing token parameter' }),
      { status: 401, headers: jsonHeaders }
    );
  }

  if (!isValidLanguage(targetLanguage)) {
    return new Response(
      JSON.stringify({ error: 'Invalid language' }),
      { status: 400, headers: jsonHeaders }
    );
  }

  if (!isValidProficiencyLevel(level)) {
    return new Response(
      JSON.stringify({ error: 'Invalid proficiency level' }),
      { status: 400, headers: jsonHeaders }
    );
  }

  // Sanitize topic to prevent prompt injection (max 200 chars)
  const topic = sanitizeText(rawTopic, 200);

  // Validate JWT
  const authReq = new Request(req.url, {
    headers: new Headers({ Authorization: `Bearer ${token}` }),
  });
  const authUser = await getAuthenticatedUser(authReq);
  if (!authUser) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: jsonHeaders }
    );
  }

  if (!GOOGLE_AI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_AI_API_KEY not configured' }),
      { status: 500, headers: jsonHeaders }
    );
  }

  // ── Pre-connection rate limit gate ──────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const userId = authUser.userId;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, is_active')
    .eq('user_id', userId)
    .single();

  const tier = sub?.is_active && sub.tier ? sub.tier : 'free';
  const limits = getPlanLimits(tier);

  const todayUTC = new Date().toISOString().split('T')[0];
  const { data: usageRow } = await supabase
    .from('daily_usage')
    .select('voice_minutes')
    .eq('user_id', userId)
    .eq('date', todayUTC)
    .single();

  const currentVoiceMinutes = parseFloat(usageRow?.voice_minutes as string) || 0;
  if (currentVoiceMinutes >= limits.dailyVoiceMinutes) {
    return new Response(
      JSON.stringify({
        error: "You've reached your daily voice practice limit. Upgrade your plan for more.",
        code: 'DAILY_VOICE_LIMIT_REACHED',
      }),
      { status: 429, headers: jsonHeaders }
    );
  }

  // Upgrade the client connection to WebSocket
  const { socket: clientWs, response } = Deno.upgradeWebSocket(req);

  // Connect to Gemini Live server-side (API key stays on the server)
  const geminiUri = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GOOGLE_AI_API_KEY}`;
  let geminiWs: WebSocket | null = null;
  let voiceTickInterval: ReturnType<typeof setInterval> | null = null;
  const sessionStartTime = Date.now();

  clientWs.onopen = () => {
    geminiWs = new WebSocket(geminiUri);

    geminiWs.onopen = () => {
      // Send the server-built setup message to Gemini (client cannot override this)
      geminiWs!.send(buildSetupMessage(targetLanguage, level, topic));

      // ── Periodic tick: increment voice_minutes every 60s ──────
      voiceTickInterval = setInterval(async () => {
        try {
          const date = new Date().toISOString().split('T')[0];
          const { data: usage } = await supabase.rpc('increment_daily_usage', {
            p_user_id: userId,
            p_date: date,
            p_voice_minutes: 1,
          });

          const newTotal = parseFloat(usage?.[0]?.voice_minutes) || 0;
          if (newTotal >= limits.dailyVoiceMinutes) {
            // Notify client and close gracefully
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'voice_limit_reached' }));
              clientWs.close(4029, 'Voice minute limit reached');
            }
            if (voiceTickInterval) clearInterval(voiceTickInterval);
          }
        } catch (err) {
          console.error('[voice-proxy] Tick increment error:', err);
        }
      }, 60_000);
    };

    geminiWs.onmessage = (event) => {
      // Forward Gemini responses to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(event.data);
      }
    };

    geminiWs.onerror = (event) => {
      console.error('[voice-proxy] Gemini WebSocket error:', event);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, 'Upstream error');
      }
    };

    geminiWs.onclose = (event) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(event.code, event.reason || 'Upstream closed');
      }
    };
  };

  clientWs.onmessage = (event) => {
    // Only forward allowed message types (audio input, text content)
    // Block setup messages so client cannot override model/prompt config
    const raw = typeof event.data === 'string' ? event.data : '';
    if (!isAllowedClientMessage(raw)) {
      console.warn('[voice-proxy] Blocked disallowed client message type');
      return;
    }

    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(event.data);
    }
  };

  clientWs.onerror = (event) => {
    console.error('[voice-proxy] Client WebSocket error:', event);
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close(1011, 'Client error');
    }
  };

  clientWs.onclose = async () => {
    if (voiceTickInterval) clearInterval(voiceTickInterval);

    // ── Session-end cleanup: reconcile fractional minute ──────
    const elapsedMs = Date.now() - sessionStartTime;
    const elapsedMinutes = elapsedMs / 60_000;
    // The tick already incremented whole minutes; add the remaining fraction
    const fractionalMinute = elapsedMinutes % 1;
    if (fractionalMinute > 0.05) { // ignore sub-3-second sessions
      try {
        const date = new Date().toISOString().split('T')[0];
        await supabase.rpc('increment_daily_usage', {
          p_user_id: userId,
          p_date: date,
          p_voice_minutes: parseFloat(fractionalMinute.toFixed(2)),
        });
      } catch (err) {
        console.error('[voice-proxy] Session-end reconciliation error:', err);
      }
    }

    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close(1000, 'Client disconnected');
    }
    geminiWs = null;
  };

  return response;
});
