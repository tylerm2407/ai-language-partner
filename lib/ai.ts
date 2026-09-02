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
  /** Whether this turn was spoken or typed. Decides which skill it becomes
   *  evidence for — speaking, or written production. Defaults to writing. */
  modality?: 'speaking' | 'writing';
  /** `sttConfidence` for a spoken turn, 0-1. Lets the server judge whether
   *  the turn is clear enough to measure, and score how well it came across. */
  recognizerConfidence?: number;
}

/** A word the tutor introduced, with its meaning. */
export interface ChatVocabHighlight {
  word: string;
  translation: string;
}

export interface AIChatResponse {
  reply: string;
  /** Rich correction object (preferred) or legacy string or null. The
   *  ConversationMessage.correction field and the CorrectionBanner render
   *  both shapes via `normalizeCorrection()`. */
  correction: CorrectionDetail | string | null;
  audioUrl: string | null;
  /** Words the tutor chose to teach this turn. Older server deployments
   *  return bare strings; `normalizeChatVocabulary` accepts both. */
  vocabularyHighlights?: (ChatVocabHighlight | string)[];
  /**
   * Native-language gloss of `reply`, generated in the SAME ai-chat call.
   *
   * This is what the Translate button shows on an assistant reply. It costs
   * ~100 output tokens folded into a call we were already paying for, instead
   * of a whole second round trip to the `translate` function for text WE just
   * generated — which is what tapping Translate used to do.
   *
   * Optional and nullable on purpose. The safety fallback reply has no gloss,
   * reloaded history has none (it is not persisted), and an older deployment
   * returns none. In every one of those cases the client falls back to
   * `translateText`, exactly as it behaved before this field existed.
   */
  gloss?: string | null;
  /** Of those, the ones that actually became review cards — deduped against
   *  what the learner already studies and capped by `dailyChatCards`. */
  savedWords?: string[];
}

/**
 * Coerce either highlight shape into the object form.
 *
 * The server changed this contract when the words started becoming cards, and
 * a cached system prompt means the older bare-string shape can still arrive
 * for a while. A string has no translation, so it renders but cannot be
 * studied — which is exactly what the server already enforces.
 */
export function normalizeChatVocabulary(
  raw: (ChatVocabHighlight | string)[] | undefined,
): ChatVocabHighlight[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) =>
      typeof entry === 'string'
        ? { word: entry.trim(), translation: '' }
        : { word: (entry?.word ?? '').trim(), translation: (entry?.translation ?? '').trim() },
    )
    .filter((entry) => entry.word.length > 0);
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
 * A `translate` failure that still carries the server's machine-readable code.
 *
 * The message is unchanged from what this function has always thrown, so
 * existing callers that read `.message` keep working. The code is what lets
 * the reader tell "you are out of lookups for today" — a settled state, worth
 * saying plainly and worth not retrying — from "the network died", which is
 * worth a retry button.
 */
export class TranslateError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'TranslateError';
    this.code = code;
  }
}

/**
 * Translate short text from one language into another via the `translate`
 * Edge Function (Claude Haiku server-side).
 *
 * Two callers: the Translate button in ChatBubble, and tap-a-word lookup in
 * the reader. The reader passes `purpose: 'word_lookup'`, which asks the
 * server to bill the much larger `word_lookups` allowance instead of
 * `translations` — a claim the server verifies against the input rather than
 * trusting, so passing it for a phrase is a 400, not a silent rebill.
 *
 * Failures throw a TranslateError carrying the real server message (extracted
 * from error.context) so the UI can surface useful text.
 */
export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  purpose?: 'word_lookup'
): Promise<string> {
  const { data, error } = await invokeWithRetry('translate', {
    body: { text, sourceLanguage, targetLanguage, ...(purpose ? { purpose } : {}) },
  });

  if (error) {
    let detail = error.message;
    let code: string | undefined;
    try {
      const ctx = (error as Record<string, unknown>).context;
      if (ctx && typeof (ctx as Response).json === 'function') {
        const body = await (ctx as Response).json();
        if (body?.error) detail = body.error;
        if (typeof body?.code === 'string') code = body.code;
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
    throw new TranslateError(`Translation failed: ${detail}`, code);
  }

  if (data?.error) throw new TranslateError(`Translation failed: ${data.error}`);
  return (data as { translation: string }).translation;
}

/**
 * A learner's goal track: the shared course generated for their onboarding
 * "picture a moment you'd love to have in this language" answer.
 */
export interface GoalTrackResult {
  courseId: string;
  goalKey: string;
  /** False when an existing track was reused — the common and free case. */
  generated: boolean;
}

/**
 * Find or build the goal track for the signed-in learner.
 *
 * The server reads their stored `ideal_l2_self` rather than trusting text from
 * here, maps it onto a closed vocabulary, and reuses an existing track whenever
 * one is close enough. Paid feature: a free account gets 403 UPGRADE_REQUIRED.
 */
export async function resolveGoalTrack(
  language: string,
  nativeLanguage: string,
  cefrLevel: string
): Promise<GoalTrackResult> {
  const { data, error } = await invokeWithRetry('generate-goal-track', {
    body: { action: 'resolve', language, nativeLanguage, cefrLevel },
  });
  if (error) throw await goalTrackError(error, 'Building your track failed');
  if (data?.error) throw new TranslateError(`Building your track failed: ${data.error}`);
  return data as GoalTrackResult;
}

/**
 * Make sure a goal-track lesson has exercises before the runner opens it.
 *
 * Lessons are created as shells and filled in on first open — six lessons of
 * exercises is more model time than one request has, and most learners never
 * reach lesson six. The work is shared: whoever opens a lesson first pays for
 * it, everyone after them does not.
 *
 * Returns false when another learner is generating the same lesson right now,
 * which the caller should surface as "one moment" rather than an error.
 */
export async function materializeGoalLesson(
  lessonId: string,
  nativeLanguage: string
): Promise<boolean> {
  const { data, error } = await invokeWithRetry('generate-goal-track', {
    body: { action: 'lesson', lessonId, nativeLanguage },
  });
  if (error) throw await goalTrackError(error, 'Building this lesson failed');
  if (data?.error) throw new TranslateError(`Building this lesson failed: ${data.error}`);
  return data?.ready === true;
}

/** Unwrap the server's message and code the way translateText does. */
async function goalTrackError(error: unknown, prefix: string): Promise<TranslateError> {
  let detail = (error as { message?: string })?.message ?? 'unknown';
  let code: string | undefined;
  try {
    const ctx = (error as Record<string, unknown>).context;
    if (ctx && typeof (ctx as Response).json === 'function') {
      const body = await (ctx as Response).json();
      if (body?.error) detail = body.error;
      if (typeof body?.code === 'string') code = body.code;
    }
  } catch {
    // Body wasn't JSON — fall through with the generic message.
  }
  return new TranslateError(`${prefix}: ${detail}`, code);
}

/** One strand of a checkpoint, as served to the client — no answer key. */
export interface CheckpointItem {
  id: string;
  strand: 'listening' | 'reading' | 'speaking' | 'writing';
  prompt: string;
  options: string[] | null;
  /** Signed URL, listening items only. Expires. */
  audioUrl?: string | null;
}

export interface CheckpointStart {
  checkpointId: string;
  band: string;
  kind: 'placement' | 'monthly';
  items: CheckpointItem[];
}

export interface CheckpointResult {
  composite: number | null;
  band: string;
  movedFrom: string;
  scores: {
    listening: number | null;
    reading: number | null;
    speaking: number | null;
    writing: number | null;
  };
}

/**
 * Open a checkpoint: the ~5 minute, four-strand measure of where the learner
 * actually is.
 *
 * Quota-exempt on every tier including free — spend is bounded by cadence (one
 * placement plus one a month), and a learner who ran out of chat still needs to
 * be able to find out how they are doing.
 */
export async function startCheckpoint(
  language: string,
  band: string,
  kind: 'placement' | 'monthly'
): Promise<CheckpointStart> {
  const { data, error } = await invokeWithRetry('checkpoint', {
    body: { action: 'start', language, band, kind },
  });
  if (error) throw await goalTrackError(error, 'Could not start the checkpoint');
  if (data?.error) throw new TranslateError(`Could not start the checkpoint: ${data.error}`);
  return data as CheckpointStart;
}

/**
 * Submit answers. Grading happens server-side and the scores are never sent
 * from here — a client-supplied score would be a self-assigned leaderboard
 * rank. The speaking strand is read back from `pronunciation_scores`, which
 * `score-pronunciation` writes under the service role.
 */
export async function submitCheckpoint(
  checkpointId: string,
  answers: Record<string, string>
): Promise<CheckpointResult> {
  const { data, error } = await invokeWithRetry('checkpoint', {
    body: { action: 'submit', checkpointId, answers },
  });
  if (error) throw await goalTrackError(error, 'Could not save your checkpoint');
  if (data?.error) throw new TranslateError(`Could not save your checkpoint: ${data.error}`);
  return data as CheckpointResult;
}

/** One narratable segment of a book. */
export interface AudiobookSegment {
  index: number;
  charStart: number;
  charEnd: number;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  durationMs: number | null;
  /** Signed URL when ready. Expires, so re-list rather than caching it. */
  url: string | null;
}

/**
 * The segment map for a book.
 *
 * Segments are fixed-size windows ending on a sentence, not chapters:
 * `chapter_breaks` is populated on under 4% of the library. Premium and up.
 */
export async function listAudiobook(bookId: string): Promise<AudiobookSegment[]> {
  const { data, error } = await invokeWithRetry('audiobook', {
    body: { action: 'list', bookId },
  });
  if (error) throw await goalTrackError(error, 'Could not load the narration');
  if (data?.error) throw new TranslateError(`Could not load the narration: ${data.error}`);
  return ((data?.segments ?? []) as AudiobookSegment[]);
}

/**
 * Play one segment, rendering it if nobody has yet.
 *
 * Returns null while another listener is rendering the same segment — the
 * caller should show "preparing" and retry, not an error. Narration is shared,
 * so this only ever costs the first listener.
 */
export async function playAudiobookSegment(
  bookId: string,
  segmentIndex: number
): Promise<{ url: string | null; rendered: boolean } | null> {
  const { data, error } = await invokeWithRetry('audiobook', {
    body: { action: 'play', bookId, segmentIndex },
  });
  if (error) throw await goalTrackError(error, 'Could not play that section');
  if (data?.error) throw new TranslateError(`Could not play that section: ${data.error}`);
  if (data?.status === 'generating') return null;
  return { url: (data?.url as string) ?? null, rendered: data?.rendered === true };
}

/** Server response for one paragraph explanation. */
export interface PassageExplanation {
  explanation: string;
  /** True when it came from the shared cache — no quota was spent. */
  cached: boolean;
}

/**
 * Explain one paragraph of a book or passage in the learner's native language,
 * via the `explain-passage` Edge Function.
 *
 * Metered against the daily text-message allowance, and cached across every
 * learner on a hash of (language, native language, level, normalised span) —
 * Gutenberg text is identical for everyone, so most of these are free to
 * serve. Errors carry the server code, same as translateText.
 */
export async function explainPassage(
  text: string,
  language: string,
  nativeLanguage: string,
  cefrLevel: string,
  bookId?: string
): Promise<PassageExplanation> {
  const { data, error } = await invokeWithRetry('explain-passage', {
    body: { text, language, nativeLanguage, cefrLevel, ...(bookId ? { bookId } : {}) },
  });

  if (error) {
    let detail = error.message;
    let code: string | undefined;
    try {
      const ctx = (error as Record<string, unknown>).context;
      if (ctx && typeof (ctx as Response).json === 'function') {
        const body = await (ctx as Response).json();
        if (body?.error) detail = body.error;
        if (typeof body?.code === 'string') code = body.code;
        if (body?.reason) detail = `${detail} [${body.reason}]`;
      }
    } catch {
      // Body wasn't JSON — fall through with the generic message.
    }
    throw new TranslateError(`Explanation failed: ${detail}`, code);
  }

  if (data?.error) throw new TranslateError(`Explanation failed: ${data.error}`);
  const row = data as PassageExplanation;
  return { explanation: row.explanation, cached: row.cached === true };
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
  /** Mean token log-probability over the turn, duration-weighted. Roughly
   *  -0.1 is fully confident and -1.0 is not confident at all; feed it to
   *  `sttConfidence` in lib/handsfree-grading.ts rather than thresholding it
   *  here. Null when the provider reported no per-segment confidence. */
  avgLogprob: number | null;
  /** Probability the audio was not speech at all, duration-weighted. Null
   *  when unreported. */
  noSpeechProb: number | null;
  /** Length of the audio Whisper measured, in seconds. Null when unreported.
   *  This is what the turn was billed on. */
  durationSeconds: number | null;
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

  // Every confidence field is optional on the wire and defaults to null. An
  // older deployment of the `transcribe` function returns only text and
  // language, and a null reads downstream as "no signal" rather than as low
  // confidence — so a stale function degrades to the previous behaviour
  // instead of silently failing every turn shut.
  const result = data as {
    text: string;
    language?: string | null;
    avgLogprob?: number | null;
    noSpeechProb?: number | null;
    durationSeconds?: number | null;
  };
  return {
    text: result.text,
    language: result.language ?? null,
    avgLogprob: result.avgLogprob ?? null,
    noSpeechProb: result.noSpeechProb ?? null,
    durationSeconds: result.durationSeconds ?? null,
  };
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
