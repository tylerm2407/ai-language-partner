/**
 * CORS configuration for Edge Functions.
 * Restricts origins to known app domains instead of allowing *.
 */

const ALLOWED_ORIGINS = [
  Deno.env.get('SUPABASE_URL') ?? '',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : '';

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

export function corsResponse(req: Request): Response {
  return new Response('ok', { headers: getCorsHeaders(req) });
}
