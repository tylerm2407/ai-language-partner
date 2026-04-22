// Supabase Edge Function: Generate Content
// Handles on-demand AI content generation for filling gaps in the content pipeline.
// Uses Claude Haiku for fast, cost-effective generation of exercises, distractors, etc.
// Deploy: npx supabase functions deploy generate-content

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getPlanLimits } from '../_shared/plan-limits.ts';
import { generateValidated } from '../_shared/validated-generate.ts';
import type { CEFR } from '../_shared/level-checker.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

const CONTENT_SAFETY_FALLBACK = '__CONTENT_SAFETY_FALLBACK__';

interface GenerateContentRequest {
  task: 'distractors' | 'accepted_answers' | 'speech_variants' | 'exercises' | 'dialogue' | 'explanation';
  language: string;
  cefrLevel: string;
  targetWord?: string;
  targetGrammar?: string;
  exerciseType?: string;
  context?: string;
  count?: number;
}

// ─── Prompt builders ────────────────────────────────────────────

function buildSystemPrompt(req: GenerateContentRequest): string {
  const { task, language, cefrLevel, targetWord, targetGrammar, exerciseType, count } = req;
  const target = targetWord || targetGrammar || '';
  const n = count ?? 4;

  switch (task) {
    case 'distractors':
      return `Generate ${n} plausible but incorrect options for a language learning exercise. The correct answer is '${targetWord}'. Language: ${language}, CEFR level: ${cefrLevel}. Return a JSON array of strings.`;

    case 'accepted_answers':
      return `Generate alternative valid answers (synonyms, rephrasings) for '${targetWord}' in ${language} at ${cefrLevel} level. Return a JSON array of strings.`;

    case 'speech_variants':
      return `Generate natural spoken forms of '${targetWord}' in ${language}. Include informal pronunciations, contractions, and common spoken variants. Return a JSON array of strings.`;

    case 'exercises':
      return `Generate ${n} language learning exercises for ${language} at ${cefrLevel} level targeting '${target}'. Exercise type: ${exerciseType ?? 'mixed'}. Return a JSON array of exercise objects with fields: prompt, correctAnswer, acceptedAnswers, options (if MC), explanation.`;

    case 'dialogue':
      return `Generate a short 3-5 line dialogue in ${language} at ${cefrLevel} level using '${target}'. Return a JSON object with 'dialogue' array of {speaker, text} objects and 'blankIndices' array.`;

    case 'explanation':
      return `Explain the grammar rule '${targetGrammar}' in ${language} at ${cefrLevel} level. Use simple language appropriate for the level. Return a JSON object with 'explanation', 'examples' array, and 'commonErrors' array.`;

    default:
      throw new Error(`Unknown task type: ${task}`);
  }
}

function buildUserMessage(req: GenerateContentRequest): string {
  const parts: string[] = [`Language: ${req.language}`, `CEFR Level: ${req.cefrLevel}`];

  if (req.targetWord) parts.push(`Target word/phrase: ${req.targetWord}`);
  if (req.targetGrammar) parts.push(`Target grammar: ${req.targetGrammar}`);
  if (req.exerciseType) parts.push(`Exercise type: ${req.exerciseType}`);
  if (req.context) parts.push(`Additional context: ${req.context}`);
  if (req.count) parts.push(`Count: ${req.count}`);

  return parts.join('\n');
}

/** Parse JSON from Claude's response, stripping markdown fences if present. */
function parseAIJSON(text: string): unknown {
  let cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try extracting from first { or [ to last } or ]
    const firstOpen = Math.min(
      cleaned.indexOf('{') === -1 ? Infinity : cleaned.indexOf('{'),
      cleaned.indexOf('[') === -1 ? Infinity : cleaned.indexOf('['),
    );
    const lastClose = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));

    if (firstOpen !== Infinity && lastClose > firstOpen) {
      return JSON.parse(cleaned.substring(firstOpen, lastClose + 1));
    }

    throw new Error('Failed to parse AI response as JSON');
  }
}

// ─── Main handler ───────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  try {
    // Auth: require authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Rate limit: count against text messages ──────────────
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, is_active')
      .eq('user_id', user.id)
      .single();

    const tier = sub?.is_active && sub.tier ? sub.tier : 'free';
    const limits = getPlanLimits(tier);

    const todayUTC = new Date().toISOString().split('T')[0];
    const { data: usageRow } = await supabase
      .from('daily_usage')
      .select('text_messages')
      .eq('user_id', user.id)
      .eq('date', todayUTC)
      .single();

    if (((usageRow?.text_messages as number) ?? 0) >= limits.dailyTextMessages) {
      return new Response(
        JSON.stringify({ error: "You've reached your daily AI usage limit. Upgrade your plan for more.", code: 'DAILY_TEXT_LIMIT_REACHED' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse and validate request
    const body = (await req.json()) as GenerateContentRequest;

    if (!body.task || !body.language || !body.cefrLevel) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: task, language, cefrLevel' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const validTasks = ['distractors', 'accepted_answers', 'speech_variants', 'exercises', 'dialogue', 'explanation'];
    if (!validTasks.includes(body.task)) {
      return new Response(
        JSON.stringify({ error: `Invalid task type. Must be one of: ${validTasks.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build prompts and call Claude
    const systemPrompt = buildSystemPrompt(body);
    const userMessage = buildUserMessage(body);

    const { text: rawText, usedFallback } = await generateValidated({
      fn: 'generate-content',
      targetLevel: body.cefrLevel as CEFR,
      language: body.language,
      safetyRetries: 2,
      generate: async () => {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: TEXT_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        const text = data.content?.[0]?.text ?? '';
        if (!text) throw new Error('Empty content-generation response');
        return text;
      },
      fallback: async () => CONTENT_SAFETY_FALLBACK,
    });

    if (usedFallback || rawText === CONTENT_SAFETY_FALLBACK) {
      return new Response(
        JSON.stringify({ error: 'content-generation-failed', retryable: true }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse the JSON response from Claude
    const result = parseAIJSON(rawText);

    // Increment text_messages after successful AI call
    await supabase.rpc('increment_daily_usage', {
      p_user_id: user.id,
      p_date: todayUTC,
      p_text_messages: 1,
    });

    return new Response(
      JSON.stringify({
        data: result,
        source_type: 'ai_generated',
        task: body.task,
        language: body.language,
        cefrLevel: body.cefrLevel,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
