// Supabase Edge Function: Daily News
// POST (user): Generates a personalized daily news article at the user's proficiency level.
// GET (user): Returns today's article for the authenticated user.
// Deploy: npx supabase functions deploy daily-news

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

/** Extract user ID from JWT payload. Gateway verify_jwt already validated the token. */
function getUserIdFromJwt(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

const LEVEL_TO_CEFR: Record<string, string> = {
  beginner: 'A1',
  elementary: 'A2',
  intermediate: 'B1',
  upper_intermediate: 'B2',
  advanced: 'C1',
};

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Extract user ID from JWT (gateway already verified the token)
    const userId = getUserIdFromJwt(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — missing or invalid token' }),
        { status: 401, headers }
      );
    }

    // ── GET: Return today's article for the authenticated user ───
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const date = url.searchParams.get('date') ?? todayUTC();
      const lang = url.searchParams.get('lang');

      let query = supabase
        .from('user_daily_news')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date);

      if (lang) {
        query = query.eq('language', lang);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return new Response(
        JSON.stringify({ article: data ?? null }),
        { headers }
      );
    }

    // ── POST: Generate a personalized article for the user ───────
    if (req.method === 'POST') {
      if (!ANTHROPIC_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
          { status: 500, headers }
        );
      }

      const body = await req.json();
      const { language, level } = body;

      if (!language || !level) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: language, level' }),
          { status: 400, headers }
        );
      }

      const today = todayUTC();
      const cefrLevel = LEVEL_TO_CEFR[level] ?? 'B1';

      // Check if user already has an article for today + this language — return it
      const { data: existing } = await supabase
        .from('user_daily_news')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .eq('language', language)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ article: existing }),
          { headers }
        );
      }

      // Generate article via Claude Haiku
      const prompt = `Write a short news article (~200 words) in ${language} about a current real-world topic. The article should be appropriate for ${cefrLevel} level language learners. Include 3-5 vocabulary words with translations to English. Return JSON with fields: title, titleTranslation, summary, content, contentTranslation, vocabularyHighlights (array of {word, translation, partOfSpeech}), sourceTopic`;

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
          system: [
            {
              type: 'text',
              text: `You are a language learning content generator. Write news articles appropriate for ${cefrLevel} level language learners. Adjust vocabulary complexity and sentence structure to match the CEFR level. Always respond with valid JSON only, no markdown or extra text.`,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      let aiReply = data.content?.[0]?.text ?? '';

      // Strip markdown code fences if present
      aiReply = aiReply.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

      let article;
      try {
        article = JSON.parse(aiReply);
      } catch {
        throw new Error('Failed to parse AI response as JSON');
      }

      const row = {
        user_id: userId,
        date: today,
        language,
        cefr_level: cefrLevel,
        title: article.title,
        title_translation: article.titleTranslation ?? null,
        summary: article.summary,
        content: article.content,
        content_translation: article.contentTranslation ?? null,
        vocabulary_highlights: article.vocabularyHighlights ?? [],
        source_topic: article.sourceTopic ?? null,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('user_daily_news')
        .insert(row)
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({ article: inserted }),
        { headers }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers }
    );
  }
});
