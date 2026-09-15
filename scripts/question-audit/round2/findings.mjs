/**
 * The round-2 register: what each of the nine open items became.
 *
 * Five of the nine produce no patch. That is the point of writing them down
 * rather than quietly dropping them: two were already fixed by round one and
 * the register had gone stale, one is settled in favour of the existing content,
 * one turns out not to be a defect at all, and one is a judgement the audit
 * should not make on its own. Each carries the evidence that decides it, and
 * every claim about a stored value is re-checked against the frozen snapshot
 * when this runs, so a stale finding fails the build instead of being published.
 *
 *   node scripts/question-audit/round2/findings.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SNAPSHOT_FILE, SNAPSHOT_SHA, createRound2PatchSet } from './patch-set-round2.mjs';
import { loadTriage, DEPENDENT_ROWS, PARTIALLY_HELD, TRIAGE_SHA, TRIAGE_SOURCE } from './triage-accepted-answers.mjs';
import { loadCandidates, REGISTER_RULING, REGISTER_REMOVALS, REGISTER_KEPT, FR_C0024, CANDIDATES_SHA, RULED_ON } from './product-rulings.mjs';

const raw = await readFile(SNAPSHOT_FILE, 'utf8');
if (createHash('sha256').update(raw).digest('hex') !== SNAPSHOT_SHA) throw new Error('Changed frozen snapshot');
const snapshot = JSON.parse(raw);
const { row } = await createRound2PatchSet();
const exercise = id => row('exercises', id);

/** Assert a stored field is exactly what a finding claims, or fail loudly. */
function frozen(id, field, expected, claim) {
  const actual = exercise(id)[field];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${claim}: ${id}.${field} is ${JSON.stringify(actual)}, the finding says ${JSON.stringify(expected)}`);
  }
  return actual;
}

/** 1 & 2 — already fixed by round one; the open-items register is stale. */
const ALREADY_FIXED = [
  {
    item: 1, ref: 'it-E1074', id: 'c98104aa-5e43-4610-b530-d5ba9255b51e',
    claim: 'The Festa/Festival choice row is semantically ambiguous because the batch asserts Festival is also correct.',
    disposition: 'withdrawn — already corrected and deployed by round one',
    evidence: 'The deployed row offers ["Winter","To celebrate","Holiday","Gift"]. "Festival" was replaced by "Winter" in the round-1 patch (italian-lesson-fixes.mjs), so the option the claim is about is no longer offered.',
    field: 'options', now: ['Winter', 'To celebrate', 'Holiday', 'Gift'],
  },
  {
    item: 1, ref: 'it-E1876', id: '5f44217a-f420-4f10-9956-809d0630e997',
    claim: 'The Etica/Morality choice row is semantically ambiguous.',
    disposition: 'withdrawn — already corrected and deployed by round one',
    evidence: '"Morality" was replaced by "Wealth". The deployed options are ["Wealth","Ethics","Freedom","Doubt"].',
    field: 'options', now: ['Wealth', 'Ethics', 'Freedom', 'Doubt'],
  },
  {
    item: 1, ref: 'it-E1960', id: '13bddacc-7f3d-43f0-a6b9-80cc9a6aa37e',
    claim: 'The Tuttavia/Nevertheless choice row is semantically ambiguous.',
    disposition: 'withdrawn — already corrected and deployed by round one',
    evidence: '"Nevertheless" was replaced by "Therefore". The deployed options are ["Therefore","However","Claim","Evidence"].',
    field: 'options', now: ['Therefore', 'However', 'Claim', 'Evidence'],
  },
  {
    item: 2, ref: 'it-E1008', id: 'aabbccdd-4444-2007-0002-e00000000004',
    claim: 'A fifth welded blank renders as "Menocaro".',
    disposition: 'withdrawn — already corrected and deployed by round one',
    evidence: 'The deployed prompt is "Meno _____ (Cheaper)", separated by italian-cross-row-fixes.mjs. Filled with the key "caro" it renders "Meno caro".',
    field: 'prompt', now: 'Meno _____ (Cheaper)',
  },
];

/** 3 — the one uncertain German field, settled. */
const DE_E2035 = {
  item: 3, ref: 'de-E2035', id: 'aabbccdd-3333-4003-0005-e00000000003',
  claim: '"Pressure group" is an uncertain accepted answer for "Translate to English: Interessengruppe".',
  disposition: 'settled — keep it; the alternative is correct',
  reasoning: [
    'Duden defines Interessengruppe as "Zusammenschluss von Personen zur Durchsetzung politischer oder gesellschaftlicher Ziele" and lists Lobby among its synonyms. A group formed to press political or social aims is what English calls a pressure group.',
    'Bilingual dictionaries give the equivalence directly: Langenscheidt lists interest group, pressure group and lobby; PONS gives interest group and lobby.',
    'The prompt is bare — "Translate to English: Interessengruppe" — so nothing narrows it to the business sense the stored key "Stakeholder" reflects. That is the same standard under which round one kept dozens of dictionary equivalents on bare prompts.',
    'The row is translate_to_native with no options, so no wrong answer is marked right either way; the only question was whether a correct alternative was being wrongly offered. It is not.',
  ],
  sources: [
    'https://www.duden.de/rechtschreibung/Interessengruppe',
    'https://en.langenscheidt.com/german-english/interessengruppe',
    'https://en.pons.com/translate/german-english/Interessengruppe',
  ],
  accepted_answers: ['Interest group', 'Pressure group'],
};

/** 5 — the "malformed" Portuguese row. */
const PT_FORES = {
  item: 5, ref: 'pt B2 / Complex Grammar / O Futuro do Conjuntivo, row 0',
  id: null,
  claim: 'The non-word "fores" appears as a taught string; it looks like truncation.',
  disposition: 'withdrawn — "fores" is a real and correctly used Portuguese form',
  reasoning: [
    'fores is the tu (second person singular) future subjunctive of ir: for, fores, for, formos, fordes, forem.',
    'The row is "Complete: «Quando ___ a Lisboa, visita o Mosteiro dos Jerónimos.» (tu, ir)" with key "fores" and target_grammar "futuro_do_conjuntivo". Quando + futuro do conjuntivo with a tu subject is exactly the form the lesson teaches, and the parenthesis names both the person and the verb.',
    'The distractors are well chosen: vais (presente do indicativo), irás (futuro do indicativo) and vás (presente do conjuntivo) are each a different form of the same lemma, which is what the lesson is contrasting.',
    'Nothing is truncated: the blank stands where a whole word goes, separated by spaces on both sides.',
  ],
  sources: ['https://dicionario.priberam.org/Conjugar/ir'],
};

/** 4 — needs the Travel unit owner, so it is proposed, not compiled. */
const ZH_E1321 = {
  item: 4, ref: 'zh-E1321', id: 'aabbccdd-8888-3003-0002-e00000000003',
  claim: 'Whether "Booking" and "To reserve" belong on the 预约 row is part of speech as much as lexis.',
  disposition: 'HELD — a proposal, deliberately NOT in draft.sql; it needs the Travel unit owner\'s ruling',
  why_no_dictionary_settles_it: [
    'MDBG glosses 预约 as "booking / reservation / to book / to make an appointment" — both a noun and a verb, so both contested alternatives are inside the dictionary range of the word taken alone.',
    'The distinction the curriculum is actually teaching is narrower than the dictionary: 预约 is used for scheduling a person or a service (a doctor, a haircut), 预订 for reserving a thing or a space (a room, a ticket, a table).',
    'The curriculum carries that contrast entirely through part of speech. Across all 25 rows that mention either word, 预约 is glossed only as a noun — "Appointment" (A2 Health & Wellness, six rows) and "Reservation" (B1 Travel & Adventure, three rows) — and 预订 only as a verb, "To book", in all six of its rows. Accepting "Booking" and "To reserve" on a 预约 row erases the only signal the learner has.',
    'No wrong answer is graded right either way: the row is translate_to_native with no options. The cost is teaching clarity, not scoring.',
  ],
  proposal: {
    table: 'exercises', id: 'aabbccdd-8888-3003-0002-e00000000003', field: 'accepted_answers',
    before: ['Appointment', 'Booking', 'To reserve'], after: ['Appointment'],
    rationale: 'Keep the key "Reservation" and the noun "Appointment", which are the two glosses the curriculum already teaches for 预约. Drop "To reserve", which is what the curriculum teaches 预订 to mean, and "Booking", the noun of that same verb.',
  },
  second_finding_for_the_same_owner: {
    ref: 'zh B1 Travel & Adventure / Hotel Check-in', id: 'aabbccdd-8888-3003-0003-e00000000002',
    note: 'A hotel reservation is 预订, not 预约. "Translate to Chinese: Reservation" keys 预约 in a Hotel Check-in lesson, which is the same contrast pointing the other way and is arguably the sharper defect. Also held; the two should be ruled on together.',
  },
  sources: [
    'https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E9%A2%84%E7%BA%A6',
    'https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E9%A2%84%E8%AE%A2',
  ],
};

/** 6 — distractors for vocabulary the lesson no longer teaches. */
const UNTAUGHT_DISTRACTORS = {
  item: 6, refs: ['es-E2097', 'es-E2098', 'ja-E2098', 'ko-E2102'],
  ids: ['aabbccdd-1111-4004-0003-e00000000009', 'aabbccdd-1111-4004-0003-e00000000010', 'aabbccdd-6666-4004-0003-e00000000010', '7f9f1103-d889-426d-870b-0970f2b48ef9'],
  claim: 'After round one replaced the Painting and Sculpture rows, these four rows offer Painting/Sculpture as distractors for vocabulary their lesson no longer teaches.',
  disposition: 'judged — no change; the distractors stay',
  reasoning: [
    'A distractor is not a taught item and does not have to be one. Its job is to be plausible and wrong, and Painting and Sculpture are both.',
    'They remain taught in the SAME unit: Literature & Arts teaches Painting and Sculpture in Describing Art and Book Reviews, two lessons the learner meets before Film & Theater. A distractor drawn from the unit\'s own pool is how a distractor is built, and round one used exactly that reasoning to withdraw the claim against zh-E1347 and its six siblings.',
    'The grader was re-run over all four after the round-2 patch: each still has exactly one option accepted (see runtime-checks.json).',
    'Changing them would mean authoring four new distractors in three languages to fix nothing a learner can see.',
  ],
};

/** 9 — the two whole-language refusals, listed exactly. */
const PARADIGM_REFUSALS = {
  item: 9,
  russian: {
    disposition: 'refused — the remedy would reject correct answers',
    reasoning: 'Russian past tense agrees with the speaker\'s gender and the future admits pronoun dropping. Several rows list only one form and rely on the typo budget to accept the other. Making them strict would reject a woman writing the feminine past, which is worse than the hole it closes. The alternatives must be authored first; that is an accepted_answers job, not a target_grammar one.',
    correct_strings_currently_riding_on_tolerance: [
      { id: 'aabbccdd-9999-2005-0001-e00000000008', key: 'Я учился', would_start_rejecting: ['Я училась'], note: 'feminine past of учиться' },
      { id: 'aabbccdd-9999-2005-0002-e00000000008', key: 'Я играл', would_start_rejecting: ['Я играла', 'Я сыграл'], note: 'feminine past, and the perfective the row already accepts in the feminine only' },
      { id: 'aabbccdd-9999-2005-0004-e00000000002', key: 'Я увидел', would_start_rejecting: ['Я видел', 'Я видела'], note: 'imperfective, defensible for "I saw"' },
      { id: 'aabbccdd-9999-2005-0005-e00000000002', key: 'Я купил', would_start_rejecting: ['Я купила'], note: 'feminine past' },
      { id: 'aabbccdd-9999-2005-0006-e00000000002', key: 'Я путешествовал', would_start_rejecting: ['Я путешествовала'], note: 'feminine past; this row lists no alternatives at all' },
      { id: 'aabbccdd-9999-2006-0004-e00000000002', key: 'Я буду учиться', would_start_rejecting: ['Буду учиться'], note: 'pronoun dropped' },
      { id: 'aabbccdd-9999-2006-0005-e00000000002', key: 'Я буду путешествовать', would_start_rejecting: ['Буду путешествовать'], note: 'pronoun dropped' },
      { id: 'aabbccdd-9999-2006-0006-e00000000002', key: 'Я буду работать', would_start_rejecting: ['Буду работать'], note: 'pronoun dropped' },
      { id: 'aabbccdd-9999-3007-0004-e00000000002', key: 'Я хотел бы', would_start_rejecting: ['Я хотела бы', 'Хотел бы'], note: 'feminine, and pronoun dropped' },
    ],
  },
  chinese: {
    disposition: 'refused — there is no paradigm to close, and strictness would reject correct answers',
    reasoning: 'Chinese verbs do not inflect, so the tense pair the remedy targets does not exist: 我吃了 and 我会吃 are nowhere near each other in edit distance. What the typo budget is actually accepting on these rows is a set of correct alternatives the rows do not list.',
    correct_strings_currently_riding_on_tolerance: [
      { id: 'aabbccdd-8888-2005-0006-e00000000002', key: '我旅行了', would_start_rejecting: ['我去旅行了', '我旅游了'] },
      { id: 'aabbccdd-8888-2006-0004-e00000000002', key: '我会学习', would_start_rejecting: ['我将学习', '我将会学习', '我要学习'] },
      { id: 'aabbccdd-8888-2006-0005-e00000000002', key: '我会旅行', would_start_rejecting: ['我将旅行', '我将会旅行', '我会去旅行'] },
      { id: 'aabbccdd-8888-2006-0006-e00000000002', key: '我会工作', would_start_rejecting: ['我将工作', '我将会工作', '我要工作'] },
    ],
  },
  other_exclusions: [
    'translate_to_native rows whose answer is English (126 finite-verb-glossed rows). Measured: none accepts any other string in its language\'s corpus, and "I study" is already refused on an "I studied" row. Two exceptions are patched, the French and Portuguese "Cheaper" rows, which accept "Cheap".',
    'B1 Opinions & Current Events ("I agree", "I disagree", "I think that") and B1 Formal vs. Informal ("Would you mind"): set phrases with no taught sibling form. 63 and 18 rows.',
    'One A1 Work & Social row glossed "It is windy.": a fixed weather expression, not a paradigm member.',
    'Every speaking row, refused by the compiler itself.',
  ],
};

/** 7 — what the Film & Theater pool actually contains, and what was left alone. */
const SHARED_POOL = {
  item: 7,
  disposition: 'patched for the six languages round one did not reach; the rest of the pool is left alone, with reasons',
  measurement: 'Every Literature & Arts unit rotates one twelve-word pool across six lessons: Novel, Poem, Painting, Sculpture, Metaphor, Symbolism, Genre, Protagonist, Plot twist, Review, Masterpiece, Inspiration.',
  reasoning: [
    'Ten of the twelve are ordinary film-and-theatre criticism vocabulary. Metaphor, symbolism, genre, protagonist, plot twist, review, masterpiece and inspiration are said of films and plays as naturally as of novels; replacing them would make the lesson worse, not more honest.',
    'Two are not: Painting and Sculpture name visual-art objects. That is precisely the line round one drew, and this patch applies the same line to French, German, Italian, Portuguese, Chinese and Russian, where the two rows and the Painting listening pair were never touched.',
    'Describing Art keeps Painting and Sculpture, which is where they belong, alongside literary items. "Art" covering letters inside a unit named Literature & Arts is a naming judgement, not a defect, so its title is not changed.',
  ],
};

/** The triage block: 298 confirmed Japanese and Korean rows, and the two
 * decisions the triage deliberately did not make. Both decisions are carried
 * here so they reach a human rather than expiring inside a worktree. */
const triage = await loadTriage();
const TRIAGE = {
  rows: triage.length,
  additions: triage.reduce((total, entry) => total + entry.additions.length, 0),
  by_language: triage.reduce((acc, entry) => ({ ...acc, [entry.language]: (acc[entry.language] ?? 0) + 1 }), {}),
  by_type: triage.reduce((acc, entry) => ({ ...acc, [entry.exercise_type]: (acc[entry.exercise_type] ?? 0) + 1 }), {}),
  source: TRIAGE_SOURCE,
  source_sha256: TRIAGE_SHA,
  why_these_are_content_defects: [
    '283 of the 298 are listening_type or dictation. On those the learner is shown no text and no gloss: components/lesson/ListeningExercise.tsx withholds `prompt` deliberately, because `prompt` is the string handed to text-to-speech and printing it would show the answer, and components/lesson/DictationExercise.tsx speaks `correct_answer` as its stimulus, which is what dictation is.',
    'So nothing in the task selects a script. A learner who hears おねがいします may correctly transcribe it in kana or in kanji, and the row accepts exactly one of the two. The addition is what makes the row answerable — no rendering change could substitute, because rendering the cue would destroy the exercise.',
    'All 298 had accepted_answers empty in the frozen snapshot and still do; the build re-checks key, type and emptiness on every row before writing.',
  ],
  dependency: {
    rows: Object.keys(DEPENDENT_ROWS),
    what: 'Adding the kanji spellings of おばあさん / おじいさん / おじさん / おばさん pulls お母さん, お父さん, お姉さん, お嬢さん and お隣さん inside the typo budget — 12 collateral acceptances in total, on rows whose whole purpose is separating kinship terms.',
    remedy: 'The Japanese edit-distance gate on the grader branch, which refuses fuzzy acceptance on a kanji-bearing answer before the typo budget is consulted. NOT a pair list: the grader measured that the five confusable pairs first authored for this collision could never fire behind the gate, and withdrew them as inert. The two kana pairs that remain there address a collision that exists independently of these additions.',
    recorded_where: 'In each of the four patch reasons, prefixed DEPENDENCY and naming the gate, so it travels with the row rather than living only in this file.',
    collateral: Object.entries(DEPENDENT_ROWS).flatMap(([ref, strings]) => strings.map(string => ({ ref, string }))),
  },
  open_decisions_now_ruled_on: 'Both were settled on 2026-09-15; see `rulings`. The text below is kept as the record of what was decided and at what cost.',
  open_decisions_carried_forward: [
    {
      decision: 'Japanese orthography on written-production rows',
      rows: 61, candidates: 65, types: '40 translate_to_target, 25 cloze_deletion',
      question: 'On a row whose cue is an English gloss ("Translate to Japanese: Right"), does a correct Japanese word written in the other script count, or is the taught spelling part of what the item tests?',
      accepting_costs: 'The course stops requiring kanji production anywhere: a learner could finish the Japanese track in hiragana. That is a real pedagogical loss, which is why it is not simply a defect.',
      refusing_costs: 'The kanji requirement is nowhere stated and the curriculum does not follow one — 明日, 社会 and 椅子 are keyed in kanji while まっすぐ, おいしい, すごい, たぶん, さらに and めったに are keyed in kana, and ご飯, お風呂 and もっと大きい are mixed. Refusing means telling some learners their correct answer is wrong with no way to have known.',
      triage_recommendation: 'Accept the reading. 65 additions, all exact matches, and verified to bring no other taught string inside the typo budget.',
      note: 'One row was already decided the other way by accident: ja-E2267 had うけみ added by the deployed patch. Under this triage that row is part of the confirmed transcription class, so the precedent is no longer isolated — but the written-production question should still be settled deliberately.',
    },
    {
      decision: 'Register variants on a cue that names no register',
      rows: 12, candidates: 20,
      question: 'When the cue is a bare English gloss ("Translate to Korean: No") and the key is at one politeness level, does the same word at another level count?',
      sub_cases: {
        politeness_raised: '공부했습니다 for 공부했어요, 바랍니다 for 바란다, 아닙니다 for 아니요, でしょう for だろう, 料理します for 料理する. Both forms are polite; refusing is hard to justify on a cue that names no register.',
        politeness_dropped: 'おはよう for おはようございます, おやすみ for おやすみなさい, 아니 for 아니요, 해야 해요 for 해야 한다. Here the learner has changed the register, and A1 teaches the polite form specifically.',
      },
      triage_recommendation: 'Split them: accept upward, refuse downward. Implementable per row.',
      consistency_problem_the_decision_must_also_settle: 'The Japanese alternatives batch already refuses おはよう for おはようございます under JA-POLITE-AFFIX while accepting ごめん for すみません, うん for はい and ううん for いいえ as lexical — the same casual-for-polite move on the same kind of bare A1 gloss. One position has to give, and those four rows should be made to match whichever way this goes.',
    },
  ],
  rows_where_only_the_confirmed_half_is_patched: PARTIALLY_HELD,
};

const candidates = (await loadCandidates()).filter(entry => entry.verdict === 'needs_human');
const isScript = entry => entry.group === 'ja_script_policy' || (entry.group === 'individual' && entry.candidate === 'イス');

/** The four rulings of 2026-09-15, and what each one became. */
const RULINGS = {
  ruled_on: RULED_ON,
  candidates_source_sha256: CANDIDATES_SHA,
  '1_japanese_script': {
    ruling: 'Accept the reading. On a row whose cue is an English gloss, the same Japanese word typed in the other script is correct.',
    compiled: { rows: new Set(candidates.filter(isScript).map(e => e.exercise_id)).size, additions: candidates.filter(isScript).length },
    note: 'Every addition is an exact match once added, so no typo tolerance is involved; re-measured against all 2,281 taught Japanese strings, none brings another inside any row\'s budget.',
    accepted_cost: 'The course no longer requires kanji production anywhere: a learner can complete the Japanese written-production rows in hiragana. Recorded because it was the reason this was a decision rather than a defect, and it should not be rediscovered as a surprise.',
  },
  '2_register': {
    ruling: 'Accept upward, refuse downward. A more polite form than the key is correct on a cue that names no register; a less polite one is not.',
    compiled: { candidates: 19, accepted: 12, refused: 7 },
    refused: Object.entries(REGISTER_RULING).filter(([, [accept]]) => !accept)
      .map(([key, [, note]]) => ({ row: key.split('|')[0], candidate: key.split('|')[1], note })),
    THE_EXAMPLE_LIST_WAS_WRONG_AND_THE_PRINCIPLE_GOVERNS: {
      read_this_first: 'If you find a REFUSE list naming 해야 해요 and wonder why the corpus accepts it, nothing drifted. The list was wrong and was corrected on 2026-09-15; the ruling itself never changed.',
      what_happened: 'The ruling is "accept upward, refuse downward". The example lists that travelled with it were relayed from the triage\'s two bullets, and its "politeness dropped" bullet had mis-filed 해야 해요 — treating the keyed 해야 한다 as though it were the polite form. In the Korean speech-level hierarchy 한다체 (plain) < 해요체 (polite) < 합니다체 (deferential), so 해야 해요 against 해야 한다 is a move UP and the ruling accepts it.',
      resolution: 'The first build followed the example and refused it, flagging the contradiction rather than smoothing it. The example was then confirmed to be relayed prose rather than part of the ruling, and the principle governs: 해야 해요 (ko-E1670) and 바라요 (ko-E1684) are both accepted. Applying the principle correctly is implementing the ruling, not overriding it.',
      consequence_that_is_not_a_duplicate: 'ko-E1684 now accepts 바라요 and 바랍니다 together, one 해요체 and one 합니다체. Both are a step up from a plain-form key, so both are correct under the principle.',
    },
  },
  '2a_register_removals': {
    ruling: 'Refuse downward. Four live accepted answers were put to this producer; two are withdrawn and two are deliberately kept.',
    why_each_is_argued_separately: 'A removal is the only change in round two that makes a previously accepted learner answer start being rejected. Each is argued on its own row, and so is each refusal to remove.',
    THE_RULE_OF_RECORD: 'Refuse a candidate that is the key\'s own formula with its politeness marking dropped, or that sits in the casual register against a polite key. Keep a candidate that is a distinct formula and is itself correct polite language, even when it is less formal than the key. "Less polite" is not one relation, and the two halves of it are decided differently: deference and formality move a candidate down, intimacy alone does not.',
    the_line_drawn: [
      'REFUSE a candidate that is the key\'s own formula with its politeness marking dropped, or that sits in the casual register against a polite key. That is the move the ruling names — おはよう for おはようございます, 아니 for 아니요, 공부했다 for 공부했어요.',
      'KEEP a candidate that is a distinct formula and is itself correct polite language, even when less formal than the key. Rejecting those tells a learner that natural, polite, correct output is wrong, which is a worse failure than the one being fixed.',
    ],
    mechanical_support: 'Across every non-speaking Japanese and Korean row, NO accepted answer is the stored key with a politeness marker removed (ございます / ます / なさい / です / ください; 습니다 / ㅂ니다 / 어요 / 아요 / 요 / 세요). The corpus does not contain the paradigm case at all. ちょっと失礼 is the one near-miss, and it is a truncation of its ROW-MATE 失礼します rather than of the key.',
    removed: REGISTER_REMOVALS.map(entry => ({ ref: entry.ref, id: entry.id, prompt: entry.prompt, key: entry.key, removed: entry.remove, before: entry.before, after: entry.after, why_downward: entry.why_downward })),
    kept: REGISTER_KEPT.map(entry => ({ ref: entry.ref, key: entry.key, kept: entry.kept, why_kept: entry.why_kept })),
    overturned: [
      'ごめんなさい — put forward as "your call". Kept: it is not a de-politened すみません, it carries its own polite ending なさい, and its casual form ごめん appears nowhere in the corpus.',
      'ええ — put forward as "likely downward". Kept: it is inside the polite register rather than below it, and the casual affirmative うん is accepted nowhere. Less FORMAL than はい, not less polite.',
    ],
    the_other_half_of_the_contradiction: 'The translate rows keyed おはようございます and おやすみなさい carry NO accepted answers, and the two speaking rows accept only themselves. The corpus refuses おはよう and おやすみ by having no alternative rather than by an authored refusal. Ruling 2 makes that deliberate; nothing needed to change on those rows.',
  },
  '2b_the_reversal_that_is_not': {
    instruction: 'Remove ごめん for すみません, うん for はい and ううん for いいえ from production, as shipped in the round-1 patch.',
    finding: 'There is nothing to remove. Those three strings are in no row and never were.',
    what_actually_happened: [
      'An early draft of the Japanese alternatives batch (source sha 747140d3…) did add all three.',
      'The independent reviewer flagged exactly this register contradiction and marked the field `revise`.',
      'The author removed them. The final draft (sha 0f0764d3…) carries ["ごめんなさい","申し訳ありません","申し訳ございません"], ["ええ"] and ["いや"], and the reviewer cleared it `approve_as_correction`.',
      'That final draft is what deployed, so the reversal had already happened before the deploy — during round-1 review.',
      'remediation/ja-alternatives-root-review/README.md §2 was written against the FIRST source sha and never updated. The contradiction was carried forward from that prose rather than from the field decisions beside it.',
    ],
    verified: [
      'No patch in the round-1 draft-patches.json adds any of the three.',
      'A read-only count against production — select count(*) from exercises where accepted_answers && ARRAY[ごめん, うん, ううん] — returns 0.',
      'A test asserts the three appear in no frozen row and in no round-2 patch.',
    ],
    what_the_live_values_actually_are: 'Re-read from the pinned snapshot and confirmed against production: key すみません accepts ごめんなさい / 申し訳ありません / 申し訳ございません on one row and 失礼します / ちょっと失礼 on another; key はい accepts ええ; key いいえ accepts いや. Adjudicated in `2a_register_removals`.',
    what_IS_live_and_was_NOT_removed: {
      why_not: 'These are the real instances of the shape the ruling is about, but they are different strings with different register facts — ごめんなさい and ええ are themselves polite, merely less formal than the key — and removing a shipped accepted answer is the one change that makes a previously accepted learner answer start being rejected. That is named here rather than done unilaterally.',
      rows: [
        { id: 'aabbccdd-6666-1001-0003-e00000000006', ref: 'ja-E0030', prompt: 'Translate to Japanese: Sorry', key: 'すみません', live: ['ごめんなさい', '申し訳ありません', '申し訳ございません'], softer_than_the_key: ['ごめんなさい'] },
        { id: 'aabbccdd-6666-1001-0005-e00000000006', ref: 'ja-E0054', prompt: 'Translate to Japanese: Yes', key: 'はい', live: ['ええ'], softer_than_the_key: ['ええ'] },
        { id: 'aabbccdd-6666-1001-0006-e00000000006', ref: 'ja-E0066', prompt: 'Translate to Japanese: No', key: 'いいえ', live: ['いや'], softer_than_the_key: ['いや'] },
      ],
      superseded_by: 'The second instruction arrived with the exact live values. See `2a_register_removals`: いや and ちょっと失礼 are withdrawn; ごめんなさい and ええ are kept, with the reasoning.',
    },
  },
  '3_fr_C0024': {
    ruling: 'Accept the paraphrase. A B1 reading checkpoint whose key is a single connector also accepts a multi-word paraphrase of the same relation.',
    compiled: { rows: 1, additions: 1, addition: FR_C0024.addition, before: FR_C0024.before },
    note: 'The elision hypothesis the claim was filed under does not arise: checkpoint normalizeAnswer strips every non-letter, non-digit, non-space character before comparing, so the apostrophe is not in the comparison and both typographies collapse to one string. The unelided "par l\u2019intermédiaire de" stays refused — "de un" is ungrammatical — and a test asserts it.',
    closes: 'The last open French claim.',
  },
  '4_reading_bar': {
    ruling: 'No change. The five passages keep three questions and READING_COMPREHENSION_PASS stays at 0.70, so a learner still needs all three.',
    compiled: { rows: 0 },
    note: 'Nothing done. lib/cefr-proficiency.ts is not touched by this branch; another engineer owns it.',
  },
};

const findings = {
  round: 2,
  snapshot_sha256: SNAPSHOT_SHA,
  status: 'Draft findings for independent round-2 review. Nothing here is deployed.',
  APPLY_PRECONDITION: 'This patch MUST ship in the same release as the grader branch — the Japanese edit-distance gate and the kinship confusable pairs — and NOT before it. The 313 accepted-answer additions widen typo tolerance on 88 rows while the gate is absent, and four of them let twelve other taught kinship terms through. Under strict grading all 313 additions still pass and all twelve collateral acceptances vanish, which is what makes the two halves complementary rather than merely compatible.',
  items: {
    '1_italian_ambiguous_choice_rows': { patched: 0, see: 'already_fixed_by_round_one' },
    '2_italian_welded_blank_it_E1008': { patched: 0, see: 'already_fixed_by_round_one' },
    '3_de_E2035_pressure_group': { patched: 0, see: 'settled' },
    '4_zh_E1321_booking_vs_to_reserve': { patched: 0, see: 'held_for_the_travel_unit_owner' },
    '5_portuguese_fores': { patched: 0, see: 'withdrawn' },
    '6_untaught_distractors': { patched: 0, see: 'judged_no_change' },
    '7_film_theater_shared_pool': { patched: 24, see: 'shared_pool' },
    '8_phrasal_verbs_title': { patched: 9, see: 'draft-patches.json (lessons)' },
    '9_productive_paradigms': { patched: 249, see: 'paradigm_refusals for what was left out' },
    'triage_298_confirmed_ja_ko_rows': { patched: 298, additions: 313, see: 'triage_block' },
    'rulings_2026_09_15': { patched: 64, additions: 77, removals: 2, see: 'rulings' },
  },
  rulings: RULINGS,
  triage_block: TRIAGE,
  already_fixed_by_round_one: ALREADY_FIXED.map(finding => ({
    ...finding, verified_now: finding.id ? frozen(finding.id, finding.field, finding.now, finding.ref) : null,
  })),
  settled: DE_E2035,
  withdrawn: PT_FORES,
  held_for_the_travel_unit_owner: ZH_E1321,
  judged_no_change: UNTAUGHT_DISTRACTORS,
  shared_pool: SHARED_POOL,
  paradigm_refusals: PARADIGM_REFUSALS,
};

// Re-check the held and settled claims against the snapshot as well.
frozen(DE_E2035.id, 'accepted_answers', DE_E2035.accepted_answers, 'de-E2035');
frozen(ZH_E1321.id, 'accepted_answers', ZH_E1321.proposal.before, 'zh-E1321');
frozen(ZH_E1321.second_finding_for_the_same_owner.id, 'correct_answer', '预约', 'zh Hotel Check-in');
for (const entry of [...PARADIGM_REFUSALS.russian.correct_strings_currently_riding_on_tolerance,
  ...PARADIGM_REFUSALS.chinese.correct_strings_currently_riding_on_tolerance]) {
  frozen(entry.id, 'correct_answer', entry.key, 'paradigm refusal');
}
for (const id of UNTAUGHT_DISTRACTORS.ids) exercise(id);
const ptRow = snapshot.exercises.find(e => e.correct_answer === 'fores');
if (!ptRow || ptRow.target_grammar !== 'futuro_do_conjuntivo') throw new Error('The Portuguese "fores" row is not where the finding says it is');
findings.withdrawn.id = ptRow.id;

await writeFile('docs/audits/question-verification/round2/findings.json', JSON.stringify(findings, null, 2) + '\n');
console.log(JSON.stringify(findings.items, null, 1));
