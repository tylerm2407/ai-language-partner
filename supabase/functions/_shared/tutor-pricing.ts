/**
 * What a minute of live tutor costs us, and the session shape that follows.
 *
 * This module is small and load-bearing. `TUTOR_CENTS_PER_MINUTE` is the ONLY
 * thing standing between the live tutor and an unbounded bill, because the
 * WebRTC media path runs directly between the learner's device and OpenAI: once
 * the SDP exchange completes we are not in the path, there is no request to
 * meter, and there is no connection we can close. Everything else in the
 * metering design is downstream of this one number.
 *
 * WHERE 12 COMES FROM
 *
 * gpt-realtime-mini audio is $10.00 per 1M input tokens, $0.30 per 1M CACHED
 * input tokens, and $20.00 per 1M output tokens. A minute of speech is roughly
 * 600 tokens heard and roughly 1,200 tokens generated. Modelling a balanced
 * conversation minute — the learner talking half the time, the tutor the other
 * half, and the accumulated conversation re-billed against the cached rate on
 * every model turn — lands somewhere near 2.6 cents per minute.
 *
 * Independently measured production figures for this model land far higher:
 * roughly 6.3 to 14.6 cents per minute, because prompt caching is not always
 * effective and real sessions carry more context than the model above assumes.
 *
 * 12 is deliberately set near the TOP of that measured band. A ceiling that
 * under-estimates cost is not a ceiling, and the failure mode of guessing low
 * is invisible until an invoice arrives a month later.
 *
 * THE COST OF BEING CONSERVATIVE, STATED HONESTLY
 *
 * This number does not just bound spend — it divides the monthly cent ceiling
 * into the minutes a learner is granted. If the true cost turns out to be 6
 * cents, then every learner is being given HALF the tutor time their plan
 * actually pays for. So this is not a free safety margin: it is minutes taken
 * from paying learners in exchange for certainty.
 *
 * RECONCILE IT AGAINST THE FIRST REAL OPENAI INVOICE, then lower it. Compare
 * billed spend against SUM(observed_seconds) from public.tutor_sessions over
 * the same window. Lowering this constant increases delivered minutes at
 * IDENTICAL margin, which is the cheapest product win available here.
 */

/**
 * Cents per minute of live tutor session. See the derivation above.
 *
 * Changing this silently changes how many minutes every plan grants, because
 * the monthly ceiling is denominated in cents and divided by this. Do not tune
 * it without re-reading the plan table in the migration 109 header.
 */
export const TUTOR_CENTS_PER_MINUTE = 12;

/**
 * Charged once per session regardless of length.
 *
 * At the end of every session one Anthropic Haiku call analyses the whole
 * transcript to produce corrections, SRS vocabulary, memory notes and the
 * written debrief. It costs roughly a cent and it does NOT scale with session
 * length, so folding it into the per-minute rate would over-charge long
 * sessions and under-charge short ones.
 *
 * It is counted here rather than left uncounted because an AI call nobody
 * meters is exactly the hole migration 103 was written to close.
 */
export const TUTOR_SESSION_FIXED_CENTS = 1;

/** The model. Pinned to a dated snapshot, not the floating `gpt-realtime-mini`
 *  alias, so a silent upstream swap cannot change either cost or behaviour
 *  mid-month. Server-side only — the client is TOLD the model, it never picks
 *  one. */
export const TUTOR_MODEL = 'gpt-realtime-mini-2025-12-15';

/**
 * How much conversation the model is asked to re-read on every turn.
 *
 * THE REALTIME API RE-SENDS THE WHOLE CONVERSATION AS INPUT ON EVERY RESPONSE.
 * OpenAI say so plainly, and add that prompt caching is "best-effort and not
 * guaranteed" with no published hit rate. Uncached, that makes cost per minute
 * GROW INSIDE a session rather than stay flat: at the shape this tutor runs,
 * the first minute of a session bills around 0.7 cents and the twentieth
 * around 31.5 — roughly forty-five times more for the same minute of speech.
 *
 * Setting these two fields converts that curve into a flat rate. It is the
 * difference between hoping the cache works and bounding what happens when it
 * does not.
 *
 * WHY THE LIMIT IS LARGE RATHER THAN SMALL, WHICH IS THE COUNTERINTUITIVE PART
 *
 * A bigger context cap is CHEAPER here. Truncation drops the oldest messages,
 * and dropping them busts the prefix cache — the retained remainder is re-billed
 * cold at the uncached rate. So the cost is driven by how OFTEN truncation
 * fires, not by how much context is carried between firings.
 *
 * A twenty-minute session accumulates only about 16,000 tokens in total. At
 * 12,000 truncation fires roughly ONCE, near minute fifteen. At 8,000 it fires
 * three times, and at 4,000 about four — each one a fresh cold re-bill. Modelled
 * against published prices that is ~2.9 cents/minute here versus ~3.4 at either
 * smaller limit, and the larger limit also leaves the tutor with MORE of the
 * conversation in mind. The irreducible floor is ~2.2 cents/minute, so there is
 * almost nothing left to win by tuning this further.
 *
 * `post_instructions` caps the tokens AFTER the instruction prefix, so persona,
 * level, learner context and memory notes are never what gets dropped — the
 * tutor cannot forget who it is or who it is talking to, only what was said
 * early on.
 *
 * WHAT A LOW RETENTION RATIO BUYS, AND WHAT IT COSTS
 *
 * Headroom after a truncation is `limit x (1 - ratio)`, so 0.5 leaves two and a
 * half times the room that 0.8 would before the next firing. OpenAI's own
 * guidance is that "if truncation occurs on every turn then cache rate will be
 * very low", and dropping more than strictly necessary is how you avoid that.
 * The price is memory depth immediately after a firing, not money.
 *
 * These are set server-side in the minted session and the client has no way to
 * change them: `lib/realtime-events.ts` defines the entire client-side event
 * vocabulary and `session.update` is not in it.
 */
export const TUTOR_CONTEXT_TOKEN_LIMIT = 12000;

/** See `TUTOR_CONTEXT_TOKEN_LIMIT`. Lower is cheaper and shallower. */
export const TUTOR_CONTEXT_RETENTION_RATIO = 0.5;

/** Hard ceiling on a single session, independent of budget. Twenty minutes is
 *  a long conversation in a second language; past that the value per minute
 *  falls and the risk of a forgotten open tab rises.
 *
 *  Note this also bounds the context growth described above: it is why
 *  `TUTOR_CONTEXT_TOKEN_LIMIT` can sit above a whole session's accumulation. */
export const TUTOR_MAX_SESSION_SECONDS = 1200;

/**
 * Below this, refuse to start rather than granting a stub.
 *
 * A tutor session that ends after forty seconds is worse than one that never
 * started: the learner has spent their remaining allowance AND been cut off
 * mid-conversation. Refusing up front lets us say something useful instead.
 */
export const TUTOR_MIN_SESSION_SECONDS = 60;

/** How often the client reports in. Also bounds what an app kill can cost —
 *  see TUTOR_REAP_AFTER_SECONDS. */
export const TUTOR_HEARTBEAT_SECONDS = 20;

/**
 * How stale a heartbeat must be before the reaper settles the session.
 *
 * Deliberately several heartbeats, not one: a phone that briefly loses signal
 * mid-conversation must not have its session reaped out from under it. The
 * learner-visible consequence of this number is the maximum budget a hard app
 * kill can cost them, so it trades robustness against fairness.
 */
export const TUTOR_REAP_AFTER_SECONDS = 90;

/**
 * Cents to reserve for a session of `seconds`.
 *
 * Rounds UP. Reserving is the moment we protect the ceiling, and rounding a
 * reservation down is how a ceiling leaks a fraction of a cent per session
 * forever.
 */
export function centsForSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return TUTOR_SESSION_FIXED_CENTS;
  return TUTOR_SESSION_FIXED_CENTS + Math.ceil((seconds / 60) * TUTOR_CENTS_PER_MINUTE);
}

/**
 * The longest session `cents` can pay for.
 *
 * Rounds DOWN, and is deliberately NOT the exact inverse of `centsForSeconds`
 * — the two round in opposite directions on purpose. The invariant that
 * matters, and that the tests pin, is:
 *
 *     centsForSeconds(secondsAffordable(c)) <= c   for every c
 *
 * i.e. a session sized to the remaining budget is always affordable within it.
 * The reverse composition is NOT an identity and must not be relied on.
 */
export function secondsAffordable(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  const spendable = cents - TUTOR_SESSION_FIXED_CENTS;
  if (spendable <= 0) return 0;
  return Math.floor((spendable * 60) / TUTOR_CENTS_PER_MINUTE);
}

/**
 * Resolve how long a session may run, given every ceiling at once.
 *
 * Returns 0 when no viable session is available, which callers must translate
 * into a 429 rather than a zero-length grant. `reason` names WHICH ceiling
 * bound the result so the learner can be told something true — "you have used
 * today's tutor time" and "you have used this month's" need different copy and
 * different reset dates.
 */
export function resolveGrant(input: {
  dailySecondsRemaining: number;
  monthlyCentsRemaining: number;
  /** Purchased seconds available (migration 149). Absent or 0 for every
   *  learner who has never bought a pack, which is the default. */
  creditSecondsRemaining?: number;
  requestedSeconds?: number;
}): {
  seconds: number;
  cents: number;
  reason: 'ok' | 'daily' | 'monthly' | 'none';
  fundedFrom: 'plan' | 'credits';
} {
  const requested = Math.min(
    input.requestedSeconds && input.requestedSeconds > 0
      ? input.requestedSeconds
      : TUTOR_MAX_SESSION_SECONDS,
    TUTOR_MAX_SESSION_SECONDS,
  );

  const daily = Math.max(0, Math.floor(input.dailySecondsRemaining));
  const monthly = secondsAffordable(input.monthlyCentsRemaining);
  const seconds = Math.min(requested, daily, monthly);

  // PLAN FIRST, and not merely as a courtesy: App Store guideline 3.1.1 makes
  // purchased credits non-expiring, so spending them while an included
  // allowance sits unused converts a benefit that resets into one that is gone
  // forever. It is also the refund request nobody wins.
  if (seconds >= TUTOR_MIN_SESSION_SECONDS) {
    return { seconds, cents: centsForSeconds(seconds), reason: 'ok', fundedFrom: 'plan' };
  }

  // The plan cannot seat a viable session. Purchased minutes are exempt from
  // the daily cap — they were bought outright, and the cap exists to stop a
  // learner burning a MONTH of included time in one day, which is not a thing
  // paid minutes can do.
  const credit = Math.max(0, Math.floor(input.creditSecondsRemaining ?? 0));
  const fromCredit = Math.min(requested, credit);
  if (fromCredit >= TUTOR_MIN_SESSION_SECONDS) {
    // `cents` is still computed so the session row carries a coherent
    // granted_cents for settlement to validate against. Nothing is charged to
    // monthly_usage for a credit session — see reserve_tutor_session.
    return {
      seconds: fromCredit,
      cents: centsForSeconds(fromCredit),
      reason: 'ok',
      fundedFrom: 'credits',
    };
  }

  // Name the BINDING constraint, not merely the smaller number: when both are
  // exhausted the monthly one is the more informative thing to say, because
  // it does not reset tonight.
  if (monthly < TUTOR_MIN_SESSION_SECONDS) {
    return { seconds: 0, cents: 0, reason: 'monthly', fundedFrom: 'plan' };
  }
  if (daily < TUTOR_MIN_SESSION_SECONDS) {
    return { seconds: 0, cents: 0, reason: 'daily', fundedFrom: 'plan' };
  }
  return { seconds: 0, cents: 0, reason: 'none', fundedFrom: 'plan' };
}

/**
 * What to refund at settlement, given what was reserved and what was observed.
 *
 * `observed` is always a SERVER measurement — `now()` on an honest end, or
 * `last_heartbeat_at` in the reaper. The client's own elapsed figure is logged
 * for drift observability and never billed, because a client that can report
 * its own usage can report zero.
 */
export function settlement(grantedSeconds: number, grantedCents: number, observedSeconds: number): {
  observedSeconds: number;
  refundSeconds: number;
  refundCents: number;
} {
  const observed = Math.max(0, Math.min(grantedSeconds, Math.ceil(observedSeconds)));
  const owed = centsForSeconds(observed);
  return {
    observedSeconds: observed,
    refundSeconds: Math.max(0, grantedSeconds - observed),
    // Never negative: a settlement must not be able to CHARGE more than was
    // reserved. If it could, the ceiling would stop being a ceiling.
    refundCents: Math.max(0, grantedCents - owed),
  };
}
