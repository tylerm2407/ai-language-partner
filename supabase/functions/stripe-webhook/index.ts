import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { jsonResponse, errorResponse, log, getAdminClient, HttpError } from "../_shared/middleware.ts";

const FN = "stripe-webhook";

// Product ID → plan name mapping (must match src/lib/plan.ts)
const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U8qpS7xyjtrEfU": "basic",
  "prod_U8qpnhjc9rwoec": "pro",
  "prod_U8qq8BoOQXTCm7": "vip",
};

serve(async (req) => {
  // Stripe webhooks are server-to-server — reject non-POST methods
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey || !webhookSecret) {
      throw new HttpError(503, "Webhook not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig) throw new HttpError(400, "Missing stripe-signature header");

    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    log(FN, "event_received", { type: event.type, id: event.id });

    const db = getAdminClient();

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;

        if (!customer.email) break;

        const productId = typeof sub.items.data[0].price.product === "string"
          ? sub.items.data[0].price.product
          : (sub.items.data[0].price.product as any)?.id;

        const planName = PRODUCT_TO_PLAN[productId] || productId;
        const isActive = sub.status === "active" || sub.status === "trialing";
        let expiresAt: string | null = null;

        if (typeof sub.current_period_end === "number") {
          expiresAt = new Date(sub.current_period_end * 1000).toISOString();
        }

        // Update profile cache
        const { data: profile } = await db.from("profiles")
          .select("id")
          .eq("email", customer.email)
          .single();

        if (profile) {
          await db.from("profiles").update({
            subscription_plan: isActive ? productId : null,
            subscription_tier: isActive ? planName : "free",
            subscription_expires_at: isActive ? expiresAt : null,
          }).eq("id", profile.id);

          // Upsert subscriptions table
          await db.from("subscriptions").upsert({
            user_id: profile.id,
            stripe_subscription_id: sub.id,
            stripe_customer_id: customerId,
            plan: planName,
            status: sub.status,
            current_period_end: expiresAt,
          }, { onConflict: "user_id" });

          log(FN, "profile_updated", { userId: profile.id, plan: planName, status: sub.status });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;

        if (!customer.email) break;

        const { data: profile } = await db.from("profiles")
          .select("id")
          .eq("email", customer.email)
          .single();

        if (profile) {
          await db.from("profiles").update({
            subscription_plan: null,
            subscription_tier: "free",
            subscription_expires_at: null,
          }).eq("id", profile.id);

          await db.from("subscriptions").update({
            status: "canceled",
          }).eq("user_id", profile.id);

          log(FN, "subscription_canceled", { userId: profile.id });
        }
        break;
      }

      default:
        log(FN, "unhandled_event", { type: event.type });
    }

    return jsonResponse({ received: true });

  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err);
    }
    console.error("[WEBHOOK_ERROR]", err);
    return jsonResponse({ error: "Webhook processing failed" }, 400);
  }
});
