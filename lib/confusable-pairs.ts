/**
 * Confusable word pairs per language.
 * Used to prevent fuzzy matching from accepting words with completely different meanings.
 * When a user's answer fuzzy-matches the correct answer, we check if the user's input
 * is actually a confusable pair — if so, reject the fuzzy match.
 */

import type { LanguageCode } from '../types';

// Each entry is [word1, word2] where the two words are easily confused via typo
// but have completely different meanings.
const CONFUSABLE_PAIRS: Partial<Record<LanguageCode, [string, string][]>> = {
  es: [
    ['gato', 'rato'],       // cat vs. while/mouse
    ['pero', 'perro'],      // but vs. dog
    ['el', 'él'],           // the vs. he
    ['caro', 'carro'],      // expensive vs. car
    ['casa', 'caza'],       // house vs. hunt
    ['año', 'ano'],         // year vs. anus
    ['papa', 'papá'],       // potato vs. dad
    ['si', 'sí'],           // if vs. yes
    ['como', 'cómo'],       // as/like vs. how
    ['donde', 'dónde'],     // where (relative) vs. where (question)
    ['solo', 'sólo'],       // alone vs. only
    ['que', 'qué'],         // that vs. what
    ['tu', 'tú'],           // your vs. you
    ['mas', 'más'],         // but (literary) vs. more
    ['se', 'sé'],           // reflexive pronoun vs. I know
    ['pena', 'pene'],       // shame vs. penis
    ['pollo', 'polo'],      // chicken vs. pole
    ['hombre', 'hambre'],   // man vs. hunger
  ],
  fr: [
    ['le', 'les'],          // the (singular) vs. the (plural)
    ['ou', 'où'],           // or vs. where
    ['sur', 'sûr'],         // on vs. sure
    ['du', 'dû'],           // of the vs. owed
    ['des', 'dès'],         // some vs. from
    ['a', 'à'],             // has vs. to
    ['poison', 'poisson'],  // poison vs. fish
    ['dessus', 'dessous'],  // above vs. below
    ['bon', 'bonne'],       // good (m) vs. good (f)
    ['mer', 'mère'],        // sea vs. mother
  ],
  de: [
    ['der', 'die'],         // the (m) vs. the (f)
    ['sein', 'seine'],      // his vs. his (f)
    ['noch', 'nach'],       // still vs. after
    ['weg', 'Weg'],         // away vs. path
    ['Rat', 'Rad'],         // advice vs. wheel
    ['Bein', 'Biene'],      // leg vs. bee
    ['Wand', 'Wunde'],      // wall vs. wound
  ],
  it: [
    ['anno', 'hanno'],      // year vs. they have
    ['pesca', 'pesce'],     // peach/fishing vs. fish
    ['sono', 'suono'],      // I am/they are vs. sound
    ['nonno', 'nono'],      // grandfather vs. ninth
    ['caldo', 'freddo'],    // hot vs. cold (not typo-confusable but common error)
  ],
  pt: [
    ['avô', 'avó'],        // grandfather vs. grandmother
    ['pais', 'país'],       // parents vs. country
    ['pode', 'pôde'],       // can vs. could
    ['por', 'pôr'],         // by/for vs. to put
  ],
};

/**
 * Check if two words form a confusable pair in the given language.
 * Returns true if they are confusable (i.e., the fuzzy match should be REJECTED).
 */
export function isConfusablePair(
  word1: string,
  word2: string,
  language: LanguageCode
): boolean {
  const pairs = CONFUSABLE_PAIRS[language];
  if (!pairs) return false;

  const w1 = word1.toLowerCase().trim();
  const w2 = word2.toLowerCase().trim();

  return pairs.some(
    ([a, b]) =>
      (a.toLowerCase() === w1 && b.toLowerCase() === w2) ||
      (a.toLowerCase() === w2 && b.toLowerCase() === w1)
  );
}
