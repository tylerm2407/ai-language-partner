// Supabase Edge Function: Pronunciation Scoring
// Accepts base64 audio and expected text, returns a pronunciation score.
// Enforces per-plan daily voice minute limits before processing.
// Uses OpenAI Whisper for real speech-to-text transcription.
// Deploy: npx supabase functions deploy score-pronunciation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPlanLimits } from '../_shared/plan-limits.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_KEY');

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

async function getOrCreateDailyUsage(supabase: ReturnType<typeof createClient>, userId: string) {
  const date = todayUTC();
  const { data } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (data) return data;

  const { data: created, error } = await supabase
    .from('daily_usage')
    .upsert({ user_id: userId, date, text_messages: 0, voice_minutes: 0 }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) throw error;
  return created;
}


async function getUserTier(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data } = await supabase
    .from('subscriptions')
    .select('tier, is_active')
    .eq('user_id', userId)
    .single();

  if (data?.is_active && data.tier) return data.tier;
  return 'free';
}

interface ScoreRequest {
  audioBase64: string;
  expectedText: string;
  language: string;
  userId?: string; // passed from client for usage tracking
  acceptedVariants?: string[];
  targetWord?: string;
  targetGrammar?: string;
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const {
      audioBase64,
      expectedText,
      language,
      userId,
      acceptedVariants,
      targetWord,
      targetGrammar,
    } = (await req.json()) as ScoreRequest;

    if (!audioBase64 || !expectedText) {
      return new Response(
        JSON.stringify({ error: 'audioBase64 and expectedText are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Enforce daily pronunciation score limit ───────────────
    if (userId) {
      const tier = await getUserTier(supabase, userId);
      const limits = getPlanLimits(tier);

      const usage = await getOrCreateDailyUsage(supabase, userId);
      if (((usage.pronunciation_scores as number) ?? 0) >= limits.dailyPronunciationScores) {
        return new Response(
          JSON.stringify({
            error: "You've reached your daily pronunciation scoring limit. Upgrade your plan for more.",
            code: 'DAILY_PRONUNCIATION_LIMIT_REACHED',
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 1: Transcribe audio using OpenAI Whisper
    const transcription = await transcribeAudio(audioBase64, language);

    // Step 2: Score the transcription against expected text and accepted variants
    const score = calculatePronunciationScore(transcription, expectedText, acceptedVariants ?? []);

    // Step 3: Check if target word/grammar appears in transcription
    const normalizedTranscription = transcription.toLowerCase().trim();
    const targetPresent =
      (targetWord ? normalizedTranscription.includes(targetWord.toLowerCase().trim()) : false) ||
      (targetGrammar ? normalizedTranscription.includes(targetGrammar.toLowerCase().trim()) : false);

    // Increment pronunciation_scores after successful processing
    if (userId) {
      const date = todayUTC();
      await supabase.rpc('increment_daily_usage', {
        p_user_id: userId,
        p_date: date,
        p_pronunciation_scores: 1,
      });
    }

    return new Response(
      JSON.stringify({
        score: score.score,
        feedback: score.feedback,
        phonemeErrors: score.phonemeErrors,
        transcription,
        isCorrect: score.score >= 60,
        matchedVariant: score.matchedVariant,
        targetPresent,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Transcribe audio using OpenAI Whisper STT.
 * Pattern copied from supabase/functions/transcribe/index.ts.
 */
async function transcribeAudio(audioBase64: string, language: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_KEY not configured. Speech-to-text is unavailable.');
  }

  // Decode base64 to binary
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Build multipart form data for Whisper API
  const formData = new FormData();
  const audioBlob = new Blob([bytes], { type: 'audio/m4a' });
  formData.append('file', audioBlob, 'audio.m4a');
  formData.append('model', 'whisper-1');
  if (language) {
    formData.append('language', language);
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.text ?? '';
}

/**
 * Compare transcription against expected text and accepted variants, generate a score.
 */
function calculatePronunciationScore(
  transcription: string,
  expectedText: string,
  acceptedVariants: string[]
): { score: number; feedback: string; phonemeErrors: string[]; matchedVariant: string | null } {
  const normalizedTranscription = transcription.toLowerCase().trim();
  const normalizedExpected = expectedText.toLowerCase().trim();

  // Check all variants (expected text + accepted variants) for the best match
  const allVariants = [normalizedExpected, ...acceptedVariants.map(v => v.toLowerCase().trim())];
  let bestScore = 0;
  let bestMatchedVariant: string | null = null;
  let bestPhonemeErrors: string[] = [];

  for (const variant of allVariants) {
    const expectedWords = variant.split(/\s+/);
    const transcribedWords = normalizedTranscription.split(/\s+/);
    const phonemeErrors: string[] = [];

    let matchCount = 0;
    for (let i = 0; i < expectedWords.length; i++) {
      const expected = expectedWords[i];
      const transcribed = transcribedWords[i] ?? '';

      if (expected === transcribed) {
        matchCount++;
      } else if (levenshteinDistance(expected, transcribed) <= 2) {
        matchCount += 0.7; // partial credit for close pronunciation
        phonemeErrors.push(`"${expected}" heard as "${transcribed}"`);
      } else {
        phonemeErrors.push(`"${expected}" not recognized`);
      }
    }

    const variantScore = Math.round((matchCount / Math.max(expectedWords.length, 1)) * 100);

    if (variantScore > bestScore) {
      bestScore = variantScore;
      bestMatchedVariant = variantScore > bestScore ? variant : bestMatchedVariant;
      bestPhonemeErrors = phonemeErrors;
      bestMatchedVariant = variant !== normalizedExpected ? variant : null;
    }
  }

  let feedback: string;
  if (bestScore >= 90) feedback = 'Excellent pronunciation!';
  else if (bestScore >= 75) feedback = 'Good job! A few sounds need work.';
  else if (bestScore >= 60) feedback = 'Decent attempt. Keep practicing the highlighted words.';
  else feedback = 'Needs improvement. Try listening to the audio again and repeat slowly.';

  return { score: bestScore, feedback, phonemeErrors: bestPhonemeErrors, matchedVariant: bestMatchedVariant };
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
