// ─── Onboarding Checklist ────────────────────────────────────────

export interface OnboardingChecklist {
  chooseLanguage: boolean;
  placementTest: boolean;
  firstLesson: boolean;
  aiConversation: boolean;
  dailyReminder: boolean;
  collapsed: boolean;
  dismissed: boolean;
  completedAt: string | null;
}

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
  avatarConfig?: AvatarConfig;
  onboardingChecklist: OnboardingChecklist;
  // Dörnyei L2 Motivational Self System (research.md §11.1).
  // motivationReason persists the MotivationReason enum collected in
  // onboarding; idealL2Self is free-text (<=300 chars) describing the
  // learner's vision of themselves using the language. Both are null
  // for accounts created before migration 028.
  motivationReason: MotivationReason | null;
  idealL2Self: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' | 'ar' | 'hi' | 'ru';

export type ProficiencyLevel = 'beginner' | 'elementary' | 'intermediate' | 'upper_intermediate' | 'advanced';

/**
 * Motivation — why the learner is here. Collected in onboarding.
 * Now durably persisted to `user_profiles.motivation_reason` (migration 028).
 * The Zustand `useAppStore.motivation` slot remains as a transient hint for
 * the onboarding flow; source of truth is the profile.
 */
export type MotivationReason = 'travel' | 'family' | 'work' | 'brain' | 'curious';

/**
 * Typed error classification from `gradeAnswer` used to drive differentiated
 * feedback UX (Lyster & Ranta): grammar errors get metalinguistic cues + a
 * rule card; phonological errors get a recast; spelling errors get inline
 * corrections; lexical errors get elicitation + (optional) rule card.
 * `null` means the classifier could not confidently assign a type.
 */
export type FeedbackErrorType = 'grammar' | 'lexical' | 'phonological' | 'spelling';

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
  | 'error_correction'
  | 'collocation_match'
  | 'word_form'
  | 'sentence_transformation'
  | 'mini_dialogue';

export type SkillType = 'vocabulary' | 'grammar' | 'mixed';
export type ResponseMode = 'tap' | 'type' | 'speak';
export type ContentSourceType = 'imported' | 'ai_generated' | 'seed' | 'manual';

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
  // Skill targeting
  skillType?: SkillType;
  subskill?: string;
  responseMode?: ResponseMode;
  targetWord?: string;
  targetGrammar?: string;
  // Speech & distractors
  acceptedSpeechVariants?: string[];
  distractors?: string[];
  explanation?: string;
  // Provenance
  sourceType?: ContentSourceType;
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
  // Enhanced vocab metadata
  language?: string;
  cefrLevel?: string;
  skillType?: SkillType;
  subskill?: string;
  wordFamily?: string[];
  collocations?: unknown[];
  frequencyRank?: number;
  // Provenance
  sourceType?: ContentSourceType;
}

// ─── Content Source ─────────────────────────────────────────

export interface ContentSource {
  id: string;
  name: string;
  url: string | null;
  license: string;
  attribution: string | null;
  description: string | null;
  lastImportedAt: string | null;
  createdAt: string;
}

// ─── Grammar Rules ──────────────────────────────────────────

export interface GrammarRule {
  id: string;
  language: string;
  cefrLevel: string;
  ruleName: string;
  title: string;
  explanation: string;
  examples: unknown[];
  commonErrors: unknown[];
  tags: string[];
  sourceId: string | null;
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

export type CorrectionErrorType =
  | 'grammar'
  | 'vocabulary'
  | 'spelling'
  | 'word_order'
  | 'tense'
  | 'gender'
  | 'other';

export type CorrectionSeverity = 'minor' | 'moderate' | 'critical';

export interface CorrectionDetail {
  /** Concise summary — shown always. Native-language. */
  shortLabel: string;
  /** Full rule explanation — collapsed by default, expanded via "Why?" tap. */
  explanation: string;
  /** The exact wrong phrase from the student's message, target-language. */
  original: string;
  /** The corrected phrase, target-language. */
  corrected: string;
  errorType: CorrectionErrorType;
  severity: CorrectionSeverity;
  /** Optional extra example sentence showing correct pattern. */
  example?: string | null;
  /** How many times this error pattern has repeated in the past 7 days. */
  repetitionCount?: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  audioUrl: string | null;
  /**
   * Correction can be:
   *  - null (no correction)
   *  - CorrectionDetail object (rich, modern)
   *  - string (legacy — old chat_messages rows have plain text). The
   *    normalizeCorrection helper converts legacy strings into the object
   *    shape at read-time.
   */
  correction: CorrectionDetail | string | null;
  timestamp: string;
}

/**
 * Normalize any correction value (legacy string, JSON-stringified object from
 * DB, or a fresh object) into a CorrectionDetail or null. Defensive: always
 * returns a valid CorrectionDetail when there's meaningful content.
 */
export function normalizeCorrection(
  input: CorrectionDetail | string | Record<string, unknown> | null | undefined
): CorrectionDetail | null {
  if (input == null) return null;

  // Legacy plain-string or JSON-stringified object from DB
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        return normalizeCorrection(parsed);
      } catch {
        // fall through to plain-text treatment
      }
    }
    return {
      shortLabel: 'Correction',
      explanation: trimmed,
      original: '',
      corrected: '',
      errorType: 'other',
      severity: 'moderate',
      example: null,
    };
  }

  // Object form — may be partial; fill in sensible defaults.
  const obj = input as Record<string, unknown>;
  const explanation = typeof obj.explanation === 'string' ? obj.explanation : '';
  const shortLabel =
    typeof obj.shortLabel === 'string' && obj.shortLabel.trim()
      ? obj.shortLabel.slice(0, 80)
      : explanation
        ? explanation.slice(0, 80)
        : 'Correction';
  const original = typeof obj.original === 'string' ? obj.original : '';
  const corrected = typeof obj.corrected === 'string' ? obj.corrected : '';
  const errorType = ([
    'grammar', 'vocabulary', 'spelling', 'word_order', 'tense', 'gender', 'other',
  ].includes(obj.errorType as string)
    ? (obj.errorType as CorrectionErrorType)
    : 'other');
  const severity = (['minor', 'moderate', 'critical'].includes(obj.severity as string)
    ? (obj.severity as CorrectionSeverity)
    : 'moderate');
  const example =
    obj.example == null || obj.example === ''
      ? null
      : String(obj.example);
  const repetitionCount =
    typeof obj.repetitionCount === 'number' && obj.repetitionCount >= 0
      ? obj.repetitionCount
      : undefined;

  // If the normalized payload has no useful content, treat as null
  if (!explanation && !original && !corrected) return null;

  return { shortLabel, explanation, original, corrected, errorType, severity, example, repetitionCount };
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

export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'vip';

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
  writingGrades: number;
  pronunciationScores: number;
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

// ─── Avatar System ──────────────────────────────────────────────

export interface AvatarConfig {
  headShape: 'round' | 'oval' | 'square';
  skinTone: string;
  hairStyle: 'short' | 'medium' | 'long' | 'buzz' | 'curly' | 'ponytail' | 'none';
  hairColor: string;
  eyeStyle: 'round' | 'almond' | 'wide' | 'narrow';
  eyeColor: string;
  mouthStyle: 'smile' | 'neutral' | 'grin' | 'small';
  accessory: string | null;
  outfit: string | null;
  background: string | null;
}

export type AvatarExpression = 'neutral' | 'happy' | 'sad' | 'celebrating';
export type AvatarSize = 'small' | 'medium' | 'large';

export interface AvatarAccessory {
  id: string;
  name: string;
  category: string;
  svgData: string;
  unlockType: 'free' | 'level' | 'achievement' | 'streak' | 'purchase';
  unlockRequirement: Record<string, unknown>;
}

// ─── School System ──────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  maxSeats: number;
  contractConfig: SchoolContractConfig;
  contractStart: string | null;
  contractEnd: string | null;
}

export interface SchoolContractConfig {
  dailyVoiceMinutes: number;
  dailyTextMessages: number;
  dailyWritingGrades: number;
  dailyPronunciationScores: number;
  unlimitedHearts: boolean;
  streakShield: boolean;
  audiobookNarration: boolean;
  offlineMode?: boolean;
  allowed_email_domains?: string[];
}

export interface Classroom {
  id: string;
  organizationId: string;
  teacherId: string;
  name: string;
  targetLanguage: LanguageCode;
  level: ProficiencyLevel;
  inviteCode: string;
  inviteCodeActive: boolean;
  maxStudents: number;
  archived: boolean;
  studentCount?: number;
  activeAssignmentCount?: number;
}

export interface ClassEnrollment {
  id: string;
  classroomId: string;
  studentId: string;
  enrolledAt: string;
  droppedAt: string | null;
  classroom?: Classroom;
}

export interface Assignment {
  id: string;
  classroomId: string;
  teacherId: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'closed';
  scenarioKey: string | null;
  customScenario: { label: string; description: string; systemContext: string } | null;
  targetLanguage: LanguageCode;
  level: ProficiencyLevel;
  minDurationMinutes: number;
  mode: 'text' | 'voice' | 'either';
  vocabularyFocus: string[];
  grammarFocus: string[];
  instructions: string;
  publishedAt: string | null;
  dueAt: string | null;
  lateSubmissionAllowed: boolean;
  maxPoints: number;
  submissionCount?: number;
  completionRate?: number;
  classroomName?: string;
}

export type SubmissionStatus = 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'returned';

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  status: SubmissionStatus;
  startedAt: string | null;
  submittedAt: string | null;
  chatSessionId: string | null;
  conversationDurationMinutes: number | null;
  autoScore: number | null;
  teacherScore: number | null;
  finalScore: number | null;
  teacherFeedback: string | null;
  aiFeedback: ConversationGrade | null;
  isLate: boolean;
  gradedAt: string | null;
  studentName?: string;
}

export interface ConversationGrade {
  participation: number;
  languageUsage: number;
  grammarVocabulary: number;
  durationCompliance: number;
  totalScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
}
