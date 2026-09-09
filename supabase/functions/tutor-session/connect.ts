/**
 * `connect`: the SDP exchange, done by the server so the call is ours to end.
 *
 * Before this action the device posted its offer to OpenAI directly with an
 * ephemeral key `start` had handed it, and the resulting call id existed only
 * on the device. That made every refund a gamble — see _shared/tutor-calls.ts
 * for the exploit it allowed. Now the device sends the offer here, the key
 * never leaves the server, and the call id lands on the session row where
 * `end`, `turn` (third safety cut) and the reaper can hang the call up.
 *
 * Reconnects come through here too. The reducer on the device redials once
 * after a network drop; each dial is a new OpenAI call, so the previous one
 * is hung up first (best-effort — it is usually already dead) and the row
 * carries the newest id.
 */
import {
  createCall,
  dropEphemeralKey,
  hangupCall,
  takeEphemeralKey,
  type CreatedCall,
  type HangupOutcome,
} from '../_shared/tutor-calls.ts';

// deno-lint-ignore no-explicit-any
type Client = any;

export interface ConnectRequest {
  sessionId: string;
  sdp: string;
}

export interface ConnectResult {
  status: number;
  // deno-lint-ignore no-explicit-any
  body: Record<string, any>;
}

/** Injected so the exchange is testable without OpenAI or Redis. */
export interface ConnectDeps {
  takeKey: (sessionId: string) => Promise<string | null>;
  create: (clientSecret: string, model: string, offerSdp: string) => Promise<CreatedCall>;
  hangup: (apiKey: string, callId: string) => Promise<HangupOutcome>;
}

const realDeps: ConnectDeps = {
  takeKey: takeEphemeralKey,
  create: createCall,
  hangup: hangupCall,
};

export async function handleConnect(
  supabase: Client,
  userId: string,
  req: ConnectRequest,
  env: { openaiKey: string },
  deps: ConnectDeps = realDeps,
): Promise<ConnectResult> {
  const { data: session, error } = await supabase
    .from('tutor_sessions')
    .select('id, user_id, model, ended_at, call_id, connected_at')
    .eq('id', req.sessionId)
    .maybeSingle();

  if (error || !session || session.user_id !== userId) {
    return { status: 404, body: { error: 'Session not found.', code: 'SESSION_NOT_FOUND' } };
  }
  if (session.ended_at) {
    return { status: 410, body: { error: 'This session has ended.', code: 'SESSION_ENDED' } };
  }

  // The key is single-use in spirit: it is read, not deleted, until the call
  // is up, so a transport failure on the device can retry the dial within the
  // key's short life without a second `start` (and a second reservation).
  let clientSecret: string | null = null;
  try {
    clientSecret = await deps.takeKey(session.id);
  } catch (err) {
    console.error('[tutor-session] ephemeral key lookup failed:', err instanceof Error ? err.message : err);
  }
  if (!clientSecret) {
    // Expired or lost. The device should `end`; with no call ever created the
    // reservation is refunded in full.
    return { status: 410, body: { error: 'The session took too long to connect. Start again.', code: 'SESSION_EXPIRED' } };
  }

  // A redial replaces the previous call. Hang the old one up first so two
  // calls can never be live against one reservation.
  if (typeof session.call_id === 'string' && session.call_id) {
    const outcome = await deps.hangup(env.openaiKey, session.call_id);
    if (outcome !== 'ended') {
      console.error(`[tutor-session] could not hang up previous call ${session.call_id} before redial`);
    }
  }

  let created: CreatedCall;
  try {
    created = await deps.create(clientSecret, session.model, req.sdp);
  } catch (err) {
    console.error('[tutor-session] SDP exchange failed:', err instanceof Error ? err.message : err);
    return { status: 502, body: { error: 'The tutor is unavailable right now. Please try again.', code: 'TUTOR_UNAVAILABLE' } };
  }

  // Record BEFORE answering: a device that never receives the answer still
  // produced a call we must be able to end.
  const { error: recordErr } = await supabase
    .from('tutor_sessions')
    .update({
      call_id: created.callId,
      connected_at: session.connected_at ?? new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('id', session.id);
  if (recordErr) {
    // The call is up and we could not write its id: end it now rather than
    // leave a call nothing can reach. The device sees a 502 and retries.
    console.error('[tutor-session] could not record call id:', recordErr.message);
    if (created.callId) await deps.hangup(env.openaiKey, created.callId);
    return { status: 502, body: { error: 'The tutor is unavailable right now. Please try again.', code: 'TUTOR_UNAVAILABLE' } };
  }

  await dropEphemeralKey(session.id);

  return { status: 200, body: { sessionId: session.id, sdp: created.answerSdp } };
}
