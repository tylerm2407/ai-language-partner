// Run with: `deno test supabase/functions/referral-rewards/`

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { promoEndMs, runReferralDeliveries, type Delivery, type RewardDeps } from './deliver.ts';
import { appStoreServerJwt, pemToPkcs8 } from './apple.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 17);

function apple(id: string, days = 30): Delivery {
  return {
    id, referrer_id: `u-${id}`, method: 'apple_extension', days,
    original_transaction_id: '2000000000000001', environment: 'PRODUCTION', promo_end_at: null,
  };
}
function promo(id: string, days = 30, promoEnd: string | null = null): Delivery {
  return {
    id, referrer_id: `u-${id}`, method: 'revenuecat_promo', days,
    original_transaction_id: null, environment: null, promo_end_at: promoEnd,
  };
}

function deps(deliveries: Delivery[], over: Partial<RewardDeps> = {}) {
  const finished: Array<[string, boolean, string | null, string | null]> = [];
  const granted: Array<[string, number]> = [];
  const stored = new Map<string, string>();
  const d: RewardDeps = {
    appleEnabled: true,
    claim: () => Promise.resolve(deliveries),
    extendApple: () => Promise.resolve({ ok: true, detail: '1790000000000' }),
    premiumExpiryMs: () => Promise.resolve(null),
    fixPromoTarget: (id, endAt) => {
      if (!stored.has(id)) stored.set(id, endAt);
      return Promise.resolve(stored.get(id) ?? null);
    },
    grantPromo: (userId, endMs) => {
      granted.push([userId, endMs]);
      return Promise.resolve({ ok: true, detail: new Date(endMs).toISOString() });
    },
    finish: (id, ok, ref, err) => {
      finished.push([id, ok, ref, err]);
      return Promise.resolve();
    },
    now: () => NOW,
    ...over,
  };
  return { d, finished, granted, stored };
}

Deno.test('promoEndMs: starts now when there is no current access', () => {
  assertEquals(promoEndMs(null, NOW, 30), NOW + 30 * DAY);
  assertEquals(promoEndMs(NOW - DAY, NOW, 30), NOW + 30 * DAY);
});

Deno.test('promoEndMs: stacks on access that has not ended', () => {
  assertEquals(promoEndMs(NOW + 10 * DAY, NOW, 30), NOW + 40 * DAY);
});

Deno.test('run: every claimed delivery is finished, successes and failures alike', async () => {
  const { d, finished } = deps([apple('a'), apple('b')], {
    extendApple: (x) => Promise.resolve(x.id === 'a' ? { ok: true, detail: 'x' } : { ok: false, detail: 'apple 400 4030004' }),
  });
  const summary = await runReferralDeliveries(d);
  assertEquals(summary, { claimed: 2, delivered: 1, failed: 1 });
  assertEquals(finished, [['a', true, 'x', null], ['b', false, null, 'apple 400 4030004']]);
});

Deno.test('run: a thrown error is a failed delivery, not a crashed run', async () => {
  const { d, finished } = deps([apple('a'), promo('b')], {
    extendApple: () => Promise.reject(new Error('network down')),
  });
  const summary = await runReferralDeliveries(d);
  assertEquals(summary.failed, 1);
  assertEquals(summary.delivered, 1);
  assertEquals(finished[0], ['a', false, null, 'network down']);
});

Deno.test('run: promo stacks on current Premium and fixes the target before granting', async () => {
  const { d, granted, stored } = deps([promo('p', 60)], {
    premiumExpiryMs: () => Promise.resolve(NOW + 5 * DAY),
  });
  await runReferralDeliveries(d);
  assertEquals(granted, [['u-p', NOW + 65 * DAY]]);
  assertEquals(stored.get('p'), new Date(NOW + 65 * DAY).toISOString());
});

Deno.test('run: a retried promo re-sends the stored end time, never a new one', async () => {
  const fixed = new Date(NOW + 30 * DAY).toISOString();
  let looked = false;
  const { d, granted } = deps([promo('p', 30, fixed)], {
    premiumExpiryMs: () => {
      looked = true;
      return Promise.resolve(NOW + 30 * DAY); // would double the grant if used
    },
  });
  await runReferralDeliveries(d);
  assertEquals(looked, false);
  assertEquals(granted, [['u-p', NOW + 30 * DAY]]);
});

Deno.test('run: apple delivery without a transaction id fails without calling Apple', async () => {
  let called = false;
  const { d, finished } = deps([{ ...apple('a'), original_transaction_id: null }], {
    extendApple: () => {
      called = true;
      return Promise.resolve({ ok: true, detail: '' });
    },
  });
  await runReferralDeliveries(d);
  assertEquals(called, false);
  assertEquals(finished[0][1], false);
});

Deno.test('appStoreServerJwt: ES256 token that verifies against the public key', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  let bin = '';
  for (const b of pkcs8) bin += String.fromCharCode(b);
  // Stored in a secret with literal "\n" sequences, as a pasted .p8 often is.
  const pem = `-----BEGIN PRIVATE KEY-----\\n${btoa(bin)}\\n-----END PRIVATE KEY-----`;
  assertEquals(pemToPkcs8(pem), pkcs8);

  const jwt = await appStoreServerJwt({ keyId: 'KEY123', issuerId: 'iss', bundleId: 'com.fluenci.app', privateKeyPem: pem }, 1_000);
  const [h, p, s] = jwt.split('.');
  const decode = (x: string) => JSON.parse(atob(x.replace(/-/g, '+').replace(/_/g, '/')));
  assertEquals(decode(h), { alg: 'ES256', kid: 'KEY123', typ: 'JWT' });
  assertEquals(decode(p), { iss: 'iss', iat: 1_000, exp: 1_600, aud: 'appstoreconnect-v1', bid: 'com.fluenci.app' });
  const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - s.length % 4) % 4)), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, sig, new TextEncoder().encode(`${h}.${p}`),
  );
  assertEquals(valid, true);
});
