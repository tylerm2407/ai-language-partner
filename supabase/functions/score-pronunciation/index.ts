// Supabase Edge Function: Pronunciation Scoring
// Accepts base64 audio and expected text, returns a pronunciation score.
// Enforces per-plan daily voice minute limits before processing.
// Deploy: npx supabase functions deploy score-pronunciation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Plan daily limits — mirrors lib/plans.ts on the client.
const PLAN_LIMITS: Record<string, { dailyVoiceMinutes: number | 'unlimited' }> = {
  free:      { dailyVoiceMinutes: 5 },
  basic:     { dailyVoiceMinutes: 20 },
  premium:   { dailyVoiceMinutes: 45 },
  unlimited: { dailyVoiceMinutes: 60 },
};

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

async function incrementVoiceMinutes(supabase: ReturnType<typeof createClient>, userId: string, minutes: number) {
  const date = todayUTC();
  const usage = await getOrCreateDailyUsage(supabase, userId);
  await supabase
    .from('daily_usage')
    .update({ voice_minutes: (parseFloat(usage.voice_minutes) || 0) + minutes })
    .eq('user_id', userId)
    .eq('date', date);
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
    const { audioBase64, expectedText, language, userId } = (await req.json()) as ScoreRequest;

    if (!audioBase64 || !expectedText) {
      return new Response(
        JSON.stringify({ error: 'audioBase64 and expectedText are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Enforce daily voice minute limit ───────────────────────
    // TODO: Estimate actual audio duration from audioBase64 length.
    // For now, assume 1 minute per pronunciation scoring request.
    const ESTIMATED_VOICE_MINUTES = 1;

    if (userId) {
      const tier = await getUserTier(supabase, userId);
      const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;

      if (limits.dailyVoiceMinutes !== 'unlimited') {
        const usage = await getOrCreateDailyUsage(supabase, userId);
        if ((parseFloat(usage.voice_minutes) || 0) + ESTIMATED_VOICE_MINUTES > limits.dailyVoiceMinutes) {
          return new Response(
            JSON.stringify({
              error: "You've reached your daily voice practice limit. Upgrade your plan for more voice minutes.",
              code: 'DAILY_VOICE_LIMIT_REACHED',
            }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Strategy: Use a speech-to-text service to transcribe, then compare.
    // For MVP, we'll use the AI to simulate scoring based on the expected text.
    // In production, replace with a real STT API (Whisper, Google Speech, Deepgram).

    // Step 1: Transcribe audio (placeholder — replace with real STT)
    const transcription = await transcribeAudio(audioBase64, language);

    // Step 2: Score the transcription against expected text
    const score = calculatePronunciationScore(transcription, expectedText);

    // Increment voice usage only after successful processing
    if (userId) {
      await incrementVoiceMinutes(supabase, userId, ESTIMATED_VOICE_MINUTES);
    }

    return new Response(
      JSON.stringify({
        score: score.score,
        feedback: score.feedback,
        phonemeErrors: score.phonemeErrors,
        transcription,
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
 * Transcribe audio using a speech-to-text service.
 * TODO: Replace with real STT API (OpenAI Whisper, Google Speech-to-Text, Deepgram).
 * For now, this is a placeholder that returns the expected text to allow the flow to work.
 */
async function transcribeAudio(audioBase64: string, language: string): Promise<string> {
  // Placeholder: In production, send audio to a real STT service.
  // Example with OpenAI Whisper:
  //
  // const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  // const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
  // const formData = new FormData();
  // formData.append('file', new Blob([audioBuffer], { type: 'audio/m4a' }), 'audio.m4a');
  // formData.append('model', 'whisper-1');
  // formData.append('language', language);
  //
  // const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
  //   body: formData,
  // });
  //
  // const data = await response.json();
  // return data.text;

  return '[transcription-placeholder]';
}

/**
 * Compare transcription against expected text and generate a score.
 */
function calculatePronunciationScore(
  transcription: string,
  expectedText: string
): { score: number; feedback: string; phonemeErrors: string[] } {
  const normalizedTranscription = transcription.toLowerCase().trim();
  const normalizedExpected = expectedText.toLowerCase().trim();

  // If placeholder, return a mock score for testing
  if (normalizedTranscription === '[transcription-placeholder]') {
    return {
      score: 75,
      feedback: 'Pronunciation scoring requires a speech-to-text service. Connect Whisper or Deepgram to enable real scoring.',
      phonemeErrors: [],
    };
  }

  // Simple word-level comparison
  const expectedWords = normalizedExpected.split(/\s+/);
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

  const score = Math.round((matchCount / Math.max(expectedWords.length, 1)) * 100);

  let feedback: string;
  if (score >= 90) feedback = 'Excellent pronunciation!';
  else if (score >= 75) feedback = 'Good job! A few sounds need work.';
  else if (score >= 60) feedback = 'Decent attempt. Keep practicing the highlighted words.';
  else feedback = 'Needs improvement. Try listening to the audio again and repeat slowly.';

  return { score, feedback, phonemeErrors };
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
