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
 * BUDGET
 * 200 MB across all packs, 30-day retention, oldest-used evicted first. Text
 * packs are tens of kilobytes; the budget is really about narration audio.
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
import { readCacheKey, setCached } from './read-cache';
import {
  fetchBookAnnotations,
  fetchBookContent,
  fetchBookMeta,
  fetchCourses,
  fetchDailyNews,
  fetchInProgressBooks,
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
  Lesson,
  LessonCompletion,
  NewsAudio,
  ReadingBook,
  SubscriptionTier,
  Unit,
} from '../types';

export const OFFLINE_PACKS_SCHEMA_VERSION = 1;
export const OFFLINE_PACKS_MAX_BYTES = 200 * 1024 * 1024;
export const OFFLINE_PACKS_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Units downloaded ahead of the learner's current one by the Wi-Fi top-up. */
export const AUTO_TOPUP_UNITS_AHEAD = 2;
/** The top-up runs at most this often; connectivity events are noisy. */
export const AUTO_TOPUP_MIN_INTERVAL_MS = 30 * 60 * 1000;

const MANIFEST_PREFIX = `offline-packs:v${OFFLINE_PACKS_SCHEMA_VERSION}:`;
const FILES_DIR_SEGMENTS = ['offline-packs', `v${OFFLINE_PACKS_SCHEMA_VERSION}`];

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
  /** Absolute file URIs this pack owns (narration). Removed with the pack. */
  files: string[];
}

interface Manifest {
  v: number;
  packs: OfflinePack[];
  /** Top up on Wi-Fi without being asked. Default on for entitled learners. */
  autoDownload: boolean;
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
  return { v: OFFLINE_PACKS_SCHEMA_VERSION, packs: [], autoDownload: true };
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
  return new Directory(Paths.cache, ...FILES_DIR_SEGMENTS);
}

/** UTF-8 size of a JSON payload, for the budget. Approximate is fine. */
export function jsonBytes(value: unknown): number {
  const s = JSON.stringify(value) ?? '';
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code >= 0xd800 && code <= 0xdbff ? 4 : 3;
    if (code >= 0xd800 && code <= 0xdbff) i++;
  }
  return bytes;
}

function removeFileQuietly(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // A stale entry only leaves a dead file behind; eviction sweeps later.
  }
}

async function removeKeysQuietly(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (err) {
    console.warn('[offline-packs] key removal failed:', err);
  }
}

// ─── Downloading ─────────────────────────────────────────────────────────

/** Every network effect, as a value, so packs are testable without Supabase. */
export interface PackDeps {
  fetchCourses: (targetLanguage: string) => Promise<Course[]>;
  fetchUnits: (courseId: string) => Promise<Unit[]>;
  fetchLessons: (unitId: string) => Promise<Lesson[]>;
  fetchLessonWithExercises: (lessonId: string) => Promise<Lesson | null>;
  fetchLessonCompletions: (userId: string, courseId: string) => Promise<LessonCompletion[]>;
  fetchBookMeta: (bookId: string) => Promise<ReadingBook | null>;
  fetchBookContent: (bookId: string) => Promise<string | null>;
  fetchBookAnnotations: (bookId: string) => Promise<BookAnnotation[]>;
  fetchInProgressBooks: (userId: string, language: string) => Promise<{ book: ReadingBook }[]>;
  fetchDailyNews: (language: string, tier: NewsTier, date?: string) => Promise<DailyNewsArticle | null>;
  fetchNewsAudio: (articleId: string) => Promise<NewsAudio | null>;
  /** Download `url` to `destinationUri`; resolves with the byte size. */
  downloadFile: (url: string, destinationUri: string) => Promise<number>;
}

const realDeps: PackDeps = {
  fetchCourses,
  fetchUnits,
  fetchLessons,
  fetchLessonWithExercises,
  fetchLessonCompletions,
  fetchBookMeta,
  fetchBookContent,
  fetchBookAnnotations,
  fetchInProgressBooks: async (userId, language) => {
    const rows = await fetchInProgressBooks(userId, language);
    return rows.map((r) => ({ book: r.book }));
  },
  fetchDailyNews,
  fetchNewsAudio,
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
  await setCached(lessonsKey, lessons);
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
        await setCached(key, full);
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
    await setCached(metaKey, meta);
    keys.push(metaKey);
    bytes += jsonBytes(meta);
    opts?.onProgress?.({ done: 1, total: 3 });

    const annotations = await deps.fetchBookAnnotations(target.bookId);
    const annKey = readCacheKey('book-annotations', target.bookId);
    await setCached(annKey, annotations);
    keys.push(annKey);
    bytes += jsonBytes(annotations);
    opts?.onProgress?.({ done: 2, total: 3 });

    const content = await deps.fetchBookContent(target.bookId);
    if (content === null) throw new Error('Book has no text');
    const contentKey = readCacheKey('book-content', target.bookId);
    await setCached(contentKey, content);
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

function newsAudioUri(articleId: string): string {
  return new File(filesDirectory(), `news-${articleId}.mp3`).uri;
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
  await setCached(key, article);
  let bytes = jsonBytes(article);
  opts?.onProgress?.({ done: 1, total: 2 });

  const files: string[] = [];
  try {
    const audio = await deps.fetchNewsAudio(article.id);
    if (audio && audio.status === 'ready' && audio.url) {
      const uri = newsAudioUri(article.id);
      bytes += await deps.downloadFile(audio.url, uri);
      files.push(uri);
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
  const uri = pack.files[0];
  if (!uri) return null;
  try {
    return new File(uri).exists ? uri : null;
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
  for (const uri of pack.files) removeFileQuietly(uri);
  await writeManifest(userId, { ...m, packs: m.packs.filter((p) => p.id !== id) });
}

export async function clearAllPacks(userId: string): Promise<void> {
  const m = await readManifest(userId);
  for (const pack of m.packs) {
    await removeKeysQuietly(pack.keys);
    for (const uri of pack.files) removeFileQuietly(uri);
  }
  await writeManifest(userId, { ...m, packs: [] });
}

/**
 * Drop packs past retention, then the least recently used until the total is
 * under the budget. Returns what went, for the log and the tests.
 */
export async function enforcePackBudget(
  userId: string,
  now: number = Date.now(),
  maxBytes: number = OFFLINE_PACKS_MAX_BYTES,
): Promise<{ evicted: string[] }> {
  const m = await readManifest(userId);
  const evicted: string[] = [];
  let keep = m.packs.filter((p) => {
    const expired = now - p.downloadedAt > OFFLINE_PACKS_RETENTION_MS;
    if (expired) evicted.push(p.id);
    return !expired;
  });

  let total = keep.reduce((sum, p) => sum + p.bytes, 0);
  const byLru = [...keep].sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  for (const pack of byLru) {
    if (total <= maxBytes) break;
    evicted.push(pack.id);
    total -= pack.bytes;
  }
  keep = keep.filter((p) => !evicted.includes(p.id));

  for (const id of evicted) {
    const pack = m.packs.find((p) => p.id === id);
    if (!pack) continue;
    await removeKeysQuietly(pack.keys);
    for (const uri of pack.files) removeFileQuietly(uri);
  }
  if (evicted.length > 0) await writeManifest(userId, { ...m, packs: keep });
  return { evicted };
}

// ─── Auto top-up ─────────────────────────────────────────────────────────

export interface TopUpContext {
  targetLanguage: string;
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
 * AUTO_TOPUP_UNITS_AHEAD of every course in their language, every book they
 * have started, and today's article. Single-flight; the caller decides when
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

  // Units: from the first unit with an unfinished lesson, this one and the next.
  try {
    const courses = await deps.fetchCourses(ctx.targetLanguage);
    for (const course of courses) {
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

  await enforcePackBudget(userId, opts?.now ?? Date.now());
  return summary;
}

/** For "12 MB of 200 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
