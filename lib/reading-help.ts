/**
 * The client's half of the reader's paragraph-explanation contract.
 *
 * These bounds are the SERVER's, mirrored here so the reader can hide an
 * affordance that would only produce a 400 rather than offering a button that
 * fails. supabase/functions/explain-passage/explain-core.ts is the enforcing
 * copy — a paragraph that slips past this check is still refused there. The
 * two must move together; this file granting more than the server does is the
 * only failure mode worth worrying about, and it costs a confusing error
 * rather than an unmetered call.
 */

/** Longest paragraph the server will explain. Refused, never truncated. */
export const MAX_SPAN_CHARS = 1200;

/** Below this the learner wants a word lookup, which is already one tap away. */
export const MIN_SPAN_CHARS = 20;

/**
 * How the server sees a span.
 *
 * Imported Gutenberg text is hard-wrapped at ~70 characters, so the same
 * paragraph carries line breaks that mean nothing. The server normalises them
 * away before hashing, which is what lets one generated explanation serve
 * every learner who reaches that paragraph. Applying the same rule here means
 * the length check the reader does matches the one the server will do.
 */
export function normalizeSpan(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Is this paragraph one the server will accept? */
export function canExplain(text: string): boolean {
  const span = normalizeSpan(text);
  return span.length >= MIN_SPAN_CHARS && span.length <= MAX_SPAN_CHARS;
}
