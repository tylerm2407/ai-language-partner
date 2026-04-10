import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import { PLAN_FEATURES } from './plans';
import type { PlanId } from './plans';

interface CheckoutOptions {
  userId: string;
  email: string;
  priceKey: string;
}

/**
 * Create a Stripe Checkout session and open it in an in-app browser.
 * Works in Expo Go — no custom URL scheme required.
 */
export async function openCheckout(options: CheckoutOptions): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      userId: options.userId,
      email: options.email,
      priceKey: options.priceKey,
    },
  });

  if (error) {
    let errorMessage = error.message;
    try {
      const ctx = (error as Record<string, unknown>).context;
      if (ctx && typeof (ctx as Response).json === 'function') {
        const body = await (ctx as Response).json();
        if (body?.error) errorMessage = body.error;
      }
    } catch {
      // Couldn't parse error body — fall through with generic message
    }
    throw new Error(`Checkout error: ${errorMessage}`);
  }

  const { url } = data as { sessionId: string; url: string };

  if (url) {
    await WebBrowser.openBrowserAsync(url);
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
    key: 'vip_monthly' as const,
    planId: 'vip' as PlanId,
    name: 'VIP',
    price: '$29.99',
    period: '/month',
    features: PLAN_FEATURES.vip,
  },
] as const;
