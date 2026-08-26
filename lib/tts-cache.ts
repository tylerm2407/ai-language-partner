/**
 * On-device cache for synthesised speech.
 *
 * WHY NOT lib/read-cache.ts
 * That module JSON-stringifies into AsyncStorage, which is SQLite-backed on
 * Android with a practical per-row ceiling and poor throughput for blobs. A
 * few seconds of base64 mp3 is tens of kilobytes; a session's worth would
 * push it hard, and every play would pay a JSON round-trip. We reuse
 * read-cache's *conventions* — versioned envelope, TTL, prefixed namespace,
 * explicit eviction — and not its storage.
 *
 * WHY IT EXISTS AT ALL
 * The tts function already has a content-addressed cache in Supabase Storage,
 * and a hit there costs no voice-minutes. But it is still a network round
 * trip, and a hands-free session is specifically for tunnels, lifts and dead
 * zones. Prompt audio has to be on the device before the learner needs it or
 * the session stalls at a red light.
 *
 * Everything here fails soft. A cache is an optimisation; a cache error must
 * never end a session. Every function swallows and logs rather than throwing.
 */

import { Directory, File, Paths } from 'expo-file-system';

// Bumped 1 -> 2 when lesson synthesis moved off the latency model: the version
// is part of the cache DIRECTORY name, so a bump is a single directory delete
// and every stale clip rendered with the old parameters goes with it. Hands-free
// re-warms its own clips on next use, which is why this is safe to bump.
export const TTS_CACHE_SCHEMA_VERSION = 2;
export const TTS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Soft ceiling. Eviction runs at session start, not per item. */
export const TTS_CACHE_MAX_BYTES = 40 * 1024 * 1024;

/**
 * The version lives in the directory name, so a schema bump is a single
 * directory delete rather than a migration over individual entries.
 */
const CACHE_DIR_SEGMENTS = ['tts', `v${TTS_CACHE_SCHEMA_VERSION}`];

interface Sidecar {
  /** Epoch ms the entry was written. Drives both TTL and LRU. */
  at: number;
  bytes: number;
  /**
   * The full key this entry was derived from. Checked on read: the filename
   * is a non-cryptographic hash, so a collision is possible, and serving the
   * wrong sentence is a far worse failure than a cache miss.
   */
  key: string;
}

function cacheDirectory(): Directory {
  return new Directory(Paths.cache, ...CACHE_DIR_SEGMENTS);
}

/**
 * FNV-1a. Not cryptographic and does not need to be — it names a cache entry,
 * and the sidecar verifies the real key on read. expo-crypto is not installed
 * and adding a native dependency to name a file would be disproportionate.
 * The input length is appended to make accidental collisions rarer still.
 */
function hashKey(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    // Multiply by the FNV prime using shifts to stay in 32-bit range.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return `${hash.toString(16)}-${key.length.toString(36)}`;
}

/**
 * Identity of a cached clip. Voice and rate are part of it because the same
 * sentence at a different voice or speed is a different recording.
 */
export function ttsCacheKey(
  text: string,
  lang: string,
  voice: string,
  rate: number,
): string {
  return `${lang}|${voice}|${rate}|${text.trim()}`;
}

function fileFor(key: string): { audio: File; meta: File } {
  const name = hashKey(key);
  const dir = cacheDirectory();
  return {
    audio: new File(dir, `${name}.mp3`),
    meta: new File(dir, `${name}.json`),
  };
}

function readSidecar(meta: File): Sidecar | null {
  try {
    if (!meta.exists) return null;
    const parsed: unknown = JSON.parse(meta.textSync());
    if (typeof parsed !== 'object' || parsed === null) return null;
    const s = parsed as Record<string, unknown>;
    if (typeof s.at !== 'number' || typeof s.key !== 'string') return null;
    return { at: s.at, bytes: typeof s.bytes === 'number' ? s.bytes : 0, key: s.key };
  } catch {
    return null;
  }
}

function removeEntry(audio: File, meta: File): void {
  try {
    if (audio.exists) audio.delete();
  } catch {
    /* best effort */
  }
  try {
    if (meta.exists) meta.delete();
  } catch {
    /* best effort */
  }
}

/**
 * A playable `file://` URI, or null on a miss.
 *
 * @param now Injected so TTL behaviour is testable.
 */
export function getCachedTts(key: string, now: number = Date.now()): string | null {
  try {
    const { audio, meta } = fileFor(key);
    if (!audio.exists) return null;

    const sidecar = readSidecar(meta);
    // No sidecar means we cannot verify the key or the age. Treat as a miss
    // and clean up rather than gambling on serving the wrong sentence.
    if (!sidecar) {
      removeEntry(audio, meta);
      return null;
    }
    if (sidecar.key !== key) {
      // Hash collision. Do NOT delete — the entry legitimately belongs to the
      // other key, and evicting it would make two keys evict each other
      // forever.
      return null;
    }
    if (now - sidecar.at > TTS_CACHE_TTL_MS) {
      removeEntry(audio, meta);
      return null;
    }
    return audio.uri;
  } catch (err) {
    console.warn('[tts-cache] read failed:', err);
    return null;
  }
}

/**
 * Store a clip. Returns the `file://` URI, or null if it could not be written.
 *
 * `File.write` is synchronous in expo-file-system 19. Clips are small, but
 * callers should still do this off the critical path — while item n is
 * playing, not between n and n+1.
 */
export function putCachedTts(key: string, base64: string, now: number = Date.now()): string | null {
  try {
    const dir = cacheDirectory();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

    const { audio, meta } = fileFor(key);
    audio.create({ overwrite: true, intermediates: true });
    audio.write(base64, { encoding: 'base64' });

    const sidecar: Sidecar = { at: now, bytes: base64.length, key };
    meta.create({ overwrite: true, intermediates: true });
    meta.write(JSON.stringify(sidecar));

    return audio.uri;
  } catch (err) {
    console.warn('[tts-cache] write failed:', err);
    return null;
  }
}

/**
 * Drop expired entries, then evict oldest-first until under the size ceiling.
 *
 * Call at session start. Doing it per item would add a directory listing to
 * every turn for no benefit.
 */
export function pruneTtsCache(now: number = Date.now()): void {
  try {
    const dir = cacheDirectory();
    if (!dir.exists) return;

    const entries: { audio: File; meta: File; at: number; bytes: number }[] = [];

    for (const node of dir.list()) {
      if (!(node instanceof File) || !node.name.endsWith('.mp3')) continue;
      const base = node.name.slice(0, -'.mp3'.length);
      const meta = new File(dir, `${base}.json`);
      const sidecar = readSidecar(meta);

      // Orphaned audio with no sidecar is unusable — getCachedTts would
      // reject it anyway — so reclaim the space.
      if (!sidecar) {
        removeEntry(node, meta);
        continue;
      }
      if (now - sidecar.at > TTS_CACHE_TTL_MS) {
        removeEntry(node, meta);
        continue;
      }
      entries.push({ audio: node, meta, at: sidecar.at, bytes: sidecar.bytes });
    }

    let total = entries.reduce((sum, e) => sum + e.bytes, 0);
    if (total <= TTS_CACHE_MAX_BYTES) return;

    // Oldest first — a clip played long ago is the cheapest to lose.
    entries.sort((a, b) => a.at - b.at);
    for (const entry of entries) {
      if (total <= TTS_CACHE_MAX_BYTES) break;
      removeEntry(entry.audio, entry.meta);
      total -= entry.bytes;
    }
  } catch (err) {
    console.warn('[tts-cache] prune failed:', err);
  }
}

/** Remove the whole cache. Used on sign-out and on a schema bump. */
export function clearTtsCache(): void {
  try {
    const dir = cacheDirectory();
    if (dir.exists) dir.delete();
  } catch (err) {
    console.warn('[tts-cache] clear failed:', err);
  }
}
