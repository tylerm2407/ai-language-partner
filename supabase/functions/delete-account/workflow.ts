/**
 * The account-deletion stage ladder, shared by the edge function and its
 * tests. A stage is "reached" once every earlier stage has completed, so a
 * retry can skip the mutations it already made instead of repeating them
 * (cancelling a Stripe subscription twice is harmless; the point is that
 * the ledger row in `fluenci_account_deletion_jobs` is actually read).
 */
export type DeletionStage =
  | 'started'
  | 'billing_cancelled'
  | 'auxiliary_deleted'
  | 'storage_deleted'
  | 'audit_scrubbed'
  | 'auth_deleted';

export const DELETION_STAGES: readonly DeletionStage[] = [
  'started',
  'billing_cancelled',
  'auxiliary_deleted',
  'storage_deleted',
  'audit_scrubbed',
  'auth_deleted',
];

function indexOf(stage: string | null | undefined): number {
  return stage ? DELETION_STAGES.indexOf(stage as DeletionStage) : -1;
}

/** True when a job recorded at `recorded` has already completed `stage`. */
export function stageDone(recorded: string | null | undefined, stage: DeletionStage): boolean {
  const have = indexOf(recorded);
  const want = indexOf(stage);
  return have >= 0 && want >= 0 && have >= want;
}

/** Every stage up to and including `recorded`, in order. Empty for an
 *  unknown or absent stage so a corrupt ledger row cannot skip work. */
export function stagesThrough(recorded: string | null | undefined): DeletionStage[] {
  const have = indexOf(recorded);
  return have < 0 ? [] : DELETION_STAGES.slice(0, have + 1);
}
