// ─── User & Profile ─────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

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
  voicePreference?: AIPersonalityId;
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
  cefrLevel: CEFRLevel | null;
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
  | 'free_production';

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

// ─── Voice Sessions ─────────────────────────────────────────────

export type VoiceSessionState = 'idle' | 'connecting' | 'listening' | 'ai-speaking' | 'ended' | 'error';

export interface VoiceSession {
  id: string;
  userId: string;
  roomName: string;
  topic: string;
  targetLanguage: LanguageCode;
  level: ProficiencyLevel;
  durationSeconds: number;
  transcript: TranscriptEntry[];
  corrections: VoiceCorrection[];
  vocabulary: VocabItem[];
  xpEarned: number;
  startedAt: string;
  endedAt: string | null;
}

export interface TranscriptEntry {
  id: string;
  speaker: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface VoiceCorrection {
  original: string;
  corrected: string;
  explanation?: string;
}

export interface VocabItem {
  word: string;
  translation: string;
  context?: string;
}

// ─── Scenarios ──────────────────────────────────────────────────

export interface Scenario {
  id: string;
  languageId: LanguageCode;
  title: string;
  description: string;
  aiPersona: string;
  setting: string;
  targetVocab: string[];
  targetGrammar: string[];
  difficulty: ProficiencyLevel;
  category: ScenarioCategory;
  orderIndex: number;
  isPublished: boolean;
  createdAt: string;
}

export type ScenarioCategory = 'Travel' | 'Social' | 'Professional' | 'Daily Life' | 'Emergency';

// ─── Tutor Profiles (Adaptive Difficulty) ───────────────────────

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface TutorProfile {
  id: string;
  userId: string;
  language: LanguageCode;
  cefrEstimate: CEFRLevel;
  commonErrors: Record<string, number>;
  masteredVocab: string[];
  sessionsCount: number;
  avgErrorRate: number;
  lastRecalculatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── AI Personalities ───────────────────────────────────────────

export type AIPersonalityId = 'sofia' | 'marco' | 'prof_kim' | 'mia';

export interface AIPersonality {
  id: AIPersonalityId;
  name: string;
  description: string;
  voiceId: string;
  avatar: string;
  systemPromptAddendum: string;
}

// ─── News Articles ──────────────────────────────────────────────

export interface NewsArticle {
  id: string;
  source: string;
  language: LanguageCode;
  title: string;
  summary: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  syncedAt: string;
}

// ─── Conversation Sessions (Persistent Tutor) ───────────────────

export interface ConversationSession {
  id: string;
  userId: string;
  tutorPersonality: AIPersonalityId;
  scenarioId: string | null;
  language: LanguageCode;
  level: ProficiencyLevel;
  messages: ConversationMessage[];
  sessionState: Record<string, unknown>;
  startedAt: string;
  lastActiveAt: string;
}

// ─── Pronunciation (Enhanced) ───────────────────────────────────

export interface WordScore {
  word: string;
  confidence: number;
  startTime: number;
  endTime: number;
  flagged: boolean;
}

export interface PronunciationResult {
  overallScore: number;
  wordScores: WordScore[];
  feedback: string;
  transcription: string;
}

// ─── Driving Mode ───────────────────────────────────────────────

export type DrivingModeState = 'topic-select' | 'active' | 'ended';

// ─── Reading Library ────────────────────────────────────────────

export interface ReadingMaterial {
  id: string;
  courseId: string;
  unitId: string | null;
  level: CEFRLevel;
  title: string;
  author: string | null;
  sourceUrl: string | null;
  isPublicDomain: boolean;
  text: string;
  summary: string | null;
  wordCount: number | null;
  difficultyScore: number | null; // 0–10
  downloadUrlPdf: string | null;
  downloadUrlEpub: string | null;
  tags: string[];
  createdAt: string;
}

export interface ReadingAudio {
  id: string;
  readingId: string;
  languageCode: string;
  voiceType: string | null;
  audioUrl: string;
  createdAt: string;
}

// ─── Writing Practice ───────────────────────────────────────────

export type WritingPromptType = 'phrase' | 'sentence' | 'paragraph' | 'letter' | 'essay';

export interface WritingPrompt {
  id: string;
  courseId: string;
  unitId: string | null;
  level: CEFRLevel;
  type: WritingPromptType;
  title: string;
  promptText: string;
  minWords: number | null;
  maxWords: number | null;
  sampleOutline: string | null;
  createdAt: string;
}

export interface WritingFeedback {
  corrections: { original: string; corrected: string; explanation: string }[];
  suggestions: string[];
  grammarScore: number;
  vocabScore: number;
  coherenceScore: number;
  spellingScore: number;
  overallScore: number;
}

export interface WritingSubmission {
  id: string;
  userId: string;
  promptId: string | null;
  courseId: string | null;
  level: CEFRLevel | null;
  text: string;
  aiFeedbackJson: WritingFeedback | null;
  grammarScore: number | null;
  vocabScore: number | null;
  coherenceScore: number | null;
  spellingScore: number | null;
  overallScore: number | null;
  createdAt: string;
}

// ─── Speaking Practice ──────────────────────────────────────────

export interface SpeakingAttempt {
  id: string;
  userId: string;
  readingId: string | null;
  lessonId: string | null;
  audioUrl: string;
  transcript: string | null;
  targetTextRef: string | null;
  pronunciationScore: number | null;
  fluencyScore: number | null;
  rhythmScore: number | null;
  overallScore: number | null;
  aiFeedbackJson: SpeakingFeedback | null;
  createdAt: string;
}

export interface SpeakingFeedback {
  pronunciationScore: number;
  fluencyScore: number;
  rhythmScore: number;
  overallScore: number;
  feedback: string;
  wordErrors: { word: string; issue: string; suggestion: string }[];
}

// ─── AI Usage Tracking ──────────────────────────────────────────

export type AIFeature = 'chat' | 'tutor_conversation' | 'writing_feedback' | 'pronunciation_feedback';

export interface AIUsageLedgerEntry {
  id: string;
  userId: string;
  feature: AIFeature;
  tokensUsed: number;
  timestamp: string;
  isFreeTier: boolean;
}

export interface AIUsageSummary {
  feature: AIFeature;
  totalTokens: number;
  requestCount: number;
  limit: number | 'unlimited';
}
