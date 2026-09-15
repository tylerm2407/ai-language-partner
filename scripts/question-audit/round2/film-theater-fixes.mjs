/**
 * Film & Theater: finish the job round one started in three languages.
 *
 * Every "Literature & Arts" unit in the curriculum is one shared twelve-word
 * pool — Novel, Poem, Painting, Sculpture, Metaphor, Symbolism, Genre,
 * Protagonist, Plot twist, Review, Masterpiece, Inspiration — rotated across
 * six lessons. Of those twelve, ten are ordinary film-and-theatre criticism
 * vocabulary and belong in a Film & Theater lesson exactly as they stand:
 * metaphor, symbolism, genre, protagonist, plot twist, review, masterpiece and
 * inspiration are said of films and plays every day. Two are not: PAINTING and
 * SCULPTURE name visual-art objects and have no learner-visible link to film or
 * theatre. That is the adjudication round one made, and it is the right one.
 *
 * Round one applied it in Spanish, Japanese and Korean only — the three
 * languages its held-boundary batch covered. The identical defect sits untouched
 * in French, German, Italian, Portuguese, Chinese and Russian, where Film &
 * Theater still teaches Painting twice (a multiple-choice row and a listening
 * pair) and Sculpture once. This producer applies the SAME correction to those
 * six, so all nine languages agree:
 *
 *   row 0  multiple_choice     Painting   -> Script      (the written text)
 *   row 1  translate_to_target Sculpture  -> Stage       (of a theater)
 *   row ~107/108 listening pair Painting  -> Audience    (who watches)
 *
 * Three limits, stated rather than buried:
 *
 *  - The `speaking` sibling of each listening pair still carries the Painting
 *    word. Speaking content is out of scope for this audit by a hard compiler
 *    rule, so round one left the Spanish, Japanese and Korean ones stale too.
 *    This does not make them right; it makes them somebody else's row.
 *  - The listening rows detach their stale card (`card_id -> null`), which is
 *    what round one did: the shared Painting card stays, this exercise simply
 *    stops pointing at it. No audio is generated or auditioned by this patch.
 *  - Nothing here touches "Describing Art", the lesson Painting and Sculpture
 *    actually belong to. Its remaining literary items (Novel, Poem, Plot twist)
 *    make its title loose, but "art" covering letters inside a unit called
 *    Literature & Arts is a curriculum-naming judgement, not a defect, and
 *    renaming lessons nobody has complained about is not a correction.
 */

const REASON = ref => `${ref}: Film & Theater taught a visual-art label with no learner-visible link to film or theatre. Replace it with Film & Theater vocabulary at the same type and placement, mirroring the adjudication round one applied to Spanish, Japanese and Korean. Detach only the stale card link; the shared card is untouched. Paired TTS transcripts and keys are authored; audio is not generated or auditioned.`;

/**
 * Per language: the three replacement words, the sources for each, and the
 * English explanation added to the multiple-choice row (the shape round one
 * used on es-E2089).
 */
export const filmTheaterWords = {
  fr: {
    script: 'Scénario', stage: 'Scène', stageAlternatives: ['La scène'], audience: 'Public',
    explanation: 'Le scénario is the written script or screenplay of a film or play.',
    sources: ['https://www.larousse.fr/dictionnaires/francais/sc%C3%A9nario/71247', 'https://www.larousse.fr/dictionnaires/francais/sc%C3%A8ne/71256', 'https://www.larousse.fr/dictionnaires/francais/public/64882'],
  },
  de: {
    script: 'Drehbuch', stage: 'Bühne', stageAlternatives: ['Die Bühne'], audience: 'Publikum',
    explanation: 'Das Drehbuch is the written script or screenplay of a film.',
    sources: ['https://www.duden.de/rechtschreibung/Drehbuch', 'https://www.duden.de/rechtschreibung/Buehne', 'https://www.duden.de/rechtschreibung/Publikum'],
  },
  it: {
    script: 'Sceneggiatura', stage: 'Palcoscenico', stageAlternatives: ['Il palcoscenico', 'Palco'], audience: 'Pubblico',
    explanation: 'La sceneggiatura is the written script of a film or play; il palcoscenico is the stage the actors move on.',
    sources: ['https://www.treccani.it/vocabolario/sceneggiatura/', 'https://www.treccani.it/vocabolario/palcoscenico/', 'https://www.treccani.it/vocabolario/pubblico/'],
  },
  pt: {
    // Priberam gives roteiro sense 3 as the text of a televisual, radio,
    // theatrical or cinematographic programme, with GUIÃO as its synonym. The
    // course mixes Brazilian and European spellings, so both are accepted.
    script: 'Roteiro', stage: 'Palco', stageAlternatives: ['O palco'], audience: 'Público',
    explanation: 'O roteiro (guião, in European Portuguese) is the written script of a film or play.',
    sources: ['https://dicionario.priberam.org/roteiro', 'https://dicionario.priberam.org/palco', 'https://dicionario.priberam.org/publico'],
  },
  zh: {
    script: '剧本', stage: '舞台', stageAlternatives: [], audience: '观众',
    explanation: '剧本 (jùběn) is the written script or screenplay of a film or play.',
    sources: ['https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E5%89%A7%E6%9C%AC', 'https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E8%88%9E%E5%8F%B0', 'https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E8%A7%82%E4%BC%97'],
  },
  ru: {
    script: 'Сценарий', stage: 'Сцена', stageAlternatives: [], audience: 'Публика',
    explanation: 'Сценарий is the written script or screenplay of a film or play.',
    sources: ['https://en.pons.com/translate/russian-english/%D1%81%D1%86%D0%B5%D0%BD%D0%B0%D1%80%D0%B8%D0%B9', 'https://en.pons.com/translate/russian-english/%D1%81%D1%86%D0%B5%D0%BD%D0%B0', 'https://en.pons.com/translate/russian-english/%D0%BF%D1%83%D0%B1%D0%BB%D0%B8%D0%BA%D0%B0'],
  },
};

const LANGUAGE_NAME = { fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', zh: 'Chinese', ru: 'Russian' };

/** Replace one member of an options list in place, so the offered order — which
 * a learner may have seen — moves as little as the correction allows. */
function swapOption(options, from, to, where) {
  const index = options.indexOf(from);
  if (index === -1) throw new Error(`${where}: "${from}" is not an offered option`);
  if (options.includes(to)) throw new Error(`${where}: "${to}" is already offered`);
  const next = [...options];
  next[index] = to;
  return next;
}

export function filmTheaterFixes(set) {
  const { snapshot, update } = set;
  const courses = new Map(snapshot.courses.map(c => [c.id, c]));
  const units = new Map(snapshot.units.map(u => [u.id, u]));
  let changed = 0;

  for (const [language, words] of Object.entries(filmTheaterWords)) {
    const lessons = snapshot.lessons.filter(lesson => {
      const unit = units.get(lesson.unit_id);
      return lesson.title === 'Film & Theater' && unit?.title === 'Literature & Arts'
        && courses.get(unit.course_id)?.target_language === language;
    });
    if (lessons.length !== 1) throw new Error(`${language}: expected exactly one Film & Theater lesson, found ${lessons.length}`);
    const [lesson] = lessons;
    const rows = snapshot.exercises.filter(e => e.lesson_id === lesson.id);

    // --- The multiple-choice Painting row -------------------------------
    const choice = rows.filter(e => e.type === 'multiple_choice' && e.correct_answer === 'Painting');
    if (choice.length !== 1) throw new Error(`${language}: expected exactly one Painting multiple_choice row, found ${choice.length}`);
    const ref = `${language}-FT-script`;
    update('exercises', choice[0].id, {
      prompt: `What does "${words.script}" mean in English?`,
      correct_answer: 'Script',
      options: swapOption(choice[0].options, 'Painting', 'Script', ref),
      explanation: words.explanation,
    }, REASON(ref), words.sources);
    changed++;

    // --- The Sculpture translate row ------------------------------------
    const sculpture = rows.filter(e => e.type === 'translate_to_target' && e.prompt === `Translate to ${LANGUAGE_NAME[language]}: Sculpture`);
    if (sculpture.length !== 1) throw new Error(`${language}: expected exactly one Sculpture translate row, found ${sculpture.length}`);
    update('exercises', sculpture[0].id, {
      prompt: `Translate to ${LANGUAGE_NAME[language]}: Stage (of a theater)`,
      correct_answer: words.stage,
      // The frozen alternatives are synonyms of SCULPTURE. Leaving them would
      // accept "Skulptur" on a row that now asks for "Bühne".
      accepted_answers: words.stageAlternatives,
    }, REASON(`${language}-FT-stage`), words.sources);
    changed++;

    // --- The listening pair on the Painting card -------------------------
    // `speaking` is refused by the compiler and is not attempted here.
    const listening = rows.filter(e => ['listening_type', 'listening_choice'].includes(e.type) && e.card_id
      && snapshot.cards.find(c => c.id === e.card_id)?.native_text === 'Painting');
    if (listening.length !== 2) throw new Error(`${language}: expected exactly two Painting listening rows, found ${listening.length}`);
    for (const exercise of listening) {
      const context = `${language}-FT-audience/${exercise.type}`;
      if (exercise.type === 'listening_type') {
        update('exercises', exercise.id, {
          prompt: words.audience, correct_answer: words.audience, hint_text: 'Audience', card_id: null,
        }, REASON(context), words.sources);
      } else {
        update('exercises', exercise.id, {
          prompt: words.audience, correct_answer: 'Audience',
          options: swapOption(exercise.options, 'Painting', 'Audience', context),
          card_id: null,
        }, REASON(context), words.sources);
      }
      changed++;
    }
  }
  return changed;
}
