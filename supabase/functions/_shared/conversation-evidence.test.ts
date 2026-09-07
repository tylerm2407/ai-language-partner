/**
 * Tests for what a conversation turn leaves behind as proficiency evidence.
 *
 * The behaviour that matters most here is the REFUSAL: `scoreTurn` declines to
 * score turns that are not language samples, and this module must write nothing
 * when it does. A regression there would not fail loudly — it would quietly
 * fill `conversation_evidence` with one-word turns and move learners' measured
 * CEFR levels on data that means nothing.
 *
 * Run with: npm run test:functions
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  recordConversationEvidence,
  type ConversationEvidenceClient,
} from './conversation-evidence.ts';
import { MIN_CONFIDENCE_FOR_EVIDENCE, MIN_WORDS_FOR_EVIDENCE } from './turn-accuracy.ts';

// ─── Test double ──────────────────────────────────────────────────────────

function fakeClient(insertError?: string) {
  const rows: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          rows.push({ table, ...payload });
          return Promise.resolve({
            data: null,
            error: insertError ? { message: insertError } : null,
          });
        },
      };
    },
  };
  return { client: client as unknown as ConversationEvidenceClient, rows };
}

const BASE = {
  userId: 'user-1',
  targetLanguage: 'es',
  cefrLevel: 'B1',
  correction: null,
};

/** Comfortably over MIN_WORDS_FOR_EVIDENCE, so the turn is a language sample. */
const LONG_TURN = 'Quiero reservar una mesa para dos personas esta noche';

// ─── The refusal ──────────────────────────────────────────────────────────

Deno.test('a turn too short to be a language sample writes no row', async () => {
  const fake = fakeClient();
  const wrote = await recordConversationEvidence(fake.client, {
    ...BASE,
    modality: 'writing',
    text: 'Sí.',
  });

  assertEquals(wrote, false);
  assertEquals(fake.rows, [], 'scoreTurn returning null must mean no evidence at all');
});

Deno.test('the short-turn boundary is exactly MIN_WORDS_FOR_EVIDENCE', async () => {
  const words = Array.from({ length: MIN_WORDS_FOR_EVIDENCE }, (_, i) => `w${i}`);

  const below = fakeClient();
  await recordConversationEvidence(below.client, {
    ...BASE,
    modality: 'writing',
    text: words.slice(1).join(' '),
  });
  assertEquals(below.rows.length, 0);

  const at = fakeClient();
  await recordConversationEvidence(at.client, {
    ...BASE,
    modality: 'writing',
    text: words.join(' '),
  });
  assertEquals(at.rows.length, 1);
});

Deno.test('a spoken turn we could not hear clearly writes no row', async () => {
  const fake = fakeClient();
  const wrote = await recordConversationEvidence(fake.client, {
    ...BASE,
    modality: 'speaking',
    text: LONG_TURN,
    recognizerConfidence: MIN_CONFIDENCE_FOR_EVIDENCE - 0.01,
  });

  assertEquals(wrote, false);
  assertEquals(fake.rows, []);
});

Deno.test('a spoken turn with no confidence reported still counts', async () => {
  // An older `transcribe` deployment reports nothing; that is not a bad
  // utterance and must not silently stop measuring speaking.
  const fake = fakeClient();
  await recordConversationEvidence(fake.client, {
    ...BASE,
    modality: 'speaking',
    text: LONG_TURN,
  });

  assertEquals(fake.rows.length, 1);
  assertEquals(fake.rows[0].intelligibility, null);
});

// ─── The row ──────────────────────────────────────────────────────────────

Deno.test('a scored written turn writes the full row', async () => {
  const fake = fakeClient();
  const wrote = await recordConversationEvidence(fake.client, {
    ...BASE,
    modality: 'writing',
    text: LONG_TURN,
  });

  assertEquals(wrote, true);
  assertEquals(fake.rows.length, 1);
  const row = fake.rows[0];
  assertEquals(row.table, 'conversation_evidence');
  assertEquals(row.user_id, 'user-1');
  assertEquals(row.target_language, 'es');
  assertEquals(row.cefr_level, 'B1');
  assertEquals(row.modality, 'writing');
  assertEquals(row.word_count, 9);
  assertEquals(row.accuracy, 1);
  // Only speaking carries an intelligibility number.
  assertEquals(row.intelligibility, null);
});

Deno.test('modality is passed through, and speaking carries the confidence', async () => {
  const fake = fakeClient();
  await recordConversationEvidence(fake.client, {
    ...BASE,
    modality: 'speaking',
    text: LONG_TURN,
    recognizerConfidence: 0.9,
  });

  assertEquals(fake.rows[0].modality, 'speaking');
  assertEquals(fake.rows[0].intelligibility, 0.9);
});

Deno.test('a correction lowers the recorded accuracy', async () => {
  const clean = fakeClient();
  await recordConversationEvidence(clean.client, {
    ...BASE,
    modality: 'writing',
    text: LONG_TURN,
  });

  const corrected = fakeClient();
  await recordConversationEvidence(corrected.client, {
    ...BASE,
    modality: 'writing',
    text: LONG_TURN,
    correction: { errorType: 'gender', severity: 'moderate' },
  });

  assertEquals(clean.rows[0].accuracy, 1);
  assertEquals(corrected.rows[0].accuracy as number < 1, true);
});

// ─── Never fatal ──────────────────────────────────────────────────────────

Deno.test('a rejected insert is logged, not thrown', async () => {
  const fake = fakeClient('new row violates row-level security policy');
  const wrote = await recordConversationEvidence(fake.client, {
    ...BASE,
    modality: 'writing',
    text: LONG_TURN,
  });

  assertEquals(wrote, false);
  assertEquals(fake.rows.length, 1, 'the insert was attempted');
});

Deno.test('a client that throws outright does not propagate', async () => {
  const exploding = {
    from() {
      throw new Error('connection reset');
    },
  } as unknown as ConversationEvidenceClient;

  assertEquals(
    await recordConversationEvidence(exploding, {
      ...BASE,
      modality: 'writing',
      text: LONG_TURN,
    }),
    false,
  );
});
