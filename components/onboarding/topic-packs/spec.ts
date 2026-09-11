/**
 * Shape of a bundled topic pack, and the builder that turns the hand-authored
 * data in `<lang>.ts` into runnable exercises.
 *
 * WHY PACKS EXIST — the one-size trial lesson taught the same eight exercises
 * to everyone who reached the `lesson` step of onboarding, regardless of what
 * they had just said they wanted the language FOR. A learner who picked
 * "Moving abroad" was handed "¿Cómo te llamas?". The pack replaces that with a
 * MICRO lesson (3 words, then the sentence those words build, ~90 seconds)
 * matched to the topic chip they tapped one screen earlier.
 *
 * WHY BUNDLED — unchanged from `../trial-lesson.ts`: `courses`, `units`,
 * `lessons` and `exercises` are RLS `TO authenticated` (migration 004), so a
 * signed-out device cannot read a row of the curriculum, and every exercise
 * here must therefore be gradeable on-device by `lib/grading.ts` with no
 * network at all.
 *
 * THE ONE EXCEPTION TO "NO NETWORK" — audio. `listening_choice` normally calls
 * the `tts` edge function, which needs a JWT. But `ListeningExercise` plays
 * `exercise.promptAudioUrl` directly and synthesises only when it is null
 * (ListeningExercise.tsx:64-70), and `useLessonAudioPrewarm` skips a prewarm
 * for the same reason (useLessonAudioPrewarm.ts:39-42). So a pre-rendered clip
 * shipped in the bundle makes a listening exercise legal pre-auth. When the
 * clip is missing the pack degrades to a text-only `multiple_choice` of the
 * same word — never to a `listening_choice` with null audio, which would try
 * to synthesise and fail on a 401.
 */
import type { Exercise, LanguageCode } from '../../../types';
import { resolveTrialAudio } from './audio-manifest';

/**
 * The five onboarding topics. Deliberately the same keys as the
 * `goal-taxonomy.ts` domains the server uses to build goal tracks
 * (`travel`, `family`, `work`, `media_culture`, `housing_admin`), so the
 * trial a learner plays and the track they are later given are talking about
 * the same thing rather than two parallel vocabularies of topic.
 */
export type TopicKey = 'travel' | 'family' | 'work' | 'media_culture' | 'housing_admin';

export const TOPIC_KEYS: readonly TopicKey[] = [
  'travel',
  'family',
  'work',
  'media_culture',
  'housing_admin',
] as const;

/** XP awarded for finishing the trial. Matches a normal first lesson. */
export const TRIAL_LESSON_XP = 20;

/**
 * Stable id for the trial run. LessonRunner keys its resume snapshot on
 * (userId, lessonId) and skips persistence entirely when `userId` is empty,
 * which is always the case here — so this id never reaches storage. It exists
 * because the runner requires one.
 */
export const TRIAL_LESSON_ID = 'trial-lesson';

/** A teachable item: what is said, what it means, and which clip voices it. */
export interface PackWord {
  target: string;
  gloss: string;
  /** `${lang}/${topic}/${w1|w2|w3|sentence}` — the key into the audio manifest. */
  audioKey: string;
}

export interface TopicPack {
  language: LanguageCode;
  topic: TopicKey;
  /** Exactly 3. */
  words: PackWord[];
  /** One simple sentence built from the words above. */
  sentence: PackWord;
  /** 5 without bundled audio, 6 with — all gradeable on-device. */
  exercises: Exercise[];
  /** Exactly 6 lesson outlines for the plan-reveal screen. */
  plan: { title: string; words: string[] }[];
  /** One short English line Sol says after the chip is picked. */
  solLine: string;
}

/** Hand-authored half of a word: the manifest key is derived, not written. */
export interface WordSpec {
  target: string;
  gloss: string;
}

/**
 * What a language file actually writes. Everything derivable — audio keys,
 * exercise ids, option ordering, the fallback when a clip is missing — is
 * derived by `buildPack` so the 45 packs cannot drift apart in shape.
 */
export interface PackSpec {
  /** Exactly 3, in teaching order. */
  words: [WordSpec, WordSpec, WordSpec];
  /** The sentence the three words build toward. Keep it A1 and natural. */
  sentence: WordSpec;
  /**
   * The sentence split into tap-able tiles, in correct order.
   *
   * Written out rather than derived by splitting on spaces because ja and zh
   * do not put spaces between words at all, and ko groups particles onto the
   * preceding eojeol. `SentenceConstructionExercise` joins the placed tiles
   * with spaces, so the spaced join is carried in `acceptedAnswers`.
   */
  tiles: string[];
  /** Extra tiles that belong to no correct answer. Two or three is plenty. */
  tileDistractors: string[];
  /** A fourth, untaught word used only to fill out the recognition options. */
  foil: WordSpec;
  /** Exactly 6 outlines for the plan-reveal screen. */
  plan: { title: string; words: string[] }[];
  solLine: string;
}

/** A whole language's five packs. */
export type LanguagePacks = Record<TopicKey, PackSpec>;

/** Trailing sentence punctuation, including the CJK full stop. */
const TRAILING_PUNCTUATION = /[.!?。！？]+$/u;

function audioKeyFor(language: LanguageCode, topic: TopicKey, slot: string): string {
  return `${language}/${topic}/${slot}`;
}

/**
 * Rotate `items` by `by` so the correct answer does not sit in the same slot
 * on every question. Deterministic on purpose: a shuffle would make the
 * snapshot of a pack different on every render and the tests unrunnable.
 */
function rotate<T>(items: T[], by: number): T[] {
  if (items.length === 0) return items;
  const offset = ((by % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

interface ExerciseFields extends Partial<Exercise> {
  type: Exercise['type'];
  prompt: string;
  correctAnswer: string;
}

function makeExercise(idSuffix: string, fields: ExerciseFields): Exercise {
  return {
    id: `${TRIAL_LESSON_ID}-${idSuffix}`,
    lessonId: TRIAL_LESSON_ID,
    // Rewritten to the real position by `buildPack` — the sentence-listening
    // exercise only exists when its clip is bundled, so positions shift.
    orderIndex: 0,
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

export interface BuildPackOptions {
  /**
   * English glosses of the OTHER topics' sentences in this language, used as
   * wrong options when the learner hears the whole sentence. Drawn from
   * sibling packs rather than authored per pack: four more English sentences
   * per pack is 180 more strings to keep true, and the sibling glosses are
   * already guaranteed to be distinct from this one.
   */
  siblingSentenceGlosses: string[];
}

/**
 * Build the runnable pack from its hand-authored spec.
 *
 * The exercise sequence is deliberately short — the whole point is ~90
 * seconds, not a second lesson:
 *   0-2  recognise each of the three words (heard, or read when no clip)
 *   3    hear the whole sentence and pick its meaning  (only with a clip)
 *   4    build the sentence from tiles
 *   5    translate the sentence back to English
 */
export function buildPack(
  language: LanguageCode,
  topic: TopicKey,
  spec: PackSpec,
  options: BuildPackOptions,
): TopicPack {
  const words: PackWord[] = spec.words.map((word, i) => ({
    target: word.target,
    gloss: word.gloss,
    audioKey: audioKeyFor(language, topic, `w${i + 1}`),
  }));
  const sentence: PackWord = {
    target: spec.sentence.target,
    gloss: spec.sentence.gloss,
    audioKey: audioKeyFor(language, topic, 'sentence'),
  };

  const glossPool = [...spec.words.map((w) => w.gloss), spec.foil.gloss];
  const targetPool = [...spec.words.map((w) => w.target), spec.foil.target];

  const exercises: Exercise[] = words.map((word, i) => {
    const clip = resolveTrialAudio(word.audioKey);
    const idSuffix = `${language}-${topic}-w${i + 1}`;

    if (clip) {
      return makeExercise(idSuffix, {
        type: 'listening_choice',
        // Never rendered — ListeningExercise shows a fixed "Listen and answer"
        // header — but it is what a synthesiser would say, so it stays honest.
        prompt: word.target,
        promptAudioUrl: clip,
        options: rotate(glossPool, i),
        correctAnswer: word.gloss,
        acceptedAnswers: [word.gloss],
        targetWord: word.target,
      });
    }

    return makeExercise(idSuffix, {
      type: 'multiple_choice',
      prompt: `Which one means "${word.gloss}"?`,
      options: rotate(targetPool, i),
      correctAnswer: word.target,
      acceptedAnswers: [word.target],
      targetWord: word.target,
    });
  });

  const sentenceClip = resolveTrialAudio(sentence.audioKey);
  if (sentenceClip) {
    exercises.push(
      makeExercise(`${language}-${topic}-listen`, {
        type: 'listening_choice',
        prompt: sentence.target,
        promptAudioUrl: sentenceClip,
        options: rotate(
          unique([sentence.gloss, ...options.siblingSentenceGlosses]).slice(0, 4),
          3,
        ),
        correctAnswer: sentence.gloss,
        acceptedAnswers: [sentence.gloss],
        skillType: 'chunk',
      }),
    );
  }

  // `sentence_construction` is graded strictly (lib/grading.ts
  // `isGrammarExercise` lists the type), so there is no typo tolerance to lean
  // on: the spaced join the component produces has to be an accepted answer
  // verbatim, or a correctly built Japanese sentence grades as wrong.
  const sentenceCore = sentence.target.replace(TRAILING_PUNCTUATION, '');
  const spacedJoin = spec.tiles.join(' ');
  exercises.push(
    makeExercise(`${language}-${topic}-build`, {
      type: 'sentence_construction',
      prompt: `Build: "${sentence.gloss}"`,
      correctAnswer: sentenceCore,
      acceptedAnswers: unique([sentenceCore, spacedJoin]),
      // The component reads tiles and distractors off `metadata`, not off the
      // top-level `distractors` field; both are set so either reader works.
      metadata: { tiles: spec.tiles, distractors: spec.tileDistractors },
      distractors: spec.tileDistractors,
      skillType: 'chunk',
    }),
  );

  exercises.push(
    makeExercise(`${language}-${topic}-translate`, {
      type: 'translate_to_native',
      prompt: sentence.target,
      correctAnswer: sentence.gloss,
      acceptedAnswers: unique([sentence.gloss, sentence.gloss.replace(TRAILING_PUNCTUATION, '')]),
      skillType: 'chunk',
    }),
  );

  return {
    language,
    topic,
    words,
    sentence,
    exercises: exercises.map((exercise, orderIndex) => ({ ...exercise, orderIndex })),
    plan: spec.plan,
    solLine: spec.solLine,
  };
}
