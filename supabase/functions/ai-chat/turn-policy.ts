// Two governors on the tutor's behaviour: how much room the learner gets, and
// how hard they are pushed.
//
// Pure, no I/O, `deno test`-able. Same split as ./prompt.ts and
// ./dialogue-act.ts.
//
// ── Why these two, and why they are unusual ──
//
// Across the AI-conversation category — thirteen products surveyed, including
// the funded market leader — not one pushes a learner past what they can
// already do comfortably, and not one governs how much of the conversation the
// AI itself consumes. Both are cheap to build. Both run against what an
// instruction-tuned model wants to do, which is why nobody has them.
//
// FLOOR SHARE. A 2026 within-participant study of 78 university learners
// found that against an AI, learners take roughly three times fewer turns than
// with a human partner, and their share of the floor drops from 0.48 to 0.37 —
// the AI talks, the learner listens. The authors' own headline recommendation
// is to calibrate AI verbosity down. The market leader's most-cited complaint
// ("every turn ends in a question", "it feels like an interrogation") is the
// same disease presenting differently.
//
// PUSHED OUTPUT. Swain's output hypothesis came from immersion students who,
// after years of rich input, were fluent but inaccurate. Production drives
// acquisition only when the learner is stretched past comfort — it forces them
// to notice the gap between what they mean and what they can currently say.
// Every rival accommodates DOWNWARD to keep the conversation flowing, which is
// the opposite move. Speak's top complaint is that it stays at beginner level
// however hard the learner pushes.
//
// ── The cost of both ──
//
// They make the session feel harder. The same 2026 study found learner
// satisfaction was predicted by their own in-session fluency and NOT by how
// much language they actually took up — felt progress is decoupled from real
// progress. So these ship attached to visible measured proficiency
// (conversation_evidence, migration 095) or they read as "the app got
// annoying" and the learner leaves. That is a product constraint, not a
// footnote.

/** A turn as the model sees it. */
export interface PolicyMessage {
  role: string;
  content: string;
}

function words(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

// ─── Floor share ──────────────────────────────────────────────────────────

/**
 * The learner's share of the words spoken so far, 0-1.
 *
 * Words rather than turns: turn counts are equal by construction in a
 * strictly alternating chat, so they would report 0.5 forever while the tutor
 * said three times as much. Words are what the floor actually is.
 *
 * Returns null when there is nothing to measure yet — a fresh conversation has
 * no ratio, and treating that as 0 would open every conversation by scolding
 * the tutor for talking.
 */
export function learnerFloorShare(messages: PolicyMessage[]): number | null {
  let learner = 0;
  let tutor = 0;
  for (const m of messages) {
    const n = words(m.content);
    if (m.role === 'assistant') tutor += n;
    else learner += n;
  }
  const total = learner + tutor;
  if (total === 0) return null;
  return learner / total;
}

/**
 * The share we want the learner to hold.
 *
 * Above a half, deliberately. Equal shares would already be an improvement on
 * the 0.37 measured for AI dialogue, but a language tutor is not a
 * conversational peer: the learner's talking time is the product, and ours is
 * overhead. This is the target the governor pulls toward, not a hard cap —
 * nothing truncates a reply mid-sentence.
 */
export const LEARNER_FLOOR_TARGET = 0.55;

/**
 * How far below target the floor must fall before we say anything.
 *
 * A dead band. Without it the tutor would be told to be brief on almost every
 * turn, since a natural reply is often longer than a beginner's, and a tutor
 * clipped to nothing stops modelling the language at all — which is its other
 * job. Only a sustained imbalance is worth correcting.
 */
export const FLOOR_SLACK = 0.1;

/** Turns before the ratio means anything. Two exchanges is noise. */
const FLOOR_MIN_MESSAGES = 4;

/**
 * A brevity instruction, or null when the balance is fine.
 *
 * Null most of the time is the intended behaviour: this is a governor, not a
 * style, and a permanent "be brief" would just be a shorter system prompt.
 */
export function floorShareNote(messages: PolicyMessage[]): string | null {
  if (messages.length < FLOOR_MIN_MESSAGES) return null;
  const share = learnerFloorShare(messages);
  if (share === null) return null;
  if (share >= LEARNER_FLOOR_TARGET - FLOOR_SLACK) return null;

  return `THIS TURN: you have been doing most of the talking — the learner has produced only ${Math.round(share * 100)}% of the words in this conversation, and their practice is the entire point of it. Keep this reply short: one sentence of reaction, then hand the floor straight back. Do not explain, do not offer examples they did not ask for, and do not stack a second question on the first.`;
}

// ─── Pushed output ────────────────────────────────────────────────────────

export interface PushSignal {
  /** Mean 0-1 score across the learner's recent scored turns at their level. */
  recentAccuracy: number | null;
  /** How many scored turns that mean is over. */
  sampleSize: number;
}

/**
 * Scored turns before we will act on an accuracy mean.
 *
 * Small samples of a noisy per-turn score say nothing, and pushing a learner
 * because of two lucky turns is worse than never pushing at all.
 */
export const PUSH_MIN_SAMPLE = 8;

/**
 * Above this, the learner is coasting.
 *
 * Set above the band pass mark (0.7 in lib/cefr-proficiency.ts), not at it.
 * A learner scoring exactly at pass is being appropriately challenged; one
 * comfortably clear of it is being under-served by the level they are on.
 */
export const PUSH_ACCURACY_CEILING = 0.85;

export type PushStance = 'hold' | 'stretch';

/**
 * Should this turn stretch the learner past what they can already do?
 *
 * `hold` unless there is real evidence of comfort. The asymmetry is
 * deliberate: pushing someone who is struggling compounds the failure and
 * raises exactly the speaking anxiety the product exists to lower, while
 * failing to push someone who is coasting costs them a turn.
 */
export function selectPushStance(signal: PushSignal): PushStance {
  if (signal.recentAccuracy === null) return 'hold';
  if (signal.sampleSize < PUSH_MIN_SAMPLE) return 'hold';
  return signal.recentAccuracy >= PUSH_ACCURACY_CEILING ? 'stretch' : 'hold';
}

/**
 * The stretch instruction, or null when holding.
 *
 * Note what it does NOT say: nothing about speaking faster, using rarer words,
 * or making the tutor harder to understand. Stretching means asking for a
 * language FUNCTION the learner has not had to perform yet — hypothesising,
 * disagreeing politely, narrating something that already happened. That is
 * what pushed output means, and it is why this is not simply "raise the CEFR
 * level of your vocabulary".
 */
export function pushNote(stance: PushStance, targetLanguage: string): string | null {
  if (stance === 'hold') return null;
  return `THIS TURN: this learner is comfortable at their current level — they have been getting it right consistently. Stretch them. Ask something that needs a language function they have not had to use yet in this conversation: speculate about what might happen, disagree with you and say why, explain a reason, or describe something that already happened. Keep it inside the scene and keep your own ${targetLanguage} at their level — the demand goes on what THEY have to produce, not on how hard you are to follow. If they cannot manage it, help them through it and do not push again this session.`;
}
