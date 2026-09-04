/**
 * Play a stream of sentences in order, while synthesising the next ones ahead.
 *
 * A spoken turn used to be: wait for the whole reply, then wait for the whole
 * synthesis, then speak. This exists to overlap those — sentence one is being
 * spoken while sentence two is still at the TTS endpoint and sentence three is
 * still being written by the model.
 *
 * TWO INVARIANTS, AND WHY EACH ONE MATTERS
 *
 *   ORDER. Synthesis finishes out of order — a five-word sentence comes back
 *   before a thirty-word one sent earlier. Playing on completion would deliver
 *   the tutor's reply scrambled. So synthesis is parallel and playback is a
 *   strict queue: item N+1 never starts until item N has finished.
 *
 *   DRAIN. In hands-free mode, playback finishing is what re-opens the
 *   microphone (see `speakReply` in app/(app)/chat/index.tsx). With a queue,
 *   "finished" means the LAST sentence finished and no more are coming — not
 *   the first. Reopening the mic after sentence one would have the learner
 *   talking over the tutor and the recogniser hearing the tutor's own voice,
 *   which is exactly the loop this app has no echo cancellation for. That is
 *   what `close()` and `onDrained` are: `close()` says the stream produced its
 *   last sentence, `onDrained` fires once, after the last one has been heard.
 *
 * Both dependencies are injected, so `speech-queue.test.ts` can drive the whole
 * thing with fake timers and no audio hardware.
 */

export interface SpeechQueueOptions {
  /** Text in, playable URI out. In the app this is `getSpeechUri`. */
  synthesize: (text: string) => Promise<string>;
  /** Play a URI; the promise resolves when it has finished (or been cut off). */
  play: (uri: string) => Promise<void>;
  /** A sentence that could not be synthesised or played. The queue continues. */
  onError?: (error: unknown, text: string) => void;
  /** The first sentence has started playing. Used to enter TTS_PLAYING. */
  onSpeakingStarted?: () => void;
  /** Everything enqueued has been heard and `close()` was called. Fires once. */
  onDrained?: () => void;
  /**
   * How many sentences may be synthesised at once, counting the one playing.
   *
   * Two is the useful number: while sentence N plays, N+1 is being made. Going
   * wider buys nothing — the learner cannot hear ahead — and would fire a burst
   * of TTS requests for a long reply the learner may well interrupt.
   */
  maxLookahead?: number;
}

export interface SpeechQueue {
  /** Add a sentence. Synthesis may start immediately; playback stays in order. */
  enqueue(text: string): void;
  /** No more sentences are coming. Required for `onDrained` to ever fire. */
  close(): void;
  /** Stop now and never drain — barge-in, leaving the screen, a safety fallback. */
  cancel(): void;
  /** How many sentences have been handed to this queue. */
  readonly size: number;
  readonly cancelled: boolean;
}

interface QueueItem {
  text: string;
  synth: Promise<string> | null;
}

export function createSpeechQueue(options: SpeechQueueOptions): SpeechQueue {
  const lookahead = Math.max(1, options.maxLookahead ?? 2);
  const items: QueueItem[] = [];

  let playIndex = 0;
  let closed = false;
  let cancelled = false;
  let drained = false;
  let pumping = false;
  let started = false;

  /**
   * Kick off synthesis for everything inside the lookahead window.
   *
   * The rejection is swallowed here and re-thrown where it is awaited. Without
   * the no-op catch, a synthesis that fails while an earlier sentence is still
   * playing is an unhandled rejection — which on React Native is a red screen
   * in dev and a Sentry alarm in production, for a case the queue handles.
   */
  function primeSynthesis(): void {
    if (cancelled) return;
    const limit = Math.min(items.length, playIndex + lookahead);
    for (let i = playIndex; i < limit; i++) {
      const item = items[i];
      if (item.synth) continue;
      item.synth = options.synthesize(item.text);
      item.synth.catch(() => {});
    }
  }

  function maybeDrain(): void {
    if (cancelled || drained || pumping) return;
    if (!closed || playIndex < items.length) return;
    drained = true;
    options.onDrained?.();
  }

  async function pump(): Promise<void> {
    if (pumping || cancelled) return;
    pumping = true;
    try {
      while (!cancelled && playIndex < items.length) {
        primeSynthesis();
        const item = items[playIndex];
        try {
          const uri = await item.synth!;
          if (cancelled) return;
          if (!started) {
            started = true;
            options.onSpeakingStarted?.();
          }
          await options.play(uri);
        } catch (error) {
          // One sentence lost is a gap in the audio; abandoning the queue would
          // also strand the hands-free loop, because `onDrained` is what hands
          // the turn back. Report it and keep going.
          if (!cancelled) options.onError?.(error, item.text);
        }
        playIndex++;
      }
    } finally {
      pumping = false;
      maybeDrain();
    }
  }

  return {
    enqueue(text: string): void {
      if (cancelled || closed) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      items.push({ text: trimmed, synth: null });
      primeSynthesis();
      void pump();
    },
    close(): void {
      if (cancelled || closed) return;
      closed = true;
      // Closing an idle queue is the "nothing was ever enqueued" case, and it
      // still has to hand the turn back rather than leave the mic shut.
      maybeDrain();
    },
    cancel(): void {
      cancelled = true;
    },
    get size(): number {
      return items.length;
    },
    get cancelled(): boolean {
      return cancelled;
    },
  };
}
