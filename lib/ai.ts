import { supabase } from './supabase';
import type {
  ConversationMessage,
  CorrectionDetail,
  LanguageCode,
  ProficiencyLevel,
} from '../types';
import type { ScenarioKey } from '../types/scenarios';

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
  /** User's native language. Used by the Edge Function to write the
   *  correction explanation in a language the learner can read comfortably. */
  nativeLanguage?: LanguageCode;
  level: ProficiencyLevel;
  /** Resolves to a hidden server-side system prompt. Preferred for scenario-
   *  based chat. Takes precedence over `topic` when both are sent. */
  scenarioKey?: ScenarioKey;
  /** Free-form topic string. Used by Practice screen / assignments where we
   *  don't have a pre-authored scenario. */
  topic?: string;
}

export interface AIChatResponse {
  reply: string;
  /** Rich correction object (preferred) or legacy string or null. The
   *  ConversationMessage.correction field and the CorrectionBanner render
   *  both shapes via `normalizeCorrection()`. */
  correction: CorrectionDetail | string | null;
  audioUrl: string | null;
  vocabularyHighlights?: string[];
}

export interface PronunciationScoreRequest {
  userId: string;
  audioBase64: string;
  expectedText: string;
  language: LanguageCode;
  acceptedVariants?: string[];
  targetWord?: string;
  targetGrammar?: string;
}

export interface PronunciationScoreResponse {
  score: number; // 0-100
  feedback: string;
  phonemeErrors: string[];
  transcription?: string;
  isCorrect?: boolean;
  matchedVariant?: string | null;
  targetPresent?: boolean;
}

/**
 * Send a conversation message to the AI backend.
 * Returns the AI's reply with optional correction.
 *
 * On non-2xx, supabase-js only exposes a generic "Edge Function returned a
 * non-2xx status code" on error.message; the real server error is in
 * error.context (the raw Response). We parse that body so callers see the
 * actual cause (e.g. "ANTHROPIC_API_KEY not configured", DAILY_TEXT_LIMIT_REACHED,
 * or a 401 when the user's JWT isn't forwarded).
 */
export async function sendChatMessage(request: AIChatRequest): Promise<AIChatResponse> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: request,
  });

  if (error) {
    let detail = error.message;
    let code: string | undefined;
    let status: number | undefined;

    try {
      const ctx = (error as Record<string, unknown>).context;
      if (ctx && typeof (ctx as Response).json === 'function') {
        status = (ctx as Response).status;
        const body = await (ctx as Response).json();
        if (body?.error) detail = body.error;
        if (body?.code) code = body.code;
      }
    } catch {
      // Body wasn't JSON — fall through with the generic message.
    }

    const prefix = status ? `${status}` : 'AI chat';
    const suffix = code ? ` [${code}]` : '';
    throw new Error(`${prefix}: ${detail}${suffix}`);
  }

  // Success envelope may still carry an application-level error from the function
  if (data?.error) {
    throw new Error(data.code ? `${data.error} [${data.code}]` : data.error);
  }

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
 * Translate a short conversational message from one language into another
 * via the `translate` Edge Function (Claude Haiku server-side). Used by the
 * Translate button in ChatBubble. Failures throw with the real server
 * message (extracted from error.context) so the UI can surface useful text.
 */
export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('translate', {
    body: { text, sourceLanguage, targetLanguage },
  });

  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as Record<string, unknown>).context;
      if (ctx && typeof (ctx as Response).json === 'function') {
        const body = await (ctx as Response).json();
        if (body?.error) detail = body.error;
      }
    } catch {
      // Body wasn't JSON — fall through with the generic message.
    }
    throw new Error(`Translation failed: ${detail}`);
  }

  if (data?.error) throw new Error(`Translation failed: ${data.error}`);
  return (data as { translation: string }).translation;
}

/** Voice selection mode for the TTS edge function. See
 *  supabase/functions/tts/index.ts `VOICE_MAP` for the per-language voice
 *  arrays this indexes into. HVPT phoneme drills should rotate voices across
 *  repetitions (Thomson meta-analyses, research.md §9). */
export type TTSVoiceMode = 'default' | 'rotate' | 'random';

export interface TTSVoiceOptions {
  /** 0-based index into the language's voice array. Clamped server-side
   *  if out-of-range. Ignored when `voiceMode` is provided. */
  voiceIndex?: number;
  /** Selection mode. 'rotate' requires `voiceRotationKey` for a stable pick. */
  voiceMode?: TTSVoiceMode;
  /** Stable key used when `voiceMode === 'rotate'`. */
  voiceRotationKey?: string;
}

/**
 * Get ElevenLabs TTS audio for a message.
 * Returns base64-encoded audio string from the edge function.
 */
export async function getTextToSpeech(
  text: string,
  language: string,
  userId?: string,
  voiceOptions?: TTSVoiceOptions
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('tts', {
    body: { text, language, userId, ...(voiceOptions ?? {}) },
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
 * Check voice limits and get remaining minutes.
 * Voice config and system prompt are built server-side in voice-proxy.
 * No API keys or model config are exposed to the client.
 */
export async function getVoiceSessionToken(
  targetLanguage: string,
  level: string,
  topic?: string
): Promise<{ remainingMinutes: number }> {
  const { data, error } = await supabase.functions.invoke('voice-session-token', {
    body: { targetLanguage, level, topic },
  });

  if (error) throw new Error(`Voice session token error: ${error.message}`);
  return data as { remainingMinutes: number };
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

// ─── Content Generation ─────────────────────────────────────────

export interface GenerateContentRequest {
  task: 'distractors' | 'accepted_answers' | 'speech_variants' | 'exercises' | 'dialogue' | 'explanation';
  language: string;
  cefrLevel: string;
  targetWord?: string;
  targetGrammar?: string;
  exerciseType?: string;
  context?: string;
  count?: number;
}

/**
 * Generate dynamic content (distractors, accepted answers, speech variants, etc.)
 * via the generate-content edge function.
 */
export async function generateContent(request: GenerateContentRequest): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('generate-content', {
    body: request,
  });
  if (error) throw new Error(`Content generation error: ${error.message}`);
  return data;
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
