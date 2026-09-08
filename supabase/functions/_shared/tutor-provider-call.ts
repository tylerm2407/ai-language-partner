import { PROVIDER_TIMEOUT_MS, providerFetch } from "./provider-fetch.ts";

// deno-lint-ignore no-explicit-any
type Client = any;

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(digest),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

export function newConnectionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (!/^bearer\s+/i.test(header)) return null;
  const token = header.replace(/^bearer\s+/i, "").trim();
  return token.length >= 32 ? token : null;
}

function callIdFromLocation(location: string | null): string | null {
  if (!location) return null;
  const match = location.match(/\/realtime\/calls\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function connectTutorProvider(
  req: Request,
  supabase: Client,
  openaiKey: string,
): Promise<Response> {
  const token = bearer(req);
  if (!token) return new Response("Unauthorized", { status: 401 });
  const offer = await req.text();
  if (!offer.trim() || offer.length > 1_000_000) {
    return new Response("Invalid SDP offer", { status: 400 });
  }

  const { data, error } = await supabase.rpc(
    "claim_tutor_provider_connection",
    {
      p_token_hash: await sha256Hex(token),
    },
  );
  const claim = record(data);
  if (error || claim?.status !== "claimed") {
    return new Response("Connection capability is expired or already used", {
      status: 409,
    });
  }
  const sessionId = typeof claim.sessionId === "string" ? claim.sessionId : "";
  const config = record(claim.sessionConfig);
  const safetyId = typeof claim.safetyIdentifier === "string"
    ? claim.safetyIdentifier
    : "";
  if (!sessionId || !config || !safetyId) {
    return new Response("Connection configuration unavailable", {
      status: 503,
    });
  }

  let providerCallId: string | null = null;
  try {
    const form = new FormData();
    form.set(
      "sdp",
      new Blob([offer], { type: "application/sdp" }),
      "offer.sdp",
    );
    form.set("session", JSON.stringify(config));
    const upstream = await providerFetch(CALLS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "OpenAI-Safety-Identifier": safetyId,
      },
      body: form,
    }, {
      provider: "openai-realtime",
      timeoutMs: PROVIDER_TIMEOUT_MS.textShort,
    });
    const answer = await upstream.text();
    if (!upstream.ok) {
      console.error(
        "[tutor-provider] call creation failed:",
        upstream.status,
        answer.slice(0, 300),
      );
      throw new Error(`provider call creation ${upstream.status}`);
    }
    providerCallId = callIdFromLocation(upstream.headers.get("location"));
    if (!providerCallId || !answer.trim()) {
      throw new Error("provider response missing call id or SDP");
    }

    const completed = await supabase.rpc("complete_tutor_provider_connection", {
      p_session_id: sessionId,
      p_provider_call_id: providerCallId,
    });
    if (completed.error || completed.data !== true) {
      await hangupCallId(openaiKey, providerCallId);
      throw new Error("could not persist provider call ownership");
    }
    return new Response(answer, {
      status: 200,
      headers: { "Content-Type": "application/sdp" },
    });
  } catch (err) {
    if (!providerCallId) {
      await supabase.rpc("release_tutor_provider_connection", {
        p_session_id: sessionId,
      });
    }
    console.error(
      "[tutor-provider] connection failed:",
      err instanceof Error ? err.message : err,
    );
    return new Response("Tutor connection failed", { status: 502 });
  }
}

async function hangupCallId(
  openaiKey: string,
  callId: string,
): Promise<boolean> {
  const response = await providerFetch(
    `${CALLS_URL}/${encodeURIComponent(callId)}/hangup`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
    },
    {
      provider: "openai-realtime-hangup",
      timeoutMs: PROVIDER_TIMEOUT_MS.textShort,
    },
  );
  // Not-found/conflict means the call is already terminal, which satisfies the
  // postcondition just as surely as a fresh 2xx hangup.
  return response.ok || response.status === 404 || response.status === 409;
}

export async function hangupTutorProvider(
  supabase: Client,
  sessionId: string,
  openaiKey: string,
): Promise<"ended" | "busy" | "failed"> {
  const { data, error } = await supabase.rpc("claim_tutor_provider_hangup", {
    p_session_id: sessionId,
    p_lease_seconds: 30,
  });
  const claim = record(data);
  if (error) return "failed";
  if (claim?.status === "already") return "ended";
  if (claim?.status === "busy") return "busy";
  const callId = typeof claim?.callId === "string" ? claim.callId : "";
  if (claim?.status !== "claimed" || !callId) return "failed";

  let succeeded = false;
  try {
    succeeded = await hangupCallId(openaiKey, callId);
  } catch (err) {
    console.error(
      "[tutor-provider] hangup failed:",
      err instanceof Error ? err.message : err,
    );
  }
  const completed = await supabase.rpc("complete_tutor_provider_hangup", {
    p_session_id: sessionId,
    p_succeeded: succeeded,
  });
  return succeeded && !completed.error ? "ended" : "failed";
}
