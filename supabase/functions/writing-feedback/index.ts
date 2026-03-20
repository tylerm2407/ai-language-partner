// Supabase Edge Function: Writing Feedback
// Accepts user-written text and returns structured feedback with scores.
// Persists writing_submissions and logs AI usage to ai_usage_ledger.
// Enforces per-plan daily text conversation limits.
// Deploy: npx supabase functions deploy writing-feedback

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

interface WritingRequest {
  text: string;
  language: string;
  level: string;
  userId: string;
  promptId?: string;
  courseId?: string;
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

async function logAIUsage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  feature: string,
  tokensUsed: number,
  isFreeTier: boolean
): Promise<void> {
  await supabase.from('ai_usage_ledger').insert({
    user_id: userId,
    feature,
    tokens_used: tokensUsed,
    is_free_tier: isFreeTier,
  });
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
    const { text, language, level, userId, promptId, courseId } = (await req.json()) as WritingRequest;

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!text || !language || !userId) {
      return new Response(
        JSON.stringify({ error: 'text, language, and userId are required' }),
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

    // ── Build structured feedback prompt ────────────────────────
    const systemPrompt = `You are a strict but supportive writing examiner for a ${level} student learning ${language}.

Analyze the following text written in ${language} and return a JSON response with exactly this structure (no markdown, no code fences, just raw JSON):
{
  "corrections": [
    { "original": "the incorrect phrase", "corrected": "the corrected phrase", "explanation": "brief explanation of the error" }
  ],
  "suggestions": ["suggestion 1 for improving the writing", "suggestion 2"],
  "grammarScore": 7.5,
  "vocabScore": 6.0,
  "coherenceScore": 8.0,
  "spellingScore": 9.0,
  "overallScore": 7.5,
  "rewritten": "the full text rewritten with all corrections applied"
}

RULES:
- All scores are on a 0-10 scale (decimal allowed, e.g. 7.5).
- grammarScore: accuracy of grammar and sentence structure.
- vocabScore: range and appropriateness of vocabulary for the ${level} level.
- coherenceScore: logical flow, paragraph structure, connectors.
- spellingScore: spelling and accents/diacritical marks.
- overallScore: weighted average (grammar 30%, vocab 25%, coherence 25%, spelling 20%).
- Include ALL grammar, spelling, and word choice errors in corrections.
- suggestions should be 2-4 actionable tips appropriate to the student's level.
- rewritten should be the complete corrected version of the text.
- If the text is perfect, return an empty corrections array, all scores at 10, and the original text as rewritten.
- Return ONLY valid JSON, no other text.`;

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
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiReply = data.content?.[0]?.text ?? '{}';
    const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    // Parse the JSON response from Claude
    let feedback: {
      corrections: { original: string; corrected: string; explanation: string }[];
      suggestions: string[];
      grammarScore: number;
      vocabScore: number;
      coherenceScore: number;
      spellingScore: number;
      overallScore: number;
      rewritten: string;
    };

    try {
      feedback = JSON.parse(aiReply);
    } catch {
      feedback = {
        corrections: [],
        suggestions: ['Unable to parse AI feedback. Please try again.'],
        grammarScore: 0,
        vocabScore: 0,
        coherenceScore: 0,
        spellingScore: 0,
        overallScore: 0,
        rewritten: text,
      };
    }

    // ── Persist writing submission ─────────────────────────────
    const aiFeedbackJson = {
      corrections: feedback.corrections ?? [],
      suggestions: feedback.suggestions ?? [],
      grammarScore: feedback.grammarScore ?? 0,
      vocabScore: feedback.vocabScore ?? 0,
      coherenceScore: feedback.coherenceScore ?? 0,
      spellingScore: feedback.spellingScore ?? 0,
      overallScore: feedback.overallScore ?? 0,
    };

    await supabase.from('writing_submissions').insert({
      user_id: userId,
      prompt_id: promptId ?? null,
      course_id: courseId ?? null,
      level: level || null,
      text,
      ai_feedback_json: aiFeedbackJson,
      grammar_score: feedback.grammarScore ?? null,
      vocab_score: feedback.vocabScore ?? null,
      coherence_score: feedback.coherenceScore ?? null,
      spelling_score: feedback.spellingScore ?? null,
      overall_score: feedback.overallScore ?? null,
    });

    // ── Log AI usage ───────────────────────────────────────────
    const isFreeTier = tier === 'free';
    await logAIUsage(supabase, userId, 'writing_feedback', tokensUsed, isFreeTier);

    // Increment usage after successful AI call
    await incrementTextMessages(supabase, userId);

    return new Response(
      JSON.stringify({
        corrections: feedback.corrections ?? [],
        suggestions: feedback.suggestions ?? [],
        grammarScore: feedback.grammarScore ?? 0,
        vocabScore: feedback.vocabScore ?? 0,
        coherenceScore: feedback.coherenceScore ?? 0,
        spellingScore: feedback.spellingScore ?? 0,
        overallScore: feedback.overallScore ?? 0,
        rewritten: feedback.rewritten ?? text,
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
