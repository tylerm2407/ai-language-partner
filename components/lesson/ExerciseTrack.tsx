import { View } from 'react-native';
import { colors, radii } from '../../config/theme';

interface ExerciseTrackProps {
  /** Total exercises in the lesson (or warm-up). One tick each. */
  total: number;
  /** Zero-based index of the exercise on screen. */
  currentIndex: number;
  /**
   * How many exercises have been answered. Ticks for answered-wrong
   * exercises stay green rather than turning red — the note row carries the
   * correction, and a red streak in the header reads as punishment.
   * Defaults to `currentIndex` when the caller has no answer count.
   */
  completedCount?: number;
}

/**
 * ExerciseTrack — one tick per exercise, replacing the continuous ProgressBar
 * inside the lesson runner. A learner can see how many questions are left,
 * which a percentage bar never told them.
 *
 * ProgressBar is deliberately left untouched: it is still the right control
 * for reading progress, unit mastery and XP fills.
 */
export function ExerciseTrack({ total, currentIndex, completedCount }: ExerciseTrackProps) {
  const done = completedCount ?? currentIndex;

  return (
    <View
      style={{ flexDirection: 'row', gap: 3 }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: currentIndex + 1 }}
      accessibilityLabel={`Question ${currentIndex + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 5,
            borderRadius: radii.sm / 2,
            backgroundColor:
              i < done
                ? colors.success.base
                : i === currentIndex
                  ? colors.action.accent
                  : colors.surface.track,
          }}
        />
      ))}
    </View>
  );
}
