/**
 * Mascot — Sol, the dragon.
 *
 * Plays the interim clips in assets/mascot/video: five moods generated from
 * the master still with the same frame at both ends (so they return to the
 * drawing) plus a ten-second bedtime piece. Each is an HEVC-with-alpha .mov,
 * which AVPlayer composites with true transparency, so Sol sits on any card,
 * tint or text without a square behind him.
 *
 * Behaviour:
 *   - `idle` loops. Every other state is a one-shot: it plays through, then
 *     the component returns to idle on its own. A parent that flips back to
 *     `idle` mid-clip is ignored until the clip finishes, so a 700ms "cheer"
 *     tick from a picker still shows the whole nod.
 *   - Reduce Motion, Android, and the moment before the first frame decodes
 *     all show the transparent still.
 *   - The iOS SIMULATOR decodes only the base layer of an HEVC-with-alpha
 *     clip, so there Sol sits in a white square wherever he overlaps colour
 *     (the onboarding hero). That is the simulator, not the asset: the
 *     .mov reports "HEVC with Alpha" and a device composites it. Judge the
 *     overlap on a device. Android gets the still because
 *     ExoPlayer does not composite HEVC alpha; the animated WebPs in the same
 *     folder are the Android path once Fresco's animated-webp module is added.
 *
 * The state names are the old star mascot's, so nothing upstream changes.
 * When the Rive rig lands it replaces the Video element behind this same API.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av';
import { useMotion } from '../../hooks/useMotion';

export type MascotState =
  | 'idle'
  | 'happy'
  | 'thinking'
  | 'cheering'
  | 'listening'
  | 'surprised'
  | 'sleepy'
  | 'sad'
  | 'disappointed';

export type MascotSize = 'xs' | 'sm' | 'md' | 'lg' | number;

interface MascotProps {
  state?: MascotState;
  size?: MascotSize;
  style?: ViewStyle;
  /** Decorative only by default; set true only if the mascot conveys state. */
  accessibilityVisible?: boolean;
}

const SIZE_PX: Record<Exclude<MascotSize, number>, number> = { xs: 32, sm: 48, md: 80, lg: 128 };

type Clip = 'idle' | 'listening' | 'thinking' | 'approving' | 'surprised' | 'bedtime';

/** Which clip a state plays. Sad/disappointed have no clip of their own yet: Sol just watches. */
const CLIP_FOR: Record<MascotState, Clip> = {
  idle: 'idle',
  happy: 'approving',
  cheering: 'approving',
  thinking: 'thinking',
  listening: 'listening',
  surprised: 'surprised',
  sleepy: 'bedtime',
  sad: 'listening',
  disappointed: 'listening',
};

const CLIPS: Record<Clip, number> = {
  idle: require('../../assets/mascot/video/sol-idle.mov'),
  listening: require('../../assets/mascot/video/sol-listening.mov'),
  thinking: require('../../assets/mascot/video/sol-thinking.mov'),
  approving: require('../../assets/mascot/video/sol-approving.mov'),
  surprised: require('../../assets/mascot/video/sol-surprised.mov'),
  bedtime: require('../../assets/mascot/video/sol-bedtime.mov'),
};

const STILL = require('../../assets/mascot/sol-still.png');

const CAN_PLAY = Platform.OS === 'ios';

export function Mascot({ state = 'idle', size = 'md', style, accessibilityVisible = false }: MascotProps) {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const { shouldReduce } = useMotion();
  const wanted = CLIP_FOR[state];
  const [clip, setClip] = useState<Clip>(wanted);
  const [ready, setReady] = useState(false);
  const busyRef = useRef(false);

  // Latch: a one-shot runs to its end even if the parent has already gone
  // back to idle. A new one-shot request replaces whatever is playing.
  useEffect(() => {
    if (wanted === 'idle') {
      if (!busyRef.current) setClip('idle');
      return;
    }
    busyRef.current = true;
    setClip(wanted);
  }, [wanted]);

  const onStatus = (s: AVPlaybackStatus) => {
    if (!s.isLoaded) return;
    if (!ready) setReady(true);
    if (s.didJustFinish && clip !== 'idle') {
      busyRef.current = false;
      // Bedtime ends asleep on purpose; everything else wakes back up.
      if (clip !== 'bedtime') setClip('idle');
    }
  };

  const a11y = {
    accessibilityElementsHidden: !accessibilityVisible,
    importantForAccessibility: (accessibilityVisible ? 'yes' : 'no') as 'yes' | 'no',
    accessibilityLabel: accessibilityVisible ? `Sol, ${state}` : undefined,
  };

  if (shouldReduce || !CAN_PLAY) {
    return (
      <View style={[{ width: px, height: px }, style]} {...a11y}>
        <Image source={STILL} style={styles.fill} resizeMode="contain" />
      </View>
    );
  }

  return (
    <View style={[{ width: px, height: px }, style]} {...a11y}>
      {/* The still paints under the video until the first frame decodes, so
          there is never an empty box on mount or on a source swap. */}
      {!ready && <Image source={STILL} style={[styles.fill, StyleSheet.absoluteFill]} resizeMode="contain" />}
      <Video
        key={clip}
        source={CLIPS[clip]}
        style={[styles.fill, styles.clear]}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isMuted
        isLooping={clip === 'idle'}
        useNativeControls={false}
        onPlaybackStatusUpdate={onStatus}
        progressUpdateIntervalMillis={250}
      />
    </View>
  );
}

/** Convenience helper: pick a mascot state from a common lesson outcome. */
export function mascotForOutcome(outcome: 'correct' | 'wrong' | 'complete'): MascotState {
  switch (outcome) {
    case 'correct':
      return 'happy';
    case 'wrong':
      return 'thinking';
    case 'complete':
      return 'cheering';
    default:
      return 'idle';
  }
}

const styles = StyleSheet.create({
  // The player view must not paint its own ground, or the alpha clip sits in
  // a box wherever Sol overlaps a coloured surface (the onboarding hero).
  clear: { backgroundColor: 'transparent' },
  fill: { width: '100%', height: '100%', backgroundColor: 'transparent' },
});
