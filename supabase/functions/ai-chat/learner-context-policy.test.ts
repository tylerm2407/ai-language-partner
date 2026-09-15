// Deno tests for the entitlement boundary on the learner's onboarding goal.
//
// What is locked here:
//
//   1. `starter` — including a school-contract student with a text allowance —
//      never causes `user_profiles.ideal_l2_self` to be read.
//   2. Every paid tier does, and the answer reaches the serialised block.
//   3. The goal lands in the UNCACHED tail of the `system` array, never in
//      block 0. Block 0 is the shared cached prefix; one learner's goal inside
//      it makes the prefix unshareable for everyone, forever.
//
// index.ts is source-parsed for (3) rather than imported: it calls serve() at
// module scope, so importing it from a test would stand up an HTTP listener.
// Same approach as prompt.test.ts and streaming-contract.test.ts.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { learnerContextIncludeFor } from './learner-context-policy.ts';
import { buildSystemPrompt } from './prompt.ts';
import { fetchLearnerContext, serializeLearnerContext } from '../_shared/learner-context.ts';

const INDEX_SRC = await Deno.readTextFile(new URL('./index.ts', import.meta.url));

// ─── The gate itself ──────────────────────────────────────────────────────

Deno.test('starter never asks for the goal section', () => {
  assertEquals(learnerContextIncludeFor('starter'), []);
});

Deno.test('an unresolvable tier is not a free upgrade', () => {
  // `resolveEntitlement` fails closed to `starter`, but a caller that has lost
  // the tier entirely must not do better than one that resolved the free tier.
  for (const tier of [null, undefined, '', 'nonsense', 'STARTER', 'Basic', 'pro']) {
    assertEquals(learnerContextIncludeFor(tier), [], `tier ${String(tier)}`);
  }
});

Deno.test('every paid tier asks for the goal', () => {
  for (const tier of ['basic', 'premium', 'vip']) {
    assertEquals(learnerContextIncludeFor(tier), ['goal'], `tier ${tier}`);
  }
});

Deno.test('the goal is the only section a text turn opts into', () => {
  // `goal_track` and `pronunciation` are per-session costs the live voice
  // tutor pays; this path runs per turn. Adding either should be a decision,
  // not a drift — see the note in learner-context-policy.ts.
  assertEquals(learnerContextIncludeFor('vip'), ['goal']);
});

// ─── The gate against the real fetcher ────────────────────────────────────

/**
 * A Supabase double that records which tables were queried and answers each
 * with a fixed row set. Every builder method returns the builder so the fluent
 * chains in learner-context resolve; `then` makes the builder awaitable.
 */
function stubClient(rows: Record<string, unknown[]>) {
  const queried: string[] = [];
  const client = {
    from(table: string) {
      queried.push(table);
      const data = rows[table] ?? [];
      const builder: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) => resolve({ data, error: null }),
      };
      for (const method of ['select', 'eq', 'in', 'gte', 'lt', 'is', 'not', 'order', 'limit']) {
        builder[method] = () => builder;
      }
      return builder;
    },
  };
  return { client, queried };
}

const IDEAL_MOMENT = 'Ordering dinner with my partner in a Lyon bistro';

/** Two of the same correction — enough to clear the recurrence signal test,
 *  so the base context exists on its own merits in every case below. */
const ROWS = {
  correction_log: [
    { short_label: 'Missing gender agreement', error_type: 'grammar' },
    { short_label: 'Missing gender agreement', error_type: 'grammar' },
  ],
  user_profiles: [{ ideal_l2_self: IDEAL_MOMENT, motivation_reason: 'moving there' }],
  review_items: [],
};

Deno.test('starter: user_profiles is never read and no goal reaches the prompt', async () => {
  const { client, queried } = stubClient(ROWS);
  const ctx = await fetchLearnerContext(client, {
    userId: 'u1',
    targetLanguage: 'fr',
    include: learnerContextIncludeFor('starter'),
  });

  assert(ctx !== null, 'the base context still comes back');
  assertEquals(ctx?.goal, undefined);
  assertEquals(
    queried.includes('user_profiles'),
    false,
    'the goal query must not even be issued for an unentitled tier',
  );
  assertEquals(serializeLearnerContext(ctx).includes(IDEAL_MOMENT), false);
});

Deno.test('basic: the ideal moment is fetched and reaches the serialised block', async () => {
  const { client, queried } = stubClient(ROWS);
  const ctx = await fetchLearnerContext(client, {
    userId: 'u1',
    targetLanguage: 'fr',
    include: learnerContextIncludeFor('basic'),
  });

  assertEquals(ctx?.goal?.idealSelf, IDEAL_MOMENT);
  assert(queried.includes('user_profiles'));
  assert(serializeLearnerContext(ctx).includes(IDEAL_MOMENT));
});

Deno.test('a school-contract starter student gets turns but not the goal', async () => {
  // The case the strict gate exists for: `dailyTextMessages > 0` via the org's
  // contract_config, tier still `starter`. index.ts fetches the base context
  // (the allowance paid for it) with an empty include list.
  const { client, queried } = stubClient(ROWS);
  const ctx = await fetchLearnerContext(client, {
    userId: 'student',
    targetLanguage: 'fr',
    include: learnerContextIncludeFor('starter'),
  });

  assert(ctx !== null && ctx.topLabels.length > 0, 'base personalisation survives');
  assertEquals(ctx?.goal, undefined);
  assertEquals(queried.includes('user_profiles'), false);
});

Deno.test('an empty include list is indistinguishable from passing none', async () => {
  // What makes the unentitled path a true no-op rather than a near-one: same
  // queries, same keys, same object.
  const a = stubClient(ROWS);
  const b = stubClient(ROWS);
  const withEmpty = await fetchLearnerContext(a.client, {
    userId: 'u1',
    targetLanguage: 'fr',
    include: learnerContextIncludeFor('starter'),
  });
  const withNone = await fetchLearnerContext(b.client, { userId: 'u1', targetLanguage: 'fr' });

  assertEquals(withEmpty, withNone);
  assertEquals(Object.keys(withEmpty ?? {}), Object.keys(withNone ?? {}));
  assertEquals(a.queried, b.queried);
});

// ─── The cache boundary ───────────────────────────────────────────────────

Deno.test('buildSystemPrompt cannot see a learner goal, so it cannot cache one', () => {
  // The strongest form of the invariant, and the same one prompt.test.ts uses
  // for the dialogue act: the cached block's builder has no parameter through
  // which a goal could arrive, so no argument can change what it emits.
  const baseline = buildSystemPrompt('French', 'intermediate', 'restaurant', 'en');
  // @ts-expect-error — deliberately passing a goal to prove it is ignored.
  const withGoal = buildSystemPrompt('French', 'intermediate', 'restaurant', 'en', IDEAL_MOMENT);
  assertEquals(withGoal, baseline);
  assertEquals(baseline.includes(IDEAL_MOMENT), false);
});

Deno.test('the learner note is appended outside the cached block', () => {
  const system = INDEX_SRC.slice(INDEX_SRC.indexOf('system: ['));
  const block = system.slice(0, system.indexOf('],'));

  assert(
    /\{ type: 'text', text: systemPrompt, cache_control: \{ type: 'ephemeral' \} \}/.test(block),
    'systemPrompt should be the cache_control-carrying entry',
  );
  // The goal travels inside `learnerNote` — the serialised <LEARNER_PROFILE>
  // fence plus its steer — so pinning that note's position pins the goal's.
  assert(block.includes('learnerNote'), 'the learner note should be a system block');
  assert(
    block.indexOf('learnerNote') > block.indexOf('cache_control'),
    'the learner note must come AFTER the cached entry',
  );
  assert(
    !/learnerNote[^]*cache_control/.test(block),
    'the learner note must never carry a cache_control breakpoint',
  );
  assertEquals(block.split('cache_control').length - 1, 1, 'exactly one breakpoint');
});

Deno.test('the goal is requested through the tier gate, not the text allowance', () => {
  // `limits.dailyTextMessages > 0` still gates the BASE context — that is the
  // school-contract student's entitlement and it is unchanged. The include
  // list must come from the tier gate instead, or a starter student on a
  // contract silently gains a paid feature.
  const call = INDEX_SRC.slice(INDEX_SRC.indexOf('await fetchLearnerContext('));
  const args = call.slice(0, call.indexOf('})'));
  assert(
    args.includes('include: learnerContextIncludeFor(tier)'),
    'the include list must be resolved by the tier gate',
  );
  assert(
    !/include:\s*\[/.test(args),
    'the include list must never be spelled out inline, bypassing the gate',
  );
  assert(
    INDEX_SRC.includes('resolveEntitlement(supabase, authenticatedUserId)'),
    'the tier must come from the one definition of "which plan is this learner on"',
  );
});
