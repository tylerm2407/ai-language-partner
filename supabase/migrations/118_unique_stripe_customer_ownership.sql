-- 118 — A Stripe customer/subscription may belong to only one Fluenci user.
--
-- The preflight deliberately aborts on historical collisions. Ownership must
-- be reviewed against Stripe metadata and provider state; a migration must
-- never guess which account owns a paying customer.

BEGIN;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT stripe_customer_id
      FROM public.subscriptions
     WHERE stripe_customer_id IS NOT NULL
     GROUP BY stripe_customer_id
    HAVING count(DISTINCT user_id) > 1
  ) THEN
    RAISE EXCEPTION
      'Stripe customer ownership collision detected; reconcile before migration';
  END IF;

  IF EXISTS (
    SELECT stripe_subscription_id
      FROM public.subscriptions
     WHERE stripe_subscription_id IS NOT NULL
     GROUP BY stripe_subscription_id
    HAVING count(DISTINCT user_id) > 1
  ) THEN
    RAISE EXCEPTION
      'Stripe subscription ownership collision detected; reconcile before migration';
  END IF;
END;
$preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_customer_unique
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_unique
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMIT;
