import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  handleCORS, verifyAuth, checkRateLimit,
  jsonResponse, errorResponse, log, requireString, getAdminClient, HttpError,
} from "../_shared/middleware.ts";
import { getModelConfig } from "../_shared/ai-config.ts";

const FN = "writing-feedback";

serve(async (req) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  try {
    const user = await verifyAuth(req);
    checkRateLimit(user.id, 10, 60_000);
    log(FN, "authenticated", { userId: user.id });

    const db = getAdminClient();
    const config = getModelConfig("writingFeedback");

    // Verify paid subscription
    const { data: sub } = await db.from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", user.id)
      .single();

    const isPaid = sub && sub.status === "active" &&
      ["pro", "family", "lifetime", "vip"].includes(sub.plan) &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date());

    if (!isPaid) {
      throw new HttpError(403, "Writing feedback requires a Pro or higher subscription.");
    }

    const body = await req.json();
    const submission = requireString(body.submission, "submission", 5000);
    const prompt = requireString(body.prompt, "prompt", 1000);
    const languageName = requireString(body.language_name, "language_name", 50);
    const userLevel = typeof body.user_level === "string" ? body.user_level.slice(0, 5) : "A2";
    const lessonId = typeof body.lesson_id === "string" ? body.lesson_id : null;
    const languageId = typeof body.language_id === "string" ? body.language_id : null;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return jsonResponse({ error: "Service unavailable" }, 503);

    const systemPrompt = `You are an expert ${languageName} writing teacher. The student is at CEFR level ${userLevel}.

Analyze their writing submission and provide:
1. An overall score from 0-100
2. Specific corrections with explanations (format: "\u274C Original \u2192 \u2705 Corrected: explanation")
3. Positive feedback on what they did well
4. 2-3 concrete suggestions for improvement
5. A short model rewrite of their text at their level

Be encouraging but honest. Focus on the most important patterns, not every tiny error.

Writing prompt given to student: "${prompt}"

Respond in JSON format:
{
  "score": 85,
  "summary": "Overall feedback paragraph",
  "corrections": [{"original": "...", "corrected": "...", "explanation": "..."}],
  "positives": ["...", "..."],
  "suggestions": ["...", "..."],
  "model_rewrite": "..."
}`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: `Student submission:\n\n${submission}` }],
      }),
    });

    if (!aiResponse.ok) {
      log(FN, "ai_error", { status: aiResponse.status });
      return jsonResponse({ error: "AI service error" }, 502);
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.content?.[0]?.text || "{}";

    let feedback: Record<string, unknown> = {};
    try {
      feedback = JSON.parse(rawText.match(/\{[\s\S]*\}/)?.[0] || "{}");
    } catch {
      feedback = { summary: rawText, score: 70 };
    }

    if (lessonId && languageId) {
      await db.from("user_writing_submissions").insert({
        user_id: user.id, lesson_id: lessonId, language_id: languageId,
        content: submission,
        ai_feedback: (feedback as any).summary || "",
        ai_score: (feedback as any).score || 0,
        feedback_metadata: feedback,
      }).then(() => {}, () => {});

      await db.from("user_lesson_progress").upsert({
        user_id: user.id, lesson_id: lessonId,
        status: "completed",
        last_score: (feedback as any).score || 0,
        last_submitted_at: new Date().toISOString(),
      }, { onConflict: "user_id,lesson_id" }).then(() => {}, () => {});

      await db.rpc("upsert_language_progress", {
        p_user_id: user.id, p_language_id: languageId,
        p_words_delta: submission.split(" ").length, p_sessions_delta: 1, p_convos_delta: 0,
      }).then(() => {}, () => {});
    }

    // Log usage
    await db.from("ai_usage_log").insert({
      user_id: user.id, function_name: FN, model: config.model,
      input_tokens: aiData.usage?.input_tokens || 0,
      output_tokens: aiData.usage?.output_tokens || 0,
      cached: false,
    }).then(() => {}, () => {});

    log(FN, "success", { score: (feedback as any).score });
    return jsonResponse({ feedback });

  } catch (err) {
    return errorResponse(err);
  }
});
