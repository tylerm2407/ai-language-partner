import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getPlanLimits } from '../_shared/plan-limits.ts';
import { getUserToday } from '../_shared/user-day.ts';
import { generateValidated } from '../_shared/validated-generate.ts';
import type { CEFR } from '../_shared/level-checker.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

interface GenerateRequest {
  language: string;
  cefrLevel: string;
  topic?: string;
  count?: number;
}

const WORD_COUNTS: Record<string, { min: number; max: number }> = {
  A1: { min: 50, max: 150 },
  A2: { min: 150, max: 300 },
  B1: { min: 300, max: 500 },
  B2: { min: 500, max: 800 },
  C1: { min: 800, max: 1200 },
  C2: { min: 1000, max: 1500 },
};

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ru: 'Russian',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500, headers });
    }

    // ── Rate limit: count against text messages ──────────────
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, is_active')
      .eq('user_id', authUser.userId)
      .single();

    const tierValue = sub?.is_active && sub.tier ? sub.tier : 'starter';
    const limits = getPlanLimits(tierValue);

    // Atomic check-and-consume (migration 037) — race-free under
    // concurrent requests. Hard cap: max 3 generate-story calls/day.
    const MAX_DAILY_STORY_CALLS = 3;
    const { data: storyQuotaOk, error: storyQuotaErr } = await supabase.rpc('consume_daily_quota', {
      p_user_id: authUser.userId,
      p_counter: 'stories_generated',
      p_limit: MAX_DAILY_STORY_CALLS,
    });
    if (storyQuotaErr) {
      console.error('[generate-story] consume_daily_quota failed:', storyQuotaErr.message);
    }
    if (storyQuotaErr || storyQuotaOk !== true) {
      return new Response(
        JSON.stringify({ error: "You've reached the daily story generation limit (3 per day). Try again tomorrow.", code: 'DAILY_STORY_LIMIT_REACHED' }),
        { status: 429, headers }
      );
    }

    // Each story also counts against the daily text-message budget.
    const { data: textQuotaOk } = await supabase.rpc('consume_daily_quota', {
      p_user_id: authUser.userId,
      p_counter: 'text_messages',
      p_limit: limits.dailyTextMessages,
    });
    if (textQuotaOk !== true) {
      return new Response(
        JSON.stringify({ error: "You've reached your daily AI usage limit. Upgrade your plan for more.", code: 'DAILY_TEXT_LIMIT_REACHED' }),
        { status: 429, headers }
      );
    }

    const body = (await req.json()) as GenerateRequest;
    const { language, cefrLevel, topic, count = 1 } = body;

    if (!language || !cefrLevel) {
      return new Response(JSON.stringify({ error: 'language and cefrLevel are required' }), { status: 400, headers });
    }

    const languageName = LANGUAGE_NAMES[language] ?? language;
    const wordRange = WORD_COUNTS[cefrLevel] ?? WORD_COUNTS['A1'];
    const storyCount = Math.min(count, 3); // cap at 3 per request

    const bookIds: string[] = [];

    for (let i = 0; i < storyCount; i++) {
      const topicHint = topic ? `about "${topic}"` : 'about an interesting everyday topic';

      const systemPrompt = `You are a creative story writer fluent in ${languageName}.
Write a ${cefrLevel} level story (${wordRange.min}-${wordRange.max} words) ${topicHint}.
Use ONLY vocabulary appropriate for ${cefrLevel} learners.
The story must feel native to ${languageName}-speaking culture, not a translated English story.
Include 8-15 vocabulary annotations with translations to English.

RESPOND ONLY IN VALID JSON:
{
  "title": "story title in ${languageName}",
  "content": "the full story text in ${languageName}",
  "annotations": [
    {"word": "word in ${languageName}", "translation": "English translation", "partOfSpeech": "noun|verb|adjective|adverb|other"}
  ]
}`;

      const { text: aiReply, usedFallback } = await generateValidated({
        fn: 'generate-story',
        targetLevel: cefrLevel as CEFR,
        language,
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
              max_tokens: 2000,
              system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
              messages: [{ role: 'user', content: `Generate story ${i + 1}` }],
            }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          const text = data.content?.[0]?.text ?? '';
          if (!text) throw new Error('Empty story response');
          return text;
        },
        // No safe fallback for story generation — signal the caller to skip.
        fallback: async () => '__STORY_SAFETY_FALLBACK__',
      });

      if (usedFallback || aiReply === '__STORY_SAFETY_FALLBACK__') {
        // Safety exhausted retries. Skip this story; client can request again.
        continue;
      }

      let story;
      try {
        story = JSON.parse(aiReply);
      } catch {
        throw new Error('Failed to parse AI-generated story');
      }

      const wordCount = (story.content as string).split(/\s+/).filter(Boolean).length;

      // Insert book
      const { data: book, error: bookError } = await supabase
        .from('reading_books')
        .insert({
          source: 'ai_generated',
          language,
          cefr_level: cefrLevel,
          title: story.title,
          content: story.content,
          word_count: wordCount,
          tags: topic ? [topic, 'ai_story'] : ['ai_story'],
          is_published: true,
        })
        .select('id')
        .single();

      if (bookError) throw bookError;

      // Insert annotations
      if (story.annotations?.length > 0) {
        const annotationRows = story.annotations.map((a: { word: string; translation: string; partOfSpeech?: string }) => ({
          book_id: book.id,
          word_or_phrase: a.word,
          translation: a.translation,
          part_of_speech: a.partOfSpeech ?? null,
        }));

        await supabase.from('book_annotations').insert(annotationRows);
      }

      bookIds.push(book.id);
    }

    // One story + one text message were consumed atomically up front;
    // record any additional stories in this batch against text_messages.
    // p_date is ignored by SQL since migration 044 (day resolved via
    // fluenci_user_today) — passed as the user-local day for consistency.
    if (bookIds.length > 1) {
      await supabase.rpc('increment_daily_usage', {
        p_user_id: authUser.userId,
        p_date: await getUserToday(supabase, authUser.userId),
        p_text_messages: bookIds.length - 1,
      });
    }

    return new Response(JSON.stringify({ bookIds }), { headers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[generate-story] unhandled error:', message);
    return new Response(
      JSON.stringify({ error: 'Failed to generate story. Please try again.' }),
      { status: 500, headers }
    );
  }
});
