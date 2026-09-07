/**
 * Tests for banking taught words as review cards.
 *
 * What is pinned here is the quota discipline, because every way it can break
 * is silent in production: the learner is charged for a card that does not
 * exist, or charged twice for a word they already have, and nobody finds out
 * until they run out of their daily allowance early. None of it was testable
 * while the code lived in `ai-chat/index.ts`, which calls `serve()` at module
 * scope.
 *
 * Run with: npm run test:functions
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  DEFAULT_CHAT_CARD_TAGS,
  saveChatVocabulary,
  type ChatVocabularyClient,
} from './chat-vocabulary.ts';

// ─── Test doubles ─────────────────────────────────────────────────────────

interface Result {
  data: unknown;
  error: { message: string } | null;
}

interface FakeOptions {
  /** Words the learner is already studying — the dedupe read finds these. */
  existingWords?: string[];
  /** Decide per call (1-based) whether the atomic counter grants a slot. */
  quotaAllows?: (callNumber: number) => boolean;
  /** Make `consume_daily_quota` itself fail, i.e. a broken counter. */
  quotaError?: string;
  /** Make `refund_daily_quota` fail — the migration-107 whitelist bug. */
  refundError?: string;
  /** Fail the card insert for these words. */
  cardInsertFailsFor?: string[];
  /** Fail the review_items upsert for these words. */
  reviewFailsFor?: string[];
}

/**
 * PostgREST-shaped double.
 *
 * The builder is thenable and carries a mutable result, because one `from()`
 * chain is used two ways here: `.select().eq().eq().ilike().limit()` for the
 * dedupe read and `.insert().select().single()` for the write. Whichever
 * terminal method runs sets the result the `await` will see.
 */
function fakeClient(opts: FakeOptions = {}) {
  const rpcCalls: { name: string; params: Record<string, unknown> }[] = [];
  const inserted: Record<string, unknown>[] = [];
  const upserted: Record<string, unknown>[] = [];
  const lookedUp: string[] = [];
  /** Words whose card insert succeeded, in id order — `card-N` is index N-1. */
  const cardWords: string[] = [];
  let quotaCallCount = 0;

  const client = {
    from(table: string) {
      // deno-lint-ignore no-explicit-any
      const builder: any = {};
      let result: Result = { data: [], error: null };

      for (const method of ['select', 'eq', 'limit', 'single', 'order']) {
        builder[method] = () => builder;
      }

      builder.ilike = (_column: string, value: string) => {
        lookedUp.push(value);
        const hit = (opts.existingWords ?? []).some(
          (w) => w.toLowerCase() === String(value).toLowerCase(),
        );
        result = { data: hit ? [{ id: 'existing-card' }] : [], error: null };
        return builder;
      };

      builder.insert = (payload: Record<string, unknown>) => {
        inserted.push({ table, ...payload });
        const word = String(payload.target_text ?? '');
        if ((opts.cardInsertFailsFor ?? []).includes(word)) {
          result = { data: null, error: { message: 'insert rejected' } };
        } else {
          cardWords.push(word);
          result = { data: { id: `card-${cardWords.length}` }, error: null };
        }
        return builder;
      };

      builder.upsert = (payload: Record<string, unknown>) => {
        upserted.push({ table, ...payload });
        // Map the card id back to the word it was inserted for, so a test can
        // fail the schedule of one specific word.
        const index = Number(String(payload.card_id ?? '').replace('card-', '')) - 1;
        const scheduledWord = cardWords[index] ?? '';
        result = {
          data: null,
          error: (opts.reviewFailsFor ?? []).includes(scheduledWord)
            ? { message: 'upsert rejected' }
            : null,
        };
        return builder;
      };

      builder.then = (onFulfilled: (r: Result) => unknown) =>
        Promise.resolve(result).then(onFulfilled);
      return builder;
    },

    rpc(name: string, params: Record<string, unknown>) {
      rpcCalls.push({ name, params });
      let result: Result = { data: null, error: null };
      if (name === 'consume_daily_quota') {
        quotaCallCount += 1;
        result = opts.quotaError
          ? { data: null, error: { message: opts.quotaError } }
          : { data: opts.quotaAllows ? opts.quotaAllows(quotaCallCount) : true, error: null };
      } else if (name === 'refund_daily_quota') {
        result = {
          data: null,
          error: opts.refundError ? { message: opts.refundError } : null,
        };
      }
      return {
        then: (onFulfilled: (r: Result) => unknown) => Promise.resolve(result).then(onFulfilled),
      };
    },
  };

  return {
    client: client as unknown as ChatVocabularyClient,
    rpcCalls,
    cardInserts: () => inserted.filter((r) => r.table === 'cards'),
    upserts: () => upserted,
    lookedUp,
    consumeCalls: () => rpcCalls.filter((c) => c.name === 'consume_daily_quota'),
    refundCalls: () => rpcCalls.filter((c) => c.name === 'refund_daily_quota'),
  };
}

const BASE = {
  userId: 'user-1',
  targetLanguage: 'es',
  cefrLevel: 'B1',
  limit: 10,
};

const word = (w: string, t: string) => ({ word: w, translation: t });

// ─── Dedupe before charging ───────────────────────────────────────────────

Deno.test('a word the learner already studies costs no quota slot', async () => {
  const fake = fakeClient({ existingWords: ['la cuenta'] });
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [word('la cuenta', 'the bill')],
  });

  assertEquals(saved, []);
  assertEquals(fake.consumeCalls().length, 0, 'dedupe must run before the charge');
  assertEquals(fake.cardInserts().length, 0);
});

Deno.test('the dedupe read is case-insensitive on the word, as ilike is', async () => {
  const fake = fakeClient({ existingWords: ['La Cuenta'] });
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [word('la cuenta', 'the bill')],
  });
  assertEquals(saved, []);
  assertEquals(fake.lookedUp, ['la cuenta']);
});

// ─── Charging ─────────────────────────────────────────────────────────────

Deno.test('the quota is consumed exactly once per new card', async () => {
  const fake = fakeClient();
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [word('la cuenta', 'the bill'), word('la propina', 'the tip')],
  });

  assertEquals(saved, ['la cuenta', 'la propina']);
  assertEquals(fake.consumeCalls().length, 2);
  assertEquals(fake.refundCalls().length, 0);
  assertEquals(fake.consumeCalls()[0].params, {
    p_user_id: 'user-1',
    p_counter: 'chat_cards',
    p_limit: 10,
    p_amount: 1,
  });
});

Deno.test('a mix of new and already-known words charges only for the new ones', async () => {
  const fake = fakeClient({ existingWords: ['la propina'] });
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [word('la cuenta', 'the bill'), word('la propina', 'the tip')],
  });

  assertEquals(saved, ['la cuenta']);
  assertEquals(fake.consumeCalls().length, 1);
});

Deno.test('quota exhaustion stops further cards without throwing', async () => {
  // The counter grants the first slot and refuses the second.
  const fake = fakeClient({ quotaAllows: (n) => n === 1 });
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [
      word('la cuenta', 'the bill'),
      word('la propina', 'the tip'),
      word('el camarero', 'the waiter'),
    ],
  });

  assertEquals(saved, ['la cuenta']);
  // Stops at the refusal rather than asking again for every remaining word.
  assertEquals(fake.consumeCalls().length, 2);
  assertEquals(fake.cardInserts().length, 1);
  assertEquals(fake.refundCalls().length, 0, 'a refused slot was never charged');
});

Deno.test('a broken counter fails closed and stops the turn', async () => {
  const fake = fakeClient({ quotaError: 'counter chat_cards is not whitelisted' });
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [word('la cuenta', 'the bill'), word('la propina', 'the tip')],
  });

  assertEquals(saved, []);
  assertEquals(fake.cardInserts().length, 0);
  assertEquals(fake.consumeCalls().length, 1, 'the next word would hit the same error');
});

Deno.test('limit <= 0 does no work at all', async () => {
  const fake = fakeClient();
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    limit: 0,
    words: [word('la cuenta', 'the bill')],
  });

  assertEquals(saved, []);
  assertEquals(fake.rpcCalls.length, 0);
  assertEquals(fake.lookedUp, []);
});

// ─── Refund on failure after the charge ───────────────────────────────────

Deno.test('a failed card insert refunds exactly once', async () => {
  const fake = fakeClient({ cardInsertFailsFor: ['la cuenta'] });
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [word('la cuenta', 'the bill')],
  });

  assertEquals(saved, []);
  assertEquals(fake.consumeCalls().length, 1);
  assertEquals(fake.refundCalls().length, 1);
  assertEquals(fake.refundCalls()[0].params, {
    p_user_id: 'user-1',
    p_counter: 'chat_cards',
    p_amount: 1,
  });
});

Deno.test('a failed review_items upsert also refunds exactly once', async () => {
  // The card row exists but nothing schedules it, so it is not a review card
  // and the learner should not have paid a slot for it.
  const fake = fakeClient({ reviewFailsFor: ['la cuenta'] });
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [word('la cuenta', 'the bill')],
  });

  assertEquals(saved, []);
  assertEquals(fake.consumeCalls().length, 1);
  assertEquals(fake.refundCalls().length, 1);
});

Deno.test('one failed word does not stop the rest of the turn', async () => {
  const fake = fakeClient({ cardInsertFailsFor: ['la cuenta'] });
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [word('la cuenta', 'the bill'), word('la propina', 'the tip')],
  });

  assertEquals(saved, ['la propina']);
  assertEquals(fake.refundCalls().length, 1);
});

Deno.test('a refund that itself fails is survived, not thrown', async () => {
  // This is the shape of the bug that was live until migration 107: the
  // counter name was missing from refund_daily_quota's whitelist, so every
  // call raised. The card is still lost and the slot is still spent, but the
  // learner keeps their conversation.
  const fake = fakeClient({
    cardInsertFailsFor: ['la cuenta'],
    refundError: 'invalid counter: chat_cards',
  });
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [word('la cuenta', 'the bill'), word('la propina', 'the tip')],
  });

  assertEquals(saved, ['la propina']);
  assertEquals(fake.refundCalls().length, 1);
});

// ─── What lands on the card ───────────────────────────────────────────────

Deno.test('cefr_level is written, or the card never counts toward measured vocabulary', async () => {
  const fake = fakeClient();
  await saveChatVocabulary(fake.client, { ...BASE, words: [word('la cuenta', 'the bill')] });

  const card = fake.cardInserts()[0];
  assertEquals(card.cefr_level, 'B1');
  assertEquals(card.target_text, 'la cuenta');
  assertEquals(card.native_text, 'the bill');
  assertEquals(card.language, 'es');
  assertEquals(card.skill_type, 'vocabulary');
});

Deno.test('tags default to the chat pair and can be overridden per surface', async () => {
  const chat = fakeClient();
  await saveChatVocabulary(chat.client, { ...BASE, words: [word('la cuenta', 'the bill')] });
  assertEquals(chat.cardInserts()[0].tags, [...DEFAULT_CHAT_CARD_TAGS]);

  const tutor = fakeClient();
  await saveChatVocabulary(tutor.client, {
    ...BASE,
    words: [word('la cuenta', 'the bill')],
    tags: ['tutor', 'vocabulary'],
  });
  assertEquals(tutor.cardInserts()[0].tags, ['tutor', 'vocabulary']);
});

Deno.test('the review item is scheduled as a brand-new SM-2 card', async () => {
  const fake = fakeClient();
  await saveChatVocabulary(fake.client, { ...BASE, words: [word('la cuenta', 'the bill')] });

  const item = fake.upserts()[0];
  assertEquals(item.ease_factor, 2.5);
  assertEquals(item.interval, 0);
  assertEquals(item.repetitions, 0);
  assertEquals(item.status, 'new');
  assertEquals(item.last_reviewed_at, null);
  assert(typeof item.next_due === 'string');
});

// ─── The candidate cap ────────────────────────────────────────────────────

Deno.test('the candidate cap defaults to three — ai-chat behaviour, unchanged', async () => {
  const fake = fakeClient();
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [
      word('uno', 'one'),
      word('dos', 'two'),
      word('tres', 'three'),
      word('cuatro', 'four'),
      word('cinco', 'five'),
    ],
  });

  assertEquals(saved, ['uno', 'dos', 'tres']);
  assertEquals(fake.consumeCalls().length, 3);
});

Deno.test('a caller may raise the candidate cap', async () => {
  const fake = fakeClient();
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    maxCandidates: 6,
    words: [
      word('uno', 'one'),
      word('dos', 'two'),
      word('tres', 'three'),
      word('cuatro', 'four'),
      word('cinco', 'five'),
      word('seis', 'six'),
      word('siete', 'seven'),
    ],
  });

  assertEquals(saved.length, 6);
  assertEquals(saved[5], 'seis');
});

Deno.test('the cap applies after untranslatable entries are dropped', async () => {
  // A bare highlighted string parses with an empty translation. It renders in
  // the transcript but cannot be a card, and it must not consume one of the
  // three slots either.
  const fake = fakeClient();
  const saved = await saveChatVocabulary(fake.client, {
    ...BASE,
    words: [
      word('uno', ''),
      word('dos', 'two'),
      word('tres', 'three'),
      word('cuatro', 'four'),
    ],
  });

  assertEquals(saved, ['dos', 'tres', 'cuatro']);
});

Deno.test('no candidates means no client calls at all', async () => {
  const fake = fakeClient();
  assertEquals(await saveChatVocabulary(fake.client, { ...BASE, words: [] }), []);
  assertEquals(fake.rpcCalls.length, 0);
  assertEquals(fake.lookedUp, []);
});

// ─── Never fatal ──────────────────────────────────────────────────────────

Deno.test('a client that throws outright does not propagate', async () => {
  const exploding = {
    from() {
      throw new Error('connection reset');
    },
    rpc() {
      throw new Error('connection reset');
    },
  } as unknown as ChatVocabularyClient;

  const saved = await saveChatVocabulary(exploding, {
    ...BASE,
    words: [word('la cuenta', 'the bill')],
  });
  assertEquals(saved, []);
});
