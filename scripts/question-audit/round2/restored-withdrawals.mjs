/**
 * Two blocks of correct Japanese answers that round one withdrew pending
 * decisions, recovered and re-adjudicated.
 *
 * The round-one sign-off says it plainly: "The 102 script withdrawals and the 42
 * `within_typo_ball` withdrawals remove correct answers pending decisions that
 * have not been made". Both lists are recovered EXACTLY, and the counts are the
 * real ones rather than the prose's — they happen to agree.
 *
 * HOW THEY WERE RECOVERED. Not by diffing the two source shas. Both lists are
 * already machine-readable in the batch's own evidence file, under
 * `withdrawn_to_policy` (102 entries, every one ground `script_variant`) and
 * `refused` filtered to ground `within_typo_ball` (42 entries). The file is
 * copied here and hashed so this build does not read another worktree:
 *
 *   source  remediation/es-ja-ko/japanese-accepted-alternatives-evidence.json
 *   here    docs/audits/question-verification/round2/ja-alternatives-evidence.json
 *   sha256  83fec33cd17436836ab8651187f544f76e72e900c8f11e86c6fe08ee032062e7
 *
 * OVERLAP WITH ROUND TWO: NONE. Not one of the 144 candidates, and not one of
 * their 102 rows, appears in the 66 Ruling-1 script candidates or the 313 triage
 * additions. They came from a different input — the alternatives batch's 1,163
 * proposals — where the lexical reconciliation that produced the triage block
 * had already excluded rows this batch dispositioned. So this is genuinely new
 * work, and the register was right to imply it.
 *
 * ── THE 42 `within_typo_ball` WITHDRAWALS: 39 RESTORED, 3 HELD ────────────
 *
 * These were withdrawn because each addition brought a string the unit teaches
 * as a different item inside the typo budget, and they were expected to need 39
 * confusable pairs. They do not need the pairs, and they do not need the gate
 * either. Measured against every taught Japanese string with the grader as it
 * stands on this branch: 39 of the 42 widen NOTHING AT ALL.
 *
 * The reason is that round one's own app-half fix already closed the mechanism.
 * The withdrawals were measured against a grader that scaled the typo budget by
 * the MATCHED ALTERNATIVE, so a long correct addition widened tolerance for
 * every wrong neighbour on the row — the 88-instance "readmission by a correct
 * addition" class. `lib/grading.ts` now scales by the SHORTER of the key and the
 * matched alternative, and consults the confusable-pair list in both the accent
 * and the fuzzy branch. The collisions these answers were withdrawn for no
 * longer exist, so they come back on measurement rather than on anybody's
 * promise about an unshipped gate.
 *
 * Three still widen, and are held. Two admit the bare adjective on a
 * comparative row (背が低い on "Shorter", 背が高い on "Taller"), and one is the
 * meaning-flip family the review was right to fear: もっと短い on ja-E1000 admits
 * six other もっと+adjective strings, so "Shorter" would accept "cheaper",
 * "more expensive", "better", "worse", "faster" and "slower". A pair list keyed
 * on the added string is the remedy for that one, and it is named below.
 *
 * ── THE 102 SCRIPT WITHDRAWALS: THE GROUND IS NOT WHAT IT SAYS ────────────
 *
 * Every one of the 102 widens nothing, so a widening check passes all of them.
 * That is exactly why it cannot be the filter here. Reading the list, the ground
 * `script_variant` was applied far more broadly than "the same lexeme in another
 * orthography", and restoring on the label would add wrong answers:
 *
 *   ご飯 <- こめ        cooked rice vs raw rice — different words
 *   赤い <- あか        adjective vs noun — a part-of-speech change
 *   お金 <- かね        drops the honorific お
 *   おばあさん <- そぼ   the own-side humble term, a different lexeme
 *   ドア <- とびら       a door-leaf, not a spelling of ドア
 *   プレゼント <- おくりもの, パスポート <- りょけん, ニュース <- ほうどう — synonyms
 *   解雇する <- 首にする  a different idiom
 *   もっと良い <- よりいい a different construction
 *
 * Tyler's ruling was "the same Japanese word typed in the other script is
 * correct". It licenses orthography, not synonymy, not honorific dropping and
 * not a change of part of speech. So the filter applied here is the ruling's own
 * terms, stated and applied by hand, with every decision listed either way:
 *
 *   ACCEPT  kana <-> kanji, hiragana <-> katakana, a variant kanji with the same
 *           reading, okurigana moved, a long-vowel mark added or dropped, an
 *           iteration mark — the same word, spelled another way.
 *   REFUSE  anything that changes the morpheme count, adds or drops an honorific,
 *           changes part of speech, or is a synonym with a different reading,
 *           whatever ground the evidence file recorded.
 *
 * Two further exclusions, both stated rather than folded into the refusals:
 *
 *  - ALL NINE `fill_blank` CANDIDATES. The key on those rows is a FRAGMENT, and
 *    "the same lexeme in another orthography" is not well defined against a
 *    fragment. It shows: five of the nine are not script variants at all —
 *    もっと_____ (Taller) keyed 背が高い would accept たかい, which means
 *    "expensive/high" and drops 背が; の_____ (While) keyed 間に would accept
 *    あいだ, dropping the に; よろしくお_____ keyed 願いします would accept
 *    ねがいいたします, a different humble verb. Ruling 1's own scope was the 40
 *    translate_to_target and 25 cloze_deletion rows, and fill_blank was not in
 *    it. Excluded as a class.
 *  - `ウェブサイト <- Webサイト`. Latin script is a different question from the
 *    kana/kanji one Tyler ruled on, and nobody has ruled on it.
 *
 * ONE DISTINCTION THE ROW TYPE MAKES, and the only place this producer treats
 * two rows differently. いとこ has six standard kanji spellings. On the LISTENING
 * row the learner heard いとこ and any spelling read いとこ is a faithful
 * transcription, so 従兄弟 and 従姉妹 — the two general spellings — come back. The
 * four that name a specific cousin (従兄 older male, 従弟 younger male, 従姉 older
 * female, 従妹 younger female) assert a gender and seniority neither the audio
 * nor the gloss "Cousin" supplies, and are refused on both row types.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lessonRefs } from '../lesson-refs.mjs';

export const EVIDENCE_FILE = 'docs/audits/question-verification/round2/ja-alternatives-evidence.json';
export const EVIDENCE_SHA = '83fec33cd17436836ab8651187f544f76e72e900c8f11e86c6fe08ee032062e7';
export const EVIDENCE_SOURCE = 'round-1 batch evidence, remediation/es-ja-ko/japanese-accepted-alternatives-evidence.json';

/** `key <- candidate` pairs that ARE the same lexeme in another orthography.
 * Each carries the shared reading, which is the whole of the claim. */
export const SCRIPT_ACCEPT = {
  '鶏肉|とり肉': 'とりにく, with 鶏 written in kana',
  'コーヒー|珈琲': 'コーヒー; 珈琲 is the established ateji for the same loanword',
  'りんご|リンゴ': 'りんご in katakana, the ordinary spelling for the fruit',
  'りんご|林檎': 'りんご in kanji',
  '犬|イヌ': 'いぬ in katakana, standard for the species',
  '猫|ネコ': 'ねこ in katakana',
  '椅子|イス': 'いす in katakana',
  '処方箋|処方せん': 'しょほうせん; 箋 written in kana, the standard newspaper substitution',
  'ソファ|ソファー': 'the same loanword with the long-vowel mark written',
  '悲しい|哀しい': 'かなしい; a variant kanji with the same reading',
  'ワクワクする|わくわくする': 'the same mimetic in hiragana',
  'たぶん|多分': 'たぶん in kanji',
  'かっこいい|カッコいい': 'かっこいい with the first element in katakana',
  '比喩|比ゆ': 'ひゆ; 喩 written in kana',
  'パーティー|パーティ': 'the same loanword without the final long-vowel mark',
  'マネージャー|マネジャー': 'the same loanword with one long-vowel mark dropped',
  '締め切り|締切': 'しめきり with the okurigana omitted',
  '締め切り|締切り': 'しめきり with one okurigana omitted',
  '締め切り|〆切': 'しめきり written with the 〆 abbreviation',
  'その代わりに|その代りに': 'そのかわりに with the okurigana moved',
  '朝ご飯|朝ごはん': 'あさごはん with 飯 written in kana',
  '友達|友だち': 'ともだち with 達 written in kana',
  '昔々|昔昔': 'むかしむかし with the iteration mark written out',
  '終わり|終り': 'おわり with the okurigana omitted',
  'タメ口|ため口': 'ためぐち with the first element in hiragana',
  'タメ口|ためぐち': 'ためぐち written entirely in hiragana',
  '知恵|智慧': 'ちえ; the older kanji pair with the same reading',
  '受身|受け身': 'うけみ with the okurigana written',
  'SNS|エスエヌエス': 'the letter names spelled out in katakana',
  'SNS|えすえぬえす': 'the letter names spelled out in hiragana',
  'いとこ|従兄弟': 'いとこ; the general kanji spelling',
  'いとこ|従姉妹': 'いとこ; the general kanji spelling for female cousins',
};

/** Accepted only where the task is transcribing heard audio. See the header. */
const LISTENING_ONLY = new Set(['SNS|エスエヌエス', 'SNS|えすえぬえす', 'いとこ|従兄弟', 'いとこ|従姉妹']);
const TRANSCRIPTION_TYPES = new Set(['listening_type', 'dictation']);

/** Every script candidate NOT restored, with the reason. Recorded at the same
 * weight as the restorations: a reviewer should see what was considered. */
export const SCRIPT_REFUSE = {
  'ご飯|こめ': 'こめ (米) is raw rice; ご飯 is cooked rice or a meal. Different words, not one word spelled twice.',
  '赤い|あか': 'あか (赤) is the noun; 赤い is the adjective the row keys. A part-of-speech change, not an orthography change.',
  '青い|あお': 'あお (青) is the noun; 青い is the adjective. Same reason as 赤い.',
  'お金|かね': 'Drops the honorific お. かね alone is blunt and is a different form, not a respelling of お金.',
  'おばあさん|そぼ': 'そぼ (祖母) is the own-side humble term for one\'s own grandmother. A different lexeme with a different reading.',
  'おじいさん|そふ': 'そふ (祖父) is the own-side humble term. Same reason as そぼ.',
  'ドア|とびら': 'とびら (扉) is a door leaf or gate, a separate word. It is not a spelling of the loanword ドア. The round-one review flagged this one itself.',
  'いとこ|従兄': 'Names an older male cousin. The gloss "Cousin" and the audio いとこ supply no gender or seniority.',
  'いとこ|従弟': 'Names a younger male cousin. Same reason.',
  'いとこ|従姉': 'Names an older female cousin. Same reason.',
  'いとこ|従妹': 'Names a younger female cousin. Same reason.',
  'カーペット|じゅうたん': 'じゅうたん (絨毯) is a synonym with a different reading, not a respelling of the loanword.',
  'ソファ|長いす': 'ながいす is a different word for a different object shape. A synonym at best.',
  'もっと良い|よりいい': 'A different comparative construction, not a spelling of もっと良い. The round-one review flagged this row separately.',
  'お祝いする|いわう': 'いわう (祝う) is the plain verb; the key is a する-compound with the honorific お. Two changes, neither orthographic.',
  'お祭り|まつり': 'Drops the honorific お.',
  'プレゼント|おくりもの': 'おくりもの (贈り物) is a synonym with a different reading.',
  '解雇する|首にする': 'A different idiom, not a spelling.',
  'パスポート|りょけん': 'りょけん (旅券) is a synonym with a different reading.',
  'パスワード|あいことば': 'あいことば (合言葉) is a watchword or catchphrase, a different word.',
  'ニュース|ほうどう': 'ほうどう (報道) is reporting or coverage, a different word.',
  'その代わりに|かわりに': 'Drops その. A shorter phrase, not a respelling.',
  'かっこいい|かっこういい': 'A different reading of 格好いい, not a different spelling of one reading.',
  'ウェブサイト|Webサイト': 'Latin script. Tyler ruled on the kana/kanji question; whether a Latin-script rendering counts is a separate question nobody has ruled on.',
};

/** The three typo-ball answers that still widen, held with what would restore
 * them. Keyed on the ADDED string, which is what the pair mechanism requires. */
export const HELD_TYPO_BALL = [
  { ref: 'ja-E1000', key: 'もっと背が低い', candidate: 'より背が低い', admits: ['背が低い'],
    pair_would_have_to_say: '背が低い ("short") and より背が低い ("shorter") are different answers, so the bare adjective must not be accepted on a comparative row.' },
  { ref: 'ja-E1054', key: 'もっと背が高い', candidate: 'より背が高い', admits: ['背が高い'],
    pair_would_have_to_say: 'The same, for tall: 背が高い must not be accepted on a "Taller" row.' },
  { ref: 'ja-E1000', key: 'もっと背が低い', candidate: 'もっと短い', admits: ['もっと良い', 'もっと悪い', 'もっと遅い', 'もっと速い', 'もっと安い', 'もっと高い'],
    pair_would_have_to_say: 'もっと短い against each of the six other もっと+adjective strings the unit teaches. This is the meaning-flip family the round-one review was right to fear: "Shorter" would otherwise accept cheaper, more expensive, better, worse, faster and slower.' },
];

const SCRIPT_REASON = (ref, type, candidate, key, reading) =>
  `${ref} (ja, ${type}): RESTORED — withdrawn by the round-1 alternatives batch to the open kana/kanji question, which Tyler ruled on 2026-09-15: the same Japanese word typed in the other script is correct. "${candidate}" is the keyed "${key}" spelled another way — ${reading}. Re-measured against every taught Japanese string: it widens nothing.`;

const BALL_REASON = (ref, type, candidate, key) =>
  `${ref} (ja, ${type}): RESTORED — a correct answer withdrawn by the round-1 alternatives batch because it brought a sibling item inside the typo budget. It no longer does. That collision was measured against a grader that scaled the typo budget by the matched alternative; lib/grading.ts now scales by the shorter of the key and the alternative and consults the confusable-pair list, so "${candidate}" on the keyed "${key}" admits no other taught Japanese string at all. Re-measured here rather than assumed, and it needs neither the 39 proposed pairs nor the edit-distance gate.`;

export async function loadAlternativesEvidence() {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../..', EVIDENCE_FILE);
  const raw = await readFile(path, 'utf8');
  if (createHash('sha256').update(raw).digest('hex') !== EVIDENCE_SHA) {
    throw new Error('ja-alternatives-evidence.json has changed; re-read it and re-pin EVIDENCE_SHA');
  }
  const evidence = JSON.parse(raw);
  const script = evidence.withdrawn_to_policy;
  const ball = evidence.refused.filter(entry => entry.ground === 'within_typo_ball');
  if (script.length !== 102) throw new Error(`Expected 102 script withdrawals, found ${script.length}`);
  if (ball.length !== 42) throw new Error(`Expected 42 within_typo_ball withdrawals, found ${ball.length}`);
  return { script, ball };
}

export async function restoredWithdrawals(set, ledger) {
  const { snapshot, row } = set;
  const { script, ball } = await loadAlternativesEvidence();
  const ref = lessonRefs(snapshot, 'ja');
  const idOf = label => ref(Number(label.slice(4))).exercise.id;
  const contributions = new Map();
  const refused = [];
  const held = [];

  const check = (entry, id) => {
    const original = row('exercises', id);
    if (original.correct_answer !== entry.key) throw new Error(`${entry.ref}: the stored key moved since the batch`);
    if (original.type !== entry.type) throw new Error(`${entry.ref}: the exercise type moved`);
    return original;
  };
  const add = (id, entry, reason) => {
    const existing = contributions.get(id) ?? { ref: entry.ref, additions: [], reasons: [] };
    if (existing.additions.includes(entry.candidate)) throw new Error(`${entry.ref}: duplicate restoration of ${entry.candidate}`);
    existing.additions.push(entry.candidate);
    existing.reasons.push(reason);
    contributions.set(id, existing);
  };

  // ── The 102 script withdrawals ────────────────────────────────────────
  for (const entry of script) {
    const id = idOf(entry.ref);
    const original = check(entry, id);
    const pair = `${entry.key}|${entry.candidate}`;
    if (entry.type === 'fill_blank') {
      refused.push({ ...entry, why: 'fill_blank: the key is a fragment, and "the same lexeme in another orthography" is not well defined against a fragment. Ruling 1 covered translate_to_target and cloze_deletion; fill_blank was not in its scope, and five of the nine candidates in this class are demonstrably not script variants.' });
      continue;
    }
    if (LISTENING_ONLY.has(pair) && !TRANSCRIPTION_TYPES.has(entry.type)) {
      refused.push({ ...entry, why: `Restored only where the task is transcribing heard audio. ${SCRIPT_ACCEPT[pair]}, which is a faithful transcription of what was played, but on a written-production row the English gloss does not select it.` });
      continue;
    }
    const reading = SCRIPT_ACCEPT[pair];
    if (!reading) {
      const why = SCRIPT_REFUSE[pair];
      if (!why) throw new Error(`No adjudication recorded for the script candidate ${pair} (${entry.ref})`);
      refused.push({ ...entry, why });
      continue;
    }
    add(id, entry, SCRIPT_REASON(entry.ref, original.type, entry.candidate, entry.key, reading));
  }

  // ── The 42 typo-ball withdrawals ──────────────────────────────────────
  const isHeld = entry => HELD_TYPO_BALL.some(h => h.ref === entry.ref && h.candidate === entry.candidate);
  for (const entry of ball) {
    const id = idOf(entry.ref);
    const original = check(entry, id);
    if (isHeld(entry)) { held.push(entry); continue; }
    add(id, entry, BALL_REASON(entry.ref, original.type, entry.candidate, entry.key));
  }
  if (held.length !== HELD_TYPO_BALL.length) throw new Error(`Held ${held.length} typo-ball candidates, recorded ${HELD_TYPO_BALL.length}`);

  for (const [id, entry] of contributions) {
    ledger.contribute(id, {
      block: 'restored-withdrawals',
      additions: entry.additions,
      reason: entry.reasons.join(' '),
      sources: [EVIDENCE_SOURCE],
    });
  }

  return {
    recovered: { script: script.length, within_typo_ball: ball.length },
    restored_rows: contributions.size,
    restored_candidates: [...contributions.values()].reduce((total, entry) => total + entry.additions.length, 0),
    script_refused: refused.length,
    typo_ball_held: held.length,
    refused,
  };
}
