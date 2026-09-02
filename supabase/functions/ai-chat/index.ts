// Supabase Edge Function: AI Chat
// Handles conversation practice with language corrections.
// Uses Claude Haiku for natural, conversational responses.
// Enforces per-plan daily text conversation limits before calling AI.
//
// Auth: this function deploys with verify_jwt: false because the Edge
// Runtime's built-in verifier doesn't handle every Supabase JWT variant
// (UNAUTHORIZED_LEGACY_JWT when the project is on new signing keys + HS256,
// UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM when it's on ES256). Instead we
// validate the Authorization header by delegating to Supabase's own
// `auth.getUser(token)` endpoint, which handles every signing algorithm the
// project has configured. If the token is missing or invalid we return 401.
// The authenticated user id comes from the verified user record — we do NOT
// trust any userId passed in the request body for DB writes or quotas.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getEffectiveLimits } from '../_shared/plan-limits.ts';
import { combinedScore, scoreTurn } from '../_shared/turn-accuracy.ts';
import { getScenario } from '../_shared/scenarios.ts';
import { buildSystemPrompt, buildTopicTurn, usesPromptFirstCorrection } from './prompt.ts';
import { actInstruction, selectDialogueAct } from './dialogue-act.ts';
import { floorShareNote, pushNote, selectPushStance } from './turn-policy.ts';
import { generateValidated } from '../_shared/validated-generate.ts';
import { proficiencyToCefr } from '../_shared/cefr.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import { fetchLearnerContext, serializeLearnerContext } from '../_shared/learner-context.ts';
import {
  isValidLanguage,
  isValidProficiencyLevel,
  sanitizeText,
} from '../_shared/validation.ts';

// Caps on untrusted request input. A single turn well over this is not a
// learner practising — it is cost abuse or a prompt-injection payload.
// 400, not 2000. This is one turn of a spoken conversation from a learner who
// is by definition not fluent — A2 learners do not write 2000-character
// messages. The old cap was pure tail risk: it multiplied by the 24-turn
// window into ~13k input tokens re-sent on EVERY turn, which was the single
// largest cost in the app after image generation.
const MAX_MESSAGE_CHARS = 400;
const MAX_TOPIC_CHARS = 200;
const MAX_MESSAGES = 100;
// Assignment context is teacher-authored (trusted-ish) but still bounded.
const MAX_ASSIGNMENT_TOPIC_CHARS = 800;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

/** Recent scored turns the push governor averages over. Wide enough to be a
 *  pattern rather than a streak, narrow enough that last month's form does not
 *  argue for stretching someone who is struggling today. */
const PUSH_SIGNAL_WINDOW = 30;

// Per-language fallback copy for when regenerate retries exhaust safety
// checks. Keeps the conversation alive without exposing bad output.
const FALLBACK_REPLIES: Record<string, string> = {
  en: "Let's try a different topic — what else would you like to chat about?",
  es: 'Probemos con un tema diferente — ¿de qué más te gustaría hablar?',
  fr: "Essayons un autre sujet — de quoi d'autre aimerais-tu parler?",
  de: 'Versuchen wir ein anderes Thema — worüber möchtest du sonst sprechen?',
  it: 'Proviamo un argomento diverso — di cos\'altro ti piacerebbe parlare?',
  pt: 'Vamos tentar um tópico diferente — sobre o que mais gostaria de conversar?',
  ja: '違う話題にしましょう — 他に何について話したいですか？',
  ko: '다른 주제로 바꿔볼까요 — 또 무엇에 대해 이야기하고 싶으세요?',
  zh: '我们换个话题吧 — 你还想聊点什么？',
};

interface ChatRequest {
  messages: { role: string; content: string }[];
  targetLanguage: string;
  /** Language the correction's explanation should be written in.
   *  Defaults to 'en' if not supplied. */
  nativeLanguage?: string;
  level: string;
  scenarioKey?: string;
  topic?: string;
  assignmentId?: string;
  /** Tagged from the calling client for error-log attribution. */
  chatSessionId?: string;
  /** Language the learner actually spoke, when it differs from targetLanguage.
   *  Set by the voice loop from Whisper's detection. */
  spokenLanguage?: string;
  /** Whether this turn was spoken or typed. Decides which skill the turn
   *  becomes evidence for: a spoken turn is evidence about speaking, a typed
   *  one about written production. Defaults to 'writing' — the conservative
   *  guess, since a typed turn is never scored on intelligibility. */
  modality?: 'speaking' | 'writing';
  /** The speech recogniser's confidence in this turn, 0-1, from
   *  `sttConfidence` on the client. Voice turns only.
   *
   *  Client-supplied and therefore untrusted, so it is clamped and can only
   *  ever move this learner's own displayed proficiency — there is no league,
   *  no leaderboard and no economic value attached to a CEFR level (XP and
   *  leagues are hidden by design). It is not worth a second Whisper call to
   *  re-derive server-side. */
  recognizerConfidence?: number;
  /** Did our previous turn ask the learner to fix something themselves? The
   *  server decides this and returns it as `requestedRepair`; the client just
   *  carries it back. It bounds the push to a single attempt — see
   *  ./dialogue-act.ts. */
  previousTurnRequestedRepair?: boolean;
  /** The conversation is ending (an assignment's time is up, or the learner is
   *  wrapping up), so the tutor should close rather than open a new thread. */
  isClosing?: boolean;
}

/**
 * Voice learners code-switch — they hit a wall in the target language and drop
 * into their own. Answering that in the target language as if nothing happened
 * is the single most common way a tutor conversation dies. Tell the model what
 * happened so it can answer the actual question, then steer back.
 *
 * Returns null in the normal case (no switch), so the cached prompt is used
 * unchanged and text chat is completely unaffected.
 */
function buildCodeSwitchNote(spokenLanguage: string | undefined, targetLanguage: string): string | null {
  if (!spokenLanguage || spokenLanguage === targetLanguage) return null;
  return `The learner just spoke in ${spokenLanguage}, not ${targetLanguage}. They have probably hit a gap in what they can express. Acknowledge briefly in ${spokenLanguage} if that helps them, answer what they actually asked, give them the ${targetLanguage} phrasing they were reaching for, and continue the conversation in ${targetLanguage}. Do not scold them for switching and do not ignore what they said.`;
}

type CorrectionErrorType =
  | 'grammar' | 'vocabulary' | 'spelling' | 'word_order' | 'tense' | 'gender' | 'other';
type CorrectionSeverity = 'minor' | 'moderate' | 'critical';

interface CorrectionDetail {
  shortLabel: string;
  explanation: string;
  original: string;
  corrected: string;
  errorType: CorrectionErrorType;
  severity: CorrectionSeverity;
  example?: string | null;
  repetitionCount?: number;
}

// ─── Auth helper ──────────────────────────────────────────────────────────

/**
 * Verify the caller's bearer token via Supabase's auth service. Works
 * regardless of signing algorithm (HS256, ES256, RS256). Returns the
 * authenticated user's id, or null if the token is missing / invalid.
 */
async function verifyBearer(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader || !/^bearer\s+/i.test(authHeader)) return null;
  const token = authHeader.replace(/^bearer\s+/i, '').trim();
  if (!token) return null;

  // Service-role client so we can call auth.getUser on any user's token.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

// ─── Usage helpers ────────────────────────────────────────────────────────

/**
 * Atomic check-and-consume of a daily quota counter (migration 037).
 * Returns false when the user is at their limit. Replaces the old
 * read-check-increment pattern, which was racy under concurrent requests.
 */
async function consumeDailyQuota(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  counter: string,
  limit: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc('consume_daily_quota', {
    p_user_id: userId,
    p_counter: counter,
    p_limit: limit,
  });
  if (error) {
    // Fail closed: if quota accounting is broken we'd rather block than
    // hand out unmetered LLM calls.
    console.error('[ai-chat] consume_daily_quota failed:', error.message);
    return false;
  }
  return data === true;
}

// ─── Main handler ─────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  // Custom auth check. Returns 401 if no valid bearer token.
  const authenticatedUserId = await verifyBearer(req).catch(() => null);
  if (!authenticatedUserId) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing authorization token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const {
      messages: rawMessages,
      targetLanguage,
      nativeLanguage: rawNativeLanguage,
      level,
      topic: rawTopic,
      scenarioKey,
      assignmentId,
      chatSessionId,
      spokenLanguage,
      modality,
      recognizerConfidence,
      previousTurnRequestedRepair,
      isClosing,
    } = (await req.json()) as ChatRequest;
    const nativeLanguage = rawNativeLanguage || 'en';

    // Validate untrusted input before it reaches a paid model call.
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!isValidLanguage(targetLanguage)) {
      return new Response(
        JSON.stringify({ error: 'Unsupported target language' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!isValidProficiencyLevel(level)) {
      return new Response(
        JSON.stringify({ error: 'Unsupported proficiency level' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // The other two strings that reach the system prompt — nativeLanguage
    // through buildSystemPrompt, spokenLanguage through the code-switch note —
    // and neither was checked. targetLanguage and level already were; this
    // closes the pair that was missed.
    //
    // Both DEGRADE rather than 400, unlike targetLanguage, because neither is
    // required for the request to make sense and both can legitimately carry a
    // language the app does not teach: `toLanguageCode` in the voice loop
    // resolves Arabic and Hindi, which VALID_LANGUAGES does not list. Rejecting
    // would break code-switching for exactly the learners it exists to help.
    const safeNativeLanguage = isValidLanguage(nativeLanguage) ? nativeLanguage : 'en';
    const safeSpokenLanguage =
      spokenLanguage && isValidLanguage(spokenLanguage) ? spokenLanguage : undefined;

    // Cap both the number of turns and the size of each one. windowMessages()
    // trims history for the model, but an uncapped single message would still
    // go straight into the Anthropic call.
    const messages = rawMessages.slice(-MAX_MESSAGES).map((m) => ({
      ...m,
      content: sanitizeText(String(m?.content ?? ''), MAX_MESSAGE_CHARS),
    }));

    let topic = rawTopic ? sanitizeText(rawTopic, MAX_TOPIC_CHARS) : rawTopic;
    if (assignmentId) {
      const { data: assignment } = await supabase
        .from('assignments')
        .select('title, custom_scenario, scenario_key, instructions, vocabulary_focus, grammar_focus')
        .eq('id', assignmentId)
        .single();

      if (assignment) {
        const scenarioDesc =
          assignment.custom_scenario ?? assignment.scenario_key ?? assignment.title ?? '';
        const extras: string[] = [];
        if (assignment.instructions) extras.push(`Instructions: ${assignment.instructions}`);
        if (assignment.vocabulary_focus)
          extras.push(`Vocabulary focus: ${JSON.stringify(assignment.vocabulary_focus)}`);
        if (assignment.grammar_focus)
          extras.push(`Grammar focus: ${JSON.stringify(assignment.grammar_focus)}`);
        const assignmentContext = [scenarioDesc, ...extras].filter(Boolean).join('. ');
        topic = sanitizeText(
          topic ? `${topic}. Assignment: ${assignmentContext}` : assignmentContext,
          MAX_ASSIGNMENT_TOPIC_CHARS
        );
      }
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Burst limit first — a rate-limited request should not consume quota.
    const burstOk = await checkBurstLimit(supabase, authenticatedUserId, 'ai-chat', 20, 60);
    if (!burstOk) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const limits = await getEffectiveLimits(authenticatedUserId, supabase);
    const allowed = await consumeDailyQuota(
      supabase,
      authenticatedUserId,
      'text_messages',
      limits.dailyTextMessages
    );
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error:
            "You've reached your daily text message limit. Upgrade your plan to keep practicing today.",
          code: 'DAILY_TEXT_LIMIT_REACHED',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Per-learner context is a paid feature (basic and up). The entitlement is
    // the one already resolved above — no second tier lookup. `starter` has
    // dailyTextMessages = 0, so `consume_daily_quota` has already turned every
    // un-entitled caller away by the time execution reaches here; the explicit
    // check keeps that reasoning visible rather than implied, and it is what
    // correctly *includes* a free-tier classroom student whose org contract
    // grants them a text allowance via get_effective_limits.
    //
    // fetchLearnerContext never throws and never blocks: on any failure it
    // returns null and this turn generates exactly as it did before.
    const learnerContext =
      limits.dailyTextMessages > 0
        ? await fetchLearnerContext(supabase, {
            userId: authenticatedUserId,
            targetLanguage,
          })
        : null;
    const learnerBlock = serializeLearnerContext(learnerContext);
    // The steer sits OUTSIDE the <LEARNER_PROFILE> fence: instructions to the
    // model are ours, everything inside the fence is data about the learner.
    const learnerNote = learnerBlock
      ? `${learnerBlock}\nUse this to decide what to correct, what to recast, and which examples to reach for. Never read it back to the learner or mention that you have it.`
      : null;

    const systemPrompt = buildSystemPrompt(targetLanguage, level, scenarioKey, safeNativeLanguage);
    // A running scenario supersedes a free-text topic — that is what the old
    // `!scenarioBlock && topic` condition encoded, preserved here.
    const topicTurn = scenarioKey && getScenario(scenarioKey) ? null : buildTopicTurn(topic);
    const codeSwitchNote = buildCodeSwitchNote(safeSpokenLanguage, targetLanguage);

    // ── Dialogue act ───────────────────────────────────────────────────
    //
    // The stance for this turn, chosen in code rather than left to the model
    // to infer from one paragraph among thirty. See ./dialogue-act.ts for why
    // — briefly: a policy expressed as code can be bounded and tested, and the
    // category's most-cited complaint (every AI turn ends in a question) is
    // what happens when it is not.
    //
    // The learner's own turns only; the tutor's replies are not evidence about
    // how engaged the learner is.
    const learnerTurns = messages.filter((m) => m.role === 'user').map((m) => m.content);
    const dialogueAct = selectDialogueAct({
      turnIndex: Math.max(0, learnerTurns.length - 1),
      learnerText: learnerTurns[learnerTurns.length - 1] ?? '',
      recentLearnerTurns: learnerTurns.slice(0, -1).reverse(),
      previousTurnRequestedRepair: previousTurnRequestedRepair === true,
      isClosing: isClosing === true,
    });
    const actNote = actInstruction(dialogueAct, targetLanguage);

    // Needed by the push governor below as well as by the safety pipeline, so
    // it is resolved before either.
    const cefrLevel = proficiencyToCefr(level);

    // ── Governors ──────────────────────────────────────────────────────
    //
    // How much room the learner gets, and how hard they are pushed. Both are
    // null on most turns by design — they are governors, not a house style,
    // and a note that fires every turn is just a longer system prompt.
    //
    // Floor share costs nothing: it is arithmetic over the history already in
    // hand. The push signal costs one indexed read, and only for learners who
    // have a level to be measured against.
    const floorNote = floorShareNote(messages);
    const pushStance = selectPushStance(await fetchPushSignal(supabase, {
      userId: authenticatedUserId,
      targetLanguage,
      cefrLevel,
    }));
    const stretchNote = pushNote(pushStance, targetLanguage);

    const fallbackReply = FALLBACK_REPLIES[targetLanguage] ?? FALLBACK_REPLIES.en;

    const { text: rawText, usedFallback } = await generateValidated({
      fn: 'ai-chat',
      targetLevel: cefrLevel,
      language: targetLanguage,
      safetyRetries: 2,
      generate: async () => {
        const response = await providerFetch(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: TEXT_MODEL,
              // The prompt asks for "1-3 sentences" plus a correction object;
              // that lands near 250 tokens. 400 leaves headroom without paying
              // for a ceiling nothing reaches — output is $5/MTok against $1
              // for input, so this cap costs more than the whole prompt does.
              max_tokens: 400,
              // The scenario prompt is the cached prefix. Everything after it is
              // appended uncached, deliberately: the code-switch note changes
              // turn to turn, and the learner profile is unique per user. Put
              // either one inside the cached block and the prefix stops being
              // shared — every learner misses the cache on every turn, forever.
              // The code-switch note goes last because it is about *this* turn.
              //
              // The learner's `topic` used to sit inside that cached block,
              // which broke this exact rule — it is the most variable input
              // there is. It is now a fenced user turn in `messages` below,
              // which restores a shared prefix AND puts caller text behind a
              // role boundary instead of a fence in our own voice.
              system: [
                { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
                ...(learnerNote ? [{ type: 'text', text: learnerNote }] : []),
                // The dialogue act belongs out here for the same reason as the
                // other two: it changes every turn, and inside the cached block
                // it would make the shared prefix unshareable. It sits before
                // the code-switch note because that note is the narrower
                // instruction — it should be the last thing read.
                ...(actNote ? [{ type: 'text', text: actNote }] : []),
                // Both governors ride out here for the same reason as the act:
                // they change turn to turn and would poison the shared prefix.
                ...(floorNote ? [{ type: 'text', text: floorNote }] : []),
                ...(stretchNote ? [{ type: 'text', text: stretchNote }] : []),
                ...(codeSwitchNote ? [{ type: 'text', text: codeSwitchNote }] : []),
              ],
              messages: [
                ...(topicTurn ? [topicTurn] : []),
                ...windowMessages(messages),
              ].map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
              })),
            }),
          },
          { provider: 'anthropic', timeoutMs: PROVIDER_TIMEOUT_MS.text },
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        const text = data.content?.[0]?.text ?? '';
        if (!text) throw new Error('Empty response from Claude');
        return text;
      },
      fallback: async () => fallbackReply,
    });

    // When the safety fallback fires, we skip parsing (no [CORRECTION] block)
    // and deliver a clean reply with no correction metadata.
    const { reply, correction, vocabularyHighlights } = usedFallback
      ? { reply: rawText, correction: null, vocabularyHighlights: [] }
      : parseAIResponse(rawText);

    // Quota already consumed atomically before the LLM call.

    // Log correction + compute repetition count. Non-fatal: chat reply
    // returns even if logging/counting fails.
    let enrichedCorrection: CorrectionDetail | null = correction;
    if (correction && correction.shortLabel) {
      try {
        await supabase.from('correction_log').insert({
          user_id: authenticatedUserId,
          chat_session_id: chatSessionId ?? null,
          target_language: targetLanguage,
          error_type: correction.errorType,
          severity: correction.severity,
          short_label: correction.shortLabel,
          original: correction.original || null,
          corrected: correction.corrected || null,
          explanation: correction.explanation || null,
        });

        // Count recent occurrences of this short_label (past 7 days, including today)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count, error: countErr } = await supabase
          .from('correction_log')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', authenticatedUserId)
          .eq('short_label', correction.shortLabel)
          .gte('created_at', sevenDaysAgo);

        if (!countErr && typeof count === 'number') {
          enrichedCorrection = { ...correction, repetitionCount: count };
        }
      } catch (logErr) {
        console.warn('[ai-chat] correction_log write failed (non-fatal):', logErr);
      }
    }

    // ── What this turn leaves behind ───────────────────────────────────
    //
    // Both writes are non-fatal and deliberately last: the learner has their
    // reply, and neither a missed card nor a missed data point is worth
    // failing a conversation over.
    // A repair is outstanding only when there was something to repair AND the
    // level's policy is to make the learner fix it. At beginner and elementary
    // the tutor recasts and moves on, so there is no attempt coming.
    const requestedRepair =
      enrichedCorrection !== null && usesPromptFirstCorrection(level) && dialogueAct !== 'follow_repair';

    const learnerTurn = messages[messages.length - 1]?.content ?? '';
    const turnModality = modality === 'speaking' ? 'speaking' : 'writing';

    await recordConversationEvidence(supabase, {
      userId: authenticatedUserId,
      targetLanguage,
      cefrLevel,
      modality: turnModality,
      text: learnerTurn,
      correction,
      recognizerConfidence,
    });

    const savedWords = await saveChatVocabulary(supabase, {
      userId: authenticatedUserId,
      targetLanguage,
      cefrLevel,
      words: vocabularyHighlights,
      limit: limits.dailyChatCards,
    });

    return new Response(
      JSON.stringify({
        reply,
        correction: enrichedCorrection,
        vocabularyHighlights,
        /** Which of the highlighted words actually became review cards. The
         *  UI marks these so the learner knows the word is coming back. */
        savedWords,
        /** Did this turn ask the learner to fix something themselves? The
         *  client carries it back on the next turn so the controller can
         *  react to their attempt and, crucially, not ask a second time.
         *
         *  Server-decided rather than client-inferred: whether a correction
         *  becomes an elicitation or a recast is the level policy's call
         *  (see usesPromptFirstCorrection), and the client should not have to
         *  know that rule to participate in it. */
        requestedRepair,
        /** The stance this turn was generated with. Returned for observability
         *  — nothing in the client branches on it. */
        dialogueAct,
        audioUrl: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // This message is whatever threw: an Anthropic response body (which quotes
    // the system prompt back) or a Postgres error (which names columns).
    // Neither is the client's business — CLAUDE.md §6.
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ai-chat] unhandled error:', message);
    return new Response(
      JSON.stringify({ error: 'Chat is temporarily unavailable. Please try again.', code: 'CHAT_FAILED' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function windowMessages(
  messages: { role: string; content: string }[]
): { role: string; content: string }[] {
  // 12, not 24. Every turn in this window is re-sent uncached on every
  // request, so the window is a direct multiplier on input cost for the whole
  // conversation. Twelve turns is still a long exchange for a practice
  // session, and the summary note below covers what falls out.
  const MAX_TURNS = 12;
  if (messages.length <= MAX_TURNS) return messages;
  const older = messages.slice(0, messages.length - MAX_TURNS);
  const recent = messages.slice(messages.length - MAX_TURNS);
  const summaryNote = {
    role: 'user',
    content: `[Context: This is an ongoing conversation. There were ${older.length} earlier messages covering the same topic. Continue naturally from here.]`,
  };
  return [summaryNote, ...recent];
}


function normalizeCorrection(raw: unknown): CorrectionDetail | null {
  if (raw == null) return null;
  // Legacy / fallback: AI sometimes emits a plain string in the correction
  // field despite the schema instructions.
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return {
      shortLabel: trimmed.slice(0, 60),
      explanation: trimmed,
      original: '',
      corrected: '',
      errorType: 'other',
      severity: 'moderate',
      example: null,
    };
  }
  const obj = raw as Record<string, unknown>;
  const explanation = typeof obj.explanation === 'string' ? obj.explanation : '';
  const shortLabel =
    typeof obj.shortLabel === 'string' && obj.shortLabel.trim()
      ? obj.shortLabel.slice(0, 80)
      : explanation.slice(0, 80) || 'Correction';
  const original = typeof obj.original === 'string' ? obj.original : '';
  const corrected = typeof obj.corrected === 'string' ? obj.corrected : '';
  const errorTypeRaw = obj.errorType;
  const errorType: CorrectionErrorType =
    typeof errorTypeRaw === 'string' &&
    ['grammar','vocabulary','spelling','word_order','tense','gender','other'].includes(errorTypeRaw)
      ? (errorTypeRaw as CorrectionErrorType)
      : 'other';
  const severityRaw = obj.severity;
  const severity: CorrectionSeverity =
    typeof severityRaw === 'string' && ['minor','moderate','critical'].includes(severityRaw)
      ? (severityRaw as CorrectionSeverity)
      : 'moderate';
  const example = obj.example == null || obj.example === '' ? null : String(obj.example);
  if (!explanation && !original && !corrected) return null;
  return { shortLabel, explanation, original, corrected, errorType, severity, example };
}

/**
 * One word the tutor chose to teach, with its meaning.
 *
 * The model used to be asked for a bare `string[]`, which was fine while the
 * array was only ever rendered bold and thrown away. A card needs both halves:
 * `cards.native_text` is NOT NULL, and a "card" whose front and back are the
 * same foreign word teaches nothing.
 */
interface VocabHighlight {
  word: string;
  translation: string;
}

/** Longer than this is a sentence the model has mislabelled as vocabulary,
 *  not a word worth a card. */
const MAX_VOCAB_CHARS = 60;

/**
 * Accept both the object shape and the legacy bare strings.
 *
 * A model does not always follow a changed contract on the first turn, and a
 * cached system prompt means older phrasing can persist briefly. A bare
 * string still renders as a highlight; it simply cannot become a card, which
 * `saveChatVocabulary` enforces by requiring a translation.
 */
function normalizeVocabulary(raw: unknown): VocabHighlight[] {
  if (!Array.isArray(raw)) return [];
  const out: VocabHighlight[] = [];
  for (const entry of raw.slice(0, 8)) {
    if (typeof entry === 'string') {
      const word = entry.trim();
      if (word && word.length <= MAX_VOCAB_CHARS) out.push({ word, translation: '' });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const word = String((entry as Record<string, unknown>).word ?? '').trim();
      const translation = String((entry as Record<string, unknown>).translation ?? '').trim();
      if (word && word.length <= MAX_VOCAB_CHARS) {
        out.push({ word, translation: translation.slice(0, 200) });
      }
    }
  }
  return out;
}

function parseAIResponse(text: string): {
  reply: string;
  correction: CorrectionDetail | null;
  vocabularyHighlights: VocabHighlight[];
} {
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      reply: parsed.reply ?? text,
      correction: normalizeCorrection(parsed.correction),
      vocabularyHighlights: normalizeVocabulary(parsed.vocabularyHighlights),
    };
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        return {
          reply: parsed.reply ?? text,
          correction: normalizeCorrection(parsed.correction),
          vocabularyHighlights: normalizeVocabulary(parsed.vocabularyHighlights),
        };
      } catch {
        // fall through
      }
    }
    const correctionMarker = '[CORRECTION]:';
    const index = text.indexOf(correctionMarker);
    if (index === -1) {
      return { reply: text.trim(), correction: null, vocabularyHighlights: [] };
    }
    const reply = text.substring(0, index).trim();
    const correction = text.substring(index + correctionMarker.length).trim();
    return { reply, correction: normalizeCorrection(correction), vocabularyHighlights: [] };
  }
}

// ─── What a conversation leaves behind ──────────────────────────────────
//
// Both helpers are best-effort by construction. The learner already has their
// reply by the time either runs, so every failure path here logs and returns
// rather than throwing — a lost card or a lost data point must never cost
// someone their conversation.

interface EvidenceInput {
  userId: string;
  targetLanguage: string;
  cefrLevel: string;
  modality: 'speaking' | 'writing';
  text: string;
  correction: CorrectionDetail | null;
  recognizerConfidence?: number;
}

/**
 * Record this turn as proficiency evidence, if it is any.
 *
 * `scoreTurn` returns null for turns that should not count — too short to be
 * a language sample, or spoken and not clearly heard. That refusal is the
 * point: a wrong data point in a measured CEFR level is worse than a missing
 * one, because the learner reads the level and acts on it.
 */
// deno-lint-ignore no-explicit-any
async function recordConversationEvidence(supabase: any, input: EvidenceInput): Promise<void> {
  try {
    const score = scoreTurn({
      modality: input.modality,
      text: input.text,
      correction: input.correction,
      recognizerConfidence: input.recognizerConfidence ?? null,
    });
    if (!score) return;

    await supabase.from('conversation_evidence').insert({
      user_id: input.userId,
      target_language: input.targetLanguage,
      cefr_level: input.cefrLevel,
      modality: input.modality,
      intelligibility: score.intelligibility,
      accuracy: score.accuracy,
      word_count: score.wordCount,
    });
  } catch (err) {
    console.warn('[ai-chat] conversation_evidence write failed (non-fatal):', err);
  }
}

interface VocabSaveInput {
  userId: string;
  targetLanguage: string;
  cefrLevel: string;
  words: VocabHighlight[];
  limit: number;
}

/**
 * Turn the words the tutor just taught into review cards.
 *
 * This closes a loop whose other half already existed: `learner-context.ts`
 * has always pulled struggling cards back into the tutor's prompt, so the
 * moment these words become cards the tutor starts reusing tomorrow what it
 * introduced today, with no further work.
 *
 * Order matters here. Dedupe first because it is free and a repeat word must
 * not cost a slot; charge second, because `consume_daily_quota` is the atomic
 * check-and-increment and charging after the insert would let concurrent
 * turns both pass; refund on any failure after the charge, which is precisely
 * why `chat_cards` was added to the refund whitelist in migration 095.
 *
 * Returns the words that actually became cards, so the UI can tell the
 * learner which ones are coming back.
 */
// deno-lint-ignore no-explicit-any
async function saveChatVocabulary(supabase: any, input: VocabSaveInput): Promise<string[]> {
  const saved: string[] = [];
  // A tutor turn offering more than this is not teaching vocabulary, it is
  // listing it — and each entry costs a quota slot and two round trips.
  const candidates = input.words.filter((w) => w.word && w.translation).slice(0, 3);
  if (candidates.length === 0 || input.limit <= 0) return saved;

  for (const { word, translation } of candidates) {
    try {
      // Already studying it? Nothing to do, and nothing to charge. Without
      // this a tutor that says "la cuenta" across ten sessions would build
      // ten cards, each with its own independent SM-2 schedule.
      const { data: existing } = await supabase
        .from('cards')
        .select('id')
        .eq('user_id', input.userId)
        .eq('language', input.targetLanguage)
        .ilike('target_text', word)
        .limit(1);
      if (Array.isArray(existing) && existing.length > 0) continue;

      const { data: allowed, error: quotaErr } = await supabase.rpc('consume_daily_quota', {
        p_user_id: input.userId,
        p_counter: 'chat_cards',
        p_limit: input.limit,
        p_amount: 1,
      });
      // Fail closed on a broken counter, and stop trying for this turn — the
      // next word would hit the same error.
      if (quotaErr) {
        console.warn('[ai-chat] chat_cards quota check failed:', quotaErr.message);
        break;
      }
      if (allowed !== true) break; // day's allowance spent

      const { data: card, error: cardErr } = await supabase
        .from('cards')
        .insert({
          user_id: input.userId,
          course_id: null,
          unit_id: null,
          native_text: translation,
          target_text: word,
          language: input.targetLanguage,
          // Tagged with the level the conversation was held at. Without this
          // the card is invisible to `analyzeBands`, which skips items with a
          // null cefr_level — the card would exist, be reviewed, and still
          // never count toward the learner's own measured vocabulary.
          cefr_level: input.cefrLevel,
          skill_type: 'vocabulary',
          source_type: 'manual',
          tags: ['chat', 'vocabulary'],
        })
        .select('id')
        .single();

      if (cardErr || !card) {
        await supabase.rpc('refund_daily_quota', {
          p_user_id: input.userId,
          p_counter: 'chat_cards',
          p_amount: 1,
        });
        console.warn('[ai-chat] chat card insert failed:', cardErr?.message);
        continue;
      }

      const { error: reviewErr } = await supabase.from('review_items').upsert(
        {
          user_id: input.userId,
          card_id: card.id,
          ease_factor: 2.5,
          interval: 0,
          repetitions: 0,
          next_due: new Date().toISOString(),
          last_reviewed_at: null,
          status: 'new',
        },
        { onConflict: 'user_id,card_id' },
      );
      if (reviewErr) {
        // The card exists but is not scheduled, so it is not a review card and
        // should not have been charged for.
        await supabase.rpc('refund_daily_quota', {
          p_user_id: input.userId,
          p_counter: 'chat_cards',
          p_amount: 1,
        });
        console.warn('[ai-chat] chat card review_item failed:', reviewErr.message);
        continue;
      }

      saved.push(word);
    } catch (err) {
      console.warn('[ai-chat] chat vocabulary save failed (non-fatal):', err);
    }
  }

  return saved;
}

/**
 * How well the learner has been doing lately at the level they are on.
 *
 * Feeds the push governor: a learner comfortably clear of the pass mark is
 * being under-served by their current level, and the only way to know that is
 * to look at what they have actually produced.
 *
 * Scoped to the current band on purpose. Pooling every level would let strong
 * A1 turns argue for stretching a learner who has since moved to B1 and is
 * struggling there — the question is "are they coasting *here*", not "have
 * they ever done well".
 *
 * Fails soft to a null signal, which `selectPushStance` reads as `hold`. A
 * broken read must never push a struggling learner.
 */
// deno-lint-ignore no-explicit-any
async function fetchPushSignal(
  supabase: any,
  opts: { userId: string; targetLanguage: string; cefrLevel: string },
): Promise<{ recentAccuracy: number | null; sampleSize: number }> {
  try {
    const { data, error } = await supabase
      .from('conversation_evidence')
      .select('accuracy, intelligibility')
      .eq('user_id', opts.userId)
      .eq('target_language', opts.targetLanguage)
      .eq('cefr_level', opts.cefrLevel)
      .order('created_at', { ascending: false })
      // Recent, not lifetime: a learner who was coasting a month ago and is
      // struggling today should be held, not pushed.
      .limit(PUSH_SIGNAL_WINDOW);

    if (error || !Array.isArray(data) || data.length === 0) {
      return { recentAccuracy: null, sampleSize: 0 };
    }

    let total = 0;
    for (const row of data) {
      const accuracy = Number(row.accuracy ?? 0);
      const intelligibility =
        row.intelligibility === null || row.intelligibility === undefined
          ? null
          : Number(row.intelligibility);
      // The same combination the proficiency report uses, so "coasting" here
      // means the same thing the learner sees on their own level.
      total += intelligibility === null ? accuracy : 0.5 * accuracy + 0.5 * intelligibility;
    }
    return { recentAccuracy: total / data.length, sampleSize: data.length };
  } catch (err) {
    console.warn('[ai-chat] push signal lookup failed (non-fatal):', err);
    return { recentAccuracy: null, sampleSize: 0 };
  }
}
