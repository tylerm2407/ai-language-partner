import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, lesson_id, language_id, language_name, user_level, prompt, submission } = await req.json();

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: sub } = await supabase.from("subscriptions")
      .select("plan, status, current_period_end").eq("user_id", user_id).single();
    const isPaid = sub && sub.status === "active" && ["pro","family","lifetime"].includes(sub.plan) &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
    if (!isPaid) {
      return new Response(JSON.stringify({ error: "upgrade_required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are an expert ${language_name} writing teacher. The student is at CEFR level ${user_level}.

Analyze their writing submission and provide:
1. An overall score from 0-100
2. Specific corrections with explanations (format: "❌ Original → ✅ Corrected: explanation")
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
        model: "claude-opus-4-6", max_tokens: 1500, system: systemPrompt,
        messages: [{ role: "user", content: `Student submission:\n\n${submission}` }]
      }),
    });

    if (!aiResponse.ok) throw new Error(await aiResponse.text());
    const aiData = await aiResponse.json();
    const rawText = aiData.content?.[0]?.text || "{}";

    let feedback: any = {};
    try { feedback = JSON.parse(rawText.match(/\{[\s\S]*\}/)?.[0] || "{}"); } catch { feedback = { summary: rawText, score: 70 }; }

    await supabase.from("user_writing_submissions").insert({
      user_id, lesson_id, language_id,
      content: submission,
      ai_feedback: feedback.summary,
      ai_score: feedback.score,
      feedback_metadata: feedback,
    });

    await supabase.from("user_lesson_progress").upsert({
      user_id, lesson_id,
      status: "completed",
      last_score: feedback.score,
      last_submitted_at: new Date().toISOString(),
    }, { onConflict: "user_id,lesson_id" });

    await supabase.rpc("upsert_language_progress", {
      p_user_id: user_id, p_language_id: language_id,
      p_words_delta: submission.split(" ").length, p_sessions_delta: 1, p_convos_delta: 0,
    });

    return new Response(JSON.stringify({ feedback }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
