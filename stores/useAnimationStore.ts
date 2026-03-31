import { create } from 'zustand';

export type AnimationEvent =
  | { type: 'xp_earned'; xp: number }
  | { type: 'level_up'; level: number; tier: string; tierChanged: boolean }
  | { type: 'achievement'; achievementId: string }
  | { type: 'streak_milestone'; streak: number }
  | { type: 'challenge_complete'; challengeId: string };

interface AnimationState {
  queue: AnimationEvent[];
  currentEvent: AnimationEvent | null;

  enqueue: (event: AnimationEvent) => void;
  dequeue: () => void;
  clear: () => void;
}

export const useAnimationStore = create<AnimationState>((set, get) => ({
  queue: [],
  currentEvent: null,

  enqueue: (event) => {
    const { currentEvent, queue } = get();
    if (!currentEvent) {
      // Play immediately if nothing is playing
      set({ currentEvent: event });
    } else {
      // Queue for sequential playback
      set({ queue: [...queue, event] });
    }
  },

  dequeue: () => {
    const { queue } = get();
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ currentEvent: next, queue: rest });
    } else {
      set({ currentEvent: null });
    }
  },

  clear: () => set({ queue: [], currentEvent: null }),
}));
