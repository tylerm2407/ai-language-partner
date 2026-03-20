// Supabase Edge Function: AI Usage Check
// Checks a user's AI usage for the current billing period per feature
// against their subscription tier limits. Returns usage summary.
// Deploy: npx supabase functions deploy ai-usage-check

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Monthly AI request limits per feature per tier.
// These are request counts (not tokens) for simplicity.
const FEATURE_LIMITS: Record<string, Record<string, number | 'unlimited'>> = {
  free: {
    chat: 50,
    tutor_conversation: 10,
    writing_feedback: 10,
    pronunciation_feedback: 10,
  },
  basic: {
    chat: 300,
    tutor_conversation: 100,
    writing_feedback: 100,
    pronunciation_feedback: 100,
  },
  premium: {
    chat: 'unlimited',
    tutor_conversation: 500,
    writing_feedback: 500,
    pronunciation_feedback: 500,
  },
  unlimited: {
    chat: 'unlimited',
    tutor_conversation: 'unlimited',
    writing_feedback: 'unlimited',
    pronunciation_feedback: 'unlimited',
  },
};

interface UsageCheckRequest {
  userId: string;
  feature?: string; // optional: check a specific feature
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { userId, feature } = (await req.json()) as UsageCheckRequest;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user tier
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, is_active')
      .eq('user_id', userId)
      .single();

    const tier = (sub?.is_active && sub.tier) ? sub.tier : 'free';

    // Get start of current billing month (1st of month UTC)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    // Query usage counts per feature this month
    const features = feature
      ? [feature]
      : ['chat', 'tutor_conversation', 'writing_feedback', 'pronunciation_feedback'];

    const usageSummary: {
      feature: string;
      requestCount: number;
      totalTokens: number;
      limit: number | 'unlimited';
      allowed: boolean;
    }[] = [];

    for (const f of features) {
      const { data: rows } = await supabase
        .from('ai_usage_ledger')
        .select('tokens_used')
        .eq('user_id', userId)
        .eq('feature', f)
        .gte('timestamp', monthStart);

      const requestCount = rows?.length ?? 0;
      const totalTokens = (rows ?? []).reduce((sum, r) => sum + (r.tokens_used ?? 0), 0);
      const tierLimits = FEATURE_LIMITS[tier] ?? FEATURE_LIMITS.free;
      const limit = tierLimits[f] ?? 0;
      const allowed = limit === 'unlimited' || requestCount < limit;

      usageSummary.push({
        feature: f,
        requestCount,
        totalTokens,
        limit,
        allowed,
      });
    }

    return new Response(
      JSON.stringify({ tier, usageSummary }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
