import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import {
  handleCORS, verifyAuth, checkRateLimit,
  jsonResponse, errorResponse, log, requireString, HttpError, getSafeOrigin,
} from "../_shared/middleware.ts";

const FN = "create-checkout";

// Whitelist of allowed Stripe price IDs — must match src/lib/plan.ts STRIPE_TIERS
const ALLOWED_PRICE_IDS = new Set([
  "price_1TAZ7YAmUZkn8na4NDsEPHUV", // Basic $9.99/mo
  "price_1TAZ7qAmUZkn8na4iZatbbL6", // Pro $24.99/mo
  "price_1TAZ98AmUZkn8na4lOhS6Pdh", // VIP $29.99/mo
]);

serve(async (req) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  try {
    const user = await verifyAuth(req);
    checkRateLimit(user.id, 5, 60_000);
    log(FN, "authenticated", { userId: user.id });

    const body = await req.json();
    const priceId = requireString(body.priceId, "priceId", 200);

    if (!ALLOWED_PRICE_IDS.has(priceId)) {
      throw new HttpError(400, "Invalid price ID");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      log(FN, "missing_stripe_key");
      return jsonResponse({ error: "Service unavailable" }, 503);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const allowedOrigin = getSafeOrigin();

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${allowedOrigin}/dashboard?checkout=success`,
      cancel_url: `${allowedOrigin}/pricing?checkout=cancelled`,
    });

    log(FN, "session_created", { sessionId: session.id });
    return jsonResponse({ url: session.url });

  } catch (err) {
    return errorResponse(err);
  }
});
