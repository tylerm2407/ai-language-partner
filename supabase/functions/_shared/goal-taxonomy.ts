// The closed vocabulary a learner's free-text goal is mapped onto, and the
// canonical key built from it.
//
// WHY CLOSED
//
// Onboarding asks learners to "picture a moment you'd love to have in this
// language" and stores the answer in `user_profiles.ideal_l2_self`. Two people
// will write that moment a hundred different ways — "order dinner in Paris
// without switching to English", "not panic in a French restaurant" — and a
// generated track costs real money to build.
//
// So the free text is mapped onto a FIXED vocabulary and the result is a key.
// Identical keys reuse an existing track at zero model cost. That only works
// if the vocabulary is closed and small: if the model could invent domains or
// scenarios, every learner would mint a unique key, nothing would ever be
// reused, and the reuse mechanism would be decorative. Every value the mapper
// may return is listed here, and anything else is rejected rather than
// coerced — a silently-accepted unknown value is a key that matches nothing
// forever.
//
// The scenario names that overlap `_shared/scenarios.ts` deliberately use the
// SAME strings, so a goal track and the chat role-play for the same situation
// can be tied together later without a translation layer.

/** Broad area of life the goal sits in. One per goal. */
export const GOAL_DOMAINS = [
  'travel',
  'hospitality',
  'work',
  'business',
  'healthcare',
  'academia',
  'family',
  'social',
  'romance',
  'daily_life',
  'housing_admin',
  'media_culture',
  'sport_fitness',
  'technology',
] as const;
export type GoalDomain = (typeof GOAL_DOMAINS)[number];

/**
 * Concrete situations a track can teach. A goal names up to three, ranked by
 * how central they are to the learner's stated moment.
 *
 * Kept deliberately short. Every scenario added multiplies the number of
 * distinct keys and so divides the chance that two learners share one.
 */
export const GOAL_SCENARIOS = [
  'restaurant',
  'cafe_bar',
  'airport_hotel',
  'directions',
  'public_transport',
  'shopping',
  'doctor',
  'pharmacy',
  'emergency',
  'job_interview',
  'work_meeting',
  'presentation',
  'negotiation',
  'customer_service',
  'phone_call',
  'small_talk',
  'making_friends',
  'dating',
  'meeting_family',
  'hosting',
  'apartment_hunting',
  'bank_admin',
  'government_office',
  'university_class',
  'seminar_discussion',
  'news_discussion',
  'film_tv_discussion',
  'music_discussion',
  'book_discussion',
  'sports_watching',
  'gym_training',
  'hobby_club',
  'gaming',
  'tech_support',
] as const;
export type GoalScenario = (typeof GOAL_SCENARIOS)[number];

/** How the learner needs to sound. Drives politeness forms, not vocabulary. */
export const GOAL_REGISTERS = ['formal', 'neutral', 'informal'] as const;
export type GoalRegister = (typeof GOAL_REGISTERS)[number];

/** Most scenarios a single key carries. More than three stops being a goal. */
export const MAX_SCENARIOS = 3;

export interface GoalShape {
  domain: GoalDomain;
  /** Ranked most-central first. 1..MAX_SCENARIOS entries, no duplicates. */
  scenarios: GoalScenario[];
  register: GoalRegister;
}

const DOMAIN_SET: ReadonlySet<string> = new Set(GOAL_DOMAINS);
const SCENARIO_SET: ReadonlySet<string> = new Set(GOAL_SCENARIOS);
const REGISTER_SET: ReadonlySet<string> = new Set(GOAL_REGISTERS);

export function isGoalDomain(v: unknown): v is GoalDomain {
  return typeof v === 'string' && DOMAIN_SET.has(v);
}
export function isGoalScenario(v: unknown): v is GoalScenario {
  return typeof v === 'string' && SCENARIO_SET.has(v);
}
export function isGoalRegister(v: unknown): v is GoalRegister {
  return typeof v === 'string' && REGISTER_SET.has(v);
}

/**
 * Accept a mapper result only if every part of it is in the vocabulary.
 *
 * Unknown values are DROPPED, not coerced to a default. A goal quietly
 * rewritten to `travel` because the model said `vacationing` would build the
 * wrong track and, worse, would look like it worked.
 */
export function parseGoalShape(value: unknown): GoalShape | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (!isGoalDomain(raw.domain)) return null;
  if (!isGoalRegister(raw.register)) return null;
  if (!Array.isArray(raw.scenarios)) return null;

  const scenarios: GoalScenario[] = [];
  for (const s of raw.scenarios) {
    if (isGoalScenario(s) && !scenarios.includes(s)) scenarios.push(s);
    if (scenarios.length === MAX_SCENARIOS) break;
  }
  if (scenarios.length === 0) return null;

  return { domain: raw.domain, scenarios, register: raw.register };
}

/**
 * The canonical key. Identical goals must produce byte-identical keys.
 *
 * Scenarios are SORTED here even though the mapper ranks them, because the
 * ranking is the model's opinion and two learners who want the same three
 * situations should share a track whichever order it happened to list them in.
 * The ranking still matters — it is kept alongside the key and decides lesson
 * order — but it must not fragment the key.
 */
export function goalKey(language: string, shape: GoalShape): string {
  const scenarios = [...shape.scenarios].sort().join('+');
  return `${language}:${shape.domain}:${scenarios}:${shape.register}`;
}

/**
 * How close two goals are, as the share of scenarios they have in common
 * (Jaccard). Only meaningful for goals already in the same language, domain
 * and register — the caller filters on those first.
 *
 * This is what lets a near-miss reuse an existing track instead of paying to
 * build a near-duplicate: someone wanting {restaurant, cafe_bar, small_talk}
 * is well served by a track built for {restaurant, cafe_bar, shopping}.
 */
export function scenarioOverlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const s of new Set(a)) if (setB.has(s)) shared++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : shared / union;
}

/**
 * Reuse threshold.
 *
 * 0.5 means two of three scenarios shared (2/4 = 0.5) is close enough. Set
 * higher and almost nothing is reused and the cost control does not bite; set
 * lower and a learner who asked about job interviews is handed a track about
 * ordering coffee.
 */
export const REUSE_OVERLAP_THRESHOLD = 0.5;
