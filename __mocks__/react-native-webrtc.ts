/**
 * Jest stand-in for `react-native-webrtc`.
 *
 * WHY THIS FILE HAS TO EXIST: `react-native-webrtc/src/index.ts` THROWS at
 * import time when `NativeModules.WebRTCModule` is null, and it is null in
 * every jest run — there is no native module in a node process. Without this
 * mock, importing `lib/realtime-transport.ts` from a test fails before a
 * single assertion runs, which would leave the transport as the one part of
 * the tutor call with no coverage at all.
 *
 * It is deliberately a FAKE and not a simulator. It records the order of the
 * calls the transport makes, lets a test drive the callbacks that a real peer
 * connection would fire, and can be told to fail or to hang. It knows nothing
 * about SDP, ICE or audio — those are the parts that genuinely need a device,
 * and pretending otherwise here would produce tests that pass while the
 * feature is broken.
 *
 * Wired in via `moduleNameMapper` in jest.config.js rather than jest's
 * automatic `__mocks__` resolution, because automatic mocking of a node_module
 * only applies once a test calls `jest.mock()` for it — and the import that
 * throws happens before any test body runs.
 */

// ─── Test control surface ───────────────────────────────────────────────

export type GatheringBehaviour =
  /** `iceGatheringState` is already `complete` when the transport looks. */
  | 'immediate'
  /** Completes on a microtask after `setLocalDescription`, via the state event. */
  | 'microtask'
  /** Completes via a null `icecandidate` and never touches the state. */
  | 'null-candidate'
  /** Never completes. Exercises the transport's gathering timeout. */
  | 'never';

interface MockControl {
  /** Every interesting call, in order. The connect-sequence assertion reads this. */
  calls: string[];
  peerConnections: RTCPeerConnection[];
  streams: MockStream[];
  /** When set, `getUserMedia` rejects with it. */
  getUserMediaError: Error | null;
  gathering: GatheringBehaviour;
}

export const __webrtcMock: MockControl = {
  calls: [],
  peerConnections: [],
  streams: [],
  getUserMediaError: null,
  gathering: 'immediate',
};

export function __resetWebRtcMock(): void {
  __webrtcMock.calls = [];
  __webrtcMock.peerConnections = [];
  __webrtcMock.streams = [];
  __webrtcMock.getUserMediaError = null;
  __webrtcMock.gathering = 'immediate';
}

function log(entry: string): void {
  __webrtcMock.calls.push(entry);
}

/** The most recently constructed peer connection, for driving callbacks. */
export function __lastPeerConnection(): RTCPeerConnection {
  const pc = __webrtcMock.peerConnections[__webrtcMock.peerConnections.length - 1];
  if (!pc) throw new Error('no peer connection has been constructed');
  return pc;
}

// ─── Media ──────────────────────────────────────────────────────────────

export class MockTrack {
  readonly kind = 'audio';
  enabled = true;
  stopped = false;

  stop(): void {
    this.stopped = true;
    log('track.stop');
  }
}

export class MockStream {
  readonly tracks: MockTrack[] = [new MockTrack()];

  getTracks(): MockTrack[] {
    return this.tracks;
  }

  getAudioTracks(): MockTrack[] {
    return this.tracks;
  }
}

export const mediaDevices = {
  async getUserMedia(constraints: { audio: boolean }): Promise<MockStream> {
    log(`getUserMedia:${constraints.audio ? 'audio' : 'none'}`);
    if (__webrtcMock.getUserMediaError) throw __webrtcMock.getUserMediaError;
    const stream = new MockStream();
    __webrtcMock.streams.push(stream);
    return stream;
  },
};

// ─── Data channel ───────────────────────────────────────────────────────

export class MockDataChannel {
  readyState = 'connecting';
  readonly sent: string[] = [];
  closed = false;

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;

  constructor(readonly label: string) {}

  send(data: string): void {
    this.sent.push(data);
    log('channel.send');
  }

  close(): void {
    this.closed = true;
    this.readyState = 'closed';
    log('channel.close');
  }

  // ── Driven by tests ──

  __open(): void {
    this.readyState = 'open';
    this.onopen?.();
  }

  __message(data: unknown): void {
    this.onmessage?.({ data });
  }

  __remoteClose(): void {
    this.readyState = 'closed';
    this.onclose?.();
  }

  __error(event: unknown): void {
    this.onerror?.(event);
  }
}

// ─── Peer connection ────────────────────────────────────────────────────

export class RTCPeerConnection {
  iceGatheringState = 'new';
  iceConnectionState = 'new';
  localDescription: { sdp: string } | null = null;
  closed = false;

  readonly channels: MockDataChannel[] = [];
  readonly addedTracks: MockTrack[] = [];

  onicecandidate: ((event: { candidate: unknown } | null) => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: unknown) => void) | null = null;

  constructor() {
    log('new RTCPeerConnection');
    if (__webrtcMock.gathering === 'immediate') this.iceGatheringState = 'complete';
    __webrtcMock.peerConnections.push(this);
  }

  createDataChannel(label: string): MockDataChannel {
    log(`createDataChannel:${label}`);
    const channel = new MockDataChannel(label);
    this.channels.push(channel);
    return channel;
  }

  async createOffer(): Promise<{ sdp: string; type: string }> {
    log('createOffer');
    return { sdp: 'v=0\r\no=- offer\r\n', type: 'offer' };
  }

  async setLocalDescription(description: { sdp: string; type: string }): Promise<void> {
    log('setLocalDescription');
    // A real peer connection folds gathered candidates into the local
    // description as they arrive, so the SDP read back is not the SDP handed
    // to us. The suffix makes that difference visible to an assertion.
    this.localDescription = { sdp: `${description.sdp}a=candidate:host\r\n` };

    if (__webrtcMock.gathering === 'microtask') {
      void Promise.resolve().then(() => {
        this.iceGatheringState = 'complete';
        this.onicegatheringstatechange?.();
      });
    }
    if (__webrtcMock.gathering === 'null-candidate') {
      void Promise.resolve().then(() => this.onicecandidate?.({ candidate: null }));
    }
    if (__webrtcMock.gathering === 'never') {
      this.iceGatheringState = 'gathering';
    }
  }

  async setRemoteDescription(description: { sdp: string; type: string }): Promise<void> {
    log(`setRemoteDescription:${description.type}`);
  }

  addTrack(track: MockTrack): unknown {
    log('addTrack');
    this.addedTracks.push(track);
    return {};
  }

  close(): void {
    this.closed = true;
    log('pc.close');
  }

  // ── Driven by tests ──

  __iceState(state: string): void {
    this.iceConnectionState = state;
    this.oniceconnectionstatechange?.();
  }

  __remoteTrack(): void {
    this.ontrack?.({});
  }

  /** The channel the transport asked for, or a failure if it never did. */
  __channel(): MockDataChannel {
    const channel = this.channels[this.channels.length - 1];
    if (!channel) throw new Error('no data channel was created');
    return channel;
  }
}

/**
 * Present so an accidental import of the view path fails loudly rather than
 * silently rendering nothing. A tutor call is audio-only: there is no RTCView.
 */
export function RTCView(): never {
  throw new Error('RTCView must never be used — the tutor call is audio-only');
}
