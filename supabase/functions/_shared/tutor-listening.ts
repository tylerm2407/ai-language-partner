// The listening check that follows a live tutor session.
//
// Pure, no I/O, `deno test`-able. Same split as `turn-accuracy.ts`.
//
// ── Why this exists ──
//
// Listening was the one strand a conversation could not evidence. The measured
// CEFR level reads listening from graded lesson exercises alone
// (`listening_choice`, `listening_type`, `dictation`), so a learner who spent
// every session talking to the tutor — and who necessarily understood the
// tutor to answer at all — had a listening strand of zero. Minutes of audio
// are exposure, and `assessListening` has always refused to turn exposure into
// a level, correctly: we record how long audio played, never whether any of it
// landed.
//
// This asks. After the session, a few multiple-choice questions about what the
// TUTOR actually said, drawn from the transcript the analysis already has.
// Getting them right is evidence the learner followed the conversation; it is
// the same claim `listening_choice` makes in a lesson, about speech the learner
// chose to have rather than speech an author scripted.
//
// ── Why the answers never reach the client ──
//
// `tutor_sessions` is client-readable (`Users read own tutor sessions`), and
// the debrief lives in a column of it. So the debrief carries QUESTIONS ONLY —
// `TutorListeningPrompt` — while the answer key stays in
// `tutor_listening_checks`, which is service-role only. Grading happens on the
// server, exactly as `checkpoint` does it and for the same reason: a
// client-visible answer key makes the score self-assigned, and this score
// moves a measured CEFR level.
//
// ── Why the model writes the questions and not a template ──
//
// The questions have to be about this conversation. A template can ask "what
// did the tutor suggest?" of any transcript and will be unanswerable for half
// of them. The model reading the transcript is the only thing positioned to
// find the three moments worth asking about — and `normalizeListeningCheck`
// throws away anything it returns that is not a usable question, because a
// malformed item that reached a learner would be scored against them.

/** One item as the model produces it: the question, its options, and the key. */
export interface TutorListeningItem {
  /** The question, in the learner's OWN language. Comprehension, not reading. */
  question: string;
  /** Answer options, in the learner's own language. Exactly `OPTIONS_PER_ITEM`. */
  options: string[];
  /** Index into `options`. Never sent to a client before they answer. */
  answerIndex: number;
}

/** The same item with the key removed — what a client is allowed to see. */
export interface TutorListeningPrompt {
  question: string;
  options: string[];
}

/**
 * Questions per session.
 *
 * Three, not ten. A debrief the learner has to work through stops being a
 * debrief, and the strand needs `MIN_LISTENING_ITEMS` (10) per band, so three a
 * session means roughly four sessions before conversation alone can speak to
 * listening at a band — which is about the right weight for a check this
 * light. Ten questions after every call would also be ten chances to end a
 * good session on a wrong answer.
 */
export const MAX_LISTENING_ITEMS = 3;

/** Options per item. Matches the four-option shape of every other exercise. */
export const OPTIONS_PER_ITEM = 4;

/** Longest question or option we will store, after trimming. */
export const MAX_ITEM_CHARS = 200;

/**
 * Shortest transcript, in TUTOR turns, worth asking about.
 *
 * A session where the tutor said two things has nothing to test comprehension
 * of, and three questions drawn from it would be three questions about the
 * same sentence. Below this the check is skipped entirely and the session
 * simply produces no listening evidence — which is the honest outcome, not a
 * gap to be filled.
 */
export const MIN_TUTOR_TURNS_FOR_CHECK = 4;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_ITEM_CHARS) : '';
}

/**
 * Coerce whatever the model returned into items we are willing to ask.
 *
 * Every rule here throws an item away rather than repairing it. A repaired
 * question is a question nobody wrote, and this one is scored against a
 * learner's measured level.
 *
 *  - The question and every option must be non-empty after trimming.
 *  - There must be exactly `OPTIONS_PER_ITEM` options. Fewer makes the guess
 *    cheaper than the exercise it is standing in for; more is not the shape
 *    the client renders.
 *  - Options must be distinct, case-insensitively. Two identical options mean
 *    either two right answers or a wasted one, and the learner cannot tell
 *    which.
 *  - `answerIndex` must actually index the options. A model that returns 4 for
 *    a four-option item has told us it does not know its own answer.
 */
export function normalizeListeningCheck(raw: unknown): TutorListeningItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TutorListeningItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;

    const question = clean(row.question);
    if (!question) continue;

    if (!Array.isArray(row.options)) continue;
    const options = row.options.map(clean);
    if (options.length !== OPTIONS_PER_ITEM) continue;
    if (options.some((o) => !o)) continue;

    const seen = new Set(options.map((o) => o.toLowerCase()));
    if (seen.size !== options.length) continue;

    const answerIndex = typeof row.answerIndex === 'number' ? Math.trunc(row.answerIndex) : -1;
    if (answerIndex < 0 || answerIndex >= options.length) continue;

    out.push({ question, options, answerIndex });
    if (out.length === MAX_LISTENING_ITEMS) break;
  }

  return out;
}

/** Strip the answer key. The only shape that may cross to a client. */
export function toPrompts(items: TutorListeningItem[]): TutorListeningPrompt[] {
  return items.map((item) => ({ question: item.question, options: item.options }));
}

export interface ListeningGrade {
  /** Per item, in order. An unanswered or out-of-range choice is wrong. */
  correct: boolean[];
  correctCount: number;
  total: number;
}

/**
 * Grade a submission.
 *
 * `answers` is whatever the client sent, so it is treated as hostile: it may be
 * short, long, sparse, or full of values that are not option indices. Anything
 * that is not exactly the right answer is wrong — including a missing one. The
 * grade is over `items.length`, never over how many answers arrived, so a
 * client cannot raise its own score by submitting only the ones it liked.
 */
export function gradeListeningCheck(
  items: TutorListeningItem[],
  answers: unknown,
): ListeningGrade {
  const given = Array.isArray(answers) ? answers : [];
  const correct = items.map((item, i) => {
    const answer = given[i];
    return typeof answer === 'number' && Math.trunc(answer) === item.answerIndex;
  });
  return {
    correct,
    correctCount: correct.filter(Boolean).length,
    total: items.length,
  };
}
