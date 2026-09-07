import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  TUTOR_CENTS_PER_MINUTE,
  TUTOR_SESSION_FIXED_CENTS,
  TUTOR_MAX_SESSION_SECONDS,
  TUTOR_MIN_SESSION_SECONDS,
  centsForSeconds,
  secondsAffordable,
  resolveGrant,
  settlement,
} from './tutor-pricing.ts';

Deno.test('a reservation always rounds up, so the ceiling never leaks a fraction', () => {
  // 10 minutes at 12c/min is 120c, plus the one-off analysis cent.
  assertEquals(centsForSeconds(600), 121);
  // One second past a whole minute must cost a whole extra cent, not 0.2 of one.
  assert(centsForSeconds(601) > centsForSeconds(600));
});

Deno.test('a zero-length session still costs the analysis cent', () => {
  // The end-of-session Haiku call runs regardless of how long they spoke, so
  // the fixed cost is not conditional on there being any audio.
  assertEquals(centsForSeconds(0), TUTOR_SESSION_FIXED_CENTS);
  assertEquals(centsForSeconds(-5), TUTOR_SESSION_FIXED_CENTS);
  assertEquals(centsForSeconds(Number.NaN), TUTOR_SESSION_FIXED_CENTS);
});

Deno.test('a session sized to the budget is always affordable within it', () => {
  // THE load-bearing invariant. If this ever fails, resolveGrant can hand out a
  // session that costs more than the ceiling it was sized against, and the
  // spend ceiling silently stops being a ceiling.
  for (let cents = 0; cents <= 2000; cents++) {
    const seconds = secondsAffordable(cents);
    if (seconds > 0) {
      assert(
        centsForSeconds(seconds) <= cents,
        `secondsAffordable(${cents}) = ${seconds} costs ${centsForSeconds(seconds)}`,
      );
    }
  }
});

Deno.test('a budget too small to cover even the fixed cost buys nothing', () => {
  assertEquals(secondsAffordable(TUTOR_SESSION_FIXED_CENTS), 0);
  assertEquals(secondsAffordable(0), 0);
  assertEquals(secondsAffordable(-100), 0);
});

Deno.test('the grant is bounded by whichever ceiling actually binds', () => {
  // Plenty of both: capped by the per-session ceiling, not by budget.
  const roomy = resolveGrant({ dailySecondsRemaining: 99999, monthlyCentsRemaining: 99999 });
  assertEquals(roomy.seconds, TUTOR_MAX_SESSION_SECONDS);
  assertEquals(roomy.reason, 'ok');

  // Daily is the tighter one.
  const dayBound = resolveGrant({ dailySecondsRemaining: 300, monthlyCentsRemaining: 99999 });
  assertEquals(dayBound.seconds, 300);
  assertEquals(dayBound.reason, 'ok');

  // Monthly is the tighter one.
  const monthBound = resolveGrant({ dailySecondsRemaining: 99999, monthlyCentsRemaining: 61 });
  assertEquals(monthBound.seconds, secondsAffordable(61));
  assertEquals(monthBound.reason, 'ok');
});

Deno.test('a caller cannot request more than the per-session ceiling', () => {
  const r = resolveGrant({
    dailySecondsRemaining: 99999,
    monthlyCentsRemaining: 99999,
    requestedSeconds: 99999,
  });
  assertEquals(r.seconds, TUTOR_MAX_SESSION_SECONDS);
});

Deno.test('a stub session is refused rather than granted', () => {
  // Worse than not starting: the learner spends their remaining allowance AND
  // gets cut off mid-conversation.
  const r = resolveGrant({ dailySecondsRemaining: 30, monthlyCentsRemaining: 99999 });
  assertEquals(r.seconds, 0);
  assertEquals(r.cents, 0);
  assertEquals(r.reason, 'daily');
});

Deno.test('exhaustion names the binding ceiling, because the copy differs', () => {
  // Monthly does not reset tonight, so when both are gone it is the more
  // informative thing to tell the learner.
  const both = resolveGrant({ dailySecondsRemaining: 0, monthlyCentsRemaining: 0 });
  assertEquals(both.reason, 'monthly');

  const dayOnly = resolveGrant({ dailySecondsRemaining: 0, monthlyCentsRemaining: 99999 });
  assertEquals(dayOnly.reason, 'daily');
});

Deno.test('a grant that is used in full refunds nothing', () => {
  const g = resolveGrant({ dailySecondsRemaining: 99999, monthlyCentsRemaining: 99999 });
  const s = settlement(g.seconds, g.cents, g.seconds);
  assertEquals(s.refundSeconds, 0);
  assertEquals(s.refundCents, 0);
});

Deno.test('an abandoned session refunds everything after the last heartbeat', () => {
  const granted = 1200;
  const cents = centsForSeconds(granted);
  // The learner force-killed the app five minutes in.
  const s = settlement(granted, cents, 300);
  assertEquals(s.observedSeconds, 300);
  assertEquals(s.refundSeconds, 900);
  assertEquals(s.refundCents, cents - centsForSeconds(300));
  assert(s.refundCents > 0);
});

Deno.test('settlement can never charge more than was reserved', () => {
  // A client reporting a wild duration, a clock skew, or a double-settle must
  // not be able to turn a refund into an extra charge.
  const granted = 600;
  const cents = centsForSeconds(granted);
  const overrun = settlement(granted, cents, 999999);
  assertEquals(overrun.observedSeconds, granted);
  assertEquals(overrun.refundSeconds, 0);
  assertEquals(overrun.refundCents, 0);

  const negative = settlement(granted, cents, -50);
  assertEquals(negative.observedSeconds, 0);
  assertEquals(negative.refundSeconds, granted);
  assert(negative.refundCents >= 0);
});

Deno.test('the published plan ceilings resolve to the minutes the plans are sold on', () => {
  // These are the numbers on the pricing page. If this test fails, either the
  // rate changed or migration 109's tier literals did, and the two must agree.
  const monthlyMinutes = (cents: number) => Math.floor(secondsAffordable(cents) / 60);
  assertEquals(monthlyMinutes(300), 24);   // basic
  assertEquals(monthlyMinutes(800), 66);   // premium
  assertEquals(monthlyMinutes(1400), 116); // vip
  assertEquals(TUTOR_CENTS_PER_MINUTE, 12);
  assertEquals(TUTOR_MIN_SESSION_SECONDS, 60);
});
