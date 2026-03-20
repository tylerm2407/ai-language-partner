// Supabase Edge Function: Pronunciation Scoring
// Accepts base64 audio and expected text, transcribes via Deepgram Nova-3,
// scores pronunciation with word-level confidence, then uses LLM for
// fluency/rhythm/pronunciation feedback. Persists speaking_attempts + ai_usage_ledger.
// Deploy: npx supabase functions deploy score-pronunciation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

// Plan daily limits
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

async function logAIUsage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  feature: string,
  tokensUsed: number,
  isFreeTier: boolean
): Promise<void> {
  await supabase.from('ai_usage_ledger').insert({
    user_id: userId,
    feature,
    tokens_used: tokensUsed,
    is_free_tier: isFreeTier,
  });
}

interface ScoreRequest {
  audioBase64: string;
  expectedText: string;
  language: string;
  userId?: string;
  readingId?: string;
  lessonId?: string;
  targetTextRef?: string;
}

interface DeepgramWord {
  word: string;
  confidence: number;
  start: number;
  end: number;
}

interface WordScore {
  word: string;
  confidence: number;
  start: number;
  end: number;
  flagged: boolean;
}

// Deepgram language code mapping
const DEEPGRAM_LANGUAGE_MAP: Record<string, string> = {
  en: 'en', es: 'es', fr: 'fr', de: 'de', it: 'it', pt: 'pt',
  ja: 'ja', ko: 'ko', zh: 'zh', ru: 'ru', ar: 'ar', hi: 'hi',
  nl: 'nl', sv: 'sv', pl: 'pl', tr: 'tr',
};

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
    const { audioBase64, expectedText, language, userId, readingId, lessonId, targetTextRef } =
      (await req.json()) as ScoreRequest;

    if (!audioBase64 || !expectedText) {
      return new Response(
        JSON.stringify({ error: 'audioBase64 and expectedText are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Enforce daily voice minute limit ───────────────────────
    const ESTIMATED_VOICE_MINUTES = 1;

    let tier = 'free';
    if (userId) {
      tier = await getUserTier(supabase, userId);
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

    // ── Step 1: Transcribe audio via Deepgram Nova-3 ───────────
    const transcription = await transcribeAudio(audioBase64, language);

    // ── Step 2: Basic word-level scores from Deepgram ──────────
    const wordScores: WordScore[] = transcription.words.map((w: DeepgramWord) => ({
      word: w.word,
      confidence: w.confidence,
      start: w.start,
      end: w.end,
      flagged: w.confidence < 0.7,
    }));

    // ── Step 3: LLM-based pronunciation/fluency/rhythm scoring ─
    let llmFeedback = {
      pronunciationScore: 0,
      fluencyScore: 0,
      rhythmScore: 0,
      overallScore: 0,
      feedback: '',
      wordErrors: [] as { word: string; issue: string; suggestion: string }[],
    };

    let tokensUsed = 0;

    if (ANTHROPIC_API_KEY && transcription.text !== '[transcription-placeholder]') {
      const llmResult = await getLLMPronunciationFeedback(
        transcription.text,
        expectedText,
        language,
        wordScores
      );
      if (llmResult) {
        llmFeedback = llmResult.feedback;
        tokensUsed = llmResult.tokensUsed;
      }
    } else {
      // Fallback: use basic scoring
      const basicScore = calculateBasicScore(transcription.text, expectedText);
      llmFeedback = {
        pronunciationScore: basicScore.score / 10,
        fluencyScore: basicScore.score / 10,
        rhythmScore: basicScore.score / 10,
        overallScore: basicScore.score / 10,
        feedback: basicScore.feedback,
        wordErrors: basicScore.phonemeErrors.map((e) => ({
          word: e,
          issue: 'pronunciation',
          suggestion: 'Listen to the audio again and practice.',
        })),
      };
    }

    // ── Step 4: Persist speaking attempt ───────────────────────
    if (userId) {
      await supabase.from('speaking_attempts').insert({
        user_id: userId,
        reading_id: readingId ?? null,
        lesson_id: lessonId ?? null,
        audio_url: '', // Audio stored client-side or in Supabase Storage
        transcript: transcription.text,
        target_text_ref: targetTextRef ?? null,
        pronunciation_score: llmFeedback.pronunciationScore,
        fluency_score: llmFeedback.fluencyScore,
        rhythm_score: llmFeedback.rhythmScore,
        overall_score: llmFeedback.overallScore,
        ai_feedback_json: llmFeedback,
      });

      // Log AI usage
      const isFreeTier = tier === 'free';
      await logAIUsage(supabase, userId, 'pronunciation_feedback', tokensUsed, isFreeTier);

      // Increment voice usage
      await incrementVoiceMinutes(supabase, userId, ESTIMATED_VOICE_MINUTES);
    }

    return new Response(
      JSON.stringify({
        score: Math.round(llmFeedback.overallScore * 10), // 0-100 for backward compat
        pronunciationScore: llmFeedback.pronunciationScore,
        fluencyScore: llmFeedback.fluencyScore,
        rhythmScore: llmFeedback.rhythmScore,
        overallScore: llmFeedback.overallScore,
        feedback: llmFeedback.feedback,
        wordErrors: llmFeedback.wordErrors,
        transcription: transcription.text,
        wordScores,
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

// ─── LLM Pronunciation Feedback ─────────────────────────────────

async function getLLMPronunciationFeedback(
  transcript: string,
  expectedText: string,
  language: string,
  wordScores: WordScore[]
): Promise<{
  feedback: {
    pronunciationScore: number;
    fluencyScore: number;
    rhythmScore: number;
    overallScore: number;
    feedback: string;
    wordErrors: { word: string; issue: string; suggestion: string }[];
  };
  tokensUsed: number;
} | null> {
  const flaggedWords = wordScores.filter((w) => w.flagged).map((w) => w.word);

  const systemPrompt = `You are a pronunciation coach for ${language} learners.

The student tried to read this text aloud:
EXPECTED: "${expectedText}"

The speech-to-text system transcribed their speech as:
TRANSCRIBED: "${transcript}"

Words with low confidence (likely mispronounced): ${flaggedWords.join(', ') || 'none'}

Score their pronunciation on 0-10 scales and provide feedback.
Return ONLY valid JSON (no markdown, no code fences):
{
  "pronunciationScore": 7.5,
  "fluencyScore": 6.0,
  "rhythmScore": 7.0,
  "overallScore": 7.0,
  "feedback": "A short paragraph of specific, encouraging feedback with concrete tips",
  "wordErrors": [
    { "word": "specific word", "issue": "what went wrong", "suggestion": "how to improve" }
  ]
}

SCORING GUIDE:
- pronunciationScore: How accurately individual sounds/phonemes were produced
- fluencyScore: How smooth and natural the speech flow was (vs. halting/hesitant)
- rhythmScore: Intonation, stress patterns, and natural pacing
- overallScore: Weighted average (pronunciation 40%, fluency 30%, rhythm 30%)`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Score my pronunciation.' }],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '{}';
    const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    const parsed = JSON.parse(text);

    return { feedback: parsed, tokensUsed };
  } catch {
    return null;
  }
}

// ─── Deepgram Transcription ─────────────────────────────────────

async function transcribeAudio(
  audioBase64: string,
  language: string
): Promise<{ text: string; words: DeepgramWord[] }> {
  if (!DEEPGRAM_API_KEY) {
    return { text: '[transcription-placeholder]', words: [] };
  }

  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const dgLanguage = DEEPGRAM_LANGUAGE_MAP[language] ?? 'en';

  const response = await fetch(
    `https://api.deepgram.com/v1/listen?model=nova-3&language=${dgLanguage}&punctuate=true`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: bytes,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const alternative = data.results?.channels?.[0]?.alternatives?.[0];

  return {
    text: alternative?.transcript ?? '',
    words: (alternative?.words ?? []).map(
      (w: { word: string; confidence: number; start: number; end: number }) => ({
        word: w.word,
        confidence: w.confidence,
        start: w.start,
        end: w.end,
      })
    ),
  };
}

// ─── Basic Score Fallback ───────────────────────────────────────

function calculateBasicScore(
  transcription: string,
  expectedText: string
): { score: number; feedback: string; phonemeErrors: string[] } {
  const normalizedTranscription = transcription.toLowerCase().trim();
  const normalizedExpected = expectedText.toLowerCase().trim();

  if (normalizedTranscription === '[transcription-placeholder]') {
    return {
      score: 75,
      feedback: 'Pronunciation scoring requires Deepgram API key.',
      phonemeErrors: [],
    };
  }

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
      matchCount += 0.7;
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
