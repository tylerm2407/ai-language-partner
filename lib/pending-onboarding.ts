/**
 * Pre-auth onboarding persistence.
 *
 * Onboarding runs before the user has an account (DESIGN.md §UX Psychology
 * Principles #3 Reciprocity and #4 IKEA Effect): the learner picks a language,
 * personalises an avatar, and PLAYS A WHOLE LESSON before they are ever asked
 * for an email. Those answers live here until a session exists, at which point
 * the onboarding screen flushes them into the real profile and clears this
 * entry.
 *
 * Device-local by design. If the user never signs up, nothing is written
 * server-side and the draft simply expires.
 *
 * There is no user id to scope this key on — that is the whole point, the
 * draft predates the account. So the only defence against one learner's draft
 * reaching another learner on a shared device is how long it survives
 * unclaimed, which is why there are two TTLs below rather than one.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  LanguageCode,
  ProficiencyLevel,
} from '../types';

export const PENDING_ONBOARDING_KEY = 'pending-onboarding';
export const PENDING_ONBOARDING_SCHEMA_VERSION = 1;
/** In-progress drafts older than this are discarded on load. */
export const PENDING_ONBOARDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How long a draft stays claimable AFTER `completedAt` is stamped.
 *
 * A completed draft is the dangerous one. It is the fully populated one —
 * display name, the free-text `idealL2Self` goal, level, trial XP — and it is
 * the one `isFlushable` lets the onboarding screen write into whatever account
 * happens to be signed in when it is next read. On a shared device (the
 * university pilots put several learners on one iPad) seven days of that means
 * learner A abandons the sign-up screen, learner B opens the app and either
 * sees A's name and personal goal prefilled, or — if B signs into an account
 * whose profile is still incomplete — has A's answers silently written into
 * their profile.
 *
 * Its legitimate remaining life is one round trip: type an email, possibly
 * bounce out to a confirmation link, come back. An hour covers that with room
 * to spare and cuts the exposure window from 168 hours to 1. The in-progress
 * TTL above stays at seven days because that draft is a resume convenience
 * with no account waiting to receive it.
 *
 * Deliberately NOT a PENDING_ONBOARDING_SCHEMA_VERSION bump: `completedAt`
 * already exists on the stored shape, so nothing about the blob layout
 * changed and bumping would throw away every in-flight draft for no reason.
 */
export const PENDING_ONBOARDING_COMPLETED_TTL_MS = 60 * 60 * 1000;

/**
 * What the learner did in the pre-auth trial lesson.
 *
 * Kept so the sign-up screen can name the actual numbers ("keep your 20 XP")
 * rather than gesture at "your progress", and so the post-signup flush can
 * tick the first-lesson checklist item for work that really happened.
 *
 * NOT a substitute for a lesson completion row. The trial lesson is bundled in
 * the app (components/onboarding/trial-lesson.ts) and has no `lessons.id`, so
 * there is nothing to record against — the XP is granted on flush, the
 * completion is not.
 */
export interface TrialLessonResult {
  xpEarned: number;
  correctCount: number;
  totalCount: number;
  /** ISO timestamp the trial finished. */
  completedAt: string;
}

export interface PendingOnboarding {
  version: number;
  targetLanguage: LanguageCode | null;
  idealL2Self: string | null;
  level: ProficiencyLevel | null;
  /** Null until the learner finishes the pre-auth trial lesson. */
  trial: TrialLessonResult | null;
  displayName: string | null;
  /** Chosen preset id from the premade library, or null if skipped. */
  avatarPresetId: string | null;
  dailyGoalMinutes: number | null;
  /**
   * Adult mode vs gamified, chosen in onboarding. Null = not yet answered.
   *
   * Deliberately NOT versioned-out: `isValidPending` checks only `version` and
   * `startedAt`, so drafts written before this field existed still load with it
   * absent. Bumping PENDING_ONBOARDING_SCHEMA_VERSION for a purely additive
   * optional field would discard every in-flight draft inside the 7-day TTL —
   * including learners who finished the trial lesson and are one tap from
   * signing up.
   */
  adultMode: boolean | null;
  /** Epoch ms the draft was first created — the TTL reference. */
  startedAt: number;
  /** ISO timestamp set when the pre-auth flow finished and auth was reached. */
  completedAt: string | null;
}

export type PendingOnboardingDraft = Omit<PendingOnboarding, 'version' | 'startedAt'>;

export function emptyPendingOnboarding(): PendingOnboardingDraft {
  return {
    targetLanguage: null,
    idealL2Self: null,
    level: null,
    trial: null,
    displayName: null,
    avatarPresetId: null,
    dailyGoalMinutes: null,
    adultMode: null,
    completedAt: null,
  };
}

function isValidPending(value: unknown): value is PendingOnboarding {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.version === 'number' && typeof v.startedAt === 'number';
}

/**
 * Persist the draft. `startedAt` is preserved across saves so the TTL measures
 * from when onboarding began, not from the most recent keystroke.
 */
export async function savePendingOnboarding(
  draft: PendingOnboardingDraft,
  startedAt?: number,
): Promise<void> {
  const payload: PendingOnboarding = {
    version: PENDING_ONBOARDING_SCHEMA_VERSION,
    startedAt: startedAt ?? Date.now(),
    ...draft,
  };
  await AsyncStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify(payload));
}

/**
 * Load the draft. Returns null (and clears the entry) when it is missing,
 * corrupt, from a different schema version, or past its TTL.
 */
export async function loadPendingOnboarding(): Promise<PendingOnboarding | null> {
  const raw = await AsyncStorage.getItem(PENDING_ONBOARDING_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
    return null;
  }

  if (!isValidPending(parsed) || parsed.version !== PENDING_ONBOARDING_SCHEMA_VERSION) {
    await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
    return null;
  }

  if (Date.now() - parsed.startedAt > PENDING_ONBOARDING_TTL_MS) {
    await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
    return null;
  }

  // A completed draft gets the much shorter claim window. An unparseable
  // `completedAt` is treated as expired rather than ignored: a stamp we cannot
  // read is a stamp we cannot bound, and an unbounded completed draft is
  // exactly the one that must not survive.
  if (parsed.completedAt !== null && parsed.completedAt !== undefined) {
    const completedMs = Date.parse(String(parsed.completedAt));
    if (
      !Number.isFinite(completedMs) ||
      Date.now() - completedMs > PENDING_ONBOARDING_COMPLETED_TTL_MS
    ) {
      await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
      return null;
    }
  }

  return parsed;
}

export async function clearPendingOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
}

/**
 * A draft is only flushable once the learner reached the auth screen with the
 * two fields the profile cannot be written without.
 */
export function isFlushable(pending: PendingOnboarding | null): boolean {
  return !!pending?.completedAt && !!pending.targetLanguage && !!pending.level;
}
