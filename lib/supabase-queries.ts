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
  VoiceSession,
  TranscriptEntry,
  VoiceCorrection,
  VocabItem,
  Scenario,
  TutorProfile,
  CEFRLevel,
  NewsArticle,
  ConversationSession,
  AIPersonalityId,
  ReadingMaterial,
  ReadingAudio,
  WritingPrompt,
  WritingSubmission,
  SpeakingAttempt,
  AIUsageLedgerEntry,
  AIFeature,
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
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: userId,
      display_name: updates.displayName,
      native_language: updates.nativeLanguage,
      target_language: updates.targetLanguage,
      level: updates.level,
      daily_goal_minutes: updates.dailyGoalMinutes,
      timezone: updates.timezone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
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

// ─── Courses, Units, Lessons ────────────────────────────────────

export async function fetchCourses(targetLanguage?: string): Promise<Course[]> {
  let query = supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
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
    voicePreference: (row.voice_preference as UserProfile['voicePreference']) ?? undefined,
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
    cefrLevel: (row.cefr_level as CEFRLevel) ?? null,
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

// ─── Voice Sessions ─────────────────────────────────────────────

export async function createVoiceSession(params: {
  userId: string;
  roomName: string;
  topic: string;
  targetLanguage: string;
  level: string;
}): Promise<VoiceSession> {
  const { data, error } = await supabase
    .from('voice_sessions')
    .insert({
      user_id: params.userId,
      room_name: params.roomName,
      topic: params.topic,
      target_language: params.targetLanguage,
      level: params.level,
      transcript: [],
      corrections: [],
      vocabulary: [],
    })
    .select()
    .single();

  if (error) throw error;
  return mapVoiceSession(data);
}

export async function updateVoiceSession(
  sessionId: string,
  updates: {
    durationSeconds?: number;
    transcript?: TranscriptEntry[];
    corrections?: VoiceCorrection[];
    vocabulary?: VocabItem[];
    xpEarned?: number;
    endedAt?: string;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.durationSeconds !== undefined) payload.duration_seconds = updates.durationSeconds;
  if (updates.transcript !== undefined) payload.transcript = updates.transcript;
  if (updates.corrections !== undefined) payload.corrections = updates.corrections;
  if (updates.vocabulary !== undefined) payload.vocabulary = updates.vocabulary;
  if (updates.xpEarned !== undefined) payload.xp_earned = updates.xpEarned;
  if (updates.endedAt !== undefined) payload.ended_at = updates.endedAt;

  const { error } = await supabase
    .from('voice_sessions')
    .update(payload)
    .eq('id', sessionId);

  if (error) throw error;
}

export async function fetchRecentVoiceSessions(
  userId: string,
  limit = 20
): Promise<VoiceSession[]> {
  const { data, error } = await supabase
    .from('voice_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapVoiceSession);
}

function mapVoiceSession(row: Record<string, unknown>): VoiceSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    roomName: row.room_name as string,
    topic: row.topic as string,
    targetLanguage: row.target_language as VoiceSession['targetLanguage'],
    level: row.level as VoiceSession['level'],
    durationSeconds: row.duration_seconds as number,
    transcript: row.transcript as TranscriptEntry[],
    corrections: row.corrections as VoiceCorrection[],
    vocabulary: row.vocabulary as VocabItem[],
    xpEarned: row.xp_earned as number,
    startedAt: row.started_at as string,
    endedAt: row.ended_at as string | null,
  };
}

// ─── Scenarios ──────────────────────────────────────────────────

export async function fetchScenarios(
  languageId: string,
  category?: string,
  difficulty?: string
): Promise<Scenario[]> {
  let query = supabase
    .from('scenarios')
    .select('*')
    .eq('language_id', languageId)
    .eq('is_published', true)
    .order('order_index', { ascending: true });

  if (category) query = query.eq('category', category);
  if (difficulty) query = query.eq('difficulty', difficulty);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapScenario);
}

export async function fetchScenarioById(id: string): Promise<Scenario | null> {
  const { data, error } = await supabase
    .from('scenarios')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapScenario(data) : null;
}

function mapScenario(row: Record<string, unknown>): Scenario {
  return {
    id: row.id as string,
    languageId: row.language_id as Scenario['languageId'],
    title: row.title as string,
    description: row.description as string,
    aiPersona: row.ai_persona as string,
    setting: row.setting as string,
    targetVocab: row.target_vocab as string[],
    targetGrammar: row.target_grammar as string[],
    difficulty: row.difficulty as Scenario['difficulty'],
    category: row.category as Scenario['category'],
    orderIndex: row.order_index as number,
    isPublished: row.is_published as boolean,
    createdAt: row.created_at as string,
  };
}

// ─── Tutor Profiles (Adaptive Difficulty) ───────────────────────

export async function fetchOrCreateTutorProfile(
  userId: string,
  language: string
): Promise<TutorProfile> {
  const { data } = await supabase
    .from('tutor_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('language', language)
    .single();

  if (data) return mapTutorProfile(data);

  const { data: created, error: insertErr } = await supabase
    .from('tutor_profiles')
    .upsert(
      { user_id: userId, language, cefr_estimate: 'A1', sessions_count: 0, avg_error_rate: 0 },
      { onConflict: 'user_id,language' }
    )
    .select()
    .single();

  if (insertErr) throw insertErr;
  return mapTutorProfile(created);
}

export async function updateTutorProfile(
  userId: string,
  language: string,
  updates: Partial<TutorProfile>
): Promise<TutorProfile> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.cefrEstimate !== undefined) payload.cefr_estimate = updates.cefrEstimate;
  if (updates.commonErrors !== undefined) payload.common_errors = updates.commonErrors;
  if (updates.masteredVocab !== undefined) payload.mastered_vocab = updates.masteredVocab;
  if (updates.sessionsCount !== undefined) payload.sessions_count = updates.sessionsCount;
  if (updates.avgErrorRate !== undefined) payload.avg_error_rate = updates.avgErrorRate;
  if (updates.lastRecalculatedAt !== undefined) payload.last_recalculated_at = updates.lastRecalculatedAt;

  const { data, error } = await supabase
    .from('tutor_profiles')
    .update(payload)
    .eq('user_id', userId)
    .eq('language', language)
    .select()
    .single();

  if (error) throw error;
  return mapTutorProfile(data);
}

function mapTutorProfile(row: Record<string, unknown>): TutorProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    language: row.language as TutorProfile['language'],
    cefrEstimate: row.cefr_estimate as CEFRLevel,
    commonErrors: (row.common_errors as Record<string, number>) ?? {},
    masteredVocab: (row.mastered_vocab as string[]) ?? [],
    sessionsCount: row.sessions_count as number,
    avgErrorRate: row.avg_error_rate as number,
    lastRecalculatedAt: row.last_recalculated_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── News Articles ──────────────────────────────────────────────

export async function fetchNewsArticles(
  language: string,
  limit = 20
): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from('news_articles')
    .select('*')
    .eq('language', language)
    .order('synced_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapNewsArticle);
}

function mapNewsArticle(row: Record<string, unknown>): NewsArticle {
  return {
    id: row.id as string,
    source: row.source as string,
    language: row.language as NewsArticle['language'],
    title: row.title as string,
    summary: row.summary as string,
    url: row.url as string,
    imageUrl: row.image_url as string | null,
    publishedAt: row.published_at as string,
    syncedAt: row.synced_at as string,
  };
}

// ─── Conversation Sessions (Persistent Tutor) ───────────────────

export async function createConversationSession(params: {
  userId: string;
  tutorPersonality: string;
  scenarioId?: string | null;
  language: string;
  level: string;
}): Promise<ConversationSession> {
  const { data, error } = await supabase
    .from('conversation_sessions')
    .insert({
      user_id: params.userId,
      tutor_personality: params.tutorPersonality,
      scenario_id: params.scenarioId ?? null,
      language: params.language,
      level: params.level,
      messages: [],
      session_state: {},
    })
    .select()
    .single();

  if (error) throw error;
  return mapConversationSession(data);
}

export async function updateConversationSession(
  sessionId: string,
  updates: { messages?: unknown[]; sessionState?: Record<string, unknown>; lastActiveAt?: string }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.messages !== undefined) payload.messages = updates.messages;
  if (updates.sessionState !== undefined) payload.session_state = updates.sessionState;
  payload.last_active_at = updates.lastActiveAt ?? new Date().toISOString();

  const { error } = await supabase
    .from('conversation_sessions')
    .update(payload)
    .eq('id', sessionId);

  if (error) throw error;
}

export async function fetchRecentConversationSessions(
  userId: string,
  limit = 10
): Promise<ConversationSession[]> {
  const { data, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_active_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapConversationSession);
}

function mapConversationSession(row: Record<string, unknown>): ConversationSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tutorPersonality: row.tutor_personality as AIPersonalityId,
    scenarioId: row.scenario_id as string | null,
    language: row.language as ConversationSession['language'],
    level: row.level as ConversationSession['level'],
    messages: row.messages as ConversationSession['messages'],
    sessionState: (row.session_state as Record<string, unknown>) ?? {},
    startedAt: row.started_at as string,
    lastActiveAt: row.last_active_at as string,
  };
}

// ─── Voice Preference ───────────────────────────────────────────

export async function updateVoicePreference(
  userId: string,
  personality: AIPersonalityId
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ voice_preference: personality, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw error;
}

// ─── Reading Materials ──────────────────────────────────────────

export async function fetchReadingMaterials(params: {
  courseId: string;
  level?: CEFRLevel;
  unitId?: string;
  tags?: string[];
  minDifficulty?: number;
  maxDifficulty?: number;
  limit?: number;
}): Promise<ReadingMaterial[]> {
  let query = supabase
    .from('reading_materials')
    .select('*')
    .eq('course_id', params.courseId)
    .order('difficulty_score', { ascending: true });

  if (params.level) query = query.eq('level', params.level);
  if (params.unitId) query = query.eq('unit_id', params.unitId);
  if (params.minDifficulty != null) query = query.gte('difficulty_score', params.minDifficulty);
  if (params.maxDifficulty != null) query = query.lte('difficulty_score', params.maxDifficulty);
  if (params.tags?.length) query = query.overlaps('tags', params.tags);
  if (params.limit) query = query.limit(params.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapReadingMaterial);
}

export async function fetchReadingById(id: string): Promise<ReadingMaterial | null> {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapReadingMaterial(data) : null;
}

export async function fetchReadingAudio(readingId: string): Promise<ReadingAudio[]> {
  const { data, error } = await supabase
    .from('reading_audio')
    .select('*')
    .eq('reading_id', readingId);

  if (error) throw error;
  return (data ?? []).map(mapReadingAudio);
}

function mapReadingMaterial(row: Record<string, unknown>): ReadingMaterial {
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    unitId: row.unit_id as string | null,
    level: row.level as CEFRLevel,
    title: row.title as string,
    author: row.author as string | null,
    sourceUrl: row.source_url as string | null,
    isPublicDomain: row.is_public_domain as boolean,
    text: row.text as string,
    summary: row.summary as string | null,
    wordCount: row.word_count as number | null,
    difficultyScore: row.difficulty_score ? parseFloat(row.difficulty_score as string) : null,
    downloadUrlPdf: row.download_url_pdf as string | null,
    downloadUrlEpub: row.download_url_epub as string | null,
    tags: row.tags as string[],
    createdAt: row.created_at as string,
  };
}

function mapReadingAudio(row: Record<string, unknown>): ReadingAudio {
  return {
    id: row.id as string,
    readingId: row.reading_id as string,
    languageCode: row.language_code as string,
    voiceType: row.voice_type as string | null,
    audioUrl: row.audio_url as string,
    createdAt: row.created_at as string,
  };
}

// ─── Writing Prompts & Submissions ──────────────────────────────

export async function fetchWritingPrompts(params: {
  courseId: string;
  level?: CEFRLevel;
  type?: string;
  limit?: number;
}): Promise<WritingPrompt[]> {
  let query = supabase
    .from('writing_prompts')
    .select('*')
    .eq('course_id', params.courseId)
    .order('level', { ascending: true });

  if (params.level) query = query.eq('level', params.level);
  if (params.type) query = query.eq('type', params.type);
  if (params.limit) query = query.limit(params.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapWritingPrompt);
}

export async function fetchWritingPromptById(id: string): Promise<WritingPrompt | null> {
  const { data, error } = await supabase
    .from('writing_prompts')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? mapWritingPrompt(data) : null;
}

export async function fetchWritingSubmissions(
  userId: string,
  limit = 20
): Promise<WritingSubmission[]> {
  const { data, error } = await supabase
    .from('writing_submissions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapWritingSubmission);
}

function mapWritingPrompt(row: Record<string, unknown>): WritingPrompt {
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    unitId: row.unit_id as string | null,
    level: row.level as CEFRLevel,
    type: row.type as WritingPrompt['type'],
    title: row.title as string,
    promptText: row.prompt_text as string,
    minWords: row.min_words as number | null,
    maxWords: row.max_words as number | null,
    sampleOutline: row.sample_outline as string | null,
    createdAt: row.created_at as string,
  };
}

function mapWritingSubmission(row: Record<string, unknown>): WritingSubmission {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    promptId: row.prompt_id as string | null,
    courseId: row.course_id as string | null,
    level: row.level as CEFRLevel | null,
    text: row.text as string,
    aiFeedbackJson: row.ai_feedback_json as WritingSubmission['aiFeedbackJson'],
    grammarScore: row.grammar_score ? parseFloat(row.grammar_score as string) : null,
    vocabScore: row.vocab_score ? parseFloat(row.vocab_score as string) : null,
    coherenceScore: row.coherence_score ? parseFloat(row.coherence_score as string) : null,
    spellingScore: row.spelling_score ? parseFloat(row.spelling_score as string) : null,
    overallScore: row.overall_score ? parseFloat(row.overall_score as string) : null,
    createdAt: row.created_at as string,
  };
}

// ─── Speaking Attempts ──────────────────────────────────────────

export async function fetchSpeakingAttempts(
  userId: string,
  limit = 20
): Promise<SpeakingAttempt[]> {
  const { data, error } = await supabase
    .from('speaking_attempts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapSpeakingAttempt);
}

function mapSpeakingAttempt(row: Record<string, unknown>): SpeakingAttempt {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    readingId: row.reading_id as string | null,
    lessonId: row.lesson_id as string | null,
    audioUrl: row.audio_url as string,
    transcript: row.transcript as string | null,
    targetTextRef: row.target_text_ref as string | null,
    pronunciationScore: row.pronunciation_score ? parseFloat(row.pronunciation_score as string) : null,
    fluencyScore: row.fluency_score ? parseFloat(row.fluency_score as string) : null,
    rhythmScore: row.rhythm_score ? parseFloat(row.rhythm_score as string) : null,
    overallScore: row.overall_score ? parseFloat(row.overall_score as string) : null,
    aiFeedbackJson: row.ai_feedback_json as SpeakingAttempt['aiFeedbackJson'],
    createdAt: row.created_at as string,
  };
}

// ─── AI Usage ───────────────────────────────────────────────────

export async function fetchAIUsageSummary(userId: string): Promise<AIUsageLedgerEntry[]> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { data, error } = await supabase
    .from('ai_usage_ledger')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', monthStart)
    .order('timestamp', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapAIUsageLedgerEntry);
}

function mapAIUsageLedgerEntry(row: Record<string, unknown>): AIUsageLedgerEntry {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    feature: row.feature as AIFeature,
    tokensUsed: row.tokens_used as number,
    timestamp: row.timestamp as string,
    isFreeTier: row.is_free_tier as boolean,
  };
}
