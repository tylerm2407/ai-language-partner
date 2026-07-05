// Auth helpers for the RevenueCat webhook.
//
// Pure functions — no env access, no I/O side effects — so they can be
// unit-tested (auth.test.ts) without booting the edge function (index.ts
// calls `serve()` at import time).

const encoder = new TextEncoder();

/**
 * Constant-time string comparison.
 *
 * Compares SHA-256 digests of both inputs with a constant-time byte loop.
 * Hashing first fixes the compared length (32 bytes), so neither the
 * secret's length nor an early-exit position leaks through timing.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const ba = new Uint8Array(da);
  const bb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

export type AuthResult = 'ok' | 'unauthorized' | 'config_error';

/**
 * Validate the Authorization header against the expected shared secret.
 *
 * Fails CLOSED: a missing/empty expected secret is a `config_error`
 * (caller must return 5xx and never process the event), not a pass.
 */
export async function checkAuthorization(
  providedHeader: string | null,
  expectedSecret: string | null | undefined
): Promise<AuthResult> {
  if (!expectedSecret) return 'config_error';
  if (!providedHeader) return 'unauthorized';
  return (await timingSafeEqual(providedHeader, expectedSecret)) ? 'ok' : 'unauthorized';
}

/**
 * Verify RevenueCat's optional HMAC signature header:
 *
 *   X-RevenueCat-Webhook-Signature: t=<unix_timestamp>,v1=<hmac_sha256_hex>
 *
 * The HMAC-SHA256 is computed over `<t>.<raw_body>` (raw bytes, before any
 * JSON parsing) with the integration's signing secret. Timestamps outside
 * `toleranceSeconds` are rejected to block replay attacks.
 * https://www.revenuecat.com/docs/integrations/webhooks#webhook-signature-verification-hmac
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  signingSecret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300
): Promise<boolean> {
  if (!signatureHeader) return false;

  const parts = new Map<string, string>();
  for (const p of signatureHeader.split(',')) {
    const idx = p.indexOf('=');
    if (idx > 0) parts.set(p.slice(0, idx).trim(), p.slice(idx + 1).trim());
  }
  const t = parts.get('t');
  const v1 = parts.get('v1');
  if (!t || !v1 || !/^\d+$/.test(t) || !/^[0-9a-f]{64}$/i.test(v1)) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${t}.${rawBody}`));
  const computed = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (!(await timingSafeEqual(computed, v1.toLowerCase()))) return false;
  if (Math.abs(nowSeconds - Number(t)) > toleranceSeconds) return false;
  return true;
}

// Supabase auth user ids are UUIDs. RevenueCat anonymous ids
// ($RCAnonymousID:...) and arbitrary attacker strings must never reach the DB.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if `value` is a plausible UUID (8-4-4-4-12 hex). */
export function isPlausibleUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
