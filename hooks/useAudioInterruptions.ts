import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { PauseReason } from '../lib/handsfree-session';

/**
 * Detects the things that should interrupt a hands-free session.
 *
 * WHAT COUNTS AS AN INTERRUPTION — and what deliberately does not.
 *
 * Backgrounding is NOT one. A learner locking their phone and putting it in a
 * pocket is the intended way to use this feature, so treating `background` as
 * a pause would break the whole thing. That makes AppState a poor primary
 * signal, because the state it reports for "phone locked, session running
 * fine" and "a call arrived" is very nearly the same.
 *
 * The reliable signal is the audio itself: when playback stops without having
 * finished, something took the audio route. A call, Siri, another app, or the
 * headphones being pulled all surface that way. So the host reports playback
 * stalls to this hook and it reports them onward as pauses.
 *
 * Network loss is NOT a pause either. The session runs off pre-fetched audio
 * specifically so a tunnel does not stop it; losing connectivity only degrades
 * pre-fetch, which the host handles by exhausting its buffer.
 *
 * KNOWN LIMITATION: expo-av gives no distinct JS event for headphone
 * disconnect, so it arrives here indistinguishable from any other stall and is
 * reported as `focus_loss`. Precise routing events need a native media
 * session, which is Phase B.
 */

export interface InterruptionHandlers {
  onPause: (reason: PauseReason) => void;
  onResume: () => void;
  onNetworkChange: (online: boolean) => void;
}

/**
 * How long `inactive` must persist before it is treated as an interruption.
 *
 * iOS reports `inactive` for a notification banner and for the Control Centre
 * being swiped down — neither of which should stop a session. A real
 * interruption keeps the app inactive or moves it to `background`. Debouncing
 * avoids pausing for a banner that vanishes in under a second.
 */
export const INACTIVE_DEBOUNCE_MS = 700;

export function useAudioInterruptions(
  active: boolean,
  handlers: InterruptionHandlers,
): void {
  // Held in a ref so the subscriptions below never need to re-bind when a
  // caller passes fresh closures — re-binding NetInfo mid-session drops the
  // current connectivity reading.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const inactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedByUs = useRef(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!active) return;

    const clearInactiveTimer = () => {
      if (inactiveTimer.current) {
        clearTimeout(inactiveTimer.current);
        inactiveTimer.current = null;
      }
    };

    const appStateSub = AppState.addEventListener('change', (next) => {
      const previous = appState.current;
      appState.current = next;

      if (next === 'inactive') {
        // Might be a banner, might be a call. Wait and see.
        clearInactiveTimer();
        inactiveTimer.current = setTimeout(() => {
          inactiveTimer.current = null;
          if (appState.current === 'inactive') {
            pausedByUs.current = true;
            handlersRef.current.onPause('call');
          }
        }, INACTIVE_DEBOUNCE_MS);
        return;
      }

      if (next === 'background') {
        // Backgrounding is normal operation — screen off, phone pocketed.
        // Cancel any pending inactive pause rather than firing it late.
        clearInactiveTimer();
        return;
      }

      if (next === 'active') {
        clearInactiveTimer();
        // Only resume what we paused. If the learner paused deliberately,
        // returning to the app must not restart the session under them.
        if (pausedByUs.current && previous !== 'active') {
          pausedByUs.current = false;
          handlersRef.current.onResume();
        }
      }
    });

    const netInfoSub = NetInfo.addEventListener((state) => {
      handlersRef.current.onNetworkChange(state.isConnected === true);
    });

    return () => {
      clearInactiveTimer();
      appStateSub.remove();
      netInfoSub();
    };
  }, [active]);
}

/**
 * Classify an audio playback stall.
 *
 * Called by the host from its playback status callback when a sound stops
 * without having finished. Kept separate and pure so the policy is testable —
 * the detection itself is native and is not.
 */
export function stallIsInterruption(status: {
  isLoaded: boolean;
  isPlaying?: boolean;
  didJustFinish?: boolean;
  positionMillis?: number;
  previousPositionMillis?: number;
}): boolean {
  if (!status.isLoaded) return false;
  // Finishing normally is not a stall — it is the loop working.
  if (status.didJustFinish) return false;
  if (status.isPlaying) return false;
  // Not playing, not finished, and the position has not advanced: something
  // took the audio route away.
  return status.positionMillis === status.previousPositionMillis;
}
