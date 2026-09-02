import { supabase } from './supabase';
import { SRS_DEFAULTS } from '../config/app';
import { PLANS } from './plans';
import { CEFR_BAND_BY_LEVEL, CEFR_LADDER,
  combineConversationScore,
} from './cefr-proficiency';
import { localToday } from './dates';
import { wordTokens } from './reading-text';
import type {
  ProficiencyEvidence,
  VocabEvidenceItem,
  ReadingEvidenceItem,
  WritingEvidenceItem,
  SpeakingEvidenceItem,
} from './cefr-proficiency';
import { ONBOARDING_STEP_KEYS } from './onboarding-checklist';
import type {
  UserProfile,
  OnboardingChecklist,
  OnboardingStepKey,
  Course,
  Unit,
  Lesson,
  Card,
  Exercise,
  ReviewItem,
  ReviewLog,
  HandsFreeSessionRow,
  DailyStats,
  DailyUsage,
  PracticeSession,
  Subscription,
  ReviewRating,
  DailyChallengesRecord,
  LeagueTier,
  ReadingPassage,
  ReadingQuestion,
  WritingPrompt,
  WritingSubmission,
  WritingFeedback,
  DailyNewsArticle,
  NewsAudio,
  NewsAudioStatus,
  LessonCompletion,
  ReadingBook,
  UserBookProgress,
  BookAnnotation,
  AvatarAccessory,
  ContentSource,
  GrammarRule,
  SkillType,
  FeedbackErrorType,
  CorrectionErrorType,
  CorrectionSeverity,
  ConversationMessage,
  Organization,
  Classroom,
  ClassEnrollment,
  Assignment,
  AssignmentSubmission,
  ConversationGrade,
  SchoolContractConfig,
  LanguageCode,
  ProficiencyLevel,
  SubmissionStatus,
} from '../types';

// ─── User Profile ───────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data ? mapProfile(data) : null;
}

export async function upsertProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'displayName' | 'nativeLanguage' | 'targetLanguage' | 'level' | 'dailyGoalMinutes' | 'timezone' | 'motivationReason' | 'idealL2Self'>>
): Promise<UserProfile> {
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (updates.displayName !== undefined) row.display_name = updates.displayName;
  if (updates.nativeLanguage !== undefined) row.native_language = updates.nativeLanguage;
  if (updates.targetLanguage !== undefined) row.target_language = updates.targetLanguage;
  if (updates.level !== undefined) row.level = updates.level;
  if (updates.dailyGoalMinutes !== undefined) row.daily_goal_minutes = updates.dailyGoalMinutes;
  if (updates.timezone !== undefined) row.timezone = updates.timezone;
  if (updates.motivationReason !== undefined) row.motivation_reason = updates.motivationReason;
  if (updates.idealL2Self !== undefined) row.ideal_l2_self = updates.idealL2Self;

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    // Fallback: if upsert fails (e.g. missing unique constraint), try a direct insert
    console.warn('upsertProfile upsert failed, trying insert fallback:', error.message);
    const { data: inserted, error: insertErr } = await supabase
      .from('user_profiles')
      .insert(row)
      .select()
      .single();

    if (insertErr) throw insertErr;
    return mapProfile(inserted);
  }
  return mapProfile(data);
}

/**
 * XP is server-authoritative: increment_xp validates the caller, caps the
 * per-call amount, and derives xp_level/league_tier in the same statement.
 */
export async function addXp(userId: string, xp: number): Promise<void> {
  if (xp <= 0) return;
  const { error } = await supabase.rpc('increment_xp', {
    p_user_id: userId,
    p_amount: Math.min(Math.round(xp), 500),
  });
  if (error) throw error;
}

/**
 * Idempotent XP award (migration 046) — same caller guard / 1-500 cap /
 * level derivation as increment_xp, but keyed: the server records `key`
 * in client_events and replays of the same key are no-ops. Used by
 * earnXp and offline-queue replays so a lost-response retry can never
 * double-award.
 *
 * Returns the learner's authoritative total XP *after* the call. On a replay
 * the server grants nothing and returns the unchanged total, which is what
 * makes it safe for the caller to render this instead of adding the amount
 * locally — otherwise a refused award still shows up as XP until next launch.
 */
export async function incrementXpIdempotent(amount: number, key: string): Promise<number | null> {
  if (amount <= 0) return null;
  const { data, error } = await supabase.rpc('increment_xp_idempotent', {
    p_amount: Math.min(Math.round(amount), 500),
    p_key: key,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : null;
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw error;
}

// ─── Onboarding Checklist ────────────────────────────────────────

export async function updateOnboardingChecklist(
  userId: string,
  checklist: OnboardingChecklist
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      onboarding_checklist: checklist,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Has this learner ever sent a message to the AI tutor?
 *
 * Two things make this an RPC rather than a client query. `chat_messages` has
 * no `user_id` — ownership is only reachable by joining `chat_sessions` — and
 * more importantly a *session* existing is a false signal: `app/(app)/chat`
 * persists the assistant's greeting the moment a scenario is opened, before
 * the learner has typed anything. The only honest signal is at least one row
 * with `role = 'user'`.
 *
 * `has_ai_conversation()` is SECURITY INVOKER (migration 078), so the caller's
 * RLS still applies and this adds no new read surface.
 */
export async function fetchHasAiConversation(): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_ai_conversation');
  if (error) throw error;
  return data === true;
}

// ─── Courses, Units, Lessons ────────────────────────────────────

export async function fetchCourses(targetLanguage?: string): Promise<Course[]> {
  let query = supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
    .order('cefr_level', { ascending: true })
    .order('created_at', { ascending: true });

  if (targetLanguage) {
    query = query.eq('target_language', targetLanguage);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapCourse);
}

export async function fetchUnits(courseId: string): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapUnit);
}

export async function fetchLessons(unitId: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('unit_id', unitId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapLesson(row, []));
}

/**
 * Lessons for many units in ONE query, grouped by unit id.
 *
 * The Learn tab used to `Promise.all` a `fetchLessons` per unit — eight
 * round trips for an eight-unit course, on the tab a learner opens most. The
 * batched shape already existed for the progress tiles
 * (`fetchUnitProgressTiles`); it just was not used here.
 *
 * Returns a Map so callers keep O(1) lookup, and every requested unit gets an
 * entry — an absent unit is an empty array, not a missing key.
 */
export async function fetchLessonsForUnits(unitIds: string[]): Promise<Map<string, Lesson[]>> {
  const grouped = new Map<string, Lesson[]>();
  for (const id of unitIds) grouped.set(id, []);
  if (unitIds.length === 0) return grouped;

  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .in('unit_id', unitIds)
    .order('order_index', { ascending: true });

  if (error) throw error;

  for (const row of data ?? []) {
    const unitId = (row as Record<string, unknown>).unit_id as string;
    grouped.get(unitId)?.push(mapLesson(row, []));
  }
  return grouped;
}

export async function fetchLessonWithExercises(lessonId: string): Promise<Lesson | null> {
  const { data: lessonData, error: lessonError } = await supabase
    .from('lessons')
    .select('*, units!inner(course_id)')
    .eq('id', lessonId)
    .single();

  if (lessonError) throw lessonError;
  if (!lessonData) return null;

  // Flatten the joined course_id onto the lesson row so mapLesson can read it.
  const unitJoin = lessonData.units as { course_id?: string } | null;
  const lessonRow = { ...lessonData, course_id: unitJoin?.course_id ?? null };

  const { data: exerciseData, error: exerciseError } = await supabase
    .from('exercises')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('order_index', { ascending: true });

  if (exerciseError) throw exerciseError;

  return mapLesson(lessonRow, (exerciseData ?? []).map(mapExercise));
}

// ─── Cards ──────────────────────────────────────────────────────

export async function fetchCardsByIds(cardIds: string[]): Promise<Card[]> {
  if (cardIds.length === 0) return [];

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .in('id', cardIds);

  if (error) throw error;
  return (data ?? []).map(mapCard);
}

export async function fetchCardsByCourse(courseId: string): Promise<Card[]> {
  // Cap: courses can hold thousands of cards at full content scale —
  // callers needing more should page with .range().
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('course_id', courseId)
    .limit(500);

  if (error) throw error;
  return (data ?? []).map(mapCard);
}

/**
 * Fetch cards restricted to a specific skill_type. Used by the chunk
 * drill surface so formulaic multi-word expressions (Wray 2002 /
 * N. Ellis 1996) can be reviewed as first-class SRS items instead of
 * being buried as JSONB on a vocab card. research.md §8.
 */
export async function fetchCardsBySkillType(
  courseId: string,
  skillType: 'vocabulary' | 'grammar' | 'chunk',
  level?: UserProfile['level'],
): Promise<Card[]> {
  let query = supabase
    .from('cards')
    .select('*')
    .eq('course_id', courseId)
    .eq('skill_type', skillType);
  if (level) {
    query = query.in('cefr_level', allowedCefrLevelsFor(level));
  }
  // Cap matches fetchCardsByCourse — callers needing more should page.
  const { data, error } = await query
    .order('frequency_rank', { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map(mapCard);
}

// ─── Review Items (SRS) ─────────────────────────────────────────

export async function fetchDueReviewItems(userId: string, limit = 50): Promise<ReviewItem[]> {
  const { data, error } = await supabase
    .from('review_items')
    .select('*')
    .eq('user_id', userId)
    .lte('next_due', new Date().toISOString())
    .order('next_due', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapReviewItem);
}

/**
 * Fetch due review items with their card data joined. Used for the
 * lesson warm-up phase (Roediger & Karpicke testing effect —
 * research.md §5.1). Returns an empty array on failure rather than
 * throwing; warm-up is best-effort and must never block a lesson start.
 */
export async function fetchDueReviewItemsWithCardsStrict(
  userId: string,
  limit: number,
): Promise<{ item: ReviewItem; card: Card }[]> {
  const { data, error } = await supabase
    .from('review_items')
    .select('*, cards!inner(*)')
    .eq('user_id', userId)
    .lte('next_due', new Date().toISOString())
    .order('next_due', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    item: mapReviewItem(row),
    card: mapCard(row.cards as Record<string, unknown>),
  }));
}

/**
 * Lenient wrapper for the lesson warm-up phase: returns an empty array on
 * failure rather than throwing, because warm-up is best-effort and must never
 * block a lesson start.
 *
 * Prefer the strict variant above anywhere the difference between "nothing is
 * due" and "the server could not be reached" matters — a hands-free session
 * that reads a network blip as "all caught up" wastes the learner's commute.
 */
export async function fetchDueReviewItemsWithCards(
  userId: string,
  limit = 5,
): Promise<{ item: ReviewItem; card: Card }[]> {
  try {
    return await fetchDueReviewItemsWithCardsStrict(userId, limit);
  } catch (err) {
    console.warn('[warmup] fetchDueReviewItemsWithCards failed (non-fatal):', err);
    return [];
  }
}


export async function fetchReviewItemCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('review_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('next_due', new Date().toISOString());

  if (error) throw error;
  return count ?? 0;
}

export async function fetchNewCardCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('review_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'new');

  if (error) throw error;
  return count ?? 0;
}

export async function upsertReviewItem(item: Omit<ReviewItem, 'id'> & { id?: string }): Promise<ReviewItem> {
  const { data, error } = await supabase
    .from('review_items')
    .upsert({
      id: item.id,
      user_id: item.userId,
      card_id: item.cardId,
      ease_factor: item.easeFactor,
      interval: item.interval,
      repetitions: item.repetitions,
      next_due: item.nextDue,
      last_reviewed_at: item.lastReviewedAt,
      status: item.status,
    }, { onConflict: 'user_id,card_id' })
    .select()
    .single();

  if (error) throw error;
  return mapReviewItem(data);
}

/**
 * Batch-fetch the user's existing review items for a set of cards. Used by
 * the lesson runner to continue accumulated SM-2 state (interval/ease
 * factor) for cards the user already has history with, instead of resetting
 * them to a fresh baseline. review_items is unique on (user_id, card_id)
 * — the upsert conflict target — so at most one row exists per card and
 * `.limit(cardIds.length)` is exact. A lesson passes 10-15 card ids.
 */
export async function fetchReviewItemsByCardIds(
  userId: string,
  cardIds: string[],
): Promise<ReviewItem[]> {
  if (cardIds.length === 0) return [];
  const { data, error } = await supabase
    .from('review_items')
    .select('*')
    .eq('user_id', userId)
    .in('card_id', cardIds)
    .limit(cardIds.length);

  if (error) throw error;
  return (data ?? []).map(mapReviewItem);
}

/**
 * Per-card rolling accuracy (last N reviews) — used by the interleaving
 * gate (research.md §5.4, improvements.md §A.7). When a card hits ≥80%
 * over its last 5 reviews it's considered "past threshold" and safe for
 * interleaving; below that, it stays in blocked practice (consecutive
 * exposures). Hwang 2025 warns that interleaving low-accuracy items
 * overloads working memory.
 *
 * Returns null if fewer than 3 reviews exist (not enough signal yet).
 */
export async function fetchCardRollingAccuracy(
  userId: string,
  cardId: string,
  windowSize = 5,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('review_logs')
    .select('was_correct')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .order('reviewed_at', { ascending: false })
    .limit(windowSize);
  if (error) {
    console.warn('[interleave] rolling-accuracy query failed:', error.message);
    return null;
  }
  const rows = data ?? [];
  if (rows.length < 3) return null;
  const correct = rows.filter((r) => r.was_correct === true).length;
  return correct / rows.length;
}

export const INTERLEAVE_THRESHOLD = 0.8;

/** True iff the card is past the 80% accuracy threshold (ready for
 *  interleaved review). Falsy for items without enough history. */
export async function isCardReadyForInterleaving(
  userId: string,
  cardId: string,
): Promise<boolean> {
  const acc = await fetchCardRollingAccuracy(userId, cardId);
  return acc !== null && acc >= INTERLEAVE_THRESHOLD;
}

export async function insertReviewLog(log: Omit<ReviewLog, 'id'>): Promise<void> {
  const { error } = await supabase
    .from('review_logs')
    .insert({
      user_id: log.userId,
      card_id: log.cardId,
      review_item_id: log.reviewItemId,
      rating: log.rating,
      response_time_ms: log.responseTimeMs,
      user_answer: log.userAnswer,
      was_correct: log.wasCorrect,
      reviewed_at: log.reviewedAt,
    });

  if (error) throw error;
}

/**
 * Insert a review log that is safe to replay.
 *
 * `review_logs` is append-only with no natural conflict target, so an offline
 * flush that retries — the normal case after a tunnel, not an edge case —
 * would insert the same review twice and inflate the learner's history.
 * Migration 059 adds a partial unique index on (user_id, client_log_id) so the
 * duplicate is dropped by the database rather than by hoping the client only
 * ever sends once.
 */
export async function insertReviewLogIdempotent(
  log: Omit<ReviewLog, 'id'> & { clientLogId: string },
): Promise<void> {
  const { error } = await supabase
    .from('review_logs')
    .upsert(
      {
        user_id: log.userId,
        card_id: log.cardId,
        review_item_id: log.reviewItemId,
        rating: log.rating,
        response_time_ms: log.responseTimeMs,
        user_answer: log.userAnswer,
        was_correct: log.wasCorrect,
        reviewed_at: log.reviewedAt,
        client_log_id: log.clientLogId,
      },
      { onConflict: 'user_id,client_log_id', ignoreDuplicates: true },
    );

  if (error) throw error;
}

// ─── Hands-Free Sessions ───────────────────────

/** Open a hands-free session record. Returns the row id so it can be closed later. */
export async function insertHandsFreeSession(params: {
  userId: string;
  plannedDurationMs: number;
  surface?: HandsFreeSessionRow['surface'];
}): Promise<string> {
  const { data, error } = await supabase
    .from('handsfree_sessions')
    .insert({
      user_id: params.userId,
      planned_duration_ms: params.plannedDurationMs,
      surface: params.surface ?? 'in_app',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

/** Close out a hands-free session with its outcome. */
export async function finalizeHandsFreeSession(
  id: string,
  patch: {
    endedAt: string;
    actualDurationMs: number;
    itemsAttempted: number;
    itemsCorrect: number;
    endedReason: NonNullable<HandsFreeSessionRow['endedReason']>;
  },
): Promise<void> {
  const { error } = await supabase
    .from('handsfree_sessions')
    .update({
      ended_at: patch.endedAt,
      actual_duration_ms: patch.actualDurationMs,
      items_attempted: patch.itemsAttempted,
      items_correct: patch.itemsCorrect,
      ended_reason: patch.endedReason,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function fetchRecentHandsFreeSessions(
  userId: string,
  limit = 20,
): Promise<HandsFreeSessionRow[]> {
  const { data, error } = await supabase
    .from('handsfree_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapHandsFreeSession);
}

function mapHandsFreeSession(row: Record<string, unknown>): HandsFreeSessionRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string | null) ?? null,
    plannedDurationMs: (row.planned_duration_ms as number) ?? 0,
    actualDurationMs: (row.actual_duration_ms as number | null) ?? null,
    itemsAttempted: (row.items_attempted as number) ?? 0,
    itemsCorrect: (row.items_correct as number) ?? 0,
    surface: (row.surface as HandsFreeSessionRow['surface']) ?? 'in_app',
    endedReason: (row.ended_reason as HandsFreeSessionRow['endedReason']) ?? null,
  };
}

// ─── Daily Stats ────────────────────────────────────────────────

export async function fetchTodayStats(userId: string): Promise<DailyStats | null> {
  const today = localToday();

  const { data, error } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapDailyStats(data) : null;
}

export async function upsertDailyStats(
  userId: string,
  updates: Partial<Omit<DailyStats, 'id' | 'userId' | 'date'>>
): Promise<DailyStats> {
  // Atomic server-side upsert (migration 048): INSERT ... ON CONFLICT adds
  // the deltas under the row lock, closing the lost-update race the old
  // fetch-then-upsert had between two concurrent sessions. `accuracy` keeps
  // its set-if-provided (not additive) semantics.
  const { data, error } = await supabase
    .rpc('upsert_daily_stats', {
      p_user_id: userId,
      p_lessons_completed: updates.lessonsCompleted ?? 0,
      p_cards_reviewed: updates.cardsReviewed ?? 0,
      p_cards_learned: updates.cardsLearned ?? 0,
      p_minutes_practiced: updates.minutesPracticed ?? 0,
      p_speaking_minutes: updates.speakingMinutes ?? 0,
      p_listening_minutes: updates.listeningMinutes ?? 0,
      p_reading_minutes: updates.readingMinutes ?? 0,
      p_writing_minutes: updates.writingMinutes ?? 0,
      p_xp_earned: updates.xpEarned ?? 0,
      p_accuracy: updates.accuracy ?? null,
    })
    .single();

  if (error) throw error;

  return mapDailyStats(data as Record<string, unknown>);
}

/**
 * New-cards-per-day cap gate (research.md §5.2 + §13.1).
 *
 * Atomically consumes one slot of the daily new-card cap. The RPC
 * (migration 044) upserts today's daily_stats row (user-timezone day) and
 * increments `cards_learned` only while it is below the cap — a single
 * check-and-increment statement, so two concurrent sessions can no longer
 * both pass a separate read-then-write check. Returns true iff a slot was
 * consumed; callers should only introduce the new card when it did.
 */
export async function tryConsumeNewCardSlot(): Promise<boolean> {
  // No cap argument. It used to take one, which meant the number deciding what
  // a free plan is worth was asserted by the client — a patched build could
  // hand itself the maximum. The RPC now reads it from get_effective_limits.
  const { data, error } = await supabase.rpc('try_consume_new_card_slot');
  if (error) throw error;
  return data === true;
}

/**
 * Today's new-card usage against the learner's cap, without consuming a slot.
 *
 * Read-only companion to `tryConsumeNewCardSlot`, for showing "3 of 5 today"
 * before the learner runs into the limit rather than after.
 */
export async function fetchNewCardAllowance(): Promise<{ used: number; cap: number }> {
  const { data, error } = await supabase.rpc('new_card_allowance');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    used: (row?.used as number) ?? 0,
    cap: (row?.cap as number) ?? PLANS.starter.dailyNewCards,
  };
}

export async function fetchStatsRange(userId: string, startDate: string, endDate: string): Promise<DailyStats[]> {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
    .limit(400);

  if (error) throw error;
  return (data ?? []).map(mapDailyStats);
}

// ─── Proficiency Evidence (CEFR report) ─────────────────────────

// Caps on the evidence pulled for a report. These are user-growable tables, so
// every read is bounded per the project rule. The estimator works on ratios,
// not raw totals, so a capped sample still yields a sound level — and no
// realistic learner approaches these ceilings.
const PROFICIENCY_VOCAB_LIMIT = 2000;
const PROFICIENCY_READING_LIMIT = 500;
const PROFICIENCY_WRITING_LIMIT = 500;
/**
 * Pronunciation attempts are the highest-volume evidence here — the paid plans
 * allow several a day — so this is read most-recent-first and capped. The most
 * recent attempts are also the ones that describe the learner's current level.
 */
const PROFICIENCY_SPEAKING_LIMIT = 500;
/** ~2 years of daily rows; also the active-day count for confidence scoring. */
/** Conversation turns considered. Larger than the other evidence caps
 *  because a turn is a much smaller unit than a passage or a submission — a
 *  single session can produce dozens. */
const PROFICIENCY_CONVERSATION_LIMIT = 1000;

const PROFICIENCY_STATS_DAY_LIMIT = 730;

/**
 * Read `cefr_level` off a PostgREST embedded resource. Depending on how the
 * relationship is inferred an embed arrives as an object or a single-element
 * array, so handle both rather than trusting one shape.
 */
function nestedCefrLevel(embedded: unknown): string | null {
  const node = Array.isArray(embedded) ? embedded[0] : embedded;
  if (!node || typeof node !== 'object') return null;
  const value = (node as { cefr_level?: unknown }).cefr_level;
  return typeof value === 'string' ? value : null;
}

/**
 * Gather every piece of in-app evidence the CEFR estimator can use.
 *
 * Read-only aggregation over history the app already records — no new
 * assessment is run and nothing is written. The shape returned is consumed by
 * `buildProficiencyReport` in `lib/cefr-proficiency.ts`.
 *
 * Errors are thrown rather than swallowed: a proficiency report built from a
 * silently truncated dataset would understate the learner's level, which is
 * worse than showing them a retry.
 */
export async function fetchProficiencyEvidence(
  userId: string
): Promise<ProficiencyEvidence> {
  const [
    vocabRes,
    readingRes,
    writingRes,
    speakingRes,
    statsRes,
    reviewCountRes,
    conversationRes,
  ] = await Promise.all([
      // Every review item with its card's CEFR tag. Inner join drops orphaned
      // items, matching fetchDueReviewItemsWithCards.
      supabase
        .from('review_items')
        .select('status, repetitions, interval, cards!inner(cefr_level)')
        .eq('user_id', userId)
        .limit(PROFICIENCY_VOCAB_LIMIT),

      supabase
        .from('user_reading_progress')
        .select('comprehension_score, completed_at, reading_passages!inner(cefr_level)')
        .eq('user_id', userId)
        .limit(PROFICIENCY_READING_LIMIT),

      supabase
        .from('user_writing_submissions')
        .select('overall_score, word_count, writing_prompts!inner(cefr_level)')
        .eq('user_id', userId)
        .limit(PROFICIENCY_WRITING_LIMIT),

      // Scored spoken attempts (migration 089). The card embed is a LEFT join
      // on purpose: read-aloud and free-practice attempts have no card_id, and
      // dropping them here would understate how much speaking evidence exists.
      // `assessSpeaking` ignores untagged attempts when picking a level.
      supabase
        .from('pronunciation_scores')
        .select('score, cards(cefr_level)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PROFICIENCY_SPEAKING_LIMIT),

      supabase
        .from('daily_stats')
        .select('date, listening_minutes, speaking_minutes')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(PROFICIENCY_STATS_DAY_LIMIT),

      supabase
        .from('review_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),

      // Scored conversation turns (migration 095). This is what finally lets
      // chat and voice move the measured level — before it, the most
      // expensive feature in the app contributed no evidence at all.
      //
      // Rows carry their components rather than a combined score, so the
      // weighting stays re-tunable; `combineConversationScore` folds them.
      supabase
        .from('conversation_evidence')
        .select('modality, cefr_level, accuracy, intelligibility, word_count')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PROFICIENCY_CONVERSATION_LIMIT),
    ]);

  if (vocabRes.error) throw vocabRes.error;
  if (readingRes.error) throw readingRes.error;
  if (writingRes.error) throw writingRes.error;
  if (speakingRes.error) throw speakingRes.error;
  if (statsRes.error) throw statsRes.error;
  if (reviewCountRes.error) throw reviewCountRes.error;
  if (conversationRes.error) throw conversationRes.error;

  const vocabulary: VocabEvidenceItem[] = (vocabRes.data ?? []).map(
    (row: Record<string, unknown>) => ({
      cefrLevel: nestedCefrLevel(row.cards),
      status: row.status as ReviewItem['status'],
      repetitions: (row.repetitions as number) ?? 0,
      interval: (row.interval as number) ?? 0,
    })
  );

  const reading: ReadingEvidenceItem[] = (readingRes.data ?? []).map(
    (row: Record<string, unknown>) => ({
      cefrLevel: nestedCefrLevel(row.reading_passages),
      comprehension: (row.comprehension_score as number | null) ?? null,
      completed: row.completed_at != null,
    })
  );

  const writing: WritingEvidenceItem[] = (writingRes.data ?? []).map(
    (row: Record<string, unknown>) => ({
      cefrLevel: nestedCefrLevel(row.writing_prompts),
      overallScore: (row.overall_score as number | null) ?? null,
      wordCount: (row.word_count as number) ?? 0,
    })
  );

  // `pronunciation_scores.score` is 0–100; the estimator works on 0–1 like the
  // reading and writing scales, so normalise at the boundary.
  const speaking: SpeakingEvidenceItem[] = (speakingRes.data ?? []).map(
    (row: Record<string, unknown>) => ({
      cefrLevel: nestedCefrLevel(row.cards),
      score: ((row.score as number) ?? 0) / 100,
    })
  );

  // Conversation turns join the skill they are evidence for. A spoken turn is
  // speaking evidence; a typed one is written-production evidence and joins
  // the writing pool. They are kept apart because composing a sentence with a
  // keyboard and time to think is a materially easier task than saying it out
  // loud — pooling them would let a learner type their way to a speaking level.
  const conversationRows = (conversationRes.data ?? []) as Record<string, unknown>[];
  for (const row of conversationRows) {
    const score = combineConversationScore(
      Number(row.accuracy ?? 0),
      row.intelligibility === null || row.intelligibility === undefined
        ? null
        : Number(row.intelligibility),
    );
    const cefrLevel = (row.cefr_level as string | null) ?? null;
    if (row.modality === 'speaking') {
      speaking.push({ cefrLevel, score });
    } else {
      writing.push({
        cefrLevel,
        overallScore: score,
        wordCount: Number(row.word_count ?? 0),
      });
    }
  }

  const statRows = (statsRes.data ?? []) as Record<string, unknown>[];
  const listeningMinutes = statRows.reduce(
    (sum, row) => sum + ((row.listening_minutes as number) ?? 0),
    0
  );
  const speakingMinutes = statRows.reduce(
    (sum, row) => sum + ((row.speaking_minutes as number) ?? 0),
    0
  );

  return {
    vocabulary,
    reading,
    writing,
    speaking,
    listeningMinutes,
    speakingMinutes,
    // One daily_stats row per active day, so the row count is the day count.
    activeDays: statRows.length,
    totalReviews: reviewCountRes.count ?? 0,
  };
}

// ─── Practice Sessions ──────────────────────────────────────────

export async function createPracticeSession(
  userId: string,
  topic: string,
  targetLanguage: string,
  level: string
): Promise<PracticeSession> {
  const { data, error } = await supabase
    .from('practice_sessions')
    .insert({
      user_id: userId,
      topic,
      target_language: targetLanguage,
      level,
      messages: [],
    })
    .select()
    .single();

  if (error) throw error;
  return mapPracticeSession(data);
}

export async function updatePracticeSession(
  sessionId: string,
  updates: { messages?: unknown[]; durationMinutes?: number; endedAt?: string }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.messages !== undefined) payload.messages = updates.messages;
  if (updates.durationMinutes !== undefined) payload.duration_minutes = updates.durationMinutes;
  if (updates.endedAt !== undefined) payload.ended_at = updates.endedAt;

  const { error } = await supabase
    .from('practice_sessions')
    .update(payload)
    .eq('id', sessionId);

  if (error) throw error;
}

// ─── Daily Usage (quota tracking) ────────────────────────────────

/**
 * Fetch or create today's daily_usage row for a user.
 * Uses upsert with the UNIQUE(user_id, date) constraint.
 */
export async function getOrCreateDailyUsage(userId: string): Promise<DailyUsage> {
  const today = localToday();

  const { data, error } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (error) throw error;
  if (data) return mapDailyUsage(data);

  // No usage row yet today. The client only READS this table — the row is
  // created server-side on first quota consumption (consume_daily_quota /
  // increment_daily_usage do INSERT ... ON CONFLICT under service role).
  // Writing it here would require a client-writable RLS policy, which lets
  // a user reset their own quota counters (migration 050 makes this table
  // SELECT-only). Return a zeroed view until the first consumption lands.
  return {
    id: '',
    userId,
    date: today,
    textMessages: 0,
    voiceMinutes: 0,
    writingGrades: 0,
    pronunciationScores: 0,
  };
}

/**
 * Increment daily usage counters atomically.
 * Accepts deltas — pass { textMessagesDelta: 1 } to add 1 text message.
 */
export async function incrementDailyUsage(
  userId: string,
  deltas: {
    textMessagesDelta?: number;
    voiceMinutesDelta?: number;
    writingGradesDelta?: number;
    pronunciationScoresDelta?: number;
  }
): Promise<DailyUsage> {
  // Atomic server-side counter (migration 048): INSERT ... ON CONFLICT adds
  // the deltas in one statement, closing the lost-update race the old
  // read-then-write pair had. Named args omit p_date so PostgREST resolves
  // to the 048 overload; the day is keyed server-side (user timezone).
  const { data, error } = await supabase
    .rpc('increment_daily_usage', {
      p_user_id: userId,
      p_text_messages: deltas.textMessagesDelta ?? 0,
      p_voice_minutes: deltas.voiceMinutesDelta ?? 0,
      p_writing_grades: deltas.writingGradesDelta ?? 0,
      p_pronunciation_scores: deltas.pronunciationScoresDelta ?? 0,
    })
    .single();

  if (error) throw error;
  return mapDailyUsage(data as Record<string, unknown>);
}

// ─── Subscriptions ──────────────────────────────────────────────

export async function fetchSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapSubscription(data) : null;
}

// ─── Mappers (snake_case DB → camelCase TS) ─────────────────────

function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    displayName: row.display_name as string,
    nativeLanguage: row.native_language as UserProfile['nativeLanguage'],
    targetLanguage: row.target_language as UserProfile['targetLanguage'],
    level: row.level as UserProfile['level'],
    dailyGoalMinutes: row.daily_goal_minutes as number,
    totalXp: row.total_xp as number,
    timezone: row.timezone as string,
    onboardingCompleted: (row.onboarding_completed as boolean) ?? false,
    // XP levels & leagues
    xpLevel: (row.xp_level as number) ?? 1,
    leagueTier: (row.league_tier as UserProfile['leagueTier']) ?? 'bronze',
    // Avatar renderer selection (migration 067). Rows written before it have
    // no avatar_kind. Nothing renders 'procedural' now, so those rows show
    // the initials placeholder until the learner picks from the library.
    avatarKind: (row.avatar_kind as UserProfile['avatarKind']) ?? 'procedural',
    avatarPresetId: (row.avatar_preset_id as string | null) ?? null,
    avatarImagePath: (row.avatar_image_path as string | null) ?? null,
    onboardingChecklist: parseOnboardingChecklist(row.onboarding_checklist),
    // L2 Motivational Self System (migration 028). Null-safe for legacy rows.
    motivationReason: (row.motivation_reason as UserProfile['motivationReason']) ?? null,
    idealL2Self: (row.ideal_l2_self as string | null) ?? null,
    // Adult mode (migration 052). Defaults false for rows written before it.
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const DEFAULT_ONBOARDING_CHECKLIST: OnboardingChecklist = {
  chooseLanguage: false,
  firstLesson: false,
  aiConversation: false,
  dailyReminder: false,
  skipped: [],
  dismissed: false,
  completedAt: null,
  celebratedAt: null,
};

function parseSkippedSteps(raw: unknown): OnboardingStepKey[] {
  if (!Array.isArray(raw)) return [];
  const present = new Set(raw.filter((v): v is string => typeof v === 'string'));
  return ONBOARDING_STEP_KEYS.filter((key) => present.has(key));
}

function parseOnboardingChecklist(raw: unknown): OnboardingChecklist {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ONBOARDING_CHECKLIST, skipped: [] };
  const obj = raw as Record<string, unknown>;
  return {
    chooseLanguage: obj.chooseLanguage === true,
    firstLesson: obj.firstLesson === true,
    aiConversation: obj.aiConversation === true,
    dailyReminder: obj.dailyReminder === true,
    // Validated, not cast. This is a jsonb column that a client wrote, so the
    // array can legitimately contain a key from a future or a deleted step;
    // filtering to the keys this build knows about keeps the rest of the
    // module from having to defend against a string that means nothing here.
    skipped: parseSkippedSteps(obj.skipped),
    dismissed: obj.dismissed === true,
    completedAt: typeof obj.completedAt === 'string' ? obj.completedAt : null,
    celebratedAt: typeof obj.celebratedAt === 'string' ? obj.celebratedAt : null,
  };
}

function mapCourse(row: Record<string, unknown>): Course {
  return {
    id: row.id as string,
    sourceLanguage: row.source_language as Course['sourceLanguage'],
    targetLanguage: row.target_language as Course['targetLanguage'],
    title: row.title as string,
    description: row.description as string,
    imageUrl: row.image_url as string | null,
    totalUnits: row.total_units as number,
    cefrLevel: (row.cefr_level as string) ?? 'A1',
    isPublished: row.is_published as boolean,
    createdAt: row.created_at as string,
  };
}

function mapUnit(row: Record<string, unknown>): Unit {
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    title: row.title as string,
    description: row.description as string,
    orderIndex: row.order_index as number,
    totalLessons: row.total_lessons as number,
  };
}

function mapLesson(row: Record<string, unknown>, exercises: Exercise[]): Lesson {
  return {
    id: row.id as string,
    unitId: row.unit_id as string,
    courseId: (row.course_id as string) ?? null,
    title: row.title as string,
    description: row.description as string,
    orderIndex: row.order_index as number,
    estimatedMinutes: row.estimated_minutes as number,
    xpReward: row.xp_reward as number,
    exercises,
  };
}

function mapExercise(row: Record<string, unknown>): Exercise {
  return {
    id: row.id as string,
    lessonId: row.lesson_id as string,
    type: row.type as Exercise['type'],
    orderIndex: row.order_index as number,
    prompt: row.prompt as string,
    promptAudioUrl: row.prompt_audio_url as string | null,
    correctAnswer: row.correct_answer as string,
    acceptedAnswers: row.accepted_answers as string[],
    options: row.options as string[] | null,
    hintText: row.hint_text as string | null,
    cardId: row.card_id as string | null,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    skillType: (row.skill_type as Exercise['skillType']) ?? undefined,
    subskill: (row.subskill as string) ?? undefined,
    responseMode: (row.response_mode as Exercise['responseMode']) ?? undefined,
    targetWord: (row.target_word as string) ?? undefined,
    targetGrammar: (row.target_grammar as string) ?? undefined,
    acceptedSpeechVariants: (row.accepted_speech_variants as string[]) ?? undefined,
    distractors: (row.distractors as string[]) ?? undefined,
    explanation: (row.explanation as string) ?? undefined,
    sourceType: (row.source_type as Exercise['sourceType']) ?? undefined,
  };
}

function mapCard(row: Record<string, unknown>): Card {
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    unitId: row.unit_id as string | null,
    nativeText: row.native_text as string,
    targetText: row.target_text as string,
    audioUrl: row.audio_url as string | null,
    imageUrl: row.image_url as string | null,
    exampleSentence: row.example_sentence as string | null,
    exampleSentenceTranslation: row.example_sentence_translation as string | null,
    partOfSpeech: row.part_of_speech as string | null,
    tags: row.tags as string[],
    createdAt: row.created_at as string,
    language: (row.language as string) ?? undefined,
    cefrLevel: (row.cefr_level as string) ?? undefined,
    skillType: (row.skill_type as Card['skillType']) ?? undefined,
    subskill: (row.subskill as string) ?? undefined,
    wordFamily: (row.word_family as string[]) ?? undefined,
    collocations: (row.collocations as unknown[]) ?? undefined,
    frequencyRank: (row.frequency_rank as number) ?? undefined,
    sourceType: (row.source_type as Card['sourceType']) ?? undefined,
  };
}

function mapReviewItem(row: Record<string, unknown>): ReviewItem {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    cardId: row.card_id as string,
    easeFactor: row.ease_factor as number,
    interval: row.interval as number,
    repetitions: row.repetitions as number,
    nextDue: row.next_due as string,
    lastReviewedAt: row.last_reviewed_at as string | null,
    status: row.status as ReviewItem['status'],
  };
}

function mapDailyStats(row: Record<string, unknown>): DailyStats {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    date: row.date as string,
    lessonsCompleted: row.lessons_completed as number,
    cardsReviewed: row.cards_reviewed as number,
    cardsLearned: row.cards_learned as number,
    minutesPracticed: row.minutes_practiced as number,
    speakingMinutes: row.speaking_minutes as number,
    listeningMinutes: row.listening_minutes as number,
    readingMinutes: (row.reading_minutes as number) ?? 0,
    writingMinutes: (row.writing_minutes as number) ?? 0,
    xpEarned: row.xp_earned as number,
    accuracy: row.accuracy as number,
  };
}

function mapReviewLog(row: Record<string, unknown>): ReviewLog {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    cardId: row.card_id as string,
    reviewItemId: row.review_item_id as string,
    rating: row.rating as ReviewRating,
    responseTimeMs: row.response_time_ms as number,
    userAnswer: row.user_answer as string,
    wasCorrect: row.was_correct as boolean,
    reviewedAt: row.reviewed_at as string,
  };
}

function mapPracticeSession(row: Record<string, unknown>): PracticeSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    topic: row.topic as string,
    targetLanguage: row.target_language as PracticeSession['targetLanguage'],
    level: row.level as PracticeSession['level'],
    messages: row.messages as PracticeSession['messages'],
    durationMinutes: row.duration_minutes as number,
    startedAt: row.started_at as string,
    endedAt: row.ended_at as string | null,
  };
}

function mapSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tier: row.tier as Subscription['tier'],
    stripeCustomerId: row.stripe_customer_id as string | null,
    stripeSubscriptionId: row.stripe_subscription_id as string | null,
    currentPeriodEnd: row.current_period_end as string | null,
    isActive: row.is_active as boolean,
    cancelAtPeriodEnd: (row.cancel_at_period_end as boolean) ?? false,
  };
}

function mapDailyUsage(row: Record<string, unknown>): DailyUsage {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    date: row.date as string,
    textMessages: row.text_messages as number,
    voiceMinutes: parseFloat(row.voice_minutes as string) || 0,
    writingGrades: (row.writing_grades as number) ?? 0,
    pronunciationScores: (row.pronunciation_scores as number) ?? 0,
  };
}

// ─── Lesson Completions ──────────────────────────────────────────

/**
 * Has this learner ever finished a lesson?
 *
 * Drives the hard paywall gate in app/(app)/_layout.tsx: the first lesson is
 * free (the learner is owed a teaching moment before being asked to pay —
 * DESIGN.md §Behavioral Design, reciprocity), and the gate closes after it.
 *
 * `head: true` with an exact count fetches no rows, and the limit caps the
 * count at 1 — this only ever asks "any?", never "how many?".
 */
export async function fetchHasCompletedLesson(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('lesson_completions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .limit(1);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function upsertLessonCompletion(
  userId: string,
  lessonId: string,
  courseId: string,
  score: number,
  xpEarned: number,
  timeSpentMs: number
): Promise<LessonCompletion> {
  const { data, error } = await supabase
    .from('lesson_completions')
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      course_id: courseId,
      score,
      xp_earned: xpEarned,
      time_spent_ms: timeSpentMs,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lesson_id' })
    .select()
    .single();

  if (error) throw error;
  return mapLessonCompletion(data);
}

export interface UnitProgressTile {
  unitId: string;
  courseId: string;
  title: string;
  lessonCount: number;
  completedCount: number;
  progress: number;
  nextLessonId: string | null;
  orderIndex: number;
}

/**
 * Build an ordered list of units with progress + the next-up lesson for the
 * user's primary course in `targetLanguage`. Used by the home-screen
 * "Continue learning" tile grid.
 *
 * Returns [] if no published course exists for the language yet.
 */
export async function fetchUnitProgressTiles(
  userId: string,
  targetLanguage: string,
  limit = 4,
): Promise<UnitProgressTile[]> {
  const courses = await fetchCourses(targetLanguage);
  if (courses.length === 0) return [];
  const course = courses[0];

  const units = await fetchUnits(course.id);
  if (units.length === 0) return [];

  // Single query for all units' lessons (was one fetchLessons per unit —
  // N+1), grouped client-side; order_index sort is preserved per unit.
  const [lessonsResult, completions] = await Promise.all([
    supabase
      .from('lessons')
      .select('*')
      .in('unit_id', units.map((u) => u.id))
      .order('order_index', { ascending: true }),
    fetchLessonCompletions(userId, course.id),
  ]);
  if (lessonsResult.error) throw lessonsResult.error;
  const lessonsByUnit = new Map<string, Lesson[]>();
  for (const row of lessonsResult.data ?? []) {
    const lesson = mapLesson(row, []);
    const list = lessonsByUnit.get(lesson.unitId);
    if (list) list.push(lesson);
    else lessonsByUnit.set(lesson.unitId, [lesson]);
  }
  const completedSet = new Set(completions.map((c) => c.lessonId));

  const tiles: UnitProgressTile[] = units.map((unit) => {
    const lessons = lessonsByUnit.get(unit.id) ?? [];
    const completedCount = lessons.filter((l) => completedSet.has(l.id)).length;
    const lessonCount = lessons.length > 0 ? lessons.length : unit.totalLessons;
    const progress = lessonCount > 0 ? completedCount / lessonCount : 0;
    const nextLesson = lessons.find((l) => !completedSet.has(l.id)) ?? null;
    return {
      unitId: unit.id,
      courseId: course.id,
      title: unit.title,
      lessonCount,
      completedCount,
      progress,
      nextLessonId: nextLesson?.id ?? null,
      orderIndex: unit.orderIndex,
    };
  });

  // Prefer units the user is actively progressing through: in-progress first,
  // then not-yet-started, then fully completed; preserve order_index within
  // each bucket so the sequence still matches the curriculum.
  const bucket = (t: UnitProgressTile) =>
    t.completedCount > 0 && t.completedCount < t.lessonCount ? 0 : t.completedCount === 0 ? 1 : 2;
  const sorted = [...tiles].sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    return a.orderIndex - b.orderIndex;
  });

  return sorted.slice(0, limit);
}

export async function fetchLessonCompletions(
  userId: string,
  courseId?: string
): Promise<LessonCompletion[]> {
  let query = supabase
    .from('lesson_completions')
    .select('*')
    .eq('user_id', userId);

  if (courseId) {
    query = query.eq('course_id', courseId);
  }

  // Callers build a completeness map from this (lesson locking/progress), so
  // a tight limit would incorrectly mark lessons incomplete. Completions are
  // unique per (user, lesson); 2000 completed lessons is years of use and
  // far beyond the current curriculum — this is a runaway-query guard, not
  // pagination.
  const { data, error } = await query.limit(2000);
  if (error) throw error;
  return (data ?? []).map(mapLessonCompletion);
}

export interface LessonCompletionWithTitle extends LessonCompletion {
  lessonTitle: string;
}

export interface CompletedLessonsPage {
  /** The most recent completions, newest first, capped at the requested limit. */
  rows: LessonCompletionWithTitle[];
  /**
   * How many completions the learner has in TOTAL, not how many are on this
   * page. The profile's collapsed vault row states this number, so a learner
   * with 200 lessons behind them is told 200 even though only `limit` rows
   * were fetched to fill the list.
   */
  total: number;
}

/**
 * Fetch the user's recent lesson completions with their lesson titles.
 * Powers the Profile > Completed Lessons vault. Ordered newest-first.
 */
export async function fetchCompletedLessonsWithTitles(
  userId: string,
  limit = 25,
): Promise<CompletedLessonsPage> {
  // `count: 'exact'` rides along on the same request — PostgREST answers with
  // the full match count in Content-Range regardless of the limit.
  const { data, error, count } = await supabase
    .from('lesson_completions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const completions = (data ?? []).map(mapLessonCompletion);
  const total = count ?? completions.length;
  if (completions.length === 0) return { rows: [], total: 0 };

  // Titles come from a SECOND query, not a PostgREST embed.
  //
  // `lesson_completions` has no foreign key to `lessons` — a completion is a
  // permanent record of work the learner actually did, and is deliberately not
  // tied to the lifetime of a curriculum row. PostgREST infers embeds from
  // foreign keys only, so `select('*, lessons(title)')` did not degrade to a
  // missing title: it failed the whole request with PGRST200, and the profile
  // told every learner they had completed nothing.
  //
  // `limit` bounds the id list, so this is one `in` over at most `limit` ids.
  const lessonIds = [...new Set(completions.map((c) => c.lessonId))];
  const { data: lessonRows, error: lessonsError } = await supabase
    .from('lessons')
    .select('id, title')
    .in('id', lessonIds);
  if (lessonsError) throw lessonsError;

  const titleById = new Map<string, string>(
    (lessonRows ?? []).map((row: { id: string; title: string }) => [row.id, row.title]),
  );
  return {
    rows: completions.map((c) => ({
      ...c,
      lessonTitle: titleById.get(c.lessonId) ?? 'Untitled lesson',
    })),
    total,
  };
}

function mapLessonCompletion(row: Record<string, unknown>): LessonCompletion {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    lessonId: row.lesson_id as string,
    courseId: row.course_id as string,
    score: row.score as number,
    xpEarned: row.xp_earned as number,
    timeSpentMs: row.time_spent_ms as number,
    completedAt: row.completed_at as string,
  };
}


// ─── Daily Challenges ────────────────────────────────────────────

export async function fetchDailyChallenges(
  userId: string,
  date: string
): Promise<DailyChallengesRecord | null> {
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapDailyChallengesRecord(data) : null;
}

export async function upsertDailyChallenges(
  userId: string,
  date: string,
  challenges: unknown[],
  allCompleted: boolean,
  bonusXpClaimed: boolean
): Promise<DailyChallengesRecord> {
  const { data, error } = await supabase
    .from('daily_challenges')
    .upsert({
      user_id: userId,
      date,
      challenges,
      all_completed: allCompleted,
      bonus_xp_claimed: bonusXpClaimed,
    }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) throw error;
  return mapDailyChallengesRecord(data);
}

/**
 * Atomically claim today's daily-challenge bonus XP server-side. The RPC
 * validates completion + double-claim and
 * grants the XP (migration 043) — clients cannot write XP directly.
 */
export async function claimDailyChallengeBonus(): Promise<{ bonusXp: number; totalXp: number }> {
  const { data, error } = await supabase.rpc('claim_daily_challenge_bonus');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { bonusXp: (row?.bonus_xp as number) ?? 0, totalXp: (row?.total_xp as number) ?? 0 };
}

function mapDailyChallengesRecord(row: Record<string, unknown>): DailyChallengesRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    date: row.date as string,
    challenges: row.challenges as DailyChallengesRecord['challenges'],
    allCompleted: (row.all_completed as boolean) ?? false,
    bonusXpClaimed: (row.bonus_xp_claimed as boolean) ?? false,
  };
}

// ─── Reading ──────────────────────────────────────────────────

/**
 * Map a ProficiencyLevel to the CEFR band the learner can comfortably read
 * (current level + 1 sub-level above, per Krashen i+1). Used to gate content
 * surfaces so learners don't get flooded with C1 text at A2. research.md §1.1.
 */
export function allowedCefrLevelsFor(level: UserProfile['level'] | undefined): string[] {
  // Derived from the shared ladder rather than a private copy of it — see
  // CEFR_BAND_BY_LEVEL for why four copies of this table was a latent bug.
  const ladder = [...CEFR_LADDER];
  if (!level) return ladder; // unknown level → don't filter
  const idx = ladder.indexOf(CEFR_BAND_BY_LEVEL[level]);
  if (idx < 0) return ladder;
  // Learner's level + 1 sub-level (i+1). Include everything at/below too
  // so they can re-visit easier content when they want.
  return ladder.slice(0, Math.min(ladder.length, idx + 2));
}

export async function fetchReadingPassagesByCourse(
  courseId: string,
  level?: UserProfile['level'],
): Promise<ReadingPassage[]> {
  let query = supabase
    .from('reading_passages')
    .select('*')
    .eq('course_id', courseId)
    .eq('is_published', true);
  if (level) {
    query = query.in('cefr_level', allowedCefrLevelsFor(level));
  }
  const { data, error } = await query
    .order('cefr_level', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapReadingPassage);
}

/**
 * One reading passage.
 *
 * Was `fetchPassageWithAnnotations`, which also read `reading_annotations` to
 * decide which words the viewer would make tappable. That table had 0 rows in
 * production and no writer anywhere in the repo, so the answer was always
 * "none" — every passage rendered untappable. Migration 094 dropped the table;
 * words are now looked up on demand when they are tapped (lib/word-lookup.ts).
 */
export async function fetchPassage(passageId: string): Promise<ReadingPassage | null> {
  const { data, error } = await supabase
    .from('reading_passages')
    .select('*')
    .eq('id', passageId)
    .single();

  if (error) throw error;
  return data ? mapReadingPassage(data) : null;
}

export async function fetchReadingQuestions(passageId: string): Promise<ReadingQuestion[]> {
  const { data, error } = await supabase
    .from('reading_questions')
    .select('*')
    .eq('passage_id', passageId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapReadingQuestion);
}

export async function upsertReadingProgress(
  userId: string,
  passageId: string,
  data: { comprehensionScore: number; wordsLookedUp: number; timeSpentMs: number; completedAt: string }
): Promise<void> {
  const { error } = await supabase
    .from('user_reading_progress')
    .upsert({
      user_id: userId,
      passage_id: passageId,
      comprehension_score: data.comprehensionScore,
      words_looked_up: data.wordsLookedUp,
      time_spent_ms: data.timeSpentMs,
      completed_at: data.completedAt,
    }, { onConflict: 'user_id,passage_id' });

  if (error) throw error;
}

export class NewCardsCapReachedError extends Error {
  readonly code = 'NEW_CARDS_CAP_REACHED' as const;
  constructor(public readonly cap: number) {
    super(`Daily new-card cap of ${cap} already reached.`);
  }
}

/**
 * The fields a learner-authored card is built from. `BookAnnotation` satisfies
 * this structurally, and `cardSourceFromLookup` in lib/word-lookup.ts adapts a
 * `WordLookup` to it — so books, passages and live translations all share one
 * code path, and therefore one new-card cap.
 */
export interface AnnotationCardSource {
  wordOrPhrase: string;
  translation: string;
  audioUrl: string | null;
  partOfSpeech: string | null;
  /** Reuse an existing card when the annotation already links to one. */
  cardId?: string | null;
}

export async function addCardFromAnnotation(
  userId: string,
  annotation: AnnotationCardSource,
  courseId: string,
  tags: string[] = ['reading'],
  /** CEFR band to file the card under — see the note on saveCorrectionAsCard.
   *  Without it the card never counts toward measured vocabulary. */
  cefrLevel?: string | null,
  /** Target language of the word. This path never set `cards.language`, which
   *  is why a reading card could not be deduplicated against a chat card for
   *  the same word — they were filed in different languages, one of them
   *  null. Optional so existing callers keep compiling; dedupe only runs when
   *  it is supplied. */
  language?: string | null
): Promise<ReviewItem> {
  // Enforce the learner's daily new-card cap before introducing a new card
  // (research.md §5.2) — atomic check-and-consume, migration 044, with the cap
  // derived server-side from their tier since migration 084.
  if (!(await tryConsumeNewCardSlot())) {
    // Read the real cap so the message names the learner's actual limit
    // rather than the shipped default.
    const { cap } = await fetchNewCardAllowance().catch(() => ({
      cap: PLANS.starter.dailyNewCards,
    }));
    throw new NewCardsCapReachedError(cap);
  }

  // If annotation already links to a card, use it; otherwise create one
  let cardId = annotation.cardId;

  // Already studying this word? Reuse the card rather than filing a second one
  // with its own independent SM-2 schedule.
  if (!cardId && language) {
    cardId = await findExistingLearnerCard(userId, language, annotation.wordOrPhrase);
  }

  if (!cardId) {
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .insert({
        // Stamps the learner as owner. Required: the INSERT policy added in
        // migration 088 checks it, and without it the write is refused.
        user_id: userId,
        course_id: courseId,
        native_text: annotation.translation,
        target_text: annotation.wordOrPhrase,
        audio_url: annotation.audioUrl,
        part_of_speech: annotation.partOfSpeech,
        language: language ?? null,
        cefr_level: cefrLevel ?? null,
        // Tokenized here rather than in SQL so the coverage ranking
        // (migration 096) intersects against terms produced by the SAME
        // tokenizer the corpus build used. A Postgres approximation of
        // wordTokens() would drift and empty the intersection silently.
        search_terms: [...new Set(wordTokens(annotation.wordOrPhrase))],
        tags,
      })
      .select()
      .single();

    if (cardError) throw cardError;
    cardId = card.id;
  }

  const reviewItem = await upsertReviewItem({
    userId,
    cardId: cardId!,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextDue: new Date().toISOString(),
    lastReviewedAt: null,
    status: 'new',
  });

  return reviewItem;
}

// ─── Writing ──────────────────────────────────────────────────

export async function fetchWritingPromptsByCourse(
  courseId: string,
  level?: UserProfile['level'],
): Promise<WritingPrompt[]> {
  let query = supabase
    .from('writing_prompts')
    .select('*')
    .eq('course_id', courseId);
  if (level) {
    query = query.in('cefr_level', allowedCefrLevelsFor(level));
  }
  const { data, error } = await query
    .order('cefr_level', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapWritingPrompt);
}

export async function fetchWritingPromptById(promptId: string): Promise<WritingPrompt | null> {
  const { data, error } = await supabase
    .from('writing_prompts')
    .select('*')
    .eq('id', promptId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapWritingPrompt(data) : null;
}

export async function submitWriting(
  userId: string,
  promptId: string,
  text: string,
  wordCount: number,
  timeSpentMs: number,
  attemptNumber = 1
): Promise<WritingSubmission> {
  const { data, error } = await supabase
    .from('user_writing_submissions')
    .insert({
      user_id: userId,
      prompt_id: promptId,
      submission_text: text,
      word_count: wordCount,
      time_spent_ms: timeSpentMs,
      attempt_number: attemptNumber,
    })
    .select()
    .single();

  if (error) throw error;
  return mapWritingSubmission(data);
}

export async function updateWritingFeedback(
  submissionId: string,
  feedback: WritingFeedback,
  overallScore: number
): Promise<void> {
  const { error } = await supabase
    .from('user_writing_submissions')
    .update({
      ai_feedback: feedback,
      overall_score: overallScore,
    })
    .eq('id', submissionId);

  if (error) throw error;
}

// ─── Daily News ───────────────────────────────────────────────
// Shared daily articles — one per (language × tier × date). Written by
// the `daily-news-cron` service-role function on a 5 AM ET schedule. All
// users at the same language+tier see the same article that day.

import type { NewsTier } from '../config/app';

export async function fetchDailyNews(
  language: string,
  tier: NewsTier,
  date?: string,
): Promise<DailyNewsArticle | null> {
  const targetDate = date ?? localToday();

  // Try today first. If the caller specified an explicit date, honor it
  // strictly and do not fall back — historical queries should only return
  // the article for that exact date.
  const { data, error } = await supabase
    .from('daily_news')
    .select('*')
    .eq('language', language)
    .eq('tier', tier)
    .eq('date', targetDate)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  if (data) return mapDailyNewsArticle(data);
  if (date) return null;

  // Fallback: today's row isn't there yet (common between local
  // midnight and ~5 AM ET when the cron fires). Return the most recent
  // available article for this language + tier so the home card never
  // shows an empty state when there IS content to surface.
  const { data: fallback, error: fallbackErr } = await supabase
    .from('daily_news')
    .select('*')
    .eq('language', language)
    .eq('tier', tier)
    .lte('date', targetDate)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackErr && fallbackErr.code !== 'PGRST116') throw fallbackErr;
  return fallback ? mapDailyNewsArticle(fallback) : null;
}

/**
 * Mark an article as read for the current user. Idempotent — re-marking
 * preserves the original read_at timestamp server-side.
 */
export async function markNewsAsRead(articleId: string): Promise<string> {
  // Ensure the access token is fresh before invoking — eliminates the
  // `FunctionsFetchError: Failed to send a request to the Edge Function`
  // class of failure caused by stale cached sessions.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshed.session) {
      throw new Error('You need to be signed in to mark articles as read.');
    }
  }

  const { data, error } = await supabase.functions.invoke('daily-news', {
    body: { action: 'mark-read', articleId },
  });

  if (error) {
    let message = error.message ?? 'Failed to mark article as read';
    if (error.context instanceof Response) {
      try {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      } catch {
        // non-JSON body — keep SDK default
      }
    } else if (error.name === 'FunctionsFetchError') {
      message = 'Could not reach the article service. Check your connection and try again.';
    }
    throw new Error(message);
  }
  return (data?.readAt as string) ?? new Date().toISOString();
}

/**
 * Check whether the current user has already read a given article.
 * Returns the read_at ISO string or null.
 */
export async function fetchNewsReadStatus(
  userId: string,
  articleId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_news_reads')
    .select('read_at')
    .eq('user_id', userId)
    .eq('article_id', articleId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data?.read_at ?? null;
}

/**
 * Fetch a playable URL for an article's narration.
 *
 * Returns `null` when the audio is still rendering (HTTP 202) — a state, not
 * a failure. The caller should re-poll once after a short backoff rather
 * than showing an error, because the usual cause is simply being the first
 * person to ask for an article the cron has not reached yet.
 *
 * MUST stay behind an explicit user tap. Never call this from a bare
 * `useEffect` on article load: egress is unmetered and playback carries no
 * quota counter (cost is fixed at generation), so a render loop here has
 * nothing but the server's burst limit standing in front of it.
 *
 * The returned `url` is signed and short-lived. Treat it as a ticket — play
 * it, do not store it, and refetch rather than reusing it later.
 */
export async function fetchNewsAudio(articleId: string): Promise<NewsAudio | null> {
  // Same stale-session refresh as markNewsAsRead: a cached expired session
  // surfaces as `FunctionsFetchError: Failed to send a request to the Edge
  // Function`, which reads to the user as "the network is broken" when in
  // fact only the token is.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshed.session) {
      throw new Error('You need to be signed in to listen to the news.');
    }
  }

  const { data, error } = await supabase.functions.invoke('news-audio', {
    body: { articleId },
  });

  if (error) {
    let message = error.message ?? 'Failed to load the audio';
    if (error.context instanceof Response) {
      // The 202 "still generating" answer arrives here rather than in
      // `data`, because the SDK treats any non-2xx-looking status as an
      // error. It is not one.
      if (error.context.status === 202) return null;
      try {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      } catch {
        // non-JSON body — keep SDK default
      }
    } else if (error.name === 'FunctionsFetchError') {
      message = 'Could not reach the audio service. Check your connection and try again.';
    }
    throw new Error(message);
  }

  if (data?.status === 'generating') return null;
  if (!data?.url) {
    throw new Error('The audio service did not return anything playable.');
  }

  return {
    status: 'ready',
    url: data.url as string,
    durationMs: typeof data.durationMs === 'number' ? data.durationMs : null,
    expiresInSeconds: typeof data.expiresInSeconds === 'number' ? data.expiresInSeconds : 1800,
  };
}

// ─── Reading Mappers ────────────────────────────────────────────

function mapReadingPassage(row: Record<string, unknown>): ReadingPassage {
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    unitId: (row.unit_id as string) ?? null,
    cefrLevel: row.cefr_level as string,
    title: row.title as string,
    content: row.content as string,
    contentTranslation: (row.content_translation as string) ?? null,
    wordCount: (row.word_count as number) ?? 0,
    audioUrl: (row.audio_url as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    sourceAttribution: (row.source_attribution as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    isPublished: (row.is_published as boolean) ?? false,
    createdAt: row.created_at as string,
  };
}

function mapReadingQuestion(row: Record<string, unknown>): ReadingQuestion {
  return {
    id: row.id as string,
    passageId: row.passage_id as string,
    orderIndex: row.order_index as number,
    questionText: row.question_text as string,
    questionType: row.question_type as ReadingQuestion['questionType'],
    correctAnswer: row.correct_answer as string,
    acceptedAnswers: (row.accepted_answers as string[]) ?? [],
    options: (row.options as string[]) ?? null,
  };
}

// ─── Writing Mappers ────────────────────────────────────────────

function mapWritingPrompt(row: Record<string, unknown>): WritingPrompt {
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    unitId: (row.unit_id as string) ?? null,
    cefrLevel: row.cefr_level as string,
    promptText: row.prompt_text as string,
    promptType: row.prompt_type as WritingPrompt['promptType'],
    exampleResponse: (row.example_response as string) ?? null,
    targetVocabulary: (row.target_vocabulary as string[]) ?? [],
    targetGrammar: (row.target_grammar as string[]) ?? [],
    minWords: (row.min_words as number) ?? null,
    maxWords: (row.max_words as number) ?? null,
    rubricCriteria: (row.rubric_criteria as unknown[]) ?? [],
    scaffoldType: (row.scaffold_type as WritingPrompt['scaffoldType']) ?? 'free',
    scaffoldData: (row.scaffold_data as Record<string, unknown>) ?? {},
    maxAttempts: (row.max_attempts as number) ?? 3,
    createdAt: row.created_at as string,
  };
}

function mapWritingSubmission(row: Record<string, unknown>): WritingSubmission {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    promptId: row.prompt_id as string,
    submissionText: row.submission_text as string,
    aiFeedback: (row.ai_feedback as WritingFeedback) ?? null,
    overallScore: (row.overall_score as number) ?? null,
    wordCount: (row.word_count as number) ?? 0,
    timeSpentMs: (row.time_spent_ms as number) ?? 0,
    attemptNumber: (row.attempt_number as number) ?? 1,
    submittedAt: row.submitted_at as string,
  };
}

// ─── Reading Books (Library) ────────────────────────────────────

export async function fetchBooksByLanguageAndLevel(
  language: string,
  cefrLevel?: string,
  limit = 20,
  offset = 0
): Promise<ReadingBook[]> {
  let query = supabase
    .from('reading_books')
    .select('id, title, author, description, language, cefr_level, word_count, image_url, tags, source, source_id, chapter_breaks, is_published, created_at')
    .eq('language', language)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cefrLevel) {
    query = query.eq('cefr_level', cefrLevel);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapReadingBook);
}

/**
 * Everything about a book EXCEPT its text.
 *
 * `content` averages 211 kB across the library and reaches 1.8 MB on a long
 * novel — it is 2191 MB of the 2227 MB database. Selecting it here made the
 * cover screen wait on the whole book before it could draw anything, so the
 * two are fetched separately and the text loads behind the Read button.
 * Columns are named explicitly, exactly as fetchBooksByLanguageAndLevel does.
 */
/**
 * The library ordered by how much of each book the learner can already read.
 *
 * `rank_books_by_coverage` (migration 096) does the work in Postgres against
 * the precomputed `book_vocab` profiles — the corpus is 2191 MB and cannot be
 * tokenized at query time. It returns ids and scores only, so the book rows
 * are fetched separately with `content` excluded and re-ordered to match.
 *
 * `knownShare` is the share of the book's running words the learner has
 * retained; it is 0 for everyone until they graduate cards out of learning,
 * which is why the RPC falls through to `commonShare` and the shelf still
 * ranks sensibly on day one.
 */
export interface RankedBook {
  book: ReadingBook;
  /** Share of running words the learner has retained. 0..1 */
  knownShare: number;
  /** Share of running words in the language's 1,000 most frequent forms. 0..1 */
  commonShare: number;
}

export async function fetchBooksRankedByCoverage(
  language: string,
  limit = 40
): Promise<RankedBook[]> {
  const { data: ranked, error } = await supabase.rpc('rank_books_by_coverage', {
    p_language: language,
    p_limit: limit,
  });
  if (error) throw error;

  const rows = (ranked ?? []) as {
    book_id: string;
    known_share: number;
    common_share: number;
  }[];
  if (rows.length === 0) return [];

  const { data: books, error: booksError } = await supabase
    .from('reading_books')
    .select(
      'id, title, author, description, language, cefr_level, word_count, image_url, tags, source, source_id, chapter_breaks, is_published, created_at'
    )
    .in('id', rows.map((r) => r.book_id));
  if (booksError) throw booksError;

  // `.in()` does not preserve the ranking, and the ranking is the entire point.
  const byId = new Map((books ?? []).map((b) => [b.id as string, mapReadingBook(b)]));
  return rows
    .map((r) => {
      const book = byId.get(r.book_id);
      return book
        ? { book, knownShare: r.known_share ?? 0, commonShare: r.common_share ?? 0 }
        : null;
    })
    .filter((r): r is RankedBook => r !== null);
}

export async function fetchBookMeta(bookId: string): Promise<ReadingBook | null> {
  const { data, error } = await supabase
    .from('reading_books')
    .select(
      'id, title, author, description, language, cefr_level, word_count, image_url, tags, source, source_id, chapter_breaks, is_published, created_at'
    )
    .eq('id', bookId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapReadingBook(data) : null;
}

/**
 * A book's text.
 *
 * Published books are immutable, so the caller caches this on the device
 * (readCacheKey('book-content', bookId)) and a hit needs no revalidation.
 */
export async function fetchBookContent(bookId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('reading_books')
    .select('content')
    .eq('id', bookId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? ((data.content as string) ?? '') : null;
}

export async function fetchBookAnnotations(bookId: string): Promise<BookAnnotation[]> {
  const { data, error } = await supabase
    .from('book_annotations')
    .select('*')
    .eq('book_id', bookId);

  if (error) throw error;
  return (data ?? []).map(mapBookAnnotation);
}

export async function upsertBookProgress(
  userId: string,
  bookId: string,
  updates: Partial<Omit<UserBookProgress, 'id' | 'userId' | 'bookId'>>
): Promise<UserBookProgress> {
  const row: Record<string, unknown> = {
    user_id: userId,
    book_id: bookId,
    last_read_at: new Date().toISOString(),
  };
  if (updates.currentPosition !== undefined) row.current_position = updates.currentPosition;
  if (updates.currentChapter !== undefined) row.current_chapter = updates.currentChapter;
  if (updates.percentComplete !== undefined) row.percent_complete = updates.percentComplete;
  if (updates.timeSpentMs !== undefined) row.time_spent_ms = updates.timeSpentMs;
  if (updates.wordsLookedUp !== undefined) row.words_looked_up = updates.wordsLookedUp;
  if (updates.completedAt !== undefined) row.completed_at = updates.completedAt;

  const { data, error } = await supabase
    .from('user_book_progress')
    .upsert(row, { onConflict: 'user_id,book_id' })
    .select()
    .single();

  if (error) throw error;
  return mapUserBookProgress(data);
}

export async function fetchUserBookProgress(
  userId: string,
  bookId?: string
): Promise<UserBookProgress[]> {
  let query = supabase
    .from('user_book_progress')
    .select('*')
    .eq('user_id', userId)
    .order('last_read_at', { ascending: false });

  if (bookId) {
    query = query.eq('book_id', bookId);
  }

  // Without a bookId this feeds the library progress map. Progress is unique
  // per (user, book) and ordered by last_read_at desc, so if a user somehow
  // exceeds the cap we drop only their least-recently-read books — the ones
  // least likely to be on screen. 500 started books is a generous ceiling.
  const { data, error } = await query.limit(500);
  if (error) throw error;
  return (data ?? []).map(mapUserBookProgress);
}

export async function fetchInProgressBooks(
  userId: string,
  language: string
): Promise<{ book: ReadingBook; progress: UserBookProgress }[]> {
  const { data, error } = await supabase
    .from('user_book_progress')
    // Columns named explicitly, exactly as fetchBooksByLanguageAndLevel does.
    // `reading_books!inner(*)` pulled `content` too — averaging 235 kB per book
    // and peaking at 3.5 MB — so opening the reading tab downloaded roughly
    // 2.3 MB of JSON-escaped book text, and up to ~35 MB, to render a cover, a
    // title and a progress bar. `mapReadingBook` already defaults `content` to
    // '', so no caller changes.
    .select(
      '*, reading_books!inner(id, title, author, description, language, cefr_level, word_count, image_url, tags, source, source_id, chapter_breaks, is_published, created_at)',
    )
    .eq('user_id', userId)
    .gt('percent_complete', 0)
    .is('completed_at', null)
    .eq('reading_books.language', language)
    .order('last_read_at', { ascending: false })
    // Powers the "Continue Reading" rail — a small horizontal list of the
    // most recently read books. 10 most-recent is more than the UI shows.
    .limit(10);

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    book: mapReadingBook(row.reading_books as Record<string, unknown>),
    progress: mapUserBookProgress(row),
  }));
}

export async function fetchWritingSubmissionsByPrompt(
  userId: string,
  promptId: string
): Promise<WritingSubmission[]> {
  // Callers derive the max attempt number and the latest score, so fetch the
  // HIGHEST attempts (desc + limit keeps the newest 25 if a user somehow
  // exceeds the cap), then reverse to preserve the ascending-order contract.
  const { data, error } = await supabase
    .from('user_writing_submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('prompt_id', promptId)
    .order('attempt_number', { ascending: false })
    .limit(25);

  if (error) throw error;
  return (data ?? []).map(mapWritingSubmission).reverse();
}

export interface WritingSubmissionWithPrompt extends WritingSubmission {
  /** The writing prompt's text (writing_prompts has no separate title column). */
  promptTitle: string | null;
}

export async function fetchAllUserWritingSubmissions(
  userId: string,
  cefrLevel?: string
): Promise<WritingSubmissionWithPrompt[]> {
  let query = supabase
    .from('user_writing_submissions')
    .select('*, writing_prompts(prompt_text)')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(200);

  // Note: cefrLevel filtering requires a join; we'll filter client-side for simplicity
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...mapWritingSubmission(row),
    promptTitle:
      (row.writing_prompts as { prompt_text?: string | null } | null)?.prompt_text ?? null,
  }));
}

// ─── Reading Book Mappers ───────────────────────────────────────

function mapReadingBook(row: Record<string, unknown>): ReadingBook {
  return {
    id: row.id as string,
    source: row.source as ReadingBook['source'],
    sourceId: (row.source_id as string) ?? null,
    language: row.language as string,
    cefrLevel: row.cefr_level as string,
    title: row.title as string,
    author: (row.author as string) ?? null,
    description: (row.description as string) ?? null,
    content: (row.content as string) ?? '',
    wordCount: row.word_count as number,
    chapterBreaks: (row.chapter_breaks as number[]) ?? [],
    imageUrl: (row.image_url as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    isPublished: (row.is_published as boolean) ?? true,
    createdAt: row.created_at as string,
  };
}

function mapUserBookProgress(row: Record<string, unknown>): UserBookProgress {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    bookId: row.book_id as string,
    currentPosition: (row.current_position as number) ?? 0,
    currentChapter: (row.current_chapter as number) ?? 0,
    percentComplete: parseFloat(String(row.percent_complete)) || 0,
    timeSpentMs: (row.time_spent_ms as number) ?? 0,
    wordsLookedUp: (row.words_looked_up as number) ?? 0,
    completedAt: (row.completed_at as string) ?? null,
    lastReadAt: row.last_read_at as string,
  };
}

function mapBookAnnotation(row: Record<string, unknown>): BookAnnotation {
  return {
    id: row.id as string,
    bookId: row.book_id as string,
    wordOrPhrase: row.word_or_phrase as string,
    translation: row.translation as string,
    partOfSpeech: (row.part_of_speech as string) ?? null,
    audioUrl: (row.audio_url as string) ?? null,
  };
}

// ─── News Mapper ────────────────────────────────────────────────

function mapDailyNewsArticle(row: Record<string, unknown>): DailyNewsArticle {
  return {
    id: row.id as string,
    date: row.date as string,
    language: row.language as string,
    tier: (row.tier as string) ?? 'easy',
    cefrLevel: (row.cefr_level as string) ?? 'B1',
    title: row.title as string,
    titleTranslation: (row.title_translation as string) ?? null,
    summary: row.summary as string,
    content: row.content as string,
    contentTranslation: (row.content_translation as string) ?? null,
    vocabularyHighlights: (row.vocabulary_highlights as DailyNewsArticle['vocabularyHighlights']) ?? [],
    sourceTopic: (row.source_topic as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    createdAt: row.created_at as string,
    // Validated against the known set rather than cast: `audio_status` is a
    // CHECK-constrained column today, but a mapper that casts whatever
    // arrives is how an unexpected value reaches a switch statement in the
    // player and renders nothing at all.
    audioStatus: NEWS_AUDIO_STATUSES.includes(row.audio_status as string)
      ? (row.audio_status as NewsAudioStatus)
      : null,
    audioDurationMs: typeof row.audio_duration_ms === 'number' ? row.audio_duration_ms : null,
  };
}

/** The states `audio_status` may hold (migration 079). NULL — a row that
 *  predates the podcast feature — is deliberately absent: it maps to null. */
const NEWS_AUDIO_STATUSES = ['pending', 'generating', 'ready', 'failed'];

// ─── Avatar ─────────────────────────────────────────────────────


/**
 * Resolve a generated avatar's storage path to a displayable URL.
 *
 * The `avatars` bucket is private (migration 067) and readable only by the
 * owner, so this signs a short-lived URL rather than returning a public one.
 * Returns null when the object is gone — callers fall back to the procedural
 * avatar rather than rendering a broken image.
 */
export async function getAvatarImageUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.warn('[avatar] could not sign avatar URL:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Switch the account back to the procedural SVG avatar or a bundled preset. */
export async function setAvatarKind(
  userId: string,
  kind: 'procedural' | 'preset',
  presetId: string | null = null
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      avatar_kind: kind,
      avatar_preset_id: presetId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function fetchAvatarAccessories(): Promise<AvatarAccessory[]> {
  const { data, error } = await supabase
    .from('avatar_accessories')
    .select('*')
    .order('category', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    svgData: row.svg_data,
    unlockType: row.unlock_type,
    unlockRequirement: row.unlock_requirement,
  }));
}

export async function fetchUserUnlocks(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_avatar_unlocks')
    .select('accessory_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map(row => row.accessory_id);
}

export async function unlockAccessory(userId: string, accessoryId: string): Promise<void> {
  const { error } = await supabase
    .from('user_avatar_unlocks')
    .insert({ user_id: userId, accessory_id: accessoryId });
  if (error) throw error;
}

// ─── Grammar Rules ──────────────────────────────────────────────

export async function fetchGrammarRules(language: string, cefrLevel: string): Promise<GrammarRule[]> {
  const { data, error } = await supabase
    .from('grammar_rules')
    .select('*')
    .eq('language', language)
    .eq('cefr_level', cefrLevel)
    .order('rule_name');

  if (error) throw error;
  return (data ?? []).map(mapGrammarRule);
}

function mapGrammarRule(row: Record<string, unknown>): GrammarRule {
  return {
    id: row.id as string,
    language: row.language as string,
    cefrLevel: row.cefr_level as string,
    ruleName: row.rule_name as string,
    title: row.title as string,
    explanation: row.explanation as string,
    examples: row.examples as unknown[],
    commonErrors: row.common_errors as unknown[],
    tags: row.tags as string[],
    sourceId: (row.source_id as string) ?? null,
  };
}

// ─── Correction Log (exercise failures) ──────────────────────────
// The correction_log table (migration 026) is also written to by the
// ai-chat Edge Function (service-role). For exercise failures, we write
// client-side under the user's own RLS scope (migration 027 added the
// INSERT policy). See research.md §10 — Lyster & Ranta: every error the
// learner makes should be loggable so we can surface recurring mistakes
// in a weekly drill.

/**
 * Map FeedbackErrorType -> the correction_log.error_type enum. Note:
 *  - 'lexical' maps to 'vocabulary' (legacy column enum uses that term).
 *  - 'phonological' maps to 'other' because the CHECK constraint in
 *    migration 026 does NOT include 'phonological' and we must not alter
 *    that migration. See the swarm brief.
 */
function mapFeedbackErrorTypeToDbEnum(
  errorType: FeedbackErrorType
): CorrectionErrorType {
  switch (errorType) {
    case 'grammar':
      return 'grammar';
    case 'lexical':
      return 'vocabulary';
    case 'spelling':
      return 'spelling';
    case 'phonological':
      return 'other';
    default:
      return 'other';
  }
}

export async function logExerciseCorrection(params: {
  userId: string;
  exerciseId?: string | null;
  errorType: FeedbackErrorType;
  original: string;
  corrected: string;
  shortLabel: string;
  explanation?: string | null;
  severity?: CorrectionSeverity;
  targetLanguage?: string | null;
}): Promise<void> {
  const row = {
    user_id: params.userId,
    chat_session_id: null, // exercise writes are not tied to a chat session
    target_language: params.targetLanguage ?? null,
    error_type: mapFeedbackErrorTypeToDbEnum(params.errorType),
    severity: params.severity ?? 'minor',
    short_label: params.shortLabel.slice(0, 200),
    original: params.original.slice(0, 500),
    corrected: params.corrected.slice(0, 500),
    explanation: params.explanation ?? null,
    // We intentionally do NOT store exerciseId — the migration-026 table has
    // no such column. Callers pass it for potential future use (e.g. a
    // follow-up migration that adds an exercise_id column). Swallow here.
  };

  const { error } = await supabase.from('correction_log').insert(row);
  if (error) {
    // Fire-and-forget: log but do not surface to UI so a logging failure
    // never blocks the lesson.
    console.warn('[supabase-queries] logExerciseCorrection failed:', error.message);
  }
}

export interface WeeklyMistakeRow {
  shortLabel: string;
  count: number;
  errorType: string;
  latest: string;
}

/**
 * Aggregate this user's most-repeated short_labels from the last 7 days.
 * Used by the Review tab's "Top mistakes this week" drill (research.md §10).
 */
export async function fetchWeeklyTopMistakes(
  userId: string,
  limit = 5
): Promise<WeeklyMistakeRow[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Supabase-js doesn't natively expose GROUP BY; pull recent rows and
  // aggregate in-memory. The (user_id, short_label, created_at) index means
  // this is a narrow scan — volume is bounded by lesson failures per week.
  const { data, error } = await supabase
    .from('correction_log')
    .select('short_label, error_type, created_at')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .not('short_label', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500); // safety cap

  if (error) throw error;

  const grouped = new Map<string, WeeklyMistakeRow>();
  for (const row of data ?? []) {
    const shortLabel = (row as Record<string, unknown>).short_label as string | null;
    const errorType = ((row as Record<string, unknown>).error_type as string) ?? 'other';
    const createdAt = (row as Record<string, unknown>).created_at as string;
    if (!shortLabel) continue;

    const key = `${shortLabel}::${errorType}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      if (createdAt > existing.latest) existing.latest = createdAt;
    } else {
      grouped.set(key, { shortLabel, count: 1, errorType, latest: createdAt });
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => (b.count - a.count) || (b.latest.localeCompare(a.latest)))
    .slice(0, limit);
}

/**
 * Fetch up to `limit` exercises that match a weekly-mistake row so the
 * user can drill the specific skill. Match heuristic:
 *  1. `subskill = errorType` (exact, e.g. subskill = 'grammar'); OR
 *  2. `target_grammar ILIKE '%shortLabel%'`; OR
 *  3. `target_word ILIKE '%shortLabel%'`.
 *
 * Returns an empty array if no matches exist so the UI can degrade.
 */
export async function fetchDrillExercises(params: {
  shortLabel: string;
  errorType: string;
  limit?: number;
}): Promise<Exercise[]> {
  const { shortLabel, errorType } = params;
  const limit = params.limit ?? 3;

  const cleanLabel = shortLabel.replace(/[%_]/g, ' ').trim();
  const patterns = [
    `target_grammar.ilike.%${cleanLabel}%`,
    `target_word.ilike.%${cleanLabel}%`,
    `subskill.eq.${errorType}`,
  ];

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .or(patterns.join(','))
    .limit(limit);

  if (error) {
    console.warn('[fetchDrillExercises] query failed:', error.message);
    return [];
  }
  return (data ?? []).map(mapExercise);
}

// ─── Content Sources ────────────────────────────────────────────

export async function fetchContentSources(): Promise<ContentSource[]> {
  const { data, error } = await supabase
    .from('content_sources')
    .select('*')
    .order('name');

  if (error) throw error;
  return (data ?? []).map(mapContentSource);
}

export async function upsertContentSource(source: Omit<ContentSource, 'id' | 'createdAt'>): Promise<ContentSource> {
  const { data, error } = await supabase
    .from('content_sources')
    .upsert({
      name: source.name,
      url: source.url,
      license: source.license,
      attribution: source.attribution,
      description: source.description,
      last_imported_at: source.lastImportedAt,
    }, { onConflict: 'name' })
    .select()
    .single();

  if (error) throw error;
  return mapContentSource(data);
}

function mapContentSource(row: Record<string, unknown>): ContentSource {
  return {
    id: row.id as string,
    name: row.name as string,
    url: (row.url as string) ?? null,
    license: row.license as string,
    attribution: (row.attribution as string) ?? null,
    description: (row.description as string) ?? null,
    lastImportedAt: (row.last_imported_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ─── Cards by Language & Level ──────────────────────────────────

export async function fetchCardsByLanguageAndLevel(
  language: string,
  cefrLevel: string,
  skillType?: SkillType
): Promise<Card[]> {
  let query = supabase
    .from('cards')
    .select('*')
    .eq('language', language)
    .eq('cefr_level', cefrLevel);

  if (skillType) {
    query = query.eq('skill_type', skillType);
  }

  const { data, error } = await query.order('frequency_rank', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(mapCard);
}

// ─── Chat History Persistence ────────────────────────────────────

export interface ChatSession {
  id: string;
  userId: string;
  scenarioKey: string;
  targetLanguage: string;
  level: string;
  createdAt: string;
  updatedAt: string;
}

/** Find or create a chat session for a given scenario. */
export async function getOrCreateChatSession(
  userId: string,
  scenarioKey: string,
  targetLanguage: string,
  level: string
): Promise<ChatSession> {
  // Try to find an existing session for this scenario
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('scenario_key', scenarioKey)
    .eq('target_language', targetLanguage)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return mapChatSession(existing);
  }

  // Create a new session
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      scenario_key: scenarioKey,
      target_language: targetLanguage,
      level,
    })
    .select()
    .single();

  if (error) throw error;
  return mapChatSession(data);
}

/** Save a chat message to a session. The `correction` column is TEXT; rich
 *  CorrectionDetail objects are JSON-stringified on write and re-parsed via
 *  normalizeCorrection() on read. */
export async function saveChatMessage(
  sessionId: string,
  message: Pick<ConversationMessage, 'role' | 'content' | 'correction' | 'audioUrl'>
): Promise<void> {
  let correctionValue: string | null = null;
  if (message.correction != null) {
    correctionValue =
      typeof message.correction === 'string'
        ? message.correction
        : JSON.stringify(message.correction);
  }
  const { error } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: message.role,
    content: message.content,
    correction: correctionValue,
    audio_url: message.audioUrl ?? null,
  });

  if (error) throw error;

  // Touch session updated_at
  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

/** Load chat messages for a session. Legacy string corrections and new
 *  JSON-stringified CorrectionDetail objects are both handled — the client's
 *  normalizeCorrection() is called at the render layer. */
/** Most recent messages kept for a conversation. See loadChatMessages. */
export const CHAT_HISTORY_LIMIT = 100;

export async function loadChatMessages(sessionId: string): Promise<ConversationMessage[]> {
  // Bounded, and newest-first so the limit takes the RECENT end of the
  // conversation rather than the oldest hundred.
  //
  // `getOrCreateChatSession` reuses the newest session per (user, scenario,
  // language) forever, so a single scenario accumulates without limit — this
  // was the one live user-growable read in the file with no `.limit()`, which
  // CLAUDE.md requires. The model context is already capped at 24 messages;
  // only the fetch and the render were unbounded.
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(CHAT_HISTORY_LIMIT);

  if (error) throw error;
  // Restore chronological order for rendering.
  return (data ?? []).reverse().map((row: Record<string, unknown>) => ({
    id: row.id as string,
    role: row.role as 'user' | 'assistant' | 'system',
    content: row.content as string,
    correction: (row.correction as string) ?? null,
    audioUrl: (row.audio_url as string) ?? null,
    timestamp: row.created_at as string,
  }));
}

/**
 * Is this learner already studying this exact text in this language?
 *
 * There is no content dedupe in this schema: every save inserts a fresh
 * `cards` row, and the UNIQUE(user_id, card_id) on `review_items` never fires
 * because the card is new each time. Saving the same word twice therefore
 * produces two cards with two independent SM-2 schedules, and the learner
 * reviews one word forever on two clocks.
 *
 * Backed by idx_cards_user_language_text (migration 095). Fails open — a
 * duplicate is a much smaller problem than a save that silently does nothing
 * because the lookup errored.
 */
async function findExistingLearnerCard(
  userId: string,
  language: string,
  targetText: string
): Promise<string | null> {
  const trimmed = targetText.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('cards')
    .select('id')
    .eq('user_id', userId)
    .eq('language', language)
    .ilike('target_text', trimmed)
    .limit(1);
  if (error) {
    console.warn('[cards] duplicate check failed, inserting anyway:', error.message);
    return null;
  }
  return data && data.length > 0 ? (data[0].id as string) : null;
}

/** Save a correction as an SRS card so the user can review it later.
 *  Uses the corrected phrase as target_text and the explanation/shortLabel
 *  as native_text. Creates both the card and a fresh review_item.
 *
 *  The card is filed with no course: a learner can be corrected in a language
 *  we publish no course for. `cards.course_id` was NOT NULL until migration
 *  088 — which is one of the two reasons this function had never once
 *  succeeded (the other being the missing INSERT policy). */
export async function saveCorrectionAsCard(params: {
  userId: string;
  targetLanguage: string;
  original: string;
  corrected: string;
  shortLabel: string;
  explanation: string;
  /** CEFR band to file the card under. Without it the card is invisible to
   *  `analyzeBands`, which skips items with a null `cefr_level` — the card
   *  would exist, be reviewed, and still never count toward the learner's own
   *  measured vocabulary. Optional so existing callers keep compiling, but
   *  every caller should pass it. */
  cefrLevel?: string | null;
}): Promise<{ cardId: string } | null> {
  const { userId, targetLanguage, original, corrected, shortLabel, explanation, cefrLevel } =
    params;
  if (!corrected.trim()) return null;

  // Already saved this exact correction — nothing to do, and no slot to spend.
  const existing = await findExistingLearnerCard(userId, targetLanguage, corrected);
  if (existing) return { cardId: existing };

  // Enforce the 20-new-cards/day cap — atomic check-and-consume
  // (migration 044). Return null (silent skip) rather than throwing —
  // the correction was still logged to correction_log, and the UX
  // shouldn't break on a rate-limit.
  if (!(await tryConsumeNewCardSlot())) {
    return null;
  }

  // Native text prefers shortLabel (concise) but falls back to explanation.
  const nativeText = shortLabel.trim() || explanation.trim().slice(0, 200) || 'Correction';

  const { data: card, error: cardErr } = await supabase
    .from('cards')
    .insert({
      // Required by the INSERT policy (migration 088).
      user_id: userId,
      course_id: null,
      unit_id: null,
      native_text: nativeText,
      target_text: corrected,
      example_sentence: original || null,
      audio_url: null,
      image_url: null,
      part_of_speech: null,
      tags: ['correction', 'chat'],
      language: targetLanguage,
      // Files the card in a band so it counts toward measured vocabulary.
      cefr_level: cefrLevel ?? null,
      skill_type: 'grammar',
      source_type: 'manual',
    })
    .select('id')
    .single();

  if (cardErr) throw cardErr;

  const { error: riErr } = await supabase
    .from('review_items')
    .upsert(
      {
        user_id: userId,
        card_id: card.id,
        ease_factor: 2.5,
        interval: 1,
        repetitions: 0,
        next_due: new Date().toISOString(),
        last_reviewed_at: null,
        status: 'new',
      },
      { onConflict: 'user_id,card_id' }
    );

  if (riErr) throw riErr;

  return { cardId: card.id };
}

/** List recent chat sessions for a user. */
export async function listChatSessions(
  userId: string,
  limit = 20
): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapChatSession);
}

function mapChatSession(row: Record<string, unknown>): ChatSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    scenarioKey: row.scenario_key as string,
    targetLanguage: row.target_language as string,
    level: row.level as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── School System ──────────────────────────────────────────────

function mapOrganization(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    logoUrl: (row.logo_url as string) ?? null,
    isActive: (row.is_active as boolean) ?? true,
    maxSeats: (row.max_seats as number) ?? 0,
    contractConfig: (row.contract_config as SchoolContractConfig) ?? {
      dailyVoiceMinutes: 0,
      dailyTextMessages: 0,
      dailyWritingGrades: 0,
      dailyPronunciationScores: 0,
      dailyNewCards: 0,
      audiobookNarration: false,
    },
    contractStart: (row.contract_start as string) ?? null,
    contractEnd: (row.contract_end as string) ?? null,
  };
}

function mapClassroom(row: Record<string, unknown>): Classroom {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    teacherId: row.teacher_id as string,
    name: row.name as string,
    targetLanguage: row.target_language as LanguageCode,
    level: row.level as ProficiencyLevel,
    inviteCode: row.invite_code as string,
    inviteCodeActive: (row.invite_code_active as boolean) ?? true,
    maxStudents: (row.max_students as number) ?? 30,
    archived: (row.archived as boolean) ?? false,
    studentCount: (row.student_count as number) ?? undefined,
    activeAssignmentCount: (row.active_assignment_count as number) ?? undefined,
  };
}

function mapEnrollment(row: Record<string, unknown>): ClassEnrollment {
  return {
    id: row.id as string,
    classroomId: row.classroom_id as string,
    studentId: row.student_id as string,
    enrolledAt: row.enrolled_at as string,
    droppedAt: (row.dropped_at as string) ?? null,
    classroom: row.classrooms ? mapClassroom(row.classrooms as Record<string, unknown>) : undefined,
  };
}

function mapAssignment(row: Record<string, unknown>): Assignment {
  return {
    id: row.id as string,
    classroomId: row.classroom_id as string,
    teacherId: row.teacher_id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    status: row.status as Assignment['status'],
    scenarioKey: (row.scenario_key as string) ?? null,
    customScenario: (row.custom_scenario as Assignment['customScenario']) ?? null,
    targetLanguage: row.target_language as LanguageCode,
    level: row.level as ProficiencyLevel,
    minDurationMinutes: (row.min_duration_minutes as number) ?? 5,
    mode: (row.mode as Assignment['mode']) ?? 'either',
    vocabularyFocus: (row.vocabulary_focus as string[]) ?? [],
    grammarFocus: (row.grammar_focus as string[]) ?? [],
    instructions: (row.instructions as string) ?? '',
    publishedAt: (row.published_at as string) ?? null,
    dueAt: (row.due_at as string) ?? null,
    lateSubmissionAllowed: (row.late_submission_allowed as boolean) ?? false,
    maxPoints: (row.max_points as number) ?? 100,
    submissionCount: (row.submission_count as number) ?? undefined,
    completionRate: (row.completion_rate as number) ?? undefined,
    classroomName: (row.classroom_name as string) ?? undefined,
  };
}

function mapSubmission(row: Record<string, unknown>): AssignmentSubmission {
  return {
    id: row.id as string,
    assignmentId: row.assignment_id as string,
    studentId: row.student_id as string,
    status: row.status as SubmissionStatus,
    startedAt: (row.started_at as string) ?? null,
    submittedAt: (row.submitted_at as string) ?? null,
    chatSessionId: (row.chat_session_id as string) ?? null,
    conversationDurationMinutes: (row.conversation_duration_minutes as number) ?? null,
    autoScore: (row.auto_score as number) ?? null,
    teacherScore: (row.teacher_score as number) ?? null,
    finalScore: (row.final_score as number) ?? null,
    teacherFeedback: (row.teacher_feedback as string) ?? null,
    aiFeedback: (row.ai_feedback as ConversationGrade) ?? null,
    isLate: (row.is_late as boolean) ?? false,
    gradedAt: (row.graded_at as string) ?? null,
    studentName: (row.student_name as string) ?? ((row.user_profiles as Record<string, unknown>)?.display_name as string) ?? undefined,
  };
}

// ─── School: User Roles ─────────────────────────────────────────

export async function fetchUserRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.role as string);
}

// ─── School: Teacher Queries ────────────────────────────────────

export async function fetchTeacherClassrooms(userId: string): Promise<Classroom[]> {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .eq('teacher_id', userId)
    .eq('archived', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapClassroom);
}

/**
 * Ceiling on a single classroom roster read.
 *
 * A university lecture cohort is routinely 200-300, so this is deliberately
 * above any real classroom rather than a page size — the roster UI does not
 * paginate. It exists because CLAUDE.md requires a bound on every
 * user-growable read, and because an unbounded roster is the query that first
 * hurts when a pilot actually lands.
 */
export const CLASSROOM_ROSTER_LIMIT = 500;

export async function fetchClassroomStudents(
  classroomId: string
): Promise<{ id: string; studentId: string; displayName: string; enrolledAt: string }[]> {
  const { data, error } = await supabase
    .from('classroom_enrollments')
    .select('id, student_id, enrolled_at, user_profiles!inner(display_name)')
    .eq('classroom_id', classroomId)
    .is('dropped_at', null)
    .order('enrolled_at', { ascending: true })
    .limit(CLASSROOM_ROSTER_LIMIT);

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    studentId: row.student_id as string,
    displayName: ((row.user_profiles as Record<string, unknown>)?.display_name as string) ?? 'Unknown',
    enrolledAt: row.enrolled_at as string,
  }));
}

export async function fetchOrganizationById(organizationId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapOrganization(data) : null;
}

export async function fetchTeacherOrganization(userId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organizations(*)')
    .eq('user_id', userId)
    .in('org_role', ['teacher', 'admin'])
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data?.organizations) return null;
  return mapOrganization(data.organizations as unknown as Record<string, unknown>);
}

/**
 * One assignment by id.
 *
 * Two screens used to find an assignment by walking every classroom the
 * teacher owns and calling `fetchClassroomAssignments` on each, in a SERIAL
 * loop, until the id turned up — up to eight sequential round trips to open one
 * row whose primary key was already in hand.
 *
 * RLS already restricts assignments to the teacher who owns them (and to
 * enrolled students), so fetching by id directly grants nothing extra.
 * `maybeSingle` so a missing or invisible id is `null` rather than an error.
 */
export async function fetchAssignmentById(assignmentId: string): Promise<Assignment | null> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapAssignment(data) : null;
}

export async function fetchClassroomAssignments(classroomId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false })
    // A classroom accumulates assignments across a term; the UI shows a list,
    // not an archive.
    .limit(200);

  if (error) throw error;
  return (data ?? []).map(mapAssignment);
}

export async function fetchAssignmentSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*, user_profiles!inner(display_name)')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    // One row per enrolled student, so this is bounded by the roster.
    .limit(CLASSROOM_ROSTER_LIMIT);

  if (error) throw error;
  return (data ?? []).map(mapSubmission);
}

export async function fetchSubmissionDetail(submissionId: string): Promise<AssignmentSubmission | null> {
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapSubmission(data) : null;
}

export async function fetchSubmissionTranscript(chatSessionId: string): Promise<ConversationMessage[]> {
  return loadChatMessages(chatSessionId);
}

export interface PendingGradeItem {
  submission: AssignmentSubmission;
  assignmentId: string;
  assignmentTitle: string;
  assignmentKind: 'conversation' | 'lesson' | 'writing';
  classroomId: string;
  classroomName: string;
  studentName: string;
}

/**
 * Unified teacher grade queue — all submissions across the teacher's classes
 * that are `submitted` but not yet teacher-graded. Oldest first.
 */
export async function fetchTeacherGradeQueue(teacherId: string): Promise<PendingGradeItem[]> {
  const classrooms = await fetchTeacherClassrooms(teacherId);
  if (classrooms.length === 0) return [];
  const classroomById = new Map(classrooms.map((c) => [c.id, c]));
  const classroomIds = classrooms.map((c) => c.id);

  const { data: assignments, error: aErr } = await supabase
    .from('assignments')
    .select('id, classroom_id, title, kind')
    .in('classroom_id', classroomIds);
  if (aErr) throw aErr;
  const assignmentById = new Map<string, { id: string; classroomId: string; title: string; kind: string }>();
  (assignments ?? []).forEach((a) => {
    assignmentById.set(a.id as string, {
      id: a.id as string,
      classroomId: a.classroom_id as string,
      title: a.title as string,
      kind: (a.kind as string) ?? 'conversation',
    });
  });
  if (assignmentById.size === 0) return [];

  const { data: submissions, error: sErr } = await supabase
    .from('assignment_submissions')
    .select('*, user_profiles!inner(display_name)')
    .in('assignment_id', Array.from(assignmentById.keys()))
    .eq('status', 'submitted')
    .is('teacher_score', null)
    .order('submitted_at', { ascending: true });
  if (sErr) throw sErr;

  return (submissions ?? []).map((row) => {
    const a = assignmentById.get(row.assignment_id as string)!;
    const classroom = classroomById.get(a.classroomId);
    return {
      submission: mapSubmission(row),
      assignmentId: a.id,
      assignmentTitle: a.title,
      assignmentKind: a.kind as 'conversation' | 'lesson' | 'writing',
      classroomId: a.classroomId,
      classroomName: classroom?.name ?? 'Unknown class',
      studentName: ((row.user_profiles as Record<string, unknown>)?.display_name as string) ?? 'Student',
    };
  });
}

/**
 * CSV export of all submissions for a classroom. Returns a CSV string with
 * headers student,email,assignment,kind,status,final_score,max_points,submitted_at.
 * Generated client-side against the service-role-scoped read path.
 */
export async function exportClassroomGradebookCsv(classroomId: string): Promise<string> {
  const { data: assignments, error: aErr } = await supabase
    .from('assignments')
    .select('id, title, kind, max_points')
    .eq('classroom_id', classroomId);
  if (aErr) throw aErr;
  if (!assignments || assignments.length === 0) return 'student,email,assignment,kind,status,final_score,max_points,submitted_at\n';

  const assignmentIds = assignments.map((a) => a.id as string);
  const { data: submissions, error: sErr } = await supabase
    .from('assignment_submissions')
    .select(`
      *,
      user_profiles!inner(display_name, user_id)
    `)
    .in('assignment_id', assignmentIds);
  if (sErr) throw sErr;

  // Fetch emails via auth.users is not available client-side; skip and
  // leave email column blank — teachers who need emails should use CSV
  // import flow instead. (FERPA-safer default.)

  const assignmentById = new Map(
    (assignments ?? []).map((a) => [a.id as string, a]),
  );

  const rows: string[] = ['student,email,assignment,kind,status,final_score,max_points,submitted_at'];
  const esc = (s: string | number | null | undefined) => {
    if (s == null) return '';
    const str = String(s);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  for (const row of submissions ?? []) {
    const a = assignmentById.get(row.assignment_id as string);
    if (!a) continue;
    const profile = row.user_profiles as Record<string, unknown>;
    rows.push([
      esc((profile?.display_name as string) ?? ''),
      '',
      esc(a.title as string),
      esc((a.kind as string) ?? 'conversation'),
      esc(row.status as string),
      esc((row.final_score as number) ?? (row.auto_score as number) ?? ''),
      esc((a.max_points as number) ?? 100),
      esc(row.submitted_at as string),
    ].join(','));
  }
  return rows.join('\n');
}

// ─── School: Student Queries ────────────────────────────────────

export async function fetchStudentEnrollments(userId: string): Promise<ClassEnrollment[]> {
  const { data, error } = await supabase
    .from('classroom_enrollments')
    .select('*, classrooms(*)')
    .eq('student_id', userId)
    .is('dropped_at', null);

  if (error) throw error;
  return (data ?? []).map(mapEnrollment);
}

export async function fetchStudentAssignments(
  userId: string
): Promise<(Assignment & { submission?: AssignmentSubmission })[]> {
  // Get classrooms the student is enrolled in
  const { data: enrollments, error: enrollErr } = await supabase
    .from('classroom_enrollments')
    .select('classroom_id')
    .eq('student_id', userId)
    .is('dropped_at', null);

  if (enrollErr) throw enrollErr;
  const classroomIds = (enrollments ?? []).map((e) => e.classroom_id as string);
  if (classroomIds.length === 0) return [];

  // Fetch published assignments for those classrooms
  const { data: assignments, error: assignErr } = await supabase
    .from('assignments')
    .select('*')
    .in('classroom_id', classroomIds)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (assignErr) throw assignErr;
  if (!assignments || assignments.length === 0) return [];

  // Fetch submissions for this student
  const assignmentIds = assignments.map((a) => a.id as string);
  const { data: submissions, error: subErr } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('student_id', userId)
    .in('assignment_id', assignmentIds);

  if (subErr) throw subErr;

  const submissionMap = new Map<string, AssignmentSubmission>();
  (submissions ?? []).forEach((row) => {
    submissionMap.set(row.assignment_id as string, mapSubmission(row));
  });

  return assignments.map((row) => ({
    ...mapAssignment(row),
    submission: submissionMap.get(row.id as string),
  }));
}

// ─── School: Edge Function Callers ──────────────────────────────

export async function callSchoolAction(action: string, body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('school', {
    body: { action, ...body },
  });
  if (error) throw error;
  return data;
}

export async function claimTeacherRole(): Promise<{ organizationId: string }> {
  const result = await callSchoolAction('claim-teacher-role', {});
  return { organizationId: result.organizationId as string };
}

export async function createClassroom(data: {
  name: string;
  targetLanguage: string;
  level: string;
  organizationId?: string;
}): Promise<Classroom> {
  const result = await callSchoolAction('create-classroom', data);
  return mapClassroom(result.classroom);
}

export async function linkLessonToAssignments(
  lessonId: string,
  lessonCompletionId: string,
  score?: number,
): Promise<{ linked: string[] }> {
  const result = await callSchoolAction('link-lesson-submission', {
    lessonId,
    lessonCompletionId,
    ...(typeof score === 'number' ? { score } : {}),
  });
  return { linked: (result?.linked as string[]) ?? [] };
}

export async function linkWritingToAssignments(
  writingSubmissionId: string,
  promptId?: string | null,
  score?: number,
): Promise<{ linked: string[] }> {
  const result = await callSchoolAction('link-writing-submission', {
    writingSubmissionId,
    ...(promptId ? { promptId } : {}),
    ...(typeof score === 'number' ? { score } : {}),
  });
  return { linked: (result?.linked as string[]) ?? [] };
}

export async function joinClassroom(inviteCode: string): Promise<ClassEnrollment> {
  const result = await callSchoolAction('join-classroom', { inviteCode });
  return mapEnrollment(result.enrollment);
}

export async function leaveClassroom(classroomId: string): Promise<void> {
  await callSchoolAction('leave-classroom', { classroomId });
}

export async function createAssignment(data: Record<string, unknown>): Promise<Assignment> {
  const result = await callSchoolAction('create-assignment', data);
  return mapAssignment(result.assignment);
}

export async function startAssignment(
  assignmentId: string
): Promise<{ submission: AssignmentSubmission; chatSessionId: string }> {
  const result = await callSchoolAction('start-assignment', { assignmentId });
  return {
    submission: mapSubmission(result.submission),
    chatSessionId: result.chatSessionId as string,
  };
}

export async function submitAssignment(assignmentId: string): Promise<AssignmentSubmission> {
  const result = await callSchoolAction('submit-assignment', { assignmentId });
  return mapSubmission(result.submission);
}

export async function gradeSubmission(
  submissionId: string,
  teacherScore: number,
  teacherFeedback: string
): Promise<AssignmentSubmission> {
  const result = await callSchoolAction('grade-submission', {
    submissionId,
    teacherScore,
    teacherFeedback,
  });
  return mapSubmission(result.submission);
}

// ─── School: Admin Queries ──────────────────────────────────────

export async function fetchAuditLogs(
  organizationId: string,
  opts?: { action?: string; limit?: number }
): Promise<any[]> {
  let query = supabase
    .from('audit_log')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.action) {
    query = query.eq('action', opts.action);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    actorRole: row.actor_role,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    ipAddress: row.ip_address,
  }));
}

export async function callSchoolAdminAction(action: string, body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('school-admin', {
    body: { action, ...body },
  });
  if (error) throw error;
  return data;
}

// ─── AI Content Reports ──────────────────────────────────────────
// In-app flagging of offensive/harmful AI output (migration 053).
// Google Play's generative-AI policy requires this mechanism to exist in
// the app and to feed content filtering. Reports are append-only.

export type AiReportSurface =
  | 'chat' | 'writing' | 'voice' | 'reading' | 'story' | 'hint' | 'news';

export type AiReportReason =
  | 'offensive' | 'harmful' | 'sexual' | 'inaccurate' | 'nonsense' | 'other';

/** Max stored length of the reported output — mirrors the CHECK in migration 053. */
const MAX_REPORTED_CONTENT = 4000;

export async function reportAiContent(params: {
  surface: AiReportSurface;
  reason: AiReportReason;
  content: string;
  comment?: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in to report content');

  const { error } = await supabase.from('ai_content_reports').insert({
    user_id: user.id,
    surface: params.surface,
    reason: params.reason,
    reported_content: params.content.slice(0, MAX_REPORTED_CONTENT),
    user_comment: params.comment?.slice(0, 1000) ?? null,
    context: params.context ?? {},
  });
  if (error) throw error;
}
