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
  | 'listening'
  | 'thinking'
  | 'approving'
  | 'surprised'
  | 'bedtime'
  | 'asleep';

const STATE_FOR: Record<MascotMood, MascotState> = {
  idle: 'idle',
  think: 'thinking',
  thinking: 'thinking',
  cheer: 'cheering',
  approving: 'happy',
  listening: 'listening',
  surprised: 'surprised',
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
