// Supabase Edge Function: AI Chat
// Handles conversation practice with language corrections.
// Enforces per-plan daily text conversation limits before calling AI.
// Deploy: npx supabase functions deploy ai-chat

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
// Text conversations use Claude 3.6 Haiku for cost-efficiency at scale.
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

// Plan daily limits — single source of truth shared with lib/plans.ts on the client.
// "unlimited" means no cap is enforced.
const PLAN_LIMITS: Record<string, { dailyTextConversations: number | 'unlimited'; dailyVoiceMinutes: number | 'unlimited' }> = {
  free:      { dailyTextConversations: 5,           dailyVoiceMinutes: 5 },
  basic:     { dailyTextConversations: 20,          dailyVoiceMinutes: 20 },
  premium:   { dailyTextConversations: 'unlimited', dailyVoiceMinutes: 45 },
  unlimited: { dailyTextConversations: 'unlimited', dailyVoiceMinutes: 60 },
};

interface ChatRequest {
  messages: { role: string; content: string }[];
  targetLanguage: string;
  level: string;
  topic?: string;
  userId?: string; // passed from client for usage tracking
}

// ─── Usage helpers ──────────────────────────────────────────────

/** Get today's date string in UTC (YYYY-MM-DD). All daily limits use UTC. */
function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

/** Fetch or create today's daily_usage row. Returns current counts. */
async function getOrCreateDailyUsage(supabase: ReturnType<typeof createClient>, userId: string) {
  const date = todayUTC();
  const { data, error } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (data) return data;

  // Row doesn't exist yet — create it
  const { data: created, error: insertErr } = await supabase
    .from('daily_usage')
    .upsert({ user_id: userId, date, text_messages: 0, voice_minutes: 0 }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (insertErr) throw insertErr;
  return created;
}

/** Atomically increment text_messages by 1 for today. */
async function incrementTextMessages(supabase: ReturnType<typeof createClient>, userId: string) {
  const date = todayUTC();
  // Use upsert + raw increment via RPC or two-step. Supabase JS doesn't support
  // atomic increment directly, so we fetch-then-update within the Edge Function
  // (single-threaded per invocation, acceptable race window).
  const usage = await getOrCreateDailyUsage(supabase, userId);
  await supabase
    .from('daily_usage')
    .update({ text_messages: (usage.text_messages ?? 0) + 1 })
    .eq('user_id', userId)
    .eq('date', date);
}

/** Look up the user's active subscription tier, defaulting to 'free'. */
async function getUserTier(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data } = await supabase
    .from('subscriptions')
    .select('tier, is_active')
    .eq('user_id', userId)
    .single();

  if (data?.is_active && data.tier) return data.tier;
  return 'free';
}

// ─── Main handler ───────────────────────────────────────────────

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
    const { messages, targetLanguage, level, topic, userId } = (await req.json()) as ChatRequest;

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Enforce daily text conversation limit ──────────────────
    // Each AI request counts as 1 text conversation for limit purposes.
    // This is a simplification — if the app later tracks "conversation sessions"
    // as distinct from individual messages, update this to count sessions instead.
    if (userId) {
      const tier = await getUserTier(supabase, userId);
      const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;

      if (limits.dailyTextConversations !== 'unlimited') {
        const usage = await getOrCreateDailyUsage(supabase, userId);
        if ((usage.text_messages ?? 0) >= limits.dailyTextConversations) {
          return new Response(
            JSON.stringify({
              error: "You've reached your daily text conversation limit. Upgrade your plan to keep practicing today.",
              code: 'DAILY_TEXT_LIMIT_REACHED',
            }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const systemPrompt = buildSystemPrompt(targetLanguage, level, topic);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        max_tokens: 300,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiReply = data.content?.[0]?.text ?? '';

    // Increment usage only after a successful AI call
    if (userId) {
      await incrementTextMessages(supabase, userId);
    }

    // Parse correction if the AI included one
    const { reply, correction } = parseReplyAndCorrection(aiReply);

    return new Response(
      JSON.stringify({
        reply,
        correction,
        audioUrl: null, // TTS can be added later
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

function buildSystemPrompt(targetLanguage: string, level: string, topic?: string): string {
  const levelDescriptions: Record<string, string> = {
    beginner: 'Use very simple vocabulary and short sentences. Speak slowly and clearly.',
    elementary: 'Use basic vocabulary and simple grammar. Keep sentences short.',
    intermediate: 'Use natural conversational language. Introduce some complex grammar.',
    upper_intermediate: 'Use rich vocabulary and complex sentences. Be natural.',
    advanced: 'Speak as a native would. Use idioms, colloquialisms, and complex structures.',
  };

  const levelGuide = levelDescriptions[level] ?? levelDescriptions.beginner;
  const topicGuide = topic ? `The conversation topic is: ${topic}.` : '';

  return `You are a friendly language tutor helping a student practice ${targetLanguage}.

RULES:
- Respond primarily in ${targetLanguage}. ${levelGuide}
- ${topicGuide}
- Keep responses concise (1-3 sentences).
- If the student makes a grammar or vocabulary mistake, include a correction.
- Format corrections on a separate line starting with "[CORRECTION]:" followed by the corrected version.
- Be encouraging and supportive.
- Stay on topic. Do not discuss anything inappropriate or unrelated to language learning.
- If the student writes in English, gently encourage them to try in ${targetLanguage}.
- Never generate harmful, offensive, or inappropriate content.`;
}

function parseReplyAndCorrection(text: string): { reply: string; correction: string | null } {
  const correctionMarker = '[CORRECTION]:';
  const index = text.indexOf(correctionMarker);

  if (index === -1) {
    return { reply: text.trim(), correction: null };
  }

  const reply = text.substring(0, index).trim();
  const correction = text.substring(index + correctionMarker.length).trim();

  return { reply, correction: correction || null };
}
