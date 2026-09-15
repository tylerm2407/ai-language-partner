import { trialExercisesFor, hasTrialLesson } from './trial-lesson';
import { gradeAnswer } from '../../lib/grading';

test('the French name question uses elision and specifies the intended meaning', () => {
  const question = trialExercisesFor('fr')[4];
  expect(question.prompt).toContain('What is your name?');
  expect(question.prompt).toContain('___appelles-tu');
  expect(question.correctAnswer).toBe("t'");
  expect(question.acceptedAnswers).toEqual(["t'"]);
  expect(question.prompt.replace('___', question.correctAnswer)).toContain("Comment t'appelles-tu ?");
  expect(question.explanation).toContain('Before a vowel');
});

test.each(['es', 'fr', 'de'] as const)('%s trial keys grade correctly and choice distractors do not', (language) => {
  const questions = trialExercisesFor(language);
  expect(questions).toHaveLength(8);
  expect(new Set(questions.map(q => q.id)).size).toBe(8);
  for (const question of questions) {
    const hints = { exerciseHints: { exerciseType: question.type, skillType: question.skillType } };
    expect(gradeAnswer(question.correctAnswer, question.correctAnswer, question.acceptedAnswers, hints).isCorrect).toBe(true);
    if (question.type === 'multiple_choice') {
      expect(question.options?.filter(o => o === question.correctAnswer)).toHaveLength(1);
      for (const option of question.options ?? []) {
        expect(gradeAnswer(option, question.correctAnswer, question.acceptedAnswers, hints).isCorrect).toBe(option === question.correctAnswer);
      }
    }
  }
});

test.each(['it', 'pt', 'ja', 'ko', 'zh', 'ru'] as const)('the %s trial never falls back to another language', (language) => {
  expect(hasTrialLesson(language)).toBe(false);
  expect(trialExercisesFor(language)).toEqual([]);
});
