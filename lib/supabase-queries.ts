import { supabase } from './supabase';
import { SRS_DEFAULTS } from '../config/app';
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

/**
 * Fetch due review items with their card data joined. Used for the
 * lesson warm-up phase (Roediger & Karpicke testing effect —
 * research.md §5.1). Returns an empty array on failure rather than
 * throwing; warm-up is best-effort and must never block a lesson start.
 */
export async function fetchDueReviewItemsWithCards(
  userId: string,
  limit = 5,
): Promise<Array<{ item: ReviewItem; card: Card }>> {
  try {
    const items = await fetchDueReviewItems(userId, limit);
    if (items.length === 0) return [];
    const cards = await fetchCardsByIds(items.map((it) => it.cardId));
    const cardById = new Map(cards.map((c) => [c.id, c]));
    return items
      .map((item) => {
        const card = cardById.get(item.cardId);
        return card ? { item, card } : null;
      })
      .filter((v): v is { item: ReviewItem; card: Card } => v !== null);
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

/**
 * New-cards-per-day cap gate (research.md §5.2 + §13.1).
 *
 * Reads today's `daily_stats.cards_learned` as the counter for "new cards
 * introduced today". Returns true iff the learner has room for another
 * new card. Uses SRS_DEFAULTS.newCardsPerDay as the cap (20 by default).
 *
 * This is a soft gate — callers should check before introducing a new
 * card via insertNewReviewItem / addCardToReview. Paired with
 * incrementNewCardsToday() which bumps the counter on success.
 */
export async function canIntroduceNewCard(userId: string): Promise<boolean> {
  const stats = await fetchTodayStats(userId);
  const introducedToday = stats?.cardsLearned ?? 0;
  return introducedToday < SRS_DEFAULTS.newCardsPerDay;
}

export async function incrementNewCardsToday(userId: string): Promise<void> {
  await upsertDailyStats(userId, { cardsLearned: 1 });
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
    // L2 Motivational Self System (migration 028). Null-safe for legacy rows.
    motivationReason: (row.motivation_reason as UserProfile['motivationReason']) ?? null,
    idealL2Self: (row.ideal_l2_self as string | null) ?? null,
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

  const [lessonsByUnit, completions] = await Promise.all([
    Promise.all(units.map((u) => fetchLessons(u.id).then((lessons) => ({ unitId: u.id, lessons })))),
    fetchLessonCompletions(userId, course.id),
  ]);
  const completedSet = new Set(completions.map((c) => c.lessonId));

  const tiles: UnitProgressTile[] = units.map((unit) => {
    const lessons = lessonsByUnit.find((entry) => entry.unitId === unit.id)?.lessons ?? [];
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

/**
 * Map a ProficiencyLevel to the CEFR band the learner can comfortably read
 * (current level + 1 sub-level above, per Krashen i+1). Used to gate content
 * surfaces so learners don't get flooded with C1 text at A2. research.md §1.1.
 */
export function allowedCefrLevelsFor(level: UserProfile['level'] | undefined): string[] {
  const ladder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const map: Record<UserProfile['level'], number> = {
    beginner: 0,
    elementary: 1,
    intermediate: 2,
    upper_intermediate: 3,
    advanced: 4,
  };
  if (!level) return ladder; // unknown level → don't filter
  const idx = map[level] ?? 2;
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

export class NewCardsCapReachedError extends Error {
  readonly code = 'NEW_CARDS_CAP_REACHED' as const;
  constructor(public readonly cap: number) {
    super(`Daily new-card cap of ${cap} already reached.`);
  }
}

export async function addCardFromAnnotation(
  userId: string,
  annotation: ReadingAnnotation,
  courseId: string
): Promise<ReviewItem> {
  // Enforce the 20-new-cards/day cap before introducing a new card
  // (research.md §5.2). Existing review items are re-upserted without
  // counting as a "new" introduction.
  if (!(await canIntroduceNewCard(userId))) {
    throw new NewCardsCapReachedError(SRS_DEFAULTS.newCardsPerDay);
  }

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

  // Increment the daily counter only on successful introduction.
  await incrementNewCardsToday(userId).catch(() => {});

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
  const targetDate = date ?? new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_news')
    .select('*')
    .eq('language', language)
    .eq('tier', tier)
    .eq('date', targetDate)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapDailyNewsArticle(data) : null;
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
export async function loadChatMessages(sessionId: string): Promise<ConversationMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    role: row.role as 'user' | 'assistant' | 'system',
    content: row.content as string,
    correction: (row.correction as string) ?? null,
    audioUrl: (row.audio_url as string) ?? null,
    timestamp: row.created_at as string,
  }));
}

/** Save a correction as an SRS card so the user can review it later.
 *  Uses the corrected phrase as target_text and the explanation/shortLabel
 *  as native_text. Creates both the card and a fresh review_item. Safe to
 *  call with a NULL courseId (card column is nullable). */
export async function saveCorrectionAsCard(params: {
  userId: string;
  targetLanguage: string;
  original: string;
  corrected: string;
  shortLabel: string;
  explanation: string;
}): Promise<{ cardId: string } | null> {
  const { userId, targetLanguage, original, corrected, shortLabel, explanation } = params;
  if (!corrected.trim()) return null;

  // Enforce the 20-new-cards/day cap. Return null (silent skip) rather
  // than throwing — the correction was still logged to correction_log,
  // and the UX shouldn't break on a rate-limit.
  if (!(await canIntroduceNewCard(userId))) {
    return null;
  }

  // Native text prefers shortLabel (concise) but falls back to explanation.
  const nativeText = shortLabel.trim() || explanation.trim().slice(0, 200) || 'Correction';

  const { data: card, error: cardErr } = await supabase
    .from('cards')
    .insert({
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

  // Increment the daily counter only on successful introduction.
  await incrementNewCardsToday(userId).catch(() => {});

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
      unlimitedHearts: false,
      streakShield: false,
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

export async function fetchClassroomStudents(
  classroomId: string
): Promise<{ id: string; studentId: string; displayName: string; enrolledAt: string }[]> {
  const { data, error } = await supabase
    .from('classroom_enrollments')
    .select('id, student_id, enrolled_at, user_profiles!inner(display_name)')
    .eq('classroom_id', classroomId)
    .is('dropped_at', null);

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    studentId: row.student_id as string,
    displayName: ((row.user_profiles as Record<string, unknown>)?.display_name as string) ?? 'Unknown',
    enrolledAt: row.enrolled_at as string,
  }));
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

export async function fetchClassroomAssignments(classroomId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapAssignment);
}

export async function fetchAssignmentSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*, user_profiles!inner(display_name)')
    .eq('assignment_id', assignmentId);

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

export async function createClassroom(data: {
  name: string;
  targetLanguage: string;
  level: string;
  organizationId: string;
}): Promise<Classroom> {
  const result = await callSchoolAction('create_classroom', data);
  return mapClassroom(result.classroom);
}

export async function joinClassroom(inviteCode: string): Promise<ClassEnrollment> {
  const result = await callSchoolAction('join_classroom', { inviteCode });
  return mapEnrollment(result.enrollment);
}

export async function leaveClassroom(classroomId: string): Promise<void> {
  await callSchoolAction('leave_classroom', { classroomId });
}

export async function createAssignment(data: Record<string, unknown>): Promise<Assignment> {
  const result = await callSchoolAction('create_assignment', data);
  return mapAssignment(result.assignment);
}

export async function startAssignment(
  assignmentId: string
): Promise<{ submission: AssignmentSubmission; chatSessionId: string }> {
  const result = await callSchoolAction('start_assignment', { assignmentId });
  return {
    submission: mapSubmission(result.submission),
    chatSessionId: result.chatSessionId as string,
  };
}

export async function submitAssignment(assignmentId: string): Promise<AssignmentSubmission> {
  const result = await callSchoolAction('submit_assignment', { assignmentId });
  return mapSubmission(result.submission);
}

export async function gradeSubmission(
  submissionId: string,
  teacherScore: number,
  teacherFeedback: string
): Promise<AssignmentSubmission> {
  const result = await callSchoolAction('grade_submission', {
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
