import { supabase } from './supabase';
import type { ConversationMessage, LanguageCode, ProficiencyLevel } from '../types';

// All AI calls go through Supabase Edge Functions.
// The AI API key lives in Edge Function secrets, never on the client.

export class VoiceError extends Error {
  code: 'DAILY_LIMIT' | 'NOT_CONFIGURED' | 'NETWORK' | 'UNKNOWN';
  constructor(message: string, code: VoiceError['code'] = 'UNKNOWN') {
    super(message);
    this.name = 'VoiceError';
    this.code = code;
  }
}

export interface AIChatRequest {
  userId: string;
  messages: Pick<ConversationMessage, 'role' | 'content'>[];
  targetLanguage: LanguageCode;
  level: ProficiencyLevel;
  topic?: string;
  scenario?: string;
}

export interface AIChatResponse {
  reply: string;
  correction: string | null;
  audioUrl: string | null;
  vocabularyHighlights?: string[];
}

export interface PronunciationScoreRequest {
  userId: string;
  audioBase64: string;
  expectedText: string;
  language: LanguageCode;
}

export interface PronunciationScoreResponse {
  score: number; // 0-100
  feedback: string;
  phonemeErrors: string[];
}

/**
 * Send a conversation message to the AI backend.
 * Returns the AI's reply with optional correction.
 */
export async function sendChatMessage(request: AIChatRequest): Promise<AIChatResponse> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: request,
  });

  if (error) throw new Error(`AI chat error: ${error.message}`);
  return data as AIChatResponse;
}

/**
 * Score a user's pronunciation against expected text.
 * Audio is sent as base64 to the Edge Function.
 */
export async function scorePronunciation(
  request: PronunciationScoreRequest
): Promise<PronunciationScoreResponse> {
  const { data, error } = await supabase.functions.invoke('score-pronunciation', {
    body: request,
  });

  if (error) throw new Error(`Pronunciation scoring error: ${error.message}`);
  return data as PronunciationScoreResponse;
}

/**
 * Generate a hint for a stuck user.
 */
export async function getHint(
  cardId: string,
  exerciseType: string,
  targetLanguage: LanguageCode
): Promise<{ hint: string }> {
  const { data, error } = await supabase.functions.invoke('get-hint', {
    body: { cardId, exerciseType, targetLanguage },
  });

  if (error) throw new Error(`Hint generation error: ${error.message}`);
  return data as { hint: string };
}

/**
 * Get ElevenLabs TTS audio for a message.
 * Returns base64-encoded audio string from the edge function.
 */
export async function getTextToSpeech(
  text: string,
  language: string,
  userId?: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('tts', {
    body: { text, language, userId },
  });

  // When edge function returns non-2xx, supabase puts a generic message in error
  // and the actual response body is in error.context (a Response object).
  // We need to extract the real error from there.
  if (error) {
    let errorMessage = error.message;
    let errorCode: VoiceError['code'] = 'NETWORK';

    try {
      // FunctionsHttpError has a .context property with the raw Response
      const ctx = (error as Record<string, unknown>).context;
      if (ctx && typeof (ctx as Response).json === 'function') {
        const body = await (ctx as Response).json();
        if (body?.error) {
          errorMessage = body.error;
          if (body.code === 'DAILY_VOICE_LIMIT_REACHED') errorCode = 'DAILY_LIMIT';
          else if (body.error.includes('not configured')) errorCode = 'NOT_CONFIGURED';
        }
      }
    } catch {
      // Couldn't parse error body — fall through with generic message
    }

    throw new VoiceError(errorMessage, errorCode);
  }

  // Success (200) but edge function returned an application-level error in the body
  if (data?.error) {
    if (data.code === 'DAILY_VOICE_LIMIT_REACHED') {
      throw new VoiceError(data.error, 'DAILY_LIMIT');
    }
    if (data.error.includes('not configured')) {
      throw new VoiceError(data.error, 'NOT_CONFIGURED');
    }
    throw new VoiceError(data.error);
  }

  return data.audioBase64 as string;
}

/**
 * Transcribe audio using Whisper STT.
 * Accepts base64-encoded audio, returns transcribed text.
 */
export async function transcribeAudio(
  audioBase64: string,
  language: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('transcribe', {
    body: { audioBase64, language },
  });

  if (error) {
    let errorMessage = error.message;
    let errorCode: VoiceError['code'] = 'NETWORK';

    try {
      const ctx = (error as Record<string, unknown>).context;
      if (ctx && typeof (ctx as Response).json === 'function') {
        const body = await (ctx as Response).json();
        if (body?.error) {
          errorMessage = body.error;
          if (body.code === 'DAILY_VOICE_LIMIT_REACHED') errorCode = 'DAILY_LIMIT';
          else if (body.error.includes('not configured')) errorCode = 'NOT_CONFIGURED';
        }
      }
    } catch {
      // fall through
    }

    throw new VoiceError(errorMessage, errorCode);
  }

  if (data?.error) {
    if (data.code === 'DAILY_VOICE_LIMIT_REACHED') {
      throw new VoiceError(data.error, 'DAILY_LIMIT');
    }
    if (data.error.includes('not configured')) {
      throw new VoiceError(data.error, 'NOT_CONFIGURED');
    }
    throw new VoiceError(data.error);
  }

  return (data as { text: string }).text;
}

/**
 * Start a Gemini Live voice session.
 * Returns config from the edge function. No API keys are exposed to the client.
 * Client connects via the voice-proxy edge function for the actual WebSocket.
 */
export async function getVoiceSessionToken(
  targetLanguage: string,
  level: string,
  topic?: string
): Promise<{ remainingMinutes: number; voiceConfig: Record<string, unknown> }> {
  const { data, error } = await supabase.functions.invoke('voice-session-token', {
    body: { targetLanguage, level, topic },
  });

  if (error) throw new Error(`Voice session token error: ${error.message}`);
  return data as { remainingMinutes: number; voiceConfig: Record<string, unknown> };
}

/**
 * Report voice session usage after session ends.
 */
export async function reportVoiceSessionEnd(
  durationMinutes: number
): Promise<{ remainingMinutes: number | 'unlimited'; totalUsedToday: number }> {
  const { data, error } = await supabase.functions.invoke('voice-session-end', {
    body: { durationMinutes },
  });

  if (error) throw new Error(`Voice session end error: ${error.message}`);
  return data as { remainingMinutes: number | 'unlimited'; totalUsedToday: number };
}

/**
 * Analyze a voice conversation turn to extract corrections and vocabulary.
 * Called asynchronously after each Gemini Live turn.
 */
export async function analyzeConversationTurn(
  userMessage: string,
  aiReply: string,
  targetLanguage: string,
  level: string
): Promise<{ correction: string | null; vocabularyHighlights: string[] }> {
  const { data, error } = await supabase.functions.invoke('analyze-turn', {
    body: { userMessage, aiReply, targetLanguage, level },
  });

  if (error) {
    console.error('Analyze turn error:', error);
    return { correction: null, vocabularyHighlights: [] };
  }
  return data as { correction: string | null; vocabularyHighlights: string[] };
}
