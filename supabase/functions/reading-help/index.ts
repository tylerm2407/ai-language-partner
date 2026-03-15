import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  handleCORS, verifyAuth, checkRateLimit,
  jsonResponse, errorResponse, log, requireString, getAdminClient,
} from "../_shared/middleware.ts";
import { getModelConfig } from "../_shared/ai-config.ts";

const FN = "reading-help";

serve(async (req) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  try {
    const user = await verifyAuth(req);
    checkRateLimit(user.id, 30, 60_000);
    log(FN, "authenticated", { userId: user.id });

    const body = await req.json();
    const config = getModelConfig("readingHelp");

    const wordOrPhrase = requireString(body.word_or_phrase, "word_or_phrase", 2000);
    const sentenceContext = typeof body.sentence_context === "string" ? body.sentence_context.slice(0, 2000) : "";
    const languageName = requireString(body.language_name, "language_name", 50);
    const nativeLanguage = typeof body.native_language === "string" ? body.native_language.slice(0, 50) : "English";
    const userLevel = typeof body.user_level === "string" ? body.user_level.slice(0, 5) : "A2";
    const requestType = typeof body.request_type === "string" ? body.request_type : "translate";

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return jsonResponse({ error: "Service unavailable" }, 503);

    // Check cache for translations
    const db = getAdminClient();
    if (requestType === "translate") {
      const cacheKey = `read:${languageName}:${wordOrPhrase.toLowerCase().trim()}`;
      const { data: cached } = await db.from("ai_response_cache")
        .select("response")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (cached) {
        log(FN, "cache_hit");
        await db.from("ai_usage_log").insert({
          user_id: user.id, function_name: FN, model: config.model,
          input_tokens: 0, output_tokens: 0, cached: true,
        }).then(() => {}, () => {});
        return jsonResponse({ result: cached.response });
      }
    }

    let prompt = "";
    if (requestType === "translate") {
      prompt = `Translate this ${languageName} word/phrase to ${nativeLanguage}: "${wordOrPhrase}"\nContext: "${sentenceContext}"\nGive a brief 1-2 sentence translation and note any nuance.`;
    } else if (requestType === "explain") {
      prompt = `Explain this ${languageName} grammar or usage at CEFR ${userLevel} level: "${wordOrPhrase}"\nContext: "${sentenceContext}"\nBe concise (2-3 sentences).`;
    } else if (requestType === "comprehension_questions") {
      prompt = `Generate 3 comprehension questions in ${nativeLanguage} about this ${languageName} text at ${userLevel} level:\n\n"${wordOrPhrase}"\n\nFormat as numbered list.`;
    } else {
      prompt = `Summarize this ${languageName} text in ${nativeLanguage} in 2-3 sentences, noting key vocabulary:\n\n"${wordOrPhrase}"`;
    }

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      log(FN, "ai_error", { status: aiResponse.status });
      return jsonResponse({ error: "AI service error" }, 502);
    }

    const data = await aiResponse.json();
    const result = data.content?.[0]?.text || "";

    // Cache translations
    if (requestType === "translate" && result) {
      const cacheKey = `read:${languageName}:${wordOrPhrase.toLowerCase().trim()}`;
      await db.from("ai_response_cache").upsert({
        cache_key: cacheKey, response: result, model: config.model,
      }, { onConflict: "cache_key" }).then(() => {}, () => {});
    }

    // Log usage
    await db.from("ai_usage_log").insert({
      user_id: user.id, function_name: FN, model: config.model,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
      cached: false,
    }).then(() => {}, () => {});

    log(FN, "success");
    return jsonResponse({ result });

  } catch (err) {
    return errorResponse(err);
  }
});
