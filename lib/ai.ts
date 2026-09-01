import { supabase } from './supabase';
import type {
  ConversationMessage,
  CorrectionDetail,
  LanguageCode,
  ProficiencyLevel,
  PronunciationSource,
} from '../types';
import type { ScenarioKey } from '../types/scenarios';
import type { VoiceGender } from './voice-preference';

// All AI calls go through Supabase Edge Functions.
// The AI API key lives in Edge Function secrets, never on the client.

/**
 * Invoke an edge function, retrying once on a transient failure.
 *
 * `validated-generate` retries the MODEL server-side, but nothing retried the
 * hop between the device and the edge — so a 502 from the platform, a dropped
 * connection, or a request aborted by the client timeout surfaced to the
 * learner as a hard failure on a request that would very likely have succeeded
 * a second later. On mobile that hop is the least reliable part of the chain.
 *
 * Retried: network-shaped errors and 5xx. NOT retried: 4xx — a quota refusal, a
 * safety rejection or a bad request will refuse identically the second time,
 * and retrying a paid call that the server already declined just spends the
 * learner's allowance twice.
 *
 * One retry, with jitter. More would sit behind a spinner longer than anyone
 * will wait, and these calls already carry a 60s ceiling.
 */
async function invokeWithRetry<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors
  // FunctionsClient.invoke<T = any>. Narrowing the default here would retype
  // all eight call sites, and this change is meant to add a retry, nothing else.
  T = any,
>(
  fn: string,
  options: Parameters<typeof supabase.functions.invoke>[1],
): Promise<Awaited<ReturnType<typeof supabase.functions.invoke<T>>>> {
  const attempt = () => supabase.functions.invoke<T>(fn, options);

  const first = await attempt();
  if (!first.error || !isRetriableInvokeError(first.error)) return first;

  // 150-450ms. Enough to clear a transient blip without being felt as a stall.
  await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 300));
  return attempt();
}

function isRetriableInvokeError(error: unknown): boolean {
  const status = (error as { context?: { status?: number } })?.context?.status;
  if (typeof status === 'number') return status >= 500;

  // No status at all means the request never reached the edge: a network drop,
  // or the client-side timeout aborting it.
  const name = (error as { name?: string })?.name ?? '';
  const message = String((error as { message?: string })?.message ?? '').toLowerCase();
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('load failed') ||
    message.includes('fetch failed')
  );
}

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
  /** Set only when the learner spoke a language other than `targetLanguage`,
   *  so the tutor can acknowledge the switch and steer back. */
  spokenLanguage?: string;
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
  /** Where the attempt came from. The proficiency report needs to tell a
   *  graded lesson attempt apart from idle practice; the server defaults to
   *  `practice` when this is absent. */
  source?: PronunciationSource;
  /** The SRS card being spoken, when there is one. Without it the attempt
   *  carries no CEFR band, so it can never contribute to the speaking level —
   *  see `assessSpeaking` in lib/cefr-proficiency.ts. */
  cardId?: string;
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
  const { data, error } = await invokeWithRetry('ai-chat', {
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
  const { data, error } = await invokeWithRetry('score-pronunciation', {
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
  const { data, error } = await invokeWithRetry('get-hint', {
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
  const { data, error } = await invokeWithRetry('translate', {
    body: { text, sourceLanguage, targetLanguage },
  });

  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as Record<string, unknown>).context;
      if (ctx && typeof (ctx as Response).json === 'function') {
        const body = await (ctx as Response).json();
        if (body?.error) detail = body.error;
        // `reason` distinguishes a provider failure from our own safety check
        // rejecting the output. Both surface as the same 502 and the same
        // sentence to the learner, so without carrying it here a persistent
        // translate failure is undiagnosable from the client — which is
        // exactly the state this function was found in.
        if (body?.reason) detail = `${detail} [${body.reason}]`;
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
  /** Learner's preferred tutor voice gender. Server falls back to the
   *  language's default voices where no match exists. */
  voiceGender?: VoiceGender;
  /**
   * Which daily bucket pays for this synthesis.
   *
   * 'lesson' for listening and dictation exercises, which draw on the small
   * lesson-audio allowance every tier including free has. Anything else —
   * chat playback, voice practice, narration — leaves this unset and is
   * metered against voice minutes, which the free tier has none of.
   *
   * The server enforces both buckets; this only chooses between them.
   */
  purpose?: 'lesson' | 'voice';
  /**
   * Playback rate for lesson audio, clamped server-side to [0.7, 1.0].
   *
   * This backs "play it again, slower" — a learner who could not catch a word.
   * It is not a global speed control and is ignored for anything but lesson
   * audio. Note that a non-default rate is a separate cache entry both on the
   * device and in the bucket, so it is a separate synthesis and a separate
   * lesson-audio allowance unit: only send it when the learner asked.
   */
  rate?: number;
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
  const { data, error } = await invokeWithRetry('tts', {
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
          if (
            body.code === 'DAILY_VOICE_LIMIT_REACHED' ||
            body.code === 'DAILY_LESSON_AUDIO_LIMIT_REACHED'
          ) {
            errorCode = 'DAILY_LIMIT';
          }
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
    if (
      data.code === 'DAILY_VOICE_LIMIT_REACHED' ||
      data.code === 'DAILY_LESSON_AUDIO_LIMIT_REACHED'
    ) {
      throw new VoiceError(data.error, 'DAILY_LIMIT');
    }
    if (data.error.includes('not configured')) {
      throw new VoiceError(data.error, 'NOT_CONFIGURED');
    }
    throw new VoiceError(data.error);
  }

  return data.audioBase64 as string;
}

export interface Transcription {
  text: string;
  /** Language Whisper actually heard, which may not be `language` — learners
   *  code-switch. Null when detection failed and no hint was supplied. */
  language: string | null;
}

/**
 * Transcribe audio using Whisper STT.
 * `language` is a hint only; the returned `language` is what was detected.
 */
export async function transcribeAudio(
  audioBase64: string,
  language: string
): Promise<Transcription> {
  const { data, error } = await invokeWithRetry('transcribe', {
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
          if (
            body.code === 'DAILY_VOICE_LIMIT_REACHED' ||
            body.code === 'DAILY_LESSON_AUDIO_LIMIT_REACHED'
          ) {
            errorCode = 'DAILY_LIMIT';
          }
          else if (body.error.includes('not configured')) errorCode = 'NOT_CONFIGURED';
        }
      }
    } catch {
      // fall through
    }

    throw new VoiceError(errorMessage, errorCode);
  }

  if (data?.error) {
    if (
      data.code === 'DAILY_VOICE_LIMIT_REACHED' ||
      data.code === 'DAILY_LESSON_AUDIO_LIMIT_REACHED'
    ) {
      throw new VoiceError(data.error, 'DAILY_LIMIT');
    }
    if (data.error.includes('not configured')) {
      throw new VoiceError(data.error, 'NOT_CONFIGURED');
    }
    throw new VoiceError(data.error);
  }

  const result = data as { text: string; language?: string | null };
  return { text: result.text, language: result.language ?? null };
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
  const { data, error } = await invokeWithRetry('generate-content', {
    body: request,
  });
  if (error) throw new Error(`Content generation error: ${error.message}`);
  return data;
}

/**
 * Analyze a voice conversation turn to extract corrections and vocabulary.
 * Currently unused: the cascade voice loop gets corrections inline from
 * `sendChatMessage`. Kept for richer post-turn analysis of spoken input.
 */
export async function analyzeConversationTurn(
  userMessage: string,
  aiReply: string,
  targetLanguage: string,
  level: string
): Promise<{ correction: string | null; vocabularyHighlights: string[] }> {
  const { data, error } = await invokeWithRetry('analyze-turn', {
    body: { userMessage, aiReply, targetLanguage, level },
  });

  if (error) {
    console.error('Analyze turn error:', error);
    return { correction: null, vocabularyHighlights: [] };
  }
  return data as { correction: string | null; vocabularyHighlights: string[] };
}
