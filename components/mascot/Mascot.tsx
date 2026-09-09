/**
 * Mascot — Sol, the dragon.
 *
 * Plays the interim clips in assets/mascot/video: five moods generated from
 * the master still with the same frame at both ends (so they return to the
 * drawing), a fifteen-second bedtime piece, and an eight-second sleep loop
 * whose first and last frames are the bedtime clip's final frame, so bedtime
 * runs straight into it with no cut. Each clip is an animated WebP with a
 * real alpha channel, decoded by expo-image (SDWebImage on iOS, Glide on
 * Android), so Sol sits on any card, tint or text without a square behind
 * him — on a device, in the iOS Simulator, and on Android alike.
 *
 * ── WHY WEBP AND NOT THE HEVC .MOV (2026-09-09) ──
 *
 * The first cut played HEVC-with-alpha .mov files through expo-av. Those
 * files are correct (a Mac decode returns a transparent corner pixel) and a
 * device composites them, but the iOS Simulator decodes only the base layer,
 * so Sol appeared in a white square everywhere the simulator was used —
 * glaring in dark mode. A "show the still on the simulator" workaround
 * followed, and Tyler rightly did not want a still. One asset that animates
 * with alpha everywhere beats two paths, and the WebPs were already shipped
 * as the Android path, so this is where it was heading anyway.
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
 *   - An animated image reports no end-of-animation event, so the measured
 *     clip lengths (`CLIP_MS`) drive the hand-over from a one-shot.
 *   - Reduce Motion shows the transparent still.
 *
 * The state names are the old star mascot's, so nothing upstream changes.
 * When the Rive rig lands it replaces the Image element behind this same API.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
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
  idle: require('../../assets/mascot/video/sol-idle.webp'),
  listening: require('../../assets/mascot/video/sol-listening.webp'),
  thinking: require('../../assets/mascot/video/sol-thinking.webp'),
  approving: require('../../assets/mascot/video/sol-approving.webp'),
  surprised: require('../../assets/mascot/video/sol-surprised.webp'),
  bedtime: require('../../assets/mascot/video/sol-bedtime.webp'),
  sleep: require('../../assets/mascot/video/sol-sleep.webp'),
};

/**
 * Clip lengths in ms, read from the files with `webpmux -info` (frame delays
 * summed). Re-measure if a clip is regenerated: too short and Sol snaps back
 * to idle mid-nod, too long and he holds the last frame.
 */
export const CLIP_MS: Record<Clip, number> = {
  idle: 16375,
  listening: 5146,
  thinking: 5146,
  approving: 5146,
  surprised: 5146,
  bedtime: 15023,
  sleep: 7968,
};

/** What a finished one-shot hands over to. Pure so the chain can be asserted. */
export function afterClip(clip: Clip): Clip {
  // Bedtime ends asleep on purpose and keeps sleeping; everything else wakes.
  return clip === 'bedtime' ? 'sleep' : 'idle';
}

const STILL = require('../../assets/mascot/sol-still.png');

export function Mascot({ state = 'idle', size = 'md', style, accessibilityVisible = false }: MascotProps) {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const { shouldReduce } = useMotion();
  const wanted = CLIP_FOR[state];
  const [clip, setClip] = useState<Clip>(wanted);
  // Bumped on every fresh request and on every return to the foreground;
  // part of the Image key, so the animation remounts and starts from frame
  // one instead of sitting on the last frame it reached.
  const [run, setRun] = useState(0);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = (next: Clip) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    busyRef.current = !LOOPS.has(next);
    setClip(next);
    setRun((n) => n + 1);
    if (LOOPS.has(next)) return;
    timerRef.current = setTimeout(() => {
      busyRef.current = false;
      const after = afterClip(next);
      setClip(after);
      setRun((n) => n + 1);
    }, CLIP_MS[next]);
  };

  // Latch: a one-shot runs to its end even if the parent has already gone
  // back to idle. A new request replaces whatever is playing. Loops never
  // latch, so a parent can always move Sol out of idle or sleep.
  useEffect(() => {
    if (wanted === 'idle') {
      if (!busyRef.current) setClip('idle');
      return;
    }
    play(wanted);
    // Re-running on the wanted clip alone is the intended trigger; `play`
    // closes over refs and setters only.
  }, [wanted]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      play(wanted);
    });
    return () => sub.remove();
  }, [wanted]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const a11y = {
    accessibilityElementsHidden: !accessibilityVisible,
    importantForAccessibility: (accessibilityVisible ? 'yes' : 'no') as 'yes' | 'no',
    accessibilityLabel: accessibilityVisible ? `Sol, ${state}` : undefined,
  };

  return (
    <View style={[{ width: px, height: px }, style]} {...a11y}>
      {shouldReduce ? (
        <Image source={STILL} style={styles.fill} contentFit="contain" />
      ) : (
        <Image
          key={`${clip}-${run}`}
          source={CLIPS[clip]}
          style={styles.fill}
          contentFit="contain"
          autoplay
          // The still shows until the first frame decodes, so there is never
          // an empty box on mount or on a clip swap.
          placeholder={STILL}
          placeholderContentFit="contain"
          transition={0}
          cachePolicy="memory"
        />
      )}
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
  fill: { width: '100%', height: '100%', backgroundColor: 'transparent' },
});
