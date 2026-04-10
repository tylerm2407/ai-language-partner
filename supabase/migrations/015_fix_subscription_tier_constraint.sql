-- Fix subscription tier check constraint to match app tier names.
-- Old constraint allowed: free, basic, pro, vip
-- App uses: free, basic, premium, vip

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
UPDATE subscriptions SET tier = 'vip' WHERE tier = 'unlimited';
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier = ANY (ARRAY['free', 'basic', 'premium', 'vip']));
