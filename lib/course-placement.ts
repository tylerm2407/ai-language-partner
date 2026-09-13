/**
 * Lesson path placement: which course a learner's lessons open on.
 *
 * Every published course is one (target_language, cefr_level) pair — A1 to B2
 * per language today, no C1 or C2 yet. A learner's self-declared level maps to
 * a band via `cefrBandForProficiencyLevel`; this module decides which course
 * that should open, what the onboarding and Settings choosers offer, and how
 * an account that has lost its pointer gets one back.
 *
 * Two facts live on the profile (migration 125):
 *
 *  - `currentCourseId`: a navigation pointer. Home and Learn open on it, and
 *    the Learn course pills move it, so the two always agree.
 *  - `placementBand`: the band of the course the learner STARTED in. The
 *    proficiency report treats bands strictly below it as assumed from
 *    placement rather than measured, so a learner placed at B1 is not told to
 *    go review A1 words forever. Stable — pills never touch it.
 *
 * Pure: no React, no network. Callers hand in the courses they already have.
 */

import type { Course, LanguageCode, ProficiencyLevel, UserProfile } from '../types';
import {
  CEFR_LADDER,
  cefrBandForProficiencyLevel,
  normalizeBand,
  type CefrBand,
} from './cefr-proficiency';
import { cefrCanDo } from './cefr-labels';

/**
 * What the learner chose about where to start.
 *
 *  - `start`: the course at their declared band (or the highest below it when
 *    none exists at the band — advanced learners land in B2).
 *  - `warm_up`: one band below their declared band first.
 *  - `none`: no lesson path; reading, chat and the tutor instead. Only offered
 *    when no course exists at the declared band.
 */
export type PlacementChoice = 'start' | 'warm_up' | 'none';

export interface PlacementOption {
  choice: PlacementChoice;
  /** Band of the course this option opens, or null for `none`. */
  band: CefrBand | null;
  title: string;
  /** A band is never shown bare (CLAUDE.md §1): this carries its can-do line. */
  subtitle: string;
}

export interface Placement {
  currentCourseId: string | null;
  placementBand: CefrBand;
}

export type PlacementState = 'placed' | 'no_course' | 'unplaced';

type PlacementProfile = Pick<UserProfile, 'currentCourseId' | 'placementBand'>;

export function bandBelow(band: CefrBand): CefrBand | null {
  const idx = CEFR_LADDER.indexOf(band);
  return idx > 0 ? CEFR_LADDER[idx - 1] : null;
}

function courseBand(course: Course): CefrBand | null {
  return normalizeBand(course.cefrLevel);
}

/** The published course at exactly this band, if there is one. */
export function courseForBand(courses: Course[], band: CefrBand): Course | null {
  return courses.find((c) => courseBand(c) === band) ?? null;
}

/** The highest course at or below `band` — what an advanced learner gets while no C1 exists. */
export function highestCourseAtOrBelow(courses: Course[], band: CefrBand): Course | null {
  const ceiling = CEFR_LADDER.indexOf(band);
  let best: Course | null = null;
  let bestIdx = -1;
  for (const course of courses) {
    const b = courseBand(course);
    if (!b) continue;
    const idx = CEFR_LADDER.indexOf(b);
    if (idx <= ceiling && idx > bestIdx) {
      best = course;
      bestIdx = idx;
    }
  }
  return best;
}

/**
 * The cards the onboarding and Settings choosers show for a declared level.
 *
 * Beginner gets none — there is nothing below A1 to warm up with, so the step
 * is skipped. Everyone up to upper-intermediate chooses between their band and
 * the one below it. Advanced has no C1 course, so the honest offer is the
 * highest path that exists or no path at all.
 *
 * `courses` is optional: before sign-in the curriculum tables are unreadable
 * (RLS `TO authenticated`), so onboarding calls this with the ladder alone and
 * resolves the actual course id after auth in `resolvePlacement`. When courses
 * ARE known, the options reflect what actually exists.
 */
export function placementOptionsFor(level: ProficiencyLevel, courses?: Course[]): PlacementOption[] {
  const band = cefrBandForProficiencyLevel(level);
  const below = bandBelow(band);
  if (!below) return [];

  const hasBand = courses ? courseForBand(courses, band) !== null : band !== 'C1' && band !== 'C2';
  if (hasBand) {
    return [
      { choice: 'start', band, title: `Start at ${band}`, subtitle: cefrCanDo(band) },
      {
        choice: 'warm_up',
        band: below,
        title: `Warm up with ${below} first`,
        subtitle: cefrCanDo(below),
      },
    ];
  }

  const fallback = courses ? highestCourseAtOrBelow(courses, band) : null;
  const fallbackBand: CefrBand | null = courses ? (fallback ? courseBand(fallback) : null) : 'B2';
  const options: PlacementOption[] = [];
  if (fallbackBand) {
    options.push({
      choice: 'start',
      band: fallbackBand,
      title: `Start at ${fallbackBand} (highest lesson path today)`,
      subtitle: cefrCanDo(fallbackBand),
    });
  }
  options.push({
    choice: 'none',
    band: null,
    title: 'No lessons for now',
    subtitle: 'Use reading, chat and the tutor instead.',
  });
  return options;
}

/**
 * Coerce a stored choice to one the level actually offers — a `warm_up` left
 * in a draft from an earlier level pick means nothing to a beginner.
 */
export function normalizePlacementChoice(
  level: ProficiencyLevel,
  choice: PlacementChoice | null | undefined,
): PlacementChoice {
  const offered = placementOptionsFor(level).map((o) => o.choice);
  if (choice && offered.includes(choice)) return choice;
  return 'start';
}

/** The course a choice opens, or null for `none` / nothing published. */
export function defaultCourseFor(
  courses: Course[],
  level: ProficiencyLevel,
  choice: PlacementChoice,
): Course | null {
  if (choice === 'none') return null;
  const band = cefrBandForProficiencyLevel(level);
  const target = choice === 'warm_up' ? bandBelow(band) ?? band : band;
  return courseForBand(courses, target) ?? highestCourseAtOrBelow(courses, target);
}

/**
 * Both profile facts for a choice. The placement band is the band of the
 * course actually opened; with no course it is the declared band, so the
 * report still knows where the learner says they stand.
 */
export function resolvePlacement(
  courses: Course[],
  level: ProficiencyLevel,
  choice: PlacementChoice,
): Placement {
  const course = defaultCourseFor(courses, level, choice);
  return {
    currentCourseId: course?.id ?? null,
    placementBand: (course ? courseBand(course) : null) ?? cefrBandForProficiencyLevel(level),
  };
}

/**
 * Where the account stands, given the courses for its language.
 *
 *  - `placed`: has a pointer.
 *  - `no_course`: no pointer, and no course exists at the placement band — a
 *    deliberate "no lesson path" (advanced, no C1 yet). Learn shows its
 *    empty state; the pills stay so they can opt in.
 *  - `unplaced`: no placement band at all (pre-migration account), or no
 *    pointer while a course DOES exist at the band (FK SET NULL, or the guard
 *    trigger cleared a stale pointer on a language change). Needs healing.
 */
export function placementState(profile: PlacementProfile, courses: Course[]): PlacementState {
  if (profile.currentCourseId) return 'placed';
  const band = normalizeBand(profile.placementBand);
  if (!band) return 'unplaced';
  return courseForBand(courses, band) ? 'unplaced' : 'no_course';
}

/**
 * Which pill the Learn tab opens on. The stored pointer wins when it is one of
 * the courses shown; a deliberate no-course stays null; anything else falls to
 * the level's default so the screen is never empty by accident.
 */
export function initialCourseSelection(
  courses: Course[],
  profile: PlacementProfile & Pick<UserProfile, 'level'>,
): string | null {
  if (profile.currentCourseId && courses.some((c) => c.id === profile.currentCourseId)) {
    return profile.currentCourseId;
  }
  if (placementState(profile, courses) === 'no_course') return null;
  return defaultCourseFor(courses, profile.level, 'start')?.id ?? courses[0]?.id ?? null;
}

/** Settings' answer to "move your lessons too?" — or `none` for "lessons off". */
export type SettingsPlacementDecision = 'keep' | 'move' | 'none';

/** True when the level moved but the language did not: the one case worth a confirm. */
export function settingsNeedsPlacementConfirm(
  previousLevel: ProficiencyLevel,
  nextLevel: ProficiencyLevel,
  previousLanguage: LanguageCode,
  nextLanguage: LanguageCode,
): boolean {
  return previousLevel !== nextLevel && previousLanguage === nextLanguage;
}

/**
 * What Settings should write alongside a level or language change. Null means
 * "leave both placement columns alone".
 *
 * A language change always re-places (the old pointer names a course in the
 * old language; `courses` here are for the NEW language). A level change in
 * the same language follows the learner's answer to the confirm.
 */
export function placementAfterSettingsChange(args: {
  previous: Pick<UserProfile, 'level' | 'targetLanguage' | 'currentCourseId' | 'placementBand'>;
  nextLevel: ProficiencyLevel;
  nextLanguage: LanguageCode;
  courses: Course[];
  decision: SettingsPlacementDecision;
}): Placement | null {
  const { previous, nextLevel, nextLanguage, courses, decision } = args;
  if (previous.targetLanguage !== nextLanguage) {
    return resolvePlacement(courses, nextLevel, 'start');
  }
  if (previous.level === nextLevel) return null;
  if (decision === 'keep') return null;
  return resolvePlacement(courses, nextLevel, decision === 'none' ? 'none' : 'start');
}
