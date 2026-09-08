import {
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  connectTutorProvider,
  hangupTutorProvider,
  sha256Hex,
} from "./tutor-provider-call.ts";

const TOKEN = "a".repeat(64);
const API_KEY = "sk-provider-only";
const realFetch = globalThis.fetch;

Deno.test("connection capability is one-use and provider auth stays server-side", async () => {
  let claimed = false;
  let providerRequests = 0;
  let providerAuthorization = "";
  const supabase = {
    rpc(name: string, params: Record<string, unknown>) {
      if (name === "claim_tutor_provider_connection") {
        assertEquals(params.p_token_hash, awaitableHash);
        if (claimed) {
          return Promise.resolve({
            data: { status: "unavailable" },
            error: null,
          });
        }
        claimed = true;
        return Promise.resolve({
          data: {
            status: "claimed",
            sessionId: "session-1",
            sessionConfig: { type: "realtime", model: "gpt-realtime" },
            safetyIdentifier: "b".repeat(64),
          },
          error: null,
        });
      }
      if (name === "complete_tutor_provider_connection") {
        assertEquals(params.p_provider_call_id, "call_123");
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  const awaitableHash = await sha256Hex(TOKEN);
  globalThis.fetch = ((_: string | URL | Request, init?: RequestInit) => {
    providerRequests += 1;
    providerAuthorization = new Headers(init?.headers).get("authorization") ??
      "";
    return Promise.resolve(
      new Response("answer-sdp", {
        status: 200,
        headers: { Location: "/v1/realtime/calls/call_123" },
      }),
    );
  }) as typeof fetch;
  try {
    const request = () =>
      new Request("https://edge.test/tutor-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/sdp",
        },
        body: "offer-sdp",
      });
    const first = await connectTutorProvider(request(), supabase, API_KEY);
    assertEquals(first.status, 200);
    assertEquals(await first.text(), "answer-sdp");
    const replay = await connectTutorProvider(request(), supabase, API_KEY);
    assertEquals(replay.status, 409);
    assertEquals(providerRequests, 1);
    assertEquals(providerAuthorization, `Bearer ${API_KEY}`);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("hangup treats an already-terminal provider call as ended", async () => {
  const calls: string[] = [];
  const supabase = {
    rpc(name: string) {
      calls.push(name);
      if (name === "claim_tutor_provider_hangup") {
        return Promise.resolve({
          data: { status: "claimed", callId: "call_done" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  globalThis.fetch = ((url: string | URL | Request) => {
    assertMatch(String(url), /\/realtime\/calls\/call_done\/hangup$/);
    return Promise.resolve(new Response("", { status: 404 }));
  }) as typeof fetch;
  try {
    assertEquals(
      await hangupTutorProvider(supabase, "session-1", API_KEY),
      "ended",
    );
    assertEquals(calls, [
      "claim_tutor_provider_hangup",
      "complete_tutor_provider_hangup",
    ]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
