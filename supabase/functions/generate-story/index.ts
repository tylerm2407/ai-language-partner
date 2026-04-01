import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

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

    const body = (await req.json()) as GenerateRequest;
    const { language, cefrLevel, topic, count = 1 } = body;

    if (!language || !cefrLevel) {
      return new Response(JSON.stringify({ error: 'language and cefrLevel are required' }), { status: 400, headers });
    }

    const languageName = LANGUAGE_NAMES[language] ?? language;
    const wordRange = WORD_COUNTS[cefrLevel] ?? WORD_COUNTS['A1'];
    const storyCount = Math.min(count, 5); // cap at 5 per request

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
      const aiReply = data.content?.[0]?.text ?? '';

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

    return new Response(JSON.stringify({ bookIds }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
});
