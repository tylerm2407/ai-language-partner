/**
 * The packs are 45 hand-authored blobs of content in nine languages, and the
 * failure mode is not a crash — it is a learner quietly being taught the wrong
 * thing. These tests are shaped around the ways that has actually happened in
 * this codebase before:
 *
 *  - "14 Spanish texts cloned to 9 languages" (the reading-passages fix):
 *    hence the no-duplicate-sentence check, and the per-script checks for
 *    ja/ko/zh/ru which catch a pack filled in with Latin text.
 *  - An option list that does not contain its own answer — unwinnable, and
 *    invisible to the typechecker.
 *
 * Assertions that could fail 45 times over report `[where, ...]` tuples rather
 * than bare booleans, so the failure message names the pack.
 */
import { SUPPORTED_LANGUAGES } from '../../../config/app';
import { gradeAnswer } from '../../../lib/grading';
import type { Exercise, LanguageCode } from '../../../types';
import { hasTrialLesson, trialExercisesFor } from '../trial-lesson';
import {
  hasTopicPack,
  TOPIC_CHIPS,
  TOPIC_KEYS,
  topicFromIdealText,
  topicPackFor,
  TRIAL_LESSON_ID,
  TRIAL_LESSON_XP,
  type TopicPack,
} from './index';

const LANGUAGES: LanguageCode[] = SUPPORTED_LANGUAGES.map((l) => l.code);

function packOrThrow(language: LanguageCode, topic: (typeof TOPIC_KEYS)[number]): TopicPack {
  const pack = topicPackFor(language, topic);
  if (!pack) throw new Error(`missing pack: ${language}/${topic}`);
  return pack;
}

/** Every pack, flattened, so cross-pack invariants can be checked at once. */
const ALL_PACKS: TopicPack[] = LANGUAGES.flatMap((language) =>
  TOPIC_KEYS.map((topic) => packOrThrow(language, topic)),
);

/** Every exercise with the pack it came from, for the per-exercise sweeps. */
const ALL_EXERCISES: { where: string; exercise: Exercise }[] = ALL_PACKS.flatMap((pack) =>
  pack.exercises.map((exercise) => ({
    where: `${pack.language}/${pack.topic}#${exercise.orderIndex}`,
    exercise,
  })),
);

describe('coverage', () => {
  it('has a pack for every supported language and every topic', () => {
    expect(ALL_PACKS).toHaveLength(LANGUAGES.length * TOPIC_KEYS.length);
    for (const language of LANGUAGES) {
      for (const topic of TOPIC_KEYS) {
        expect([`${language}/${topic}`, hasTopicPack(language, topic)]).toEqual([
          `${language}/${topic}`,
          true,
        ]);
      }
    }
  });

  it('has no pack for English, which is nobody\'s target language here', () => {
    expect(hasTopicPack('en', 'travel')).toBe(false);
    expect(topicPackFor('en', 'travel')).toBeNull();
  });

  it('keeps the trial lesson id and XP stable', () => {
    expect(TRIAL_LESSON_ID).toBe('trial-lesson');
    expect(TRIAL_LESSON_XP).toBe(20);
  });
});

describe('pack shape', () => {
  it('gives every pack 3 words, a sentence, 6 plan rows and 4-6 exercises', () => {
    for (const pack of ALL_PACKS) {
      const where = `${pack.language}/${pack.topic}`;
      expect([where, pack.words.length]).toEqual([where, 3]);
      expect([where, pack.plan.length]).toEqual([where, 6]);
      expect([where, pack.exercises.length >= 4 && pack.exercises.length <= 6]).toEqual([
        where,
        true,
      ]);
      expect([where, pack.sentence.target.trim().length > 0]).toEqual([where, true]);
      expect([where, pack.sentence.gloss.trim().length > 0]).toEqual([where, true]);
      expect([where, pack.solLine.trim().length > 0]).toEqual([where, true]);
    }
  });

  it('namespaces every audio key by language, topic and slot', () => {
    for (const pack of ALL_PACKS) {
      const where = `${pack.language}/${pack.topic}`;
      expect([
        where,
        [...pack.words.map((w) => w.audioKey), pack.sentence.audioKey],
      ]).toEqual([
        where,
        [`${where}/w1`, `${where}/w2`, `${where}/w3`, `${where}/sentence`],
      ]);
    }
  });

  it('fills every plan row with a title and at least one word', () => {
    for (const pack of ALL_PACKS) {
      for (const row of pack.plan) {
        const where = `${pack.language}/${pack.topic}: ${row.title}`;
        expect([where, row.title.trim().length > 0]).toEqual([where, true]);
        expect([where, row.words.length > 0]).toEqual([where, true]);
        expect([where, row.words.every((w) => w.trim().length > 0)]).toEqual([where, true]);
      }
    }
  });
});

describe('exercises are runnable pre-auth', () => {
  it('never links an exercise to an SRS card', () => {
    // A non-null cardId sends LessonRunner into recordLessonSrsResult, which
    // writes review_items for a user that does not exist yet.
    for (const { where, exercise } of ALL_EXERCISES) {
      expect([where, exercise.cardId]).toEqual([where, null]);
    }
  });

  it('uses no exercise type that needs a JWT', () => {
    for (const { where, exercise } of ALL_EXERCISES) {
      expect([where, ['speaking', 'dictation', 'free_production'].includes(exercise.type)]).toEqual(
        [where, false],
      );
      // A listening exercise is legal ONLY with a bundled clip — without one
      // ListeningExercise falls through to the tts function and a 401.
      if (exercise.type.startsWith('listening_')) {
        expect([where, Boolean(exercise.promptAudioUrl)]).toEqual([where, true]);
      }
    }
  });

  it('accepts its own correct answer', () => {
    for (const { where, exercise } of ALL_EXERCISES) {
      expect([where, exercise.acceptedAnswers.includes(exercise.correctAnswer)]).toEqual([
        where,
        true,
      ]);
      const grade = gradeAnswer(
        exercise.correctAnswer,
        exercise.correctAnswer,
        exercise.acceptedAnswers,
        { exerciseHints: { exerciseType: exercise.type, skillType: exercise.skillType } },
      );
      expect([where, grade.isCorrect]).toEqual([where, true]);
    }
  });

  it('offers the answer among the options, with no repeats', () => {
    for (const { where, exercise } of ALL_EXERCISES) {
      if (exercise.options === null) continue;
      expect([where, exercise.options.includes(exercise.correctAnswer)]).toEqual([where, true]);
      expect([where, new Set(exercise.options).size]).toEqual([where, exercise.options.length]);
      expect([where, exercise.options.length >= 2]).toEqual([where, true]);
    }
  });

  it('carries the trial lesson id on every exercise', () => {
    for (const { where, exercise } of ALL_EXERCISES) {
      expect([where, exercise.lessonId]).toEqual([where, TRIAL_LESSON_ID]);
      expect([where, exercise.id.startsWith(`${TRIAL_LESSON_ID}-`)]).toEqual([where, true]);
    }
  });

  it('numbers each pack\'s exercises from zero with no gaps', () => {
    for (const pack of ALL_PACKS) {
      const where = `${pack.language}/${pack.topic}`;
      expect([where, pack.exercises.map((e) => e.orderIndex)]).toEqual([
        where,
        pack.exercises.map((_, i) => i),
      ]);
    }
  });

  it('gives every exercise in the whole set a unique id', () => {
    const ids = ALL_EXERCISES.map(({ exercise }) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('grades a correctly built sentence as correct, spaced join included', () => {
    // sentence_construction is graded STRICTLY (lib/grading.ts
    // isGrammarExercise lists the type), and the component joins tiles with
    // spaces — which is not the written form in ja or zh. If the spaced join
    // is not an accepted answer, a perfect answer grades wrong.
    for (const pack of ALL_PACKS) {
      const where = `${pack.language}/${pack.topic}`;
      const build = pack.exercises.find((e) => e.type === 'sentence_construction');
      expect([where, build !== undefined]).toEqual([where, true]);

      const tiles = build!.metadata?.tiles as string[];
      expect([where, Array.isArray(tiles) && tiles.length >= 3]).toEqual([where, true]);

      const grade = gradeAnswer(tiles.join(' '), build!.correctAnswer, build!.acceptedAnswers, {
        exerciseHints: { exerciseType: 'sentence_construction' },
      });
      expect([where, grade.isCorrect]).toEqual([where, true]);
    }
  });

  it('never puts a correct tile in the distractor pile', () => {
    for (const pack of ALL_PACKS) {
      const build = pack.exercises.find((e) => e.type === 'sentence_construction')!;
      const tiles = new Set(build.metadata?.tiles as string[]);
      for (const distractor of (build.metadata?.distractors as string[]) ?? []) {
        const where = `${pack.language}/${pack.topic}: ${distractor}`;
        expect([where, tiles.has(distractor)]).toEqual([where, false]);
      }
    }
  });
});

describe('the content is genuinely per-language', () => {
  it('never repeats a sentence across packs', () => {
    const seen = new Map<string, string>();
    for (const pack of ALL_PACKS) {
      const where = `${pack.language}/${pack.topic}`;
      expect([where, pack.sentence.target, seen.get(pack.sentence.target)]).toEqual([
        where,
        pack.sentence.target,
        undefined,
      ]);
      seen.set(pack.sentence.target, where);
    }
    expect(seen.size).toBe(ALL_PACKS.length);
  });

  it('teaches different words in different topics of the same language', () => {
    for (const language of LANGUAGES) {
      const targets = TOPIC_KEYS.flatMap((topic) =>
        packOrThrow(language, topic).words.map((w) => w.target),
      );
      expect([language, new Set(targets).size]).toEqual([language, targets.length]);
    }
  });

  /** Kana or Han for ja — a Japanese pack in rōmaji is the bug this catches. */
  const SCRIPTS: Partial<Record<LanguageCode, RegExp>> = {
    ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
    ko: /\p{Script=Hangul}/u,
    zh: /\p{Script=Han}/u,
    ru: /\p{Script=Cyrillic}/u,
  };
  const LATIN = /\p{Script=Latin}/u;

  it('writes every ja/ko/zh/ru target in its own script and no Latin', () => {
    for (const pack of ALL_PACKS) {
      const script = SCRIPTS[pack.language];
      if (!script) continue;
      const targets = [
        ...pack.words.map((w) => w.target),
        pack.sentence.target,
        ...pack.plan.flatMap((row) => row.words),
      ];
      for (const target of targets) {
        const where = `${pack.language}/${pack.topic}: ${target}`;
        expect([where, script.test(target)]).toEqual([where, true]);
        // Latin letters alongside are the signature of a half-translated pack.
        expect([where, LATIN.test(target)]).toEqual([where, false]);
      }
    }
  });

  it('never glosses a word as itself', () => {
    for (const pack of ALL_PACKS) {
      for (const word of [...pack.words, pack.sentence]) {
        const where = `${pack.language}/${pack.topic}: ${word.target}`;
        expect([where, word.gloss === word.target]).toEqual([where, false]);
        expect([where, word.gloss.trim().length > 0]).toEqual([where, true]);
      }
    }
  });
});

describe('TOPIC_CHIPS and topicFromIdealText', () => {
  it('has one chip per topic, in topic order', () => {
    expect(TOPIC_CHIPS.map((c) => c.key)).toEqual([...TOPIC_KEYS]);
    expect(TOPIC_CHIPS.map((c) => c.tag)).toEqual([
      'Travel',
      'Family',
      'Work',
      'Films & music',
      'Moving abroad',
    ]);
  });

  it('maps every chip sentence back to its own topic, in every language', () => {
    for (const chip of TOPIC_CHIPS) {
      for (const language of SUPPORTED_LANGUAGES) {
        const where = `${chip.tag}/${language.name}`;
        expect([where, topicFromIdealText(chip.text(language.name))]).toEqual([where, chip.key]);
      }
    }
  });

  it('recognises the same intent said differently', () => {
    expect(topicFromIdealText('Ordering coffee in Madrid without switching to English.')).toBe(
      'travel',
    );
    expect(topicFromIdealText('Understanding the in-laws at my grandmother\'s birthday.')).toBe(
      'family',
    );
    expect(topicFromIdealText('Presenting to a client without a script.')).toBe('work');
    expect(topicFromIdealText('Watching anime without subtitles.')).toBe('media_culture');
    expect(topicFromIdealText('Renting an apartment and sorting out the visa myself.')).toBe(
      'housing_admin',
    );
  });

  it('returns null rather than guessing', () => {
    expect(topicFromIdealText('')).toBeNull();
    expect(topicFromIdealText('I just want to feel confident.')).toBeNull();
    // A genuine tie: one keyword each for work and media_culture.
    expect(topicFromIdealText('A meeting about a film.')).toBeNull();
  });

  it('does not fire on a substring of another word', () => {
    // "homework" contains "work"; "already" contains "read".
    expect(topicFromIdealText('Finishing my homework.')).toBeNull();
    expect(topicFromIdealText('I already understand a little.')).toBeNull();
  });
});

describe('trial-lesson.ts still works for callers that have not switched', () => {
  it('delegates to the travel pack for every supported language', () => {
    for (const language of LANGUAGES) {
      expect([language, hasTrialLesson(language)]).toEqual([language, true]);
      expect([language, trialExercisesFor(language)]).toEqual([
        language,
        packOrThrow(language, 'travel').exercises,
      ]);
    }
  });

  it('reports no trial for English', () => {
    expect(hasTrialLesson('en')).toBe(false);
    expect(trialExercisesFor('en')).toEqual([]);
  });
});
