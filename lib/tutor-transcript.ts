/**
 * The live transcript of a speech-to-speech tutor call.
 *
 * The learner is listening, not reading — the transcript is there so they can
 * check a word they half-heard, and so the session can be reviewed afterwards.
 * That makes ACCURACY the whole job. A transcript that is merely close is
 * worse than none: a learner who reads a word the tutor never said will try to
 * use it, and we will have taught it to them.
 *
 * Pure. No clock, no I/O, no network types. It takes plain `{ id, seq, delta }`
 * inputs and returns new state, so every trap below is covered by
 * `tutor-transcript.test.ts` without a socket or a device. Deliberately NOT
 * coupled to the realtime event or session modules: the wire format is a
 * vendor detail that will change, and the ordering rules here will not.
 *
 * ── THE THREE TRAPS ──
 *
 * 1. OUT-OF-ORDER DELTAS. Text arrives as fragments over a socket and there is
 *    no promise they are applied in the order they were produced. Appending on
 *    arrival scrambles the sentence. So every fragment carries a `seq` and the
 *    text is rendered from fragments SORTED by it. `seq` is not optional and
 *    cannot be: without an ordinal there is nothing to sort by, and "the order
 *    they turned up" is precisely the thing we do not trust.
 *
 * 2. DUPLICATE DELTAS. A reconnect or a retried frame can deliver the same
 *    fragment twice, which naive appending renders as a stutter — "I I think".
 *    Applying a fragment is therefore idempotent on (id, seq): the second
 *    arrival is dropped and the state object is returned UNCHANGED by
 *    identity, so React re-renders nothing.
 *
 * 3. TRUNCATION ON BARGE-IN. This is the important one. When the learner
 *    interrupts, the tutor's audio is cut where they cut it — but the text
 *    deltas for the rest of that turn have often already arrived, and more may
 *    still arrive after the cancel. Left alone, the transcript shows two
 *    sentences the learner never heard, presented exactly like the ones they
 *    did. `truncateCurrentTutorTurn` exists to stop that: it marks the turn
 *    `interrupted`, optionally cuts it back to what was actually spoken, and
 *    from then on the turn is SEALED — later deltas and the eventual `done`
 *    (which carries the full untruncated transcript) are ignored rather than
 *    quietly restoring the text we just removed.
 */

export type TranscriptRole = 'learner' | 'tutor';

export type TurnStatus =
  /** Still receiving fragments. */
  | 'streaming'
  /** Finished normally; the text is final. */
  | 'complete'
  /** Cut off by a barge-in. The text is what was heard, and no more. */
  | 'interrupted';

/** One fragment of a turn, positioned by `seq`. */
export interface TranscriptFragment {
  seq: number;
  text: string;
}

export interface TranscriptTurn {
  id: string;
  role: TranscriptRole;
  /** Rendered text: fragments in `seq` order, or the authoritative final text. */
  text: string;
  status: TurnStatus;
  /**
   * Bookkeeping, not for display. Kept on the turn rather than in a side map
   * so the whole transcript stays one plain serialisable object — it can be
   * snapshotted, logged or restored without a companion structure.
   */
  fragments: readonly TranscriptFragment[];
}

export interface TranscriptState {
  /** In first-seen order. Learner and tutor turns interleave. */
  turns: readonly TranscriptTurn[];
}

/** A streamed fragment. `seq` is required — see trap 1. */
export interface DeltaInput {
  id: string;
  seq: number;
  delta: string;
}

/** A turn ending. `text`, when present, is the server's authoritative version. */
export interface CompletionInput {
  id: string;
  text?: string;
}

export function emptyTranscript(): TranscriptState {
  return { turns: [] };
}

/** A turn is sealed once it has ended, however it ended. */
function isSealed(turn: TranscriptTurn): boolean {
  return turn.status !== 'streaming';
}

function renderFragments(fragments: readonly TranscriptFragment[]): string {
  return fragments.map((f) => f.text).join('');
}

/**
 * Insert a fragment in `seq` order, or return `null` if this `seq` is already
 * present.
 *
 * On a duplicate `seq` the FIRST text wins and the second is discarded rather
 * than overwriting. If the two ever differ we have no way to tell which is
 * right, and swapping text under a learner who is reading it is the worse of
 * the two wrong answers.
 */
function insertFragment(
  fragments: readonly TranscriptFragment[],
  fragment: TranscriptFragment,
): TranscriptFragment[] | null {
  const next = fragments.slice();
  let i = next.length;
  while (i > 0 && next[i - 1].seq > fragment.seq) i--;
  if (i > 0 && next[i - 1].seq === fragment.seq) return null;
  next.splice(i, 0, fragment);
  return next;
}

function replaceTurn(
  state: TranscriptState,
  index: number,
  turn: TranscriptTurn,
): TranscriptState {
  const turns = state.turns.slice();
  turns[index] = turn;
  return { turns };
}

/**
 * Apply one streamed fragment.
 *
 * Creates the turn on first sight. Ignores anything addressed to a turn that
 * has already ended — including a turn cut short by a barge-in, which is the
 * whole point of trap 3.
 */
export function applyDelta(
  state: TranscriptState,
  role: TranscriptRole,
  input: DeltaInput,
): TranscriptState {
  const index = state.turns.findIndex((t) => t.id === input.id);

  if (index === -1) {
    const fragments: TranscriptFragment[] = [{ seq: input.seq, text: input.delta }];
    return {
      turns: [
        ...state.turns,
        { id: input.id, role, text: input.delta, status: 'streaming', fragments },
      ],
    };
  }

  const turn = state.turns[index];
  // Sealed: a late fragment for a finished or interrupted turn. Dropping it is
  // the correct behaviour, not a lossy shortcut — see the header.
  if (isSealed(turn)) return state;

  const fragments = insertFragment(turn.fragments, { seq: input.seq, text: input.delta });
  // Duplicate. Same object back, so nothing downstream re-renders.
  if (fragments === null) return state;

  return replaceTurn(state, index, { ...turn, fragments, text: renderFragments(fragments) });
}

/**
 * End a turn.
 *
 * `text` — the server's authoritative transcript — replaces the accumulated
 * fragments when given, because it is the version that accounts for fragments
 * we may never have received.
 *
 * A completion for a turn we have no fragments for still creates it: a short
 * learner utterance is often transcribed in one shot, arriving as a completion
 * with no deltas at all.
 */
export function completeTurn(
  state: TranscriptState,
  role: TranscriptRole,
  input: CompletionInput,
): TranscriptState {
  const index = state.turns.findIndex((t) => t.id === input.id);

  if (index === -1) {
    const text = input.text ?? '';
    if (text === '') return state; // Nothing was said and nothing to show.
    return {
      turns: [
        ...state.turns,
        { id: input.id, role, text, status: 'complete', fragments: [{ seq: 0, text }] },
      ],
    };
  }

  const turn = state.turns[index];
  // An interrupted turn stays interrupted. The `done` event carries the FULL
  // text of the response, including the part that was cancelled before the
  // learner heard it — accepting it here would undo the truncation one event
  // later, which is the exact bug this module was written to prevent.
  if (isSealed(turn)) return state;

  return replaceTurn(state, index, {
    ...turn,
    status: 'complete',
    text: input.text ?? turn.text,
  });
}

export function applyLearnerDelta(state: TranscriptState, input: DeltaInput): TranscriptState {
  return applyDelta(state, 'learner', input);
}

export function completeLearnerTurn(
  state: TranscriptState,
  input: CompletionInput,
): TranscriptState {
  return completeTurn(state, 'learner', input);
}

export function applyTutorDelta(state: TranscriptState, input: DeltaInput): TranscriptState {
  return applyDelta(state, 'tutor', input);
}

export function completeTutorTurn(
  state: TranscriptState,
  input: CompletionInput,
): TranscriptState {
  return completeTurn(state, 'tutor', input);
}

/** The tutor turn currently being streamed, if there is one. */
export function currentTutorTurn(state: TranscriptState): TranscriptTurn | null {
  for (let i = state.turns.length - 1; i >= 0; i--) {
    const turn = state.turns[i];
    if (turn.role === 'tutor' && turn.status === 'streaming') return turn;
  }
  return null;
}

export interface TruncateOptions {
  /**
   * How many characters of the turn the learner actually heard.
   *
   * The realtime layer derives this from the audio position at the moment of
   * the barge-in. Omit it when that is not knowable: the turn is still marked
   * `interrupted` and sealed, which stops the tail growing, but the text
   * already received is left alone. Marking without cutting is honest;
   * guessing at a cut point is not.
   */
  keepChars?: number;
}

/**
 * Cut the in-flight tutor turn short because the learner interrupted.
 *
 * Three effects, all of them load-bearing:
 *   - the turn is marked `interrupted`, so the UI can show it as cut off
 *     rather than as something the tutor chose to stop saying;
 *   - the text is trimmed to what was heard, when the caller knows that;
 *   - the turn is sealed, so the deltas still in flight for the cancelled
 *     response — and the `done` that follows them — cannot put the removed
 *     text back.
 *
 * A turn the learner heard nothing of is REMOVED entirely rather than left as
 * an empty bubble. There is no honest way to render "the tutor said nothing,
 * loudly", and an empty row in a transcript reads as a bug.
 *
 * No-op when nothing is streaming: a barge-in during silence is normal.
 */
export function truncateCurrentTutorTurn(
  state: TranscriptState,
  options: TruncateOptions = {},
): TranscriptState {
  const index = lastStreamingTutorIndex(state);
  if (index === -1) return state;

  const turn = state.turns[index];
  const keep = options.keepChars;
  const text =
    typeof keep === 'number' && Number.isFinite(keep)
      ? turn.text.slice(0, Math.max(0, keep))
      : turn.text;

  if (text === '') {
    return { turns: state.turns.filter((_, i) => i !== index) };
  }

  // Fragments are collapsed to the surviving text: keeping the originals would
  // let a re-render regrow the part that was cut.
  return replaceTurn(state, index, {
    ...turn,
    status: 'interrupted',
    text,
    fragments: [{ seq: 0, text }],
  });
}

function lastStreamingTutorIndex(state: TranscriptState): number {
  for (let i = state.turns.length - 1; i >= 0; i--) {
    const turn = state.turns[i];
    if (turn.role === 'tutor' && turn.status === 'streaming') return i;
  }
  return -1;
}
