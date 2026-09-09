/**
 * The live voice tutor's control plane.
 *
 * Three actions on one endpoint, dispatched on `body.action`:
 *
 *   start    reserve the budget and mint an ephemeral OpenAI credential (kept here)
 *   connect  the SDP exchange, done server-side so the call id is ours to hang up
 *   turn     safety guard + liveness heartbeat, once per tutor turn and on a timer
 *   end      hang up, settle the budget, analyse the transcript, write the record
 *
 * The AUDIO never comes through here. After `connect` the learner's device
 * holds a WebRTC peer connection straight to OpenAI. This function is the only
 * thing that knows what that session costs, how long it may run, and what it
 * produced — and, since migration 113, the only thing that can END it — which
 * is why every one of these actions re-checks that the caller owns the session
 * it names.
 *
 * `verify_jwt = false` in config.toml is MANDATORY. Without an entry the
 * Supabase CLI defaults it to true and every call from the app 401s before
 * reaching this code; auth is done in-band below instead.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { handleStart } from './start.ts';
import { handleTurn } from './turn.ts';
import { handleEnd } from './end.ts';
import { handleConnect } from './connect.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { parseStartRequest, parseTurnRequest, parseEndRequest, parseConnectRequest } from './parse-request.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// NOTE: OPENAI_KEY, not OPENAI_API_KEY. There is no OPENAI_API_KEY secret in
// this project — transcribe, score-pronunciation and generate-avatar all read
// OPENAI_KEY, and using the other name ships a function that 500s on first call.
const OPENAI_KEY = Deno.env.get('OPENAI_KEY') ?? null;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? null;
const TUTOR_SAFETY_SALT = Deno.env.get('TUTOR_SAFETY_SALT') ?? '';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Verify the caller's bearer token. Same approach as ai-chat: ask the auth
 *  service rather than parsing the JWT ourselves, so it keeps working whatever
 *  signing algorithm the project is configured for. */
async function verifyBearer(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header || !/^bearer\s+/i.test(header)) return null;
  const token = header.replace(/^bearer\s+/i, '').trim();
  if (!token) return null;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  if (!OPENAI_KEY) {
    console.error('[tutor-session] OPENAI_KEY is not configured');
    return json(503, { error: 'The tutor is unavailable right now.', code: 'NOT_CONFIGURED' });
  }
  if (!TUTOR_SAFETY_SALT) {
    // Refuse rather than silently sending an unsalted identifier to a vendor.
    console.error('[tutor-session] TUTOR_SAFETY_SALT is not configured');
    return json(503, { error: 'The tutor is unavailable right now.', code: 'NOT_CONFIGURED' });
  }

  const userId = await verifyBearer(req);
  if (!userId) return json(401, { error: 'Unauthorized' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body', code: 'BAD_REQUEST' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const action = body.action;

  try {
    if (action === 'start') {
      // Deliberately tighter than ai-chat's 20/60. Every allowed start mints a
      // credential that can spend real money, and nobody legitimately opens six
      // live calls in five minutes.
      const ok = await checkBurstLimit(supabase, userId, 'tutor-start', 6, 300);
      if (!ok) return json(429, { error: 'Too many requests.', code: 'RATE_LIMITED' });

      const parsed = parseStartRequest(body);
      if (!parsed.ok) return json(400, { error: parsed.error, code: parsed.code });

      const result = await handleStart(supabase, userId, parsed.value, {
        openaiKey: OPENAI_KEY,
        safetySalt: TUTOR_SAFETY_SALT,
      });
      return json(result.status, result.body);
    }

    if (action === 'turn') {
      const parsed = parseTurnRequest(body);
      if (!parsed.ok) return json(400, { error: parsed.error, code: parsed.code });

      const result = await handleTurn(supabase, userId, parsed.value, { openaiKey: OPENAI_KEY });
      return json(result.status, result.body);
    }

    if (action === 'connect') {
      // One dial plus a couple of redials is all a session ever needs.
      const ok = await checkBurstLimit(supabase, userId, 'tutor-connect', 10, 300);
      if (!ok) return json(429, { error: 'Too many requests.', code: 'RATE_LIMITED' });

      const parsed = parseConnectRequest(body);
      if (!parsed.ok) return json(400, { error: parsed.error, code: parsed.code });

      const result = await handleConnect(supabase, userId, parsed.value, { openaiKey: OPENAI_KEY });
      return json(result.status, result.body);
    }

    if (action === 'end') {
      // `end` refunds money. Concurrent ends used to each compute and apply
      // the same refund; the settlement claim in end.ts closes that, and this
      // keeps a misbehaving client from hammering the claim.
      const ok = await checkBurstLimit(supabase, userId, 'tutor-end', 10, 60);
      if (!ok) return json(429, { error: 'Too many requests.', code: 'RATE_LIMITED' });

      const parsed = parseEndRequest(body);
      if (!parsed.ok) return json(400, { error: parsed.error, code: parsed.code });

      const result = await handleEnd(supabase, userId, parsed.value, {
        anthropicKey: ANTHROPIC_KEY,
        openaiKey: OPENAI_KEY,
      });
      return json(result.status, result.body);
    }

    return json(400, { error: 'Unknown action', code: 'BAD_REQUEST' });
  } catch (err) {
    // Never leak a provider or database message to the client — they can carry
    // the system prompt or schema details. Log it, return something bland.
    console.error('[tutor-session] unhandled:', err instanceof Error ? err.stack : err);
    return json(500, { error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' });
  }
});
