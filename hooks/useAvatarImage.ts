import { useEffect, useState } from 'react';
import { getAvatarImageUrl } from '../lib/supabase-queries';

/**
 * Resolve a generated avatar's storage path to a displayable URL.
 *
 * The `avatars` bucket is private (migration 067), so every render path needs a
 * signed URL. Avatars appear on several screens, so the signed URL is cached
 * module-wide and reused until shortly before it expires — otherwise every
 * mount of every avatar would cost a round trip.
 *
 * Returns null while loading and on failure; callers fall back to the
 * procedural SVG rather than rendering a broken image.
 */

const SIGNED_URL_TTL_SECONDS = 3600;

/** Re-sign this long before expiry so a URL never dies mid-render. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Drop a path's cached URL — call after regenerating so the new image shows. */
export function invalidateAvatarImage(path: string): void {
  cache.delete(path);
}

/**
 * Drop every cached signed URL.
 *
 * Module-level and therefore not user-scoped: without this, signing out and
 * into a different account on the same device leaves the previous learner's
 * avatar URLs resolvable until they expire.
 */
export function clearAvatarImageCache(): void {
  cache.clear();
}

export function useAvatarImage(path: string | null | undefined): string | null {
  const [uri, setUri] = useState<string | null>(() => {
    if (!path) return null;
    const hit = cache.get(path);
    return hit && hit.expiresAt > Date.now() ? hit.url : null;
  });

  useEffect(() => {
    if (!path) {
      setUri(null);
      return;
    }

    const hit = cache.get(path);
    if (hit && hit.expiresAt > Date.now()) {
      setUri(hit.url);
      return;
    }

    let cancelled = false;
    (async () => {
      const signed = await getAvatarImageUrl(path, SIGNED_URL_TTL_SECONDS);
      if (cancelled) return;
      if (signed) {
        cache.set(path, {
          url: signed,
          expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - REFRESH_MARGIN_MS,
        });
      }
      setUri(signed);
    })();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return uri;
}
