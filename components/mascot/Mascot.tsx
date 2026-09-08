/**
 * Mascot — Sol, the dragon.
 *
 * Plays the interim clips in assets/mascot/video: five moods generated from
 * the master still with the same frame at both ends (so they return to the
 * drawing), a fifteen-second bedtime piece, and an eight-second sleep loop
 * whose first and last frames are the bedtime clip's final frame, so bedtime
 * runs straight into it with no cut. Each is an HEVC-with-alpha .mov,
 * which AVPlayer composites with true transparency, so Sol sits on any card,
 * tint or text without a square behind him.
 *
 * Behaviour:
 *   - `idle` and `asleep` loop. Every other state is a one-shot: it plays
 *     through, then the component returns to idle on its own. A parent that
 *     flips back to `idle` mid-clip is ignored until the clip finishes, so a
 *     700ms "cheer" tick from a picker still shows the whole nod.
 *   - `sleepy` is the exception: bedtime plays once and then hands over to
 *     the sleep loop, and Sol stays asleep until the parent asks for
 *     something else. `asleep` skips the bedtime and starts in the loop.
 *   - Every time the app comes back to the foreground the current state's
 *     clip starts over from its first frame (a mount does the same), so a
 *     screen left on `sleepy` shows the whole bedtime again on each return
 *     rather than resuming mid-loop.
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
import { AppState, Image, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
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
  | 'asleep'
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

type Clip = 'idle' | 'listening' | 'thinking' | 'approving' | 'surprised' | 'bedtime' | 'sleep';

/** Clips that repeat until the parent changes state. */
const LOOPS: ReadonlySet<Clip> = new Set<Clip>(['idle', 'sleep']);

/** Which clip a state plays. Sad/disappointed have no clip of their own yet: Sol just watches. */
const CLIP_FOR: Record<MascotState, Clip> = {
  idle: 'idle',
  happy: 'approving',
  cheering: 'approving',
  thinking: 'thinking',
  listening: 'listening',
  surprised: 'surprised',
  sleepy: 'bedtime',
  asleep: 'sleep',
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
  sleep: require('../../assets/mascot/video/sol-sleep.mov'),
};

const STILL = require('../../assets/mascot/sol-still.png');

const CAN_PLAY = Platform.OS === 'ios';

export function Mascot({ state = 'idle', size = 'md', style, accessibilityVisible = false }: MascotProps) {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const { shouldReduce } = useMotion();
  const wanted = CLIP_FOR[state];
  const [clip, setClip] = useState<Clip>(wanted);
  const [ready, setReady] = useState(false);
  // Bumped on every return to the foreground; part of the Video key, so the
  // player remounts and the sequence starts from frame one.
  const [run, setRun] = useState(0);
  const busyRef = useRef(false);

  // Latch: a one-shot runs to its end even if the parent has already gone
  // back to idle. A new request replaces whatever is playing. Loops never
  // latch, so a parent can always move Sol out of idle or sleep.
  useEffect(() => {
    if (wanted === 'idle') {
      if (!busyRef.current) setClip('idle');
      return;
    }
    busyRef.current = !LOOPS.has(wanted);
    setClip(wanted);
  }, [wanted]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      busyRef.current = !LOOPS.has(wanted);
      setClip(wanted);
      setRun((n) => n + 1);
    });
    return () => sub.remove();
  }, [wanted]);

  const onStatus = (s: AVPlaybackStatus) => {
    if (!s.isLoaded) return;
    if (!ready) setReady(true);
    if (s.didJustFinish && !LOOPS.has(clip)) {
      busyRef.current = false;
      // Bedtime ends asleep on purpose and keeps sleeping; everything else
      // wakes back up.
      setClip(clip === 'bedtime' ? 'sleep' : 'idle');
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
        key={`${clip}-${run}`}
        source={CLIPS[clip]}
        style={[styles.fill, styles.clear]}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isMuted
        isLooping={LOOPS.has(clip)}
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
