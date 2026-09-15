/**
 * Unit tests for the WebRTC transport.
 *
 * WHAT THESE CAN AND CANNOT PROVE. There is no microphone, no network and no
 * native peer connection in jest, so nothing here says the tutor's voice comes
 * out of the speaker. What it does say is that the connect sequence happens in
 * the order OpenAI's endpoint requires — which is the part that is easy to get
 * wrong, impossible to spot by reading, and produces a call that negotiates
 * successfully and then carries silence.
 *
 * The four failure modes below are all ones that present as a hang on a
 * device: gathering that never completes, an SDP POST that 4xxs, a send before
 * the channel is open, and a double teardown. A hang during a live lesson is
 * indistinguishable from "the app is broken" to a learner, so each of them is
 * pinned here rather than discovered in TestFlight.
 */

import {
  __lastPeerConnection,
  __resetWebRtcMock,
  __webrtcMock,
} from '../__mocks__/react-native-webrtc';
import {
  TransportError,
  createWebRtcTransport,
  iceStateFrom,
  mapTransportEvent,
  outputAudioBufferClearEvent,
  type TransportEvent,
} from './realtime-transport';

const ANSWER_SDP = 'v=0\r\no=- answer\r\n';

/** The signaller the tests hand the transport: records offers, answers from
 *  `signalResponse`. Stands in for the server-side SDP exchange. */
let signalCalls: string[] = [];
let signalResponse: { ok: true; answer: string } | { ok: false; status?: number };
const CONNECT = {
  model: 'gpt-realtime',
  signal: async (offerSdp: string) => {
    signalCalls.push(offerSdp);
    if (!signalResponse.ok) {
      const err = new Error('signal failed') as Error & { status?: number };
      err.status = signalResponse.status;
      throw err;
    }
    return signalResponse.answer;
  },
};


beforeEach(() => {
  __resetWebRtcMock();
  signalCalls = [];
  signalResponse = { ok: true, answer: ANSWER_SDP };
});

afterEach(() => {
});

function collect(transport: ReturnType<typeof createWebRtcTransport>): TransportEvent[] {
  const events: TransportEvent[] = [];
  transport.on((e) => events.push(e));
  return events;
}

// ─── Pure boundary helpers ──────────────────────────────────────────────

describe('iceStateFrom', () => {
  it('collapses completed onto connected', () => {
    expect(iceStateFrom('connected')).toBe('connected');
    expect(iceStateFrom('completed')).toBe('connected');
  });

  it('passes through the three failure-shaped states', () => {
    expect(iceStateFrom('disconnected')).toBe('disconnected');
    expect(iceStateFrom('failed')).toBe('failed');
    expect(iceStateFrom('closed')).toBe('closed');
  });

  it('drops the states that only mean a dial is in progress', () => {
    expect(iceStateFrom('new')).toBeNull();
    expect(iceStateFrom('checking')).toBeNull();
    expect(iceStateFrom('nonsense')).toBeNull();
  });
});

describe('mapTransportEvent', () => {
  const now = 1_700_000;

  it('maps the four events the reducer acts on', () => {
    expect(mapTransportEvent({ kind: 'open' }, now)).toEqual({ type: 'transport_open', now });
    expect(mapTransportEvent({ kind: 'closed' }, now)).toEqual({
      type: 'data_channel_closed',
      now,
    });
    expect(mapTransportEvent({ kind: 'ice', state: 'failed' }, now)).toEqual({
      type: 'ice_state',
      now,
      state: 'failed',
    });
    const event = { kind: 'session_updated', sessionId: 'sess_1' } as const;
    expect(mapTransportEvent({ kind: 'server_event', event }, now)).toEqual({
      type: 'server_event',
      now,
      event,
    });
  });

  it('returns null for the two that are UI news only', () => {
    expect(mapTransportEvent({ kind: 'remote_track' }, now)).toBeNull();
    expect(
      mapTransportEvent({ kind: 'error', stage: 'send', message: 'dropped' }, now),
    ).toBeNull();
  });
});

it('names the WebRTC-only buffer clear event', () => {
  expect(outputAudioBufferClearEvent()).toEqual({ type: 'output_audio_buffer.clear' });
});

// ─── The connect sequence ───────────────────────────────────────────────

describe('connect', () => {
  it('performs the steps in the order the endpoint requires', async () => {
    const transport = createWebRtcTransport();
    await transport.connect(CONNECT);

    // The mic BEFORE the peer connection, the data channel BEFORE the offer,
    // and the remote description LAST. Every one of these is load-bearing: a
    // channel created after createOffer needs a renegotiation this endpoint
    // will not do, and an offer built before addTrack has no audio in it.
    expect(__webrtcMock.calls).toEqual([
      'getUserMedia:audio',
      'new RTCPeerConnection',
      'addTrack',
      'createDataChannel:oai-events',
      'createOffer',
      'setLocalDescription',
      'setRemoteDescription:answer',
    ]);
  });

  it('posts the GATHERED local description, not the offer it was handed', async () => {
    const transport = createWebRtcTransport();
    await transport.connect(CONNECT);

    expect(signalCalls).toHaveLength(1);
    // The mock appends a candidate line during setLocalDescription, exactly as
    // a real peer connection folds gathered candidates in. Handing over the
    // object returned by createOffer would miss it — and would produce a call
    // that negotiates and then carries no audio.
    expect(signalCalls[0]).toContain('a=candidate:host');
  });

  it('never dials OpenAI itself: the offer goes to the signaller and nowhere else', async () => {
    // The device holds no OpenAI credential. The server does the exchange and
    // keeps the call id, which is what lets it hang the call up.
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() => {
      throw new Error('the transport must not call fetch');
    });
    try {
      const transport = createWebRtcTransport();
      await transport.connect(CONNECT);
      expect(signalCalls).toHaveLength(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('waits for gathering signalled by the state change', async () => {
    __webrtcMock.gathering = 'microtask';
    const transport = createWebRtcTransport();
    await transport.connect(CONNECT);
    expect(signalCalls).toHaveLength(1);
  });

  it('waits for gathering signalled by a null candidate instead', async () => {
    // Some platforms terminate the candidate stream without ever moving
    // iceGatheringState. Watching only one signal hangs for the full timeout
    // on every single call.
    __webrtcMock.gathering = 'null-candidate';
    const transport = createWebRtcTransport();
    await transport.connect(CONNECT);
    expect(signalCalls).toHaveLength(1);
  });

  it('posts anyway when gathering never completes', async () => {
    __webrtcMock.gathering = 'never';
    const transport = createWebRtcTransport({ iceGatheringTimeoutMs: 5 });

    await transport.connect(CONNECT);

    // Proceeding, not failing. An offer carrying only host candidates usually
    // still connects; a call that never started never does.
    expect(signalCalls).toHaveLength(1);
    expect(__webrtcMock.calls).toContain('setRemoteDescription:answer');
  });

  it('surfaces a non-2xx SDP exchange as an error rather than hanging', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    signalResponse = { ok: false, status: 401 };
    const transport = createWebRtcTransport();

    await expect(transport.connect(CONNECT)).rejects.toThrow(TransportError);
    // And it tears the half-built connection down rather than leaving the
    // microphone open behind a failed dial.
    expect(__webrtcMock.streams[0].getTracks()[0].stopped).toBe(true);
    expect(__lastPeerConnection().closed).toBe(true);
    warn.mockRestore();
  });

  it('carries the HTTP status on the error and never the response body', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    signalResponse = { ok: false, status: 429 };
    const transport = createWebRtcTransport();

    await expect(transport.connect(CONNECT)).rejects.toMatchObject({
      stage: 'signal',
      status: 429,
    });
    // The signaller's own message can carry the server's error body. It goes
    // to the log, never into a thrown message a screen renders.
    await expect(transport.connect(CONNECT)).rejects.not.toThrow(/signal failed/);
    warn.mockRestore();
  });

  it('rejects with stage "mic" when permission is refused', async () => {
    __webrtcMock.getUserMediaError = new Error('Permission denied');
    const transport = createWebRtcTransport();

    await expect(transport.connect(CONNECT)).rejects.toMatchObject({ stage: 'mic' });
    // No peer connection was built, so there is nothing holding the route.
    expect(__webrtcMock.peerConnections).toHaveLength(0);
  });

  it('discards a live connection before redialling', async () => {
    const transport = createWebRtcTransport();
    await transport.connect(CONNECT);
    const first = __lastPeerConnection();

    await transport.connect(CONNECT);

    expect(first.closed).toBe(true);
    expect(__webrtcMock.streams[0].getTracks()[0].stopped).toBe(true);
    expect(__webrtcMock.peerConnections).toHaveLength(2);
  });
});

// ─── Inbound events ─────────────────────────────────────────────────────

describe('inbound events', () => {
  it('reports the data channel opening and closing', async () => {
    const transport = createWebRtcTransport();
    const events = collect(transport);
    await transport.connect(CONNECT);

    __lastPeerConnection().__channel().__open();
    expect(events).toContainEqual({ kind: 'open' });

    __lastPeerConnection().__channel().__remoteClose();
    expect(events).toContainEqual({ kind: 'closed' });
  });

  it('parses inbound frames before handing them on', async () => {
    const transport = createWebRtcTransport();
    const events = collect(transport);
    await transport.connect(CONNECT);

    __lastPeerConnection()
      .__channel()
      .__message(JSON.stringify({ type: 'session.created', session: { id: 'sess_9', model: 'm' } }));

    expect(events).toContainEqual({
      kind: 'server_event',
      event: { kind: 'session_created', sessionId: 'sess_9', model: 'm' },
    });
  });

  it('survives a malformed frame rather than taking the channel down', async () => {
    const transport = createWebRtcTransport();
    const events = collect(transport);
    await transport.connect(CONNECT);

    expect(() => __lastPeerConnection().__channel().__message('{not json')).not.toThrow();
    expect(events).toContainEqual({
      kind: 'server_event',
      event: { kind: 'malformed', reason: 'json' },
    });
  });

  it('emits only the ICE states the reducer models', async () => {
    const transport = createWebRtcTransport();
    const events = collect(transport);
    await transport.connect(CONNECT);

    const pc = __lastPeerConnection();
    pc.__iceState('checking');
    pc.__iceState('connected');
    pc.__iceState('failed');

    expect(events.filter((e) => e.kind === 'ice')).toEqual([
      { kind: 'ice', state: 'connected' },
      { kind: 'ice', state: 'failed' },
    ]);
  });

  it('reports the remote audio track arriving', async () => {
    const transport = createWebRtcTransport();
    const events = collect(transport);
    await transport.connect(CONNECT);

    __lastPeerConnection().__remoteTrack();
    expect(events).toContainEqual({ kind: 'remote_track' });
  });

  it('stops reporting events from a peer connection that was replaced', async () => {
    const transport = createWebRtcTransport();
    await transport.connect(CONNECT);
    const stale = __lastPeerConnection();
    const staleChannel = stale.__channel();

    await transport.connect(CONNECT);
    const events = collect(transport);
    staleChannel.__remoteClose();
    stale.__iceState('failed');

    // A dead connection's death throes must not be read as the live one
    // dropping — that is a reconnect the learner did not need, costing a
    // token and the whole conversation.
    expect(events).toEqual([]);
  });
});

// ─── send / mic / close / on ────────────────────────────────────────────

describe('send', () => {
  it('does not throw before the channel opens, and reports the drop', async () => {
    const transport = createWebRtcTransport();
    const events = collect(transport);
    await transport.connect(CONNECT);

    expect(() => transport.send({ type: 'response.create' })).not.toThrow();
    expect(events).toContainEqual({
      kind: 'error',
      stage: 'send',
      message: 'dropped: data channel not open',
    });
    expect(__lastPeerConnection().__channel().sent).toEqual([]);
  });

  it('does not throw before connect has run at all', () => {
    const transport = createWebRtcTransport();
    expect(() => transport.send({ type: 'response.create' })).not.toThrow();
  });

  it('serialises to the channel once it is open', async () => {
    const transport = createWebRtcTransport();
    await transport.connect(CONNECT);
    __lastPeerConnection().__channel().__open();

    transport.send(outputAudioBufferClearEvent());

    expect(__lastPeerConnection().__channel().sent).toEqual([
      '{"type":"output_audio_buffer.clear"}',
    ]);
  });
});

describe('setMicEnabled', () => {
  it('applies to the live track', async () => {
    const transport = createWebRtcTransport();
    await transport.connect(CONNECT);

    transport.setMicEnabled(false);
    expect(__webrtcMock.streams[0].getTracks()[0].enabled).toBe(false);
  });

  it('latches a request made before there is a track to apply it to', async () => {
    // The reducer's reconnect path emits set_mic_enabled(false) BEFORE the
    // connect effect. Without latching, the redialled track comes up hot.
    const transport = createWebRtcTransport();
    transport.setMicEnabled(false);

    await transport.connect(CONNECT);

    expect(__webrtcMock.streams[0].getTracks()[0].enabled).toBe(false);
  });
});

describe('close', () => {
  it('stops the tracks before closing the peer connection', async () => {
    const transport = createWebRtcTransport();
    await transport.connect(CONNECT);

    await transport.close();

    // Ordering matters: a track left live after pc.close() still holds the
    // microphone, and the audio session is released immediately afterwards.
    const stopIndex = __webrtcMock.calls.indexOf('track.stop');
    const closeIndex = __webrtcMock.calls.indexOf('pc.close');
    expect(stopIndex).toBeGreaterThan(-1);
    expect(stopIndex).toBeLessThan(closeIndex);
  });

  it('is idempotent', async () => {
    const transport = createWebRtcTransport();
    await transport.connect(CONNECT);

    await transport.close();
    const after = [...__webrtcMock.calls];
    await expect(transport.close()).resolves.toBeUndefined();

    expect(__webrtcMock.calls).toEqual(after);
  });

  it('is safe before anything was connected', async () => {
    const transport = createWebRtcTransport();
    await expect(transport.close()).resolves.toBeUndefined();
  });

  it('emits nothing during its own teardown', async () => {
    const transport = createWebRtcTransport();
    const events = collect(transport);
    await transport.connect(CONNECT);
    events.length = 0;

    await transport.close();

    // A native close fires state-change callbacks synchronously. Reporting
    // those as `closed` would tell the reducer the network dropped during a
    // teardown it asked for.
    expect(events).toEqual([]);
  });

  it('refuses to redial after being closed', async () => {
    const transport = createWebRtcTransport();
    await transport.close();
    await expect(transport.connect(CONNECT)).rejects.toThrow(TransportError);
  });
});

describe('on', () => {
  it('detaches the handler the returned function belongs to, and only that one', async () => {
    const transport = createWebRtcTransport();
    const kept: TransportEvent[] = [];
    const dropped: TransportEvent[] = [];

    transport.on((e) => kept.push(e));
    const unsubscribe = transport.on((e) => dropped.push(e));
    unsubscribe();

    await transport.connect(CONNECT);
    __lastPeerConnection().__channel().__open();

    expect(kept).toContainEqual({ kind: 'open' });
    expect(dropped).toEqual([]);
  });

  it('keeps delivering to the rest when one handler throws', async () => {
    const transport = createWebRtcTransport();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const seen: TransportEvent[] = [];

    transport.on(() => {
      throw new Error('screen blew up');
    });
    transport.on((e) => seen.push(e));

    await transport.connect(CONNECT);
    __lastPeerConnection().__channel().__open();

    expect(seen).toContainEqual({ kind: 'open' });
    warn.mockRestore();
  });
});
