/**
 * The bundled trial lesson — the first teaching moment, played BEFORE the
 * learner has an account.
 *
 * Why bundled rather than fetched: `courses`, `units`, `lessons` and
 * `exercises` are all RLS `TO authenticated` (migration 004), so a signed-out
 * device cannot read a single row of the curriculum. Opening those tables to
 * `anon` would publish the whole catalogue to anyone holding the publishable
 * key, and signing every visitor in anonymously would drag RevenueCat
 * identity, profile creation and orphan-account cleanup along with it. A
 * hand-authored lesson in the bundle costs nothing at runtime, works offline,
 * and follows the precedent the placement test set for pre-auth content.
 *
 * CONSTRAINT — every exercise here must be gradeable on-device. That rules out
 * `listening_*` and `dictation` (they call the `tts` function, which requires
 * a JWT) and `speaking` (`score-pronunciation`, same). `lib/grading.ts` grades
 * everything used below with no network at all.
 *
 * These sentences deliberately overlap the opening unit of each published
 * course, so the trial is a preview of the real thing rather than a separate
 * demo. When a course's first unit changes materially, change this too.
 */
import type { Exercise, LanguageCode } from '../../types';

/** XP awarded for finishing the trial. Matches a normal first lesson. */
export const TRIAL_LESSON_XP = 20;

/**
 * Stable id for the trial run. LessonRunner keys its resume snapshot on
 * (userId, lessonId) and skips persistence entirely when `userId` is empty,
 * which is always the case here — so this id never reaches storage. It exists
 * because the runner requires one.
 */
export const TRIAL_LESSON_ID = 'trial-lesson';

/** Shorthand for the fields every trial exercise leaves empty. */
function ex(
  index: number,
  fields: Pick<Exercise, 'type' | 'prompt' | 'correctAnswer'> & Partial<Exercise>,
): Exercise {
  return {
    id: `${TRIAL_LESSON_ID}-${index}`,
    lessonId: TRIAL_LESSON_ID,
    orderIndex: index,
    promptAudioUrl: null,
    acceptedAnswers: [fields.correctAnswer],
    options: null,
    hintText: null,
    // Null, not a fabricated uuid: a non-null cardId sends LessonRunner into
    // `recordLessonSrsResult`, which writes review_items for a user that does
    // not exist yet.
    cardId: null,
    skillType: 'vocabulary',
    sourceType: 'seed',
    ...fields,
  };
}

const TRIAL_LESSONS: Partial<Record<LanguageCode, Exercise[]>> = {
  es: [
    ex(0, {
      type: 'multiple_choice',
      prompt: 'Which one means "Good morning"?',
      options: ['Buenas noches', 'Buenos días', 'Hasta luego', 'Por favor'],
      correctAnswer: 'Buenos días',
      explanation: '“Buenos días” is used until about midday.',
    }),
    ex(1, {
      type: 'multiple_choice',
      prompt: 'Which one means "water"?',
      options: ['El pan', 'La leche', 'El agua', 'El café'],
      correctAnswer: 'El agua',
      targetWord: 'agua',
    }),
    ex(2, {
      type: 'translate_to_target',
      prompt: 'I would like a coffee, please.',
      correctAnswer: 'Quiero un café, por favor',
      acceptedAnswers: [
        'Quiero un café, por favor',
        'Quisiera un café, por favor',
        'Me gustaría un café, por favor',
      ],
      hintText: 'querer = to want',
      skillType: 'chunk',
    }),
    ex(3, {
      type: 'fill_blank',
      prompt: 'Yo ___ de Estados Unidos.',
      correctAnswer: 'soy',
      acceptedAnswers: ['soy'],
      hintText: 'ser, first person singular',
      skillType: 'grammar',
      targetGrammar: 'ser-present',
      explanation: 'Origin is a permanent trait, so it takes “ser”, not “estar”.',
    }),
    ex(4, {
      type: 'multiple_choice',
      prompt: 'Complete: "¿Cómo ___ llamas?"',
      options: ['te', 'se', 'me', 'le'],
      correctAnswer: 'te',
      skillType: 'grammar',
      explanation: '“Llamarse” is reflexive — the pronoun matches the person you are asking.',
    }),
    ex(5, {
      type: 'sentence_construction',
      prompt: 'Build: "The restaurant is over there."',
      correctAnswer: 'El restaurante está allí',
      acceptedAnswers: ['El restaurante está allí'],
      distractors: ['es', 'aquí', 'la'],
      skillType: 'grammar',
      explanation: 'Location takes “estar”, even for a building that never moves.',
    }),
    ex(6, {
      type: 'translate_to_native',
      prompt: '¿Dónde está la estación?',
      correctAnswer: 'Where is the station?',
      acceptedAnswers: ['Where is the station?', 'Where is the station'],
    }),
    ex(7, {
      type: 'multiple_choice',
      prompt: 'Someone says "Gracias". What do you say back?',
      options: ['De nada', 'Buenas noches', 'Lo siento', 'Adiós'],
      correctAnswer: 'De nada',
      skillType: 'chunk',
    }),
  ],
  fr: [
    ex(0, {
      type: 'multiple_choice',
      prompt: 'Which one means "Good evening"?',
      options: ['Bonjour', 'Bonsoir', 'Salut', 'Merci'],
      correctAnswer: 'Bonsoir',
    }),
    ex(1, {
      type: 'multiple_choice',
      prompt: 'Which one means "bread"?',
      options: ['Le lait', 'Le pain', "L'eau", 'Le fromage'],
      correctAnswer: 'Le pain',
      targetWord: 'pain',
    }),
    ex(2, {
      type: 'translate_to_target',
      prompt: 'I would like a coffee, please.',
      correctAnswer: 'Je voudrais un café, s\'il vous plaît',
      acceptedAnswers: [
        "Je voudrais un café, s'il vous plaît",
        "Je voudrais un café s'il vous plaît",
        "J'aimerais un café, s'il vous plaît",
      ],
      hintText: 'vouloir, conditional — the polite form',
      skillType: 'chunk',
    }),
    ex(3, {
      type: 'fill_blank',
      prompt: 'Je ___ américain.',
      correctAnswer: 'suis',
      acceptedAnswers: ['suis'],
      hintText: 'être, first person singular',
      skillType: 'grammar',
      targetGrammar: 'etre-present',
    }),
    ex(4, {
      type: 'multiple_choice',
      prompt: 'Complete: "Comment ___ appelles-tu ?"',
      options: ['te', 'se', 'me', 'nous'],
      correctAnswer: 'te',
      skillType: 'grammar',
    }),
    ex(5, {
      type: 'sentence_construction',
      prompt: 'Build: "The restaurant is over there."',
      correctAnswer: 'Le restaurant est là-bas',
      acceptedAnswers: ['Le restaurant est là-bas'],
      distractors: ['ici', 'la', 'sont'],
      skillType: 'grammar',
    }),
    ex(6, {
      type: 'translate_to_native',
      prompt: 'Où est la gare ?',
      correctAnswer: 'Where is the station?',
      acceptedAnswers: ['Where is the station?', 'Where is the station'],
    }),
    ex(7, {
      type: 'multiple_choice',
      prompt: 'Someone says "Merci". What do you say back?',
      options: ['De rien', 'Bonne nuit', 'Pardon', 'Au revoir'],
      correctAnswer: 'De rien',
      skillType: 'chunk',
    }),
  ],
  de: [
    ex(0, {
      type: 'multiple_choice',
      prompt: 'Which one means "Good morning"?',
      options: ['Gute Nacht', 'Guten Morgen', 'Tschüss', 'Bitte'],
      correctAnswer: 'Guten Morgen',
    }),
    ex(1, {
      type: 'multiple_choice',
      prompt: 'Which one means "bread"?',
      options: ['Die Milch', 'Das Brot', 'Das Wasser', 'Der Käse'],
      correctAnswer: 'Das Brot',
      targetWord: 'Brot',
    }),
    ex(2, {
      type: 'translate_to_target',
      prompt: 'I would like a coffee, please.',
      correctAnswer: 'Ich hätte gern einen Kaffee, bitte',
      acceptedAnswers: [
        'Ich hätte gern einen Kaffee, bitte',
        'Ich möchte einen Kaffee, bitte',
      ],
      hintText: 'The polite way to order',
      skillType: 'chunk',
    }),
    ex(3, {
      type: 'fill_blank',
      prompt: 'Ich ___ aus Amerika.',
      correctAnswer: 'komme',
      acceptedAnswers: ['komme'],
      hintText: 'kommen, first person singular',
      skillType: 'grammar',
    }),
    ex(4, {
      type: 'multiple_choice',
      prompt: 'Which article goes with "Buch"?',
      options: ['Der', 'Die', 'Das', 'Den'],
      correctAnswer: 'Das',
      skillType: 'grammar',
      explanation: 'German nouns ending in -uch are often neuter — “das Buch”.',
    }),
    ex(5, {
      type: 'sentence_construction',
      prompt: 'Build: "The restaurant is over there."',
      correctAnswer: 'Das Restaurant ist dort',
      acceptedAnswers: ['Das Restaurant ist dort'],
      distractors: ['hier', 'sind', 'der'],
      skillType: 'grammar',
    }),
    ex(6, {
      type: 'translate_to_native',
      prompt: 'Wo ist der Bahnhof?',
      correctAnswer: 'Where is the station?',
      acceptedAnswers: ['Where is the station?', 'Where is the station'],
    }),
    ex(7, {
      type: 'multiple_choice',
      prompt: 'Someone says "Danke". What do you say back?',
      options: ['Bitte', 'Gute Nacht', 'Entschuldigung', 'Auf Wiedersehen'],
      correctAnswer: 'Bitte',
      skillType: 'chunk',
    }),
  ],
};

/**
 * Exercises for the trial lesson in `language`, or an empty array for the six
 * languages with no bundled trial yet.
 *
 * Deliberately does NOT fall back to Spanish. A learner who picked Korean and
 * is handed a Spanish lesson has been shown the wrong product at the exact
 * moment the flow is meant to prove it works. Callers check `hasTrialLesson`
 * and skip straight to the sign-up ask instead — a shorter flow beats a
 * confusing one.
 *
 * When a language gains a trial, that skip disappears on its own.
 */
export function trialExercisesFor(language: LanguageCode): Exercise[] {
  return TRIAL_LESSONS[language] ?? [];
}

export function hasTrialLesson(language: LanguageCode): boolean {
  return (TRIAL_LESSONS[language]?.length ?? 0) > 0;
}
