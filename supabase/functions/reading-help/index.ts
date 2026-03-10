import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Available to FREE users (limited help) and PRO users (full help)
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { word_or_phrase, sentence_context, language_name, native_language, user_level, request_type } = await req.json();
    // request_type: 'translate' | 'explain' | 'comprehension_questions' | 'summarize'

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    let prompt = "";
    if (request_type === "translate") {
      prompt = `Translate this ${language_name} word/phrase to ${native_language}: "${word_or_phrase}"\nContext: "${sentence_context}"\nGive a brief 1-2 sentence translation and note any nuance.`;
    } else if (request_type === "explain") {
      prompt = `Explain this ${language_name} grammar or usage at CEFR ${user_level} level: "${word_or_phrase}"\nContext: "${sentence_context}"\nBe concise (2-3 sentences).`;
    } else if (request_type === "comprehension_questions") {
      prompt = `Generate 3 comprehension questions in ${native_language} about this ${language_name} text at ${user_level} level:\n\n"${word_or_phrase}"\n\nFormat as numbered list.`;
    } else {
      prompt = `Summarize this ${language_name} text in ${native_language} in 2-3 sentences, noting key vocabulary:\n\n"${word_or_phrase}"`;
    }

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }]
      }),
    });

    if (!aiResponse.ok) throw new Error(await aiResponse.text());
    const data = await aiResponse.json();
    const result = data.content?.[0]?.text || "";

    return new Response(JSON.stringify({ result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
