/**
 * Centralized course structure configuration.
 * Used by seeding scripts to create CEFR-leveled courses, units, and lessons.
 *
 * Flagship languages get A1–C2 content.
 * Other languages get A1–B2 content.
 */

import type { CEFRLevel, LanguageCode } from '../types';

// ─── Flagship vs Standard Languages ────────────────────────────

export const FLAGSHIP_LANGUAGES: LanguageCode[] = ['es', 'fr', 'de', 'ja', 'zh', 'it'];

export const ALL_TARGET_LANGUAGES: LanguageCode[] = ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];

export const FLAGSHIP_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const STANDARD_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2'];

export function getLevelsForLanguage(lang: LanguageCode): CEFRLevel[] {
  return FLAGSHIP_LANGUAGES.includes(lang) ? FLAGSHIP_LEVELS : STANDARD_LEVELS;
}

// ─── Unit Themes Per CEFR Level ────────────────────────────────

export interface UnitTheme {
  title: string;
  description: string;
  topics: string[]; // Used for generating lessons, cards, readings, and prompts
}

export const UNIT_THEMES: Record<CEFRLevel, UnitTheme[]> = {
  A1: [
    { title: 'Greetings & Introductions', description: 'Say hello, introduce yourself, basic pleasantries', topics: ['hello', 'name', 'nationality', 'goodbye'] },
    { title: 'Personal Information', description: 'Age, occupation, phone number, email', topics: ['age', 'job', 'phone', 'address'] },
    { title: 'Family & Friends', description: 'Family members, descriptions of people', topics: ['family', 'siblings', 'appearance', 'personality'] },
    { title: 'Home & Living', description: 'Rooms, furniture, describing your home', topics: ['house', 'apartment', 'rooms', 'furniture'] },
    { title: 'Daily Routines', description: 'Morning, afternoon, evening activities', topics: ['morning', 'meals', 'sleep', 'schedule'] },
    { title: 'Food & Drink', description: 'Common foods, ordering at a cafe, preferences', topics: ['food', 'drink', 'restaurant', 'preferences'] },
    { title: 'Shopping & Numbers', description: 'Prices, quantities, basic transactions', topics: ['numbers', 'money', 'shopping', 'clothes'] },
    { title: 'Directions & Places', description: 'Ask and give simple directions, landmarks', topics: ['left', 'right', 'street', 'building'] },
  ],
  A2: [
    { title: 'Travel & Transportation', description: 'Booking tickets, at the airport, getting around', topics: ['train', 'bus', 'airport', 'hotel'] },
    { title: 'Health & Body', description: 'Body parts, symptoms, visiting the doctor', topics: ['body', 'illness', 'doctor', 'pharmacy'] },
    { title: 'Hobbies & Free Time', description: 'Sports, music, leisure activities', topics: ['sports', 'music', 'reading', 'cinema'] },
    { title: 'Work & School', description: 'Describing your job or studies, workplace vocabulary', topics: ['office', 'classroom', 'colleagues', 'schedule'] },
    { title: 'Weather & Seasons', description: 'Weather descriptions, seasonal activities', topics: ['sun', 'rain', 'snow', 'seasons'] },
    { title: 'Past Experiences', description: 'Talking about what happened yesterday, last week', topics: ['yesterday', 'vacation', 'childhood', 'memories'] },
    { title: 'Making Plans', description: 'Invitations, scheduling, future intentions', topics: ['weekend', 'invitation', 'appointment', 'plans'] },
    { title: 'Communication', description: 'Phone calls, messages, social media basics', topics: ['phone', 'email', 'message', 'internet'] },
  ],
  B1: [
    { title: 'Education & Learning', description: 'School systems, courses, learning methods', topics: ['university', 'exams', 'subjects', 'studying'] },
    { title: 'Work Life & Careers', description: 'Job interviews, workplace culture, responsibilities', topics: ['interview', 'career', 'salary', 'promotion'] },
    { title: 'Opinions & Preferences', description: 'Expressing and supporting opinions', topics: ['agree', 'disagree', 'prefer', 'recommend'] },
    { title: 'Storytelling & Narratives', description: 'Telling stories, sequencing events', topics: ['beginning', 'suddenly', 'meanwhile', 'ending'] },
    { title: 'Future Plans & Dreams', description: 'Goals, ambitions, conditional situations', topics: ['dream', 'goal', 'if', 'future'] },
    { title: 'Culture & Traditions', description: 'Festivals, customs, cultural differences', topics: ['festival', 'tradition', 'custom', 'celebration'] },
    { title: 'Environment & Nature', description: 'Nature vocabulary, environmental issues', topics: ['nature', 'pollution', 'animals', 'recycling'] },
    { title: 'Media & Entertainment', description: 'News, film, TV, book discussions', topics: ['news', 'film', 'series', 'book'] },
    { title: 'Health & Wellbeing', description: 'Healthy lifestyle, exercise, mental health', topics: ['exercise', 'diet', 'stress', 'sleep'] },
    { title: 'Technology in Daily Life', description: 'Apps, devices, digital communication', topics: ['smartphone', 'app', 'computer', 'social media'] },
  ],
  B2: [
    { title: 'Arguments & Persuasion', description: 'Building arguments, debating, persuasive language', topics: ['argue', 'evidence', 'counterpoint', 'persuade'] },
    { title: 'Abstract Concepts', description: 'Discussing ideas, beliefs, values', topics: ['freedom', 'justice', 'identity', 'morality'] },
    { title: 'News & Current Events', description: 'Understanding news reports, discussing events', topics: ['politics', 'economy', 'crisis', 'society'] },
    { title: 'Complex Narratives', description: 'Hypothetical situations, complex story structures', topics: ['hypothetical', 'perspective', 'flashback', 'twist'] },
    { title: 'Problem Solving', description: 'Analyzing problems, proposing solutions', topics: ['problem', 'solution', 'analyze', 'evaluate'] },
    { title: 'Professional Communication', description: 'Formal emails, presentations, negotiations', topics: ['presentation', 'negotiation', 'proposal', 'meeting'] },
    { title: 'Science & Innovation', description: 'Scientific discoveries, technology trends', topics: ['research', 'experiment', 'discovery', 'innovation'] },
    { title: 'Art & Literature', description: 'Discussing art, literary analysis, creative expression', topics: ['painting', 'novel', 'poetry', 'creativity'] },
    { title: 'Global Issues', description: 'Climate change, migration, inequality', topics: ['climate', 'migration', 'inequality', 'globalization'] },
    { title: 'Idioms & Advanced Vocabulary', description: 'Figurative language, collocations, register', topics: ['idiom', 'collocation', 'formal', 'slang'] },
  ],
  C1: [
    { title: 'Academic Writing & Research', description: 'Thesis statements, citations, academic register', topics: ['thesis', 'citation', 'methodology', 'analysis'] },
    { title: 'Literature & Literary Criticism', description: 'Analyzing literary works, themes, and techniques', topics: ['symbolism', 'narrative', 'protagonist', 'critique'] },
    { title: 'Politics & Governance', description: 'Political systems, policy debates, civic participation', topics: ['democracy', 'legislation', 'policy', 'election'] },
    { title: 'Philosophy & Ethics', description: 'Ethical dilemmas, philosophical arguments', topics: ['ethics', 'morality', 'logic', 'existence'] },
    { title: 'Economics & Business', description: 'Economic theory, market analysis, business strategy', topics: ['inflation', 'market', 'investment', 'strategy'] },
    { title: 'Nuanced Argumentation', description: 'Hedging, concession, rhetorical devices', topics: ['however', 'nevertheless', 'concede', 'rhetoric'] },
    { title: 'Media Literacy', description: 'Analyzing media bias, propaganda, critical reading', topics: ['bias', 'propaganda', 'source', 'credibility'] },
    { title: 'Cultural Identity & Migration', description: 'Diaspora, multiculturalism, identity formation', topics: ['diaspora', 'integration', 'identity', 'culture'] },
  ],
  C2: [
    { title: 'Mastery of Register & Style', description: 'Switching between formal, informal, literary registers', topics: ['register', 'tone', 'style', 'audience'] },
    { title: 'Advanced Literary Analysis', description: 'Deconstructing complex texts, intertextuality', topics: ['intertextuality', 'deconstruction', 'allegory', 'subtext'] },
    { title: 'Geopolitics & International Relations', description: 'Diplomatic language, international law, treaties', topics: ['diplomacy', 'sovereignty', 'treaty', 'sanction'] },
    { title: 'Philosophy of Language', description: 'Semantics, pragmatics, linguistic relativity', topics: ['semantics', 'pragmatics', 'meaning', 'context'] },
    { title: 'Specialized Academic Topics', description: 'Defending a thesis, peer review, research ethics', topics: ['peer review', 'hypothesis', 'replication', 'ethics'] },
    { title: 'Humor, Irony & Satire', description: 'Understanding and producing humor, sarcasm, wit', topics: ['irony', 'satire', 'sarcasm', 'wit'] },
    { title: 'Creative & Expressive Writing', description: 'Poetry, short fiction, personal essays', topics: ['poetry', 'fiction', 'memoir', 'voice'] },
    { title: 'Native-Level Fluency', description: 'Proverbs, regional dialects, subtle nuance', topics: ['proverb', 'dialect', 'nuance', 'colloquialism'] },
  ],
};

// ─── Lesson Templates Per Unit ──────────────────────────────────

export interface LessonTemplate {
  titleSuffix: string; // e.g. "Vocabulary", "Grammar Focus", "Conversation"
  description: string;
  estimatedMinutes: number;
  xpReward: number;
}

/** Standard lesson progression within each unit. */
export const LESSON_TEMPLATES: LessonTemplate[] = [
  { titleSuffix: 'Vocabulary', description: 'Learn key words and phrases for this topic', estimatedMinutes: 5, xpReward: 10 },
  { titleSuffix: 'Grammar Focus', description: 'Practice grammar structures used in this context', estimatedMinutes: 7, xpReward: 15 },
  { titleSuffix: 'Listening & Comprehension', description: 'Listen and understand dialogues on this topic', estimatedMinutes: 5, xpReward: 10 },
  { titleSuffix: 'Reading Practice', description: 'Read a short text and answer questions', estimatedMinutes: 6, xpReward: 12 },
  { titleSuffix: 'Writing Practice', description: 'Write sentences and short texts on this topic', estimatedMinutes: 8, xpReward: 15 },
  { titleSuffix: 'Speaking & Review', description: 'Practice speaking and review everything learned', estimatedMinutes: 7, xpReward: 15 },
];

// ─── Course Title Helpers ──────────────────────────────────────

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Mandarin Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  ru: 'Russian',
};

export function courseTitle(targetLang: LanguageCode): string {
  return `${LANGUAGE_NAMES[targetLang]} for English Speakers`;
}

export function courseDescription(targetLang: LanguageCode): string {
  return `Learn ${LANGUAGE_NAMES[targetLang]} from beginner to advanced with structured lessons, reading, writing, and speaking practice.`;
}
