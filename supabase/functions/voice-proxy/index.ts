// Supabase Edge Function: Voice Proxy
// Server-side WebSocket proxy for Gemini Live API.
// The Google AI API key NEVER leaves the server — client connects here,
// and this function proxies bidirectionally to Gemini Live.
// Deploy: npx supabase functions deploy voice-proxy

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
const GEMINI_LIVE_MODEL = 'gemini-2.0-flash-live';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  // Only accept WebSocket upgrade requests
  const upgradeHeader = req.headers.get('upgrade') ?? '';
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response(
      JSON.stringify({ error: 'Expected WebSocket upgrade' }),
      { status: 426, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Authenticate via query param (WebSocket can't use custom headers during upgrade)
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing token parameter' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate JWT by constructing a fake request with the Authorization header
  const authReq = new Request(req.url, {
    headers: new Headers({ Authorization: `Bearer ${token}` }),
  });
  const authUser = await getAuthenticatedUser(authReq);
  if (!authUser) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!GOOGLE_AI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_AI_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Upgrade the client connection to WebSocket
  const { socket: clientWs, response } = Deno.upgradeWebSocket(req);

  // Connect to Gemini Live server-side (API key stays on the server)
  const geminiUri = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GOOGLE_AI_API_KEY}`;
  let geminiWs: WebSocket | null = null;

  clientWs.onopen = () => {
    // Open server-side connection to Gemini when client connects
    geminiWs = new WebSocket(geminiUri);

    geminiWs.onopen = () => {
      // Gemini connection ready — client can now send setup messages
    };

    geminiWs.onmessage = (event) => {
      // Forward Gemini responses to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(event.data);
      }
    };

    geminiWs.onerror = (event) => {
      console.error('[voice-proxy] Gemini WebSocket error:', event);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, 'Upstream error');
      }
    };

    geminiWs.onclose = (event) => {
      // When Gemini closes, close client connection too
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(event.code, event.reason || 'Upstream closed');
      }
    };
  };

  clientWs.onmessage = (event) => {
    // Forward client messages to Gemini
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(event.data);
    }
  };

  clientWs.onerror = (event) => {
    console.error('[voice-proxy] Client WebSocket error:', event);
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close(1011, 'Client error');
    }
  };

  clientWs.onclose = () => {
    // Clean up Gemini connection when client disconnects
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close(1000, 'Client disconnected');
    }
    geminiWs = null;
  };

  return response;
});
