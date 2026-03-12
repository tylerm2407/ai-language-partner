import type { LanguageCode } from '../types';

export const APP_NAME = 'languageAI';
export const APP_DISPLAY_NAME = 'languageAI';
export const APP_VERSION = '1.0.0';

export const SUPPORTED_LANGUAGES: { code: LanguageCode; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
];

export const DIFFICULTY_LEVELS = [
  { key: 'beginner', label: 'Beginner', description: 'No prior knowledge' },
  { key: 'elementary', label: 'Elementary', description: 'Basic words and phrases' },
  { key: 'intermediate', label: 'Intermediate', description: 'Simple conversations' },
  { key: 'upper_intermediate', label: 'Upper Intermediate', description: 'Complex topics' },
  { key: 'advanced', label: 'Advanced', description: 'Near-native fluency' },
] as const;

export const SRS_DEFAULTS = {
  initialEaseFactor: 2.5,
  minimumEaseFactor: 1.3,
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  graduatingInterval: 1, // days
  easyInterval: 4, // days
};

export const FEATURE_FLAGS = {
  enableSpeaking: true,
  enableAIConversation: true,
  enableStreaks: true,
  enableLeaderboards: false,
  enableOfflineMode: true,
  enableDarkMode: true,
  enablePushNotifications: false, // enable after implementing
  enableInAppPurchases: false, // Stripe only for now
};

export const SESSION_DEFAULTS = {
  dailyGoalMinutes: 10,
  lessonExerciseCount: 12,
  reviewBatchSize: 20,
};
