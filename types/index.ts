// ─── User & Profile ─────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  nativeLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  level: ProficiencyLevel;
  dailyGoalMinutes: number;
  streak: number;
  longestStreak: number;
  streakFreezes: number;
  totalXp: number;
  timezone: string;
  onboardingCompleted: boolean;
  // Hearts system
  hearts: number;
  maxHearts: number;
  lastHeartLostAt: string | null;
  // XP levels & leagues
  xpLevel: number;
  leagueTier: LeagueTier;
  // Streak shield
  streakShieldActive: boolean;
  streakShieldUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' | 'ar' | 'hi' | 'ru';

export type ProficiencyLevel = 'beginner' | 'elementary' | 'intermediate' | 'upper_intermediate' | 'advanced';

// ─── Course / Unit / Lesson ─────────────────────────────────────

export interface Course {
  id: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  title: string;
  description: string;
  imageUrl: string | null;
  totalUnits: number;
  cefrLevel: string;
  isPublished: boolean;
  createdAt: string;
}

export interface Unit {
  id: string;
  courseId: string;
  title: string;
  description: string;
  orderIndex: number;
  totalLessons: number;
}

export interface Lesson {
  id: string;
  unitId: string;
  title: string;
  description: string;
  orderIndex: number;
  estimatedMinutes: number;
  xpReward: number;
  exercises: Exercise[];
}

// ─── Exercises ──────────────────────────────────────────────────

export type ExerciseType =
  | 'multiple_choice'
  | 'listening_choice'
  | 'listening_type'
  | 'translate_to_target'
  | 'translate_to_native'
  | 'speaking'
  | 'fill_blank'
  | 'free_production'
  | 'cloze_deletion'
  | 'sentence_construction'
  | 'dictation'
  | 'error_correction';

export interface Exercise {
  id: string;
  lessonId: string;
  type: ExerciseType;
  orderIndex: number;
  prompt: string;
  promptAudioUrl: string | null;
  correctAnswer: string;
  acceptedAnswers: string[];
  options: string[] | null; // for multiple choice
  hintText: string | null;
  cardId: string | null; // links to SRS card if applicable
  metadata?: Record<string, unknown>;
}

// ─── Cards & SRS ────────────────────────────────────────────────

export interface Card {
  id: string;
  courseId: string;
  unitId: string | null;
  nativeText: string;
  targetText: string;
  audioUrl: string | null;
  imageUrl: string | null;
  exampleSentence: string | null;
  exampleSentenceTranslation: string | null;
  partOfSpeech: string | null;
  tags: string[];
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  userId: string;
  cardId: string;
  easeFactor: number; // default 2.5, min 1.3
  interval: number; // days
  repetitions: number;
  nextDue: string; // ISO date
  lastReviewedAt: string | null;
  status: ReviewStatus;
}

export type ReviewStatus = 'new' | 'learning' | 'review' | 'graduated' | 'leech';

export type ReviewRating = 0 | 1 | 2 | 3 | 4 | 5;

export interface ReviewLog {
  id: string;
  userId: string;
  cardId: string;
  reviewItemId: string;
  rating: ReviewRating;
  responseTimeMs: number;
  userAnswer: string;
  wasCorrect: boolean;
  reviewedAt: string;
}

// ─── Stats ──────────────────────────────────────────────────────

export interface DailyStats {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  lessonsCompleted: number;
  cardsReviewed: number;
  cardsLearned: number;
  minutesPracticed: number;
  speakingMinutes: number;
  listeningMinutes: number;
  xpEarned: number;
  accuracy: number; // 0-1
}

// ─── AI Practice ────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  audioUrl: string | null;
  correction: string | null;
  timestamp: string;
}

export interface PracticeSession {
  id: string;
  userId: string;
  topic: string;
  targetLanguage: LanguageCode;
  level: ProficiencyLevel;
  messages: ConversationMessage[];
  durationMinutes: number;
  startedAt: string;
  endedAt: string | null;
}

// ─── Subscription ───────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'unlimited';

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  isActive: boolean;
}

// ─── Daily Usage (quota tracking) ───────────────────────────────

export interface DailyUsage {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  textMessages: number;
  voiceMinutes: number;
}

// ─── Daily Challenges ──────────────────────────────────────────

export interface DailyChallenge {
  type: string;
  title: string;
  icon: string;
  color: string;
  target: number;
  unit: string;
  xpReward: number;
  statKey: string;
  current: number;
  completed: boolean;
}

export interface DailyChallengesRecord {
  id: string;
  userId: string;
  date: string;
  challenges: DailyChallenge[];
  allCompleted: boolean;
  bonusXpClaimed: boolean;
  challengeStreak: number;
}

// ─── Streak Events ─────────────────────────────────────────────

export type StreakEventType = 'streak_broken' | 'streak_repaired' | 'shield_activated' | 'shield_used' | 'freeze_used';

// ─── Reading ──────────────────────────────────────────────────

export interface ReadingPassage {
  id: string;
  courseId: string;
  unitId: string | null;
  cefrLevel: string;
  title: string;
  content: string;
  contentTranslation: string | null;
  wordCount: number;
  audioUrl: string | null;
  imageUrl: string | null;
  sourceAttribution: string | null;
  tags: string[];
  isPublished: boolean;
  createdAt: string;
}

export interface ReadingAnnotation {
  id: string;
  passageId: string;
  wordOrPhrase: string;
  translation: string;
  startIndex: number;
  endIndex: number;
  cardId: string | null;
  audioUrl: string | null;
  partOfSpeech: string | null;
}

export interface ReadingQuestion {
  id: string;
  passageId: string;
  orderIndex: number;
  questionText: string;
  questionType: 'multiple_choice' | 'short_answer' | 'true_false';
  correctAnswer: string;
  acceptedAnswers: string[];
  options: string[] | null;
}

// ─── Writing ──────────────────────────────────────────────────

export type ScaffoldType = 'fill_blank' | 'sentence_frame' | 'guided_paragraph' | 'essay' | 'academic' | 'free';

export interface WritingPrompt {
  id: string;
  courseId: string;
  unitId: string | null;
  cefrLevel: string;
  promptText: string;
  promptType: 'guided' | 'free' | 'error_correction' | 'dictation' | 'sentence_construction';
  exampleResponse: string | null;
  targetVocabulary: string[];
  targetGrammar: string[];
  minWords: number | null;
  maxWords: number | null;
  rubricCriteria: unknown[];
  scaffoldType: ScaffoldType;
  scaffoldData: Record<string, unknown>;
  maxAttempts: number;
  createdAt: string;
}

export interface WritingFeedback {
  grammarScore: number;
  spellingScore: number;
  sentenceStructureScore: number;
  vocabularyScore: number;
  coherenceScore: number;
  corrections: WritingCorrection[];
  overallFeedback: string;
  correctedVersion: string | null;
  strengths: string[];
  improvements: string[];
}

export interface WritingCorrection {
  original: string;
  corrected: string;
  explanation: string;
  type: 'grammar' | 'vocabulary' | 'spelling' | 'style';
  ruleViolated?: string;
}

export interface WritingSubmission {
  id: string;
  userId: string;
  promptId: string;
  submissionText: string;
  aiFeedback: WritingFeedback | null;
  overallScore: number | null;
  wordCount: number;
  timeSpentMs: number;
  attemptNumber: number;
  submittedAt: string;
}

// ─── Lesson Completions ──────────────────────────────────────

export interface LessonCompletion {
  id: string;
  userId: string;
  lessonId: string;
  courseId: string;
  score: number; // 0-1
  xpEarned: number;
  timeSpentMs: number;
  completedAt: string;
}

// ─── Daily News ───────────────────────────────────────────────

export interface DailyNewsArticle {
  id: string;
  date: string;
  language: string;
  cefrLevel: string;
  title: string;
  titleTranslation: string | null;
  summary: string;
  content: string;
  contentTranslation: string | null;
  vocabularyHighlights: VocabularyHighlight[];
  sourceTopic: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface VocabularyHighlight {
  word: string;
  translation: string;
  partOfSpeech?: string;
}

// ─── Reading Books (Library) ─────────────────────────────────

export type BookSource = 'gutenberg' | 'wikisource' | 'ai_generated';

export interface ReadingBook {
  id: string;
  source: BookSource;
  sourceId: string | null;
  language: string;
  cefrLevel: string;
  title: string;
  author: string | null;
  description: string | null;
  content: string;
  wordCount: number;
  chapterBreaks: number[];
  imageUrl: string | null;
  tags: string[];
  isPublished: boolean;
  createdAt: string;
}

export interface UserBookProgress {
  id: string;
  userId: string;
  bookId: string;
  currentPosition: number;
  currentChapter: number;
  percentComplete: number;
  timeSpentMs: number;
  wordsLookedUp: number;
  completedAt: string | null;
  lastReadAt: string;
}

export interface BookAnnotation {
  id: string;
  bookId: string;
  wordOrPhrase: string;
  translation: string;
  partOfSpeech: string | null;
  audioUrl: string | null;
}
