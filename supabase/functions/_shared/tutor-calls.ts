/**
 * The server's handle on a live tutor call.
 *
 * WHY THIS EXISTS. The tutor's audio runs over WebRTC straight between the
 * learner's device and OpenAI, so nothing here is in the media path. Until
 * 2026-09-08 the device also did the SIGNALLING: `start` minted an ephemeral
 * key and handed it over, the device posted its SDP offer to OpenAI itself,
 * and the resulting call was known only to the device. That left the spend
 * ceiling with a hole no meter could close: a client could `end` a session
 * (refund all but a minute), and keep talking to the model for as long as
 * OpenAI would let it, because we had no way to hang up and no way to know the
 * call was still alive.
 *
 * OpenAI's calls API can end a call server-side — `POST
 * /v1/realtime/calls/{call_id}/hangup` "whether it was initiated over SIP or
 * WebRTC" — but only if we know the call id, and the call id is returned to
 * whoever posted the SDP. So the SDP now goes through us: the device sends its
 * offer to `tutor-session` (action `connect`), this module posts it to OpenAI
 * with the ephemeral key that never left the server, records the call id on
 * the session row, and returns the answer. Audio is still device-to-OpenAI.
 * What changed is that every open call is one we can close.
 *
 * The ephemeral key lives in Redis between `start` and `connect` — seconds,
 * with the key's own expiry as its TTL. Redis is the right store: this is
 * state we would rather lose than keep. Losing it turns into a failed connect
 * and a refunded session, never into a call we cannot end.
 */
import { PROVIDER_TIMEOUT_MS, providerFetch } from './provider-fetch.ts';
import { redisDel, redisGet, redisSetEx } from './redis.ts';

export const CALLS_URL = 'https://api.openai.com/v1/realtime/calls';

/** Longest the ephemeral key is kept waiting for a connect. OpenAI's own
 *  default expiry is ten minutes; ours is deliberately shorter. */
export const EPHEMERAL_KEY_TTL_SECONDS = 300;

/** An SDP offer is a few KB. Anything past this is not an offer. */
export const MAX_SDP_BYTES = 64 * 1024;

function ekKey(sessionId: string): string {
  return `tutor:ek:${sessionId}`;
}

/** Stash the ephemeral key for the session's connect. Throws if Redis is down —
 *  the caller must then treat the start as failed and refund. */
export async function stashEphemeralKey(
  sessionId: string,
  clientSecret: string,
  expiresAtUnixSeconds: number | null,
): Promise<void> {
  const untilExpiry = expiresAtUnixSeconds
    ? Math.floor(expiresAtUnixSeconds - Date.now() / 1000)
    : EPHEMERAL_KEY_TTL_SECONDS;
  const ttl = Math.max(30, Math.min(EPHEMERAL_KEY_TTL_SECONDS, untilExpiry));
  await redisSetEx(ekKey(sessionId), clientSecret, ttl);
}

/** The stashed key, or null when it expired, was used, or Redis lost it. */
export async function takeEphemeralKey(sessionId: string): Promise<string | null> {
  const key = await redisGet(ekKey(sessionId));
  return typeof key === 'string' && key.length > 0 ? key : null;
}

export async function dropEphemeralKey(sessionId: string): Promise<void> {
  try {
    await redisDel(ekKey(sessionId));
  } catch {
    // It expires on its own.
  }
}

export interface CreatedCall {
  answerSdp: string;
  /** Null when OpenAI did not return one. The session is then unhangable and
   *  settlement must treat it as fully spent — see end.ts. */
  callId: string | null;
}

/**
 * Post the device's offer to OpenAI and return the answer.
 *
 * The call id comes back in the `Location` header of the SDP response
 * (`/v1/realtime/calls/{call_id}`). Parsed defensively: a missing header is
 * reported as `callId: null` rather than thrown, because the call itself is
 * up and the learner is about to hear the tutor — the cost of a missing id is
 * borne by the settlement rules, not by the learner.
 */
export async function createCall(
  clientSecret: string,
  model: string,
  offerSdp: string,
): Promise<CreatedCall> {
  const response = await providerFetch(
    `${CALLS_URL}?model=${encodeURIComponent(model)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp',
      },
      body: offerSdp,
    },
    { provider: 'openai-realtime', timeoutMs: PROVIDER_TIMEOUT_MS.textShort },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`calls ${response.status}: ${detail.slice(0, 200)}`);
  }
  const answerSdp = await response.text();
  if (answerSdp.trim().length === 0) throw new Error('calls returned an empty answer');

  const location = response.headers.get('location') ?? '';
  const callId = parseCallId(location);
  if (!callId) {
    console.error('[tutor-calls] SDP answer carried no call id (Location header absent or unparseable)');
  }
  return { answerSdp, callId };
}

/** `/v1/realtime/calls/rtc_abc` → `rtc_abc`. Pure, exported for tests. */
export function parseCallId(location: string): string | null {
  const m = /\/realtime\/calls\/([A-Za-z0-9_-]+)\/?$/.exec(location.trim());
  return m ? m[1] : null;
}

export type HangupOutcome = 'ended' | 'failed';

/**
 * End a call server-side. `ended` on success OR on a 404 — a call OpenAI no
 * longer knows about is a call that is over, which is what the caller wants
 * to know. Anything else is `failed`, and a failed hangup means the money
 * must NOT be refunded: the call may still be running.
 */
export async function hangupCall(apiKey: string, callId: string): Promise<HangupOutcome> {
  try {
    const response = await providerFetch(
      `${CALLS_URL}/${encodeURIComponent(callId)}/hangup`,
      { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` } },
      { provider: 'openai-realtime', timeoutMs: PROVIDER_TIMEOUT_MS.textShort },
    );
    if (response.ok || response.status === 404) return 'ended';
    const detail = await response.text().catch(() => '');
    console.error(`[tutor-calls] hangup ${callId} failed: ${response.status} ${detail.slice(0, 200)}`);
    return 'failed';
  } catch (err) {
    console.error(`[tutor-calls] hangup ${callId} threw:`, err instanceof Error ? err.message : err);
    return 'failed';
  }
}

/**
 * Whether a settled session may have its unused reservation refunded.
 *
 * The rule, in one place: a refund is only safe when we KNOW the call is not
 * still running. Three cases:
 *   - never connected: no call exists, refund everything unused;
 *   - connected with a call id: refund only after `hangupCall` reports ended;
 *   - connected with no call id: we cannot end it, so it is treated as spent
 *     in full — the reservation IS the ceiling, and forfeiting it is the only
 *     way the ceiling stays one.
 */
export function refundAllowed(session: {
  connected_at: string | null;
  call_id: string | null;
}, hangup: HangupOutcome | null): boolean {
  if (!session.connected_at) return true;
  if (!session.call_id) return false;
  return hangup === 'ended';
}
