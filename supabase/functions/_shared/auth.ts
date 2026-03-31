/**
 * Shared authentication utilities for Edge Functions.
 * Validates JWT from Authorization header and extracts user ID.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

/**
 * Extract and verify the authenticated user from the request.
 * Returns the user ID or null if unauthenticated.
 */
export async function getAuthenticatedUser(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return { userId: user.id };
}
