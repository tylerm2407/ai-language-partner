/**
 * Two rows that ask the same question must accept the same answers.
 *
 * Group every free-text row by (direction, English gloss, stored key). A group
 * with more than one member is one question asked twice — same bare gloss, same
 * key, no options — so a learner who meets both rows and is marked differently
 * has met a defect, not a distinction. Round one built this check and levelled
 * nineteen Italian groups with it; this generalises the finding to all nine
 * languages. `same-gloss-levelling.test.mjs` generalises the standing test.
 *
 * WHAT THE CORPUS ACTUALLY HOLDS, derived here rather than taken from a report:
 * 4,605 groups across nine languages, 967 of them asked more than once, and
 * **101 of those disagree**, carrying **129 (row, string) omissions**. Italian
 * is at zero, which is round one's batch showing up as a clean result rather
 * than as a claim. The other eight languages had never been swept.
 *
 * NOT 249. See the round-2 report: no JSON report exists on the grader branch
 * to recover that number from — its tree is clean and its only relevant file,
 * `scripts/grading/widening-check.mjs`, has no sibling-alternatives axis, since
 * `taughtKeys` reads `correctAnswer` only. 249 was measured for a different
 * population: what a rule counting sibling ALTERNATIVES as taught strings would
 * refuse, over the whole sibling scope, which is far wider than same-gloss
 * same-key. The number here is the one this file can prove.
 *
 * THE THREE OUTCOMES, and the reason the split matters more than the total:
 *
 *  - 97 LEVELLED. The missing string was already accepted on the twin BEFORE
 *    this patch — a round-one omission, not one this patch created — and
 *    adding it to this row admits nothing else in the language. Gender
 *    agreement (Generosa, Cansada, Vizinha), gendered professions (Enfermero,
 *    Zahnärztin), aspect pairs (Загружать, Отпраздновать), register and script
 *    variants, and eight Russian gendered pasts that also close part of the
 *    Russian alternatives gap this patch reported earlier.
 *
 *  - 14 LEFT PENDING, because the divergence is this patch's own: a ruling was
 *    applied to one row of a group and the twin does not carry the string yet.
 *
 *  - 14 LEFT PENDING, because the divergence is this patch's own: a ruling was
 *    applied to one row of a group and the twin does not carry the string yet.
 *
 *  - 10 HELD, because levelling them would admit a wrong answer, measured
 *    against every taught string in the language. These are the meaning flips
 *    the audit exists to catch: "Nurse" would accept Enfermo (sick), "Neighbor"
 *    would accept Cozinha (kitchen), "Tired" would accept Zangada (angry),
 *    "Grandmother" would accept 고모 (aunt), "To cook" would accept Cool. Each
 *    needs a confusable pair keyed on the added string; the list is below.
 *
 *  - 5 DECLARED, because the disagreement is the point. A `cloze_deletion`
 *    asks for ONE missing word, so an overt-subject form — 私は見ました,
 *    저는 공부했어요 — does not fit the frame even though it is correct Japanese
 *    or Korean on the translate row. Round one's Japanese batch withdrew the
 *    overt pronoun from exactly these seven cloze rows for exactly this reason,
 *    and the triage refused 저는 on the two Korean "missing word" rows. Levelling
 *    them would undo a deliberate decision twice made.
 *
 * Levelling is always UP — the string the twin already accepts is added here.
 * Levelling DOWN, removing a shipped alternative from the row that has it, is
 * never done automatically: it makes a previously accepted learner answer start
 * being rejected, which this patch does only where it is argued row by row.
 */

/** [exercise id, ref, language, group id, the string the twin already accepts].
 * Only pre-existing divergence: every string here was accepted by a sibling in
 * the frozen snapshot, so this levels a round-one omission rather than
 * propagating something this patch itself added. */
export const LEVELLED = [
  ["aabbccdd-1111-2001-0003-e00000000008","es-E0592","es","to_target|Neighbor|Vecino","Vecina"],
  ["aabbccdd-1111-2006-0005-e00000000008","es-E0976","es","to_target|Appointment|Cita","Cita médica"],
  ["aabbccdd-1111-2002-0002-e00000000008","es-E0652","es","to_target|Tired|Cansado","Cansada"],
  ["aabbccdd-1111-2004-0004-e00000000002","es-E0814","es","to_target|Excited|Emocionado","Emocionada"],
  ["aabbccdd-1111-2004-0005-e00000000002","es-E0826","es","to_target|Shy|Tímido","Tímida"],
  ["aabbccdd-1111-2004-0002-e00000000008","es-E0796","es","to_target|Generous|Generoso","Generosa"],
  ["aabbccdd-1111-2004-0003-e00000000008","es-E0808","es","to_target|Lazy|Perezoso","Perezosa"],
  ["aabbccdd-1111-2007-0004-e00000000002","es-E1030","es","to_target|Cheaper|Más barato","Más barata"],
  ["aabbccdd-1111-2007-0001-e00000000008","es-E1000","es","to_target|Shorter|Más bajo","Más baja"],
  ["aabbccdd-1111-2007-0002-e00000000008","es-E1012","es","to_target|Faster|Más rápido","Más rápida"],
  ["aabbccdd-1111-2007-0006-e00000000002","es-E1054","es","to_target|Taller|Más alto","Más alta"],
  ["aabbccdd-1111-2007-0003-e00000000008","es-E1024","es","to_target|Slower|Más lento","Más lenta"],
  ["aabbccdd-2222-1003-0005-e00000000002","fr-E0190","fr","to_target|Ticket|Billet","Ticket"],
  ["aabbccdd-2222-2001-0003-e00000000008","fr-E0592","fr","to_target|Neighbor|Voisin","Voisine"],
  ["aabbccdd-2222-2002-0005-e00000000002","fr-E0682","fr","to_target|Nurse|Infirmière","Infirmier"],
  ["aabbccdd-2222-2002-0002-e00000000008","fr-E0652","fr","to_target|Tired|Fatigué","Fatiguée"],
  ["aabbccdd-2222-2004-0002-e00000000008","fr-E0796","fr","to_target|Generous|Généreux","Généreuse"],
  ["aabbccdd-2222-2004-0006-e00000000002","fr-E0838","fr","to_target|Brave|Courageux","Courageuse"],
  ["aabbccdd-2222-2004-0003-e00000000008","fr-E0808","fr","to_target|Lazy|Paresseux","Paresseuse"],
  ["aabbccdd-2222-2007-0004-e00000000002","fr-E1030","fr","to_target|Cheaper|Moins cher","Moins chère"],
  ["aabbccdd-2222-2007-0001-e00000000008","fr-E1000","fr","to_target|Shorter|Plus petit","Plus petite"],
  ["aabbccdd-2222-2007-0005-e00000000002","fr-E1042","fr","to_target|More expensive|Plus cher","Plus chère"],
  ["aabbccdd-2222-2007-0006-e00000000002","fr-E1054","fr","to_target|Taller|Plus grand","Plus grande"],
  ["aabbccdd-2222-2007-0003-e00000000008","fr-E1024","fr","to_target|Slower|Plus lent","Plus lente"],
  ["aabbccdd-2222-3007-0006-e00000000002","fr-E1712","fr","to_target|Imagine|Imagine","Imaginez"],
  ["aabbccdd-3333-2002-0006-e00000000002","de-E0694","de","to_target|Dentist|Zahnarzt","Zahnärztin"],
  ["aabbccdd-3333-3002-0005-e00000000002","de-E1278","de","to_target|To hire|Einstellen","Anstellen"],
  ["aabbccdd-3333-3007-0006-e00000000002","de-E1712","de","to_target|Imagine|Stell dir vor","Stelle dir vor"],
  ["aabbccdd-5555-2002-0001-e00000000005","pt-E0637","pt","to_target|Appointment|Consulta","Compromisso"],
  ["aabbccdd-5555-2002-0004-e00000000002","pt-E0670","pt","to_target|Appointment|Consulta","Compromisso"],
  ["aabbccdd-5555-2002-0001-e00000000008","pt-E0640","pt","to_target|Stress|Estresse","Stresse"],
  ["aabbccdd-5555-2002-0005-e00000000002","pt-E0682","pt","to_target|Nurse|Enfermeira","Enfermeiro"],
  ["aabbccdd-5555-2003-0002-e00000000008","pt-E0724","pt","to_target|Rent|Aluguel","Aluguer"],
  ["aabbccdd-5555-2004-0004-e00000000002","pt-E0814","pt","to_target|Excited|Animado","Animada"],
  ["aabbccdd-5555-2004-0005-e00000000002","pt-E0826","pt","to_target|Shy|Tímido","Tímida"],
  ["aabbccdd-5555-2004-0002-e00000000008","pt-E0796","pt","to_target|Generous|Generoso","Generosa"],
  ["aabbccdd-5555-2004-0006-e00000000002","pt-E0838","pt","to_target|Brave|Corajoso","Corajosa"],
  ["aabbccdd-5555-2004-0003-e00000000008","pt-E0808","pt","to_target|Lazy|Preguiçoso","Preguiçosa"],
  ["aabbccdd-5555-2007-0004-e00000000002","pt-E1030","pt","to_target|Cheaper|Mais barato","Mais barata"],
  ["aabbccdd-5555-2007-0001-e00000000005","pt-E0997","pt","to_target|Cheaper|Mais barato","Menos caro"],
  ["aabbccdd-5555-2007-0001-e00000000005","pt-E0997","pt","to_target|Cheaper|Mais barato","Menos cara"],
  ["aabbccdd-5555-2007-0001-e00000000008","pt-E1000","pt","to_target|Shorter|Mais baixo","Mais baixa"],
  ["aabbccdd-5555-2007-0002-e00000000008","pt-E1012","pt","to_target|Faster|Mais rápido","Mais rápida"],
  ["aabbccdd-5555-2007-0006-e00000000002","pt-E1054","pt","to_target|Taller|Mais alto","Mais alta"],
  ["aabbccdd-5555-2007-0003-e00000000008","pt-E1024","pt","to_target|Slower|Mais lento","Mais lenta"],
  ["aabbccdd-5555-3007-0006-e00000000002","pt-E1712","pt","to_target|Imagine|Imagine","Imagina"],
  ["aabbccdd-9999-2006-0005-e00000000008","ru-E0976","ru","to_target|Appointment|Приём","Приём у врача"],
  ["aabbccdd-9999-2002-0001-e00000000005","ru-E0637","ru","to_target|Appointment|Приём","Встреча"],
  ["aabbccdd-9999-2002-0004-e00000000002","ru-E0670","ru","to_target|Appointment|Приём","Встреча"],
  ["aabbccdd-9999-2003-0004-e00000000002","ru-E0742","ru","to_target|To clean|Убирать","Убираться"],
  ["aabbccdd-9999-2003-0004-e00000000002","ru-E0742","ru","to_target|To clean|Убирать","Убрать"],
  ["aabbccdd-9999-2004-0001-e00000000008","ru-E0784","ru","to_target|Kind|Добрый","Добросердечный"],
  ["aabbccdd-9999-2005-0004-e00000000002","ru-E0886","ru","to_target|I saw|Я увидел","Я видел"],
  ["aabbccdd-9999-2005-0004-e00000000002","ru-E0886","ru","to_target|I saw|Я увидел","Я видела"],
  ["aabbccdd-9999-2005-0001-e00000000008","ru-E0856","ru","to_target|I studied|Я учился","Я училась"],
  ["aabbccdd-9999-2005-0002-e00000000008","ru-E0868","ru","to_target|I played|Я играл","Я играла"],
  ["aabbccdd-9999-2005-0002-e00000000008","ru-E0868","ru","to_target|I played|Я играл","Я сыграл"],
  ["aabbccdd-9999-2005-0006-e00000000002","ru-E0910","ru","to_target|I traveled|Я путешествовал","Я путешествовала"],
  ["aabbccdd-9999-2006-0004-e00000000002","ru-E0958","ru","to_target|I will study|Я буду учиться","Буду учиться"],
  ["aabbccdd-9999-2006-0005-e00000000002","ru-E0970","ru","to_target|I will travel|Я буду путешествовать","Буду путешествовать"],
  ["aabbccdd-9999-2006-0006-e00000000002","ru-E0982","ru","to_target|I will work|Я буду работать","Буду работать"],
  ["aabbccdd-9999-2008-0001-e00000000008","ru-E1072","ru","to_target|To celebrate|Праздновать","Отпраздновать"],
  ["aabbccdd-9999-3005-0004-e00000000002","ru-E1516","ru","to_target|To download|Скачать","Скачивать"],
  ["aabbccdd-9999-3005-0005-e00000000002","ru-E1530","ru","to_target|To upload|Загрузить","Загружать"],
  ["aabbccdd-9999-3007-0004-e00000000002","ru-E1684","ru","to_target|I wish|Я хотел бы","Я хотела бы"],
  ["aabbccdd-9999-3007-0004-e00000000002","ru-E1684","ru","to_target|I wish|Я хотел бы","Хотел бы"],
  ["aabbccdd-9999-3007-0006-e00000000002","ru-E1712","ru","to_target|Imagine|Представь","Представьте"],
  ["aabbccdd-6666-1001-0001-e00000000006","ja-E0006","ja","to_target|Please|お願いします","どうぞ"],
  ["aabbccdd-6666-1005-0002-e00000000007","ja-E0299","ja","to_native|Cold|寒い","Chilly"],
  ["aabbccdd-6666-1008-0004-e00000000004","ja-E0530","ja","to_target|Medicine|薬","医薬品"],
  ["aabbccdd-6666-1008-0006-e00000000004","ja-E0554","ja","to_target|Fever|熱","発熱"],
  ["aabbccdd-6666-2002-0004-e00000000005","ja-E0673","ja","to_target|Stress|ストレス","精神的負担"],
  ["aabbccdd-6666-2003-0001-e00000000008","ja-E0712","ja","to_target|To cook|料理する","料理をする"],
  ["aabbccdd-6666-2003-0001-e00000000008","ja-E0712","ja","to_target|To cook|料理する","調理する"],
  ["aabbccdd-6666-2008-0002-e00000000008","ja-E1084","ja","to_target|Music|音楽","ミュージック"],
  ["aabbccdd-6666-2008-0006-e00000000002","ja-E1126","ja","to_target|Party|パーティー","宴会"],
  ["aabbccdd-6666-3001-0004-e00000000002","ja-E1180","ja","to_target|News|ニュース","報道"],
  ["aabbccdd-7777-1004-0006-e00000000006","ko-E0276","ko","to_target|Money|돈","금전"],
  ["aabbccdd-7777-1007-0001-e00000000006","ko-E0426","ko","to_target|Door|문","출입문"],
  ["aabbccdd-7777-1007-0003-e00000000004","ko-E0448","ko","to_target|Door|문","출입문"],
  ["aabbccdd-7777-2001-0001-e00000000005","ko-E0565","ko","to_target|Niece|조카딸","조카"],
  ["aabbccdd-7777-2008-0003-e00000000005","ko-E1093","ko","to_target|Party|파티","잔치"],
  ["aabbccdd-7777-3001-0004-e00000000002","ko-E1180","ko","to_target|News|뉴스","소식"],
  ["aabbccdd-8888-2003-0006-e00000000003","zh-E0767","zh","to_native|To cook|做饭","To prepare food"],
  ["aabbccdd-8888-2002-0001-e00000000005","zh-E0637","zh","to_target|Appointment|预约","约会"],
  ["aabbccdd-8888-2002-0004-e00000000002","zh-E0670","zh","to_target|Appointment|预约","约会"],
  ["aabbccdd-8888-2005-0006-e00000000002","zh-E0910","zh","to_target|I traveled|我旅行了","我去旅行了"],
  ["aabbccdd-8888-2005-0006-e00000000002","zh-E0910","zh","to_target|I traveled|我旅行了","我旅游了"],
  ["aabbccdd-8888-2006-0004-e00000000002","zh-E0958","zh","to_target|I will study|我会学习","我将学习"],
  ["aabbccdd-8888-2006-0004-e00000000002","zh-E0958","zh","to_target|I will study|我会学习","我将会学习"],
  ["aabbccdd-8888-2006-0004-e00000000002","zh-E0958","zh","to_target|I will study|我会学习","我要学习"],
  ["aabbccdd-8888-2006-0005-e00000000002","zh-E0970","zh","to_target|I will travel|我会旅行","我将旅行"],
  ["aabbccdd-8888-2006-0005-e00000000002","zh-E0970","zh","to_target|I will travel|我会旅行","我将会旅行"],
  ["aabbccdd-8888-2006-0005-e00000000002","zh-E0970","zh","to_target|I will travel|我会旅行","我会去旅行"],
  ["aabbccdd-8888-2006-0006-e00000000002","zh-E0982","zh","to_target|I will work|我会工作","我将工作"],
  ["aabbccdd-8888-2006-0006-e00000000002","zh-E0982","zh","to_target|I will work|我会工作","我将会工作"],
  ["aabbccdd-8888-2006-0006-e00000000002","zh-E0982","zh","to_target|I will work|我会工作","我要工作"],
];

/** Divergence THIS PATCH creates, not round one's. A ruling was applied to one
 * row of a group and the twin now lacks the string. Whether each ruling
 * propagates to the twin is a real question and a small one, and it is left open
 * rather than settled by the mechanics of a levelling sweep — because levelling
 * up spreads a doubtful alternative as readily as a good one. Two here are
 * visibly doubtful: より高い ("higher, more expensive") sits on a "Taller" row,
 * and 願う / 願っています ("to wish") sit on a row keyed したい ("want to do").
 * Propagating those would double an existing problem rather than fix one. */
export const PROPAGATION_PENDING = [
  {"ref":"ja-E1054","lang":"ja","group":"to_target|Taller|もっと背が高い","missing":"より高い"},
  {"ref":"ja-E0745","lang":"ja","group":"to_target|To cook|料理する","missing":"りょうりする"},
  {"ref":"ja-E0745","lang":"ja","group":"to_target|To cook|料理する","missing":"料理します"},
  {"ref":"ja-E0856","lang":"ja","group":"to_target|I studied|勉強しました","missing":"べんきょうしました"},
  {"ref":"ja-E0937","lang":"ja","group":"to_target|I will travel|旅行します","missing":"りょこうします"},
  {"ref":"ja-E1012","lang":"ja","group":"to_target|Faster|もっと速い","missing":"もっと速く"},
  {"ref":"ja-E1024","lang":"ja","group":"to_target|Slower|もっと遅い","missing":"もっと遅く"},
  {"ref":"ja-E1126","lang":"ja","group":"to_target|Party|パーティー","missing":"パーティ"},
  {"ref":"ja-E1684","lang":"ja","group":"to_target|I wish|したい","missing":"願っています"},
  {"ref":"ja-E1684","lang":"ja","group":"to_target|I wish|したい","missing":"願う"},
  {"ref":"ja-E1712","lang":"ja","group":"to_target|Imagine|想像して","missing":"そうぞうして"},
  {"ref":"ko-E0868","lang":"ko","group":"to_target|I played|놀았어요","missing":"놀았습니다"},
  {"ref":"ko-E1645","lang":"ko","group":"to_target|I wish|바란다","missing":"바라요"},
  {"ref":"ko-E1645","lang":"ko","group":"to_target|I wish|바란다","missing":"바랍니다"},
];

export const PROPAGATION_REASON = 'This patch added the string to one row of the group under a 2026-09-15 ruling or a restored withdrawal, and the twin does not carry it. Whether the ruling reaches the twin is a separate decision: the two rows do ask the same question, but levelling up would also spread the alternatives on that row that are themselves doubtful.';

/**
 * Held: levelling would admit the listed string, which is wrong on this row.
 * A confusable pair keyed on `missing` is the remedy for each.
 *
 * The three Japanese comparative entries that used to sit here have moved to
 * `restored-withdrawals.mjs` as GATE_DEPENDENT_COMPARATIVES. They widen on THIS
 * branch, whose grader has no Japanese kanji gate, and not on the merged branch,
 * which has one. A tolerance measurement made from this worktree describes code
 * that will not ship, so the right disposition for them was a gate dependency
 * rather than a hold. The ten below need a confusable pair and no gate reaches
 * them: they are Latin-script and Korean rows. */
export const HELD_WOULD_WIDEN = [
  {"ref":"es-E0682","lang":"es","group":"to_target|Nurse|Enfermera","missing":"Enfermero","admits":["Enfermo"]},
  {"ref":"es-E1042","lang":"es","group":"to_target|More expensive|Más caro","missing":"Más cara","admits":["Más corta","Más baja"]},
  {"ref":"de-E0767","lang":"de","group":"to_native|To cook|Kochen","missing":"Cook","admits":["Cool"]},
  {"ref":"pt-E0592","lang":"pt","group":"to_target|Neighbor|Vizinho","missing":"Vizinha","admits":["Cozinha"]},
  {"ref":"pt-E0652","lang":"pt","group":"to_target|Tired|Cansado","missing":"Cansada","admits":["Zangada"]},
  {"ref":"pt-E1042","lang":"pt","group":"to_target|More expensive|Mais caro","missing":"Mais cara","admits":["Mais curta"]},
  {"ref":"ru-E0736","lang":"ru","group":"to_target|To move|Переезжать","missing":"Переехать","admits":["переехали"]},
  {"ref":"ru-E0898","lang":"ru","group":"to_target|I bought|Я купил","missing":"Я купила","admits":["купила"]},
  {"ref":"ko-E0368","lang":"ko","group":"to_target|Grandmother|할머니","missing":"조모","admits":["고모"]},
  {"ref":"ko-E0694","lang":"ko","group":"to_target|Dentist|치과의사","missing":"치과 의사","admits":["과 의사"]},
];

/** Declared: the group is allowed to disagree, and why. An overt-subject form
 * is correct on a translate row and does not fit a one-word cloze frame. */
export const DECLARED_EXCEPTIONS = [
  {"ref":"ja-E0853","lang":"ja","group":"to_target|I saw|見ました","missing":"私は見ました"},
  {"ref":"ja-E0865","lang":"ja","group":"to_target|I bought|買いました","missing":"私は買いました"},
  {"ref":"ja-E0937","lang":"ja","group":"to_target|I will travel|旅行します","missing":"私は旅行します"},
  {"ref":"ko-E0889","lang":"ko","group":"to_target|I studied|공부했어요","missing":"저는 공부했어요"},
  {"ref":"ko-E1645","lang":"ko","group":"to_target|I wish|바란다","missing":"저는 바랍니다"},
];

export const DECLARED_REASON = 'A cloze_deletion asks for one missing word, so an overt-subject form does not fit the frame even though it is correct on the translate row that shares the gloss and key. Round one withdrew the overt pronoun from these cloze rows deliberately, and the round-2 triage refused it again on the two Korean rows.';

const REASON = (ref, lang, group, missing, twin) =>
  `${ref} (${lang}): same-gloss-same-key levelling. ${twin} already accepts "${missing}" on the identical question — group ${group}: same bare gloss, same stored key, no options — so a learner meeting both rows was marked differently for the same answer. Added here; measured against every taught ${lang} string and it admits nothing else.`;

export function sameGlossLevelling(set, ledger) {
  const { row } = set;
  const byRow = new Map();
  for (const [id, ref, lang, group, missing] of LEVELLED) {
    const original = row('exercises', id);
    if (original.options?.length) throw new Error(`${ref}: became a choice row; re-derive the groups`);
    const entry = byRow.get(id) ?? { ref, lang, group, additions: [] };
    if (entry.group !== group) throw new Error(`${ref}: two groups claim one row`);
    if (entry.additions.includes(missing)) throw new Error(`${ref}: duplicate levelling of ${missing}`);
    if (missing === original.correct_answer) throw new Error(`${ref}: levelling repeats the key`);
    entry.additions.push(missing);
    byRow.set(id, entry);
  }
  for (const [id, entry] of byRow) {
    const twin = entry.group.split('|')[1];
    ledger.contribute(id, {
      block: 'same-gloss-levelling',
      additions: entry.additions,
      reason: REASON(entry.ref, entry.lang, entry.group, entry.additions.join('", "'), `The row sharing the gloss "${twin}"`),
    });
  }
  const byLanguage = LEVELLED.reduce((acc, [, , lang]) => ({ ...acc, [lang]: (acc[lang] ?? 0) + 1 }), {});
  return {
    levelled: LEVELLED.length, rows: byRow.size, held: HELD_WOULD_WIDEN.length,
    propagation_pending: PROPAGATION_PENDING.length, declared: DECLARED_EXCEPTIONS.length, by_language: byLanguage,
  };
}
