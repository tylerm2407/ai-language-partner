import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  handleCORS, verifyAuth, checkRateLimit,
  jsonResponse, errorResponse, log, requireArray, getAdminClient,
} from "../_shared/middleware.ts";
import { getModelConfig, shouldSummarize, buildSummarizationPrompt, MESSAGES_TO_KEEP_FULL } from "../_shared/ai-config.ts";

const FN = "chat";

serve(async (req) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  try {
    const user = await verifyAuth(req);
    checkRateLimit(user.id, 20, 60_000);
    log(FN, "authenticated", { userId: user.id });

    const body = await req.json();
    const config = getModelConfig("chat");

    const rawMessages: Array<{ role: string; content: string }> = requireArray(body.messages, "messages", 30) as any;
    const messages = rawMessages.map(m => ({
      role: m.role === "assistant" ? "assistant" as const : "user" as const,
      content: String(m.content || "").replace(/\0/g, "").slice(0, 2000),
    }));

    const systemPrompt = typeof body.systemPrompt === "string"
      ? body.systemPrompt.replace(/\0/g, "").slice(0, 3000)
      : undefined;

    if (messages.length === 0) {
      return jsonResponse({ error: "No messages provided" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      log(FN, "missing_api_key");
      return jsonResponse({ error: "Service unavailable" }, 503);
    }

    // Conversation summarization for cost reduction
    let finalMessages = messages;
    let summaryContext = "";

    if (shouldSummarize(messages.length)) {
      log(FN, "summarizing", { messageCount: messages.length });
      const summaryPrompt = buildSummarizationPrompt(messages);
      const summaryRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{ role: "user", content: summaryPrompt }],
        }),
      });
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        summaryContext = summaryData.content?.[0]?.text || "";
      }
      finalMessages = messages.slice(-MESSAGES_TO_KEEP_FULL);
    }

    const fullSystem = [summaryContext ? `[Previous conversation summary: ${summaryContext}]` : "", systemPrompt || ""]
      .filter(Boolean).join("\n\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system: fullSystem || undefined,
        messages: finalMessages,
      }),
    });

    if (!response.ok) {
      log(FN, "ai_error", { status: response.status });
      return jsonResponse({ error: "AI service error" }, 502);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";

    // Log usage for cost monitoring
    const db = getAdminClient();
    await db.from("ai_usage_log").insert({
      user_id: user.id,
      function_name: FN,
      model: config.model,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
      cached: false,
    }).then(() => {}, () => {});

    log(FN, "success", { tokens: data.usage?.output_tokens });
    return jsonResponse({ content });

  } catch (err) {
    return errorResponse(err);
  }
});
