// Supabase Edge Function: Speech-to-Text via OpenAI Whisper
// Accepts base64-encoded audio and returns transcribed text.
// DEPRECATED: Still used by hold-to-talk voice mode as a fallback.
// Hands-free mode now uses Gemini Live with built-in VAD and STT.
// Deploy: npx supabase functions deploy transcribe

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_KEY');

interface TranscribeRequest {
  audioBase64: string;
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

    return new Response(
      JSON.stringify({ text: data.text ?? '', language: language }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
