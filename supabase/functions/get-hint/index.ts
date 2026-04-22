// Supabase Edge Function: Get Hint
// Generates a contextual hint for a stuck learner.
// Deploy: npx supabase functions deploy get-hint

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { generateValidated } from '../_shared/validated-generate.ts';
import type { CEFR } from '../_shared/level-checker.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

interface HintRequest {
  cardId: string;
  exerciseType: string;
  targetLanguage: string;
}

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

  try {
    // Require authenticated user
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { cardId, exerciseType, targetLanguage } = (await req.json()) as HintRequest;

    // Fetch the card data
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return new Response(
        JSON.stringify({ hint: 'No hint available for this card.' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate hint via Claude AI, fall back to static rules
    const hint = await generateAIHint(card, exerciseType, targetLanguage);

    return new Response(
      JSON.stringify({ hint }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function generateAIHint(
  card: Record<string, unknown>,
  exerciseType: string,
  targetLanguage: string
): Promise<string> {
  const targetText = card.target_text as string;
  const nativeText = card.native_text as string;
  const partOfSpeech = card.part_of_speech as string | null;
  const exampleSentence = card.example_sentence as string | null;

  if (!ANTHROPIC_API_KEY) {
    return generateStaticHint(card, exerciseType, targetLanguage);
  }

  try {
    const systemPrompt =
      "You are a language learning assistant. Generate a helpful, pedagogical hint for a language learner working on an exercise. Don't give the answer directly. Keep it to 1-2 sentences maximum.";

    const userMessage = [
      `Exercise type: ${exerciseType}`,
      `Target language: ${targetLanguage}`,
      `Native text: ${nativeText}`,
      `Target text: ${targetText}`,
      partOfSpeech ? `Part of speech: ${partOfSpeech}` : null,
      exampleSentence ? `Example sentence: ${exampleSentence}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const cefrLevel = (card.cefr_level as CEFR | undefined);

    const result = await generateValidated({
      fn: 'get-hint',
      targetLevel: cefrLevel,
      language: targetLanguage,
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
            max_tokens: 80,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          }),
        });
        if (!response.ok) {
          throw new Error(`Claude API error: ${response.status}`);
        }
        const data = await response.json();
        const hint = data.content?.[0]?.text ?? '';
        if (!hint) throw new Error('Empty hint from Claude');
        return hint;
      },
      fallback: async () => generateStaticHint(card, exerciseType, targetLanguage),
    });

    return result.text;
  } catch (error) {
    console.error('Claude API call failed, falling back to static hint:', error);
    return generateStaticHint(card, exerciseType, targetLanguage);
  }
}

function generateStaticHint(
  card: Record<string, unknown>,
  exerciseType: string,
  targetLanguage: string
): string {
  const targetText = card.target_text as string;
  const nativeText = card.native_text as string;
  const partOfSpeech = card.part_of_speech as string | null;
  const exampleSentence = card.example_sentence as string | null;

  switch (exerciseType) {
    case 'translate_to_target':
    case 'translate_to_native': {
      // Give first letter hint
      const firstLetter = targetText.charAt(0).toUpperCase();
      const wordLength = targetText.length;
      return `The answer starts with "${firstLetter}" and has ${wordLength} letters.`;
    }

    case 'fill_blank': {
      // Give first two letters
      const prefix = targetText.substring(0, 2);
      return `The missing word starts with "${prefix}..."`;
    }

    case 'multiple_choice':
    case 'listening_choice': {
      // Give part of speech hint
      if (partOfSpeech) {
        return `Think about which option is a ${partOfSpeech}.`;
      }
      return `Listen carefully and think about the meaning of "${nativeText}".`;
    }

    case 'listening_type': {
      return `The word you heard has ${targetText.split(' ').length} word(s) and starts with "${targetText.charAt(0)}".`;
    }

    case 'speaking': {
      return `Try saying it slowly: ${targetText.split('').join(' - ')}`;
    }

    default: {
      if (exampleSentence) {
        return `Here's a sentence using the word: "${exampleSentence}"`;
      }
      return `The answer is related to: "${nativeText}"`;
    }
  }
}
