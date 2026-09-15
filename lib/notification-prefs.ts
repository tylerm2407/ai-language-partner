/**
 * notification-prefs — which reminders the learner wants, and when.
 *
 * Four kinds, each independently switchable with its own time. They are stored
 * on the DEVICE (AsyncStorage), not in Postgres, because every notification
 * Fluenci sends is a LOCAL scheduled one — there is no push token and no server
 * sender (see `hooks/useNotifications.ts`). A preference the server cannot act
 * on does not belong in the server's row, and putting it there would imply a
 * sync that does not exist.
 *
 * This export surface is a contract: onboarding writes prefs into its draft and
 * calls `saveNotificationPrefs` at flush, Settings edits them later, and
 * `hooks/useNotifications.ts` schedules from them. Keep the names.
 *
 * No kind here frames absence as loss. Fluenci has no streaks and no hearts,
 * and a reminder is an invitation, never a penalty.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationKind = 'dailyGoal' | 'reviewsDue' | 'idealMoment' | 'weeklyRecap';

export interface NotificationPref {
  enabled: boolean;
  /** Local hour, 0-23. */
  hour: number;
  /** Local minute, 0-59. */
  minute: number;
  /**
   * 1-7 for the weekly kinds, absent for the daily ones.
   *
   * 1 = Sunday. This mirrors expo-notifications' `WEEKLY` trigger exactly, so
   * the value is handed to the scheduler untranslated — a second convention
   * would be one conversion away from a reminder that fires on the wrong day.
   */
  weekday?: number;
}

export type NotificationPrefs = Record<NotificationKind, NotificationPref>;

/** Stable iteration order, so a scheduler never depends on object key order. */
export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  'dailyGoal',
  'reviewsDue',
  'idealMoment',
  'weeklyRecap',
];

/** The kinds that carry a `weekday`. Everything else has it stripped. */
export const WEEKLY_NOTIFICATION_KINDS: readonly NotificationKind[] = ['idealMoment', 'weeklyRecap'];

export function isWeeklyKind(kind: NotificationKind): boolean {
  return WEEKLY_NOTIFICATION_KINDS.includes(kind);
}

/** 1 = Sunday, matching `NotificationPref.weekday`. */
export const SUNDAY = 1;

/**
 * Defaults.
 *
 * `dailyGoal` at 19:00 — after the working day, with enough evening left that
 * acting on it is realistic. `reviewsDue` at 08:30, because a review queue is
 * best cleared before the day fills up. `idealMoment` Sunday 18:00, a weekly
 * nudge tied to the learner's own reason for learning. `weeklyRecap` is OFF by
 * default: it is the only one of the four that reports rather than invites, and
 * a summary nobody asked for is the kind of notification people disable the app
 * over. Settings offers it; nothing opts anyone in.
 */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dailyGoal: { enabled: true, hour: 19, minute: 0 },
  reviewsDue: { enabled: true, hour: 8, minute: 30 },
  idealMoment: { enabled: true, hour: 18, minute: 0, weekday: SUNDAY },
  weeklyRecap: { enabled: false, hour: 18, minute: 0, weekday: SUNDAY },
};

const STORAGE_KEY = 'notifications:prefs:v1';

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

function validatePref(raw: unknown, kind: NotificationKind): NotificationPref {
  const fallback = DEFAULT_NOTIFICATION_PREFS[kind];
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const pref: NotificationPref = {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : fallback.enabled,
    hour: clampInt(source.hour, 0, 23, fallback.hour),
    minute: clampInt(source.minute, 0, 59, fallback.minute),
  };

  // `weekday` is added for the weekly kinds and dropped for the daily ones, so
  // a stored blob that has drifted (a kind that changed shape between releases)
  // still comes back in the shape the scheduler expects.
  if (isWeeklyKind(kind)) {
    pref.weekday = clampInt(source.weekday, 1, 7, fallback.weekday ?? SUNDAY);
  }

  return pref;
}

/**
 * Boundary validation. Anything can come out of AsyncStorage — an older build's
 * shape, a half-written JSON blob, a hand-edited value — so every field is
 * checked and falls back to its own default rather than the whole object being
 * thrown away. A learner who set a 06:30 review reminder keeps it even if some
 * unrelated field is corrupt.
 */
export function validateNotificationPrefs(raw: unknown): NotificationPrefs {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    dailyGoal: validatePref(source.dailyGoal, 'dailyGoal'),
    reviewsDue: validatePref(source.reviewsDue, 'reviewsDue'),
    idealMoment: validatePref(source.idealMoment, 'idealMoment'),
    weeklyRecap: validatePref(source.weeklyRecap, 'weeklyRecap'),
  };
}

/**
 * Read the learner's preferences.
 *
 * Falls back to the defaults when nothing is stored or the blob cannot be
 * parsed. That is not a swallowed error (CLAUDE.md §5): there is no outage to
 * surface — a device with no prefs yet is the normal first-run state, and the
 * defaults are a correct answer rather than a placeholder for one. A parse
 * failure is still logged, because that one is a bug.
 */
export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[notification-prefs] read failed, using defaults:', err);
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }

  if (!stored) return { ...DEFAULT_NOTIFICATION_PREFS };

  try {
    return validateNotificationPrefs(JSON.parse(stored));
  } catch (err) {
    console.warn('[notification-prefs] stored prefs were unparseable, using defaults:', err);
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

/**
 * Persist the learner's preferences.
 *
 * Validated on the way in as well as out, so a caller assembling prefs from a
 * form cannot store an hour of 27. Write failures propagate: a Settings toggle
 * that silently did not save is worse than one that says so.
 */
export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  const clean = validateNotificationPrefs(prefs);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
}
