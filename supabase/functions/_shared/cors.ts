/**
 * CORS headers for Edge Functions.
 * Uses permissive '*' since all requests are authenticated via Supabase JWT.
 */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function corsResponse(): Response {
  return new Response('ok', { headers: corsHeaders });
}
