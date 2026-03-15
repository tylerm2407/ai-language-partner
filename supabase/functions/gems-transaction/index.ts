import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  handleCORS, verifyAuth, checkRateLimit,
  jsonResponse, errorResponse, log, requireString, getAdminClient, HttpError,
} from "../_shared/middleware.ts";

const FN = "gems-transaction";

const VALID_PURCHASES = {
  streak_freeze: { cost: 200, description: "Streak freeze protection" },
  heart_refill: { cost: 100, description: "Refill all hearts" },
  double_xp: { cost: 150, description: "2x XP for 1 hour" },
} as const;

type PurchaseType = keyof typeof VALID_PURCHASES;

serve(async (req) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  try {
    const user = await verifyAuth(req);
    checkRateLimit(user.id, 10, 60_000);
    log(FN, "authenticated", { userId: user.id });

    const db = getAdminClient();
    const body = await req.json();
    const action = requireString(body.action, "action", 50);

    if (action === "balance") {
      const { data: profile } = await db.from("profiles")
        .select("gems, streak_freeze_count, hearts, max_hearts")
        .eq("id", user.id)
        .single();

      return jsonResponse({ balance: profile });
    }

    if (action === "purchase") {
      const purchaseType = requireString(body.purchase_type, "purchase_type", 50) as PurchaseType;
      const purchase = VALID_PURCHASES[purchaseType];

      if (!purchase) {
        throw new HttpError(400, "Invalid purchase type");
      }

      const { data: profile } = await db.from("profiles")
        .select("gems, streak_freeze_count, hearts, max_hearts")
        .eq("id", user.id)
        .single();

      if (!profile || profile.gems < purchase.cost) {
        throw new HttpError(400, "Not enough gems");
      }

      // Apply purchase effect
      const updates: Record<string, any> = {
        gems: profile.gems - purchase.cost,
      };

      if (purchaseType === "streak_freeze") {
        if (profile.streak_freeze_count >= 2) {
          throw new HttpError(400, "Maximum streak freezes reached (2)");
        }
        updates.streak_freeze_count = profile.streak_freeze_count + 1;
      } else if (purchaseType === "heart_refill") {
        updates.hearts = profile.max_hearts;
        updates.hearts_last_regen_at = new Date().toISOString();
      }

      await db.from("profiles").update(updates).eq("id", user.id);

      // Log transaction
      await db.from("gem_transactions").insert({
        user_id: user.id,
        amount: -purchase.cost,
        reason: purchaseType,
        metadata: { description: purchase.description },
      });

      log(FN, "purchase_complete", { type: purchaseType, cost: purchase.cost });
      return jsonResponse({
        success: true,
        purchase_type: purchaseType,
        gems_remaining: profile.gems - purchase.cost,
      });
    }

    if (action === "history") {
      const { data: transactions } = await db.from("gem_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      return jsonResponse({ transactions: transactions || [] });
    }

    return jsonResponse({ error: "Invalid action" }, 400);

  } catch (err) {
    return errorResponse(err);
  }
});
