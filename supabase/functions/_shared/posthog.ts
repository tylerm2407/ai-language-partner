export type PostHogScalar = string | number | boolean | null;

export interface ServerAnalyticsEvent {
  event: string;
  distinctId: string;
  insertId: string;
  properties?: Record<string, PostHogScalar>;
  timestamp?: string;
}

export interface PostHogCaptureConfig {
  apiKey?: string;
  host?: string;
}

export type PostHogCaptureResult = 'captured' | 'disabled';

/** RFC 4122 version-5-shaped UUID derived from a stable business event key. */
export async function deterministicEventUuid(key: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)),
  ).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function captureUrl(host: string | undefined): string {
  const url = new URL('/i/v0/e/', host?.trim() || 'https://us.i.posthog.com');
  if (url.protocol !== 'https:') {
    throw new Error('POSTHOG_HOST must use HTTPS');
  }
  return url.toString();
}

/**
 * Capture an authoritative server event. A deterministic UUID and insert id
 * accompany every call so provider webhook retries share PostHog's actual
 * deduplication identity. Missing configuration intentionally disables
 * analytics; a configured endpoint failure throws for provider retry.
 */
export async function capturePostHogEvent(
  event: ServerAnalyticsEvent,
  config: PostHogCaptureConfig = {
    apiKey: Deno.env.get('POSTHOG_API_KEY'),
    host: Deno.env.get('POSTHOG_HOST'),
  },
  fetcher: typeof fetch = fetch,
): Promise<PostHogCaptureResult> {
  const apiKey = config.apiKey?.trim();
  if (!apiKey) return 'disabled';
  if (!event.event || !event.distinctId || !event.insertId) {
    throw new Error('PostHog event, distinctId and insertId are required');
  }
  const uuid = await deterministicEventUuid(event.insertId);

  const response = await fetcher(captureUrl(config.host), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      uuid,
      event: event.event,
      distinct_id: event.distinctId,
      properties: {
        ...event.properties,
        $insert_id: event.insertId,
        source: 'server_webhook',
      },
      ...(event.timestamp ? { timestamp: event.timestamp } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`PostHog capture failed (${response.status})`);
  }
  return 'captured';
}
