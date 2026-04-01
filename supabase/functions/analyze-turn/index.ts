// Supabase Edge Function: Analyze Turn
// Uses Claude to extract corrections and vocabulary from voice conversation turns.
// Called asynchronously after each Gemini Live turn for UI correction banners.
// Deploy: npx supabase functions deploy analyze-turn

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';

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
    const { userMessage, aiReply, targetLanguage, level } = (await req.json()) as AnalyzeTurnRequest;

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ correction: null, vocabularyHighlights: [] }),
        { headers }
      );
    }

    if (!userMessage || !aiReply) {
      return new Response(
        JSON.stringify({ correction: null, vocabularyHighlights: [] }),
        { headers }
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
      return new Response(
        JSON.stringify({ correction: null, vocabularyHighlights: [] }),
        { headers }
      );
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text ?? '';

    try {
      const parsed = JSON.parse(rawText);
      return new Response(
        JSON.stringify({
          correction: parsed.correction ?? null,
          vocabularyHighlights: parsed.vocabularyHighlights ?? [],
        }),
        { headers }
      );
    } catch {
      return new Response(
        JSON.stringify({ correction: null, vocabularyHighlights: [] }),
        { headers }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ correction: null, vocabularyHighlights: [] }),
      { headers }
    );
  }
});
