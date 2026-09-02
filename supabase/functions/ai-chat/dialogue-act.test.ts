// Deno tests for ./dialogue-act.ts.
//
// Run with: `deno test supabase/functions/ai-chat/dialogue-act.test.ts`
//
// Two things are load-bearing here.
//
// First, `follow_repair` must win over everything except closing. It is what
// bounds the push to a single attempt — the prompt asks for that too, but a
// prompt cannot guarantee it and this can.
//
// Second, selection must be deterministic. The cadence is driven by a hash
// rather than Math.random precisely so a conversation replays identically;
// a policy you cannot reproduce is not a policy.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  actInstruction,
  NEGOTIATION_EVERY,
  selectDialogueAct,
  type ActSelectionInput,
  type DialogueAct,
} from './dialogue-act.ts';

function input(over: Partial<ActSelectionInput> = {}): ActSelectionInput {
  return {
    turnIndex: 3,
    learnerText: 'Me gustaría reservar una mesa para dos personas',
    recentLearnerTurns: ['Hola buenas tardes', 'Sí, para esta noche'],
    previousTurnRequestedRepair: false,
    isClosing: false,
    ...over,
  };
}

Deno.test('the first turn opens', () => {
  assertEquals(selectDialogueAct(input({ turnIndex: 0 })), 'open');
});

Deno.test('a repair attempt is always acknowledged, and never pushed twice', () => {
  // Whatever else is true of the turn, an attempted repair gets reacted to.
  const cases: Partial<ActSelectionInput>[] = [
    {},
    { turnIndex: 0 },
    { learnerText: 'sí' },
    { turnIndex: 9, recentLearnerTurns: ['sí', 'no', 'vale'], learnerText: 'ok' },
  ];
  for (const over of cases) {
    assertEquals(
      selectDialogueAct(input({ ...over, previousTurnRequestedRepair: true })),
      'follow_repair',
      JSON.stringify(over),
    );
  }
});

Deno.test('closing beats everything, including an outstanding repair', () => {
  assertEquals(
    selectDialogueAct(input({ isClosing: true, previousTurnRequestedRepair: true, turnIndex: 0 })),
    'close',
  );
});

Deno.test('a run of one-word answers changes the subject', () => {
  const act = selectDialogueAct(
    input({
      turnIndex: 6,
      learnerText: 'sí',
      recentLearnerTurns: ['no', 'vale', 'bien'],
    }),
  );
  assertEquals(act, 'change_subject');
});

Deno.test('one short answer is an answer, not a stall', () => {
  const act = selectDialogueAct(
    input({
      turnIndex: 6,
      learnerText: 'sí',
      recentLearnerTurns: ['Me gusta mucho la comida italiana', 'Prefiero la pasta'],
    }),
  );
  assert(act !== 'change_subject', `expected not a stall, got ${act}`);
});

Deno.test('short answers early on are not a stall — there is no history yet', () => {
  const act = selectDialogueAct(
    input({ turnIndex: 1, learnerText: 'sí', recentLearnerTurns: ['no', 'vale'] }),
  );
  assert(act !== 'change_subject');
});

Deno.test('selection is deterministic — same input, same act, every time', () => {
  const fixed = input({ turnIndex: 7, learnerText: 'quiero pedir el pescado por favor' });
  const first = selectDialogueAct(fixed);
  for (let i = 0; i < 50; i++) {
    assertEquals(selectDialogueAct(fixed), first);
  }
});

Deno.test('non-understanding fires at roughly the intended cadence', () => {
  // Across a long spread of turns it should land near one in NEGOTIATION_EVERY
  // — often enough to matter, rarely enough not to feel broken.
  let negotiations = 0;
  const TURNS = 500;
  for (let i = 1; i <= TURNS; i++) {
    const act = selectDialogueAct(
      input({ turnIndex: i, learnerText: `una frase de prueba número ${i}` }),
    );
    if (act === 'signal_non_understanding') negotiations++;
  }
  const rate = negotiations / TURNS;
  const target = 1 / NEGOTIATION_EVERY;
  assert(
    rate > target * 0.5 && rate < target * 1.5,
    `rate ${rate.toFixed(3)} strayed far from the ${target.toFixed(3)} target`,
  );
});

Deno.test('the ordinary turn adds no instruction at all', () => {
  // `develop` is what the system prompt already describes. Restating it would
  // spend tokens on every ordinary turn — which is most turns — to say nothing.
  assertEquals(actInstruction('develop', 'Spanish'), null);
});

Deno.test('every other act has an instruction, and it is about this turn', () => {
  const acts: DialogueAct[] = [
    'open',
    'follow_repair',
    'signal_non_understanding',
    'change_subject',
    'close',
  ];
  for (const act of acts) {
    const text = actInstruction(act, 'Spanish');
    assert(text !== null, `${act} should carry an instruction`);
    assert(text!.startsWith('THIS TURN:'), `${act} should scope itself to this turn`);
  }
});

Deno.test('follow_repair forbids a second request in so many words', () => {
  const text = actInstruction('follow_repair', 'Spanish')!;
  assert(text.includes('do NOT ask them to try again'));
});

Deno.test('signal_non_understanding does not licence faking confusion', () => {
  // The stance is "ask rather than guess when genuinely unclear", not "act
  // confused". A tutor that invents confusion is worse than one that guesses.
  const text = actInstruction('signal_non_understanding', 'Spanish')!;
  assert(text.includes('not pretending to be confused'));
  assert(text.includes('respond normally'));
});

Deno.test('the opening turn does not correct', () => {
  assert(actInstruction('open', 'Spanish')!.includes('Do not correct anything yet'));
});

Deno.test('instructions carry the target language where they quote speech', () => {
  assert(actInstruction('follow_repair', 'Japanese')!.includes('Japanese'));
});
