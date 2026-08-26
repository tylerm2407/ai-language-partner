/**
 * CompletedLessonsSection — the learner's finished lessons, newest first,
 * kept behind a collapsed "vault" row.
 *
 * Collapsed by default, on every visit. At fifty completions an always-open
 * list IS the profile page — classes, settings and sign out all fall off the
 * bottom of a scroll nobody reaches. The row keeps the part that belongs on a
 * profile at a glance (how many, how recently); the detail costs one tap.
 *
 * Re-reads on focus, not just on mount. The profile tab stays mounted once the
 * learner has visited it, so a mount-only fetch meant finishing a lesson and
 * coming back here showed the pre-lesson answer — the same staleness UnitPath
 * fixed for the Learn path.
 */

import { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../config/theme';
import { formatRelativeDay } from '../../lib/dates';
import {
  fetchCompletedLessonsWithTitles,
  type CompletedLessonsPage,
} from '../../lib/supabase-queries';

interface Props {
  userId: string | null | undefined;
}

/**
 * How many completions the vault actually holds rows for. The collapsed row
 * still reports the true total; only the list is capped, because a learner
 * two years in does not scroll to lesson 300 on their profile.
 */
const RECENT_LIMIT = 25;

function scoreBadge(score: number): { label: string; color: string } {
  const pct = Math.round(score * 100);
  // A lesson score is grading feedback, so the top and bottom bands keep the
  // two signal hues. The middle bands are greyscale and step DOWN in brightness
  // as the score falls — the sweep briefly had 50-69% brighter than 70-89%,
  // which inverted the ladder.
  if (pct >= 90) return { label: `${pct}%`, color: '#22C55E' };
  if (pct >= 70) return { label: `${pct}%`, color: '#38BDF8' };
  if (pct >= 50) return { label: `${pct}%`, color: '#F59E0B' };
  return { label: `${pct}%`, color: '#EF4444' };
}

export function CompletedLessonsSection({ userId }: Props) {
  const router = useRouter();
  const [page, setPage] = useState<CompletedLessonsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /** Revalidation is silent once there is a list to show — raising the spinner
   *  on every focus would blank it each time the learner came back. */
  const hasLoadedOnce = useRef(false);

  /** Focus revalidation and the retry button run the same read. */
  const load = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    if (!hasLoadedOnce.current) setLoading(true);
    fetchCompletedLessonsWithTitles(userId, RECENT_LIMIT)
      .then((result) => {
        if (cancelled) return;
        hasLoadedOnce.current = true;
        setPage(result);
        setFailed(false);
      })
      .catch((err) => {
        // A failed read is NOT an empty history. Swallowing it into [] is
        // exactly how a broken query read as "you have completed nothing".
        if (cancelled) return;
        console.error('[profile] failed to load completed lessons:', err);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useFocusEffect(load);

  const rows = page?.rows ?? [];
  const total = page?.total ?? 0;
  const unreadable = failed && !page;
  const latest = rows[0]?.completedAt;

  // The vault row is the section header. A separate title above it would just
  // say "Completed Lessons" twice.
  const summary = loading
    ? 'Checking your progress…'
    : unreadable
      ? "Couldn't load — tap to try again"
      : total === 0
        ? 'Finish your first lesson to fill this in'
        : `${total} lesson${total === 1 ? '' : 's'}${latest ? ` · latest ${formatRelativeDay(latest)}` : ''}`;

  // Nothing to open when the vault is empty or still loading; the row goes
  // inert rather than offering a tap that does nothing.
  const openable = !loading && (total > 0 || unreadable);

  const handlePress = () => {
    if (unreadable) {
      load();
      return;
    }
    setExpanded((v) => !v);
  };

  return (
    <View className="mb-6">
      <Pressable
        onPress={handlePress}
        disabled={!openable}
        className="bg-dark-card rounded-2xl p-5 flex-row items-center"
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled: !openable }}
        accessibilityLabel={`Completed lessons. ${summary}`}
        accessibilityHint={
          openable && !unreadable
            ? expanded
              ? 'Hides the list of lessons you have finished'
              : 'Shows the lessons you have finished'
            : undefined
        }
      >
        <Ionicons name="checkmark-done-outline" size={24} color={colors.premium.base} />
        <View className="ml-4 flex-1">
          <Text className="text-base font-semibold text-text-primary">Completed Lessons</Text>
          <Text className="text-sm text-text-secondary">{summary}</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={colors.premium.base} />
        ) : unreadable ? (
          <Ionicons name="refresh" size={20} color={colors.premium.base} />
        ) : total > 0 ? (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.premium.base}
          />
        ) : null}
      </Pressable>

      {expanded && rows.length > 0 && (
        <View className="mt-2">
          {rows.map((row) => {
            const badge = scoreBadge(row.score);
            return (
              <Pressable
                key={row.id}
                onPress={() => router.push(`/learn/${row.lessonId}` as any)}
                className="bg-dark-card rounded-2xl p-4 mb-2 flex-row items-center"
                accessibilityRole="button"
                accessibilityLabel={`${row.lessonTitle}, completed ${formatRelativeDay(row.completedAt)}, score ${badge.label}`}
              >
                <View
                  className="w-9 h-9 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: `${badge.color}22` }}
                >
                  <Ionicons name="checkmark" size={18} color={badge.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
                    {row.lessonTitle}
                  </Text>
                  <Text className="text-xs text-text-secondary mt-0.5">
                    {formatRelativeDay(row.completedAt)} · +{row.xpEarned} XP
                  </Text>
                </View>
                <Text className="text-sm font-semibold ml-2" style={{ color: badge.color }}>
                  {badge.label}
                </Text>
              </Pressable>
            );
          })}

          {total > rows.length && (
            <Text className="text-xs text-text-secondary text-center mt-1">
              Showing your {rows.length} most recent.
            </Text>
          )}

          {/* After a full vault the header row is far off-screen, so the way
              back has to be at the bottom too. */}
          <Pressable
            onPress={() => setExpanded(false)}
            className="mt-1 p-3 items-center"
            accessibilityRole="button"
            accessibilityLabel="Collapse completed lessons"
          >
            <Text className="text-sm font-semibold text-primary">Collapse</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
