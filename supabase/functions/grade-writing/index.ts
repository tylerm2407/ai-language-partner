// Supabase Edge Function: Grade Writing
// Provides AI-powered feedback on user writing submissions.
// Uses Claude Haiku for cost-efficient grading at scale.
// Deploy: npx supabase functions deploy grade-writing

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, getCorsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getPlanLimits } from '../_shared/plan-limits.ts';
import { isValidUUID, isValidCefrLevel, isValidLanguage, sanitizeText } from '../_shared/validation.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

interface GradeRequest {
  submissionId: string;
  submissionText: string;
  promptId: string;
  targetLanguage: string;
  cefrLevel: string;
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
    // ── Authenticate the user ─────────────────────────────────
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers }
      );
    }
    const userId = authUser.userId;

    const body = (await req.json()) as GradeRequest;
    const { submissionText, promptId, targetLanguage, cefrLevel } = body;

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers }
      );
    }

    // ── Validate inputs ──────────────────────────────────────
    if (!isValidUUID(promptId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid prompt ID' }),
        { status: 400, headers }
      );
    }
    if (!isValidCefrLevel(cefrLevel)) {
      return new Response(
        JSON.stringify({ error: 'Invalid CEFR level' }),
        { status: 400, headers }
      );
    }
    if (!isValidLanguage(targetLanguage)) {
      return new Response(
        JSON.stringify({ error: 'Invalid target language' }),
        { status: 400, headers }
      );
    }

    // ── Rate limit: atomic increment + check ──────────────────
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, is_active')
      .eq('user_id', userId)
      .single();

    const tier = sub?.is_active && sub.tier ? sub.tier : 'free';
    const limits = getPlanLimits(tier);

    if (limits.dailyTextConversations !== 'unlimited') {
      const date = todayUTC();
      const { data: usage } = await supabase.rpc('increment_daily_usage', {
        p_user_id: userId,
        p_date: date,
        p_text_messages: 1,
        p_voice_minutes: 0,
      });

      const currentCount = usage?.[0]?.text_messages ?? 0;
      if (currentCount > (limits.dailyTextConversations as number)) {
        // Rollback
        await supabase.rpc('increment_daily_usage', {
          p_user_id: userId,
          p_date: date,
          p_text_messages: -1,
          p_voice_minutes: 0,
        });
        return new Response(
          JSON.stringify({
            error: "You've reached your daily AI usage limit. Upgrade your plan for more.",
            code: 'DAILY_LIMIT_REACHED',
          }),
          { status: 429, headers }
        );
      }
    }

    // Fetch prompt details for context
    const { data: prompt } = await supabase
      .from('writing_prompts')
      .select('*')
      .eq('id', promptId)
      .single();

    const systemPrompt = buildGradingPrompt(
      targetLanguage,
      cefrLevel,
      sanitizeText(prompt?.prompt_text ?? '', 2000),
      sanitizeText(prompt?.example_response ?? '', 2000),
      prompt?.target_vocabulary ?? [],
      prompt?.target_grammar ?? []
    );

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        max_tokens: 500,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: sanitizeText(submissionText, 5000) }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiReply = data.content?.[0]?.text ?? '';

    // Parse AI response as JSON
    let feedback;
    try {
      feedback = JSON.parse(aiReply);
    } catch {
      feedback = {
        grammarScore: 50,
        vocabularyScore: 50,
        coherenceScore: 50,
        corrections: [],
        overallFeedback: aiReply,
      };
    }

    return new Response(
      JSON.stringify(feedback),
      { headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers }
    );
  }
});

function buildGradingPrompt(
  targetLanguage: string,
  cefrLevel: string,
  promptText: string,
  exampleResponse: string,
  targetVocabulary: string[],
  targetGrammar: string[]
): string {
  return `You are grading a ${cefrLevel} language learner's writing in ${targetLanguage}.

WRITING PROMPT: ${promptText}
${exampleResponse ? `MODEL ANSWER: ${exampleResponse}` : ''}
${targetVocabulary.length > 0 ? `TARGET VOCABULARY: ${targetVocabulary.join(', ')}` : ''}
${targetGrammar.length > 0 ? `TARGET GRAMMAR: ${targetGrammar.join(', ')}` : ''}

Grade the submission on a 0-100 scale for each category. List specific corrections.

RESPOND ONLY IN VALID JSON:
{
  "grammarScore": <0-100>,
  "vocabularyScore": <0-100>,
  "coherenceScore": <0-100>,
  "corrections": [
    {"original": "...", "corrected": "...", "explanation": "...", "type": "grammar|vocabulary|spelling|style"}
  ],
  "overallFeedback": "2-3 sentences of encouraging, specific feedback"
}

Be encouraging but honest. Grade appropriately for the ${cefrLevel} level — don't expect B2 grammar from an A1 learner.`;
}
