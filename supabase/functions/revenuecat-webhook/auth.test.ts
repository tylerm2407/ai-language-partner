// Deno tests for the RevenueCat webhook auth gate (auth.ts).
//
// Run with: `deno test supabase/functions/revenuecat-webhook/auth.test.ts`
//
// We test auth.ts directly (pure module) instead of importing ./index.ts,
// which calls `serve(...)` at import time and reads env secrets — same
// pattern as tts/tts.test.ts.
//
// Status mapping in index.ts:
//   'config_error'  -> 500 (secret env unset — fail closed, log config error)
//   'unauthorized'  -> 401 (wrong or missing Authorization header)
//   'ok'            -> proceed

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  checkAuthorization,
  isPlausibleUuid,
  timingSafeEqual,
  verifyWebhookSignature,
} from './auth.ts';

// ---------------------------------------------------------------- auth gate

Deno.test('checkAuthorization: valid secret passes', async () => {
  assertEquals(await checkAuthorization('sk_test_secret', 'sk_test_secret'), 'ok');
});

Deno.test('checkAuthorization: wrong secret is unauthorized (→ 401)', async () => {
  assertEquals(await checkAuthorization('sk_wrong', 'sk_test_secret'), 'unauthorized');
});

Deno.test('checkAuthorization: missing header is unauthorized (→ 401)', async () => {
  assertEquals(await checkAuthorization(null, 'sk_test_secret'), 'unauthorized');
});

Deno.test('checkAuthorization: unset secret env fails CLOSED (→ 500)', async () => {
  assertEquals(await checkAuthorization('anything', undefined), 'config_error');
  assertEquals(await checkAuthorization('anything', null), 'config_error');
  // Empty string secret must also fail closed — even if the header is empty too.
  assertEquals(await checkAuthorization('', ''), 'config_error');
});

Deno.test('timingSafeEqual: equal and unequal strings (incl. length mismatch)', async () => {
  assert(await timingSafeEqual('abc', 'abc'));
  assert(!(await timingSafeEqual('abc', 'abd')));
  assert(!(await timingSafeEqual('abc', 'abcd')));
  assert(!(await timingSafeEqual('', 'a')));
});

// ------------------------------------------------------------ HMAC signature

const SIGNING_SECRET = 'whsec_test_signing_secret';
const BODY = JSON.stringify({ event: { type: 'RENEWAL', app_user_id: 'u' } });

async function sign(body: string, secret: string, ts: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${body}`));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `t=${ts},v1=${hex}`;
}

Deno.test('verifyWebhookSignature: valid signature passes', async () => {
  const now = 1_700_000_000;
  const header = await sign(BODY, SIGNING_SECRET, now);
  assert(await verifyWebhookSignature(BODY, header, SIGNING_SECRET, now));
});

Deno.test('verifyWebhookSignature: wrong secret fails', async () => {
  const now = 1_700_000_000;
  const header = await sign(BODY, 'whsec_other', now);
  assert(!(await verifyWebhookSignature(BODY, header, SIGNING_SECRET, now)));
});

Deno.test('verifyWebhookSignature: tampered body fails', async () => {
  const now = 1_700_000_000;
  const header = await sign(BODY, SIGNING_SECRET, now);
  const tampered = BODY.replace('RENEWAL', 'INITIAL_PURCHASE');
  assert(!(await verifyWebhookSignature(tampered, header, SIGNING_SECRET, now)));
});

Deno.test('verifyWebhookSignature: stale timestamp fails (replay)', async () => {
  const then = 1_700_000_000;
  const header = await sign(BODY, SIGNING_SECRET, then);
  assert(!(await verifyWebhookSignature(BODY, header, SIGNING_SECRET, then + 301)));
  // Inside tolerance still passes.
  assert(await verifyWebhookSignature(BODY, header, SIGNING_SECRET, then + 299));
});

Deno.test('verifyWebhookSignature: missing/malformed header fails', async () => {
  const now = 1_700_000_000;
  assert(!(await verifyWebhookSignature(BODY, null, SIGNING_SECRET, now)));
  assert(!(await verifyWebhookSignature(BODY, '', SIGNING_SECRET, now)));
  assert(!(await verifyWebhookSignature(BODY, 't=abc,v1=deadbeef', SIGNING_SECRET, now)));
  assert(!(await verifyWebhookSignature(BODY, `t=${now}`, SIGNING_SECRET, now)));
  assert(!(await verifyWebhookSignature(BODY, `t=${now},v1=nothex`, SIGNING_SECRET, now)));
});

// ------------------------------------------------------------------- UUIDs

Deno.test('isPlausibleUuid: accepts Supabase-style UUIDs, rejects everything else', () => {
  assert(isPlausibleUuid('c56a4180-65aa-42ec-a945-5fd21dec0538'));
  assert(isPlausibleUuid('C56A4180-65AA-42EC-A945-5FD21DEC0538'));
  assert(!isPlausibleUuid('$RCAnonymousID:87c6049c58069238dce29853f60e277c'));
  assert(!isPlausibleUuid('not-a-uuid'));
  assert(!isPlausibleUuid(''));
  assert(!isPlausibleUuid(null));
  assert(!isPlausibleUuid(42));
  assert(!isPlausibleUuid("c56a4180-65aa-42ec-a945-5fd21dec0538'; DROP TABLE subscriptions;--"));
});
