// Supabase Edge Function: Create Stripe Checkout Session
// Creates a Stripe Checkout session for subscription purchases.
// Deploy: npx supabase functions deploy create-checkout

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import {
  CHECKOUT_CANCEL_URL,
  CHECKOUT_SUCCESS_URL,
  customerSearchQuery,
  resolveCustomerOwnership,
} from './customer-ownership.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Price IDs — set these after creating products in Stripe Dashboard
const PRICE_IDS: Record<string, string> = {
  basic_monthly: Deno.env.get('STRIPE_BASIC_MONTHLY_PRICE_ID') ?? 'price_placeholder_basic_monthly',
  basic_yearly: Deno.env.get('STRIPE_BASIC_YEARLY_PRICE_ID') ?? 'price_placeholder_basic_yearly',
  premium_monthly: Deno.env.get('STRIPE_PREMIUM_MONTHLY_PRICE_ID') ?? 'price_placeholder_premium_monthly',
  premium_yearly: Deno.env.get('STRIPE_PREMIUM_YEARLY_PRICE_ID') ?? 'price_placeholder_premium_yearly',
  vip_monthly: Deno.env.get('STRIPE_VIP_MONTHLY_PRICE_ID') ?? Deno.env.get('STRIPE_UNLIMITED_MONTHLY_PRICE_ID') ?? 'price_placeholder_vip_monthly',
  vip_yearly: Deno.env.get('STRIPE_VIP_YEARLY_PRICE_ID') ?? Deno.env.get('STRIPE_UNLIMITED_YEARLY_PRICE_ID') ?? 'price_placeholder_vip_yearly',
};

interface CheckoutRequest {
  priceKey: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers }
      );
    }

    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { priceKey } = (await req.json()) as CheckoutRequest;
    const authenticatedUserId = authUser.userId;

    const priceId = PRICE_IDS[priceKey];
    if (!priceId || priceId.startsWith('price_placeholder')) {
      return new Response(
        JSON.stringify({ error: `Invalid or unconfigured price key: ${priceKey}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: subscriptionRow, error: mappingReadError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', authenticatedUserId)
      .maybeSingle();
    if (mappingReadError) throw new Error('billing customer mapping lookup failed');

    const mappedId = subscriptionRow?.stripe_customer_id as string | null | undefined;
    const mappedCustomer = mappedId
      ? await stripe.customers.retrieve(mappedId)
      : null;
    if (mappedCustomer?.deleted) {
      throw new Error('mapped Stripe customer was deleted; manual reconciliation required');
    }

    const discovered = mappedCustomer
      ? []
      : (await stripe.customers.search({
        query: customerSearchQuery(authenticatedUserId),
        limit: 2,
      })).data;

    const ownership = resolveCustomerOwnership(
      authenticatedUserId,
      mappedCustomer,
      discovered,
    );
    if (ownership.kind === 'conflict') {
      throw new Error('Stripe customer ownership conflict; manual reconciliation required');
    }

    let customerId: string;
    if (ownership.kind === 'owned') {
      customerId = ownership.customerId;
    } else {
      const customer = await stripe.customers.create({
        email: authUser.email || undefined,
        metadata: { supabase_user_id: authenticatedUserId },
      }, {
        idempotencyKey: 'fluenci-customer-' + authenticatedUserId,
      });
      customerId = customer.id;
    }

    const { error: mappingWriteError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: authenticatedUserId,
        stripe_customer_id: customerId,
      }, { onConflict: 'user_id' });
    if (mappingWriteError) throw new Error('billing customer mapping write failed');

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: authenticatedUserId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: CHECKOUT_SUCCESS_URL,
      cancel_url: CHECKOUT_CANCEL_URL,
      metadata: { supabase_user_id: authenticatedUserId },
      subscription_data: {
        metadata: { supabase_user_id: authenticatedUserId },
      },
    });

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Stripe error messages carry account, price and customer identifiers.
    // The caller gets a code; the detail stays in the logs (CLAUDE.md §6).
    const message = error instanceof Error ? error.message : String(error);
    console.error('[create-checkout] unhandled error:', message);
    return new Response(
      JSON.stringify({ error: 'Could not start checkout. Please try again.', code: 'CHECKOUT_FAILED' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
