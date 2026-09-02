import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../config/theme';
import type { GoalTrack } from '../../types';

/**
 * The learner's goal track in Learn: the unit generated from their onboarding
 * "picture a moment you'd love to have in this language" answer.
 *
 * Lessons are created as shells and filled in on first open, so a row can be
 * in one of three states and they are NOT interchangeable to a learner:
 *   ready      — open it.
 *   pending    — openable, but it has to be built first, which takes a moment.
 *   generating — somebody else is building this exact lesson right now.
 *
 * Showing "generating" as a plain disabled row would read as broken. Showing
 * "pending" as ready would open an empty lesson. Hence three states.
 */

interface Props {
  track: GoalTrack;
  /** Resolves true when the lesson has exercises and can be opened. */
  onOpenLesson: (lessonId: string) => Promise<boolean>;
  onNavigate: (lessonId: string) => void;
}

export function GoalTrackCard({ track, onOpenLesson, onNavigate }: Props) {
  const [busyLessonId, setBusyLessonId] = useState<string | null>(null);
  const [failedLessonId, setFailedLessonId] = useState<string | null>(null);

  const handlePress = async (lessonId: string, state: string | null) => {
    if (busyLessonId) return;
    if (state === 'ready' || state === null) {
      onNavigate(lessonId);
      return;
    }
    setBusyLessonId(lessonId);
    setFailedLessonId(null);
    try {
      const ready = await onOpenLesson(lessonId);
      if (ready) onNavigate(lessonId);
      else setFailedLessonId(lessonId);
    } catch {
      setFailedLessonId(lessonId);
    } finally {
      setBusyLessonId(null);
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxs }}>
        <Ionicons name="flag-outline" size={18} color={colors.action.accent} />
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: colors.action.accent,
            marginLeft: spacing.xxs,
            letterSpacing: 0.5,
          }}
        >
          YOUR GOAL
        </Text>
      </View>

      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text.primary }}>
        {track.title}
      </Text>
      <Text style={{ fontSize: 14, color: colors.text.tertiary, marginTop: spacing.xxs }}>
        {track.description}
      </Text>

      <View style={{ marginTop: spacing.sm }}>
        {track.lessons.map((lesson, index) => {
          const isBusy = busyLessonId === lesson.id;
          const failed = failedLessonId === lesson.id;
          const blocked = lesson.generationState === 'generating';

          return (
            <Pressable
              key={lesson.id}
              onPress={() => handlePress(lesson.id, lesson.generationState)}
              disabled={isBusy || blocked}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 44,
                paddingVertical: spacing.xs,
                opacity: blocked ? 0.6 : 1,
              }}
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy || blocked, busy: isBusy }}
              accessibilityLabel={
                blocked
                  ? `${lesson.title}. Being prepared, try again shortly.`
                  : `Lesson ${index + 1}. ${lesson.title}. ${lesson.description}`
              }
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: colors.surface.cardAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.sm,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text.tertiary }}>
                  {index + 1}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text.primary }}>
                  {lesson.title}
                </Text>
                {(isBusy || blocked || failed) && (
                  <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>
                    {isBusy
                      ? 'Preparing this lesson…'
                      : blocked
                        ? 'Being prepared — check back in a moment.'
                        : "Couldn't prepare this one. Tap to try again."}
                  </Text>
                )}
              </View>

              {isBusy ? (
                <ActivityIndicator size="small" color={colors.text.tertiary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Shown when the learner wrote a goal at onboarding but has no track yet.
 *
 * Building a track is a paid, generative call, so it happens on an explicit
 * tap rather than firing on screen load — a learner should never find out we
 * spent model time because they opened a tab. It doubles as where the feature
 * is advertised.
 */
export function GoalTrackPrompt({
  goalText,
  isBuilding,
  error,
  onBuild,
}: {
  goalText: string;
  isBuilding: boolean;
  error: string | null;
  onBuild: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxs }}>
        <Ionicons name="flag-outline" size={18} color={colors.action.accent} />
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: colors.action.accent,
            marginLeft: spacing.xxs,
            letterSpacing: 0.5,
          }}
        >
          YOUR GOAL
        </Text>
      </View>

      <Text style={{ fontSize: 15, color: colors.text.primary, lineHeight: 21 }}>
        “{goalText}”
      </Text>
      <Text style={{ fontSize: 14, color: colors.text.tertiary, marginTop: spacing.xs }}>
        We can build a short set of lessons aimed straight at that.
      </Text>

      {error && (
        <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: spacing.xs }}>
          {error}
        </Text>
      )}

      <Pressable
        onPress={onBuild}
        disabled={isBuilding}
        style={{
          marginTop: spacing.sm,
          backgroundColor: colors.action.primaryFill,
          paddingVertical: spacing.sm,
          minHeight: 44,
          borderRadius: radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isBuilding ? 0.7 : 1,
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled: isBuilding, busy: isBuilding }}
        accessibilityLabel="Build lessons for my goal"
      >
        {isBuilding ? (
          <ActivityIndicator size="small" color={colors.text.onPrimary} />
        ) : (
          <Text style={{ color: colors.text.onPrimary, fontSize: 15, fontWeight: '600' }}>
            Build my lessons
          </Text>
        )}
      </Pressable>
    </View>
  );
}
