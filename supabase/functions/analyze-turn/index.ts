// Supabase Edge Function: Analyze Turn
// Uses Claude to extract corrections and vocabulary from voice conversation turns.
// Called asynchronously after each Gemini Live turn for UI correction banners.
// Deploy: npx supabase functions deploy analyze-turn

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getPlanLimits } from '../_shared/plan-limits.ts';
import { getUserToday } from '../_shared/user-day.ts';
import { analyzeTurnWithRetry } from './analysis.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

interface AnalyzeTurnRequest {
  userMessage: string;
  aiReply: string;
  targetLanguage: string;
  level: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    // Require authenticated user to prevent unauthorized API credit consumption
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers }
      );
    }

    // Rate limit: analyze-turn piggybacks on voice minutes (called per voice turn)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, is_active')
      .eq('user_id', authUser.userId)
      .single();

    const tier = sub?.is_active && sub.tier ? sub.tier : 'starter';
    const limits = getPlanLimits(tier);

    // Day key must match what increment_daily_usage writes (user-local
    // midnight rollover, migration 044) — not UTC.
    const userDay = await getUserToday(supabase, authUser.userId);
    const { data: usageRow } = await supabase
      .from('daily_usage')
      .select('voice_minutes')
      .eq('user_id', authUser.userId)
      .eq('date', userDay)
      .single();

    // Quota exhausted is a real limit, not an empty analysis. The client
    // (lib/ai.ts analyzeConversationTurn) catches non-2xx, logs, and shows
    // no banner — so a 429 degrades gracefully while staying distinguishable.
    const currentVoiceMinutes = parseFloat(usageRow?.voice_minutes as string) || 0;
    if (currentVoiceMinutes >= limits.dailyVoiceMinutes) {
      return new Response(
        JSON.stringify({
          error: "You've reached your daily voice limit. Upgrade your plan for more.",
          code: 'DAILY_VOICE_LIMIT_REACHED',
        }),
        { status: 429, headers }
      );
    }

    let parsedBody: AnalyzeTurnRequest;
    try {
      parsedBody = (await req.json()) as AnalyzeTurnRequest;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers }
      );
    }
    const { userMessage, aiReply, targetLanguage, level } = parsedBody;

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers }
      );
    }

    if (!userMessage || !aiReply) {
      return new Response(
        JSON.stringify({ error: 'userMessage and aiReply are required' }),
        { status: 400, headers }
      );
    }

    const systemPrompt = `You analyze language practice conversations to extract corrections and vocabulary.
The student is practicing ${targetLanguage} at ${level} level.

Analyze the student's message for errors and the AI reply for new/important vocabulary.

RESPOND ONLY IN VALID JSON:
{
  "correction": "Brief correction if the student made a notable error, or null if no correction needed",
  "vocabularyHighlights": ["word1", "word2"]
}

Be concise. Only flag significant errors, not minor ones. vocabularyHighlights should contain 0-3 important words from the AI reply.`;

    // One retry on API failure or unparseable output, then an explicit
    // 502 — never a silent empty result masquerading as "no correction".
    // Safe for the client: analyzeConversationTurn treats non-2xx as
    // "no analysis" (logs + empty banner) without breaking the session.
    const analysis = await analyzeTurnWithRetry(async () => {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: TEXT_MODEL,
          max_tokens: 150,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `Student said: "${userMessage}"\nAI replied: "${aiReply}"`,
          }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text ?? '';
    });

    if (!analysis) {
      return new Response(
        JSON.stringify({
          error: 'Turn analysis is temporarily unavailable.',
          code: 'ANALYSIS_UNAVAILABLE',
        }),
        { status: 502, headers }
      );
    }

    return new Response(JSON.stringify(analysis), { headers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[analyze-turn] unhandled error:', message);
    return new Response(
      JSON.stringify({ error: 'Failed to analyze turn. Please try again.' }),
      { status: 500, headers }
    );
  }
});
