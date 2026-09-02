/**
 * Copies of the prompts that live inside edge-function modules Node cannot
 * import — `translate/index.ts` and `get-hint/index.ts` both call `serve()`
 * and read `Deno.env` at import time.
 *
 * A copy is acceptable here in a way it is NOT acceptable for a cache key,
 * and the difference is worth stating. A drifted key writes rows nothing can
 * ever read: silent, total, unrecoverable-by-inspection. A drifted prompt
 * writes a perfectly readable row whose wording is merely not what the app
 * would have said. So keys are imported (see keys.ts) and prompts are copied —
 * but `prompts.test.ts` pins every copy against the edge function's source
 * text, so drift is a red test rather than a slow divergence nobody notices.
 *
 * `explain-passage`'s prompt is absent from this file on purpose: it already
 * lives in the importable `explain-core.ts`, so keys.ts re-exports the real
 * `buildExplainSystemPrompt` and there is nothing to copy.
 */

/** Verbatim from supabase/functions/translate/index.ts. */
export function buildTranslateSystemPrompt(sourceLanguage: string, targetLanguage: string): string {
  return `You translate a short conversational message from ${sourceLanguage} into ${targetLanguage}. Return ONLY the translation — no quotes, no preamble, no explanation, no "Here is the translation:" lead-in. Preserve tone, punctuation, and emoji. If the input already appears to be in ${targetLanguage}, return it unchanged. Do not add commentary.`;
}

/**
 * Verbatim from `generateAIHint` in supabase/functions/get-hint/index.ts —
 * specifically its `baseSystemPrompt`, with no personalisation clause.
 *
 * The un-personalised form is the only correct one to warm with. `hint_cache`
 * is keyed on (card_id, exercise_type) with no user dimension, and the edge
 * function reads and writes it only when there is no learner profile in play,
 * exactly so one learner's weak spots are never served to everyone else on the
 * same card. Warming with a personalised prompt would put personalised text
 * into a shared table by the back door.
 */
export const HINT_SYSTEM_PROMPT =
  "You are a language learning assistant. Generate a helpful, pedagogical hint for a language learner working on an exercise. Don't give the answer directly. Keep it to 1-2 sentences maximum.";

export interface HintCard {
  target_text: string;
  native_text: string;
  part_of_speech: string | null;
  example_sentence: string | null;
}

/** Verbatim field order from `generateAIHint`'s `userMessage`. Order is part
 *  of the prompt, so it is pinned in the test alongside the labels. */
export function buildHintUserMessage(
  card: HintCard,
  exerciseType: string,
  targetLanguage: string,
): string {
  return [
    `Exercise type: ${exerciseType}`,
    `Target language: ${targetLanguage}`,
    `Native text: ${card.native_text}`,
    `Target text: ${card.target_text}`,
    card.part_of_speech ? `Part of speech: ${card.part_of_speech}` : null,
    card.example_sentence ? `Example sentence: ${card.example_sentence}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
