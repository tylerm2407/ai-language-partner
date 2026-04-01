// Supabase Edge Function: Daily News
// Generates AI-powered daily news articles for language learners.
// POST (cron): Generates 1 article per language at B1 level using Claude Haiku.
// GET (client): Returns today's article for a given language.
// Deploy: npx supabase functions deploy daily-news

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

const SUPPORTED_LANGUAGES = ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar', 'hi', 'ru'];

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
    // ── GET: Return today's article for a language ──────────────
    if (req.method === 'GET') {
      const authUser = await getAuthenticatedUser(req);
      if (!authUser) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers }
        );
      }

      const url = new URL(req.url);
      const language = url.searchParams.get('language');
      const date = url.searchParams.get('date') ?? todayUTC();

      if (!language) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameter: language' }),
          { status: 400, headers }
        );
      }

      const { data, error } = await supabase
        .from('daily_news')
        .select('*')
        .eq('language', language)
        .eq('date', date)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return new Response(
        JSON.stringify({ article: data ?? null }),
        { headers }
      );
    }

    // ── POST: Generate articles (cron trigger) ──────────────────
    if (req.method === 'POST') {
      if (!ANTHROPIC_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
          { status: 500, headers }
        );
      }

      const today = todayUTC();
      const results: { language: string; success: boolean; error?: string }[] = [];

      for (const language of SUPPORTED_LANGUAGES) {
        try {
          // Check if article already exists for today
          const { data: existing } = await supabase
            .from('daily_news')
            .select('id')
            .eq('date', today)
            .eq('language', language)
            .single();

          if (existing) {
            results.push({ language, success: true });
            continue;
          }

          const prompt = `Write a short news article (~200 words) in ${language} about a current real-world topic. Include 3-5 vocabulary words with translations to English. Return JSON with fields: title, titleTranslation, summary, content, contentTranslation, vocabularyHighlights (array of {word, translation, partOfSpeech}), sourceTopic`;

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
                  text: `You are a language learning content generator. Write news articles appropriate for B1 (intermediate) language learners. Always respond with valid JSON only, no markdown or extra text.`,
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
          const aiReply = data.content?.[0]?.text ?? '';

          let article;
          try {
            article = JSON.parse(aiReply);
          } catch {
            throw new Error('Failed to parse AI response as JSON');
          }

          const { error: upsertError } = await supabase
            .from('daily_news')
            .upsert({
              date: today,
              language,
              cefr_level: 'B1',
              title: article.title,
              title_translation: article.titleTranslation ?? null,
              summary: article.summary,
              content: article.content,
              content_translation: article.contentTranslation ?? null,
              vocabulary_highlights: article.vocabularyHighlights ?? [],
              source_topic: article.sourceTopic ?? null,
            }, { onConflict: 'date,language' });

          if (upsertError) throw upsertError;

          results.push({ language, success: true });
        } catch (err) {
          results.push({ language, success: false, error: err.message });
        }
      }

      return new Response(
        JSON.stringify({ date: today, results }),
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
