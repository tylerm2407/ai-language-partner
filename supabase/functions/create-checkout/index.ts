// Supabase Edge Function: Create Stripe Checkout Session
// Creates a Stripe Checkout session for subscription purchases.
// Deploy: npx supabase functions deploy create-checkout

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Price IDs — set these after creating products in Stripe Dashboard
const PRICE_IDS: Record<string, string> = {
  basic_monthly: Deno.env.get('STRIPE_BASIC_MONTHLY_PRICE_ID') ?? 'price_placeholder_basic_monthly',
  basic_yearly: Deno.env.get('STRIPE_BASIC_YEARLY_PRICE_ID') ?? 'price_placeholder_basic_yearly',
  premium_monthly: Deno.env.get('STRIPE_PREMIUM_MONTHLY_PRICE_ID') ?? 'price_placeholder_premium_monthly',
  premium_yearly: Deno.env.get('STRIPE_PREMIUM_YEARLY_PRICE_ID') ?? 'price_placeholder_premium_yearly',
  unlimited_monthly: Deno.env.get('STRIPE_UNLIMITED_MONTHLY_PRICE_ID') ?? 'price_placeholder_unlimited_monthly',
  unlimited_yearly: Deno.env.get('STRIPE_UNLIMITED_YEARLY_PRICE_ID') ?? 'price_placeholder_unlimited_yearly',
};

interface CheckoutRequest {
  userId: string;
  email: string;
  priceKey: string; // e.g., 'basic_monthly', 'premium_monthly', 'unlimited_monthly'
  successUrl?: string;
  cancelUrl?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { userId, email, priceKey, successUrl, cancelUrl } = (await req.json()) as CheckoutRequest;

    const priceId = PRICE_IDS[priceKey];
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Invalid price key: ${priceKey}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl ?? 'languageai://subscription-success',
      cancel_url: cancelUrl ?? 'languageai://subscription-cancel',
      metadata: { supabase_user_id: userId },
      subscription_data: {
        metadata: { supabase_user_id: userId },
      },
    });

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
