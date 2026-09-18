// App Store Server API: extend one subscription's renewal date.
//
// https://developer.apple.com/documentation/appstoreserverapi/extend-a-subscription-renewal-date
//   PUT /inApps/v1/subscriptions/extend/{originalTransactionId}
//   body { extendByDays: 1..90, extendReasonCode: 0..3, requestIdentifier }
// At most two extensions per subscription per 365 days (the claim RPC counts
// them). The request identifier is our delivery id, so a retry of the same
// delivery is the same request as far as Apple is concerned.
//
// Auth is an ES256 JWT signed with an App Store Connect key (an In-App
// Purchase key is the least-privileged kind). WebCrypto's ECDSA signature is
// already the raw r||s form a JWS wants, so no DER conversion is needed.

export interface AppleServerKey {
  keyId: string;
  issuerId: string;
  bundleId: string;
  /** PKCS#8 PEM, as downloaded (.p8). Literal "\n" sequences are accepted. */
  privateKeyPem: string;
}

/** Reason code 1: "for customer satisfaction". */
export const EXTEND_REASON_CUSTOMER_SATISFACTION = 1;

const HOSTS = {
  PRODUCTION: 'https://api.storekit.apple.com',
  SANDBOX: 'https://api.storekit-sandbox.apple.com',
} as const;

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonPart(value: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

export function pemToPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function appStoreServerJwt(key: AppleServerKey, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const header = jsonPart({ alg: 'ES256', kid: key.keyId, typ: 'JWT' });
  const payload = jsonPart({
    iss: key.issuerId,
    iat: nowSeconds,
    exp: nowSeconds + 600,
    aud: 'appstoreconnect-v1',
    bid: key.bundleId,
  });
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(key.privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${base64url(new Uint8Array(signature))}`;
}

export interface ExtendResult {
  ok: boolean;
  /** New expiry (ms) on success; Apple's error code or HTTP status otherwise. */
  detail: string;
}

export async function extendRenewalDate(
  key: AppleServerKey,
  args: { originalTransactionId: string; days: number; requestIdentifier: string; environment: string | null },
  fetcher: typeof fetch = fetch,
): Promise<ExtendResult> {
  const host = args.environment === 'SANDBOX' ? HOSTS.SANDBOX : HOSTS.PRODUCTION;
  const response = await fetcher(
    `${host}/inApps/v1/subscriptions/extend/${encodeURIComponent(args.originalTransactionId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${await appStoreServerJwt(key)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extendByDays: args.days,
        extendReasonCode: EXTEND_REASON_CUSTOMER_SATISFACTION,
        requestIdentifier: args.requestIdentifier,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON error page; the status is all we keep.
  }
  if (response.ok && body.success === true) {
    return { ok: true, detail: String(body.effectiveDate ?? '') };
  }
  return { ok: false, detail: `apple ${response.status} ${String(body.errorCode ?? '')}`.trim() };
}
