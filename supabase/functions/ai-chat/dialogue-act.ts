// Choose the conversational stance for one tutor turn.
//
// Pure, no I/O, `deno test`-able. Same split as ./prompt.ts.
//
// ── Why a controller ──
//
// Every tutor turn used to be generated from one system prompt doing
// everything at once: react, ask, correct, stay in character, and know when to
// stop. That is a lot to ask of a single instruction set, and the failure mode
// is visible in every competitor in this category — Speak's most-cited
// complaint is that every AI turn ends in a question, which reads as an
// interrogation rather than a conversation. Duolingo's Roleplay avoids it by
// generating each character turn from a different specialized prompt selected
// by policy. This is that.
//
// The act is chosen HERE, in code, from signals available before generation.
// The model still decides what to say and whether an error even exists; the
// controller decides the stance it says it in. That split matters: a policy
// expressed as code can be tested, bounded and tuned, while a policy expressed
// as a paragraph of prompt is a hope.
//
// ── The constraint this module lives under ──
//
// The system prompt carries the ONLY `cache_control` breakpoint, so its text
// is the cache key. Varying it per turn would destroy the shared prefix for
// every learner on every turn — the exact bug that moving `topic` out of it
// fixed. So the act instruction is never part of the cached prompt: it is
// appended as a separate, uncached system block, the same way the learner
// profile and code-switch note already are. `prompt.test.ts` asserts this.
//
// ── Determinism ──
//
// No `Math.random()`. The cadence acts (see NEGOTIATION_EVERY) are driven by a
// hash of the turn, so the same conversation replays identically and the
// policy is testable. Randomness that cannot be reproduced is not a policy,
// it is a bug generator.

export type DialogueAct =
  /** First tutor turn. Set the scene, make it easy to say something back. */
  | 'open'
  /** The default: react to what was said, move the conversation on. */
  | 'develop'
  /** The learner has just attempted a repair we asked for. React to the
   *  attempt and move on — never ask a second time. */
  | 'follow_repair'
  /** Deliberately signal non-understanding and ask for clarification, rather
   *  than silently guessing what was meant. */
  | 'signal_non_understanding'
  /** The conversation has stalled. Take it somewhere else. */
  | 'change_subject'
  /** Bring it to a natural end. */
  | 'close';

export interface ActSelectionInput {
  /** How many turns the learner has taken in this conversation, 0-based. */
  turnIndex: number;
  /** The learner's most recent turn. */
  learnerText: string;
  /** The learner's previous turns, newest first, for stall detection. */
  recentLearnerTurns: string[];
  /** Did our previous turn ask the learner to fix something themselves? */
  previousTurnRequestedRepair: boolean;
  /** The conversation is ending — an assignment's time is up, or the learner
   *  is wrapping up. */
  isClosing: boolean;
}

/**
 * How often the tutor is willing to admit it did not follow something.
 *
 * One turn in five, matching the rate the system prompt already asks for.
 *
 * This is not the tutor pretending to be confused. The act sets a *stance* —
 * "if this turn is at all unclear, ask rather than guess" — and the model
 * still decides whether it actually was unclear. We control the policy rate;
 * the model controls applicability. Long's interaction hypothesis is the
 * reason it is non-zero at all: a tutor that always understands perfectly has
 * removed the breakdown-and-repair loop that drives acquisition.
 */
export const NEGOTIATION_EVERY = 5;

/** Turns before the tutor will consider the conversation stalled. Below this
 *  there is not enough history to tell a lull from an opening. */
const STALL_MIN_TURNS = 4;

/** Learner turns at or under this many words read as disengagement when they
 *  come in a run. One short answer is an answer; three is a conversation
 *  running out of road. */
const SHORT_TURN_WORDS = 3;

/** How many consecutive short turns before changing the subject. */
const STALL_RUN = 3;

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * Stable non-negative hash of a string.
 *
 * djb2. Used only to spread the negotiation cadence across turns so it does
 * not land on a fixed cycle the learner could feel — not for anything where
 * collision resistance matters.
 */
function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Pick the stance for this turn.
 *
 * Order is precedence, and it is deliberate. Closing beats everything because
 * a conversation that must end should end. Following a repair comes next
 * because leaving an attempted repair unacknowledged is the rudest thing in
 * the list — and because it is what mechanically bounds the push to one
 * attempt rather than trusting the prompt to remember.
 */
export function selectDialogueAct(input: ActSelectionInput): DialogueAct {
  if (input.isClosing) return 'close';

  // The learner just tried to fix something we asked them to fix. React to
  // that, whatever else is true. This is what makes "never push a third time"
  // a property of the system rather than an instruction we hope is followed.
  if (input.previousTurnRequestedRepair) return 'follow_repair';

  if (input.turnIndex === 0) return 'open';

  // A run of one-word answers is a conversation that has run out of road.
  // Changing the subject is a repair for the conversation, not the language.
  if (input.turnIndex >= STALL_MIN_TURNS) {
    const run = [input.learnerText, ...input.recentLearnerTurns].slice(0, STALL_RUN);
    if (run.length === STALL_RUN && run.every((t) => wordCount(t) > 0 && wordCount(t) <= SHORT_TURN_WORDS)) {
      return 'change_subject';
    }
  }

  // Cadence, spread by turn content so it does not land on a fixed cycle.
  if ((input.turnIndex + hash(input.learnerText)) % NEGOTIATION_EVERY === 0) {
    return 'signal_non_understanding';
  }

  return 'develop';
}

/**
 * The instruction for an act, or null when the act needs none.
 *
 * `develop` returns null on purpose. It is the behaviour the system prompt
 * already describes, so restating it would add tokens to every ordinary turn
 * — which is most of them — to say nothing new.
 *
 * Written as directives about THIS turn, in our own voice, and appended
 * outside any fence: this is instruction, not learner data.
 */
export function actInstruction(act: DialogueAct, targetLanguage: string): string | null {
  switch (act) {
    case 'develop':
      return null;

    case 'open':
      return `THIS TURN: open the conversation. Greet them, set the scene in one line, and ask one easy question they can answer with the words they already have. Do not correct anything yet — there is nothing to correct, and opening with a correction sets the wrong tone for everything after it.`;

    case 'follow_repair':
      return `THIS TURN: you asked the learner to fix something themselves, and this is their attempt. React to the attempt first, warmly and briefly.
- If they fixed it: say so in passing — a short "that's it" in ${targetLanguage}, not a lecture — and carry the conversation forward.
- If they did not fix it, or repeated the same error: give them the correct form now, plainly and without fuss, and move on.
Either way, do NOT ask them to try again. One attempt is the whole point; a second request stops being teaching and starts being an interrogation.`;

    case 'signal_non_understanding':
      return `THIS TURN: if any part of what they said is genuinely unclear to you — ambiguous, missing a word, or two readings — say so and ask, rather than guessing well and moving on. "Sorry, do you mean X or Y?", "What do you mean by ___?", or a confirmation check.
This is not pretending to be confused. If the turn is perfectly clear, respond normally. But when it is not, the asking IS the lesson: their next attempt to make themselves understood is where the learning happens, and a tutor who always understands perfectly has quietly removed it.`;

    case 'change_subject':
      return `THIS TURN: the conversation has run out of road — their last few answers have been very short. That is usually the topic's fault, not theirs. Take it somewhere new: offer a different angle on the scene, or ask about something concrete and easy to have an opinion about. Keep it in character. Do not comment on the fact that they were being brief, and do not ask whether they want to continue.`;

    case 'close':
      return `THIS TURN: bring the conversation to a natural end. Acknowledge one specific thing they said or did well — a real detail from this conversation, not generic praise — and close warmly. Do not ask a new question, and do not start a new topic.`;
  }
}
