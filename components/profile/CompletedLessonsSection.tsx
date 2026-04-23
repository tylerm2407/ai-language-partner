/**
 * CompletedLessonsSection — Profile page list of lessons the learner has
 * finished, newest first. Pulls from lesson_completions joined with lesson
 * titles. Empty state when the learner hasn't completed any yet.
 */

import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchCompletedLessonsWithTitles,
  type LessonCompletionWithTitle,
} from '../../lib/supabase-queries';

interface Props {
  userId: string | null | undefined;
  /** Show this many at most; the rest collapse behind a "Show all" toggle. */
  previewCount?: number;
}

function formatCompletedAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay === 0) return 'Today';
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function scoreBadge(score: number): { label: string; color: string } {
  const pct = Math.round(score * 100);
  if (pct >= 90) return { label: `${pct}%`, color: '#22C55E' };
  if (pct >= 70) return { label: `${pct}%`, color: '#38BDF8' };
  if (pct >= 50) return { label: `${pct}%`, color: '#F59E0B' };
  return { label: `${pct}%`, color: '#EF4444' };
}

export function CompletedLessonsSection({ userId, previewCount = 5 }: Props) {
  const router = useRouter();
  const [completions, setCompletions] = useState<LessonCompletionWithTitle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchCompletedLessonsWithTitles(userId, 25)
      .then((rows) => {
        if (!cancelled) setCompletions(rows);
      })
      .catch(() => {
        if (!cancelled) setCompletions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <View className="mb-6">
      <Text className="text-xl font-bold text-text-primary mb-3">Completed Lessons</Text>

      {loading ? (
        <View className="bg-dark-card rounded-2xl p-5 items-center">
          <ActivityIndicator size="small" color="#A855F7" />
        </View>
      ) : !completions || completions.length === 0 ? (
        <View className="bg-dark-card rounded-2xl p-5 items-center">
          <Ionicons name="book-outline" size={28} color="#6b7280" />
          <Text className="text-sm text-text-secondary mt-2 text-center">
            No lessons completed yet. Finish your first lesson to see it here.
          </Text>
        </View>
      ) : (
        <>
          {(expanded ? completions : completions.slice(0, previewCount)).map((row) => {
            const badge = scoreBadge(row.score);
            return (
              <Pressable
                key={row.id}
                onPress={() => router.push(`/learn/${row.lessonId}` as any)}
                className="bg-dark-card rounded-2xl p-4 mb-2 flex-row items-center"
                accessibilityRole="button"
                accessibilityLabel={`${row.lessonTitle}, completed ${formatCompletedAt(row.completedAt)}, score ${badge.label}`}
              >
                <View className="w-9 h-9 rounded-full items-center justify-center mr-3" style={{ backgroundColor: `${badge.color}22` }}>
                  <Ionicons name="checkmark" size={18} color={badge.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
                    {row.lessonTitle}
                  </Text>
                  <Text className="text-xs text-text-secondary mt-0.5">
                    {formatCompletedAt(row.completedAt)} · +{row.xpEarned} XP
                  </Text>
                </View>
                <Text className="text-sm font-semibold ml-2" style={{ color: badge.color }}>
                  {badge.label}
                </Text>
              </Pressable>
            );
          })}

          {completions.length > previewCount && (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              className="mt-1 p-3 items-center"
              accessibilityRole="button"
            >
              <Text className="text-sm font-semibold text-primary">
                {expanded ? 'Show fewer' : `Show all ${completions.length}`}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}
