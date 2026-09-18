import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  TIER_WORDS,
  TUTOR_PACKS,
  packForProductId,
  packProductIdsAreSafe,
} from './tutor-packs.ts';
import { resolveTier } from '../revenuecat-webhook/tier.ts';

Deno.test('no pack product id can be mistaken for a subscription tier', () => {
  // This is the whole reason the module exists. `resolveTier` substring-matches
  // on vip/premium/basic, so a pack called `vip_minutes_30` would grant a
  // $29.99 subscription for a $6.99 purchase — and nothing about it would look
  // broken from the RevenueCat dashboard.
  assert(packProductIdsAreSafe(), 'a pack id contains a tier word');

  for (const pack of TUTOR_PACKS) {
    assertEquals(
      resolveTier([], pack.productId),
      'starter',
      `${pack.productId} resolves to a paid tier — rename it`,
    );
  }
});

Deno.test('the tier words are the ones tier.ts actually matches on', () => {
  // If TIER_PRECEDENCE ever grows a tier, the guard above silently stops
  // covering it. Pin the two lists together.
  for (const word of TIER_WORDS) {
    assertEquals(resolveTier([], `something_${word}_yearly`), word);
  }
});

Deno.test('packs are looked up by exact id, never by prefix', () => {
  assertEquals(packForProductId('fluenci_tutor_pack_75')?.seconds, 4500);
  assertEquals(packForProductId('fluenci_tutor_pack_7'), null);
  assertEquals(packForProductId('fluenci_tutor_pack_75_extra'), null);
  assertEquals(packForProductId(null), null);
  assertEquals(packForProductId(''), null);
});

Deno.test('minutes and seconds never disagree', () => {
  for (const pack of TUTOR_PACKS) {
    assertEquals(pack.seconds, pack.minutes * 60, `${pack.productId} is inconsistent`);
  }
});

Deno.test('the largest pack stays under a VIP month, so it reads as a top-up', () => {
  // A pack at or above the monthly entitlement is a shadow plan, not a
  // supplement. 155 is tutorMinutesPerMonth('vip') at the current booked rate —
  // if that rises again, re-check this rather than assuming headroom.
  const VIP_MINUTES_PER_MONTH = 155;
  const largest = Math.max(...TUTOR_PACKS.map((p) => p.minutes));
  assert(
    largest < VIP_MINUTES_PER_MONTH,
    `largest pack (${largest} min) must stay under the ${VIP_MINUTES_PER_MONTH}-minute VIP month`,
  );
});

Deno.test('the ladder only ever gets bigger, so a pack id cannot be misread', () => {
  const minutes = TUTOR_PACKS.map((p) => p.minutes);
  assertEquals([...minutes].sort((a, b) => a - b), minutes);
  assertEquals(new Set(minutes).size, minutes.length);
});
