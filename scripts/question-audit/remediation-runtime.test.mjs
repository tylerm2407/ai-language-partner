// Pure local checks against a patched copy of the frozen data; no DB/provider.
import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { gradeAnswer } from '../../lib/grading.ts';
import { isCorrect as checkpointCorrect } from '../../supabase/functions/checkpoint/checkpoint-core.ts';
import { lessonRefs } from './lesson-refs.mjs';
const snapshot = JSON.parse(await Deno.readTextFile('.question-audit/snapshot-8c7f381c78d8.json'));
const { patches } = JSON.parse(await Deno.readTextFile('docs/audits/question-verification/remediation/draft-patches.json'));
const byId = new Map(patches.map(p => [`${p.table}/${p.id}`, p]));
const patched = (table, row) => ({ ...row, ...(byId.get(`${table}/${row.id}`)?.after ?? {}) });
const spanish = lessonRefs(snapshot, 'es');
const grade = (answer, ex) => gradeAnswer(answer, ex.correct_answer, ex.accepted_answers, {
  exerciseHints: { exerciseType: ex.type, skillType: ex.skill_type, targetGrammar: ex.target_grammar, targetWord: ex.target_word, language: 'es' },
}).isCorrect;

Deno.test('authored Spanish choice repairs have one accepted button and reject removed wrong glosses', () => {
  for (const ref of [5, 49, 36, 1599, 1627, 1949, 1655, 1666, 1706, 1682]) {
    const original = spanish(ref).exercise;
    const after = patched('exercises', original);
    assertEquals(after.options.filter(option => grade(option, after)), [after.correct_answer], `es-E${ref}`);
    assertEquals(new Set(after.options).size, after.options.length);
    assertEquals(after.options.length, original.options.length);
  }
  for (const ref of [1655, 1666, 1706]) assert(!grade('Would', patched('exercises', spanish(ref).exercise)));
  assert(!grade('Instead', patched('exercises', spanish(1682).exercise)));
});

Deno.test('Spanish cloud-nine answer distinguishes happiness from absent-mindedness', () => {
  const before = spanish(2176).exercise;
  const after = patched('exercises', before);
  assert(grade('las nubes', before));
  assert(!grade('el séptimo cielo', before));
  assert(!grade('las nubes', after));
  assert(grade('el séptimo cielo', after));
  assert(grade('la gloria', after));
});

Deno.test('required reporting prefixes are retained in every accepted transformation', () => {
  for (const [ref, name] of [[2263, 'Marta'], [2305, 'Paula']]) {
    const before = spanish(ref).exercise;
    const after = patched('exercises', before);
    const oldMissingSubject = before.accepted_answers[0];
    assert(grade(oldMissingSubject, before));
    assert(!grade(oldMissingSubject, after));
    for (const answer of [after.correct_answer, ...after.accepted_answers]) {
      assert(answer.startsWith(`${name} dijo que`));
      assert(grade(answer, after));
    }
  }
});

Deno.test('standard Spanish no-a and imperfect variants move from rejected to accepted', () => {
  for (const [ref, answer] of [
    [2294, 'Busco alguien que tenga experiencia en ventas'],
    [2294, 'Estoy buscando alguien que tenga experiencia en ventas'],
    [2302, 'vendían'],
  ]) {
    const before = spanish(ref).exercise;
    assert(!grade(answer, before), `Before es-E${ref}`);
    assert(grade(answer, patched('exercises', before)), `After es-E${ref}`);
  }
  assert(grade('Haría', patched('exercises', spanish(1642).exercise)));
  assert(grade('Yo haría', patched('exercises', spanish(1642).exercise)));
});

Deno.test('every newly authored checkpoint completion is actually accepted after patching', () => {
  let tested = 0;
  for (const patch of patches.filter(p => p.table === 'checkpoint_items')) {
    const before = snapshot.checkpoint_items.find(x => x.id === patch.id);
    const after = patched('checkpoint_items', before);
    for (const answer of after.accepted_answers.filter(x => !before.accepted_answers.includes(x))) {
      assert(checkpointCorrect(answer, after), `${patch.id}: ${answer}`);
      tested++;
    }
    assert(checkpointCorrect(after.correct_answer, after));
  }
  assert(tested >= 32);
});

Deno.test('speaking and stored audio stay unchanged; only ninety-six individually reviewed TTS transcripts change', async () => {
  // Enumerated literally so an unreviewed transcript cannot slip in unnoticed, and
  // cross-checked against the approval ledger so the list cannot drift from the evidence.
  const refs = Object.fromEntries(['de', 'es', 'fr', 'it', 'ja', 'ko', 'pt', 'ru', 'zh'].map(language => [language, lessonRefs(snapshot, language)]));
  const correctedTts = new Map([
    [refs.de(291).exercise.id, ["Heiß", "Koch"]],
    [refs.de(292).exercise.id, ["Heiß", "Koch"]],
    [refs.de(313).exercise.id, ["Büro", "Ich zeichne gern."]],
    [refs.de(314).exercise.id, ["Büro", "Ich zeichne gern."]],
    [refs.de(2113).exercise.id, ["Skulptur", "Das Tempo wird schneller."]],
    [refs.de(2114).exercise.id, ["Skulptur", "Das Tempo wird schneller."]],
    [refs.es(245).exercise.id, ["Hora", "Vestido"]],
    [refs.es(246).exercise.id, ["Hora", "Vestido"]],
    [refs.es(291).exercise.id, ["Caliente", "Ingeniero"]],
    [refs.es(292).exercise.id, ["Caliente", "Ingeniero"]],
    [refs.es(313).exercise.id, ["Oficina", "Nadar"]],
    [refs.es(314).exercise.id, ["Oficina", "Nadar"]],
    [refs.es(315).exercise.id, ["Verano", "Guitarra"]],
    [refs.es(316).exercise.id, ["Verano", "Guitarra"]],
    [refs.es(325).exercise.id, ["Leer", "Lluvia"]],
    [refs.es(326).exercise.id, ["Leer", "Lluvia"]],
    [refs.es(2099).exercise.id, ["Pintura", "Público"]],
    [refs.es(2100).exercise.id, ["Pintura", "Público"]],
    [refs.es(2113).exercise.id, ["Escultura", "Melodía"]],
    [refs.es(2114).exercise.id, ["Escultura", "Melodía"]],
    [refs.fr(245).exercise.id, ["Heure", "Robe"]],
    [refs.fr(246).exercise.id, ["Heure", "Robe"]],
    [refs.fr(291).exercise.id, ["Chaud", "Cuisinier"]],
    [refs.fr(292).exercise.id, ["Chaud", "Cuisinier"]],
    [refs.fr(313).exercise.id, ["Bureau", "J’aime dessiner."]],
    [refs.fr(314).exercise.id, ["Bureau", "J’aime dessiner."]],
    [refs.fr(325).exercise.id, ["Lire", "Il pleut"]],
    [refs.fr(326).exercise.id, ["Lire", "Il pleut"]],
    [refs.fr(2113).exercise.id, ["Sculpture", "Le tempo s’accélère."]],
    [refs.fr(2114).exercise.id, ["Sculpture", "Le tempo s’accélère."]],
    [refs.it(291).exercise.id, ["Caldo", "Cuoco"]],
    [refs.it(292).exercise.id, ["Caldo", "Cuoco"]],
    [refs.it(313).exercise.id, ["Ufficio", "Mi piace disegnare."]],
    [refs.it(314).exercise.id, ["Ufficio", "Mi piace disegnare."]],
    [refs.it(2113).exercise.id, ["Scultura", "Il tempo diventa più rapido."]],
    [refs.it(2114).exercise.id, ["Scultura", "Il tempo diventa più rapido."]],
    [refs.ja(245).exercise.id, ["時間", "ワンピース"]],
    [refs.ja(246).exercise.id, ["時間", "ワンピース"]],
    [refs.ja(291).exercise.id, ["暑い", "エンジニア"]],
    [refs.ja(292).exercise.id, ["暑い", "エンジニア"]],
    [refs.ja(313).exercise.id, ["事務所", "泳ぐ"]],
    [refs.ja(314).exercise.id, ["事務所", "泳ぐ"]],
    [refs.ja(315).exercise.id, ["夏", "ギター"]],
    [refs.ja(316).exercise.id, ["夏", "ギター"]],
    [refs.ja(325).exercise.id, ["読む", "雨"]],
    [refs.ja(326).exercise.id, ["読む", "雨"]],
    [refs.ja(2099).exercise.id, ["絵画", "観客"]],
    [refs.ja(2100).exercise.id, ["絵画", "観客"]],
    [refs.ja(2113).exercise.id, ["彫刻", "旋律"]],
    [refs.ja(2114).exercise.id, ["彫刻", "旋律"]],
    [refs.ko(245).exercise.id, ["시간", "원피스"]],
    [refs.ko(246).exercise.id, ["시간", "원피스"]],
    [refs.ko(291).exercise.id, ["더운", "엔지니어"]],
    [refs.ko(292).exercise.id, ["더운", "엔지니어"]],
    [refs.ko(313).exercise.id, ["사무실", "수영하다"]],
    [refs.ko(314).exercise.id, ["사무실", "수영하다"]],
    [refs.ko(315).exercise.id, ["여름", "기타"]],
    [refs.ko(316).exercise.id, ["여름", "기타"]],
    [refs.ko(325).exercise.id, ["읽다", "비"]],
    [refs.ko(326).exercise.id, ["읽다", "비"]],
    [refs.ko(773).exercise.id, ["씨다", "씻다"]],
    [refs.ko(774).exercise.id, ["씨다", "씻다"]],
    [refs.ko(1765).exercise.id, ["걱정마", "걱정 마"]],
    [refs.ko(1766).exercise.id, ["걱정마", "걱정 마"]],
    [refs.ko(2099).exercise.id, ["그림", "관객"]],
    [refs.ko(2100).exercise.id, ["그림", "관객"]],
    [refs.ko(2113).exercise.id, ["조각", "선율"]],
    [refs.ko(2114).exercise.id, ["조각", "선율"]],
    [refs.pt(245).exercise.id, ["Hora", "Saia"]],
    [refs.pt(246).exercise.id, ["Hora", "Saia"]],
    [refs.pt(291).exercise.id, ["Quente", "Cozinheiro"]],
    [refs.pt(292).exercise.id, ["Quente", "Cozinheiro"]],
    [refs.pt(313).exercise.id, ["Escritório", "Gosto de desenhar."]],
    [refs.pt(314).exercise.id, ["Escritório", "Gosto de desenhar."]],
    [refs.pt(325).exercise.id, ["Ler", "Está chovendo."]],
    [refs.pt(326).exercise.id, ["Ler", "Está chovendo."]],
    [refs.pt(2113).exercise.id, ["Escultura", "O andamento acelera."]],
    [refs.pt(2114).exercise.id, ["Escultura", "O andamento acelera."]],
    [refs.ru(245).exercise.id, ["Время", "Юбка"]],
    [refs.ru(246).exercise.id, ["Время", "Юбка"]],
    [refs.ru(291).exercise.id, ["Горячий", "Водитель"]],
    [refs.ru(292).exercise.id, ["Горячий", "Водитель"]],
    [refs.ru(313).exercise.id, ["Офис", "Я люблю рисовать."]],
    [refs.ru(314).exercise.id, ["Офис", "Я люблю рисовать."]],
    [refs.ru(325).exercise.id, ["Читать", "Идёт дождь."]],
    [refs.ru(326).exercise.id, ["Читать", "Идёт дождь."]],
    [refs.ru(2113).exercise.id, ["Скульптура", "Музыка звучит всё быстрее."]],
    [refs.ru(2114).exercise.id, ["Скульптура", "Музыка звучит всё быстрее."]],
    [refs.zh(291).exercise.id, ["热", "厨师"]],
    [refs.zh(292).exercise.id, ["热", "厨师"]],
    [refs.zh(313).exercise.id, ["办公室", "我喜欢画画。"]],
    [refs.zh(314).exercise.id, ["办公室", "我喜欢画画。"]],
    [refs.zh(811).exercise.id, ["慰概", "慷慨"]],
    [refs.zh(812).exercise.id, ["慰概", "慷慨"]],
    [refs.zh(2113).exercise.id, ["雕塑", "音乐的速度加快了。"]],
    [refs.zh(2114).exercise.id, ["雕塑", "音乐的速度加快了。"]],
  ]);
  assertEquals(correctedTts.size, 96);
  const status = JSON.parse(await Deno.readTextFile('docs/audits/question-verification/remediation/current-review-status.json'));
  const approvedPrompt = new Set(status.fields.filter(f => f.table === 'exercises' && f.field === 'prompt' && f.status === 'exact_value_independently_approved').map(f => f.id));
  for (const id of correctedTts.keys()) assert(approvedPrompt.has(id), `unapproved transcript ${id}`);
  for (const patch of patches.filter(p => p.table === 'exercises')) {
    const before = snapshot.exercises.find(x => x.id === patch.id);
    assert(before.type !== 'speaking' && before.response_mode !== 'speak');
    const after = patched('exercises', before);
    assertEquals(after.prompt_audio_url, before.prompt_audio_url);
    if (before.type === 'listening_type' || before.type === 'listening_choice') {
      if (correctedTts.has(before.id)) {
        const [oldText, newText] = correctedTts.get(before.id);
        assertEquals(before.prompt, oldText);
        assertEquals(after.prompt, newText);
        assertEquals(before.prompt_audio_url, null);
      } else assertEquals(after.prompt, before.prompt);
    }
  }
});

Deno.test('reviewed topic replacements detach stale cards without changing those valid cards', () => {
  for (const [language, refs] of [['fr', [245, 246, 325, 326, 291, 292, 313, 314, 2113, 2114]], ['pt', [245, 246, 291, 292, 313, 314, 325, 326, 2113, 2114]], ['de', [291, 292]], ['it', [291, 292]], ['zh', [291, 292]]]) {
   const get = lessonRefs(snapshot, language);
   for (const ref of refs) {
    const before = get(ref).exercise, after = patched('exercises', before);
    assert(before.card_id);
    assertEquals(after.card_id, null);
    const oldCard = snapshot.cards.find(c => c.id === before.card_id);
    assert(oldCard);
    assertEquals(patched('cards', oldCard), oldCard);
   }
  }
});

Deno.test('reading reassignments preserve language, level, publication and question identities', () => {
  const moves = patches.filter(p => p.table === 'reading_passages' && p.after.unit_id);
  assertEquals(moves.length, 46);
  for (const patch of moves) {
    const before = snapshot.reading_passages.find(x => x.id === patch.id);
    const after = patched('reading_passages', before);
    const oldUnit = snapshot.units.find(x => x.id === before.unit_id);
    const newUnit = snapshot.units.find(x => x.id === after.unit_id);
    assertEquals(newUnit.course_id, before.course_id);
    assertEquals(oldUnit.course_id, newUnit.course_id);
    assertEquals(after.cefr_level, before.cefr_level);
    assertEquals(after.is_published, before.is_published);
    assertEquals(after.id, before.id);
    const destinations = {
      'Technology & Media': 'Environment & Nature', 'Environment & Nature': 'Technology & Media',
      'Storytelling': 'Technology & Media', 'Hypothetical Situations': 'Travel & Adventure',
      'Literature & Arts': 'Abstract Ideas',
      'Professional Communication': 'Debate & Argumentation',
    };
    assertEquals(newUnit.title, destinations[oldUnit.title]);
    const questions = snapshot.reading_questions.filter(q => q.passage_id === before.id);
    assert(questions.length > 0);
    for (const q of questions) assertEquals(patched('reading_questions', q).passage_id, after.id);
  }
});

/**
 * An inserted row has no frozen counterpart, so `patched()` never sees it and
 * every other loop here iterates the snapshot. Without this, an authored
 * reading question could reach the draft with no runtime check at all.
 *
 * Passes vacuously while no producer emits an insert, which is the point: it is
 * armed for the first one.
 */
Deno.test('every inserted reading question is answerable and has exactly one right option', () => {
  const inserted = patches.filter(p => p.op === 'insert');
  for (const patch of inserted) {
    assertEquals(patch.table, 'reading_questions', `unexpected insert table: ${patch.table}`);
    assertEquals(patch.before, null);
    assert(!snapshot.reading_questions.some(r => r.id === patch.id), `insert collides with a frozen row: ${patch.id}`);
    const row = { id: patch.id, ...patch.after };
    assert(snapshot.reading_passages.some(p => p.id === row.passage_id), `inserted question has no passage: ${patch.id}`);
    const question = {
      questionType: row.question_type,
      correctAnswer: row.correct_answer,
      acceptedAnswers: row.accepted_answers ?? [],
      options: row.options,
    };
    // `lib/reading-questions.ts` is deliberately NOT imported here. Its
    // type-only import of `lib/semantic-grading.ts` reaches `lib/supabase`, and
    // `deno test` type-checks the graph even though the import erases at
    // runtime — which is why corpus-runtime-checks.mjs may import it (it runs
    // under `deno run`, unchecked) and this file may not. The two lines below
    // are exactly what `gradeReadingAnswer` does: a tapped choice is graded
    // strictly, a typed short answer with tolerance. Keep them in step.
    const grade = answer => gradeAnswer(answer, question.correctAnswer, question.acceptedAnswers, {
      exerciseHints: question.questionType === 'short_answer' ? undefined : { exerciseType: 'multiple_choice' },
    }).isCorrect;
    assert(typeof row.question_text === 'string' && row.question_text.trim(), `inserted question has no text: ${patch.id}`);
    assert(grade(row.correct_answer), `inserted key is not accepted: ${patch.id}`);
    for (const alternative of question.acceptedAnswers) assert(grade(alternative), `inserted alternative rejected: ${patch.id}: ${alternative}`);
    if (row.question_type !== 'short_answer') {
      const options = row.options?.length ? row.options : (row.question_type === 'true_false' ? ['True', 'False'] : []);
      assertEquals(options.filter(grade), [row.correct_answer], `inserted choice has not exactly one right option: ${patch.id}`);
      assertEquals(new Set(options).size, options.length, `inserted choice repeats an option: ${patch.id}`);
    }
    // A new sibling must not land on an ordinal another question already holds.
    const siblings = snapshot.reading_questions.filter(r => r.passage_id === row.passage_id);
    assert(!siblings.some(r => r.order_index === row.order_index), `inserted question collides on order_index: ${patch.id}`);
  }
});
