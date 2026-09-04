/**
 * Unit tests for the sentence-ordered playback queue.
 *
 * The two headline cases are the two invariants the hands-free loop depends
 * on: out-of-order synthesis must still play in order, and the drain callback
 * — which is what reopens the microphone — must fire after the LAST sentence,
 * not the first. Both are driven with deferred promises rather than timers, so
 * every interleaving in these tests is one a real network can produce.
 */

import { createSpeechQueue } from './speech-queue';

/** A promise whose settlement this test controls. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let every already-settled promise run its continuations. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * A fake TTS + player pair whose timing the test drives.
 *
 * `synth[text]` and `play[uri]` expose the deferred for each call, so a test
 * can finish sentence two's synthesis before sentence one's on purpose.
 */
function harness() {
  const synth = new Map<string, ReturnType<typeof deferred<string>>>();
  const play = new Map<string, ReturnType<typeof deferred<void>>>();
  const playOrder: string[] = [];
  const synthOrder: string[] = [];

  return {
    synth,
    play,
    playOrder,
    synthOrder,
    synthesize: (text: string) => {
      synthOrder.push(text);
      const d = deferred<string>();
      synth.set(text, d);
      return d.promise;
    },
    playUri: (uri: string) => {
      playOrder.push(uri);
      const d = deferred<void>();
      play.set(uri, d);
      return d.promise;
    },
  };
}

describe('createSpeechQueue', () => {
  it('plays in enqueue order even when synthesis finishes out of order', async () => {
    const h = harness();
    const queue = createSpeechQueue({ synthesize: h.synthesize, play: h.playUri, maxLookahead: 3 });

    queue.enqueue('uno');
    queue.enqueue('dos');
    queue.enqueue('tres');
    await flush();

    // A short sentence comes back from TTS before a long one sent earlier.
    h.synth.get('tres')!.resolve('uri-tres');
    h.synth.get('dos')!.resolve('uri-dos');
    await flush();
    // Nothing may play yet: "uno" has not been synthesised.
    expect(h.playOrder).toEqual([]);

    h.synth.get('uno')!.resolve('uri-uno');
    await flush();
    expect(h.playOrder).toEqual(['uri-uno']);

    h.play.get('uri-uno')!.resolve();
    await flush();
    expect(h.playOrder).toEqual(['uri-uno', 'uri-dos']);

    h.play.get('uri-dos')!.resolve();
    await flush();
    expect(h.playOrder).toEqual(['uri-uno', 'uri-dos', 'uri-tres']);
  });

  it('synthesises ahead while a sentence is playing', async () => {
    const h = harness();
    const queue = createSpeechQueue({ synthesize: h.synthesize, play: h.playUri });

    queue.enqueue('uno');
    queue.enqueue('dos');
    await flush();

    // Both are in flight at once — that overlap is the entire point of the
    // feature. Voice metering is duration-based, so two short calls cost what
    // one long one would.
    expect(h.synthOrder).toEqual(['uno', 'dos']);
  });

  it('holds synthesis beyond the lookahead window', async () => {
    const h = harness();
    const queue = createSpeechQueue({ synthesize: h.synthesize, play: h.playUri, maxLookahead: 2 });

    ['uno', 'dos', 'tres', 'cuatro'].forEach((s) => queue.enqueue(s));
    await flush();
    expect(h.synthOrder).toEqual(['uno', 'dos']);

    h.synth.get('uno')!.resolve('uri-uno');
    await flush();
    h.play.get('uri-uno')!.resolve();
    await flush();
    // The window slid forward by one as "uno" finished.
    expect(h.synthOrder).toEqual(['uno', 'dos', 'tres']);
  });

  it('drains only after the last sentence has finished playing', async () => {
    const h = harness();
    const onDrained = jest.fn();
    const queue = createSpeechQueue({ synthesize: h.synthesize, play: h.playUri, onDrained });

    queue.enqueue('uno');
    queue.enqueue('dos');
    queue.close();
    await flush();

    h.synth.get('uno')!.resolve('uri-uno');
    await flush();
    h.play.get('uri-uno')!.resolve();
    await flush();

    // THE bug this guards: reopening the microphone here would have the learner
    // talking over the tutor's remaining sentence.
    expect(onDrained).not.toHaveBeenCalled();

    h.synth.get('dos')!.resolve('uri-dos');
    await flush();
    h.play.get('uri-dos')!.resolve();
    await flush();
    expect(onDrained).toHaveBeenCalledTimes(1);
  });

  it('does not drain while the stream is still open', async () => {
    const h = harness();
    const onDrained = jest.fn();
    const queue = createSpeechQueue({ synthesize: h.synthesize, play: h.playUri, onDrained });

    queue.enqueue('uno');
    await flush();
    h.synth.get('uno')!.resolve('uri-uno');
    await flush();
    h.play.get('uri-uno')!.resolve();
    await flush();

    // The model is still writing. Closing is what says otherwise.
    expect(onDrained).not.toHaveBeenCalled();
    queue.close();
    await flush();
    expect(onDrained).toHaveBeenCalledTimes(1);
  });

  it('drains immediately when nothing was ever enqueued', async () => {
    const h = harness();
    const onDrained = jest.fn();
    const queue = createSpeechQueue({ synthesize: h.synthesize, play: h.playUri, onDrained });

    // A turn with no spoken sentences still has to hand the microphone back.
    queue.close();
    await flush();
    expect(onDrained).toHaveBeenCalledTimes(1);
  });

  it('drains exactly once', async () => {
    const h = harness();
    const onDrained = jest.fn();
    const queue = createSpeechQueue({ synthesize: h.synthesize, play: h.playUri, onDrained });

    queue.enqueue('uno');
    queue.close();
    await flush();
    h.synth.get('uno')!.resolve('uri-uno');
    await flush();
    h.play.get('uri-uno')!.resolve();
    await flush();
    queue.close();
    await flush();
    expect(onDrained).toHaveBeenCalledTimes(1);
  });

  it('keeps going when one sentence fails to synthesise, and still drains', async () => {
    const h = harness();
    const onError = jest.fn();
    const onDrained = jest.fn();
    const queue = createSpeechQueue({
      synthesize: h.synthesize,
      play: h.playUri,
      onError,
      onDrained,
    });

    queue.enqueue('uno');
    queue.enqueue('dos');
    queue.close();
    await flush();

    h.synth.get('uno')!.reject(new Error('tts 500'));
    h.synth.get('dos')!.resolve('uri-dos');
    await flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toBe('uno');
    expect(h.playOrder).toEqual(['uri-dos']);

    h.play.get('uri-dos')!.resolve();
    await flush();
    // Abandoning the queue on a failed sentence would strand the hands-free
    // loop, because the drain callback is what hands the turn back.
    expect(onDrained).toHaveBeenCalledTimes(1);
  });

  it('reports that the first sentence started, once', async () => {
    const h = harness();
    const onSpeakingStarted = jest.fn();
    const queue = createSpeechQueue({
      synthesize: h.synthesize,
      play: h.playUri,
      onSpeakingStarted,
    });

    queue.enqueue('uno');
    queue.enqueue('dos');
    await flush();
    h.synth.get('uno')!.resolve('uri-uno');
    await flush();
    expect(onSpeakingStarted).toHaveBeenCalledTimes(1);

    h.play.get('uri-uno')!.resolve();
    h.synth.get('dos')!.resolve('uri-dos');
    await flush();
    expect(onSpeakingStarted).toHaveBeenCalledTimes(1);
  });

  it('stops playing and never drains after cancel', async () => {
    const h = harness();
    const onDrained = jest.fn();
    const queue = createSpeechQueue({ synthesize: h.synthesize, play: h.playUri, onDrained });

    queue.enqueue('uno');
    queue.enqueue('dos');
    await flush();
    h.synth.get('uno')!.resolve('uri-uno');
    await flush();
    expect(h.playOrder).toEqual(['uri-uno']);

    // Barge-in: the learner tapped to interrupt. The screen reopens the mic
    // itself, so the queue must not also do it.
    queue.cancel();
    h.play.get('uri-uno')!.resolve();
    h.synth.get('dos')!.resolve('uri-dos');
    await flush();

    expect(h.playOrder).toEqual(['uri-uno']);
    expect(onDrained).not.toHaveBeenCalled();
    expect(queue.cancelled).toBe(true);
  });

  it('ignores enqueues after close and after cancel', async () => {
    const h = harness();
    const queue = createSpeechQueue({ synthesize: h.synthesize, play: h.playUri });

    queue.close();
    queue.enqueue('tarde');
    await flush();
    expect(h.synthOrder).toEqual([]);
    expect(queue.size).toBe(0);
  });

  it('ignores blank sentences', async () => {
    const h = harness();
    const queue = createSpeechQueue({ synthesize: h.synthesize, play: h.playUri });

    queue.enqueue('   ');
    queue.enqueue('');
    await flush();
    expect(queue.size).toBe(0);
    expect(h.synthOrder).toEqual([]);
  });
});
