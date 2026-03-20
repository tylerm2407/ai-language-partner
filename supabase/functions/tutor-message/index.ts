// Supabase Edge Function: Tutor Message
// Handles AI tutor conversations with personality and scenario support.
// Manages conversation sessions, parses corrections and vocabulary from responses.
// Deploy: npx supabase functions deploy tutor-message

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

// ─── Plan limits (mirrors ai-chat) ─────────────────────────────
const PLAN_LIMITS: Record<string, { dailyTextConversations: number | 'unlimited' }> = {
  free:      { dailyTextConversations: 5 },
  basic:     { dailyTextConversations: 20 },
  premium:   { dailyTextConversations: 'unlimited' },
  unlimited: { dailyTextConversations: 'unlimited' },
};

// ─── Tutor personalities ────────────────────────────────────────
const PERSONALITIES: Record<string, { name: string; description: string; style: string }> = {
  sofia: {
    name: 'Sofia',
    description: 'A warm, encouraging tutor from Madrid who loves literature and culture.',
    style: 'Friendly and patient. Uses cultural references and idioms. Celebrates small wins. Gently corrects mistakes with positive reinforcement.',
  },
  marco: {
    name: 'Marco',
    description: 'An energetic tutor from Rome who is passionate about food, travel, and sports.',
    style: 'Enthusiastic and conversational. Brings up real-world topics. Challenges the student to try harder constructions. Uses humor.',
  },
  prof_kim: {
    name: 'Professor Kim',
    description: 'A precise, academic tutor from Seoul who focuses on grammar and formal language.',
    style: 'Structured and methodical. Explains grammar rules clearly. Focuses on accuracy over fluency. Gives detailed corrections with explanations.',
  },
  mia: {
    name: 'Mia',
    description: 'A laid-back tutor from Berlin who focuses on casual, everyday conversation.',
    style: 'Relaxed and casual. Teaches slang and colloquialisms. Focuses on fluency over perfection. Makes the student feel like they are chatting with a friend.',
  },
};

interface TutorRequest {
  sessionId?: string;
  message: string;
  language: string;
  level: string;
  personalityId: string;
  scenarioId?: string;
  userId: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

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

  const { data: created, error } = await supabase
    .from('daily_usage')
    .upsert({ user_id: userId, date, text_messages: 0, voice_minutes: 0 }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) throw error;
  return created;
}

async function incrementTextMessages(supabase: ReturnType<typeof createClient>, userId: string) {
  const date = todayUTC();
  const usage = await getOrCreateDailyUsage(supabase, userId);
  await supabase
    .from('daily_usage')
    .update({ text_messages: (usage.text_messages ?? 0) + 1 })
    .eq('user_id', userId)
    .eq('date', date);
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

// ─── System prompt builder ──────────────────────────────────────

function buildSystemPrompt(
  language: string,
  level: string,
  personality: { name: string; description: string; style: string },
  scenario?: { title: string; persona: string; setting: string } | null
): string {
  const levelDescriptions: Record<string, string> = {
    beginner: 'Use very simple vocabulary and short sentences.',
    elementary: 'Use basic vocabulary and simple grammar.',
    intermediate: 'Use natural conversational language with some complex grammar.',
    upper_intermediate: 'Use rich vocabulary and complex sentences naturally.',
    advanced: 'Speak as a native would with idioms and complex structures.',
  };

  const levelGuide = levelDescriptions[level] ?? levelDescriptions.beginner;

  let prompt = `You are ${personality.name}, a language tutor. ${personality.description}

YOUR STYLE: ${personality.style}

RULES:
- Respond primarily in ${language}. ${levelGuide}
- Keep responses concise (1-3 sentences for the main reply).
- If the student makes a grammar or vocabulary mistake, include a correction on a separate line starting with "[CORRECTION]: " followed by the corrected version and a brief explanation.
- If you use a word or phrase worth learning, include it on a separate line starting with "[VOCABULARY]: " followed by the word/phrase, a dash, and its definition in English.
- Be encouraging and stay in character as ${personality.name}.
- Never generate harmful, offensive, or inappropriate content.`;

  if (scenario) {
    prompt += `\n\nSCENARIO: "${scenario.title}"
You are playing the role of: ${scenario.persona}
Setting: ${scenario.setting}
Stay in this scenario context throughout the conversation. Guide the student through realistic interactions they would have in this setting.`;
  }

  return prompt;
}

// ─── Response parsing ───────────────────────────────────────────

function parseResponse(text: string): {
  reply: string;
  correction: string | null;
  vocabulary: { term: string; definition: string }[];
} {
  const lines = text.split('\n');
  const replyLines: string[] = [];
  let correction: string | null = null;
  const vocabulary: { term: string; definition: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[CORRECTION]:')) {
      correction = trimmed.substring('[CORRECTION]:'.length).trim();
    } else if (trimmed.startsWith('[VOCABULARY]:')) {
      const vocabText = trimmed.substring('[VOCABULARY]:'.length).trim();
      const dashIndex = vocabText.indexOf(' - ');
      if (dashIndex > 0) {
        vocabulary.push({
          term: vocabText.substring(0, dashIndex).trim(),
          definition: vocabText.substring(dashIndex + 3).trim(),
        });
      } else {
        vocabulary.push({ term: vocabText, definition: '' });
      }
    } else {
      replyLines.push(line);
    }
  }

  return {
    reply: replyLines.join('\n').trim(),
    correction,
    vocabulary,
  };
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
    const { sessionId, message, language, level, personalityId, scenarioId, userId } =
      (await req.json()) as TutorRequest;

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!message || !language || !userId) {
      return new Response(
        JSON.stringify({ error: 'message, language, and userId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Enforce daily text conversation limit ──────────────────
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

    // ── Load or create conversation session ────────────────────
    let messages: ConversationMessage[] = [];
    let activeSessionId = sessionId;

    if (sessionId) {
      const { data: session, error } = await supabase
        .from('conversation_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      messages = (session.messages as ConversationMessage[]) ?? [];
    } else {
      // Create a new session
      const { data: newSession, error } = await supabase
        .from('conversation_sessions')
        .insert({
          user_id: userId,
          language,
          level,
          personality_id: personalityId,
          scenario_id: scenarioId || null,
          messages: [],
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !newSession) {
        throw new Error(`Failed to create session: ${error?.message}`);
      }

      activeSessionId = newSession.id;
    }

    // ── Build personality and optional scenario context ─────────
    const personality = PERSONALITIES[personalityId] ?? PERSONALITIES.sofia;

    let scenario: { title: string; persona: string; setting: string } | null = null;
    if (scenarioId) {
      const { data: scenarioData } = await supabase
        .from('scenarios')
        .select('title, persona, setting')
        .eq('id', scenarioId)
        .single();

      if (scenarioData) {
        scenario = scenarioData;
      }
    }

    const systemPrompt = buildSystemPrompt(language, level, personality, scenario);

    // Append user message to history
    messages.push({ role: 'user', content: message });

    // ── Call Claude Haiku ───────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        max_tokens: 400,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
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

    // Parse response for corrections and vocabulary
    const parsed = parseResponse(aiReply);

    // Append assistant message to history
    messages.push({ role: 'assistant', content: aiReply });

    // ── Update session with new messages ───────────────────────
    await supabase
      .from('conversation_sessions')
      .update({
        messages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeSessionId);

    // Increment usage after successful AI call
    await incrementTextMessages(supabase, userId);

    return new Response(
      JSON.stringify({
        reply: parsed.reply,
        correction: parsed.correction,
        vocabulary: parsed.vocabulary,
        sessionId: activeSessionId,
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
