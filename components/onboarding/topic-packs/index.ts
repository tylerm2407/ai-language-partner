/**
 * Bundled, topic-matched MICRO lessons for the pre-auth onboarding trial.
 *
 * The public contract the onboarding screen imports. See `spec.ts` for why
 * packs are bundled, why every exercise must be gradeable on-device, and how
 * a missing audio clip degrades instead of breaking.
 *
 * Coverage is all 9 `SUPPORTED_LANGUAGES` × all 5 topics = 45 packs. English
 * has none: `LanguageCode` includes `'en'` because it is everyone's native
 * language in this product, not a course anyone can pick in onboarding.
 */
import type { LanguageCode } from '../../../types';
import { DE_PACKS } from './de';
import { ES_PACKS } from './es';
import { FR_PACKS } from './fr';
import { IT_PACKS } from './it';
import { JA_PACKS } from './ja';
import { KO_PACKS } from './ko';
import { PT_PACKS } from './pt';
import { RU_PACKS } from './ru';
import {
  buildPack,
  TOPIC_KEYS,
  TRIAL_LESSON_ID,
  TRIAL_LESSON_XP,
  type LanguagePacks,
  type PackWord,
  type TopicKey,
  type TopicPack,
} from './spec';
import { ZH_PACKS } from './zh';

export { TOPIC_KEYS, TRIAL_LESSON_ID, TRIAL_LESSON_XP };
export type { PackWord, TopicKey, TopicPack };

const PACKS_BY_LANGUAGE: Partial<Record<LanguageCode, LanguagePacks>> = {
  es: ES_PACKS,
  fr: FR_PACKS,
  de: DE_PACKS,
  it: IT_PACKS,
  pt: PT_PACKS,
  ja: JA_PACKS,
  ko: KO_PACKS,
  zh: ZH_PACKS,
  ru: RU_PACKS,
};

/**
 * The five chips shown under the `idealSelf` text box, now carrying the topic
 * key each one implies.
 *
 * The tags and sentences are verbatim what `app/(public)/onboarding.tsx`
 * already shows — moved here rather than rewritten, because changing the copy
 * and changing where it lives in one step makes a regression in either look
 * like a regression in the other.
 */
export const TOPIC_CHIPS: { key: TopicKey; tag: string; text: (languageName: string) => string }[] = [
  {
    key: 'travel',
    tag: 'Travel',
    text: (l) => `Getting around on a trip and never needing English, in ${l}.`,
  },
  {
    key: 'family',
    tag: 'Family',
    text: (l) => `Following the whole conversation at a family dinner in ${l}.`,
  },
  {
    key: 'work',
    tag: 'Work',
    text: (l) => `Running a meeting in ${l} without preparing every line.`,
  },
  {
    key: 'media_culture',
    tag: 'Films & music',
    text: (l) => `Watching a film in ${l} with the subtitles off.`,
  },
  {
    key: 'housing_admin',
    tag: 'Moving abroad',
    text: (l) => `Settling in somewhere ${l} is spoken and feeling at home.`,
  },
];

export function hasTopicPack(language: LanguageCode, topic: TopicKey): boolean {
  return PACKS_BY_LANGUAGE[language]?.[topic] !== undefined;
}

/**
 * The runnable pack for this language and topic, or null when the language has
 * none.
 *
 * Deliberately does NOT fall back to another language or another topic. A
 * learner who picked Korean and is handed a Spanish lesson has been shown the
 * wrong product at the exact moment the flow is meant to prove it works — the
 * caller skips the trial instead, which is the same rule `trial-lesson.ts` has
 * always followed.
 *
 * Built on each call rather than memoised: `resolveTrialAudio` decides whether
 * an exercise is a listening or a reading one, and an asset that has not
 * finished resolving at first call must not be baked into a cached pack.
 */
export function topicPackFor(language: LanguageCode, topic: TopicKey): TopicPack | null {
  const packs = PACKS_BY_LANGUAGE[language];
  const spec = packs?.[topic];
  if (!packs || !spec) return null;

  const siblingSentenceGlosses = TOPIC_KEYS.filter((key) => key !== topic).map(
    (key) => packs[key].sentence.gloss,
  );

  return buildPack(language, topic, spec, { siblingSentenceGlosses });
}

/**
 * Keyword weights for `topicFromIdealText`.
 *
 * Whole-token matching only — "work" must not fire on "homework", "read" must
 * not fire on "already". Inflections are listed out rather than stemmed: a
 * stemmer is a dependency and a source of surprises, and the vocabulary here
 * is small enough to enumerate.
 *
 * Two rules keep the five chip sentences unambiguous:
 *  - "home" is NOT a family word. The "Moving abroad" chip ends "feeling at
 *    home", and a tie between family and housing_admin returns null, which
 *    would silently drop the topic for the chip most likely to be tapped by
 *    someone who is actually moving.
 *  - "dinner" is NOT a family word either — it belongs to a restaurant as
 *    readily as to a kitchen table. "family" alone carries that chip.
 */
const TOPIC_KEYWORDS: Record<TopicKey, string[]> = {
  travel: [
    'travel', 'travelling', 'traveling', 'travels', 'trip', 'trips', 'holiday',
    'holidays', 'vacation', 'tourist', 'backpacking', 'sightseeing', 'hostel',
    'hotel', 'airport', 'flight', 'train', 'station', 'taxi', 'directions',
    'menu', 'waiter', 'ordering', 'order', 'coffee', 'cafe', 'café',
    'restaurant', 'market', 'visiting', 'visit', 'abroad',
  ],
  family: [
    'family', 'families', 'mother', 'mothers', 'mum', 'mom', 'father',
    'fathers', 'dad', 'parents', 'grandmother', 'grandma', 'grandfather',
    'grandpa', 'grandparents', 'relatives', 'cousin', 'cousins', 'sibling',
    'siblings', 'brother', 'brothers', 'sister', 'sisters', 'kids',
    'children', 'wife', 'husband', 'spouse', 'partners', 'in-laws',
    'grandchildren', 'nephew', 'niece',
  ],
  work: [
    'work', 'working', 'job', 'jobs', 'career', 'meeting', 'meetings',
    'colleague', 'colleagues', 'coworkers', 'office', 'client', 'clients',
    'customer', 'business', 'interview', 'presentation', 'presenting',
    'boss', 'manager', 'team', 'professional', 'conference', 'negotiate',
    'negotiating', 'standup',
  ],
  media_culture: [
    'film', 'films', 'movie', 'movies', 'cinema', 'series', 'show', 'shows',
    'anime', 'manga', 'subtitle', 'subtitles', 'dubbed', 'music', 'song',
    'songs', 'lyrics', 'singing', 'sing', 'album', 'band', 'book', 'books',
    'novel', 'novels', 'story', 'stories', 'poetry', 'read', 'reading',
    'watch', 'watching', 'listening', 'podcast', 'podcasts', 'kpop',
    'k-pop', 'drama', 'dramas', 'theatre', 'theater',
  ],
  housing_admin: [
    'move', 'moves', 'moving', 'moved', 'relocate', 'relocating',
    'relocation', 'settle', 'settling', 'emigrate', 'immigrate',
    'emigrating', 'rent', 'renting', 'apartment', 'apartments', 'flat',
    'landlord', 'lease', 'tenancy', 'visa', 'residency', 'permit',
    'paperwork', 'bureaucracy', 'admin', 'bank', 'doctor', 'appointment',
    'neighbours', 'neighbors', 'neighbour', 'neighbor', 'live', 'living',
    'expat', 'utilities',
  ],
};

/**
 * Guess the topic behind a free-typed ideal-self sentence.
 *
 * Returns null when it cannot tell — no keyword hit, or a tie at the top. A
 * wrong guess here costs more than no guess: the caller falls back to asking,
 * whereas a confident mismatch hands a learner who wrote about their in-laws a
 * lesson about apartment viewings.
 */
export function topicFromIdealText(text: string): TopicKey | null {
  const tokens = new Set(
    text
      .toLowerCase()
      // Keep the hyphen and the apostrophe-free accented letters: "in-laws"
      // and "k-pop" are single tokens, and "café" must not become "caf".
      .split(/[^\p{L}\p{N}-]+/u)
      .filter(Boolean),
  );
  if (tokens.size === 0) return null;

  let best: TopicKey | null = null;
  let bestScore = 0;
  let tied = false;

  for (const topic of TOPIC_KEYS) {
    const score = TOPIC_KEYWORDS[topic].reduce(
      (total, keyword) => total + (tokens.has(keyword) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      best = topic;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && score > 0) {
      tied = true;
    }
  }

  if (bestScore === 0 || tied) return null;
  return best;
}
