/**
 * The onboarding flow's fixed vocabulary: which steps exist, in what order,
 * and the copy tables the option steps render from. Pure data — no React, no
 * storage — so the screen, the step components and the tests share one
 * definition.
 */
import type { LanguageCode, ProficiencyLevel } from '../../../types';

// Dörnyei L2MSS: the learner's vision of themselves as a competent L2 user
// is the single strongest predictor of sustained effort (r ≈ 0.61). The
// language-specific placeholder gives a vivid, concrete anchor instead of
// an abstract prompt. research.md §11.1.
export const IDEAL_SELF_PLACEHOLDER: Partial<Record<LanguageCode, string>> = {
  es: 'Ordering coffee in Madrid without switching to English.',
  fr: 'Reading a whole novel in French by next summer.',
  de: 'Understanding the in-jokes at my partner\'s family dinners.',
  it: 'Navigating an Italian road trip with the locals.',
  pt: 'Chatting with my neighbors in Lisbon about football.',
  ja: 'Watching anime without subtitles.',
  ko: 'Singing K-pop and understanding every line.',
  zh: 'Haggling at a Beijing street market.',
  ru: 'Reading a Tolstoy short story in the original.',
  en: 'Giving a confident talk at work in English.',
};

/** Number of lit signal bars per self-reported level, shown on the level rows. */
export const LEVEL_BARS: Record<ProficiencyLevel, number> = {
  beginner: 1,
  elementary: 2,
  intermediate: 3,
  upper_intermediate: 4,
  advanced: 5,
};

export const LEVELS: { value: ProficiencyLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'I know a few words' },
  { value: 'elementary', label: 'Elementary', description: 'I can form basic sentences' },
  { value: 'intermediate', label: 'Intermediate', description: 'I can hold simple conversations' },
  { value: 'upper_intermediate', label: 'Upper Intermediate', description: 'I can discuss many topics' },
  { value: 'advanced', label: 'Advanced', description: 'I\'m nearly fluent' },
];

/**
 * Two steps have been removed from this flow, both deliberately.
 *
 * `motivation` (2026-08-08) asked why the learner was here and wrote
 * `user_profiles.motivation_reason`. `idealSelf` asks a sharper version of the
 * same question and is the signal the research actually rests on, so the weaker
 * one went. The column and the `MotivationReason` type are left in place.
 *
 * `mode` (2026-08-28) asked the learner to choose between a gamified and an
 * adult presentation. There is only one presentation now — XP, leagues and
 * celebration-as-reward are gone from the product — so the question described a
 * choice that no longer exists. `user_profiles.adult_mode` is dropped in
 * migration 091; unlike `motivation_reason` there is nothing left to restore.
 *
 * `building` (2026-09-11) was a 2.4-second progress animation over three stages
 * that fetched nothing. `planReveal` takes its slot and spends the same moment
 * showing the plan it used to pretend to build.
 *
 * `identity` (2026-09-13) — name and avatar — moved to the far side of sign-up
 * (`app/(app)/identity-setup.tsx`). The photo avatar is a model call behind a
 * JWT, and the learner should see the finished avatar before the paywall, so
 * the step now runs where the render can.
 */
export type Step =
  | 'language'
  | 'idealSelf'
  | 'level'
  | 'course'
  | 'goal'
  | 'notifications'
  | 'lesson'
  | 'planReveal'
  | 'save';

/**
 * Steps that show the progress header. `lesson` runs full-bleed with the
 * runner's own progress bar — two progress indicators stacked on one screen
 * measure different things and read as a bug — `planReveal` is the payoff, and
 * `save` is the ask that follows it; neither is another form to fill in.
 */
export const ALL_STEPS: Step[] = [
  'language',
  'idealSelf',
  'level',
  'course',
  'goal',
  'notifications',
];

/**
 * Every step in order, including the three that sit outside `ALL_STEPS`.
 *
 * `ALL_STEPS` drives the progress header and deliberately omits `lesson`,
 * `planReveal` and `save`. The funnel needs the whole path, or the last three
 * steps — where the learner is closest to converting and so where a drop-off
 * costs most — would be invisible.
 *
 * `planReveal` counts where `building` did not. The loader was a waiting room
 * nobody could leave on purpose, so counting it would only have padded the
 * funnel; the plan reveal is a screen a learner reads, reacts to, and can
 * abandon, which makes its drop-off a real number about the plan itself.
 */
export const FUNNEL_STEPS: Step[] = [
  'language',
  'idealSelf',
  'level',
  'course',
  'goal',
  'notifications',
  'lesson',
  'planReveal',
  'save',
];

export const IDEAL_SELF_MAX_CHARS = 300;
export const DISPLAY_NAME_MAX_CHARS = 24;

/**
 * Pre-selected defaults. A learner who taps straight through gets Spanish at
 * beginner — the most common pair — rather than an empty form that cannot
 * continue. Both are mirrored by `apply_onboarding_draft` (migration 127).
 */
export const DEFAULT_LANGUAGE: LanguageCode = 'es';
export const DEFAULT_LEVEL: ProficiencyLevel = 'beginner';
