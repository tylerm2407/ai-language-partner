/** Whether an immersive surface (the reader) is mounted. See lib/immersive-mode.ts. */
import { useSyncExternalStore } from 'react';
import { isImmersive, subscribeImmersive } from '../lib/immersive-mode';

export function useImmersive(): boolean {
  return useSyncExternalStore(subscribeImmersive, isImmersive, isImmersive);
}
