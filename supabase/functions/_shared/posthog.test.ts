import { assertEquals, assertRejects } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { capturePostHogEvent, deterministicEventUuid } from './posthog.ts';

const EVENT = {
  event: 'subscription_started',
  distinctId: 'user-123',
  insertId: 'revenuecat:event-123:subscription_started',
  properties: { tier: 'premium', amount: 9.99 },
};

Deno.test('capturePostHogEvent sends the public capture contract with stable identity', async () => {
  let requestUrl = '';
  let requestBody = '';
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requestUrl = request.url;
    requestBody = await request.text();
    return Promise.resolve(new Response('{}', { status: 200 }));
  };

  const result = await capturePostHogEvent(
    EVENT,
    { apiKey: 'phc_project', host: 'https://eu.i.posthog.com' },
    fetcher,
  );
  assertEquals(result, 'captured');
  assertEquals(requestUrl, 'https://eu.i.posthog.com/i/v0/e/');
  const body = JSON.parse(requestBody);
  assertEquals(body, {
    api_key: 'phc_project',
    uuid: await deterministicEventUuid(EVENT.insertId),
    event: 'subscription_started',
    distinct_id: 'user-123',
    properties: {
      tier: 'premium',
      amount: 9.99,
      $insert_id: 'revenuecat:event-123:subscription_started',
      source: 'server_webhook',
    },
  });
});

Deno.test('capturePostHogEvent is a no-op when the project token is absent', async () => {
  let called = false;
  const result = await capturePostHogEvent(EVENT, {}, () => {
    called = true;
    return Promise.resolve(new Response('{}'));
  });
  assertEquals(result, 'disabled');
  assertEquals(called, false);
});

Deno.test('capturePostHogEvent rejects configured ingestion failures for webhook retry', async () => {
  await assertRejects(
    () => capturePostHogEvent(EVENT, { apiKey: 'phc_project' }, () =>
      Promise.resolve(new Response('unavailable', { status: 503 }))),
    Error,
    'PostHog capture failed (503)',
  );
});

Deno.test('capturePostHogEvent rejects insecure hosts', async () => {
  await assertRejects(
    () => capturePostHogEvent(EVENT, {
      apiKey: 'phc_project',
      host: 'http://posthog.internal',
    }),
    Error,
    'must use HTTPS',
  );
});
