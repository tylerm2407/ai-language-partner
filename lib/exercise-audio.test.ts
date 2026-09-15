/**
 * Every prompt string in this file was taken from a real row in the shipped
 * `exercises` table, not invented. The whole point of `exerciseListenTarget`
 * is that it reads templates the content bank actually uses, so a test built
 * from imagined prompts would prove nothing.
 */
import { exerciseListenTarget } from './exercise-audio';
import type { Exercise, ExerciseType } from '../types';

function ex(partial: Partial<Exercise> & { type: ExerciseType }): Exercise {
  return {
    id: 'e1',
    lessonId: 'l1',
    orderIndex: 0,
    prompt: '',
    promptAudioUrl: null,
    correctAnswer: '',
    acceptedAnswers: [],
    options: null,
    hintText: null,
    cardId: null,
    skillType: 'vocabulary',
    ...partial,
  };
}

describe('exerciseListenTarget', () => {
  describe('types that already play their own audio', () => {
    it.each(['listening_choice', 'listening_type', 'dictation', 'speaking'] as const)(
      'adds no second button to %s',
      (type) => {
        expect(
          exerciseListenTarget(
            ex({ type, prompt: 'A bola está com você', targetWord: 'A bola está com você' }),
            'pt',
          ),
        ).toBeNull();
      },
    );
  });

  describe('the "What does X mean" template', () => {
    it('speaks the quoted word and offers it straight away', () => {
      const target = exerciseListenTarget(
        ex({
          type: 'multiple_choice',
          prompt: 'What does "Porte" mean in English?',
          correctAnswer: 'Door',
          acceptedAnswers: ['Door'],
          options: ['Room', 'Chair', 'Bathroom', 'Door'],
        }),
        'fr',
      );
      expect(target).toEqual({ text: 'Porte', availableBeforeAnswer: true });
    });

    it('handles a non-Latin script the same way', () => {
      expect(
        exerciseListenTarget(
          ex({
            type: 'multiple_choice',
            prompt: 'What does "줄거리" mean in English?',
            correctAnswer: 'Plot',
            acceptedAnswers: ['Plot'],
          }),
          'ko',
        ),
      ).toEqual({ text: '줄거리', availableBeforeAnswer: true });
    });

    it('ignores a quoted span in a grammar stem', () => {
      expect(
        exerciseListenTarget(
          ex({
            type: 'sentence_transformation',
            skillType: 'grammar',
            prompt: 'Combine into one sentence with «se» + futuro do conjuntivo: Tu vens a casa.',
            correctAnswer: 'Se tu vieres a casa...',
          }),
          'pt',
        ),
      ).toBeNull();
    });
  });

  describe('the "Translate to X" template', () => {
    it('reads the prompt tail when translating INTO the learner language', () => {
      expect(
        exerciseListenTarget(
          ex({
            type: 'translate_to_native',
            prompt: 'Translate to English: Pendant ce temps',
            correctAnswer: 'Meanwhile',
            acceptedAnswers: ['Meanwhile'],
          }),
          'fr',
        ),
      ).toEqual({ text: 'Pendant ce temps', availableBeforeAnswer: true });
    });

    it('reads the ANSWER when translating INTO the target language, and holds it back', () => {
      expect(
        exerciseListenTarget(
          ex({
            type: 'translate_to_target',
            prompt: 'Translate to Spanish: Salary',
            correctAnswer: 'Salario',
            acceptedAnswers: ['Salario', 'El salario'],
          }),
          'es',
        ),
      ).toEqual({ text: 'Salario', availableBeforeAnswer: false });
    });

    it('still matches when the instruction carries a grammar rider', () => {
      expect(
        exerciseListenTarget(
          ex({
            type: 'translate_to_target',
            skillType: 'grammar',
            prompt:
              'Translate to German in the Perfekt: Yesterday I turned twenty-two. Use werden.',
            correctAnswer: 'Gestern bin ich zweiundzwanzig geworden.',
          }),
          'de',
        ),
      ).toEqual({
        text: 'Gestern bin ich zweiundzwanzig geworden.',
        availableBeforeAnswer: false,
      });
    });

    it('declines rather than guesses when the course language is unknown', () => {
      expect(
        exerciseListenTarget(
          ex({
            type: 'translate_to_target',
            prompt: 'Translate to Spanish: Salary',
            correctAnswer: 'Salario',
          }),
          undefined,
        ),
      ).toBeNull();
    });
  });

  describe('gapped prompts', () => {
    it('fills the gap and holds the button until the answer is in', () => {
      expect(
        exerciseListenTarget(
          ex({
            type: 'fill_blank',
            prompt: 'Fiè_____ (Fever)',
            correctAnswer: 'vre',
            acceptedAnswers: ['vre'],
          }),
          'fr',
        ),
      ).toEqual({ text: 'Fièvre', availableBeforeAnswer: false });
    });

    it('drops the trailing native gloss from a cloze sentence', () => {
      expect(
        exerciseListenTarget(
          ex({
            type: 'cloze_deletion',
            prompt: '___ работу, она пошла домой. (Having finished work, she went home.)',
            correctAnswer: 'Закончив',
          }),
          'ru',
        ),
      ).toEqual({
        text: 'Закончив работу, она пошла домой.',
        availableBeforeAnswer: false,
      });
    });
  });

  describe('an explicit targetWord', () => {
    it('is used as-is, and is playable when it is also on screen', () => {
      // The shape ReviewChoiceCard synthesises: the target word IS the prompt,
      // and the answer is its meaning in the learner's language.
      expect(
        exerciseListenTarget(
          ex({
            type: 'translate_to_native',
            prompt: 'el teclado',
            targetWord: 'el teclado',
            correctAnswer: 'keyboard',
            acceptedAnswers: ['keyboard'],
          }),
          'es',
        ),
      ).toEqual({ text: 'el teclado', availableBeforeAnswer: true });
    });

    it('is held back when it is the answer rather than the question', () => {
      expect(
        exerciseListenTarget(
          ex({
            type: 'multiple_choice',
            prompt: 'Which word means "keyboard"?',
            targetWord: 'el teclado',
            correctAnswer: 'el teclado',
            acceptedAnswers: ['el teclado'],
            options: ['el teclado', 'la mesa', 'el ratón', 'la silla'],
          }),
          'es',
        ),
      ).toEqual({ text: 'el teclado', availableBeforeAnswer: false });
    });
  });

  describe('prompts nothing can be concluded from', () => {
    it('returns null for a free-production brief', () => {
      expect(
        exerciseListenTarget(
          ex({
            type: 'free_production',
            prompt: 'Write a sentence using the expression: 걱정 마 (No worries)',
            correctAnswer: '',
          }),
          'ko',
        ),
      ).toBeNull();
    });

    it('returns null for an error-correction stem, whose prompt is wrong on purpose', () => {
      expect(
        exerciseListenTarget(
          ex({
            type: 'error_correction',
            prompt: 'As cartas foi entregado ontem.',
            correctAnswer: 'As cartas foram entregues ontem.',
          }),
          'pt',
        ),
      ).toBeNull();
    });

    it('returns null for an empty prompt', () => {
      expect(exerciseListenTarget(ex({ type: 'multiple_choice' }), 'es')).toBeNull();
    });
  });
});
