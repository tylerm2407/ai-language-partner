/**
 * MascotSol — the UI 2.0 screens' handle on the mascot.
 *
 * Kept as a thin wrapper so the onboarding, welcome and plan-builder screens
 * keep their `mood` prop while the real character lives in
 * components/mascot/Mascot (video clips now, Rive later).
 */
import { Mascot, type MascotState } from '../mascot/Mascot';

export type MascotMood =
  | 'idle'
  | 'think'
  | 'cheer'
  | 'celebrate'
  | 'listening'
  | 'thinking'
  | 'approving'
  | 'surprised'
  | 'amazed'
  | 'confused'
  | 'wince'
  | 'wave'
  | 'bedtime'
  | 'asleep';

/**
 * `cheer` is the small nod a good tap earns — the onboarding steps fire it on
 * a 700 ms tick, so it must stay small. `celebrate` is the big one (Sol rears
 * up and puffs a flame) and belongs to a moment that actually finished.
 */
const STATE_FOR: Record<MascotMood, MascotState> = {
  idle: 'idle',
  think: 'thinking',
  thinking: 'thinking',
  cheer: 'happy',
  celebrate: 'cheering',
  approving: 'happy',
  listening: 'listening',
  surprised: 'surprised',
  amazed: 'amazed',
  confused: 'confused',
  wince: 'sad',
  wave: 'waving',
  bedtime: 'sleepy',
  asleep: 'asleep',
};

interface MascotSolProps {
  size?: number;
  mood?: MascotMood;
  /** Accepted for API compatibility; the clips carry their own colour. */
  tint?: string;
}

export function MascotSol({ size = 96, mood = 'idle' }: MascotSolProps) {
  return <Mascot state={STATE_FOR[mood]} size={size} />;
}
