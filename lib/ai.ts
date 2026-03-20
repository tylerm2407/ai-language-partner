import { supabase } from './supabase';
import type { ConversationMessage, LanguageCode, ProficiencyLevel, CEFRLevel, WritingFeedback, SpeakingFeedback, AIFeature } from '../types';

// All AI calls go through Supabase Edge Functions.
// The AI API key lives in Edge Function secrets, never on the client.

export interface AIChatRequest {
  userId: string;
  messages: Pick<ConversationMessage, 'role' | 'content'>[];
  targetLanguage: LanguageCode;
  level: ProficiencyLevel;
  topic?: string;
}

export interface AIChatResponse {
  reply: string;
  correction: string | null;
  audioUrl: string | null;
}

export interface PronunciationScoreRequest {
  userId: string;
  audioBase64: string;
  expectedText: string;
  language: LanguageCode;
}

export interface PronunciationScoreResponse {
  score: number; // 0-100
  pronunciationScore: number; // 0-10
  fluencyScore: number; // 0-10
  rhythmScore: number; // 0-10
  overallScore: number; // 0-10
  feedback: string;
  wordErrors: { word: string; issue: string; suggestion: string }[];
  phonemeErrors: string[];
  transcription: string;
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

// ─── Voice ──────────────────────────────────────────────────────

export interface VoiceTokenRequest {
  language?: string;
  level?: string;
  nativeLanguage?: string;
  topic?: string;
  personalityId?: string;
  scenarioId?: string;
}

export interface VoiceTokenResponse {
  token: string;
  roomName: string;
  serverUrl: string;
}

/**
 * Request a LiveKit access token for a real-time voice session.
 * The Edge Function validates auth, checks daily voice minute quota,
 * and returns a signed token for joining a LiveKit room.
 */
export async function requestVoiceToken(
  userId: string,
  options?: VoiceTokenRequest
): Promise<VoiceTokenResponse> {
  const { data, error } = await supabase.functions.invoke('voice-token', {
    body: {
      userId,
      language: options?.language,
      level: options?.level,
      nativeLanguage: options?.nativeLanguage,
      topic: options?.topic,
      personalityId: options?.personalityId,
      scenarioId: options?.scenarioId,
    },
  });

  if (error) throw new Error(`Voice token error: ${error.message}`);
  return data as VoiceTokenResponse;
}

// ─── Writing Feedback ──────────────────────────────────────────

export interface WritingFeedbackRequest {
  userId: string;
  text: string;
  language: LanguageCode;
  level: string;
  promptId?: string;
  courseId?: string;
}

export interface WritingFeedbackResponse {
  corrections: { original: string; corrected: string; explanation: string }[];
  suggestions: string[];
  grammarScore: number;
  vocabScore: number;
  coherenceScore: number;
  spellingScore: number;
  overallScore: number;
  rewritten: string;
}

/**
 * Submit user-written text for AI feedback.
 * Returns structured scores and corrections. Persists submission server-side.
 */
export async function submitWritingForFeedback(
  request: WritingFeedbackRequest
): Promise<WritingFeedbackResponse> {
  const { data, error } = await supabase.functions.invoke('writing-feedback', {
    body: request,
  });

  if (error) throw new Error(`Writing feedback error: ${error.message}`);
  return data as WritingFeedbackResponse;
}

// ─── Pronunciation Feedback ────────────────────────────────────

export interface PronunciationFeedbackRequest {
  userId: string;
  audioBase64: string;
  expectedText: string;
  language: LanguageCode;
  readingId?: string;
  lessonId?: string;
  targetTextRef?: string;
}

/**
 * Submit audio recording for pronunciation scoring.
 * Uses Deepgram STT + LLM for detailed feedback. Persists attempt server-side.
 */
export async function submitPronunciationForFeedback(
  request: PronunciationFeedbackRequest
): Promise<PronunciationScoreResponse> {
  const { data, error } = await supabase.functions.invoke('score-pronunciation', {
    body: request,
  });

  if (error) throw new Error(`Pronunciation feedback error: ${error.message}`);
  return data as PronunciationScoreResponse;
}

// ─── Reading Help ──────────────────────────────────────────────

export interface ReadingHelpRequest {
  userId: string;
  readingId?: string;
  articleId?: string;
  text?: string;
  language: LanguageCode;
  action: 'summarize' | 'define' | 'comprehension_questions';
}

/**
 * Get AI-powered help with a reading: summarize, define words, or generate comprehension questions.
 */
export async function getReadingHelp(
  request: ReadingHelpRequest
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('reading-help', {
    body: request,
  });

  if (error) throw new Error(`Reading help error: ${error.message}`);
  return data as Record<string, unknown>;
}

// ─── AI Usage Check ────────────────────────────────────────────

export interface AIUsageCheckResponse {
  tier: string;
  usageSummary: {
    feature: string;
    requestCount: number;
    totalTokens: number;
    limit: number | 'unlimited';
    allowed: boolean;
  }[];
}

/**
 * Check the user's AI usage for the current billing period.
 * Optionally filter by a specific feature.
 */
export async function checkAIUsage(
  userId: string,
  feature?: AIFeature
): Promise<AIUsageCheckResponse> {
  const { data, error } = await supabase.functions.invoke('ai-usage-check', {
    body: { userId, feature },
  });

  if (error) throw new Error(`AI usage check error: ${error.message}`);
  return data as AIUsageCheckResponse;
}
