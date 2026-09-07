/**
 * Wire parsing for the OpenAI Realtime API data channel.
 *
 * On WebRTC the device holds a peer connection straight to OpenAI and JSON
 * events flow both ways over a data channel named `oai-events`. Audio never
 * touches this module — it rides the peer connection itself. What arrives here
 * is a firehose of small JSON objects, and this file turns them into a closed
 * union the session reducer can switch on.
 *
 * THE RULE THAT MATTERS MORE THAN ANY OTHER: an unrecognised `type` is
 * DROPPED, never thrown on.
 *
 * OpenAI ships new server event types continuously and without warning to us.
 * An exhaustive switch that throws — or a parser that treats "I don't know this
 * shape" as an error — takes live tutoring down on a random Tuesday, with no
 * release from our side to blame and nothing in the app store queue that could
 * fix it. So the union carries an explicit `unknown` variant, the caller logs
 * it, and the conversation continues. Same reasoning as `lib/sse.ts`: losing
 * one frame is survivable, losing the turn is not.
 *
 * NAMES CHANGED BETWEEN THE BETA AND GA SHAPES of this API — the tutor's own
 * transcript arrived as `response.audio_transcript.delta` under the beta header
 * and `response.output_audio_transcript.delta` under GA. Both are accepted.
 * Aliasing costs one map entry; guessing wrong costs the entire tutor voice.
 *
 * Pure: no I/O, no clock, no randomness, no `react-native-webrtc` import. That
 * is what lets the whole wire path be tested on a machine with no microphone,
 * before the native dependency is even installed.
 */

// ─── Server events ──────────────────────────────────────────────────────

/** One entry of a `rate_limits.updated` payload. */
export interface RealtimeRateLimit {
  readonly name: string;
  readonly limit: number | null;
  readonly remaining: number | null;
  readonly resetSeconds: number | null;
}

/**
 * Every server event this app acts on, plus the two escape hatches.
 *
 * `unknown` is an event we understood as an event but not as one of ours.
 * `malformed` is a payload that was not an event at all. They are kept apart
 * deliberately: a rising `unknown` rate means the API moved and we should go
 * read the changelog, while a rising `malformed` rate means the transport is
 * corrupting frames. Collapsing them into one bucket hides whichever is the
 * real problem.
 */
export type RealtimeServerEvent =
  | { readonly kind: 'session_created'; readonly sessionId: string | null; readonly model: string | null }
  | { readonly kind: 'session_updated'; readonly sessionId: string | null }
  /** The server's VAD heard the learner start talking. This is barge-in. */
  | { readonly kind: 'speech_started'; readonly itemId: string | null; readonly audioStartMs: number | null }
  | { readonly kind: 'speech_stopped'; readonly itemId: string | null; readonly audioEndMs: number | null }
  /** The LEARNER's words. */
  | { readonly kind: 'input_transcript_delta'; readonly itemId: string | null; readonly delta: string }
  | { readonly kind: 'input_transcript_done'; readonly itemId: string | null; readonly transcript: string }
  | { readonly kind: 'input_transcript_failed'; readonly itemId: string | null; readonly message: string }
  | { readonly kind: 'response_created'; readonly responseId: string | null }
  | {
      readonly kind: 'response_done';
      readonly responseId: string | null;
      readonly status: string | null;
      /** `status_details.error.message`, present when the response failed. */
      readonly errorMessage: string | null;
    }
  /** The TUTOR's words. */
  | {
      readonly kind: 'tutor_transcript_delta';
      readonly responseId: string | null;
      readonly itemId: string | null;
      readonly delta: string;
    }
  | {
      readonly kind: 'tutor_transcript_done';
      readonly responseId: string | null;
      readonly itemId: string | null;
      readonly transcript: string;
    }
  | { readonly kind: 'output_audio_started'; readonly responseId: string | null }
  | { readonly kind: 'output_audio_stopped'; readonly responseId: string | null }
  | { readonly kind: 'output_audio_cleared'; readonly responseId: string | null }
  | { readonly kind: 'rate_limits'; readonly limits: readonly RealtimeRateLimit[] }
  | {
      readonly kind: 'error';
      readonly code: string | null;
      readonly errorType: string | null;
      readonly message: string;
    }
  | { readonly kind: 'unknown'; readonly type: string }
  | { readonly kind: 'malformed'; readonly reason: 'json' | 'not_object' | 'no_type' };

// ─── Client events ──────────────────────────────────────────────────────

/**
 * The only two client events the session reducer ever asks for.
 *
 * Deliberately tiny. Everything else the host might send — session.update,
 * audio buffer plumbing — is transport concern, and prompt text is server
 * concern. Nothing in this union may ever carry an instruction: see
 * `controlItemEvent`.
 */
export type RealtimeClientEvent =
  | { readonly type: 'response.create' }
  | { readonly type: 'conversation.item.create'; readonly item: RealtimeControlItem };

export interface RealtimeControlItem {
  readonly type: 'message';
  /**
   * `system`, not `user`. A control cue is not something the learner said, and
   * putting it in their mouth would corrupt the transcript we grade them on.
   */
  readonly role: 'system';
  readonly content: readonly [{ readonly type: 'input_text'; readonly text: string }];
}

/**
 * Opaque control tokens.
 *
 * These are the ENTIRE mid-call control vocabulary, and they are meaningless
 * on their own: the session instructions minted server-side alongside the
 * ephemeral token are what define them. The client never sends prompt text,
 * because anything the client can send, a reader of the bundle can rewrite —
 * and a rewritten system prompt is a jailbroken tutor speaking to a student.
 */
export const MODE_CONTROL_LIVE = 'MODE:LIVE';
export const MODE_CONTROL_DEBRIEF = 'MODE:DEBRIEF';
/** "Start wrapping up." Never a hard cut — see the budget notes in the reducer. */
export const CLOSING_CUE = 'CUE:WRAP_UP';

export function controlItemEvent(token: string): RealtimeClientEvent {
  return {
    type: 'conversation.item.create',
    item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: token }] },
  };
}

export function responseCreateEvent(): RealtimeClientEvent {
  return { type: 'response.create' };
}

// ─── Field readers ──────────────────────────────────────────────────────
//
// Every field is read defensively. A server that starts sending `item_id: null`
// on one event out of a thousand must degrade that one event, not the session.

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Text fields default to '' — a missing delta is an empty delta, not a crash. */
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rateLimits(value: unknown): RealtimeRateLimit[] {
  if (!Array.isArray(value)) return [];
  const out: RealtimeRateLimit[] = [];
  for (const entry of value) {
    const row = asObject(entry);
    if (!row) continue;
    const name = str(row.name);
    if (name === null) continue;
    out.push({
      name,
      limit: num(row.limit),
      remaining: num(row.remaining),
      resetSeconds: num(row.reset_seconds),
    });
  }
  return out;
}

// ─── The type map ───────────────────────────────────────────────────────

/**
 * Wire type → decoder. A plain object rather than a switch so the alias pairs
 * sit next to each other and adding a newly-shipped event is one line.
 *
 * `output_audio_buffer.*` are WebRTC-only server events. I could not verify
 * from first principles that they are emitted on every path, so the reducer
 * treats them as an upgrade rather than a requirement — see
 * `TUTOR_SPEAKING_SOURCE` there. Parsing them here is free either way.
 */
const DECODERS: Record<string, (e: Json) => RealtimeServerEvent> = {
  'session.created': (e) => {
    const session = asObject(e.session);
    return {
      kind: 'session_created',
      sessionId: session ? str(session.id) : null,
      model: session ? str(session.model) : null,
    };
  },
  'session.updated': (e) => {
    const session = asObject(e.session);
    return { kind: 'session_updated', sessionId: session ? str(session.id) : null };
  },

  'input_audio_buffer.speech_started': (e) => ({
    kind: 'speech_started',
    itemId: str(e.item_id),
    audioStartMs: num(e.audio_start_ms),
  }),
  'input_audio_buffer.speech_stopped': (e) => ({
    kind: 'speech_stopped',
    itemId: str(e.item_id),
    audioEndMs: num(e.audio_end_ms),
  }),

  'conversation.item.input_audio_transcription.delta': (e) => ({
    kind: 'input_transcript_delta',
    itemId: str(e.item_id),
    delta: text(e.delta),
  }),
  'conversation.item.input_audio_transcription.completed': (e) => ({
    kind: 'input_transcript_done',
    itemId: str(e.item_id),
    transcript: text(e.transcript),
  }),
  'conversation.item.input_audio_transcription.failed': (e) => {
    const error = asObject(e.error);
    return {
      kind: 'input_transcript_failed',
      itemId: str(e.item_id),
      message: error ? text(error.message) : '',
    };
  },

  'response.created': (e) => {
    const response = asObject(e.response);
    return { kind: 'response_created', responseId: response ? str(response.id) : null };
  },
  'response.done': (e) => {
    const response = asObject(e.response);
    const details = response ? asObject(response.status_details) : null;
    const error = details ? asObject(details.error) : null;
    return {
      kind: 'response_done',
      responseId: response ? str(response.id) : null,
      status: response ? str(response.status) : null,
      errorMessage: error ? str(error.message) : null,
    };
  },

  // GA name and beta alias. Both, forever — an app binary outlives an API header.
  'response.output_audio_transcript.delta': (e) => ({
    kind: 'tutor_transcript_delta',
    responseId: str(e.response_id),
    itemId: str(e.item_id),
    delta: text(e.delta),
  }),
  'response.output_audio_transcript.done': (e) => ({
    kind: 'tutor_transcript_done',
    responseId: str(e.response_id),
    itemId: str(e.item_id),
    transcript: text(e.transcript),
  }),

  'output_audio_buffer.started': (e) => ({
    kind: 'output_audio_started',
    responseId: str(e.response_id),
  }),
  'output_audio_buffer.stopped': (e) => ({
    kind: 'output_audio_stopped',
    responseId: str(e.response_id),
  }),
  'output_audio_buffer.cleared': (e) => ({
    kind: 'output_audio_cleared',
    responseId: str(e.response_id),
  }),

  'rate_limits.updated': (e) => ({ kind: 'rate_limits', limits: rateLimits(e.rate_limits) }),

  error: (e) => {
    const error = asObject(e.error);
    return {
      kind: 'error',
      code: error ? str(error.code) : null,
      errorType: error ? str(error.type) : null,
      message: error ? text(error.message) : '',
    };
  },
};

DECODERS['response.audio_transcript.delta'] = DECODERS['response.output_audio_transcript.delta'];
DECODERS['response.audio_transcript.done'] = DECODERS['response.output_audio_transcript.done'];

/** Wire types we know about and deliberately do not act on. */
export function isKnownRealtimeType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(DECODERS, type);
}

/**
 * Decode one server event.
 *
 * Accepts either the already-parsed object or the raw data-channel string, so
 * the host does not have to own a try/catch around `JSON.parse` — the one place
 * a malformed frame could otherwise kill the channel.
 *
 * Total: never throws, for any input at all.
 */
export function parseRealtimeEvent(raw: unknown): RealtimeServerEvent {
  let value = raw;

  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return { kind: 'malformed', reason: 'json' };
    }
  }

  const event = asObject(value);
  if (!event) return { kind: 'malformed', reason: 'not_object' };

  const type = str(event.type);
  if (type === null) return { kind: 'malformed', reason: 'no_type' };

  const decode = DECODERS[type];
  if (!decode) return { kind: 'unknown', type };

  // A decoder reading an unexpected shape is still a dropped event, not a
  // crash. This should be unreachable given the readers above; it is here
  // because "should be unreachable" is not a runtime guarantee.
  try {
    return decode(event);
  } catch {
    return { kind: 'unknown', type };
  }
}
