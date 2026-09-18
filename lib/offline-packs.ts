/**
 * Offline packs — the paid half of "offline mode".
 *
 * WHAT EXISTED BEFORE
 * Every read screen already paints from `lib/read-cache.ts` (stale-while-
 * revalidate over AsyncStorage) and every write replays through
 * `lib/offline-queue.ts`. So anything a learner has OPENED keeps working with
 * no connection, for everyone, on every plan. That stays: it is correctness,
 * not a feature.
 *
 * WHAT THIS ADDS
 * Content the learner has NOT opened yet, fetched ahead of time on purpose —
 * the next units of a course with every exercise, the books they are
 * reading, today's news article and its narration. That is what `offlineMode`
 * in `lib/plans.ts` sells on Premium and VIP, and until 2026-09-09 it was sold
 * and enforced nowhere.
 *
 * HOW A PACK WORKS
 * A pack is a manifest entry plus the read-cache keys it warmed (and, for
 * news, an mp3 on disk). Warming the SAME keys the screens already read means
 * no screen had to learn about packs: the lesson runner opens a downloaded
 * lesson exactly as it opens one it fetched yesterday. The manifest exists for
 * the things the cache cannot do — show the learner what is on the device,
 * size it, evict oldest-first under a budget, and remove a pack cleanly.
 *
 * Pack-owned cache entries are written PINNED (lib/read-cache.ts): they are
 * exempt from the cache TTL, because a download is a promise about content the
 * learner asked for, not a copy of something they happened to open. The passive
 * cache keeps its TTL.
 *
 * WHERE THE FILES LIVE
 * Under `Paths.document`, not `Paths.cache`. Apple's file-system guide is
 * explicit that the system may delete the Caches directory to free space —
 * starting with apps that have not run recently, which is exactly the learner
 * who downloaded a unit before a trip. Caches is also left out of backups and
 * not counted in the app's Documents & Data, so a paying learner could neither
 * keep their downloads nor see them in iOS Settings. (Known gap: expo-file-system
 * exposes no way to set NSURLIsExcludedFromBackupKey, so packs are included in
 * iCloud backups — bounded by the 200 MB budget, and worth revisiting if Apple
 * ever pushes back.) The read cache's own overflow files stay in Caches, where
 * a cache belongs.
 *
 * BUDGET
 * 200 MB across all packs, oldest-used evicted first. Text packs are tens of
 * kilobytes; the budget is really about narration audio. There is deliberately
 * NO time-based expiry: Spotify and Netflix expire downloads because their
 * licences require re-authorisation, and this content is ours. A download stays
 * until the learner removes it or the budget pushes it out — and when the
 * budget does, the manifest records it so the app can say so.
 *
 * Entitlement is checked by the callers (hook and screens) with
 * `offlinePacksEntitled`; this module does not refuse a download on its own,
 * because a service worker on the device is not the enforcement point for a
 * plan — the server is, and a downloaded pack spends nothing server-side that
 * opening the content would not have spent anyway.
 *
 * Everything fails soft where a cache should: a pack that half-downloads is
 * removed, a manifest that will not parse is treated as empty, and no
 * function here throws for a storage error alone.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { PLANS } from './plans';
import { readCacheKey, removeCached, setCached, utf8Bytes } from './read-cache';
import { buildReviewQueuePayload, reviewQueueCacheKey, type ReviewQueuePayload } from './review-queue-payload';
import {
  fetchBookAnnotations,
  fetchBookContent,
  fetchBookMeta,
  fetchCourses,
  fetchDailyNews,
  fetchInProgressBooks,
  fetchTaughtKeysForLanguage,
  fetchLessonCompletions,
  fetchLessonWithExercises,
  fetchLessons,
  fetchNewsAudio,
  fetchUnits,
} from './supabase-queries';
import type { NewsTier } from '../config/app';
import type {
  BookAnnotation,
  Course,
  DailyNewsArticle,
  LanguageCode,
  Lesson,
  LessonCompletion,
  NewsAudio,
  ReadingBook,
  SubscriptionTier,
  TaughtRow,
  Unit,
} from '../types';

export const OFFLINE_PACKS_SCHEMA_VERSION = 1;
export const OFFLINE_PACKS_MAX_BYTES = 200 * 1024 * 1024;
/** How many evictions the manifest remembers so the learner can be told. */
export const OFFLINE_PACKS_EVICTION_LOG = 10;
/** Units downloaded ahead of the learner's current one by the Wi-Fi top-up. */
export const AUTO_TOPUP_UNITS_AHEAD = 2;
/** The top-up runs at most this often; connectivity events are noisy. */
export const AUTO_TOPUP_MIN_INTERVAL_MS = 30 * 60 * 1000;

const MANIFEST_PREFIX = `offline-packs:v${OFFLINE_PACKS_SCHEMA_VERSION}:`;
const FILES_DIR_SEGMENTS = ['offline-packs', `v${OFFLINE_PACKS_SCHEMA_VERSION}`];
/** Pack-owned cache entries outlive the TTL; see the module doc. */
const PINNED = { pinned: true } as const;

export type PackKind = 'unit' | 'book' | 'news';

export interface OfflinePack {
  id: string;
  kind: PackKind;
  /** unitId, bookId, or the news article id. */
  refId: string;
  title: string;
  subtitle?: string;
  language: string;
  bytes: number;
  downloadedAt: number;
  lastUsedAt: number;
  /** read-cache keys this pack owns. Removed with the pack. */
  keys: string[];
  /**
   * File names this pack owns (narration), relative to the pack directory.
   * Names, not absolute URIs: the iOS container directory changes between
   * installs, so a stored absolute path goes stale. Manifests written before
   * this change hold absolute `file://` URIs — `packFile` reads both.
   */
  files: string[];
}

/** A pack the budget pushed out, kept so the app can tell the learner. */
export interface EvictedNotice {
  id: string;
  title: string;
  kind: PackKind;
  at: number;
}

interface Manifest {
  v: number;
  packs: OfflinePack[];
  /** Top up on Wi-Fi without being asked. Default on for entitled learners. */
  autoDownload: boolean;
  /**
   * Evictions not yet shown to the learner. Kept in the manifest rather than in
   * React state because most evictions happen inside a background top-up, long
   * after any screen that could have reported them was unmounted.
   */
  evicted?: EvictedNotice[];
}

export interface PackProgress {
  done: number;
  total: number;
}

/** True for the plans that sell offline mode (lib/plans.ts). */
export function offlinePacksEntitled(tier: SubscriptionTier | null | undefined): boolean {
  return PLANS[tier ?? 'starter']?.offlineMode === true;
}

export function packId(kind: PackKind, refId: string): string {
  return `${kind}:${refId}`;
}

// ─── Manifest ────────────────────────────────────────────────────────────

function manifestKey(userId: string): string {
  return `${MANIFEST_PREFIX}${userId}`;
}

function emptyManifest(): Manifest {
  return { v: OFFLINE_PACKS_SCHEMA_VERSION, packs: [], autoDownload: true, evicted: [] };
}

function isPack(value: unknown): value is OfflinePack {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    (p.kind === 'unit' || p.kind === 'book' || p.kind === 'news') &&
    typeof p.refId === 'string' &&
    typeof p.title === 'string' &&
    typeof p.language === 'string' &&
    typeof p.bytes === 'number' &&
    typeof p.downloadedAt === 'number' &&
    typeof p.lastUsedAt === 'number' &&
    Array.isArray(p.keys) &&
    Array.isArray(p.files)
  );
}

function isEvictedNotice(value: unknown): value is EvictedNotice {
  if (typeof value !== 'object' || value === null) return false;
  const n = value as Record<string, unknown>;
  return (
    typeof n.id === 'string' &&
    typeof n.title === 'string' &&
    (n.kind === 'unit' || n.kind === 'book' || n.kind === 'news') &&
    typeof n.at === 'number'
  );
}

async function readManifest(userId: string): Promise<Manifest> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(manifestKey(userId));
  } catch (err) {
    console.warn('[offline-packs] manifest read failed:', err);
    return emptyManifest();
  }
  if (raw === null) return emptyManifest();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return emptyManifest();
    const m = parsed as Record<string, unknown>;
    if (m.v !== OFFLINE_PACKS_SCHEMA_VERSION || !Array.isArray(m.packs)) return emptyManifest();
    return {
      v: OFFLINE_PACKS_SCHEMA_VERSION,
      packs: m.packs.filter(isPack),
      autoDownload: m.autoDownload !== false,
      evicted: Array.isArray(m.evicted) ? m.evicted.filter(isEvictedNotice) : [],
    };
  } catch {
    return emptyManifest();
  }
}

async function writeManifest(userId: string, manifest: Manifest): Promise<void> {
  try {
    await AsyncStorage.setItem(manifestKey(userId), JSON.stringify(manifest));
  } catch (err) {
    console.warn('[offline-packs] manifest write failed:', err);
  }
}

export async function listPacks(userId: string): Promise<OfflinePack[]> {
  const m = await readManifest(userId);
  return [...m.packs].sort((a, b) => b.downloadedAt - a.downloadedAt);
}

export async function totalPackBytes(userId: string): Promise<number> {
  const m = await readManifest(userId);
  return m.packs.reduce((sum, p) => sum + p.bytes, 0);
}

export async function findPack(userId: string, kind: PackKind, refId: string): Promise<OfflinePack | null> {
  const m = await readManifest(userId);
  return m.packs.find((p) => p.id === packId(kind, refId)) ?? null;
}

export async function getAutoDownload(userId: string): Promise<boolean> {
  return (await readManifest(userId)).autoDownload;
}

export async function setAutoDownload(userId: string, on: boolean): Promise<void> {
  const m = await readManifest(userId);
  await writeManifest(userId, { ...m, autoDownload: on });
}

/** Record that the learner opened this pack's content; drives LRU eviction. */
export async function touchPack(userId: string, kind: PackKind, refId: string, now: number = Date.now()): Promise<void> {
  const m = await readManifest(userId);
  const id = packId(kind, refId);
  if (!m.packs.some((p) => p.id === id)) return;
  await writeManifest(userId, {
    ...m,
    packs: m.packs.map((p) => (p.id === id ? { ...p, lastUsedAt: now } : p)),
  });
}

// ─── Storage helpers ─────────────────────────────────────────────────────

function filesDirectory(): Directory {
  return new Directory(Paths.document, ...FILES_DIR_SEGMENTS);
}

/**
 * A pack's file from what the manifest stored: a bare name resolves under the
 * current pack directory, an absolute URI (written before packs moved out of
 * the cache directory) is used as-is so old packs can still be read and removed.
 */
function packFile(nameOrUri: string): File {
  return nameOrUri.includes('/') ? new File(nameOrUri) : new File(filesDirectory(), nameOrUri);
}

/** UTF-8 size of a JSON payload, for the budget. Approximate is fine. */
export function jsonBytes(value: unknown): number {
  return utf8Bytes(JSON.stringify(value) ?? '');
}

function removeFileQuietly(nameOrUri: string): void {
  try {
    const f = packFile(nameOrUri);
    if (f.exists) f.delete();
  } catch {
    // A stale entry only leaves a dead file behind; eviction sweeps later.
  }
}

async function removeKeysQuietly(keys: string[]): Promise<void> {
  // Through the cache rather than AsyncStorage directly: an entry over
  // READ_CACHE_OVERFLOW_BYTES (a book, mostly) keeps its payload in a file, and
  // dropping only the pointer would leak it.
  await removeCached(keys);
}

// ─── Downloading ─────────────────────────────────────────────────────────

/** Every network effect, as a value, so packs are testable without Supabase. */
export interface PackDeps {
  fetchCourses: (targetLanguage: string) => Promise<Course[]>;
  fetchUnits: (courseId: string) => Promise<Unit[]>;
  fetchLessons: (unitId: string) => Promise<Lesson[]>;
  fetchLessonWithExercises: (lessonId: string) => Promise<Lesson | null>;
  fetchLessonCompletions: (userId: string, courseId: string) => Promise<LessonCompletion[]>;
  fetchTaughtKeysForLanguage: (language: string) => Promise<TaughtRow[]>;
  fetchBookMeta: (bookId: string) => Promise<ReadingBook | null>;
  fetchBookContent: (bookId: string) => Promise<string | null>;
  fetchBookAnnotations: (bookId: string) => Promise<BookAnnotation[]>;
  fetchInProgressBooks: (userId: string, language: string) => Promise<{ book: ReadingBook }[]>;
  fetchDailyNews: (language: string, tier: NewsTier, date?: string) => Promise<DailyNewsArticle | null>;
  fetchNewsAudio: (articleId: string) => Promise<NewsAudio | null>;
  buildReviewQueuePayload: (userId: string, language: LanguageCode) => Promise<ReviewQueuePayload>;
  /** Download `url` to `destinationUri`; resolves with the byte size. */
  downloadFile: (url: string, destinationUri: string) => Promise<number>;
}

const realDeps: PackDeps = {
  fetchCourses,
  fetchUnits,
  fetchLessons,
  fetchLessonWithExercises,
  fetchLessonCompletions,
  fetchTaughtKeysForLanguage,
  fetchBookMeta,
  fetchBookContent,
  fetchBookAnnotations,
  fetchInProgressBooks: async (userId, language) => {
    const rows = await fetchInProgressBooks(userId, language);
    return rows.map((r) => ({ book: r.book }));
  },
  fetchDailyNews,
  fetchNewsAudio,
  buildReviewQueuePayload,
  downloadFile: async (url, destinationUri) => {
    const dir = filesDirectory();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const dest = new File(destinationUri);
    if (dest.exists) dest.delete();
    await File.downloadFileAsync(url, dest);
    return dest.size ?? 0;
  },
};

export interface DownloadOptions {
  onProgress?: (progress: PackProgress) => void;
  deps?: Partial<PackDeps>;
  now?: number;
}

function withDeps(opts: DownloadOptions | undefined): PackDeps {
  return { ...realDeps, ...(opts?.deps ?? {}) };
}

async function commitPack(userId: string, pack: OfflinePack): Promise<OfflinePack> {
  const m = await readManifest(userId);
  const others = m.packs.filter((p) => p.id !== pack.id);
  await writeManifest(userId, { ...m, packs: [...others, pack] });
  return pack;
}

export interface UnitPackTarget {
  courseId: string;
  unitId: string;
  title: string;
  language: string;
}

/**
 * A unit: its lesson list and every lesson with exercises. Warms the exact
 * keys `useCoursesAndLessons` and the lesson runner read.
 */
export async function downloadUnitPack(
  userId: string,
  target: UnitPackTarget,
  opts?: DownloadOptions,
): Promise<OfflinePack> {
  const deps = withDeps(opts);
  const now = opts?.now ?? Date.now();
  const keys: string[] = [];
  let bytes = 0;

  const lessons = await deps.fetchLessons(target.unitId);
  const lessonsKey = readCacheKey('lessons', target.unitId);
  await setCached(lessonsKey, lessons, PINNED);
  keys.push(lessonsKey);
  bytes += jsonBytes(lessons);

  const total = lessons.length;
  let done = 0;
  opts?.onProgress?.({ done, total });
  try {
    for (const lesson of lessons) {
      const full = await deps.fetchLessonWithExercises(lesson.id);
      if (full) {
        const key = readCacheKey('lesson', lesson.id);
        await setCached(key, full, PINNED);
        keys.push(key);
        bytes += jsonBytes(full);
      }
      done += 1;
      opts?.onProgress?.({ done, total });
    }
  } catch (err) {
    // Half a unit is worse than none: the lesson list would promise lessons
    // that 404 offline. Roll back what landed and let the caller retry.
    await removeKeysQuietly(keys);
    throw err;
  }

  // The grader refuses a candidate that is another taught key in the language,
  // and reads that set from this cache. Without it a lesson taken offline
  // degrades to the lesson's own keys — not broken, but a narrower rule than
  // the one everyone else gets, and silently so.
  //
  // Warmed but deliberately NOT added to `keys`, and its bytes are not counted.
  // Every unit of a language shares this one entry, so listing it would let
  // removing any single pack delete a set the others still need. It is a
  // grading dependency shared across packs rather than content this pack owns,
  // and it expires on the read cache's own TTL like any other entry.
  // Failure is soft on purpose: a pack is still worth having without it.
  try {
    await setCached(
      readCacheKey('taught-keys', target.language),
      await deps.fetchTaughtKeysForLanguage(target.language),
    );
  } catch {
    // Ignored: the lesson still works offline, on the narrower rule.
  }

  return commitPack(userId, {
    id: packId('unit', target.unitId),
    kind: 'unit',
    refId: target.unitId,
    title: target.title,
    subtitle: `${total} lesson${total === 1 ? '' : 's'}`,
    language: target.language,
    bytes,
    downloadedAt: now,
    lastUsedAt: now,
    keys,
    files: [],
  });
}

export interface BookPackTarget {
  bookId: string;
  title: string;
  language: string;
}

/** A book: metadata, annotations and the full text. */
export async function downloadBookPack(
  userId: string,
  target: BookPackTarget,
  opts?: DownloadOptions,
): Promise<OfflinePack> {
  const deps = withDeps(opts);
  const now = opts?.now ?? Date.now();
  const keys: string[] = [];
  let bytes = 0;
  opts?.onProgress?.({ done: 0, total: 3 });

  try {
    const meta = await deps.fetchBookMeta(target.bookId);
    if (!meta) throw new Error('Book not found');
    const metaKey = readCacheKey('book-meta', target.bookId);
    await setCached(metaKey, meta, PINNED);
    keys.push(metaKey);
    bytes += jsonBytes(meta);
    opts?.onProgress?.({ done: 1, total: 3 });

    const annotations = await deps.fetchBookAnnotations(target.bookId);
    const annKey = readCacheKey('book-annotations', target.bookId);
    await setCached(annKey, annotations, PINNED);
    keys.push(annKey);
    bytes += jsonBytes(annotations);
    opts?.onProgress?.({ done: 2, total: 3 });

    const content = await deps.fetchBookContent(target.bookId);
    if (content === null) throw new Error('Book has no text');
    const contentKey = readCacheKey('book-content', target.bookId);
    await setCached(contentKey, content, PINNED);
    keys.push(contentKey);
    bytes += jsonBytes(content);
    opts?.onProgress?.({ done: 3, total: 3 });
  } catch (err) {
    await removeKeysQuietly(keys);
    throw err;
  }

  return commitPack(userId, {
    id: packId('book', target.bookId),
    kind: 'book',
    refId: target.bookId,
    title: target.title,
    subtitle: 'Book',
    language: target.language,
    bytes,
    downloadedAt: now,
    lastUsedAt: now,
    keys,
    files: [],
  });
}

export interface NewsPackTarget {
  language: string;
  tier: NewsTier;
  /** YYYY-MM-DD; today when omitted. */
  date?: string;
}

/** The read-cache key `useDailyNews` reads for one (language, tier, date). */
export function newsCacheKey(language: string, tier: NewsTier, date: string): string {
  return readCacheKey('news', language, tier, date);
}

function newsAudioName(articleId: string): string {
  return `news-${articleId}.mp3`;
}

/**
 * Today's article and, when the narration is ready, its mp3. An article with
 * no narration yet is still a pack — text first — and the next top-up fetches
 * the audio when it exists.
 */
export async function downloadNewsPack(
  userId: string,
  target: NewsPackTarget,
  opts?: DownloadOptions,
): Promise<OfflinePack> {
  const deps = withDeps(opts);
  const now = opts?.now ?? Date.now();
  opts?.onProgress?.({ done: 0, total: 2 });

  const article = await deps.fetchDailyNews(target.language, target.tier, target.date);
  if (!article) throw new Error('No article yet');
  const key = newsCacheKey(target.language, target.tier, article.date);
  await setCached(key, article, PINNED);
  let bytes = jsonBytes(article);
  opts?.onProgress?.({ done: 1, total: 2 });

  const files: string[] = [];
  try {
    const audio = await deps.fetchNewsAudio(article.id);
    if (audio && audio.status === 'ready' && audio.url) {
      const name = newsAudioName(article.id);
      bytes += await deps.downloadFile(audio.url, new File(filesDirectory(), name).uri);
      files.push(name);
    }
  } catch (err) {
    // Narration is the nice-to-have half. The article is on the device; say so.
    console.warn('[offline-packs] news narration not downloaded:', err instanceof Error ? err.message : err);
  }
  opts?.onProgress?.({ done: 2, total: 2 });

  return commitPack(userId, {
    id: packId('news', article.id),
    kind: 'news',
    refId: article.id,
    title: article.title ?? 'Daily news',
    subtitle: files.length > 0 ? `News · ${article.date} · with audio` : `News · ${article.date}`,
    language: target.language,
    bytes,
    downloadedAt: now,
    lastUsedAt: now,
    keys: [key],
    files,
  });
}

/** The downloaded narration for an article, or null. */
export async function localNewsAudioUri(userId: string, articleId: string): Promise<string | null> {
  const pack = await findPack(userId, 'news', articleId);
  if (!pack) return null;
  const name = pack.files[0];
  if (!name) return null;
  try {
    const file = packFile(name);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

// ─── Removal and budget ──────────────────────────────────────────────────

export async function removePack(userId: string, id: string): Promise<void> {
  const m = await readManifest(userId);
  const pack = m.packs.find((p) => p.id === id);
  if (!pack) return;
  await removeKeysQuietly(pack.keys);
  for (const name of pack.files) removeFileQuietly(name);
  await writeManifest(userId, { ...m, packs: m.packs.filter((p) => p.id !== id) });
}

export async function clearAllPacks(userId: string): Promise<void> {
  const m = await readManifest(userId);
  for (const pack of m.packs) {
    await removeKeysQuietly(pack.keys);
    for (const name of pack.files) removeFileQuietly(name);
  }
  await writeManifest(userId, { ...m, packs: [], evicted: [] });
}

/**
 * Drop the least recently used packs until the total is under the budget, and
 * record what went so the learner can be told — a download that vanishes
 * silently is discovered on the plane, which is the one place it cannot be
 * fixed. Nothing is dropped for age: see the module doc on retention.
 */
export async function enforcePackBudget(
  userId: string,
  now: number = Date.now(),
  maxBytes: number = OFFLINE_PACKS_MAX_BYTES,
): Promise<{ evicted: string[] }> {
  const m = await readManifest(userId);
  const evicted: string[] = [];

  let total = m.packs.reduce((sum, p) => sum + p.bytes, 0);
  const byLru = [...m.packs].sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  for (const pack of byLru) {
    if (total <= maxBytes) break;
    evicted.push(pack.id);
    total -= pack.bytes;
  }
  if (evicted.length === 0) return { evicted };

  const notices: EvictedNotice[] = [];
  for (const id of evicted) {
    const pack = m.packs.find((p) => p.id === id);
    if (!pack) continue;
    await removeKeysQuietly(pack.keys);
    for (const name of pack.files) removeFileQuietly(name);
    notices.push({ id: pack.id, title: pack.title, kind: pack.kind, at: now });
  }

  await writeManifest(userId, {
    ...m,
    packs: m.packs.filter((p) => !evicted.includes(p.id)),
    evicted: [...(m.evicted ?? []), ...notices].slice(-OFFLINE_PACKS_EVICTION_LOG),
  });
  return { evicted };
}

/** Evictions the learner has not been shown yet, oldest first. */
export async function listEvictions(userId: string): Promise<EvictedNotice[]> {
  return (await readManifest(userId)).evicted ?? [];
}

/** Forget the eviction notices — called once the learner has seen them. */
export async function acknowledgeEvictions(userId: string): Promise<void> {
  const m = await readManifest(userId);
  if ((m.evicted ?? []).length === 0) return;
  await writeManifest(userId, { ...m, evicted: [] });
}

// ─── Auto top-up ─────────────────────────────────────────────────────────

export interface TopUpContext {
  targetLanguage: LanguageCode;
  /**
   * The learner's current course (`user_profiles.current_course_id`). Only
   * this course's units are warmed; null means no lesson path and no unit
   * packs. Warming every course in the language spent the learner's
   * bandwidth on A1 unit 1 before their own band.
   */
  currentCourseId: string | null;
  newsTier: NewsTier;
  /** YYYY-MM-DD for the news pack; today when omitted. */
  date?: string;
}

export interface TopUpSummary {
  units: number;
  books: number;
  news: number;
  skipped: 'off' | 'busy' | null;
  errors: number;
}

let topUpInFlight: Promise<TopUpSummary> | null = null;

/**
 * Keep the device ahead of the learner: the current unit and the next
 * AUTO_TOPUP_UNITS_AHEAD of their current course, every book they have
 * started, and today's article. Single-flight; the caller decides when
 * (Wi-Fi, foreground — see hooks/useOfflineAutoTopUp.ts).
 */
export async function autoTopUp(
  userId: string,
  ctx: TopUpContext,
  opts?: DownloadOptions,
): Promise<TopUpSummary> {
  if (topUpInFlight) return topUpInFlight;
  topUpInFlight = runTopUp(userId, ctx, opts).finally(() => {
    topUpInFlight = null;
  });
  return topUpInFlight;
}

async function runTopUp(userId: string, ctx: TopUpContext, opts?: DownloadOptions): Promise<TopUpSummary> {
  const summary: TopUpSummary = { units: 0, books: 0, news: 0, skipped: null, errors: 0 };
  const m = await readManifest(userId);
  if (!m.autoDownload) {
    summary.skipped = 'off';
    return summary;
  }
  const deps = withDeps(opts);
  const packed = new Set(m.packs.map((p) => p.id));

  // Units: from the first unit with an unfinished lesson, this one and the next,
  // in the learner's current course only.
  try {
    const courses = ctx.currentCourseId ? await deps.fetchCourses(ctx.targetLanguage) : [];
    const course = courses.find((k) => k.id === ctx.currentCourseId);
    if (course) {
      const [units, completions] = await Promise.all([
        deps.fetchUnits(course.id),
        deps.fetchLessonCompletions(userId, course.id).catch(() => [] as LessonCompletion[]),
      ]);
      const completed = new Set(completions.map((c) => c.lessonId));
      const ordered = [...units].sort((a, b) => a.orderIndex - b.orderIndex);
      let started = false;
      let taken = 0;
      for (const unit of ordered) {
        if (taken >= AUTO_TOPUP_UNITS_AHEAD) break;
        if (!started) {
          const lessons = await deps.fetchLessons(unit.id);
          const allDone = lessons.length > 0 && lessons.every((l) => completed.has(l.id));
          if (allDone) continue;
          started = true;
        }
        taken += 1;
        if (packed.has(packId('unit', unit.id))) continue;
        try {
          await downloadUnitPack(userId, { courseId: course.id, unitId: unit.id, title: unit.title, language: ctx.targetLanguage }, opts);
          summary.units += 1;
        } catch (err) {
          summary.errors += 1;
          console.warn('[offline-packs] unit top-up failed:', err instanceof Error ? err.message : err);
        }
      }
    }
  } catch (err) {
    summary.errors += 1;
    console.warn('[offline-packs] course scan failed:', err instanceof Error ? err.message : err);
  }

  // Books the learner has started.
  try {
    const started = await deps.fetchInProgressBooks(userId, ctx.targetLanguage);
    for (const { book } of started) {
      if (packed.has(packId('book', book.id))) continue;
      try {
        await downloadBookPack(userId, { bookId: book.id, title: book.title, language: book.language }, opts);
        summary.books += 1;
      } catch (err) {
        summary.errors += 1;
        console.warn('[offline-packs] book top-up failed:', err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    summary.errors += 1;
    console.warn('[offline-packs] book scan failed:', err instanceof Error ? err.message : err);
  }

  // Today's article. Re-run even if packed without audio, so narration that
  // finished rendering after the first pass is picked up.
  try {
    const existing = m.packs.find((p) => p.kind === 'news' && p.language === ctx.targetLanguage && p.subtitle?.includes(ctx.date ?? '') === true);
    if (!existing || existing.files.length === 0) {
      await downloadNewsPack(userId, { language: ctx.targetLanguage, tier: ctx.newsTier, date: ctx.date }, opts);
      summary.news += 1;
    }
  } catch (err) {
    // "No article yet" before the cron has run is the normal morning state.
    const message = err instanceof Error ? err.message : String(err);
    if (!/No article yet/.test(message)) {
      summary.errors += 1;
      console.warn('[offline-packs] news top-up failed:', message);
    }
  }

  // The daily loop is the review deck, and it is the one thing a pack never
  // held: reviews already work offline (this cache entry plus the write queue
  // in lib/offline-queue.ts), but only for a learner who happened to open them
  // online recently. Warming the key here closes that gap for the price of one
  // request. Deliberately NOT pinned and NOT owned by any pack — what is due
  // changes daily, so this entry should age out like the cache entry it is.
  try {
    await setCached(
      reviewQueueCacheKey(userId, ctx.targetLanguage),
      await deps.buildReviewQueuePayload(userId, ctx.targetLanguage),
    );
  } catch (err) {
    // Soft: the rest of the top-up is still worth having.
    console.warn('[offline-packs] review warm failed:', err instanceof Error ? err.message : err);
  }

  await enforcePackBudget(userId, opts?.now ?? Date.now());
  return summary;
}

/** For "12 MB of 200 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
