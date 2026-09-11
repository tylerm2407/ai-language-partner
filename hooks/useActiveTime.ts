/**
 * useActiveTime — one line in a practice screen that makes the minutes real.
 *
 * Drop `useActiveTime({ kind: 'lesson', enabled: !loading })` into a screen and
 * it runs an `ActiveClock` for as long as the screen is mounted and enabled,
 * pauses while the app is backgrounded, and writes the total to `daily_stats`
 * on the way out via the additive `upsert_daily_stats` RPC.
 *
 * The RPC is additive and clamps `minutes_practiced` to [0, 1440] (migration
 * 114), and the column is REAL — fractional minutes are stored as given, so a
 * 90-second exercise is 1.5 minutes rather than being rounded to nothing.
 *
 * WHAT EACH KIND WRITES, AND WHY IT IS NOT SYMMETRIC
 *
 *   lesson  → minutesPracticed
 *   review  → minutesPracticed
 *   reading → minutesPracticed + readingMinutes
 *   chat    → minutesPracticed
 *   tutor   → minutesPracticed + listeningMinutes
 *
 * `chat` writes the wall clock and NOTHING else on purpose. The chat screen
 * already writes `speaking_minutes` per voice turn, from the turn's own
 * measured duration (`app/(app)/chat/index.tsx`, `handleVoiceMessage`) — that
 * is a better number than anything a screen-level clock could produce, so this
 * hook must not touch it or the same speech is counted twice. Attributing the
 * session to `writing_minutes` instead would be just as wrong: a chat session
 * mixes typed and spoken turns freely, so crediting the whole wall clock to
 * writing would both double-count the spoken half and mislabel it. The
 * four-strands balance is better served by one honest total plus the accurate
 * per-turn speaking number than by a guess at the split.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useDailyStats } from './useDailyStats';
import { createActiveClock, type ActiveClock } from '../lib/active-time';
import type { DailyStats } from '../types';

export type ActiveTimeKind = 'lesson' | 'review' | 'reading' | 'chat' | 'tutor';

/**
 * Below this, nothing is written. A screen opened and closed in a couple of
 * seconds — a mis-tap, a back-out — is not practice, and writing it costs a
 * round trip to say so.
 */
const MIN_WRITE_SECONDS = 10;

type StatsDelta = Partial<Omit<DailyStats, 'id' | 'userId' | 'date'>>;

/** Minutes, to 2dp. The column is REAL; more precision than that is noise. */
function toMinutes(seconds: number): number {
  return Math.round((seconds / 60) * 100) / 100;
}

function deltaFor(kind: ActiveTimeKind, seconds: number): StatsDelta {
  const minutes = toMinutes(seconds);
  switch (kind) {
    case 'reading':
      return { minutesPracticed: minutes, readingMinutes: minutes };
    case 'tutor':
      return { minutesPracticed: minutes, listeningMinutes: minutes };
    // See the header: chat's spoken half is already measured per turn, so the
    // wall clock stays unattributed rather than double-counting it.
    case 'chat':
    case 'lesson':
    case 'review':
    default:
      return { minutesPracticed: minutes };
  }
}

export interface UseActiveTimeOptions {
  kind: ActiveTimeKind;
  /**
   * Counts only while true. Screens pass their "actually practising" condition
   * — loaded, not on a paywall, reader open — so time spent on a spinner or an
   * error state is not sold back to the learner as practice.
   */
  enabled: boolean;
}

export interface UseActiveTime {
  /**
   * Bank and write what has accrued so far, without unmounting.
   *
   * For screens that reach a natural end while staying mounted (a lesson's
   * results view, a finished call). Idempotent — the clock hands its total over
   * once, so the unmount flush that follows writes nothing.
   */
  flush: () => Promise<void>;
}

export function useActiveTime({ kind, enabled }: UseActiveTimeOptions): UseActiveTime {
  const { addStats } = useDailyStats();

  const clockRef = useRef<ActiveClock | null>(null);
  if (clockRef.current === null) clockRef.current = createActiveClock();

  // `addStats` is recreated whenever the user or the store setter changes, and
  // the flush effect must not re-run (and re-write) because of that. Held in a
  // ref so the effects below depend only on `kind` and `enabled`.
  const addStatsRef = useRef(addStats);
  addStatsRef.current = addStats;
  const kindRef = useRef(kind);
  kindRef.current = kind;

  const flush = useCallback(async () => {
    const clock = clockRef.current;
    if (!clock) return;
    const seconds = clock.stop();
    if (seconds < MIN_WRITE_SECONDS) return;
    try {
      await addStatsRef.current(deltaFor(kindRef.current, seconds));
    } catch (err) {
      // Deliberately non-fatal and deliberately loud. Losing a minute of
      // practice must not take a lesson's completion screen down with it, but
      // it must not vanish silently either — this column reading zero for
      // months is exactly how it got here.
      console.warn('[active-time] minutes write failed (non-fatal):', err);
    }
  }, []);

  // Run the clock while enabled; bank and write on the way out.
  useEffect(() => {
    const clock = clockRef.current;
    if (!clock || !enabled) return;

    clock.start();
    return () => {
      void flush();
    };
  }, [enabled, kind, flush]);

  // Backgrounded time is not practice. `inactive` (iOS control centre, an
  // incoming call banner, the app switcher) pauses too — it is a screen the
  // learner is no longer reading.
  useEffect(() => {
    if (!enabled) return;

    const onChange = (state: AppStateStatus) => {
      const clock = clockRef.current;
      if (!clock) return;
      if (state === 'active') clock.resume();
      else clock.pause();
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled]);

  return { flush };
}
