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
import { getScenario } from '../_shared/scenarios.ts';
import { buildSystemPrompt, buildTopicTurn } from './prompt.ts';
import {
  parseAIResponse,
  type CorrectionDetail,
} from './parse.ts';
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

    const cefrLevel = proficiencyToCefr(level);
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
              // that lands near 250 tokens. 400 left headroom without paying
              // for a ceiling nothing reaches — output is $5/MTok against $1
              // for input, so this cap costs more than the whole prompt does.
              //
              // 500, not 400: the response now also carries `gloss`, one short
              // native-language sentence (~25 words, budget ~100 tokens). That
              // ~100 tokens of output REPLACES a whole second paid round trip
              // to the `translate` function — its own system prompt, its own
              // input, its own output — every time a learner taps Translate.
              // Do not raise this further to "be safe": a truncated response
              // is unparseable JSON, so headroom here is not free insurance,
              // and the ceiling is what an abusive turn costs us.
              max_tokens: 500,
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
    // The fallback reply is pre-authored target-language copy, so it has no
    // gloss — the client falls back to the `translate` function for it, which
    // is the same path every message took before this field existed.
    const { reply, correction, vocabularyHighlights, gloss } = usedFallback
      ? { reply: rawText, correction: null, vocabularyHighlights: [], gloss: null }
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

    return new Response(
      JSON.stringify({
        reply,
        correction: enrichedCorrection,
        vocabularyHighlights,
        // Null is a supported value, not an omission: the client treats a
        // missing gloss as "translate on demand" rather than as an error.
        gloss,
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
