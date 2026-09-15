/**
 * Unit tests for the Realtime data-channel parser.
 *
 * The headline case is not any single event shape — it is that NOTHING gets
 * through this module as an exception. OpenAI adds server event types without
 * telling us, proxies truncate frames, and a session that dies on either is an
 * outage we cannot ship a fix for from inside an app binary. So most of what
 * follows is adversarial input, and the assertion is usually "it came back with
 * a kind and did not throw".
 */

import {
  CLOSING_CUE,
  MODE_CONTROL_DEBRIEF,
  MODE_CONTROL_LIVE,
  controlItemEvent,
  isKnownRealtimeType,
  parseRealtimeEvent,
  responseCreateEvent,
} from './realtime-events';

describe('unrecognised input', () => {
  it('drops an unknown event type instead of throwing', () => {
    const event = parseRealtimeEvent({ type: 'response.mcp_call.in_progress', foo: 1 });
    expect(event).toEqual({ kind: 'unknown', type: 'response.mcp_call.in_progress' });
  });

  it('reports malformed JSON as malformed, not unknown', () => {
    // The two are kept apart because they mean different things operationally:
    // unknown means the API moved, malformed means the transport is broken.
    expect(parseRealtimeEvent('{"type":"error"')).toEqual({ kind: 'malformed', reason: 'json' });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['an array', [{ type: 'error' }]],
    ['a bare string', '"hello"'],
  ])('reports %s as not an object', (_label, input) => {
    expect(parseRealtimeEvent(input)).toEqual({ kind: 'malformed', reason: 'not_object' });
  });

  it('reports a missing or non-string type', () => {
    expect(parseRealtimeEvent({})).toEqual({ kind: 'malformed', reason: 'no_type' });
    expect(parseRealtimeEvent({ type: 7 })).toEqual({ kind: 'malformed', reason: 'no_type' });
    expect(parseRealtimeEvent({ type: null })).toEqual({ kind: 'malformed', reason: 'no_type' });
  });

  it('never throws, whatever it is handed', () => {
    const corpus: unknown[] = [
      '',
      '[]',
      '{}',
      'null',
      { type: 'error', error: 'not-an-object' },
      { type: 'response.done', response: null },
      { type: 'response.done', response: { status_details: { error: 7 } } },
      { type: 'rate_limits.updated', rate_limits: 'nope' },
      { type: 'session.created', session: [] },
      { type: 'input_audio_buffer.speech_started', audio_start_ms: NaN },
      { type: 'conversation.item.input_audio_transcription.delta', delta: { nested: true } },
      new Date(),
      () => undefined,
    ];
    for (const input of corpus) {
      expect(() => parseRealtimeEvent(input)).not.toThrow();
      expect(typeof parseRealtimeEvent(input).kind).toBe('string');
    }
  });
});

describe('session lifecycle', () => {
  it('pulls the session id and model out of session.created', () => {
    expect(
      parseRealtimeEvent({
        type: 'session.created',
        event_id: 'evt_1',
        session: { id: 'sess_abc', model: 'gpt-realtime' },
      }),
    ).toEqual({ kind: 'session_created', sessionId: 'sess_abc', model: 'gpt-realtime' });
  });

  it('survives session.created with no session payload', () => {
    expect(parseRealtimeEvent({ type: 'session.created' })).toEqual({
      kind: 'session_created',
      sessionId: null,
      model: null,
    });
  });

  it('parses session.updated', () => {
    expect(parseRealtimeEvent({ type: 'session.updated', session: { id: 's1' } })).toEqual({
      kind: 'session_updated',
      sessionId: 's1',
    });
  });
});

describe('the learner speaking', () => {
  it('parses speech_started and speech_stopped', () => {
    expect(
      parseRealtimeEvent({
        type: 'input_audio_buffer.speech_started',
        item_id: 'item_1',
        audio_start_ms: 1200,
      }),
    ).toEqual({ kind: 'speech_started', itemId: 'item_1', audioStartMs: 1200 });

    expect(
      parseRealtimeEvent({
        type: 'input_audio_buffer.speech_stopped',
        item_id: 'item_1',
        audio_end_ms: 3400,
      }),
    ).toEqual({ kind: 'speech_stopped', itemId: 'item_1', audioEndMs: 3400 });
  });

  it('degrades one bad field rather than the whole event', () => {
    expect(
      parseRealtimeEvent({
        type: 'input_audio_buffer.speech_started',
        item_id: null,
        audio_start_ms: 'soon',
      }),
    ).toEqual({ kind: 'speech_started', itemId: null, audioStartMs: null });
  });

  it('parses the learner transcript delta and completion', () => {
    expect(
      parseRealtimeEvent({
        type: 'conversation.item.input_audio_transcription.delta',
        item_id: 'item_2',
        delta: 'me lla',
      }),
    ).toEqual({ kind: 'input_transcript_delta', itemId: 'item_2', delta: 'me lla' });

    expect(
      parseRealtimeEvent({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'item_2',
        transcript: 'me llamo Ana',
      }),
    ).toEqual({ kind: 'input_transcript_done', itemId: 'item_2', transcript: 'me llamo Ana' });
  });

  it('treats a missing delta as empty rather than a failure', () => {
    expect(parseRealtimeEvent({ type: 'conversation.item.input_audio_transcription.delta' })).toEqual(
      { kind: 'input_transcript_delta', itemId: null, delta: '' },
    );
  });

  it('parses a failed transcription', () => {
    expect(
      parseRealtimeEvent({
        type: 'conversation.item.input_audio_transcription.failed',
        item_id: 'item_3',
        error: { message: 'audio too short' },
      }),
    ).toEqual({ kind: 'input_transcript_failed', itemId: 'item_3', message: 'audio too short' });
  });
});

describe('the tutor speaking', () => {
  it('parses response.created and response.done', () => {
    expect(parseRealtimeEvent({ type: 'response.created', response: { id: 'resp_1' } })).toEqual({
      kind: 'response_created',
      responseId: 'resp_1',
    });

    expect(
      parseRealtimeEvent({
        type: 'response.done',
        response: { id: 'resp_1', status: 'completed' },
      }),
    ).toEqual({ kind: 'response_done', responseId: 'resp_1', status: 'completed', errorMessage: null });
  });

  it('surfaces the failure message out of status_details', () => {
    expect(
      parseRealtimeEvent({
        type: 'response.done',
        response: {
          id: 'resp_2',
          status: 'failed',
          status_details: { type: 'failed', error: { code: 'server_error', message: 'boom' } },
        },
      }),
    ).toEqual({ kind: 'response_done', responseId: 'resp_2', status: 'failed', errorMessage: 'boom' });
  });

  it('accepts the GA and the beta transcript names identically', () => {
    // An app binary outlives an API header. Aliasing costs one map entry;
    // guessing wrong costs the entire tutor voice for everyone on that build.
    const ga = parseRealtimeEvent({
      type: 'response.output_audio_transcript.delta',
      response_id: 'resp_3',
      item_id: 'item_4',
      delta: 'Hola',
    });
    const beta = parseRealtimeEvent({
      type: 'response.audio_transcript.delta',
      response_id: 'resp_3',
      item_id: 'item_4',
      delta: 'Hola',
    });
    expect(ga).toEqual(beta);
    expect(ga).toEqual({
      kind: 'tutor_transcript_delta',
      responseId: 'resp_3',
      itemId: 'item_4',
      delta: 'Hola',
    });

    expect(
      parseRealtimeEvent({
        type: 'response.audio_transcript.done',
        response_id: 'resp_3',
        item_id: 'item_4',
        transcript: 'Hola, ¿qué tal?',
      }),
    ).toEqual({
      kind: 'tutor_transcript_done',
      responseId: 'resp_3',
      itemId: 'item_4',
      transcript: 'Hola, ¿qué tal?',
    });
  });

  it('parses the WebRTC output audio buffer events', () => {
    expect(
      parseRealtimeEvent({ type: 'output_audio_buffer.started', response_id: 'resp_5' }),
    ).toEqual({ kind: 'output_audio_started', responseId: 'resp_5' });
    expect(
      parseRealtimeEvent({ type: 'output_audio_buffer.stopped', response_id: 'resp_5' }),
    ).toEqual({ kind: 'output_audio_stopped', responseId: 'resp_5' });
    expect(
      parseRealtimeEvent({ type: 'output_audio_buffer.cleared', response_id: 'resp_5' }),
    ).toEqual({ kind: 'output_audio_cleared', responseId: 'resp_5' });
  });
});

describe('errors and rate limits', () => {
  it('parses an error frame', () => {
    expect(
      parseRealtimeEvent({
        type: 'error',
        event_id: 'evt_9',
        error: { type: 'invalid_request_error', code: 'invalid_value', message: 'bad param' },
      }),
    ).toEqual({
      kind: 'error',
      code: 'invalid_value',
      errorType: 'invalid_request_error',
      message: 'bad param',
    });
  });

  it('parses an error frame with no error payload', () => {
    expect(parseRealtimeEvent({ type: 'error' })).toEqual({
      kind: 'error',
      code: null,
      errorType: null,
      message: '',
    });
  });

  it('parses rate limits and skips junk rows', () => {
    const event = parseRealtimeEvent({
      type: 'rate_limits.updated',
      rate_limits: [
        { name: 'requests', limit: 1000, remaining: 998, reset_seconds: 60 },
        { limit: 5 },
        'nonsense',
        { name: 'tokens', limit: null, remaining: null, reset_seconds: null },
      ],
    });
    expect(event).toEqual({
      kind: 'rate_limits',
      limits: [
        { name: 'requests', limit: 1000, remaining: 998, resetSeconds: 60 },
        { name: 'tokens', limit: null, remaining: null, resetSeconds: null },
      ],
    });
  });
});

describe('raw strings', () => {
  it('parses a data-channel string exactly as it parses the object', () => {
    const payload = { type: 'response.created', response: { id: 'resp_7' } };
    expect(parseRealtimeEvent(JSON.stringify(payload))).toEqual(parseRealtimeEvent(payload));
  });

  it('handles multibyte payloads', () => {
    const event = parseRealtimeEvent(
      JSON.stringify({
        type: 'response.output_audio_transcript.done',
        response_id: 'r',
        item_id: 'i',
        transcript: '¿Cómo estás? ¡Muy bien, señor!',
      }),
    );
    expect(event).toEqual({
      kind: 'tutor_transcript_done',
      responseId: 'r',
      itemId: 'i',
      transcript: '¿Cómo estás? ¡Muy bien, señor!',
    });
  });
});

describe('client events', () => {
  it('wraps a control token as an opaque system item', () => {
    // The token is meaningless without the server-side instructions. Nothing
    // resembling a prompt may ever appear in a client event.
    expect(controlItemEvent(MODE_CONTROL_LIVE)).toEqual({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{ type: 'input_text', text: 'MODE:LIVE' }],
      },
    });
  });

  it('keeps the control vocabulary short and opaque', () => {
    for (const token of [MODE_CONTROL_LIVE, MODE_CONTROL_DEBRIEF, CLOSING_CUE]) {
      expect(token).toMatch(/^[A-Z]+:[A-Z_]+$/);
      expect(token.length).toBeLessThan(24);
    }
  });

  it('builds a bare response.create', () => {
    expect(responseCreateEvent()).toEqual({ type: 'response.create' });
  });
});

describe('isKnownRealtimeType', () => {
  it('knows the events we act on and admits to the ones we do not', () => {
    expect(isKnownRealtimeType('response.done')).toBe(true);
    expect(isKnownRealtimeType('response.audio_transcript.delta')).toBe(true);
    expect(isKnownRealtimeType('conversation.item.created')).toBe(false);
    expect(isKnownRealtimeType('toString')).toBe(false);
  });
});
