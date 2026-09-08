// Supabase Edge Function: Delete Account
// Permanently deletes a user's account and all associated data.
// Apple App Store 5.1.1(v) + GDPR erasure requirement.
// Deploy: npx supabase functions deploy delete-account
//
// Ordering matters and is deliberate:
//   1. Perform every non-mutating eligibility/configuration check.
//   2. Refuse if the user still owns an organization (organizations.created_by is
//      ON DELETE RESTRICT, so the auth delete would fail anyway, but with an opaque error).
//   3. Record each completed mutation in the deletion-job ledger.
//   4. Delete the rows that do NOT cascade.
//   5. Delete the auth user — every other user table is ON DELETE CASCADE to auth.users,
//      so this removes the rest atomically inside Postgres.
//   6. Verify nothing is left behind before reporting success.
// Every step fails CLOSED: if we cannot complete deletion we abort and report it,
// rather than destroying the identity and orphaning the data.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

// Tables holding user rows that are NOT ON DELETE CASCADE to auth.users.
// Everything else is cleaned up by the cascade when the auth user is deleted.
// Keep this list in sync if a new table adds a user_id without an FK.
//
// Verified against live pg_constraint (Aug 2026): client_events is the only
// table carrying a user_id with no FK at all. Two other constraints are
// non-cascading and both are handled deliberately elsewhere rather than here —
// organizations.created_by is RESTRICT (step 2 refuses org owners with a 409),
// and audit_log.actor_id is SET NULL (step 3c scrubs it, keeping the audit
// entry but removing the person). Everything else cascades.
const NON_CASCADING_TABLES = [{ table: 'client_events', column: 'user_id' }];

type DeletionStage =
  | 'started'
  | 'billing_cancelled'
  | 'auxiliary_deleted'
  | 'storage_deleted'
  | 'audit_scrubbed'
  | 'auth_deleted';

function partialError(message: string, completedStages: DeletionStage[]) {
  return {
    error: message,
    deletionStarted: completedStages.length > 1,
    completedStages,
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  let completedStages: DeletionStage[] = [];

  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    const userId = authUser.userId;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- 1. Eligibility preflight: no mutations before every check passes --
    const { data: ownedOrgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('created_by', userId)
      .limit(5);

    if (orgError) {
      console.error(`[delete-account] org ownership check failed for ${userId}:`, orgError.message);
      return new Response(
        JSON.stringify({ error: 'Could not verify account ownership. Nothing was deleted. Please try again.' }),
        { status: 500, headers }
      );
    }

    if (ownedOrgs && ownedOrgs.length > 0) {
      return new Response(
        JSON.stringify({
          error:
            'You still own an organization. Transfer ownership or delete the organization first, then delete your account.',
          code: 'OWNS_ORGANIZATION',
          organizations: ownedOrgs.map((o) => o.name),
        }),
        { status: 409, headers }
      );
    }

    const { data: subscription, error: subReadError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, tier, is_active')
      .eq('user_id', userId)
      .maybeSingle();

    if (subReadError) {
      console.error(`[delete-account] could not read subscription for ${userId}:`, subReadError.message);
      return new Response(
        JSON.stringify({
          error: 'Could not verify your subscription status. Nothing was deleted. Please try again.',
        }),
        { status: 500, headers }
      );
    }

    if (subscription?.stripe_subscription_id && !STRIPE_SECRET_KEY) {
      console.error('[delete-account] STRIPE_SECRET_KEY not configured; refusing preflight');
      return new Response(
        JSON.stringify({
          error: 'Could not prepare subscription cancellation. Nothing was deleted. Please contact support.',
        }),
        { status: 500, headers }
      );
    }

    // Store-billed subscriptions (RevenueCat / StoreKit / Play Billing) cannot be
    // cancelled server-side — only the user can, in their store account. Tell them.
    const hasStoreSubscription =
      !!subscription?.is_active && !subscription?.stripe_subscription_id && subscription?.tier !== 'starter';

    completedStages = ['started'];
    const { error: jobError } = await supabase
      .from('fluenci_account_deletion_jobs')
      .upsert({ user_id: userId, stage: 'started', last_error: null, updated_at: new Date().toISOString() });
    if (jobError) {
      console.error(`[delete-account] could not initialize deletion job for ${userId}:`, jobError.message);
      return new Response(
        JSON.stringify({ error: 'Could not start account deletion. Nothing was deleted. Please try again.' }),
        { status: 500, headers }
      );
    }

    const recordStage = async (stage: DeletionStage, lastError: string | null = null) => {
      if (!completedStages.includes(stage)) completedStages.push(stage);
      const { error } = await supabase
        .from('fluenci_account_deletion_jobs')
        .update({ stage, last_error: lastError, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) console.error(`[delete-account] failed to record ${stage} for ${userId}:`, error.message);
    };

    // --- 2. Cancel billing after preflight -------------------------------

    if (subscription?.stripe_subscription_id) {
      const stripe = new Stripe(STRIPE_SECRET_KEY!, {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
      });

      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (err: unknown) {
        // A subscription that is already gone is not a failure — anything else is.
        const code = (err as { code?: string })?.code;
        const status = (err as { statusCode?: number })?.statusCode;
        const alreadyGone = code === 'resource_missing' || status === 404;
        if (!alreadyGone) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[delete-account] Stripe cancel failed for ${userId}:`, message);
          return new Response(
            JSON.stringify(partialError(
              'Account deletion started, but subscription cancellation failed. Please retry or contact support.',
              completedStages,
            )),
            { status: 500, headers }
          );
        }
      }
    }
    await recordStage('billing_cancelled');

    // --- 3. Delete rows that do not cascade -------------------------------
    for (const { table, column } of NON_CASCADING_TABLES) {
      const { error } = await supabase.from(table).delete().eq(column, userId);
      if (error) {
        console.error(`[delete-account] failed to delete from ${table} for ${userId}:`, error.message);
        return new Response(
          JSON.stringify(partialError(
            'Account deletion is partially complete. Please retry so we can finish it.',
            completedStages,
          )),
          { status: 500, headers }
        );
      }
    }
    await recordStage('auxiliary_deleted');

    // --- 3b. Purge generated avatars from storage -------------------------
    // Storage is not covered by the auth-user cascade, so a stylised portrait
    // of the user would outlive their account. Runs BEFORE the irreversible
    // auth deletion so a failure can abort while the account still exists.
    {
      const { data: avatarObjects, error: listError } = await supabase.storage
        .from('avatars')
        .list(userId);

      if (listError) {
        console.error(`[delete-account] failed to list avatars for ${userId}:`, listError.message);
        return new Response(
          JSON.stringify(partialError(
            'Account deletion is partially complete. Avatar cleanup failed; please retry.',
            completedStages,
          )),
          { status: 500, headers }
        );
      }

      if (avatarObjects && avatarObjects.length > 0) {
        const paths = avatarObjects.map((o) => `${userId}/${o.name}`);
        const { error: removeError } = await supabase.storage.from('avatars').remove(paths);
        if (removeError) {
          console.error(`[delete-account] failed to remove avatars for ${userId}:`, removeError.message);
          return new Response(
            JSON.stringify(partialError(
              'Account deletion is partially complete. Avatar cleanup failed; please retry.',
              completedStages,
            )),
            { status: 500, headers }
          );
        }
      }
    }
    await recordStage('storage_deleted');

    // --- 3c. Pseudonymise the audit trail ---------------------------------
    // audit_log deliberately SURVIVES deletion — the rows are evidence a
    // university security review expects to see retained, so migration 075
    // makes the FK ON DELETE SET NULL rather than CASCADE.
    //
    // But SET NULL only drops the actor. The row also carries an ip_address,
    // which is personal data under GDPR, so clear both explicitly here while
    // the rows can still be found by actor_id. Doing this BEFORE the auth
    // deletion also means the FK is already unlinked by the time deleteUser
    // runs — the migration is the backstop, this is the actual erasure.
    //
    // Fails closed like every other step: an audit row still naming a deleted
    // user is a compliance defect, not an acceptable partial success.
    {
      const { error: auditError } = await supabase
        .from('audit_log')
        .update({ actor_id: null, ip_address: null })
        .eq('actor_id', userId);

      if (auditError) {
        console.error(`[delete-account] failed to scrub audit_log for ${userId}:`, auditError.message);
        return new Response(
          JSON.stringify(partialError(
            'Account deletion is partially complete. Audit-log anonymization failed; please retry.',
            completedStages,
          )),
          { status: 500, headers }
        );
      }
    }
    await recordStage('audit_scrubbed');

    // --- 4. Delete the auth user (cascades every remaining user table) ----
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error(`[delete-account] failed to delete auth user ${userId}:`, deleteError.message);
      return new Response(
        JSON.stringify(partialError(
          'Account deletion is partially complete, but the login could not be removed. Please retry or contact support.',
          completedStages,
        )),
        { status: 500, headers }
      );
    }
    await recordStage('auth_deleted');

    // --- 5. Verify the erasure actually happened --------------------------
    const { count: remainingProfiles, error: verifyError } = await supabase
      .from('user_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (verifyError || (remainingProfiles ?? 0) > 0) {
      // The identity is gone but data survived — this must be visible, not swallowed.
      console.error(
        `[delete-account] INCOMPLETE ERASURE for ${userId}: ${remainingProfiles ?? 'unknown'} profile rows remain`,
        verifyError?.message ?? ''
      );
      return new Response(
        JSON.stringify(partialError(
          'Your login was removed, but some data may remain. Please contact support so we can finish.',
          completedStages,
        )),
        { status: 500, headers }
      );
    }

    const { error: cleanupJobError } = await supabase
      .from('fluenci_account_deletion_jobs')
      .delete()
      .eq('user_id', userId);
    if (cleanupJobError) {
      // Erasure succeeded. Do not turn success into a false failure because a
      // service-only progress row needs asynchronous cleanup; make it visible.
      console.error(`[delete-account] deletion succeeded but job cleanup failed for ${userId}:`, cleanupJobError.message);
      return new Response(JSON.stringify({
        success: true,
        hasStoreSubscription,
        cleanupPending: true,
      }), { headers });
    }

    return new Response(JSON.stringify({ success: true, hasStoreSubscription }), { headers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[delete-account] unexpected error:', message);
    return new Response(JSON.stringify(
      completedStages.length > 0
        ? partialError(
          'Account deletion is partially complete. Please retry or contact support.',
          completedStages,
        )
        : { error: 'An unexpected error occurred' },
    ), {
      status: 500,
      headers,
    });
  }
});
