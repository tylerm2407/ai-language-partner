// Supabase Edge Function: Get Hint
// Generates a contextual hint for a stuck learner.
// Deploy: npx supabase functions deploy get-hint

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Generate hint based on exercise type
    const hint = generateHint(card, exerciseType, targetLanguage);

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

function generateHint(
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
