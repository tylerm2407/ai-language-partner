import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { DELETION_STAGES, stageDone, stagesThrough } from './workflow.ts';

const sourceUrl = new URL('./index.ts', import.meta.url);
const migrationUrl = new URL('../../migrations/119_account_deletion_jobs.sql', import.meta.url);

Deno.test('a fresh job has completed nothing', () => {
  for (const stage of DELETION_STAGES) assertEquals(stageDone(null, stage), false);
  assertEquals(stagesThrough(null), []);
});

Deno.test('a job recorded mid-way skips exactly the earlier mutations', () => {
  assertEquals(stageDone('auxiliary_deleted', 'billing_cancelled'), true);
  assertEquals(stageDone('auxiliary_deleted', 'auxiliary_deleted'), true);
  assertEquals(stageDone('auxiliary_deleted', 'storage_deleted'), false);
  assertEquals(stageDone('auxiliary_deleted', 'auth_deleted'), false);
  assertEquals(stagesThrough('auxiliary_deleted'), ['started', 'billing_cancelled', 'auxiliary_deleted']);
});

Deno.test('an unknown recorded stage skips nothing', () => {
  assertEquals(stageDone('garbage', 'billing_cancelled'), false);
  assertEquals(stagesThrough('garbage'), []);
});

Deno.test('the migration ladder and the code ladder agree', async () => {
  const migration = await Deno.readTextFile(migrationUrl);
  for (const stage of DELETION_STAGES) assert(migration.includes(`'${stage}'`), stage);
});

Deno.test('account deletion completes all preflight checks before Stripe cancellation', async () => {
  const source = await Deno.readTextFile(sourceUrl);
  const orgCheck = source.indexOf(".from('organizations')");
  const subscriptionCheck = source.indexOf(".from('subscriptions')");
  const jobRead = source.indexOf(".from('fluenci_account_deletion_jobs')");
  const stripeCancellation = source.indexOf('stripe.subscriptions.cancel');
  assert(orgCheck >= 0);
  assert(subscriptionCheck > orgCheck);
  assert(jobRead > subscriptionCheck);
  assert(stripeCancellation > jobRead);
});

Deno.test('the ledger is read before any mutation and gates every mutating stage', async () => {
  const source = await Deno.readTextFile(sourceUrl);
  const ledgerRead = source.indexOf("resumedFrom");
  const stripeCancellation = source.indexOf('stripe.subscriptions.cancel');
  assert(ledgerRead >= 0 && ledgerRead < stripeCancellation);
  for (const stage of ['billing_cancelled', 'auxiliary_deleted', 'storage_deleted', 'audit_scrubbed', 'auth_deleted']) {
    assert(source.includes(`done('${stage}')`), `${stage} is not gated on the ledger`);
    assert(source.includes(`await recordStage('${stage}')`), `${stage} is not recorded`);
  }
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
