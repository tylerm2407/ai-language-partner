// Supabase Edge Function: Stripe Webhook Handler
// Handles subscription lifecycle events from Stripe.
// Deploy: npx supabase functions deploy stripe-webhook
// Set STRIPE_WEBHOOK_SECRET in Supabase secrets after configuring webhook in Stripe Dashboard.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return new Response(`Webhook Error: ${error.message}`, { status: 400 });
  }
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id;
  if (!userId) return;

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  // Fetch the subscription to get the plan details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id;
  const tier = determineTier(priceId);

  await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      tier,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      is_active: true,
    },
    { onConflict: 'user_id' }
  );
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const tier = determineTier(priceId);
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

  await supabase
    .from('subscriptions')
    .update({
      tier,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      is_active: isActive,
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await supabase
    .from('subscriptions')
    .update({
      tier: 'free',
      is_active: false,
      current_period_end: null,
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  // Mark subscription as inactive on payment failure
  await supabase
    .from('subscriptions')
    .update({ is_active: false })
    .eq('stripe_subscription_id', subscriptionId);
}

function determineTier(priceId: string | undefined): string {
  if (!priceId) return 'free';

  const BASIC_MONTHLY = Deno.env.get('STRIPE_BASIC_MONTHLY_PRICE_ID');
  const BASIC_YEARLY = Deno.env.get('STRIPE_BASIC_YEARLY_PRICE_ID');
  const PREMIUM_MONTHLY = Deno.env.get('STRIPE_PREMIUM_MONTHLY_PRICE_ID');
  const PREMIUM_YEARLY = Deno.env.get('STRIPE_PREMIUM_YEARLY_PRICE_ID');
  const UNLIMITED_MONTHLY = Deno.env.get('STRIPE_UNLIMITED_MONTHLY_PRICE_ID');
  const UNLIMITED_YEARLY = Deno.env.get('STRIPE_UNLIMITED_YEARLY_PRICE_ID');

  if (priceId === BASIC_MONTHLY || priceId === BASIC_YEARLY) return 'basic';
  if (priceId === PREMIUM_MONTHLY || priceId === PREMIUM_YEARLY) return 'premium';
  if (priceId === UNLIMITED_MONTHLY || priceId === UNLIMITED_YEARLY) return 'unlimited';
  return 'basic'; // default to basic for unknown price IDs
}
