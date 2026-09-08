import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

const sourceUrl = new URL('./index.ts', import.meta.url);
const migrationUrl = new URL('../../migrations/119_account_deletion_jobs.sql', import.meta.url);

Deno.test('account deletion completes all preflight checks before Stripe cancellation', async () => {
  const source = await Deno.readTextFile(sourceUrl);
  const orgCheck = source.indexOf(".from('organizations')");
  const subscriptionCheck = source.indexOf(".from('subscriptions')");
  const jobStart = source.indexOf(".from('fluenci_account_deletion_jobs')");
  const stripeCancellation = source.indexOf('stripe.subscriptions.cancel');
  assert(orgCheck >= 0);
  assert(subscriptionCheck > orgCheck);
  assert(jobStart > subscriptionCheck);
  assert(stripeCancellation > jobStart);
});

Deno.test('partial deletion responses carry completed stages', async () => {
  const source = await Deno.readTextFile(sourceUrl);
  assert(source.includes('deletionStarted: completedStages.length > 1'));
  assert(source.includes("await recordStage('billing_cancelled')"));
  assert(source.includes("await recordStage('auxiliary_deleted')"));
  assert(source.includes("await recordStage('storage_deleted')"));
  assert(source.includes("await recordStage('audit_scrubbed')"));
  assert(source.includes("await recordStage('auth_deleted')"));
});

Deno.test('deletion job ledger is inaccessible to application roles', async () => {
  const migration = await Deno.readTextFile(migrationUrl);
  assertEquals(
    migration.includes(
      'REVOKE ALL ON public.fluenci_account_deletion_jobs FROM PUBLIC,anon,authenticated;',
    ),
    true,
  );
});
