import { supabase } from './supabase';
import type { ConversationMessage, LanguageCode, ProficiencyLevel } from '../types';

// All AI calls go through Supabase Edge Functions.
// The AI API key lives in Edge Function secrets, never on the client.

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
 * Calls the tts edge function and returns a local file URI.
 */
export async function getTextToSpeech(
  text: string,
  language: string,
  userId?: string
): Promise<ArrayBuffer> {
  const { data, error } = await supabase.functions.invoke('tts', {
    body: { text, language, userId },
  });

  if (error) throw new Error(`TTS error: ${error.message}`);
  return data as ArrayBuffer;
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

  if (error) throw new Error(`Transcription error: ${error.message}`);
  return (data as { text: string }).text;
}

/**
 * Start a Gemini Live voice session.
 * Returns session URI and config from the edge function.
 */
export async function getVoiceSessionToken(
  targetLanguage: string,
  level: string,
  topic?: string
): Promise<{ sessionUri: string; remainingMinutes: number; voiceConfig: Record<string, unknown> }> {
  const { data, error } = await supabase.functions.invoke('voice-session-token', {
    body: { targetLanguage, level, topic },
  });

  if (error) throw new Error(`Voice session token error: ${error.message}`);
  return data as { sessionUri: string; remainingMinutes: number; voiceConfig: Record<string, unknown> };
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
