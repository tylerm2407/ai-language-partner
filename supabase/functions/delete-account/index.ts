// Supabase Edge Function: Delete Account
// Permanently deletes a user's account and all associated data.
// Apple App Store requirement: apps must offer account deletion.
// Deploy: npx supabase functions deploy delete-account

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers }
      );
    }

    const userId = authUser.userId;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Delete user data from all tables (cascade handles most, but be explicit)
    // Order matters: delete dependent rows first
    const tablesToClean = [
      { table: 'correction_log', column: 'user_id' },
      { table: 'review_logs', column: 'user_id' },
      { table: 'review_items', column: 'user_id' },
      { table: 'daily_usage', column: 'user_id' },
      { table: 'lesson_progress', column: 'user_id' },
      { table: 'daily_stats', column: 'user_id' },
      { table: 'achievements', column: 'user_id' },
      { table: 'practice_sessions', column: 'user_id' },
      { table: 'user_news_reads', column: 'user_id' },
      { table: 'subscriptions', column: 'user_id' },
      { table: 'user_profiles', column: 'user_id' },
    ];

    for (const { table, column } of tablesToClean) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(column, userId);

      if (error) {
        console.error(`Failed to delete from ${table}:`, error.message);
        // Continue deleting other tables even if one fails
      }
    }

    // Delete the auth user last (this is irreversible)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account. Please contact support.' }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers }
    );
  } catch (error) {
    console.error('Delete account error:', error.message);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers }
    );
  }
});
