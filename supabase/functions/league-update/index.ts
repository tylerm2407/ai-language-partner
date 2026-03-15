import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  handleCORS, jsonResponse, errorResponse, log, getAdminClient, verifyCronAuth,
} from "../_shared/middleware.ts";

const FN = "league-update";

const LEAGUES = ["bronze", "silver", "gold", "diamond", "legendary"] as const;
const PROMOTION_THRESHOLD = 0.2; // Top 20% get promoted
const DEMOTION_THRESHOLD = 0.2;  // Bottom 20% get demoted

serve(async (req) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  try {
    verifyCronAuth(req);

    const db = getAdminClient();
    const weekStart = getWeekStart();

    log(FN, "processing_week", { weekStart });

    // Process each league
    for (const league of LEAGUES) {
      const { data: users } = await db.from("profiles")
        .select("id, league_xp")
        .eq("league", league)
        .order("league_xp", { ascending: false });

      if (!users || users.length === 0) continue;

      const total = users.length;
      const promoteCount = Math.max(1, Math.floor(total * PROMOTION_THRESHOLD));
      const demoteCount = Math.max(1, Math.floor(total * DEMOTION_THRESHOLD));
      const leagueIdx = LEAGUES.indexOf(league);

      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        const rank = i + 1;
        let promoted = false;
        let demoted = false;
        let newLeague = league;

        // Top performers get promoted (unless already legendary)
        if (rank <= promoteCount && leagueIdx < LEAGUES.length - 1 && u.league_xp > 0) {
          newLeague = LEAGUES[leagueIdx + 1];
          promoted = true;
        }
        // Bottom performers get demoted (unless already bronze)
        else if (rank > total - demoteCount && leagueIdx > 0 && u.league_xp === 0) {
          newLeague = LEAGUES[leagueIdx - 1];
          demoted = true;
        }

        // Record history
        await db.from("league_history").upsert({
          user_id: u.id,
          league,
          week_start: weekStart,
          week_xp: u.league_xp,
          final_rank: rank,
          promoted,
          demoted,
        }, { onConflict: "user_id,week_start" });

        // Update league and reset weekly XP
        await db.from("profiles").update({
          league: newLeague,
          league_xp: 0,
        }).eq("id", u.id);
      }

      log(FN, "league_processed", { league, users: total, promoted: promoteCount });
    }

    log(FN, "complete");
    return jsonResponse({ success: true, week_start: weekStart });

  } catch (err) {
    return errorResponse(err);
  }
});

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const diff = now.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setUTCDate(diff));
  return monday.toISOString().split("T")[0];
}
