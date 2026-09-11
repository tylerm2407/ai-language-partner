export interface CustomerCandidate {
  id: string;
  metadata?: Record<string, string> | null;
}

export type CustomerResolution =
  | { kind: 'owned'; customerId: string }
  | { kind: 'create' }
  | { kind: 'conflict' };

export function resolveCustomerOwnership(
  userId: string,
  mappedCustomer: CustomerCandidate | null,
  discoveredCustomers: CustomerCandidate[],
): CustomerResolution {
  if (mappedCustomer) {
    return mappedCustomer.metadata?.supabase_user_id === userId
      ? { kind: 'owned', customerId: mappedCustomer.id }
      : { kind: 'conflict' };
  }

  const owned = discoveredCustomers.filter(
    (customer) => customer.metadata?.supabase_user_id === userId,
  );
  if (owned.length === 0) return { kind: 'create' };
  if (owned.length > 1) return { kind: 'conflict' };
  return { kind: 'owned', customerId: owned[0].id };
}

export function customerSearchQuery(userId: string): string {
  return "metadata['supabase_user_id']:'" + userId + "'";
}

export const CHECKOUT_SUCCESS_URL = 'fluenci://subscription-success';
export const CHECKOUT_CANCEL_URL = 'fluenci://subscription-cancel';
