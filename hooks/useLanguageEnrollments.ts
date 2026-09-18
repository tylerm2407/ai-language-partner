/**
 * useLanguageEnrollments — the languages this learner studies, and the switch
 * between them (migration 133).
 *
 * A learner may be part-way through Spanish and starting Russian. Each of
 * those is an enrollment: its own declared level, its own placement band, its
 * own course. `profile.targetLanguage` names whichever one is active, and
 * every screen keeps reading the profile — so the only thing that has to know
 * enrollments exist is the switcher.
 *
 * Switching is a server call (`switch_target_language`), not a profile write:
 * it snapshots the language being left before restoring the one being entered,
 * and half of that applying would lose a learner's course.
 *
 * What the switch has to invalidate on the client, and why:
 *  - `measuredBand` is the proficiency report's answer for the OLD language.
 *    Left in place it would price the first Russian chat at the learner's
 *    Spanish B1. Cleared; `useProficiencyReport` measures the new one.
 *  - the due-review badge is counted per language (`fetchReviewItemCount`), so
 *    it is refreshed rather than left showing the other deck's number.
 * The read caches need no purge: every language-sensitive key already carries
 * the language (review queue, insights, ranked books, courses).
 *
 * And the NAVIGATOR is reset — every stack popped to its root, Home selected.
 * The tab navigator keeps each tab's stack across a switch, so without this a
 * learner who switched away mid-lesson found that lesson still waiting on the
 * Learn tab, in the language they had just left. See
 * lib/language-switch-navigation.ts for why it pops every stack rather than a
 * list of the language-specific ones.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigationContainerRef } from 'expo-router';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import {
  fetchCourses,
  fetchLanguageAccess,
  fetchLanguageEnrollments,
  keepLanguages,
  switchTargetLanguage,
} from '../lib/supabase-queries';
import type { LanguageAccess } from '../lib/language-access';
import { resolvePlacement } from '../lib/course-placement';
import { loadErrorCopy, type ErrorCopy } from '../lib/error-copy';
import { trackEvent } from '../lib/analytics';
import { languageSwitchNavigationActions } from '../lib/language-switch-navigation';
import type { LanguageCode, LanguageEnrollment, ProficiencyLevel } from '../types';

export interface UseLanguageEnrollments {
  enrollments: LanguageEnrollment[];
  /** Which language the app is showing right now. */
  active: LanguageCode | null;
  loading: boolean;
  /** Non-null when the list could not be read and there is nothing to show. */
  error: ErrorCopy | null;
  /** The language a switch is currently in flight for, or null. */
  switching: LanguageCode | null;
  reload: () => Promise<void>;
  /**
   * The plan's language allowance (migration 147), or null until the first
   * read lands or when it failed (then `error` is set). Consumers must treat
   * null as "unknown", not as "unlimited".
   */
  access: LanguageAccess | null;
  /** Move to a language the learner already studies. Throws the server's
   *  refusal (FLL0x, see lib/language-access.ts) when the plan says no. */
  switchTo: (language: LanguageCode) => Promise<void>;
  /**
   * Start a language the learner has never studied, at `level`.
   * `lockCurrent` is the free tier's "switch instead": the language being
   * left is locked in the same server transaction.
   */
  addLanguage: (
    language: LanguageCode,
    level: ProficiencyLevel,
    options?: { lockCurrent?: boolean },
  ) => Promise<void>;
  /** Resolve a lapsed plan: keep `languages` open, lock every other one. */
  keep: (languages: LanguageCode[]) => Promise<void>;
}

export function useLanguageEnrollments(): UseLanguageEnrollments {
  const { user } = useAuth();
  const active = useAppStore((s) => s.profile?.targetLanguage ?? null);
  const setProfile = useAppStore((s) => s.setProfile);
  const setMeasuredBand = useAppStore((s) => s.setMeasuredBand);
  const refreshReviewCount = useAppStore((s) => s.refreshReviewCount);

  const [enrollments, setEnrollments] = useState<LanguageEnrollment[]>([]);
  const [access, setAccess] = useState<LanguageAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [switching, setSwitching] = useState<LanguageCode | null>(null);
  const rootNavigation = useNavigationContainerRef();

  const reload = useCallback(async () => {
    if (!user) {
      setEnrollments([]);
      setAccess(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Read together so the list and the allowance describe the same moment.
      const [list, allowance] = await Promise.all([fetchLanguageEnrollments(), fetchLanguageAccess()]);
      setEnrollments(list);
      setAccess(allowance);
      setError(null);
    } catch (err) {
      // An empty list and a failed read look identical in the switcher, and
      // "you study no languages" is a claim (CLAUDE.md §5).
      setError(loadErrorCopy(err, 'your languages'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
    // `active` is in the deps so the list re-reads after a switch made
    // elsewhere (Settings and the Home chip are two mounts of this hook).
  }, [reload, active]);

  /**
   * Drop every screen the learner was on in the language they left.
   *
   * Dispatched before the profile is adopted: the screens being popped read
   * the profile, and letting a Russian lesson re-render against a Spanish
   * profile for a frame is exactly the mixed state this is here to prevent.
   */
  const resetNavigation = useCallback(() => {
    if (!rootNavigation.isReady()) return;
    for (const action of languageSwitchNavigationActions(rootNavigation.getRootState())) {
      rootNavigation.dispatch(action);
    }
  }, [rootNavigation]);

  /** Shared tail of both switch paths: adopt the new profile, drop the old
   *  language's derived state and screens, and re-read the list. */
  const adopt = useCallback(
    async (profile: Awaited<ReturnType<typeof switchTargetLanguage>>) => {
      resetNavigation();
      setProfile(profile);
      setMeasuredBand(null);
      if (user) void refreshReviewCount(user.id);
      await reload();
    },
    [resetNavigation, setProfile, setMeasuredBand, refreshReviewCount, user, reload],
  );

  const switchTo = useCallback(
    async (language: LanguageCode) => {
      if (!user || language === active) return;
      setSwitching(language);
      try {
        const profile = await switchTargetLanguage(language);
        await adopt(profile);
        // `source` says which of the two switcher paths this was — the fixed
        // vocabulary the event schema already carries (lib/analytics.ts).
        trackEvent('language_selected', { screen: 'switcher', language, source: 'switch' });
      } finally {
        setSwitching(null);
      }
    },
    [user, active, adopt],
  );

  const addLanguage = useCallback(
    async (language: LanguageCode, level: ProficiencyLevel, options?: { lockCurrent?: boolean }) => {
      if (!user) return;
      setSwitching(language);
      try {
        // `lib/course-placement.ts` is the one place that turns a level into a
        // course; the server only checks that the course it is handed belongs
        // to the language.
        const courses = await fetchCourses(language);
        const placement = resolvePlacement(courses, level, 'start');
        const profile = await switchTargetLanguage(language, { level, ...placement }, options);
        await adopt(profile);
        trackEvent('language_selected', { screen: 'switcher', language, source: 'added' });
        trackEvent('course_placement_set', {
          screen: 'settings',
          source: 'start',
          band: placement.placementBand,
          language,
        });
      } finally {
        setSwitching(null);
      }
    },
    [user, adopt],
  );

  const keep = useCallback(
    async (languages: LanguageCode[]) => {
      if (!user || languages.length === 0) return;
      setSwitching(languages[0]);
      try {
        // Adopted like a switch: when the active language is not kept, the
        // server moves the account to the first kept one.
        await adopt(await keepLanguages(languages));
      } finally {
        setSwitching(null);
      }
    },
    [user, adopt],
  );

  return {
    enrollments,
    active,
    loading,
    error,
    switching,
    reload,
    access,
    switchTo,
    addLanguage,
    keep,
  };
}
