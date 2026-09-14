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
import { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * The one-shot files carry loop count 1 (set with `webpmux -set loop 1`), the
 * loops carry 0. So if the JS timer below fires late, a one-shot holds its
 * last frame instead of wrapping to its first — bedtime must never snap from
 * asleep back to standing while the sleep loop is still being handed in.
 * Keep that when a clip is regenerated.
 */
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
/** First frame of the sleep loop (== last frame of bedtime), so a clip that starts asleep never shows him standing first. */
const ASLEEP_STILL = require('../../assets/mascot/sol-asleep-still.png');

function stillFor(clip: Clip): number {
  return clip === 'sleep' ? ASLEEP_STILL : STILL;
}

/**
 * One mounted Image. `run` is part of the React key: a new run is a fresh
 * native view starting at frame one. The key is what makes the hand-over
 * below seamless — the slot that was pre-loaded keeps its key, so React keeps
 * the native view and nothing has to decode at the moment of the swap.
 */
interface Slot {
  clip: Clip;
  run: number;
}

export function Mascot({ state = 'idle', size = 'md', style, accessibilityVisible = false }: MascotProps) {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const { shouldReduce } = useMotion();
  const wanted = CLIP_FOR[state];
  const runRef = useRef(0);
  const nextRun = () => ++runRef.current;
  // `front` is what the learner sees. `back` is the clip a one-shot hands
  // over to, mounted underneath at opacity 0 with autoplay off, so its first
  // frame is already decoded when the front finishes. The old approach
  // remounted a single Image on the hand-over, and for ~100-300 ms the
  // placeholder still (Sol standing) showed while the sleep loop decoded —
  // a visible flash on the welcome screen at the end of bedtime.
  const [front, setFront] = useState<Slot>(() => ({ clip: wanted, run: nextRun() }));
  const [back, setBackState] = useState<Slot | null>(() =>
    LOOPS.has(wanted) ? null : { clip: afterClip(wanted), run: nextRun() },
  );
  // Mirror of `back` the timer can read without nesting state updates.
  const backRef = useRef<Slot | null>(back);
  const setBack = (b: Slot | null) => {
    backRef.current = b;
    setBackState(b);
  };
  const busyRef = useRef(!LOOPS.has(wanted));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frontRef = useRef<Image>(null);
  const mountedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const play = (next: Clip) => {
    clearTimer();
    busyRef.current = !LOOPS.has(next);
    setFront({ clip: next, run: nextRun() });
    setBack(LOOPS.has(next) ? null : { clip: afterClip(next), run: nextRun() });
  };

  // The one-shot timer starts when the front clip has actually loaded, not
  // when it was requested: decode time would otherwise be taken off the end
  // of the clip.
  const onFrontLoad = useCallback((slot: Slot) => {
    if (LOOPS.has(slot.clip)) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      busyRef.current = false;
      // Promote the pre-loaded slot. Its key is unchanged, so this is an
      // opacity flip plus startAnimating on a view that is already showing
      // the right first frame.
      const promoted = backRef.current ?? { clip: afterClip(slot.clip), run: nextRun() };
      setBack(null);
      setFront(promoted);
    }, CLIP_MS[slot.clip]);
  }, []);

  useEffect(() => {
    if (LOOPS.has(front.clip)) {
      // Fresh mounts autoplay already; a promoted slot was mounted with
      // autoplay off and needs the nudge. Calling it on both is harmless.
      frontRef.current?.startAnimating().catch(() => undefined);
    }
  }, [front]);

  // Latch: a one-shot runs to its end even if the parent has already gone
  // back to idle. A new request replaces whatever is playing. Loops never
  // latch, so a parent can always move Sol out of idle or sleep.
  useEffect(() => {
    if (!mountedRef.current) {
      // The initial state was mounted by useState; do not remount it.
      mountedRef.current = true;
      return;
    }
    if (wanted === 'idle') {
      if (!busyRef.current) {
        setFront((f) => (f.clip === 'idle' ? f : { clip: 'idle', run: nextRun() }));
        setBack(null);
      }
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

  useEffect(() => () => clearTimer(), []);

  const a11y = {
    accessibilityElementsHidden: !accessibilityVisible,
    importantForAccessibility: (accessibilityVisible ? 'yes' : 'no') as 'yes' | 'no',
    accessibilityLabel: accessibilityVisible ? `Sol, ${state}` : undefined,
  };

  const renderSlot = (slot: Slot, isFront: boolean) => (
    <Image
      key={`${slot.clip}-${slot.run}`}
      ref={isFront ? frontRef : undefined}
      source={CLIPS[slot.clip]}
      style={[styles.fill, isFront ? null : styles.hidden]}
      contentFit="contain"
      // The pre-loaded slot sits on its first frame until it is promoted.
      autoplay={isFront}
      onLoad={isFront ? () => onFrontLoad(slot) : undefined}
      // The still shows until the first frame decodes, so there is never an
      // empty box on a mount or a fresh request.
      placeholder={stillFor(slot.clip)}
      placeholderContentFit="contain"
      transition={0}
      cachePolicy="memory"
    />
  );

  return (
    <View style={[{ width: px, height: px }, style]} {...a11y}>
      {shouldReduce ? (
        <Image source={stillFor(wanted)} style={styles.fill} contentFit="contain" />
      ) : (
        <>
          {back ? renderSlot(back, false) : null}
          {renderSlot(front, true)}
        </>
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
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  hidden: { opacity: 0 },
});
