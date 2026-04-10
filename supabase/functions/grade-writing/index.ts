// Supabase Edge Function: Grade Writing
// Provides AI-powered feedback on user writing submissions.
// Uses Claude Haiku for cost-efficient grading at scale.
// Deploy: npx supabase functions deploy grade-writing

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getPlanLimits } from '../_shared/plan-limits.ts';
import { isValidUUID, isValidCefrLevel, isValidLanguage, sanitizeText } from '../_shared/validation.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

interface GradeRequest {
  submissionId: string;
  submissionText: string;
  promptId: string;
  targetLanguage: string;
  cefrLevel: string;
}

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── Authenticate the user ─────────────────────────────────
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers }
      );
    }
    const userId = authUser.userId;

    const body = (await req.json()) as GradeRequest;
    const { submissionText, promptId, targetLanguage, cefrLevel } = body;

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers }
      );
    }

    // ── Validate inputs ──────────────────────────────────────
    if (!isValidUUID(promptId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid prompt ID' }),
        { status: 400, headers }
      );
    }
    if (!isValidCefrLevel(cefrLevel)) {
      return new Response(
        JSON.stringify({ error: 'Invalid CEFR level' }),
        { status: 400, headers }
      );
    }
    if (!isValidLanguage(targetLanguage)) {
      return new Response(
        JSON.stringify({ error: 'Invalid target language' }),
        { status: 400, headers }
      );
    }

    // ── Rate limit: check BEFORE calling AI ──────────────────
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, is_active')
      .eq('user_id', userId)
      .single();

    const tier = sub?.is_active && sub.tier ? sub.tier : 'free';
    const limits = getPlanLimits(tier);

    const date = todayUTC();
    // Fetch current usage without incrementing
    const { data: currentUsage } = await supabase
      .from('daily_usage')
      .select('writing_grades')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    const currentGrades = (currentUsage?.writing_grades as number) ?? 0;
    if (currentGrades >= limits.dailyWritingGrades) {
      return new Response(
        JSON.stringify({
          error: "You've reached your daily writing grade limit. Upgrade your plan for more.",
          code: 'DAILY_WRITING_LIMIT_REACHED',
        }),
        { status: 429, headers }
      );
    }

    // Fetch prompt details for context
    const { data: prompt } = await supabase
      .from('writing_prompts')
      .select('*')
      .eq('id', promptId)
      .single();

    const systemPrompt = buildGradingPrompt(
      targetLanguage,
      cefrLevel,
      sanitizeText(prompt?.prompt_text ?? '', 2000),
      sanitizeText(prompt?.example_response ?? '', 2000),
      prompt?.target_vocabulary ?? [],
      prompt?.target_grammar ?? []
    );

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        max_tokens: 1500,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: sanitizeText(submissionText, 5000) }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiReply = data.content?.[0]?.text ?? '';

    // Parse AI response as JSON
    let feedback;
    try {
      feedback = JSON.parse(aiReply);
    } catch {
      feedback = {
        grammar: 12,
        vocabulary: 12,
        coherence: 12,
        task_completion: 12,
        total: 48,
        grammarScore: 50,
        vocabularyScore: 50,
        coherenceScore: 50,
        spellingScore: 50,
        sentenceStructureScore: 50,
        strengths: [],
        improvements: [],
        correctedVersion: null,
        corrections: [],
        overallFeedback: aiReply,
      };
    }

    // Increment writing_grades after successful AI grading
    await supabase.rpc('increment_daily_usage', {
      p_user_id: userId,
      p_date: date,
      p_writing_grades: 1,
    });

    return new Response(
      JSON.stringify(feedback),
      { headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers }
    );
  }
});

function getLanguageSpecificRules(targetLanguage: string): string {
  const rules: Record<string, string> = {
    Spanish: `LANGUAGE-SPECIFIC RULES (Spanish):
- Gender/number agreement: articles, adjectives, and nouns must agree (el libro rojo, la casa roja)
- Ser vs estar: permanent traits (ser) vs temporary states/locations (estar)
- Subjunctive mood: required after doubt, emotion, desire, impersonal expressions
- Accent marks: missing or incorrect accents count as spelling errors (él vs el, está vs esta)
- Preterite vs imperfect: completed actions vs habitual/ongoing past actions`,
    French: `LANGUAGE-SPECIFIC RULES (French):
- Gender/number agreement: articles, adjectives must agree with nouns
- Accent marks: é, è, ê, ë, à, ù, ç — missing accents are spelling errors
- Passé composé vs imparfait: completed vs habitual/descriptive past
- Subjunctive: required after expressions of doubt, emotion, necessity
- Negation: ne...pas must wrap the conjugated verb`,
    German: `LANGUAGE-SPECIFIC RULES (German):
- Noun capitalization: all nouns must be capitalized
- Case system: nominative, accusative, dative, genitive — articles must match
- Word order: verb-second in main clauses, verb-final in subordinate clauses
- Separable prefixes: must move to end of clause in present/past tense
- Adjective endings: depend on article type and case`,
    Japanese: `LANGUAGE-SPECIFIC RULES (Japanese):
- Particle usage: は vs が, に vs で, を correctly applied
- Verb conjugation: te-form, masu-form, plain form used appropriately for context
- Politeness level: consistent use of formal or informal register
- Counter words: correct counters for different object types
- Kanji usage: appropriate to CEFR level`,
    Portuguese: `LANGUAGE-SPECIFIC RULES (Portuguese):
- Gender/number agreement: articles, adjectives, nouns must agree
- Accent marks: missing accents are spelling errors (é, ê, ã, õ, ç)
- Ser vs estar: similar to Spanish usage
- Subjunctive mood: required after doubt, emotion, desire
- Personal infinitive: unique to Portuguese, must be used correctly`,
    Italian: `LANGUAGE-SPECIFIC RULES (Italian):
- Gender/number agreement: articles, adjectives, nouns must agree
- Accent marks: required on final stressed syllables (città, perché)
- Passato prossimo vs imperfetto: completed vs habitual/descriptive past
- Subjunctive: required after doubt, emotion, opinion
- Double consonants: spelling must reflect pronunciation (anno vs ano)`,
  };
  return rules[targetLanguage] ?? '';
}

function getCefrExpectations(cefrLevel: string): string {
  const expectations: Record<string, string> = {
    A1: `CEFR A1 EXPECTATIONS:
- Expected length: sentences (20-50 words)
- Can write simple isolated phrases and sentences
- Basic vocabulary for familiar topics only
- Simple present tense, basic connectors (and, but)
- Frequent errors expected but core meaning should be clear`,
    A2: `CEFR A2 EXPECTATIONS:
- Expected length: short paragraphs (50-150 words)
- Can write short, simple notes and messages
- Everyday vocabulary, simple past and future tenses
- Basic sentence linking (because, then, after)
- Errors acceptable but should not obscure meaning`,
    B1: `CEFR B1 EXPECTATIONS:
- Expected length: short essays (150-300 words)
- Can write connected text on familiar topics
- Good range of vocabulary with some precision
- Multiple tenses used correctly, complex sentences attempted
- Occasional errors but generally well-controlled grammar`,
    B2: `CEFR B2 EXPECTATIONS:
- Expected length: full essays (300-500+ words)
- Can write clear, detailed text on a wide range of subjects
- Varied vocabulary with good control of idiomatic expressions
- Complex grammar structures used accurately
- Few errors; self-correction expected`,
    C1: `CEFR C1 EXPECTATIONS:
- Expected length: formal essays (500+ words)
- Can write clear, well-structured, detailed text on complex subjects
- Precise vocabulary with idiomatic and colloquial expressions
- Full command of complex grammar, subtle nuances
- Near-native accuracy; rare errors only in obscure constructions`,
    C2: `CEFR C2 EXPECTATIONS:
- Expected length: academic/professional text (500+ words)
- Can write at native level with natural flow and precision
- Sophisticated vocabulary, register-appropriate style
- Flawless grammar; can use language for humor, emphasis, ambiguity
- Grade as you would a native speaker's formal writing`,
  };
  return expectations[cefrLevel] ?? expectations['B1'];
}

function buildGradingPrompt(
  targetLanguage: string,
  cefrLevel: string,
  promptText: string,
  exampleResponse: string,
  targetVocabulary: string[],
  targetGrammar: string[]
): string {
  const languageRules = getLanguageSpecificRules(targetLanguage);
  const cefrExpectations = getCefrExpectations(cefrLevel);

  return `You are a strict but fair language teacher grading a ${cefrLevel} learner's writing in ${targetLanguage}.

WRITING PROMPT: ${promptText}
${exampleResponse ? `MODEL ANSWER: ${exampleResponse}` : ''}
${targetVocabulary.length > 0 ? `TARGET VOCABULARY: ${targetVocabulary.join(', ')}` : ''}
${targetGrammar.length > 0 ? `TARGET GRAMMAR: ${targetGrammar.join(', ')}` : ''}

${cefrExpectations}

${languageRules}

Grade the submission on a 0-25 scale for each of the 4 categories (grammar, vocabulary, coherence, task_completion). Total is out of 100. Grade strictly. Do not inflate scores. List every specific correction with the grammar or spelling rule that was violated.

Also provide a corrected version of the entire submission showing how it should have been written.

RESPOND ONLY IN VALID JSON:
{
  "grammar": <0-25>,
  "vocabulary": <0-25>,
  "coherence": <0-25>,
  "task_completion": <0-25>,
  "total": <0-100>,
  "grammarScore": <0-100>,
  "vocabularyScore": <0-100>,
  "coherenceScore": <0-100>,
  "spellingScore": <0-100>,
  "sentenceStructureScore": <0-100>,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3"],
  "correctedVersion": "the entire submission rewritten correctly in ${targetLanguage}",
  "corrections": [
    {"original": "...", "corrected": "...", "explanation": "...", "type": "grammar|vocabulary|spelling|style|structure", "ruleViolated": "name of the specific rule violated"}
  ],
  "overallFeedback": "2-3 sentences of encouraging but honest feedback"
}

SCORING GUIDELINES:
- grammar (0-25): correctness of verb conjugations, tenses, agreement, and grammatical forms
- vocabulary (0-25): range, precision, and appropriateness of word choices for the ${cefrLevel} level
- coherence (0-25): logical flow, paragraph organization, use of connectors and transitions
- task_completion (0-25): how well the writing addresses the prompt requirements
- grammarScore/vocabularyScore/coherenceScore/spellingScore/sentenceStructureScore: detailed 0-100 sub-scores
- strengths: 3 specific things the learner did well
- improvements: 3 specific areas to focus on
- correctedVersion: rewrite the entire text correctly, preserving the learner's intent

Grade appropriately for ${cefrLevel} — scale expectations to the level, but do not give free points. A score of 80+ means genuinely strong performance for that level.`;
}
