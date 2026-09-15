import { trialExercisesFor, hasTrialLesson, TRIAL_LESSONS } from './trial-lesson';
import { topicPackFor } from './topic-packs';
import { gradeAnswer } from '../../lib/grading';
import type { Exercise, LanguageCode } from '../../types';

/**
 * Since onboarding v2 the trial content a learner actually runs is the
 * language's `travel` topic pack; `TRIAL_LESSONS` is the fallback for a
 * language that has no pack. Both paths are guarded here: the pack because it
 * is what ships, the table because it is what runs if a pack is ever removed.
 */
function assertKeysGrade(questions: Exercise[]) {
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
}

test('the French name question uses elision and specifies the intended meaning', () => {
  const question = (TRIAL_LESSONS.fr ?? [])[4];
  expect(question.prompt).toContain('What is your name?');
  expect(question.prompt).toContain('___appelles-tu');
  expect(question.correctAnswer).toBe("t'");
  expect(question.acceptedAnswers).toEqual(["t'"]);
  expect(question.prompt.replace('___', question.correctAnswer)).toContain("Comment t'appelles-tu ?");
  expect(question.explanation).toContain('Before a vowel');
});

test.each(['es', 'fr', 'de'] as const)('%s fallback trial keys grade correctly and choice distractors do not', (language) => {
  const questions = TRIAL_LESSONS[language] ?? [];
  expect(questions).toHaveLength(8);
  expect(new Set(questions.map(q => q.id)).size).toBe(8);
  assertKeysGrade(questions);
});

const SUPPORTED = ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru'] as const satisfies readonly LanguageCode[];

test.each(SUPPORTED)('the %s trial keys grade correctly and choice distractors do not', (language) => {
  const questions = trialExercisesFor(language);
  expect(questions.length).toBeGreaterThan(0);
  expect(new Set(questions.map(q => q.id)).size).toBe(questions.length);
  assertKeysGrade(questions);
});

/**
 * What this replaced, in its own terms: before onboarding v2 the assertion was
 * `hasTrialLesson(lang) === false` and `trialExercisesFor(lang) === []` for
 * it/pt/ja/ko/zh/ru. It guarded two things at once — that neither accessor had
 * grown a `?? TRIAL_LESSONS.es`-style fallback, and that those six languages
 * deliberately had NO trial content, so adding some would have to be a
 * conscious act that broke this test.
 *
 * The second half cannot be carried forward: his topic packs now cover all
 * nine languages, so "these six have nothing" is no longer true of the app.
 * The first half is preserved and strengthened below — the cross-language
 * fallback is now checked against `TopicPack.language` directly rather than
 * inferred from emptiness. If the original was guarding something subtler than
 * that, this comment is where to start looking.
 */
test.each(SUPPORTED)('the %s trial never falls back to another language', (language) => {
  expect(hasTrialLesson(language)).toBe(true);
  // The live path is this language's own pack, never a borrowed one...
  expect(topicPackFor(language, 'travel')?.language).toBe(language);
  // ...and the fallback table answers only for the key it is asked about: a
  // language with no entry gets nothing, never another language's lesson.
  expect(Object.keys(TRIAL_LESSONS).sort()).toEqual(['de', 'es', 'fr']);
  // What the learner runs is this language's own pack, not the table — so a
  // language absent from the table still gets its own content, not Spanish.
  expect(trialExercisesFor(language)).toEqual(topicPackFor(language, 'travel')?.exercises);
});
