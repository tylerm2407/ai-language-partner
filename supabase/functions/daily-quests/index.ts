import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  handleCORS, verifyAuth, checkRateLimit,
  jsonResponse, errorResponse, log, getAdminClient,
} from "../_shared/middleware.ts";

const FN = "daily-quests";

serve(async (req) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  try {
    const user = await verifyAuth(req);
    checkRateLimit(user.id, 10, 60_000);
    log(FN, "authenticated", { userId: user.id });

    const db = getAdminClient();
    const body = await req.json().catch(() => ({}));
    const action = body.action || "get";

    if (action === "get") {
      // Generate or fetch today's quests
      const { data: quests, error } = await db.rpc("generate_daily_quests", {
        p_user_id: user.id,
      });

      if (error) {
        log(FN, "generate_error", { error: error.message });
        return jsonResponse({ error: "Failed to generate quests" }, 500);
      }

      log(FN, "quests_fetched", { count: quests?.length });
      return jsonResponse({ quests: quests || [] });
    }

    if (action === "update") {
      // Update quest progress — validate inputs
      const questId = typeof body.quest_id === "string" && /^[0-9a-f-]{36}$/.test(body.quest_id) ? body.quest_id : null;
      const rawDelta = typeof body.progress_delta === "number" ? body.progress_delta : 1;
      const progressDelta = Math.max(1, Math.min(rawDelta, 10)); // Clamp 1-10

      if (!questId) return jsonResponse({ error: "quest_id must be a valid UUID" }, 400);

      const { data: quest } = await db.from("daily_quests")
        .select("*")
        .eq("id", questId)
        .eq("user_id", user.id)
        .single();

      if (!quest) return jsonResponse({ error: "Quest not found" }, 404);
      if (quest.completed) return jsonResponse({ quest, already_completed: true });

      const newValue = Math.min(quest.current_value + progressDelta, quest.target_value);
      const completed = newValue >= quest.target_value;

      await db.from("daily_quests").update({
        current_value: newValue,
        completed,
      }).eq("id", questId);

      // Award rewards on completion
      if (completed && !quest.completed) {
        // Increment gems via raw SQL (Supabase JS doesn't support increment natively)
        if (quest.gem_reward > 0) {
          await db.rpc("add_gems", { p_user_id: user.id, p_amount: quest.gem_reward });

          await db.from("gem_transactions").insert({
            user_id: user.id,
            amount: quest.gem_reward,
            reason: "quest_completion",
            metadata: { quest_type: quest.quest_type, quest_id: questId },
          });
        }

        if (quest.xp_reward > 0) {
          await db.rpc("add_xp", { p_user_id: user.id, p_xp_amount: quest.xp_reward });

        log(FN, "quest_completed", { questType: quest.quest_type, gems: quest.gem_reward });
      }

      return jsonResponse({
        quest: { ...quest, current_value: newValue, completed },
        just_completed: completed && !quest.completed,
      });
    }

    return jsonResponse({ error: "Invalid action" }, 400);

  } catch (err) {
    return errorResponse(err);
  }
});
