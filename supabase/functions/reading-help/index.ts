// Supabase Edge Function: Reading Help
// Provides AI-powered reading assistance: summarize articles, define words,
// and generate comprehension questions via Claude Haiku.
// Deploy: npx supabase functions deploy reading-help

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

// Plan daily limits — mirrors ai-chat pattern.
const PLAN_LIMITS: Record<string, { dailyTextConversations: number | 'unlimited' }> = {
  free:      { dailyTextConversations: 5 },
  basic:     { dailyTextConversations: 20 },
  premium:   { dailyTextConversations: 'unlimited' },
  unlimited: { dailyTextConversations: 'unlimited' },
};

interface ReadingHelpRequest {
  articleId?: string;
  readingId?: string;
  text?: string;
  language: string;
  userId: string;
  action: 'summarize' | 'define' | 'comprehension_questions';
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

// ─── Action-specific prompt builders ────────────────────────────

function buildSummarizePrompt(language: string): string {
  return `You are a reading assistant for language learners studying ${language}.
Summarize the following text in 3-5 sentences in ${language}, using simple vocabulary appropriate for intermediate learners.
Return ONLY valid JSON with this structure (no markdown, no code fences):
{ "summary": "your summary here" }`;
}

function buildDefinePrompt(language: string): string {
  return `You are a vocabulary assistant for language learners studying ${language}.
Identify the 5-10 most important or difficult words/phrases in the following text.
For each, provide the word in ${language}, its definition in English, and an example sentence in ${language}.
Return ONLY valid JSON with this structure (no markdown, no code fences):
{ "definitions": [{ "word": "word in target language", "definition": "English definition", "example": "example sentence in target language" }] }`;
}

function buildComprehensionPrompt(language: string): string {
  return `You are a reading comprehension assistant for language learners studying ${language}.
Generate 4-6 comprehension questions about the following text.
Questions should be in ${language}. Answers should be in ${language}.
Mix question types: factual recall, inference, and opinion.
Return ONLY valid JSON with this structure (no markdown, no code fences):
{ "questions": [{ "question": "question in target language", "answer": "expected answer in target language" }] }`;
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
    const { articleId, readingId, text, language, userId, action } = (await req.json()) as ReadingHelpRequest;

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!language || !userId || !action) {
      return new Response(
        JSON.stringify({ error: 'language, userId, and action are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['summarize', 'define', 'comprehension_questions'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'action must be one of: summarize, define, comprehension_questions' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Enforce daily text limit ───────────────────────────────
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

    // ── Resolve content text ───────────────────────────────────
    let contentText = text;

    // Try reading_materials first (new reading library)
    if (readingId && !contentText) {
      const { data: reading, error: readingErr } = await supabase
        .from('reading_materials')
        .select('title, text, summary')
        .eq('id', readingId)
        .single();

      if (!readingErr && reading) {
        contentText = `${reading.title}\n\n${reading.text}`;
      }
    }

    // Fall back to news_articles
    if (articleId && !contentText) {
      const { data: article, error } = await supabase
        .from('news_articles')
        .select('title, summary, url')
        .eq('id', articleId)
        .single();

      if (error || !article) {
        return new Response(
          JSON.stringify({ error: 'Article not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      contentText = `${article.title}\n\n${article.summary || ''}`;
    }

    if (!contentText) {
      return new Response(
        JSON.stringify({ error: 'Either readingId, articleId, or text must be provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Build prompt based on action ───────────────────────────
    let systemPrompt: string;
    switch (action) {
      case 'summarize':
        systemPrompt = buildSummarizePrompt(language);
        break;
      case 'define':
        systemPrompt = buildDefinePrompt(language);
        break;
      case 'comprehension_questions':
        systemPrompt = buildComprehensionPrompt(language);
        break;
    }

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
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: contentText }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiReply = data.content?.[0]?.text ?? '{}';

    // Parse the JSON response
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(aiReply);
    } catch {
      // Fallback for each action type
      if (action === 'summarize') {
        result = { summary: aiReply };
      } else if (action === 'define') {
        result = { definitions: [] };
      } else {
        result = { questions: [] };
      }
    }

    // Log AI usage
    const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    await supabase.from('ai_usage_ledger').insert({
      user_id: userId,
      feature: 'chat',
      tokens_used: tokensUsed,
      is_free_tier: tier === 'free',
    });

    // Increment usage after successful AI call
    await incrementTextMessages(supabase, userId);

    return new Response(
      JSON.stringify(result),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
