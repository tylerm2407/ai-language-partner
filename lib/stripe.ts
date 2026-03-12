import { supabase } from './supabase';
import { Linking } from 'react-native';
import { PLAN_FEATURES } from './plans';
import type { PlanId } from './plans';

interface CheckoutOptions {
  userId: string;
  email: string;
  priceKey: string;
}

/**
 * Create a Stripe Checkout session and open it in the browser.
 * The user completes payment in Stripe's hosted checkout page,
 * then is redirected back to the app via deep link.
 */
export async function openCheckout(options: CheckoutOptions): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      userId: options.userId,
      email: options.email,
      priceKey: options.priceKey,
    },
  });

  if (error) throw new Error(`Checkout error: ${error.message}`);

  const { url } = data as { sessionId: string; url: string };

  if (url) {
    await Linking.openURL(url);
  } else {
    throw new Error('No checkout URL returned');
  }
}

/**
 * Subscription plan definitions for the paywall UI.
 * Features are pulled from the central PLAN_FEATURES in lib/plans.ts.
 */
export const PRICING_PLANS = [
  {
    key: 'free' as const,
    planId: 'free' as PlanId,
    name: 'Free',
    price: '$0',
    period: '',
    features: PLAN_FEATURES.free,
  },
  {
    key: 'basic_monthly' as const,
    planId: 'basic' as PlanId,
    name: 'Basic',
    price: '$9.99',
    period: '/month',
    features: PLAN_FEATURES.basic,
  },
  {
    key: 'premium_monthly' as const,
    planId: 'premium' as PlanId,
    name: 'Premium',
    price: '$19.99',
    period: '/month',
    features: PLAN_FEATURES.premium,
    popular: true,
  },
  {
    key: 'unlimited_monthly' as const,
    planId: 'unlimited' as PlanId,
    name: 'Unlimited',
    price: '$29.99',
    period: '/month',
    features: PLAN_FEATURES.unlimited,
  },
] as const;
