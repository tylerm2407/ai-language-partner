/**
 * Mascot — a small curious star-being that matches the cosmic theme.
 *
 * This is the **static SVG** implementation (phase 0). The API is designed
 * so that a future Rive-state-machine version can drop in behind the same
 * component with zero consumer changes.
 *
 * Concept: a rounded 4-point indigo star with big expressive eyes and a
 * simple mouth. 6 states: idle / happy / thinking / cheering / sad /
 * disappointed. Each state swaps the eye shape + mouth shape only; the
 * star silhouette is constant.
 *
 * Design constraints (per redesign-plan.md):
 *   - 3 colors max: indigo-500 fill, indigo-700 outline, ivory for face
 *   - Thick 3pt strokes; flat fills; no gradients
 *   - Re-uses the theme tokens
 */

import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { View, type ViewStyle, StyleSheet } from 'react-native';
import { colors } from '../../config/theme';

export type MascotState =
  | 'idle'
  | 'happy'
  | 'thinking'
  | 'cheering'
  | 'sad'
  | 'disappointed';

export type MascotSize = 'xs' | 'sm' | 'md' | 'lg';

interface MascotProps {
  state?: MascotState;
  size?: MascotSize;
  style?: ViewStyle;
  /** Decorative only by default; set true only if the mascot conveys state. */
  accessibilityVisible?: boolean;
}

const SIZE_PX: Record<MascotSize, number> = { xs: 32, sm: 48, md: 80, lg: 128 };

const STAR_FILL = colors.indigo[500];
const STAR_STROKE = colors.indigo[700];
const EYE_COLOR = '#F8FAFC'; // near-ivory — AAA against indigo-500
const PUPIL_COLOR = '#0C0F14';
const MOUTH_COLOR = colors.indigo[800];

/** 4-point rounded star silhouette. viewBox 0 0 100 100, center 50,50. */
const STAR_PATH =
  'M50 5 C55 30 70 45 95 50 C70 55 55 70 50 95 C45 70 30 55 5 50 C30 45 45 30 50 5 Z';

/** Eye shapes per state. */
function eyes(state: MascotState): React.ReactNode {
  // Left eye at (38, 45), right eye at (62, 45), size ~6
  switch (state) {
    case 'happy':
    case 'cheering':
      // Closed happy arcs (^^)
      return (
        <G stroke={PUPIL_COLOR} strokeWidth={3} fill="none" strokeLinecap="round">
          <Path d="M33 45 Q38 40 43 45" />
          <Path d="M57 45 Q62 40 67 45" />
        </G>
      );
    case 'thinking':
      // Side-glance (pupils right)
      return (
        <>
          <Circle cx={38} cy={45} r={6} fill={EYE_COLOR} />
          <Circle cx={62} cy={45} r={6} fill={EYE_COLOR} />
          <Circle cx={41} cy={45} r={2.5} fill={PUPIL_COLOR} />
          <Circle cx={65} cy={45} r={2.5} fill={PUPIL_COLOR} />
        </>
      );
    case 'sad':
    case 'disappointed':
      // Droopy eyes (upper lid halfway down)
      return (
        <>
          <Circle cx={38} cy={46} r={6} fill={EYE_COLOR} />
          <Circle cx={62} cy={46} r={6} fill={EYE_COLOR} />
          <Circle cx={38} cy={47} r={2} fill={PUPIL_COLOR} />
          <Circle cx={62} cy={47} r={2} fill={PUPIL_COLOR} />
          <Path d="M32 42 L44 44" stroke={PUPIL_COLOR} strokeWidth={2.5} strokeLinecap="round" />
          <Path d="M68 42 L56 44" stroke={PUPIL_COLOR} strokeWidth={2.5} strokeLinecap="round" />
        </>
      );
    case 'idle':
    default:
      return (
        <>
          <Circle cx={38} cy={45} r={6} fill={EYE_COLOR} />
          <Circle cx={62} cy={45} r={6} fill={EYE_COLOR} />
          <Circle cx={38} cy={45} r={2.5} fill={PUPIL_COLOR} />
          <Circle cx={62} cy={45} r={2.5} fill={PUPIL_COLOR} />
        </>
      );
  }
}

/** Mouth shapes per state. */
function mouth(state: MascotState): React.ReactNode {
  switch (state) {
    case 'happy':
      return (
        <Path
          d="M38 62 Q50 72 62 62"
          stroke={MOUTH_COLOR}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      );
    case 'cheering':
      // Open-mouth smile
      return (
        <Path
          d="M38 60 Q50 78 62 60 Q50 68 38 60 Z"
          stroke={MOUTH_COLOR}
          strokeWidth={3}
          fill={MOUTH_COLOR}
          strokeLinejoin="round"
        />
      );
    case 'thinking':
      return (
        <Path
          d="M42 66 L58 66"
          stroke={MOUTH_COLOR}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      );
    case 'sad':
      return (
        <Path
          d="M38 68 Q50 60 62 68"
          stroke={MOUTH_COLOR}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      );
    case 'disappointed':
      return (
        <Path
          d="M42 66 L58 68"
          stroke={MOUTH_COLOR}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      );
    case 'idle':
    default:
      return (
        <Path
          d="M42 64 Q50 68 58 64"
          stroke={MOUTH_COLOR}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      );
  }
}

export function Mascot({
  state = 'idle',
  size = 'md',
  style,
  accessibilityVisible = false,
}: MascotProps) {
  const px = SIZE_PX[size];
  return (
    <View
      style={[{ width: px, height: px }, style]}
      accessibilityElementsHidden={!accessibilityVisible}
      importantForAccessibility={accessibilityVisible ? 'yes' : 'no'}
      accessibilityLabel={accessibilityVisible ? `Mascot ${state}` : undefined}
    >
      <Svg width={px} height={px} viewBox="0 0 100 100">
        {/* Star silhouette */}
        <Path d={STAR_PATH} fill={STAR_FILL} stroke={STAR_STROKE} strokeWidth={3} strokeLinejoin="round" />
        {/* Face features */}
        {eyes(state)}
        {mouth(state)}
      </Svg>
    </View>
  );
}

/** Convenience helper: pick a mascot state from a common lesson outcome. */
export function mascotForOutcome(outcome: 'correct' | 'wrong' | 'complete' | 'streakLost'): MascotState {
  switch (outcome) {
    case 'correct':
      return 'happy';
    case 'wrong':
      return 'thinking';
    case 'complete':
      return 'cheering';
    case 'streakLost':
      return 'sad';
    default:
      return 'idle';
  }
}

export const _styles = StyleSheet.create({
  // reserved for future use
});
