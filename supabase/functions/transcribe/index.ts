// Supabase Edge Function: Speech-to-Text via OpenAI Whisper
// Accepts base64-encoded audio and returns transcribed text plus the language
// Whisper actually heard. Used by both hold-to-talk and the hands-free loop.
//
// The caller's `language` is a HINT, never a constraint: passing Whisper a
// `language` forces decoding into it, so a learner who drops into their native
// language mid-session gets mistranslated word-salad back. Learners code-switch
// constantly, so we let Whisper detect and report instead, and the tutor adapts.
//
// Deploy: npx supabase functions deploy transcribe

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { MAX_AUDIO_BASE64_SIZE } from '../_shared/validation.ts';
import { toLanguageCode } from '../_shared/language.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TranscribeRequest {
  audioBase64: string;
  /** Hint only — see the header note. Used as a fallback if detection fails. */
  language: string;
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

    const { audioBase64, language } = (await req.json()) as TranscribeRequest;

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: 'audioBase64 is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Cost/abuse guard: cap audio size and rate before hitting Whisper.
    if (audioBase64.length > MAX_AUDIO_BASE64_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Audio too large.' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const burstOk = await checkBurstLimit(supabase, authUser.userId, 'transcribe', 30, 60);
    if (!burstOk) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
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
    // verbose_json is the only response format that reports detected language.
    formData.append('response_format', 'verbose_json');

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

    return new Response(
      JSON.stringify({
        text: data.text ?? '',
        // Whisper reports an English language *name* ("spanish"), not a code.
        // Unrecognised names fall back to the caller's hint rather than null so
        // downstream code always has something to key on.
        language: toLanguageCode(data.language) ?? language ?? null,
      }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
