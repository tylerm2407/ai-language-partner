/**
 * Language access — how many languages this plan lets a learner keep open,
 * and what the server said when a switch was refused (migration 147).
 *
 * Studying several languages at once is a paid feature. Free keeps one open;
 * starting another LOCKS the current one (its level, course and deck are kept,
 * but it cannot be reopened without a paid plan). A paid plan that lapses
 * leaves every enrollment open until the learner picks which to keep.
 *
 * The server is the gate — `switch_target_language`, `keep_languages` and a
 * BEFORE trigger on `user_profiles` all enforce it — and this module only
 * reads its answer. The allowance comes from `get_language_access()`, never
 * from the tier name on the device: a school contract can grant languages the
 * tier does not, and the subscription the device believes in may not have
 * reached the server yet.
 */
import type { LanguageCode } from '../types';

/** Same sentinel as `UNLIMITED_NEW_CARDS`: a paid plan's "no limit". */
export const UNLIMITED_LANGUAGES = 9999;

export interface LanguageAccess {
  /** Open languages the plan allows at once (9999 = unlimited). */
  maxLanguages: number;
  /** Open languages, most recently practised first. */
  open: LanguageCode[];
  /** Locked languages, most recently practised first. */
  locked: LanguageCode[];
  /**
   * More open than the plan allows — a paid plan lapsed. Switching is refused
   * until the learner picks what to keep (`keep_languages`).
   */
  overLimit: boolean;
}

/**
 * Why the server refused a switch. The codes are raised by migration 147:
 *   FLL01 `limit`   starting a new language would exceed the plan
 *   FLL02 `locked`  the language is locked and the plan cannot reopen it
 *   FLL03 `resolve` a lapsed plan: pick which languages to keep first
 */
export type LanguageAccessRefusal = 'limit' | 'locked' | 'resolve';

const REFUSAL_BY_CODE: Record<string, LanguageAccessRefusal> = {
  FLL01: 'limit',
  FLL02: 'locked',
  FLL03: 'resolve',
};

/**
 * The refusal carried by a thrown Supabase error, or null when the error is
 * something else (offline, session, a bug) and should take the ordinary
 * error-copy path. Reads the SQLSTATE only — never the message text.
 */
export function languageAccessRefusal(err: unknown): LanguageAccessRefusal | null {
  if (typeof err !== 'object' || err === null || !('code' in err)) return null;
  const { code } = err as { code: unknown };
  return typeof code === 'string' ? (REFUSAL_BY_CODE[code] ?? null) : null;
}

/** Parse `get_language_access()`'s jsonb. Unknown or malformed fields fail closed. */
export function parseLanguageAccess(raw: unknown): LanguageAccess {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown): LanguageCode[] =>
    Array.isArray(v) ? v.filter((x): x is LanguageCode => typeof x === 'string') : [];
  const max =
    typeof obj.maxLanguages === 'number' && Number.isFinite(obj.maxLanguages) && obj.maxLanguages >= 1
      ? Math.floor(obj.maxLanguages)
      : 1;
  const open = list(obj.open);
  return {
    maxLanguages: max,
    open,
    locked: list(obj.locked),
    // Recomputed rather than trusted, so the two can never disagree.
    overLimit: open.length > max,
  };
}

/** Whether the plan has room to open one more language right now. */
export function canOpenAnother(access: LanguageAccess): boolean {
  return access.open.length < access.maxLanguages;
}

export function isUnlimitedLanguages(access: LanguageAccess): boolean {
  return access.maxLanguages >= UNLIMITED_LANGUAGES;
}
