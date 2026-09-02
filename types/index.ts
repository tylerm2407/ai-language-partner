// ─── Onboarding Checklist ────────────────────────────────────────

/** The four steps that carry persisted state. Order is display order. */
export type OnboardingStepKey =
  | 'chooseLanguage'
  | 'firstLesson'
  | 'aiConversation'
  | 'dailyReminder';

export interface OnboardingChecklist {
  chooseLanguage: boolean;
  /**
   * `placementTest` was removed on 2026-08-24 along with the test itself —
   * onboarding now asks the learner for their level directly. This is a jsonb
   * column, so existing rows keep the stale key; `parseOnboardingChecklist`
   * drops it on read and nothing writes it back. `collapsed` went the same way
   * on 2026-08-25 when the sheet stopped having a collapsed state.
   */
  firstLesson: boolean;
  aiConversation: boolean;
  dailyReminder: boolean;
  /**
   * Steps the learner resolved by opting out rather than by doing them.
   * A skipped step counts toward resolution but is never rendered as done —
   * the checklist must not claim work that didn't happen.
   *
   * This is what makes the checklist finishable at all for two real
   * populations: free-tier learners, for whom `aiConversation` is
   * uncompletable (`_shared/plan-limits.ts` zeroes `dailyTextMessages`), and
   * anyone who denies the notification permission.
   */
  skipped: OnboardingStepKey[];
  dismissed: boolean;
  /** Stamped once, when every step first became done-or-skipped. */
  completedAt: string | null;
  /**
   * Stamped once the completion was acknowledged — confetti shown and the +50
   * XP awarded, or silently back-filled for a learner who finished the steps
   * before this field existed. Belt-and-braces alongside `dismissed`: even if
   * the dismiss write is lost, a celebrated checklist never comes back.
   */
  celebratedAt: string | null;
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
  totalXp: number;
  timezone: string;
  onboardingCompleted: boolean;
  // XP levels & leagues
  xpLevel: number;
  leagueTier: LeagueTier;
  /**
   * Which avatar renderer this account uses (migration 067). Accounts created
   * before that migration still read 'procedural' — the SVG renderer they
   * named is gone, and those rows render the initials placeholder in
   * components/avatar/Avatar.tsx until the learner picks a preset.
   */
  avatarKind: AvatarKind;
  /** Bundled illustration key when avatarKind is 'preset'. */
  avatarPresetId: string | null;
  /** Path inside the private `avatars` bucket when avatarKind is 'generated'. */
  avatarImagePath: string | null;
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

/**
 * A language Fluenci actually supports.
 *
 * This list is the nine target languages in `SUPPORTED_LANGUAGES` (what the
 * onboarding picker offers) plus `en` as a native language. It deliberately
 * matches `VALID_LANGUAGES` in `supabase/functions/_shared/validation.ts`:
 * when the two disagree, the client can name a language the edge will reject.
 *
 * It used to include 'ar' and 'hi', which no picker ever offered and the edge
 * validator always refused — dead surface that invited code to handle
 * languages the product does not teach. Widening this type means adding the
 * language to the picker, the edge allow-list, and the greeting/placeholder
 * maps in the same change, not just here.
 */
export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' | 'ru';

export type ProficiencyLevel = 'beginner' | 'elementary' | 'intermediate' | 'upper_intermediate' | 'advanced';

/**
 * Motivation — why the learner is here. Persisted on
 * `user_profiles.motivation_reason` (migration 028).
 *
 * Nothing writes it as of 2026-08-08: the onboarding step that collected it was
 * removed because no code path ever read the value back. The column, this type
 * and the `upsertProfile` mapping all remain, so reinstating the step is a UI
 * change rather than a migration. See app/(public)/onboarding.tsx.
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
  courseId: string | null;
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

export type SkillType = 'vocabulary' | 'grammar' | 'mixed' | 'chunk';
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

// ─── Hands-Free Sessions ────────────────────────────

/**
 * One eyes-free commute session (migration 059). Deliberately carries no
 * ratings or XP — those flow through the normal review path, so this row only
 * describes the shape of the session itself.
 */
export interface HandsFreeSessionRow {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  plannedDurationMs: number;
  actualDurationMs: number | null;
  itemsAttempted: number;
  itemsCorrect: number;
  /** Only 'in_app' is reachable in Phase A; the rest await lock screen / CarPlay. */
  surface: 'in_app' | 'lock_screen' | 'carplay' | 'android_auto';
  endedReason: 'completed' | 'user_ended' | 'interrupted' | 'error' | null;
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
  readingMinutes: number;
  writingMinutes: number;
  xpEarned: number;
  accuracy: number; // 0-1
}

// ─── Pronunciation Scores ───────────────────────────────────────

/**
 * Where a scored spoken attempt came from. Mirrors the CHECK constraint on
 * `public.pronunciation_scores.source` (migration 089) and
 * `VALID_PRONUNCIATION_SOURCES` in `supabase/functions/_shared/validation.ts`.
 */
export type PronunciationSource = 'lesson' | 'checkpoint' | 'read_aloud' | 'practice';

/**
 * One scored spoken attempt (migration 089).
 *
 * Written by the `score-pronunciation` edge function with the service role —
 * there is no client INSERT policy, because this feeds the proficiency report
 * and a future leaderboard. Clients may read their own rows.
 *
 * `expectedText` and `transcription` are stored together on purpose: the pair
 * is a per-learner pronunciation error corpus, which is worth as much as the
 * score itself.
 */
export interface PronunciationScoreRow {
  id: string;
  userId: string;
  targetLanguage: string;
  expectedText: string;
  /** Whisper's transcript; null when it could not be stored. */
  transcription: string | null;
  /** 0–100, as stored. */
  score: number;
  isCorrect: boolean;
  phonemeErrors: string[] | null;
  source: PronunciationSource;
  /** Null for read-aloud and free practice, which are not tied to a card. */
  cardId: string | null;
  createdAt: string;
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

// ─── Subscription ───────────────────────────────────────────────

export type SubscriptionTier = 'starter' | 'basic' | 'premium' | 'vip';

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
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
}

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

/**
 * One word's meaning, however it was obtained.
 *
 * Replaces the old `ReadingAnnotation`, which described a row of the
 * `reading_annotations` table — a table that had 0 rows in production and no
 * writer anywhere in the repo, and was dropped in migration 094. Help in the
 * reader is now on demand: a word is looked up when it is tapped, from
 * `book_annotations` if the book happens to have one and from the `translate`
 * function otherwise, which is what makes the 10,231 imported Gutenberg books
 * readable at all.
 *
 * Structurally satisfies `AnnotationCardSource`, so it can be handed straight
 * to `addCardFromAnnotation` and become an SRS card.
 */
export interface WordLookup {
  /** The normalised form — punctuation stripped, lowercased. */
  word: string;
  translation: string;
  /** Only ever set on an annotation; a live translation does not return one. */
  partOfSpeech: string | null;
  audioUrl: string | null;
  source: 'annotation' | 'translated';
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

/** Render state of an article's narration (migration 079).
 *
 *  `null` is not "unknown" — it means the row predates the podcast feature
 *  and will never be narrated. The column deliberately has no DEFAULT so
 *  the back catalogue stays out of the render queue. */
export type NewsAudioStatus = 'pending' | 'generating' | 'ready' | 'failed' | null;

/** A playable narration, as returned by the `news-audio` edge function.
 *
 *  `url` is short-lived and signed against a PRIVATE bucket — treat it as a
 *  ticket, not an address. Do not persist it, and refetch rather than
 *  caching it past `expiresInSeconds`. */
export interface NewsAudio {
  status: 'ready';
  url: string;
  durationMs: number | null;
  expiresInSeconds: number;
}

export interface DailyNewsArticle {
  id: string;
  date: string;
  language: string;
  /** 'easy' (A1–B1) or 'hard' (B2–C1). The column has existed since
   *  migration 020b; this type simply never carried it. */
  tier: string;
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
  /** Whether a narration exists yet. The audio itself is fetched separately
   *  (`fetchNewsAudio`) and behind an explicit tap. */
  audioStatus: NewsAudioStatus;
  /** Measured from the rendered MP3, so it can be shown ("LISTEN · 2:14")
   *  before a single byte of audio is fetched. */
  audioDurationMs: number | null;
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

/**
 * One completed checkpoint: the four-strand measure the learner's band and
 * their cohort board are both anchored on.
 *
 * A null strand score means that strand was not answered, and is deliberately
 * distinct from a zero — a learner who could not record on a noisy train has
 * not demonstrated they cannot speak.
 */
export interface Checkpoint {
  id: string;
  language: string;
  band: string;
  kind: 'placement' | 'monthly';
  completedAt: string;
  listeningScore: number | null;
  readingScore: number | null;
  speakingScore: number | null;
  writingScore: number | null;
  composite: number | null;
}

/**
 * One row of the weekly cohort board.
 *
 * `displayName` is null unless that member opted out of pseudonymity — the
 * alias is what everyone else sees by default, and there is no user id here at
 * all.
 */
export interface LeaderboardRow {
  rank: number;
  alias: string;
  displayName: string | null;
  isSelf: boolean;
  retainedCards: number;
  accuracyDelta: number;
  reviews: number;
}

/**
 * A lesson inside a generated goal track.
 *
 * `generationState` is what separates a lesson that can be opened from a shell
 * that still needs its exercises built. Hand-authored lessons carry null and
 * are always ready.
 */
export type LessonGenerationState = 'pending' | 'generating' | 'ready';

/**
 * The learner's goal track: a shared, generated course built from their
 * onboarding "picture a moment" answer (migration 099).
 *
 * Shared is the point — two learners who want the same thing get the same
 * course, and the second one costs nothing to serve.
 */
export interface GoalTrack {
  courseId: string;
  goalKey: string;
  title: string;
  description: string;
  /** The learner's own ranked situations, in their order of importance. */
  scenarios: string[];
  lessons: {
    id: string;
    title: string;
    description: string;
    orderIndex: number;
    generationState: LessonGenerationState | null;
  }[];
}

// ─── Avatar System ──────────────────────────────────────────────

/**
 * How a user's avatar is rendered. 'preset' shows a tile from the premade
 * library (avatar_presets, migration 081); 'generated' shows the
 * photo-derived image stored in the private `avatars` bucket.
 */
// 'procedural' is retained ONLY because pre-077 rows still carry it. Nothing
// renders it any more — see Avatar.tsx. Do not use it for new writes.
export type AvatarKind = 'procedural' | 'preset' | 'generated';

/**
 * A photo-to-avatar art style, as surfaced to the client. The hidden image
 * prompt for each style lives server-side only, in
 * `supabase/functions/_shared/avatar-styles.ts` — never ship it to the client.
 */
export interface AvatarStyleOption {
  key: string;
  label: string;
  description: string;
}

export type AvatarSize = 'small' | 'medium' | 'large';

export interface AvatarAccessory {
  id: string;
  name: string;
  category: string;
  svgData: string;
  unlockType: 'free' | 'level' | 'achievement' | 'purchase';
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
  dailyNewCards: number;
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
