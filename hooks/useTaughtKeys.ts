import { useEffect, useState } from 'react';
import { fetchTaughtKeysForLanguage } from '../lib/supabase-queries';
import { taughtKeys } from '../lib/exercise-restore';
import { cachedFetch, readCacheKey } from '../lib/read-cache';
import type { LanguageCode } from '../types';

/**
 * Every answer the language teaches, for the grader's sibling-key rule.
 *
 * A candidate that exactly matches another taught key is that answer, not a
 * typo of this one (`siblingKeys` in lib/grading.ts). The lesson's own
 * exercises are already loaded and the runner always uses them; this is the
 * rest of the language, which is where most of the collisions live — measured
 * against the frozen curriculum, 651 of the 1,767 that survive unit scope, and
 * the cases that prompted the question are cross-band by nature ("Hablé"
 * accepting the A1 key "Table", "Gesund" accepting the B2 key "Gerund").
 *
 * Read-cached, because it is ~150KB per language of server-owned content that
 * changes only when the curriculum does — fetched once per fortnight, painted
 * from cache after that.
 *
 * Returns `[]` until it resolves, and `[]` if it fails. Neither is a reason to
 * interrupt a lesson: the runner still applies the lesson's own keys, so
 * grading degrades to the narrower rule rather than to none.
 */
export function useTaughtKeys(language: LanguageCode | undefined): string[] {
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!language) {
      setKeys([]);
      return;
    }
    let cancelled = false;
    cachedFetch(readCacheKey('taught-keys', language), () => fetchTaughtKeysForLanguage(language))
      .then(({ data }) => {
        if (!cancelled) setKeys(taughtKeys(data));
      })
      .catch((err) =>
        console.warn(
          `[lesson-grading] taught keys for "${language}" unavailable; sibling-key refusals fall back to this lesson:`,
          err,
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [language]);

  return keys;
}
