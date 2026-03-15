import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import {
  handleCORS, verifyAuth, checkRateLimit,
  jsonResponse, errorResponse, log, getAdminClient,
} from "../_shared/middleware.ts";

const FN = "check-subscription";

serve(async (req) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  try {
    const user = await verifyAuth(req);
    checkRateLimit(user.id, 10, 60_000);
    log(FN, "authenticated", { userId: user.id });

    const db = getAdminClient();

    // Fast path: check cached subscription on profile first
    const { data: profile } = await db.from("profiles")
      .select("subscription_plan, subscription_expires_at")
      .eq("id", user.id)
      .single();

    if (profile?.subscription_plan && profile?.subscription_expires_at) {
      const expiresAt = new Date(profile.subscription_expires_at);
      if (expiresAt > new Date()) {
        log(FN, "cache_hit", { plan: profile.subscription_plan });
        return jsonResponse({
          subscribed: true,
          product_id: profile.subscription_plan,
          subscription_end: profile.subscription_expires_at,
        });
      }
    }

    // Slow path: query Stripe directly
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      log(FN, "missing_stripe_key");
      return jsonResponse({ error: "Service unavailable" }, 503);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      log(FN, "no_customer");
      return jsonResponse({ subscribed: false });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId, status: "active", limit: 1,
    });

    if (subscriptions.data.length === 0) {
      log(FN, "no_active_sub");
      await db.from("profiles").update({
        subscription_plan: null, subscription_expires_at: null,
      }).eq("id", user.id).then(() => {}, () => {});
      return jsonResponse({ subscribed: false });
    }

    const sub = subscriptions.data[0];
    const productId = typeof sub.items.data[0].price.product === "string"
      ? sub.items.data[0].price.product
      : (sub.items.data[0].price.product as any)?.id ?? null;

    let subscriptionEnd: string | null = null;
    const endTs = sub.current_period_end;
    if (typeof endTs === "number" && endTs > 0) {
      subscriptionEnd = new Date(endTs * 1000).toISOString();
    }

    // Update cache on profile
    await db.from("profiles").update({
      subscription_plan: productId,
      subscription_expires_at: subscriptionEnd,
    }).eq("id", user.id).then(() => {}, () => {});

    log(FN, "stripe_hit", { productId });
    return jsonResponse({
      subscribed: true,
      product_id: productId,
      subscription_end: subscriptionEnd,
    });

  } catch (err) {
    return errorResponse(err);
  }
});
