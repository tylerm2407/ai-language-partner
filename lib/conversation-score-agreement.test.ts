/**
 * What a conversation turn is worth is written down three times, and they must
 * agree.
 *
 *   1. `supabase/functions/_shared/turn-accuracy.ts` — `combinedScore`.
 *      The WRITE path: ai-chat and the voice tutor score a turn with this
 *      before storing its components in `conversation_evidence`.
 *   2. `lib/cefr-proficiency.ts` — `combineConversationScore`.
 *      The REPORT path: the app bundle reads those rows back and recombines
 *      them into the interaction strand.
 *   3. `supabase/functions/checkpoint/checkpoint-core.ts` — `combineTurn`.
 *      The TEST path: the level test reads the same rows back for its own
 *      conversation strand.
 *
 * None of the three can import the others. Two are Deno edge modules that the
 * app bundle cannot load; `checkpoint-core.ts` is deliberately dependency-free
 * so it stays unit-testable without a runtime; and `turn-accuracy.ts` takes a
 * `TurnScore` the other two never construct. The components are stored raw
 * rather than pre-combined on purpose — the weighting is meant to be re-tunable
 * without losing the evidence — so the rule genuinely lives in three places.
 *
 * WHAT DRIFT WOULD COST. These three produce the number a CEFR band is built
 * from. If the checkpoint copy and the report copy disagreed, a learner's level
 * test and their practice history would weigh the same spoken turn differently
 * and both would be presented as a band. Nothing would error; the level would
 * just depend on which surface asked. That is precisely the failure the
 * proficiency module's header calls out about the four copies of the CEFR
 * ladder, and it is why that one has `lib/cefr-ladder.test.ts`.
 *
 * Reads the two edge modules as TEXT rather than importing them, because
 * importing Deno source under jest is not worth the tooling. Same approach as
 * `lib/cefr-ladder.test.ts` and `lib/scenario-keys.test.ts`.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { combineConversationScore } from './cefr-proficiency';

const TURN_ACCURACY = resolve(__dirname, '../supabase/functions/_shared/turn-accuracy.ts');
const CHECKPOINT_CORE = resolve(
  __dirname,
  '../supabase/functions/checkpoint/checkpoint-core.ts',
);

/**
 * The combining expression, with the receiver stripped.
 *
 * `0.5 * score.accuracy + 0.5 * score.intelligibility` and
 * `0.5 * turn.accuracy + 0.5 * turn.intelligibility` are the same rule written
 * against different parameter names, so the names are normalised away and the
 * arithmetic is what is compared.
 */
function combineExpression(file: string, fnName: string): string {
  const src = readFileSync(file, 'utf8');
  const start = src.indexOf(`export function ${fnName}`);
  expect(start).toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf('\n}', start));
  // The last `return` in the function is the combining one; the earlier return
  // is the null-intelligibility fallback.
  const returns = [...body.matchAll(/return ([^;]+);/g)].map((m) => m[1].trim());
  expect(returns.length).toBeGreaterThanOrEqual(2);
  return returns[returns.length - 1].replace(/\b(score|turn)\./g, '');
}

/** The fallback branch, likewise normalised. */
function fallbackExpression(file: string, fnName: string): string {
  const src = readFileSync(file, 'utf8');
  const start = src.indexOf(`export function ${fnName}`);
  const body = src.slice(start, src.indexOf('\n}', start));
  const returns = [...body.matchAll(/return ([^;]+);/g)].map((m) => m[1].trim());
  return returns[0].replace(/\b(score|turn)\./g, '');
}

describe('what a conversation turn is worth', () => {
  it('combines identically in all three runtimes', () => {
    const edgeWrite = combineExpression(TURN_ACCURACY, 'combinedScore');
    const edgeTest = combineExpression(CHECKPOINT_CORE, 'combineTurn');
    expect(edgeWrite).toBe('0.5 * accuracy + 0.5 * intelligibility');
    expect(edgeTest).toBe(edgeWrite);
  });

  it('falls back to accuracy alone identically in all three', () => {
    // A spoken turn the recogniser reported nothing about still counts. If one
    // copy discarded it instead, a learner's band would depend on which
    // surface heard them.
    expect(fallbackExpression(TURN_ACCURACY, 'combinedScore')).toBe('accuracy');
    expect(fallbackExpression(CHECKPOINT_CORE, 'combineTurn')).toBe('accuracy');
    expect(combineConversationScore(0.8, null)).toBe(0.8);
  });

  it('the app copy computes what that expression says', () => {
    // The two edge copies are compared as text; this one is executable, so it
    // is checked by running it. Together that pins all three.
    expect(combineConversationScore(0.8, 0.6)).toBeCloseTo(0.7, 10);
    expect(combineConversationScore(1, 0)).toBeCloseTo(0.5, 10);
    expect(combineConversationScore(0.4, 0.4)).toBeCloseTo(0.4, 10);
  });

  it('treats a non-finite intelligibility as absent, not as zero', () => {
    // NaN reaching the formula would silently halve a turn's score.
    expect(combineConversationScore(0.8, NaN)).toBe(0.8);
  });
});
