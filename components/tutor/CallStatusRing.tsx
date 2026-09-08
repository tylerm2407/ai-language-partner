/**
 * What the call is doing right now, in the middle of the screen.
 *
 * ── NEVER COLOUR-ONLY ──
 *
 * Eleven phases collapse onto one ring, and the temptation is to let the ring's
 * colour be the answer: indigo means the tutor is talking, green means it is
 * your turn. That fails the same people the correct/incorrect rule protects, so
 * every state carries THREE cues that always agree — a ring colour, an icon,
 * and a text label underneath. Remove the colour and the screen still reads.
 * `phasePresentation` is the single place the mapping lives, so a phase added
 * to `TutorPhase` produces one compile error here rather than three silent
 * half-updates.
 *
 * ── THE `level` PROP IS A MICROPHONE, NOT A DECORATION ──
 *
 * The pulse is driven by real amplitude. That matters: a ring that shimmers on
 * a timer tells the learner the app is hearing them whether or not it is, and
 * "am I actually being heard" is the single most common failure a voice call
 * has. Faking it would be reporting a state we have not measured — the same
 * reason `LiveComposer`'s waveform is bound to the real meter.
 *
 * Under reduce-motion the amplitude is ignored ENTIRELY — not slowed, not
 * damped. A learner who asked for less motion has asked not to have something
 * moving continuously in the centre of their screen for ten minutes, and a
 * gentle pulse is still a pulse. What they get instead is a static indicator
 * over the four `ringState` buckets, which is the same information at a
 * coarser grain: the icon and the label are untouched, so nothing is lost
 * except the animation.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { radii, spacing, type Ui2Palette } from '../../config/theme';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Body, Caption } from '../ui2/Ui2Text';
import { TutorPortrait } from './TutorPortrait';
import { Spectrum, type SpectrumState } from './Spectrum';
import type { TutorPhase } from '../../lib/realtime-session';

export interface PhasePresentation {
  /** Ring + icon colour, as a PALETTE KEY rather than a colour: the mapping is
   *  a pure function of the phase and the scheme resolves it, so one table
   *  serves light and dark. One of three cues, never the only one. */
  tone: keyof Ui2Palette;
  icon: keyof typeof Ionicons.glyphMap;
  /** Drawn under the ring AND used as the live-region announcement. */
  label: string;
  /** Second line. `null` where the label already says everything. */
  detail: string | null;
}

/**
 * Coarse buckets for the reduce-motion indicator.
 *
 * Four, not three: `stopped` cannot be folded into `preparing` because a call
 * that has ended must not look like one that is still dialling — that is the
 * difference between "wait" and "it's over", and getting it wrong strands
 * someone on a dead screen. The three live buckets are the three-state
 * indicator; `stopped` is the terminal one.
 */
export type RingState = 'preparing' | 'listening' | 'speaking' | 'stopped';

export function ringState(phase: TutorPhase): RingState {
  switch (phase) {
    case 'greeting':
    case 'tutor_speaking':
      return 'speaking';
    case 'listening':
    case 'interrupted':
      return 'listening';
    case 'idle':
    case 'preflight':
    case 'connecting':
    case 'reconnecting':
    case 'paused':
      return 'preparing';
    case 'ending':
    case 'ended':
    case 'error':
      return 'stopped';
  }
}

/**
 * Phase → the three agreeing cues.
 *
 * Colour choices are the app's existing semantics, not new ones: `green` is
 * already what "live, the mic is open" looks like in the chat header, and
 * `primary` is already the tutor's voice. `yellow` is reserved for states the
 * learner may need to do something about (reconnecting), and `error` for the
 * one where the call is over because it failed.
 *
 * `error` the PHASE is declared by the reducer but deliberately never entered —
 * a failed session arrives as `ended`. It is mapped anyway so that a host which
 * does render it gets an honest screen rather than a crash.
 */
export function phasePresentation(phase: TutorPhase): PhasePresentation {
  switch (phase) {
    case 'idle':
      return { tone: 'idle', icon: 'ellipse-outline', label: 'Ready', detail: null };
    case 'preflight':
      return {
        tone: 'idle',
        icon: 'settings-outline',
        label: 'Getting ready',
        detail: 'Checking your microphone',
      };
    case 'connecting':
      return {
        tone: 'primary',
        icon: 'sync-outline',
        label: 'Connecting',
        detail: null,
      };
    case 'greeting':
      return {
        tone: 'primary',
        icon: 'volume-high-outline',
        label: 'Saying hello',
        detail: null,
      };
    case 'listening':
      return { tone: 'green', icon: 'mic-outline', label: 'Listening', detail: 'Your turn' };
    case 'tutor_speaking':
      return {
        tone: 'primary',
        icon: 'volume-high-outline',
        label: 'Speaking',
        detail: null,
      };
    case 'interrupted':
      // Not an error and not the learner's fault — they talked over the tutor,
      // which is what a conversation is. The label says what happened to the
      // tutor's sentence, because the transcript is about to show it cut off.
      return {
        tone: 'green',
        icon: 'hand-left-outline',
        label: 'Listening',
        detail: 'Stopped so you can talk',
      };
    case 'paused':
      return { tone: 'idle', icon: 'pause-circle-outline', label: 'Paused', detail: null };
    case 'reconnecting':
      return {
        tone: 'yellow',
        icon: 'cloud-offline-outline',
        label: 'Reconnecting',
        detail: 'Hang on — the connection dropped',
      };
    case 'ending':
      return {
        tone: 'idle',
        icon: 'stop-circle-outline',
        label: 'Wrapping up',
        detail: null,
      };
    case 'ended':
      return {
        tone: 'idle',
        icon: 'checkmark-circle-outline',
        label: 'Call ended',
        detail: null,
      };
    case 'error':
      return {
        tone: 'error',
        icon: 'alert-circle-outline',
        label: 'Call ended',
        detail: 'Something went wrong',
      };
  }
}

/**
 * How far the ring is allowed to grow at full amplitude.
 *
 * Small on purpose. The ring sits under the learner's eyes for the whole call;
 * a 20% throb is a distraction, and a 6% one is peripheral feedback.
 */

export function clampLevel(level: number | undefined): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) return 0;
  return Math.min(1, Math.max(0, level));
}

/** The sound picture's state for a phase: the four ring buckets, with the
 *  never-started call resting rather than preparing. */
export function spectrumState(phase: TutorPhase): SpectrumState {
  if (phase === 'idle') return 'idle';
  return ringState(phase);
}

interface CallStatusRingProps {
  phase: TutorPhase;
  portraitId: string;
  name: string;
  level?: number;
}

/**
 * The call's stage (Talk direction C1 "Spectrum", 2026-09-08): the portrait,
 * the bar analyser under it in the phase's colour, then the three agreeing
 * cues — icon, label, detail. The name is historical; the pulsing ring it
 * drew was never fed a level by the call screen (see Spectrum.tsx for what
 * drives the bars instead), and the exports above are what the tests pin.
 */
export function CallStatusRing({ phase, portraitId, name, level }: CallStatusRingProps) {
  const { c } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const presentation = phasePresentation(phase);
  const color = c[presentation.tone];
  const state = ringState(phase);
  // The bars take the phase colour while the call runs. Before it starts they
  // rest in violet (the lobby is the conversation screen at rest, not a grey
  // one), and after it ends they rest in the idle grey whatever the label's
  // tone — a red analyser under "Call ended" would read as an alarm.
  const barColor = state === 'stopped' ? c.idle : phase === 'idle' ? c.primary : color;

  return (
    <View style={styles.root}>
      <TutorPortrait portraitId={portraitId} name={name} size="hero" />

      <Spectrum
        state={spectrumState(phase)}
        color={barColor}
        height={96}
        level={typeof level === 'number' ? clampLevel(level) : undefined}
      />

      <View style={styles.statusRow}>
        <Ionicons name={presentation.icon} size={18} color={color} />
        <Body
          weight="extrabold"
          accessibilityLiveRegion="polite"
          accessibilityRole="text"
          style={{ color }}
        >
          {presentation.label}
        </Body>
      </View>

      {presentation.detail ? (
        <Caption tone="tertiary" style={styles.detail}>
          {presentation.detail}
        </Caption>
      ) : null}

      {shouldReduce ? (
        <View
          style={styles.dots}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {(['preparing', 'listening', 'speaking'] as const).map((bucket) => (
            <View
              key={bucket}
              style={[
                styles.dot,
                { backgroundColor: state === bucket ? color : c.track },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detail: {
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
});
