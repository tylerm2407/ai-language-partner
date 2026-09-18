/**
 * In-app input methods for the four courses whose script is not on an English
 * keyboard. See ./types.ts for why the app ships its own.
 */

import type { ExerciseType, LanguageCode } from '../../types';
import type { ScriptInputEngine } from './types';
import { japaneseInput } from './ja';
import { koreanInput } from './ko';
import { chineseInput } from './zh';
import { russianInput } from './ru';

export type { ScriptInputEngine, Conversion, Candidate } from './types';
export { romajiToKana } from './ja';
export { romajaToHangul } from './ko';
export { latinToCyrillic } from './ru';
export { pinyinCandidates, pinyinComposition } from './zh';

const ENGINES: Partial<Record<LanguageCode, ScriptInputEngine>> = {
  ja: japaneseInput,
  ko: koreanInput,
  zh: chineseInput,
  ru: russianInput,
};

/**
 * The input method for a language, or null where the phone's own keyboard
 * already types the script — every Latin-script course, and any field the
 * learner answers in their native language.
 */
export function scriptInputFor(language: LanguageCode | null | undefined): ScriptInputEngine | null {
  if (!language) return null;
  return ENGINES[language] ?? null;
}

/** True when a language needs an input method the phone keyboard cannot give. */
export function needsScriptInput(language: LanguageCode | null | undefined): boolean {
  return scriptInputFor(language) !== null;
}

/**
 * Exercise types whose answer is written in the learner's OWN language.
 *
 * They get the plain keyboard: a learner glossing 水 as "water" is typing
 * English, and handing them a kana converter there would be actively wrong.
 */
const ANSWERS_IN_NATIVE: ReadonlySet<ExerciseType> = new Set<ExerciseType>(['translate_to_native']);

/**
 * The language a given exercise is ANSWERED in — which is not always the
 * course's target language, and is the only thing that should decide whether
 * an input method appears.
 */
export function typedLanguageFor(
  exerciseType: ExerciseType | undefined,
  targetLanguage: LanguageCode | null | undefined,
): LanguageCode | null {
  if (exerciseType && ANSWERS_IN_NATIVE.has(exerciseType)) return null;
  return targetLanguage ?? null;
}
