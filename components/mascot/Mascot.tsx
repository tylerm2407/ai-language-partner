/**
 * Mascot — a small shooting-star being.
 *
 * A 4-point rounded indigo star with a tapering cosmic trail behind it
 * and big expressive eyes + simple mouth on the star itself. The trail
 * is a soft tapered ribbon behind the star's lower-left, fading into
 * transparency — implies motion without requiring any animation.
 *
 * 6 states: idle / happy / thinking / cheering / sad / disappointed.
 * Each state swaps the eye shape + mouth shape only; the star silhouette
 * and trail stay constant.
 *
 * Design constraints:
 *   - 3 colors + ivory for face + warm-gold sparkle — tight palette
 *   - Thick 3pt strokes; flat fills; the trail is a single path with
 *     three stacked layers (no actual gradient needed)
 *   - Reuses theme tokens
 *
 * This is the **static SVG** implementation. A future Rive
 * state-machine version can drop in behind the same API.
 */

import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { View, type ViewStyle } from 'react-native';
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
const TRAIL_COLOR = colors.indigo[400];
const EYE_COLOR = '#F8FAFC'; // near-ivory — AAA against indigo-500
const PUPIL_COLOR = '#0C0F14';
const MOUTH_COLOR = colors.indigo[800];
const SPARK_COLOR = '#FDE68A';

/**
 * 4-point rounded star silhouette. viewBox 0 0 100 100, centered at (55, 45)
 * so the lower-left trail has room to breathe in the viewBox.
 */
const STAR_PATH =
  'M55 10 C60 35 75 50 100 55 C75 60 60 75 55 100 C50 75 35 60 10 55 C35 50 50 35 55 10 Z';

/**
 * Shooting-star trail — three stacked tapered ribbons behind the star's
 * lower-left corner, each a slightly different opacity to fake a soft
 * motion blur. The trail always points up-right-to-lower-left, the
 * classic shooting-star direction.
 */
const TRAIL_BROAD = 'M 10 95 C 25 80 40 65 48 55 L 55 65 C 45 75 30 88 14 98 Z';
const TRAIL_MID = 'M 12 92 C 25 82 38 70 46 62 L 52 68 C 42 78 28 88 16 96 Z';
const TRAIL_CORE = 'M 15 90 C 27 80 38 72 44 66 L 49 70 C 40 78 28 86 18 93 Z';

/** Eye shapes per state. */
function eyes(state: MascotState): React.ReactNode {
  switch (state) {
    case 'happy':
    case 'cheering':
      return (
        <G stroke={PUPIL_COLOR} strokeWidth={3} fill="none" strokeLinecap="round">
          <Path d="M 43 45 Q 48 40 53 45" />
          <Path d="M 60 45 Q 65 40 70 45" />
        </G>
      );
    case 'thinking':
      return (
        <>
          <Circle cx={48} cy={45} r={6} fill={EYE_COLOR} />
          <Circle cx={65} cy={45} r={6} fill={EYE_COLOR} />
          <Circle cx={51} cy={45} r={2.5} fill={PUPIL_COLOR} />
          <Circle cx={68} cy={45} r={2.5} fill={PUPIL_COLOR} />
        </>
      );
    case 'sad':
    case 'disappointed':
      return (
        <>
          <Circle cx={48} cy={46} r={6} fill={EYE_COLOR} />
          <Circle cx={65} cy={46} r={6} fill={EYE_COLOR} />
          <Circle cx={48} cy={47} r={2} fill={PUPIL_COLOR} />
          <Circle cx={65} cy={47} r={2} fill={PUPIL_COLOR} />
          <Path d="M 42 42 L 54 44" stroke={PUPIL_COLOR} strokeWidth={2.5} strokeLinecap="round" />
          <Path d="M 71 42 L 59 44" stroke={PUPIL_COLOR} strokeWidth={2.5} strokeLinecap="round" />
        </>
      );
    case 'idle':
    default:
      return (
        <>
          <Circle cx={48} cy={45} r={6} fill={EYE_COLOR} />
          <Circle cx={65} cy={45} r={6} fill={EYE_COLOR} />
          <Circle cx={48} cy={45} r={2.5} fill={PUPIL_COLOR} />
          <Circle cx={65} cy={45} r={2.5} fill={PUPIL_COLOR} />
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
          d="M 48 62 Q 56 72 64 62"
          stroke={MOUTH_COLOR}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      );
    case 'cheering':
      return (
        <Path
          d="M 48 60 Q 56 78 64 60 Q 56 68 48 60 Z"
          stroke={MOUTH_COLOR}
          strokeWidth={3}
          fill={MOUTH_COLOR}
          strokeLinejoin="round"
        />
      );
    case 'thinking':
      return (
        <Path
          d="M 52 66 L 64 66"
          stroke={MOUTH_COLOR}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      );
    case 'sad':
      return (
        <Path
          d="M 48 68 Q 56 60 64 68"
          stroke={MOUTH_COLOR}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      );
    case 'disappointed':
      return (
        <Path
          d="M 52 66 L 64 68"
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
          d="M 50 64 Q 56 68 62 64"
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
        {/* Shooting-star trail — three stacked tapered ribbons, opacity
            falling off as they widen. Rendered before the star so the
            star sits cleanly on top. */}
        <Path d={TRAIL_BROAD} fill={TRAIL_COLOR} opacity={0.18} />
        <Path d={TRAIL_MID} fill={TRAIL_COLOR} opacity={0.35} />
        <Path d={TRAIL_CORE} fill={TRAIL_COLOR} opacity={0.65} />

        {/* Tiny warm-gold sparkle at the very tip of the trail */}
        <Circle cx={12} cy={96} r={1.5} fill={SPARK_COLOR} opacity={0.85} />

        {/* Star silhouette */}
        <Path
          d={STAR_PATH}
          fill={STAR_FILL}
          stroke={STAR_STROKE}
          strokeWidth={3}
          strokeLinejoin="round"
        />

        {/* Face features */}
        {eyes(state)}
        {mouth(state)}
      </Svg>
    </View>
  );
}

/** Convenience helper: pick a mascot state from a common lesson outcome. */
export function mascotForOutcome(
  outcome: 'correct' | 'wrong' | 'complete' | 'streakLost',
): MascotState {
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
