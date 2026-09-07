/**
 * The WebRTC transport for the live tutor call.
 *
 * THIS IS THE ONLY FILE IN THE APP THAT IMPORTS `react-native-webrtc`, and
 * keeping it that way is the point of the whole arrangement. Everything above
 * it — `realtime-events.ts`, `realtime-session.ts`, `tutor-transcript.ts`,
 * `tutor-budget.ts` — is pure and runs in jest on a laptop with no microphone.
 * The moment a second file imports the native module, that stops being true:
 * `react-native-webrtc/src/index.ts` THROWS at import time when
 * `NativeModules.WebRTCModule` is null, which is every jest run and every
 * Expo Go session. So the rule is structural, not stylistic.
 *
 * What is left here is genuinely untestable without a device — SDP, ICE, and
 * an audio route — so it is deliberately thin, has no opinions, and makes no
 * decisions. It converts native callbacks into a small closed union
 * (`TransportEvent`) and converts four method calls into peer-connection
 * operations. Every choice about what those events MEAN is the reducer's.
 *
 * ── THE CONNECT SEQUENCE, AND WHY IT LOOKS ODD ──
 *
 * OpenAI's realtime endpoint is not a signalling server. There is no socket to
 * trickle ICE candidates over: you POST one complete offer SDP and get one
 * complete answer SDP back as `text/plain`. React Native's RTCPeerConnection
 * cannot trickle to a plain HTTP endpoint either. So the offer must be FULLY
 * GATHERED before it is posted, which is the one step a browser tutorial will
 * not show you and the one that silently produces a connection that negotiates
 * and then carries no audio.
 *
 * Gathering is guarded by a timeout that PROCEEDS rather than fails. Host
 * candidates are available within a millisecond or two; what can hang is a
 * STUN/TURN reflexive lookup on a hostile network. An offer carrying only host
 * candidates usually still connects, and always beats a call that never
 * started — so the timeout is a floor on latency, not an error path.
 *
 * ── AUDIO-ONLY. THERE IS NO VIEW. ──
 *
 * `RTCView` is never imported and must never be. The remote audio track is
 * rendered by the native peer connection the instant it arrives; there is no
 * React component to mount, no ref to attach, and nothing to render. The
 * `remote_track` event exists so the host can say "the tutor's voice is
 * connected" in the UI, not so it can put the track somewhere.
 *
 * Routing that audio to the speaker rather than the earpiece is
 * `lib/call-audio-route.ts`'s decision and `lib/audio-session.ts`'s handoff.
 * This file never sets the device audio mode itself. `lib/audio-session.ts` is
 * the sole owner of that call and there is a grep gate enforcing it — which is
 * why the helper is not named here either. WebRTC configures the native
 * session on its own as part of acquiring the microphone; the host hook hands
 * it over first with `enterTutorCallSession()`.
 */

import * as WebRTC from 'react-native-webrtc';
import { parseRealtimeEvent, type RealtimeServerEvent } from './realtime-events';
import type { TutorCommand, TutorIceState } from './realtime-session';

// ─── Constants ──────────────────────────────────────────────────────────

/** OpenAI's SDP exchange endpoint. The model is a query parameter. */
export const DEFAULT_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';

/** The channel name OpenAI expects. Not configurable at the far end. */
const OAI_EVENTS_CHANNEL = 'oai-events';

/**
 * How long to wait for ICE gathering before posting what we have.
 *
 * Host candidates land in single-digit milliseconds, so in practice this never
 * fires. It exists for the network where a reflexive lookup hangs: see the
 * header — the timeout proceeds, it does not fail.
 */
export const ICE_GATHERING_TIMEOUT_MS = 3_000;

/**
 * Ceiling on the SDP POST itself. Independent of, and shorter than, the
 * reducer's `connectTimeoutMs`: the reducer's deadline covers the whole dial
 * including mic acquisition, and a `fetch` with no timeout on a captive-portal
 * network hangs until the OS gives up, which can be minutes.
 */
export const SDP_EXCHANGE_TIMEOUT_MS = 10_000;

// ─── The public surface ─────────────────────────────────────────────────

/** Where a failure happened. For logs and error copy; never a decision input. */
export type TransportStage = 'mic' | 'offer' | 'signal' | 'send' | 'channel';

/**
 * Everything the transport can tell the host.
 *
 * Closed and small on purpose. `mapTransportEvent` below turns each of these
 * into at most one `TutorCommand`, so the host never interprets a transport
 * event — it forwards one.
 */
export type TransportEvent =
  /** The `oai-events` data channel is open. Client events may now be sent. */
  | { readonly kind: 'open' }
  /** One inbound server event, already through `parseRealtimeEvent`. */
  | { readonly kind: 'server_event'; readonly event: RealtimeServerEvent }
  /** ICE connectivity moved. Only the four states the reducer models are emitted. */
  | { readonly kind: 'ice'; readonly state: TutorIceState }
  /** The tutor's audio track arrived and is already playing. See the header. */
  | { readonly kind: 'remote_track' }
  /** The data channel closed. This connection is finished. */
  | { readonly kind: 'closed' }
  /**
   * Something went wrong that did NOT end the connection — a dropped send, a
   * channel-level error the peer connection recovered from. Recorded, never
   * acted on: a dead connection is reported as `closed`, and a dial that never
   * came up is reported by `connect()` rejecting.
   */
  | { readonly kind: 'error'; readonly stage: TransportStage; readonly message: string };

export interface RealtimeConnectOptions {
  /** The ephemeral client secret minted server-side. Never a real API key. */
  clientSecret: string;
  model: string;
  callsUrl: string;
}

export interface RealtimeTransport {
  connect(opts: RealtimeConnectOptions): Promise<void>;
  /** Serialised and sent over the data channel. A no-op before it opens. */
  send(event: unknown): void;
  setMicEnabled(enabled: boolean): void;
  /**
   * Silence the TUTOR locally. The one thing `output_audio_buffer.clear`
   * cannot do — see the note on the implementation below.
   */
  setRemoteAudioEnabled(enabled: boolean): void;
  close(): Promise<void>;
  /** Subscribe. The returned function detaches that handler and only that one. */
  on(handler: (event: TransportEvent) => void): () => void;
}

/** A transport failure carrying enough to write honest error copy. */
export class TransportError extends Error {
  readonly stage: TransportStage;
  /** HTTP status from the SDP exchange, when that is what failed. */
  readonly status: number | null;

  constructor(stage: TransportStage, message: string, status: number | null = null) {
    super(message);
    this.name = 'TransportError';
    this.stage = stage;
    this.status = status;
  }
}

// ─── Pure boundary helpers (tested; no native module involved) ───────────

/**
 * The WebRTC-only client event that discards audio the server has already
 * queued for playback.
 *
 * Lives here rather than in `realtime-events.ts` because it is a TRANSPORT
 * concern, not a conversation one: it exists only on the WebRTC path (the
 * WebSocket path has no server-side output buffer to clear) and it carries no
 * content. The reducer names it in the comment on `clear_output_buffer`; this
 * is that mapping.
 */
export function outputAudioBufferClearEvent(): { type: string } {
  return { type: 'output_audio_buffer.clear' };
}

/**
 * Collapse the platform's seven ICE connection states onto the four the
 * reducer models, or `null` for the ones it deliberately ignores.
 *
 * `new` and `checking` are dropped rather than mapped: they are the normal
 * progress of a dial that is going fine, and reporting them as anything would
 * invite a host that reacts to them. `completed` means connected — it is
 * "connected, and gathering has finished", which is strictly better news.
 */
export function iceStateFrom(raw: string): TutorIceState | null {
  switch (raw) {
    case 'connected':
    case 'completed':
      return 'connected';
    case 'disconnected':
      return 'disconnected';
    case 'failed':
      return 'failed';
    case 'closed':
      return 'closed';
    default:
      return null;
  }
}

/**
 * One transport event to at most one reducer command.
 *
 * The whole reason this is a function and not a `switch` inside the hook: it
 * is the only interpretation step on the inbound path, and it is checkable
 * without a renderer. `remote_track` and `error` return `null` — the first is
 * UI-only news, the second is deliberately inert (see `TransportEvent`).
 */
export function mapTransportEvent(event: TransportEvent, now: number): TutorCommand | null {
  switch (event.kind) {
    case 'open':
      return { type: 'transport_open', now };
    case 'server_event':
      return { type: 'server_event', now, event: event.event };
    case 'ice':
      return { type: 'ice_state', now, state: event.state };
    case 'closed':
      return { type: 'data_channel_closed', now };
    case 'remote_track':
    case 'error':
      return null;
  }
}

// ─── The native module, adapted once ────────────────────────────────────
//
// `react-native-webrtc` types every `on*` handler through its bundled
// event-target-shim as `CallbackFunction<this, Event<string>>`, which erases
// the exact fields we read (`event.candidate`, `event.data`). Rather than
// scatter casts at every call site — or reach for `any`, which is banned in
// app code — the module is adapted ONCE, here, to the narrow structural
// interfaces below. Everything downstream of this line is fully typed.

interface NativeTrack {
  readonly kind: string;
  enabled: boolean;
  stop(): void;
}

interface NativeStream {
  getTracks(): NativeTrack[];
  getAudioTracks(): NativeTrack[];
}

interface NativeDataChannel {
  readonly readyState: string;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

interface NativePeerConnection {
  readonly iceGatheringState: string;
  readonly iceConnectionState: string;
  /**
   * Read AFTER gathering, never before. The gathered candidates are folded
   * into the local description once gathering completes — the object
   * `createOffer` handed back does not have them. Posting that object posts a
   * candidate-free offer, which negotiates cleanly and then carries silence.
   */
  readonly localDescription: { sdp: string } | null;
  createDataChannel(label: string): NativeDataChannel;
  createOffer(options?: Record<string, unknown>): Promise<{ sdp: string; type: string }>;
  setLocalDescription(description: { sdp: string; type: string }): Promise<void>;
  setRemoteDescription(description: { sdp: string; type: string }): Promise<void>;
  addTrack(track: NativeTrack, ...streams: NativeStream[]): unknown;
  close(): void;
  onicecandidate: ((event: { candidate: unknown } | null) => void) | null;
  onicegatheringstatechange: (() => void) | null;
  oniceconnectionstatechange: (() => void) | null;
  ontrack: ((event: NativeTrackEvent) => void) | null;
}

/**
 * The inbound track, narrowed to the two shapes the platforms actually hand
 * over. `react-native-webrtc` populates both `track` and `streams`; some
 * versions have delivered only one, so both are optional and both are read.
 * Reading neither leaves `setRemoteAudioEnabled` a no-op rather than a crash,
 * which is the right way round: an un-mutable tutor is a degraded safety cut,
 * a thrown exception inside a native callback is a dead app.
 */
interface NativeTrackEvent {
  readonly track?: NativeTrack;
  readonly streams?: readonly NativeStream[];
}

interface NativeWebRtc {
  RTCPeerConnection: new () => NativePeerConnection;
  mediaDevices: {
    getUserMedia(constraints: { audio: boolean }): Promise<NativeStream>;
  };
}

const rtc = WebRTC as unknown as NativeWebRtc;

// ─── Implementation ─────────────────────────────────────────────────────

export interface WebRtcTransportOptions {
  /** Overridable so the timeout path is testable without fake timers. */
  iceGatheringTimeoutMs?: number;
  sdpTimeoutMs?: number;
}

/** One dial's worth of native objects, so a reconnect cannot leak the old one. */
interface Connection {
  readonly generation: number;
  readonly pc: NativePeerConnection;
  readonly channel: NativeDataChannel;
  readonly stream: NativeStream;
  readonly abort: AbortController;
}

export function createWebRtcTransport(
  options: WebRtcTransportOptions = {},
): RealtimeTransport {
  const iceTimeoutMs = options.iceGatheringTimeoutMs ?? ICE_GATHERING_TIMEOUT_MS;
  const sdpTimeoutMs = options.sdpTimeoutMs ?? SDP_EXCHANGE_TIMEOUT_MS;

  const handlers = new Set<(event: TransportEvent) => void>();
  let connection: Connection | null = null;
  let generation = 0;
  let disposed = false;

  /**
   * The mic state the HOST last asked for, remembered across dials.
   *
   * Load-bearing on the reconnect path: the reducer emits `set_mic_enabled
   * false` BEFORE the `connect` effect, so at the moment that call arrives
   * there is no track to set it on. Latching means the new track comes up
   * muted, as asked, instead of hot-miking a learner mid-reconnect.
   */
  let micEnabled = true;

  /**
   * The tutor's own audio tracks, and whether they are currently audible.
   *
   * Latched the same way `micEnabled` is, and for a sharper reason: a safety
   * cut can land in the window between `connect()` resolving and the remote
   * track arriving, and a tutor that comes up audible after we decided to
   * silence it is the exact failure the cut exists to prevent.
   *
   * WHY THIS EXISTS AT ALL, given `output_audio_buffer.clear`: that event is
   * server-side. It discards audio OpenAI has queued but not yet sent, which
   * is most of a turn — the model generates far faster than realtime. What it
   * cannot touch is the audio already on the wire and in the jitter buffer,
   * a few hundred milliseconds that will play no matter what we send. For a
   * barge-in that tail is fine; the learner interrupted, they know why it
   * stopped. For a safety cut it is not: "the learner did not hear it" has to
   * be true of all of it. Hence a local mute, released once the tail has
   * drained.
   */
  let remoteTracks: NativeTrack[] = [];
  let remoteAudioEnabled = true;

  function emit(event: TransportEvent): void {
    // A handler that throws must not take out the ones after it, and must not
    // propagate back into a native callback — on iOS that crashes the app
    // rather than surfacing anywhere useful.
    for (const handler of [...handlers]) {
      try {
        handler(event);
      } catch (err) {
        console.warn('[realtime-transport] handler threw:', err);
      }
    }
  }

  /** Ignore anything arriving from a peer connection we have moved past. */
  function isCurrent(gen: number): boolean {
    return !disposed && connection !== null && connection.generation === gen;
  }

  function teardown(): void {
    const current = connection;
    connection = null;
    // Dropped unconditionally, before the early return: these are references
    // to the previous dial's remote tracks and holding them past its close
    // would have `setRemoteAudioEnabled` writing to a dead peer connection.
    // The ENABLED flag is deliberately NOT reset — see the latch above.
    remoteTracks = [];
    if (!current) return;

    current.abort.abort();

    // Detach first. A native close fires state-change callbacks synchronously,
    // and a `closed` event emitted during our own teardown would be reported
    // to the reducer as the network dropping.
    current.pc.onicecandidate = null;
    current.pc.onicegatheringstatechange = null;
    current.pc.oniceconnectionstatechange = null;
    current.pc.ontrack = null;
    current.channel.onopen = null;
    current.channel.onclose = null;
    current.channel.onerror = null;
    current.channel.onmessage = null;

    // Tracks before the peer connection. A track left live after `pc.close()`
    // holds the microphone — and the audio session is released right after
    // this returns, handing back a session the OS still thinks is recording.
    for (const track of current.stream.getTracks()) {
      try {
        track.stop();
      } catch (err) {
        console.warn('[realtime-transport] track stop failed:', err);
      }
    }
    try {
      current.channel.close();
    } catch {
      // Already closed by the far end. Nothing to do and nothing to report.
    }
    try {
      current.pc.close();
    } catch (err) {
      console.warn('[realtime-transport] peer connection close failed:', err);
    }
  }

  /**
   * Watch for the end of ICE gathering.
   *
   * MUST be called BEFORE `setLocalDescription`. Candidates start flowing the
   * instant the local description is set, and the null candidate that
   * terminates the stream can arrive before the `await` on that call resumes.
   * Attaching afterwards misses it and waits out the full timeout on every
   * single call — a three second pause before the tutor can say hello.
   *
   * Two completion signals are watched because platforms disagree about which
   * they emit: `iceGatheringState === 'complete'`, and the null candidate.
   * Waiting for only one of them is the same three second pause.
   *
   * `poll` exists for the third case: gathering that completes SYNCHRONOUSLY
   * inside `setLocalDescription`, firing no event at all because there was
   * nothing asynchronous to report.
   */
  function watchIceGathering(pc: NativePeerConnection): {
    done: Promise<void>;
    poll: () => void;
  } {
    let finish = (): void => undefined;
    const done = new Promise<void>((resolve) => {
      let settled = false;
      finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pc.onicegatheringstatechange = null;
        pc.onicecandidate = null;
        resolve();
      };

      const timer = setTimeout(finish, iceTimeoutMs);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') finish();
      };
      pc.onicecandidate = (event) => {
        if (event === null || event.candidate === null) finish();
      };
    });

    const poll = (): void => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    poll();
    return { done, poll };
  }

  /** POST the offer, get the answer SDP back as plain text. */
  async function exchangeSdp(
    offerSdp: string,
    opts: RealtimeConnectOptions,
    abort: AbortController,
  ): Promise<string> {
    const timer = setTimeout(() => abort.abort(), sdpTimeoutMs);
    try {
      const response = await fetch(`${opts.callsUrl}?model=${encodeURIComponent(opts.model)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offerSdp,
        signal: abort.signal,
      });

      if (!response.ok) {
        // Read the body for the log, but never surface it: an SDP-exchange
        // error body can echo the request, and the request carries the client
        // secret. Callers get the status and a fixed phrase.
        const detail = await response.text().catch(() => '');
        console.warn(`[realtime-transport] SDP exchange ${response.status}: ${detail.slice(0, 200)}`);
        throw new TransportError(
          'signal',
          `SDP exchange failed with status ${response.status}`,
          response.status,
        );
      }

      const answer = await response.text();
      if (answer.trim().length === 0) {
        throw new TransportError('signal', 'SDP exchange returned an empty answer', response.status);
      }
      return answer;
    } finally {
      clearTimeout(timer);
    }
  }

  async function connect(opts: RealtimeConnectOptions): Promise<void> {
    if (disposed) {
      throw new TransportError('signal', 'transport is closed');
    }
    // The reducer's `connect` effect is documented as "discard any existing
    // peer connection and dial". Redialling on top of a live one leaves two
    // microphone captures running.
    teardown();

    const gen = ++generation;
    let stream: NativeStream;
    try {
      // The audio session handoff (`enterTutorCallSession`) must ALREADY have
      // happened — see the ordering note in the host hook. WebRTC configures
      // the native session as part of this call, and expo-av holding a
      // competing configuration at this moment is what routes a whole call to
      // the earpiece.
      stream = await rtc.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      throw new TransportError('mic', err instanceof Error ? err.message : 'microphone unavailable');
    }

    const pc = new rtc.RTCPeerConnection();
    const abort = new AbortController();
    let channel: NativeDataChannel;

    try {
      for (const track of stream.getAudioTracks()) {
        track.enabled = micEnabled;
        pc.addTrack(track, stream);
      }

      // Created BEFORE the offer so the data channel is described by it. A
      // channel opened after `createOffer` needs a renegotiation this endpoint
      // will not do.
      channel = pc.createDataChannel(OAI_EVENTS_CHANNEL);

      const offer = await pc.createOffer();
      // Watchers first — see `watchIceGathering`. The window between
      // setLocalDescription resolving and a handler being attached is where
      // the terminating null candidate goes missing.
      const gathering = watchIceGathering(pc);
      await pc.setLocalDescription(offer);
      gathering.poll();
      await gathering.done;
    } catch (err) {
      for (const track of stream.getTracks()) track.stop();
      pc.close();
      throw err instanceof TransportError
        ? err
        : new TransportError('offer', err instanceof Error ? err.message : 'offer failed');
    }

    // Wire the handlers before the exchange: a `failed` ICE state during
    // negotiation is real news, and nothing is listening if we wait.
    pc.oniceconnectionstatechange = () => {
      if (!isCurrent(gen)) return;
      const state = iceStateFrom(pc.iceConnectionState);
      if (state !== null) emit({ kind: 'ice', state });
    };
    pc.ontrack = (event) => {
      if (!isCurrent(gen)) return;
      // Nothing to ATTACH — the native peer connection plays remote audio the
      // moment it arrives, and there is no `RTCView` on an audio-only call.
      // The track is still kept, because silencing it is the only local
      // control we have over what the learner hears.
      for (const track of remoteAudioTracksOf(event)) {
        track.enabled = remoteAudioEnabled;
        if (!remoteTracks.includes(track)) remoteTracks.push(track);
      }
      emit({ kind: 'remote_track' });
    };
    channel.onopen = () => {
      if (isCurrent(gen)) emit({ kind: 'open' });
    };
    channel.onclose = () => {
      if (isCurrent(gen)) emit({ kind: 'closed' });
    };
    channel.onerror = (event) => {
      if (!isCurrent(gen)) return;
      emit({ kind: 'error', stage: 'channel', message: describeChannelError(event) });
    };
    channel.onmessage = (event) => {
      if (!isCurrent(gen)) return;
      // `parseRealtimeEvent` is total — it accepts the raw string, owns the
      // `JSON.parse`, and never throws. That is why there is no try/catch
      // here: a malformed frame arrives as a `malformed` event and the call
      // carries on.
      emit({ kind: 'server_event', event: parseRealtimeEvent(event.data) });
    };

    connection = { generation: gen, pc, channel, stream, abort };

    try {
      const answer = await exchangeSdp(gatheredOfferSdp(pc), opts, abort);
      if (!isCurrent(gen)) return; // Closed while the POST was in flight.
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    } catch (err) {
      teardown();
      throw err instanceof TransportError
        ? err
        : new TransportError('signal', err instanceof Error ? err.message : 'signalling failed');
    }
  }

  function send(event: unknown): void {
    const current = connection;
    // Dropping is correct, and better than queueing. Every client event this
    // app sends is time-sensitive — a barge-in buffer clear, a wrap-up cue —
    // and replaying one after a reconnect would act on a conversation that no
    // longer exists.
    if (!current || current.channel.readyState !== 'open') {
      emit({ kind: 'error', stage: 'send', message: 'dropped: data channel not open' });
      return;
    }
    try {
      current.channel.send(JSON.stringify(event));
    } catch (err) {
      emit({
        kind: 'error',
        stage: 'send',
        message: err instanceof Error ? err.message : 'send failed',
      });
    }
  }

  function setMicEnabled(enabled: boolean): void {
    micEnabled = enabled;
    const current = connection;
    if (!current) return; // Latched; applied when the next track is acquired.
    for (const track of current.stream.getAudioTracks()) {
      track.enabled = enabled;
    }
  }

  function setRemoteAudioEnabled(enabled: boolean): void {
    remoteAudioEnabled = enabled;
    for (const track of remoteTracks) {
      // Per track rather than bailing on the first throw: a partially muted
      // tutor is still audible, which is the whole thing being prevented.
      try {
        track.enabled = enabled;
      } catch (err) {
        console.warn('[realtime-transport] remote track mute failed:', err);
      }
    }
  }

  async function close(): Promise<void> {
    // Idempotent by construction: `disposed` latches and `teardown` clears
    // `connection` before touching anything, so a second call finds nothing.
    disposed = true;
    teardown();
    handlers.clear();
    await Promise.resolve();
  }

  function on(handler: (event: TransportEvent) => void): () => void {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }

  return { connect, send, setMicEnabled, setRemoteAudioEnabled, close, on };
}

/** The offer SDP as the peer connection holds it once gathering has finished. */
function gatheredOfferSdp(pc: NativePeerConnection): string {
  const sdp = pc.localDescription?.sdp;
  if (typeof sdp !== 'string' || sdp.length === 0) {
    throw new TransportError('offer', 'local description was empty after gathering');
  }
  return sdp;
}

/**
 * The audio tracks on an inbound `track` event, from wherever this platform
 * put them.
 *
 * Filtered to `kind === 'audio'` even though the session negotiates audio
 * only: a video track appearing here would mean the SDP answer offered
 * something we did not ask for, and enabling or disabling it is not our
 * business either way.
 */
function remoteAudioTracksOf(event: NativeTrackEvent): NativeTrack[] {
  const found: NativeTrack[] = [];
  if (event?.track && event.track.kind === 'audio') found.push(event.track);
  for (const stream of event?.streams ?? []) {
    for (const track of stream.getAudioTracks()) {
      if (!found.includes(track)) found.push(track);
    }
  }
  return found;
}

function describeChannelError(event: unknown): string {
  if (event instanceof Error) return event.message;
  if (typeof event === 'object' && event !== null && 'message' in event) {
    const message = (event as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'data channel error';
}
