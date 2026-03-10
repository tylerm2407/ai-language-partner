import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS: use ALLOWED_ORIGIN env var in production; falls back to * for local dev
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NOTE: Deno edge functions are stateless per-invocation — in-memory rate limiting does not
// persist across requests. For production rate limiting, use Supabase's built-in rate limiting
// feature (Dashboard → Edge Functions → Rate Limits) or a Redis layer (e.g. Upstash).

interface TutorRequest {
  language_id: string;
  language_name: string;
  native_language: string;
  user_level: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  tutor_state: {
    common_errors: string[];
    mastered_vocab: string[];
    preferred_topics: string[];
    cefr_estimate: string;
    session_count: number;
  };
  session_id?: string;
  mode: "text" | "voice";
}

function buildTutorSystemPrompt(req: TutorRequest & { user_id: string }): string {
  const { language_name, native_language, user_level, tutor_state } = req;
  const errors = tutor_state.common_errors.slice(-5).join(", ") || "none yet";
  const mastered = tutor_state.mastered_vocab.slice(-10).join(", ") || "none yet";

  return `You are ${language_name} AI — a warm, patient, expert ${language_name} tutor with years of experience teaching ${native_language} speakers.

STUDENT PROFILE:
- Current level: ${user_level} (CEFR)
- Native language: ${native_language}
- Recent errors to revisit: ${errors}
- Vocabulary they've mastered: ${mastered}
- Preferred topics: ${tutor_state.preferred_topics.join(", ") || "general conversation"}
- Sessions completed: ${tutor_state.session_count}

YOUR BEHAVIOR:
1. ALWAYS reply primarily in ${language_name} — immersion is key
2. Gently correct errors inline using: ✏️ [correction]
3. After your main reply, add a [Tutor Notes] section with:
   - English translation of your reply
   - 💡 One grammar tip (1-2 sentences max)
   - 📝 New vocab from this turn: word — meaning
4. Match complexity to ${user_level}: ${user_level.startsWith('A') ? 'simple sentences, high-frequency words' : user_level.startsWith('B') ? 'natural conversation, introduce idioms' : 'nuanced language, cultural references'}
5. Ask follow-up questions to keep conversation flowing
6. Sound like a human friend who speaks ${language_name} natively — not a textbook
7. If user writes in ${native_language}, encourage them to try in ${language_name} and give a starter phrase

RESPONSE FORMAT:
[Your reply in ${language_name}]

[Tutor Notes]
🇬🇧 Translation: "..."
💡 Tip: ...
📝 Vocab: word — meaning (repeat for each new word)`;
}

function extractVocab(text: string): string[] {
  const matches = [...text.matchAll(/📝 Vocab: (.+)/g)];
  return matches.map(m => m[1].trim());
}

function extractCorrections(text: string): string[] {
  const matches = [...text.matchAll(/✏️ ([^\n]+)/g)];
  return matches.map(m => m[1].trim());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // B: Verify JWT — reject requests without a valid Bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Use user.id from the verified JWT — do NOT trust body user_id
    const user_id = user.id;

    const body: TutorRequest = await req.json();
    const { language_id, message: rawMessage, history, tutor_state, session_id } = body;

    // C: Input sanitization — strip null bytes, cap length
    const message = (rawMessage || "").replace(/\0/g, "").slice(0, 2000);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const { data: sub } = await supabase.from("subscriptions")
      .select("plan, status, current_period_end").eq("user_id", user_id).single();

    const isPaid = sub && sub.status === "active" &&
      ["pro", "family", "lifetime"].includes(sub.plan) &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date());

    if (!isPaid) {
      return new Response(JSON.stringify({ error: "upgrade_required", message: "AI Tutor requires a Pro subscription." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = buildTutorSystemPrompt({ ...body, user_id });
    const messages = [
      ...history,
      { role: "user" as const, content: message }
    ];

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-opus-4-6", max_tokens: 1024, system: systemPrompt, messages }),
    });

    if (!aiResponse.ok) throw new Error(await aiResponse.text());
    const aiData = await aiResponse.json();
    const reply = aiData.content?.[0]?.text || "";

    const vocab = extractVocab(reply);
    const corrections = extractCorrections(reply);

    const updatedState = {
      ...tutor_state,
      session_count: tutor_state.session_count + 1,
      mastered_vocab: [...new Set([...tutor_state.mastered_vocab, ...vocab])].slice(-100),
      common_errors: corrections.length > 0
        ? [...new Set([...tutor_state.common_errors, ...corrections])].slice(-20)
        : tutor_state.common_errors,
    };

    await supabase.from("tutor_profiles").upsert({
      user_id, language_id, state: updatedState, updated_at: new Date().toISOString()
    }, { onConflict: "user_id,language_id" });

    if (session_id) {
      const { data: session } = await supabase.from("conversation_sessions")
        .select("transcript, vocab_list").eq("id", session_id).single();
      const transcript = session?.transcript || [];
      const vocabList = session?.vocab_list || [];
      await supabase.from("conversation_sessions").update({
        transcript: [...transcript, { role: "user", content: message }, { role: "assistant", content: reply }],
        vocab_list: [...new Set([...vocabList, ...vocab])],
        updated_at: new Date().toISOString(),
      }).eq("id", session_id);
    }

    return new Response(JSON.stringify({ reply, corrections, vocab_highlight: vocab, updated_state: updatedState }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
