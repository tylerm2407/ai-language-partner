import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors, radii } from '../../config/theme';

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 14;
/** Apple HIG minimum. The visible track is 4pt; the touch target is not. */
const HIT_HEIGHT = 44;

interface AudioScrubberProps {
  positionMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
  /** ±seconds a VoiceOver increment moves. Matches the on-screen skip buttons. */
  stepSeconds: number;
  disabled?: boolean;
}

/**
 * The narration scrubber.
 *
 * Hand-built on react-native-gesture-handler rather than a slider dependency:
 * `@react-native-community/slider` is not installed and this ships in an app
 * binary, so a whole package for one control is not worth it.
 *
 * The accessibility contract is the part that must not be trimmed. A pan
 * gesture is unusable with VoiceOver — there is no drag to perform when the
 * screen reader owns touch — so this exposes `adjustable` with real
 * increment/decrement actions. Without those, a blind learner can hear the
 * article but can never move within it.
 */
export function AudioScrubber({
  positionMs,
  durationMs,
  onSeek,
  stepSeconds,
  disabled = false,
}: AudioScrubberProps) {
  const [width, setWidth] = useState(0);
  // While dragging, the thumb follows the finger rather than the (still
  // playing) position, or it fights the user for control of its own handle.
  const [dragMs, setDragMs] = useState<number | null>(null);

  const shownMs = dragMs ?? positionMs;
  const progress = durationMs > 0 ? Math.min(1, Math.max(0, shownMs / durationMs)) : 0;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const msAtX = (x: number): number => {
    if (width <= 0 || durationMs <= 0) return 0;
    return Math.round((Math.min(Math.max(0, x), width) / width) * durationMs);
  };

  const pan = Gesture.Pan()
    .enabled(!disabled && durationMs > 0)
    .onBegin((e) => runOnJS(setDragMs)(msAtX(e.x)))
    .onUpdate((e) => runOnJS(setDragMs)(msAtX(e.x)))
    .onEnd((e) => {
      runOnJS(onSeek)(msAtX(e.x));
      runOnJS(setDragMs)(null);
    })
    // Without this a cancelled gesture leaves the thumb frozen away from the
    // real position for the rest of playback.
    .onFinalize(() => runOnJS(setDragMs)(null));

  const stepMs = stepSeconds * 1000;

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={onLayout}
        accessibilityRole="adjustable"
        accessibilityLabel="Playback position"
        accessibilityState={{ disabled }}
        accessibilityValue={{
          min: 0,
          max: Math.max(1, Math.round(durationMs / 1000)),
          now: Math.round(shownMs / 1000),
        }}
        accessibilityActions={[
          { name: 'increment', label: `Forward ${stepSeconds} seconds` },
          { name: 'decrement', label: `Back ${stepSeconds} seconds` },
        ]}
        onAccessibilityAction={(event) => {
          if (disabled || durationMs <= 0) return;
          if (event.nativeEvent.actionName === 'increment') {
            onSeek(Math.min(durationMs, positionMs + stepMs));
          } else if (event.nativeEvent.actionName === 'decrement') {
            onSeek(Math.max(0, positionMs - stepMs));
          }
        }}
        style={{ height: HIT_HEIGHT, justifyContent: 'center' }}
      >
        <View
          style={{
            height: TRACK_HEIGHT,
            borderRadius: radii.pill,
            backgroundColor: colors.border.subtle,
            overflow: 'visible',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${progress * 100}%`,
              borderRadius: radii.pill,
              backgroundColor: disabled ? colors.text.tertiary : colors.action.primaryFill,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: Math.max(0, progress * width - THUMB_SIZE / 2),
              top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: radii.pill,
              backgroundColor: disabled ? colors.text.tertiary : colors.action.primaryFill,
            }}
          />
        </View>
      </View>
    </GestureDetector>
  );
}
