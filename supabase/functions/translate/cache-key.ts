// The `translation_cache` key. Extracted from index.ts verbatim so it can be
// imported by something that is not a Deno edge function — specifically
// scripts/warm-shared-caches.ts, which pre-generates the curriculum's
// translations once instead of letting every learner pay for them again.
//
// A warming script that derived this key itself would be a second
// implementation of a hash, and a hash that differs by one byte writes rows
// that can never be read. There is no error for that: the cache simply never
// hits and the bill never drops. So there is exactly one implementation, here,
// and both callers import it.
//
// No imports and no Deno globals on purpose — `crypto.subtle` is available in
// Deno, in Node 18+, and in browsers, so this file is portable as-is.

/** Cache key: sha256 hex of (source_text, source_lang, target_lang). */
export async function cacheKey(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([sourceLang, targetLang, text])),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
