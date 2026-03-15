import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  handleCORS, verifyAuth, checkRateLimit,
  jsonResponse, errorResponse, log, requireString, getAdminClient, HttpError,
} from "../_shared/middleware.ts";
import { getModelConfig, shouldSummarize, buildSummarizationPrompt, MESSAGES_TO_KEEP_FULL } from "../_shared/ai-config.ts";

const FN = "tutor-message";

interface TutorState {
  common_errors: string[];
  mastered_vocab: string[];
  preferred_topics: string[];
  cefr_estimate: string;
  session_count: number;
}

function buildTutorSystemPrompt(
  languageName: string,
  nativeLanguage: string,
  userLevel: string,
  tutorState: TutorState,
): string {
  const errors = tutorState.common_errors.slice(-5).join(", ") || "none yet";
  const mastered = tutorState.mastered_vocab.slice(-10).join(", ") || "none yet";

  return `You are ${languageName} AI \u2014 a warm, patient, expert ${languageName} tutor with years of experience teaching ${nativeLanguage} speakers.

STUDENT PROFILE:
- Current level: ${userLevel} (CEFR)
- Native language: ${nativeLanguage}
- Recent errors to revisit: ${errors}
- Vocabulary they've mastered: ${mastered}
- Preferred topics: ${tutorState.preferred_topics.join(", ") || "general conversation"}
- Sessions completed: ${tutorState.session_count}

YOUR BEHAVIOR:
1. ALWAYS reply primarily in ${languageName} \u2014 immersion is key
2. Gently correct errors inline using: \u270F\uFE0F [correction]
3. After your main reply, add a [Tutor Notes] section with:
   - English translation of your reply
   - \uD83D\uDCA1 One grammar tip (1-2 sentences max)
   - \uD83D\uDCDD New vocab from this turn: word \u2014 meaning
4. Match complexity to ${userLevel}: ${userLevel.startsWith("A") ? "simple sentences, high-frequency words" : userLevel.startsWith("B") ? "natural conversation, introduce idioms" : "nuanced language, cultural references"}
5. Ask follow-up questions to keep conversation flowing
6. Sound like a human friend who speaks ${languageName} natively \u2014 not a textbook
7. If user writes in ${nativeLanguage}, encourage them to try in ${languageName} and give a starter phrase

RESPONSE FORMAT:
[Your reply in ${languageName}]

[Tutor Notes]
\uD83C\uDDEC\uD83C\uDDE7 Translation: "..."
\uD83D\uDCA1 Tip: ...
\uD83D\uDCDD Vocab: word \u2014 meaning (repeat for each new word)`;
}

function extractVocab(text: string): string[] {
  return [...text.matchAll(/\uD83D\uDCDD Vocab: (.+)/g)].map(m => m[1].trim());
}

function extractCorrections(text: string): string[] {
  return [...text.matchAll(/\u270F\uFE0F ([^\n]+)/g)].map(m => m[1].trim());
}

serve(async (req) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  try {
    const user = await verifyAuth(req);
    checkRateLimit(user.id, 15, 60_000);
    log(FN, "authenticated", { userId: user.id });

    const db = getAdminClient();
    const config = getModelConfig("tutor");

    // Verify paid subscription
    const { data: sub } = await db.from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", user.id)
      .single();

    const isPaid = sub && sub.status === "active" &&
      ["pro", "family", "lifetime", "vip"].includes(sub.plan) &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date());

    if (!isPaid) {
      throw new HttpError(403, "AI Tutor requires a Pro or higher subscription.");
    }

    const body = await req.json();
    const message = requireString(body.message, "message", 2000);
    const languageName = requireString(body.language_name, "language_name", 50);
    const nativeLanguage = typeof body.native_language === "string" ? body.native_language.slice(0, 50) : "English";
    const userLevel = typeof body.user_level === "string" ? body.user_level.slice(0, 5) : "A2";
    const languageId = typeof body.language_id === "string" ? body.language_id : "";
    const sessionId = typeof body.session_id === "string" ? body.session_id : undefined;
    const tutorState: TutorState = body.tutor_state || {
      common_errors: [], mastered_vocab: [], preferred_topics: [],
      cefr_estimate: userLevel, session_count: 0,
    };
    const history: Array<{ role: "user" | "assistant"; content: string }> = Array.isArray(body.history) ? body.history.slice(-20) : [];

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return jsonResponse({ error: "Service unavailable" }, 503);

    const systemPrompt = buildTutorSystemPrompt(languageName, nativeLanguage, userLevel, tutorState);

    // Conversation summarization
    let finalMessages = [...history, { role: "user" as const, content: message }];
    let summaryContext = "";

    if (shouldSummarize(finalMessages.length)) {
      log(FN, "summarizing", { count: finalMessages.length });
      const summaryPrompt = buildSummarizationPrompt(finalMessages);
      const summaryRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 200, messages: [{ role: "user", content: summaryPrompt }] }),
      });
      if (summaryRes.ok) {
        const sd = await summaryRes.json();
        summaryContext = sd.content?.[0]?.text || "";
      }
      finalMessages = finalMessages.slice(-MESSAGES_TO_KEEP_FULL);
    }

    const fullSystem = [summaryContext ? `[Previous conversation summary: ${summaryContext}]` : "", systemPrompt]
      .filter(Boolean).join("\n\n");

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: config.model, max_tokens: config.maxTokens, system: fullSystem, messages: finalMessages }),
    });

    if (!aiResponse.ok) {
      log(FN, "ai_error", { status: aiResponse.status });
      return jsonResponse({ error: "AI service error" }, 502);
    }

    const aiData = await aiResponse.json();
    const reply = aiData.content?.[0]?.text || "";
    const vocab = extractVocab(reply);
    const corrections = extractCorrections(reply);

    const updatedState: TutorState = {
      ...tutorState,
      session_count: tutorState.session_count + 1,
      mastered_vocab: [...new Set([...tutorState.mastered_vocab, ...vocab])].slice(-100),
      common_errors: corrections.length > 0
        ? [...new Set([...tutorState.common_errors, ...corrections])].slice(-20)
        : tutorState.common_errors,
    };

    await db.from("tutor_profiles").upsert({
      user_id: user.id, language_id: languageId,
      state: updatedState, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,language_id" }).then(() => {}, () => {});

    if (sessionId) {
      const { data: session } = await db.from("conversation_sessions")
        .select("transcript, vocab_list").eq("id", sessionId).single();
      if (session) {
        await db.from("conversation_sessions").update({
          transcript: [...(session.transcript || []), { role: "user", content: message }, { role: "assistant", content: reply }],
          vocab_list: [...new Set([...(session.vocab_list || []), ...vocab])],
          updated_at: new Date().toISOString(),
        }).eq("id", sessionId).then(() => {}, () => {});
      }
    }

    // Log usage
    await db.from("ai_usage_log").insert({
      user_id: user.id, function_name: FN, model: config.model,
      input_tokens: aiData.usage?.input_tokens || 0,
      output_tokens: aiData.usage?.output_tokens || 0,
      cached: false,
    }).then(() => {}, () => {});

    log(FN, "success", { vocab: vocab.length, corrections: corrections.length });
    return jsonResponse({ reply, corrections, vocab_highlight: vocab, updated_state: updatedState });

  } catch (err) {
    return errorResponse(err);
  }
});
