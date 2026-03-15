import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import {
  handleCORS, verifyAuth, checkRateLimit,
  jsonResponse, errorResponse, log, HttpError, getSafeOrigin,
} from "../_shared/middleware.ts";

const FN = "customer-portal";

serve(async (req) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  try {
    const user = await verifyAuth(req);
    checkRateLimit(user.id, 5, 60_000);
    log(FN, "authenticated", { userId: user.id });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      log(FN, "missing_stripe_key");
      return jsonResponse({ error: "Service unavailable" }, 503);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      throw new HttpError(404, "No subscription found. Please subscribe first.");
    }

    const customerId = customers.data[0].id;
    const allowedOrigin = getSafeOrigin();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${allowedOrigin}/settings`,
    });

    log(FN, "portal_created");
    return jsonResponse({ url: portalSession.url });

  } catch (err) {
    return errorResponse(err);
  }
});
