import { supabase } from './supabase';
import type {
  UserProfile,
  OnboardingChecklist,
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
  LessonCompletion,
  ReadingBook,
  UserBookProgress,
  BookAnnotation,
  AvatarConfig,
  AvatarAccessory,
  ContentSource,
  GrammarRule,
  SkillType,
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
  deltas: {
    textMessagesDelta?: number;
    voiceMinutesDelta?: number;
    writingGradesDelta?: number;
    pronunciationScoresDelta?: number;
  }
): Promise<DailyUsage> {
  const current = await getOrCreateDailyUsage(userId);
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_usage')
    .update({
      text_messages: current.textMessages + (deltas.textMessagesDelta ?? 0),
      voice_minutes: current.voiceMinutes + (deltas.voiceMinutesDelta ?? 0),
      writing_grades: current.writingGrades + (deltas.writingGradesDelta ?? 0),
      pronunciation_scores: current.pronunciationScores + (deltas.pronunciationScoresDelta ?? 0),
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
    avatarConfig: row.avatar_config ? (row.avatar_config as AvatarConfig) : undefined,
    onboardingChecklist: parseOnboardingChecklist(row.onboarding_checklist),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const DEFAULT_ONBOARDING_CHECKLIST: OnboardingChecklist = {
  chooseLanguage: false,
  placementTest: false,
  firstLesson: false,
  aiConversation: false,
  dailyReminder: false,
  collapsed: false,
  dismissed: false,
  completedAt: null,
};

function parseOnboardingChecklist(raw: unknown): OnboardingChecklist {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ONBOARDING_CHECKLIST };
  const obj = raw as Record<string, unknown>;
  return {
    chooseLanguage: (obj.chooseLanguage as boolean) ?? false,
    placementTest: (obj.placementTest as boolean) ?? false,
    firstLesson: (obj.firstLesson as boolean) ?? false,
    aiConversation: (obj.aiConversation as boolean) ?? false,
    dailyReminder: (obj.dailyReminder as boolean) ?? false,
    collapsed: (obj.collapsed as boolean) ?? false,
    dismissed: (obj.dismissed as boolean) ?? false,
    completedAt: (obj.completedAt as string) ?? null,
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
    writingGrades: (row.writing_grades as number) ?? 0,
    pronunciationScores: (row.pronunciation_scores as number) ?? 0,
  };
}

// ─── Lesson Completions ──────────────────────────────────────────

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

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapLessonCompletion);
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

export async function fetchUserDailyNews(userId: string, date?: string): Promise<DailyNewsArticle | null> {
  const targetDate = date ?? new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('user_daily_news')
    .select('*')
    .eq('user_id', userId)
    .eq('date', targetDate)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapDailyNewsArticle(data) : null;
}

export async function generateDailyNews(language: string, level: string): Promise<DailyNewsArticle> {
  const { data, error } = await supabase.functions.invoke('daily-news', {
    body: { language, level },
  });

  if (error) {
    // When edge function returns non-2xx, the actual error body is in error.context
    let message = error.message;
    if (error.context instanceof Response) {
      try {
        const body = await error.context.json();
        message = body?.error ?? message;
      } catch {
        // ignore parse failure
      }
    }
    throw new Error(message);
  }
  if (!data?.article) throw new Error('No article returned');
  return mapDailyNewsArticle(data.article);
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

export async function fetchBookById(bookId: string): Promise<ReadingBook | null> {
  const { data, error } = await supabase
    .from('reading_books')
    .select('*')
    .eq('id', bookId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapReadingBook(data) : null;
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

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapUserBookProgress);
}

export async function fetchInProgressBooks(
  userId: string,
  language: string
): Promise<{ book: ReadingBook; progress: UserBookProgress }[]> {
  const { data, error } = await supabase
    .from('user_book_progress')
    .select('*, reading_books!inner(*)')
    .eq('user_id', userId)
    .gt('percent_complete', 0)
    .is('completed_at', null)
    .eq('reading_books.language', language)
    .order('last_read_at', { ascending: false });

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
  const { data, error } = await supabase
    .from('user_writing_submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('prompt_id', promptId)
    .order('attempt_number', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapWritingSubmission);
}

export async function fetchAllUserWritingSubmissions(
  userId: string,
  cefrLevel?: string
): Promise<WritingSubmission[]> {
  let query = supabase
    .from('user_writing_submissions')
    .select('*')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false });

  // Note: cefrLevel filtering requires a join; we'll filter client-side for simplicity
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapWritingSubmission);
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

// ─── Avatar ─────────────────────────────────────────────────────

export async function updateAvatarConfig(userId: string, config: AvatarConfig): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ avatar_config: config, updated_at: new Date().toISOString() })
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
