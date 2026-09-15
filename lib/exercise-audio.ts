/**
 * Which text on an exercise is the target-language word, and may the learner
 * hear it yet?
 *
 * WHY THIS IS NOT A LOOKUP TABLE BY TYPE
 * --------------------------------------
 * The obvious implementation is `Record<ExerciseType, 'prompt' | 'answer'>`,
 * and it is wrong against the shipped curriculum. `generate-goal-track` writes
 * multiple_choice as "prompt in the learner's language, options in the target
 * language"; the seeded vocabulary bank writes the same type as
 * `What does "Porte" mean in English?` with the options in English. One type,
 * two opposite directions. A table keyed on type would speak the answer aloud
 * for half the questions in the app.
 *
 * So this reads the prompt instead. Every vocabulary exercise in the bank is
 * built from one of four templates, each of which says unambiguously where the
 * target-language text is:
 *
 *   What does "Porte" mean in English?        -> quoted span is the word
 *   Translate to English: Pendant ce temps    -> tail is the word (to native)
 *   Translate to Spanish: Salary              -> the ANSWER is the word
 *   Fiè_____ (Fever)                          -> gap filled by the answer
 *
 * When none of them matches, this returns null and no button is drawn. A
 * silent exercise is a much smaller failure than one that pronounces an
 * English sentence with a Spanish voice, or that reads the right answer out
 * loud before the learner has picked one.
 *
 * THE ANSWER-LEAK RULE
 * --------------------
 * `availableBeforeAnswer` is false whenever the text we would speak is the
 * answer, or contains it. Hearing "Salario" before choosing between four
 * Spanish words is not a listening aid, it is the answer key. Those exercises
 * still get a button — it appears once the answer is in, which is the moment
 * the word is worth hearing anyway.
 */
import { SUPPORTED_LANGUAGES } from '../config/app';
import type { Exercise } from '../types';

/**
 * Types that already own a play button.
 *
 * listening_* and dictation ARE the audio — their whole task is hearing the
 * prompt, and a second button would both duplicate it and, for listening_type,
 * hand over the transcription. speaking renders its own prompt audio plus the
 * HVPT voice-rotation replay (see usePhonemeDrill), which is a deliberately
 * different affordance from this one.
 */
const OWNS_ITS_AUDIO: ReadonlySet<string> = new Set([
  'listening_choice',
  'listening_type',
  'dictation',
  'speaking',
]);

/** A gap in a prompt: three or more underscores, however many the author used. */
const GAP = /_{3,}/;

/**
 * A parenthetical gloss at the end of a prompt — `Fiè_____ (Fever)`.
 *
 * Always the learner's language, never the target's, so it is stripped before
 * anything is spoken. Anchored to the end so a legitimate parenthetical inside
 * a target-language sentence survives.
 */
const TRAILING_GLOSS = /\s*\(([^()]*)\)\s*$/;

/** `Translate to German in the Perfekt: ...` — the language name is group 1. */
const TRANSLATE_TO = /^translate\s+to\s+([a-z]+)\b[^:]*:\s*(.+)$/is;

/**
 * The first quoted span in a prompt, in any of the quote marks the bank uses.
 * Bounded at 80 characters so a stray pair of quotes around a whole paragraph
 * cannot become an 80-cent synthesis.
 */
const QUOTE_CHARS = '"“”«»‘’';
const QUOTED = new RegExp(`[${QUOTE_CHARS}]([^${QUOTE_CHARS}]{1,80})[${QUOTE_CHARS}]`);

export interface ExerciseListenTarget {
  /** Target-language text to synthesise. Never empty. */
  text: string;
  /**
   * May this be played before the learner has answered?
   *
   * False when `text` is the answer or contains it — the button is then held
   * back until the exercise is graded.
   */
  availableBeforeAnswer: boolean;
}

/** Display name for a language code, as the prompt templates spell it. */
function languageName(code: string | undefined): string | null {
  if (!code) return null;
  const short = code.slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.find((l) => l.code === short)?.name ?? null;
}

/** Lowercased, trimmed, stripped of surrounding punctuation — for comparison only. */
function norm(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(new RegExp(`^[\\s${QUOTE_CHARS}¿¡([]+`), '')
    .replace(new RegExp(`[\\s${QUOTE_CHARS}?!.,;:)\\]]+$`), '');
}

function isAnswer(text: string, exercise: Exercise): boolean {
  const n = norm(text);
  if (!n) return true;
  if (n === norm(exercise.correctAnswer)) return true;
  return exercise.acceptedAnswers.some((a) => norm(a) === n);
}

/** Drop the trailing native-language gloss, if there is one. */
function withoutGloss(prompt: string): string {
  return prompt.replace(TRAILING_GLOSS, '').trim();
}

/**
 * The target-language word or phrase an exercise teaches, and whether the
 * learner may hear it before answering. Null when neither can be established.
 *
 * `language` is the course's target language code, used only to tell
 * `Translate to Spanish:` (answer side) from `Translate to English:` (prompt
 * side). Without it the translate templates are skipped rather than guessed.
 */
export function exerciseListenTarget(
  exercise: Exercise,
  language?: string,
): ExerciseListenTarget | null {
  if (OWNS_ITS_AUDIO.has(exercise.type)) return null;

  const prompt = (exercise.prompt ?? '').trim();
  const answer = (exercise.correctAnswer ?? '').trim();

  const decided = decide(exercise, prompt, answer, language);
  if (!decided) return null;

  const text = decided.text.trim();
  if (!text) return null;

  return {
    text,
    availableBeforeAnswer: decided.visibleInPrompt && !isAnswer(text, exercise),
  };
}

/** `visibleInPrompt` means: this exact text is on screen, in the target language. */
function decide(
  exercise: Exercise,
  prompt: string,
  answer: string,
  language: string | undefined,
): { text: string; visibleInPrompt: boolean } | null {
  // 1. An explicit target word wins. Written by the content pipeline, so it
  //    needs no parsing — only a check for whether it is also on screen.
  const targetWord = (exercise.targetWord ?? '').trim();
  if (targetWord) {
    return {
      text: targetWord,
      visibleInPrompt: prompt.toLowerCase().includes(targetWord.toLowerCase()),
    };
  }

  if (!prompt) return null;

  // 2. `Translate to X: Y`. Which side is the target language depends on
  //    whether X names the course language or the learner's.
  const translate = TRANSLATE_TO.exec(prompt);
  if (translate) {
    const target = languageName(language);
    if (!target) return null;
    const namedIsTarget = translate[1].toLowerCase() === target.toLowerCase();
    // "Translate to Spanish: Salary" — the Spanish is the answer.
    if (namedIsTarget) {
      return answer ? { text: answer, visibleInPrompt: false } : null;
    }
    // "Translate to English: Pendant ce temps" — the French is on screen.
    return { text: withoutGloss(translate[2]), visibleInPrompt: true };
  }

  // 3. A quoted span — `What does "Porte" mean in English?`. The question is
  //    about the quoted word, and the quoted word is the target language.
  //
  //    Vocabulary only. A grammar stem quotes the thing it is drilling, not a
  //    word to learn: `Combine into one sentence with «se»` would render a
  //    button that pronounces a clitic.
  if (exercise.skillType !== 'grammar') {
    const quoted = QUOTED.exec(prompt);
    if (quoted) {
      return { text: quoted[1], visibleInPrompt: true };
    }
  }

  // 4. A gap. The sentence is the target language but is incomplete, and what
  //    completes it is the answer — so this is only ever a post-answer play,
  //    of the whole sentence the learner has just finished building.
  const body = withoutGloss(prompt);
  if (GAP.test(body)) {
    if (!answer) return null;
    return { text: body.replace(new RegExp(GAP.source, 'g'), answer), visibleInPrompt: false };
  }

  // 5. Anything else — a bare instruction, a grammar stem, a free-production
  //    brief. Nothing here is reliably the target language, so no button.
  return null;
}
