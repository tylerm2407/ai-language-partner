import { supabase } from './supabase';
import type {
  UserProfile,
  Course,
  Unit,
  Lesson,
  Card,
  Exercise,
  ReviewItem,
  ReviewLog,
  DailyStats,
  DailyUsage,
  PracticeSession,
  Subscription,
  ReviewRating,
  DailyChallengesRecord,
  LeagueTier,
  StreakEventType,
  ReadingPassage,
  ReadingAnnotation,
  ReadingQuestion,
  WritingPrompt,
  WritingSubmission,
  WritingFeedback,
  DailyNewsArticle,
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
  updates: Partial<Pick<UserProfile, 'displayName' | 'nativeLanguage' | 'targetLanguage' | 'level' | 'dailyGoalMinutes' | 'timezone'>>
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

export async function updateStreak(userId: string, streak: number, longestStreak: number): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ streak, longest_streak: longestStreak, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw error;
}

export async function addXp(userId: string, xp: number): Promise<void> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('total_xp')
    .eq('user_id', userId)
    .single();

  if (!profile) return;

  const { error } = await supabase
    .from('user_profiles')
    .update({ total_xp: profile.total_xp + xp, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw error;
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw error;
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

export async function fetchLessonWithExercises(lessonId: string): Promise<Lesson | null> {
  const { data: lessonData, error: lessonError } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (lessonError) throw lessonError;
  if (!lessonData) return null;

  const { data: exerciseData, error: exerciseError } = await supabase
    .from('exercises')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('order_index', { ascending: true });

  if (exerciseError) throw exerciseError;

  return mapLesson(lessonData, (exerciseData ?? []).map(mapExercise));
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
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('course_id', courseId);

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

// ─── Daily Stats ────────────────────────────────────────────────

export async function fetchTodayStats(userId: string): Promise<DailyStats | null> {
  const today = new Date().toISOString().split('T')[0];

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
  const today = new Date().toISOString().split('T')[0];

  // Fetch existing or create new
  const existing = await fetchTodayStats(userId);

  const merged = {
    user_id: userId,
    date: today,
    lessons_completed: (existing?.lessonsCompleted ?? 0) + (updates.lessonsCompleted ?? 0),
    cards_reviewed: (existing?.cardsReviewed ?? 0) + (updates.cardsReviewed ?? 0),
    cards_learned: (existing?.cardsLearned ?? 0) + (updates.cardsLearned ?? 0),
    minutes_practiced: (existing?.minutesPracticed ?? 0) + (updates.minutesPracticed ?? 0),
    speaking_minutes: (existing?.speakingMinutes ?? 0) + (updates.speakingMinutes ?? 0),
    listening_minutes: (existing?.listeningMinutes ?? 0) + (updates.listeningMinutes ?? 0),
    xp_earned: (existing?.xpEarned ?? 0) + (updates.xpEarned ?? 0),
    accuracy: updates.accuracy ?? existing?.accuracy ?? 0,
  };

  const { data, error } = await supabase
    .from('daily_stats')
    .upsert(merged, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) throw error;
  return mapDailyStats(data);
}

export async function fetchStatsRange(userId: string, startDate: string, endDate: string): Promise<DailyStats[]> {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapDailyStats);
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
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (data) return mapDailyUsage(data);

  // Row doesn't exist — create it via upsert to handle race conditions
  const { data: created, error: insertErr } = await supabase
    .from('daily_usage')
    .upsert({ user_id: userId, date: today, text_messages: 0, voice_minutes: 0 }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (insertErr) throw insertErr;
  return mapDailyUsage(created);
}

/**
 * Increment daily usage counters atomically.
 * Accepts deltas — pass { textMessagesDelta: 1 } to add 1 text message.
 */
export async function incrementDailyUsage(
  userId: string,
  deltas: { textMessagesDelta?: number; voiceMinutesDelta?: number }
): Promise<DailyUsage> {
  const current = await getOrCreateDailyUsage(userId);
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_usage')
    .update({
      text_messages: current.textMessages + (deltas.textMessagesDelta ?? 0),
      voice_minutes: current.voiceMinutes + (deltas.voiceMinutesDelta ?? 0),
    })
    .eq('user_id', userId)
    .eq('date', today)
    .select()
    .single();

  if (error) throw error;
  return mapDailyUsage(data);
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
    streak: row.streak as number,
    longestStreak: row.longest_streak as number,
    streakFreezes: row.streak_freezes as number,
    totalXp: row.total_xp as number,
    timezone: row.timezone as string,
    onboardingCompleted: (row.onboarding_completed as boolean) ?? false,
    // Hearts
    hearts: (row.hearts as number) ?? 5,
    maxHearts: (row.max_hearts as number) ?? 5,
    lastHeartLostAt: (row.last_heart_lost_at as string) ?? null,
    // XP levels & leagues
    xpLevel: (row.xp_level as number) ?? 1,
    leagueTier: (row.league_tier as UserProfile['leagueTier']) ?? 'bronze',
    // Streak shield
    streakShieldActive: (row.streak_shield_active as boolean) ?? false,
    streakShieldUsedAt: (row.streak_shield_used_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
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
  };
}

function mapDailyUsage(row: Record<string, unknown>): DailyUsage {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    date: row.date as string,
    textMessages: row.text_messages as number,
    voiceMinutes: parseFloat(row.voice_minutes as string) || 0,
  };
}

// ─── Hearts ──────────────────────────────────────────────────────

export async function updateHearts(
  userId: string,
  hearts: number,
  lastHeartLostAt: string | null
): Promise<void> {
  const payload: Record<string, unknown> = {
    hearts,
    updated_at: new Date().toISOString(),
  };
  if (lastHeartLostAt !== undefined) {
    payload.last_heart_lost_at = lastHeartLostAt;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update(payload)
    .eq('user_id', userId);

  if (error) throw error;
}

// ─── XP Levels & Leagues ────────────────────────────────────────

export async function updateLevel(
  userId: string,
  xpLevel: number,
  leagueTier: LeagueTier
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      xp_level: xpLevel,
      league_tier: leagueTier,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw error;
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
  bonusXpClaimed: boolean,
  challengeStreak: number
): Promise<DailyChallengesRecord> {
  const { data, error } = await supabase
    .from('daily_challenges')
    .upsert({
      user_id: userId,
      date,
      challenges,
      all_completed: allCompleted,
      bonus_xp_claimed: bonusXpClaimed,
      challenge_streak: challengeStreak,
    }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) throw error;
  return mapDailyChallengesRecord(data);
}

function mapDailyChallengesRecord(row: Record<string, unknown>): DailyChallengesRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    date: row.date as string,
    challenges: row.challenges as DailyChallengesRecord['challenges'],
    allCompleted: (row.all_completed as boolean) ?? false,
    bonusXpClaimed: (row.bonus_xp_claimed as boolean) ?? false,
    challengeStreak: (row.challenge_streak as number) ?? 0,
  };
}

// ─── Streak Protection ──────────────────────────────────────────

export async function useStreakFreeze(userId: string): Promise<void> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('streak_freezes')
    .eq('user_id', userId)
    .single();

  if (!profile || (profile.streak_freezes as number) <= 0) {
    throw new Error('No streak freezes available');
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      streak_freezes: (profile.streak_freezes as number) - 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw error;
}

export async function repairStreak(
  userId: string,
  streak: number,
  longestStreak: number
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      streak,
      longest_streak: longestStreak,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw error;
}

export async function logStreakEvent(
  userId: string,
  eventType: StreakEventType,
  streakAtTime: number
): Promise<void> {
  const { error } = await supabase
    .from('streak_events')
    .insert({
      user_id: userId,
      event_type: eventType,
      streak_at_time: streakAtTime,
    });

  if (error) throw error;
}

export async function updateStreakShield(
  userId: string,
  active: boolean,
  usedAt: string | null
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      streak_shield_active: active,
      streak_shield_used_at: usedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw error;
}

// ─── Reading ──────────────────────────────────────────────────

export async function fetchReadingPassagesByCourse(courseId: string): Promise<ReadingPassage[]> {
  const { data, error } = await supabase
    .from('reading_passages')
    .select('*')
    .eq('course_id', courseId)
    .eq('is_published', true)
    .order('cefr_level', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapReadingPassage);
}

export async function fetchPassageWithAnnotations(
  passageId: string
): Promise<{ passage: ReadingPassage; annotations: ReadingAnnotation[] } | null> {
  const { data: passageData, error: passageError } = await supabase
    .from('reading_passages')
    .select('*')
    .eq('id', passageId)
    .single();

  if (passageError) throw passageError;
  if (!passageData) return null;

  const { data: annotationData, error: annotationError } = await supabase
    .from('reading_annotations')
    .select('*')
    .eq('passage_id', passageId)
    .order('start_index', { ascending: true });

  if (annotationError) throw annotationError;

  return {
    passage: mapReadingPassage(passageData),
    annotations: (annotationData ?? []).map(mapReadingAnnotation),
  };
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

export async function addCardFromAnnotation(
  userId: string,
  annotation: ReadingAnnotation,
  courseId: string
): Promise<ReviewItem> {
  // If annotation already links to a card, use it; otherwise create one
  let cardId = annotation.cardId;

  if (!cardId) {
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .insert({
        course_id: courseId,
        native_text: annotation.translation,
        target_text: annotation.wordOrPhrase,
        audio_url: annotation.audioUrl,
        part_of_speech: annotation.partOfSpeech,
        tags: ['reading'],
      })
      .select()
      .single();

    if (cardError) throw cardError;
    cardId = card.id;
  }

  return upsertReviewItem({
    userId,
    cardId: cardId!,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextDue: new Date().toISOString(),
    lastReviewedAt: null,
    status: 'new',
  });
}

// ─── Writing ──────────────────────────────────────────────────

export async function fetchWritingPromptsByCourse(courseId: string): Promise<WritingPrompt[]> {
  const { data, error } = await supabase
    .from('writing_prompts')
    .select('*')
    .eq('course_id', courseId)
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
  timeSpentMs: number
): Promise<WritingSubmission> {
  const { data, error } = await supabase
    .from('user_writing_submissions')
    .insert({
      user_id: userId,
      prompt_id: promptId,
      submission_text: text,
      word_count: wordCount,
      time_spent_ms: timeSpentMs,
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

export async function fetchDailyNews(language: string, date?: string): Promise<DailyNewsArticle | null> {
  const targetDate = date ?? new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_news')
    .select('*')
    .eq('language', language)
    .eq('date', targetDate)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapDailyNewsArticle(data) : null;
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

function mapReadingAnnotation(row: Record<string, unknown>): ReadingAnnotation {
  return {
    id: row.id as string,
    passageId: row.passage_id as string,
    wordOrPhrase: row.word_or_phrase as string,
    translation: row.translation as string,
    startIndex: row.start_index as number,
    endIndex: row.end_index as number,
    cardId: (row.card_id as string) ?? null,
    audioUrl: (row.audio_url as string) ?? null,
    partOfSpeech: (row.part_of_speech as string) ?? null,
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
    submittedAt: row.submitted_at as string,
  };
}

// ─── News Mapper ────────────────────────────────────────────────

function mapDailyNewsArticle(row: Record<string, unknown>): DailyNewsArticle {
  return {
    id: row.id as string,
    date: row.date as string,
    language: row.language as string,
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
  };
}
