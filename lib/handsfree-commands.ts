/**
 * Spoken command recognition for hands-free sessions.
 *
 * In an eyes-free session the learner's voice is the only input, so the same
 * microphone turn has to carry both answers and controls. This module decides
 * which one an utterance was.
 *
 * There is no wake word and no always-on listening. Commands are matched
 * against the transcript the session already produced for grading, so
 * recognising them costs nothing extra — no second STT stream, no continuous
 * upload, and no "is it listening right now?" question to answer.
 *
 * TWO RULES KEEP THIS FROM EATING REAL ANSWERS:
 *
 *  1. Whole-utterance matching only. "Skip" is a command; "I want to skip
 *     breakfast" is an answer that happens to contain the word.
 *  2. The expected answer always wins. If a card is teaching the Spanish word
 *     "pausa" and the learner says "pausa", that is the answer — grading it as
 *     a pause command would make the card impossible to ever get right.
 *
 * Commands are matched in the learner's OWN language, not the target language.
 * Someone mid-lesson in Spanish still says "skip" in English, and expecting
 * target-language controls from a beginner is a usability trap.
 */

import { normalize, stripDiacritics } from './grading';
import { gradeSpeechTranscription } from './grading';
import type { HandsFreeCommand } from './handsfree-session';

export type UtteranceClassification =
  | { kind: 'command'; command: HandsFreeCommand }
  | { kind: 'answer' };

/**
 * Command phrases per language. Only the four commands the session engine
 * actually implements are listed — a phrase for a command that does nothing is
 * worse than no phrase at all, because the learner gets silence and assumes
 * the microphone failed.
 *
 * English ships first. Other languages fall back to English rather than losing
 * controls entirely.
 */
export const COMMAND_PHRASES: Record<string, Record<HandsFreeCommand, string[]>> = {
  en: {
    pause: ['pause', 'hold on', 'wait', 'stop for a second', 'pause session'],
    repeat: ['repeat', 'again', 'say that again', 'one more time', 'repeat that'],
    skip: ['skip', 'next', 'skip this', 'next one', 'move on'],
    end: ['stop', 'end session', 'finish', "i'm done", 'im done', 'quit'],
  },
  es: {
    pause: ['pausa', 'espera', 'un momento'],
    repeat: ['repite', 'otra vez', 'de nuevo'],
    skip: ['salta', 'siguiente', 'siguiente carta'],
    end: ['termina', 'terminar', 'basta', 'he terminado'],
  },
};

const FALLBACK_LANGUAGE = 'en';

/** Normalise for comparison: case, whitespace, punctuation and accents. */
function canonical(text: string): string {
  return stripDiacritics(normalize(text));
}

/**
 * The similarity at which an utterance is considered to BE the expected
 * answer. Matches `gradeSpeechTranscription`'s own pass mark so a command can
 * never steal an utterance that grading would have accepted.
 */
const ANSWER_MATCH_SCORE = 60;

function phrasesFor(language: string): Record<HandsFreeCommand, string[]> {
  const key = (language || '').slice(0, 2).toLowerCase();
  return COMMAND_PHRASES[key] ?? COMMAND_PHRASES[FALLBACK_LANGUAGE];
}

/**
 * Classify a transcript as a command or an answer.
 *
 * @param transcript   What the learner said, as transcribed.
 * @param nativeLanguage The learner's L1 — commands are spoken in it.
 * @param expectedText The answer this card is looking for.
 * @param acceptedVariants Other spellings/forms the card accepts.
 */
export function classifyUtterance(
  transcript: string,
  nativeLanguage: string,
  expectedText: string,
  acceptedVariants: string[] = [],
): UtteranceClassification {
  const said = canonical(transcript);
  if (said.length === 0) return { kind: 'answer' };

  const table = phrasesFor(nativeLanguage);

  let matched: HandsFreeCommand | null = null;
  for (const command of Object.keys(table) as HandsFreeCommand[]) {
    // Whole-utterance equality, never substring containment.
    if (table[command].some((phrase) => canonical(phrase) === said)) {
      matched = command;
      break;
    }
  }

  if (matched === null) return { kind: 'answer' };

  // The veto. Reuses the real grader rather than a private similarity check,
  // so the boundary between "this is the answer" and "this is a command" can
  // never drift away from the boundary grading actually applies.
  const asAnswer = gradeSpeechTranscription(transcript, expectedText, acceptedVariants);
  if (asAnswer.score >= ANSWER_MATCH_SCORE) return { kind: 'answer' };

  return { kind: 'command', command: matched };
}
