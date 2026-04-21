// Supabase Edge Function: Translate
// Cheap on-demand translation of short conversational messages via Claude
// Haiku. Used by the AI Chat "Translate" button in ChatBubble.tsx.
//
// Auth: deployed with verify_jwt: false. Authentication is performed by the
// function body via _shared/auth.ts getAuthenticatedUser(), which calls
// supabase.auth.getUser(token) and works with any JWT signing algorithm.
// Matches the ai-chat pattern. DO NOT flip verify_jwt back to true without
// first fixing the project-wide UNAUTHORIZED_LEGACY_JWT /
// UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM root cause.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_INPUT_CHARS = 1500;

interface TranslateRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return json({ error: 'Unauthorized' }, 401);

  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  let body: TranslateRequest;
  try {
    body = (await req.json()) as TranslateRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { text, sourceLanguage, targetLanguage } = body;
  if (!text || !sourceLanguage || !targetLanguage) {
    return json({ error: 'Missing required fields: text, sourceLanguage, targetLanguage' }, 400);
  }

  const input = String(text).slice(0, MAX_INPUT_CHARS).trim();
  if (!input) return json({ translation: '' });

  // If source == target, translation is a no-op. Save the round-trip.
  if (sourceLanguage === targetLanguage) {
    return json({ translation: input });
  }

  const systemPrompt = `You translate a short conversational message from ${sourceLanguage} into ${targetLanguage}. Return ONLY the translation — no quotes, no preamble, no explanation, no "Here is the translation:" lead-in. Preserve tone, punctuation, and emoji. If the input already appears to be in ${targetLanguage}, return it unchanged. Do not add commentary.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: input }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return json({ error: `Anthropic API error: ${response.status} - ${errorText}` }, 500);
    }

    const data = await response.json();
    const translation = (data.content?.[0]?.text ?? '').trim();
    return json({ translation });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
