/**
 * The two product rulings Tyler settled on 2026-09-15, compiled.
 *
 * Both act on the triage's `needs_human` candidates, which are pinned here the
 * same way its confirmed rows are: the file is copied into this directory and
 * hashed, so the build is reproducible from this worktree and a changed input
 * fails rather than silently authoring something else.
 *
 *   source  audit-triage/docs/audits/question-verification/round2-triage/candidate-decisions.json
 *   here    docs/audits/question-verification/round2/triage-candidate-decisions.json
 *   sha256  632265eb7fada40062b7686512e6dad69c7a860647b6cd2439a944ad3b7f2866
 *
 * ── RULING 1 — Japanese script: accept the reading ────────────────────────
 *
 * On a row whose cue is an English gloss, the same Japanese word typed in the
 * other script is correct. 66 candidates on 61 rows: 40 `translate_to_target`
 * and 25 `cloze_deletion` under the triage's `ja_script_policy` group, plus the
 * one candidate the triage filed separately but described as "the same
 * orthography decision" — `イス` for `椅子` on ja-E0462, which already carries
 * `いす` from the same group.
 *
 * The ruling settles a policy question, not a set of individual facts, so what
 * is authored is exactly the candidate list the triage produced. Every one is an
 * exact match once added — no fuzzy tolerance is involved — and the triage
 * verified that none brings another taught string inside the typo budget. The
 * runtime check re-measures that here against every taught string in Japanese.
 *
 * The cost Tyler accepted, recorded so it is not rediscovered as a surprise: a
 * learner can now complete the Japanese written-production rows in hiragana, so
 * the course no longer requires kanji production anywhere.
 *
 * ── RULING 2 — register: accept upward, refuse downward ───────────────────
 *
 * A more polite form than the key is correct on a cue that names no register; a
 * less polite one is not. 19 candidates on 11 rows, split 10 accepted and 9
 * refused. The refusals are enumerated rather than dropped, because "we
 * considered it and said no" and "nobody looked" are different states and only
 * one of them is finished.
 *
 * ONE CONFLICT INSIDE THE RULING, resolved in favour of the explicit example and
 * reported rather than silently smoothed. Tyler's principle is "a more polite
 * form than the key is correct", and in the Korean speech-level hierarchy
 * (한다체 plain < 해요체 polite < 합니다체 deferential) `해야 해요` IS more polite
 * than the keyed `해야 한다` — yet `해야 해요` appears in his REFUSE list, which is
 * verbatim the "politeness dropped" bullet the triage wrote. The named example
 * wins here because it is the more specific instruction. `바라요` for `바란다`
 * (ko-E1684) is the identical move on an identical key shape, so it is refused
 * too: treating the two differently would be arbitrary in a way neither reading
 * of the ruling supports. Both are flagged in the round-2 report — if the
 * principle is meant literally, these are two strings on two rows to add.
 *
 * ── THE REVERSAL THAT ISN'T ───────────────────────────────────────────────
 *
 * The ruling was relayed with an instruction to REMOVE `ごめん` for `すみません`,
 * `うん` for `はい` and `ううん` for `いいえ` from production. There is nothing to
 * remove: those three strings are in no row, and never were.
 *
 * What happened is that the claim outlived its own correction. An early draft of
 * the Japanese alternatives batch (source sha 747140d3…) did add all three; the
 * independent reviewer flagged exactly this register contradiction and marked
 * the field `revise`; the author removed them; the final draft (sha 0f0764d3…)
 * carries `["ごめんなさい","申し訳ありません","申し訳ございません"]`, `["ええ"]` and
 * `["いや"]`, and the reviewer cleared it `approve_as_correction`. That final
 * draft is what deployed. The prose in
 * `remediation/ja-alternatives-root-review/README.md` §2 was written against the
 * FIRST source sha and never updated, and the contradiction was carried forward
 * from the prose rather than from the field decisions.
 *
 * Verified twice: no patch in the round-1 draft adds any of the three, and a
 * read-only count against production returns 0 rows accepting any of them.
 *
 * The rows do still carry `ごめんなさい`, `ええ` and `いや`, which are the live
 * instances of the shape the ruling is about — softer than the key, on a bare A1
 * gloss. They are NOT removed here. They are different strings with different
 * register facts (`ごめんなさい` and `ええ` are themselves polite, merely less
 * formal), removing a shipped accepted answer is the one change that makes a
 * previously accepted learner answer start being rejected, and Tyler asked to
 * see that named rather than buried. They are named in the report instead.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANDIDATES_FILE = 'docs/audits/question-verification/round2/triage-candidate-decisions.json';
export const CANDIDATES_SHA = '632265eb7fada40062b7686512e6dad69c7a860647b6cd2439a944ad3b7f2866';
export const RULED_ON = '2026-09-15';

/** Ruling 2, candidate by candidate. `true` accepts, `false` refuses, and the
 * note is the register fact that decides it. Every needs-human candidate that
 * is not a script candidate appears here exactly once, and the build fails if
 * one is missing or unknown. */
export const REGISTER_RULING = {
  'ja-E0014|おはよう': [false, 'Casual for the keyed polite おはようございます. Politeness dropped, and A1 teaches the polite greeting specifically.'],
  'ja-E0038|おやすみ': [false, 'Casual for the keyed polite おやすみなさい. Politeness dropped.'],
  'ja-E0712|料理します': [true, 'Polite form of the keyed plain 料理する. Politeness raised on a cue that names no register.'],
  'ja-E1642|でしょう': [true, 'One politeness step above the keyed だろう. Politeness raised.'],
  'ko-E0066|아니': [false, 'Bare casual for the keyed 아니요. Politeness dropped.'],
  'ko-E0066|아닙니다': [true, 'The deferential 합니다체 form of the keyed 아니요. Politeness raised.'],
  'ko-E0856|공부했다': [false, 'The plain 한다체 form of the keyed 해요체 공부했어요. Politeness dropped.'],
  'ko-E0856|공부했습니다': [true, 'The deferential 합니다체 form of the keyed 공부했어요. Politeness raised.'],
  'ko-E0862|갔다': [false, 'The plain 한다체 form of the keyed 갔어요. Politeness dropped.'],
  'ko-E0862|갔습니다': [true, 'The deferential 합니다체 form of the keyed 갔어요. Politeness raised.'],
  'ko-E0889|공부했다': [false, 'The plain 한다체 form of the keyed 공부했어요. Politeness dropped.'],
  'ko-E0889|공부했습니다': [true, 'The deferential 합니다체 form of the keyed 공부했어요. Politeness raised.'],
  'ko-E0901|놀았다': [false, 'The plain 한다체 form of the keyed 놀았어요. Politeness dropped.'],
  'ko-E0901|놀았습니다': [true, 'The deferential 합니다체 form of the keyed 놀았어요. Politeness raised.'],
  'ko-E1670|해야 합니다': [true, 'The deferential 합니다체 form of the keyed plain 해야 한다. Politeness raised.'],
  'ko-E1670|해야 해요': [false, 'Named in the ruling\'s REFUSE list. Recorded tension: in the Korean speech-level hierarchy 해요체 sits ABOVE the keyed 한다체, so the ruling\'s own principle would accept this. The explicit example is followed; see the round-2 report.'],
  'ko-E1684|바라요': [false, 'The 해요체 form of the keyed plain 바란다 — the identical move to 해야 해요 on ko-E1670, and refused with it so the two rows are treated alike.'],
  'ko-E1684|바랍니다': [true, 'The deferential 합니다체 form of the keyed 바란다. Politeness raised.'],
  'ko-E1684|저는 바랍니다': [true, 'The deferential form with an overt subject. The subject half was already decided correct on the two Korean translate_to_target rows in the triage block; the register half is raised, so both halves now hold.'],
};

const SCRIPT_REASON = (ref, type, candidate, key) =>
  `${ref} (ja, ${type}): RULING 2026-09-15 — Japanese script, accept the reading. The cue is an English gloss, so nothing in the task selects an orthography; "${candidate}" is the same word as the keyed "${key}" written in the other script. Exact match once added, so no typo tolerance is involved, and verified against every taught Japanese string to bring nothing else inside the budget.`;

const REGISTER_REASON = (ref, language, type, candidate, key, note) =>
  `${ref} (${language}, ${type}): RULING 2026-09-15 — register, accept upward and refuse downward. "${candidate}" against the keyed "${key}": ${note}`;

export async function loadCandidates() {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../..', CANDIDATES_FILE);
  const raw = await readFile(path, 'utf8');
  if (createHash('sha256').update(raw).digest('hex') !== CANDIDATES_SHA) {
    throw new Error('triage-candidate-decisions.json has changed; re-read it and re-pin CANDIDATES_SHA');
  }
  const candidates = JSON.parse(raw);
  if (candidates.length !== 479) throw new Error(`Expected 479 triage candidates, found ${candidates.length}`);
  return candidates;
}

/** The script candidates: the whole `ja_script_policy` group, plus the one the
 * triage filed under `individual` while describing it as the same decision. */
const isScriptCandidate = entry =>
  entry.group === 'ja_script_policy' || (entry.group === 'individual' && entry.candidate === 'イス');

export async function productRulings(set, ledger) {
  const { row } = set;
  const candidates = (await loadCandidates()).filter(entry => entry.verdict === 'needs_human');
  if (candidates.length !== 85) throw new Error(`Expected 85 needs_human candidates, found ${candidates.length}`);

  /** Group by row so each row is contributed once per ruling, in file order. */
  const group = (entries, keyOf) => {
    const grouped = new Map();
    for (const entry of entries) {
      const key = keyOf(entry);
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    }
    return grouped;
  };

  const check = entry => {
    const original = row('exercises', entry.exercise_id);
    if (original.correct_answer !== entry.key) throw new Error(`${entry.ref}: the stored key moved since triage`);
    if (original.type !== entry.type) throw new Error(`${entry.ref}: the exercise type moved since triage`);
    if (!Array.isArray(original.accepted_answers) || original.accepted_answers.length) {
      throw new Error(`${entry.ref}: accepted_answers is no longer empty; re-triage before adding`);
    }
    return original;
  };

  // ── Ruling 1 ──────────────────────────────────────────────────────────
  const script = candidates.filter(isScriptCandidate);
  if (script.length !== 66) throw new Error(`Expected 66 script candidates, found ${script.length}`);
  const scriptRows = group(script, entry => entry.exercise_id);
  if (scriptRows.size !== 61) throw new Error(`Expected 61 script rows, found ${scriptRows.size}`);
  for (const [id, entries] of scriptRows) {
    for (const entry of entries) check(entry);
    const [first] = entries;
    ledger.contribute(id, {
      block: 'ruling-1-japanese-script',
      additions: entries.map(entry => entry.candidate),
      reason: SCRIPT_REASON(first.ref, first.type, entries.map(e => e.candidate).join('", "'), first.key),
    });
  }

  // ── Ruling 2 ──────────────────────────────────────────────────────────
  const register = candidates.filter(entry => !isScriptCandidate(entry));
  if (register.length !== 19) throw new Error(`Expected 19 register candidates, found ${register.length}`);
  const refused = [];
  const registerRows = group(register, entry => entry.exercise_id);
  if (registerRows.size !== 11) throw new Error(`Expected 11 register rows, found ${registerRows.size}`);
  for (const [id, entries] of registerRows) {
    const accepted = [];
    for (const entry of entries) {
      const decision = REGISTER_RULING[`${entry.ref}|${entry.candidate}`];
      if (!decision) throw new Error(`${entry.ref}: no ruling recorded for "${entry.candidate}"`);
      const [accept, note] = decision;
      check(entry);
      if (accept) accepted.push({ entry, note });
      else refused.push({ ref: entry.ref, language: entry.language, type: entry.type, key: entry.key, candidate: entry.candidate, note });
    }
    if (!accepted.length) continue;
    const [{ entry: first }] = accepted;
    ledger.contribute(id, {
      block: 'ruling-2-register',
      additions: accepted.map(({ entry }) => entry.candidate),
      reason: REGISTER_REASON(first.ref, first.language, first.type,
        accepted.map(({ entry }) => entry.candidate).join('", "'), first.key,
        accepted.map(({ note }) => note).join(' ')),
    });
  }

  const ruled = Object.keys(REGISTER_RULING).length;
  if (ruled !== register.length) throw new Error(`REGISTER_RULING has ${ruled} entries for ${register.length} candidates`);
  if (refused.length !== 9) throw new Error(`Expected 9 refused register candidates, found ${refused.length}`);

  return {
    script: { rows: scriptRows.size, additions: script.length },
    register: { rows: [...registerRows].filter(([, entries]) => entries.some(e => REGISTER_RULING[`${e.ref}|${e.candidate}`][0])).length, accepted: register.length - refused.length, refused },
  };
}

/**
 * RULING 3 — fr-C0024: a B1 reading checkpoint whose key is a single connector
 * also accepts a multi-word paraphrase of the same relation.
 *
 * The held candidate is `par l’intermédiaire d’`, and it is the last open French
 * claim. It was filed under an apostrophe/elision hypothesis — the phrase ends in
 * an elided `d’` and the gap frame supplies a literal space before `un` — and the
 * register notes that hypothesis is positively disproved. It is:
 * `normalizeAnswer` in `supabase/functions/checkpoint/checkpoint-core.ts` strips
 * every non-letter, non-digit, non-space character before comparing, so the
 * apostrophe is not in the comparison at all and the two typographies of it
 * collapse to one string. What was left was only the question Tyler has now
 * answered.
 *
 * One string is added, not a family. `par l’intermédiaire de` is deliberately
 * not accepted: `de un` is ungrammatical, the elision is obligatory, and the
 * checkpoint's own normalisation would keep the two apart.
 */
export const FR_C0024 = {
  id: '4f4bc9b6-c3e9-462d-bfd5-c83b198229ed',
  prompt: 'Complete the sentence: Nous nous sommes rencontrés ___ un ami commun.',
  key: 'par',
  before: ['par', 'grâce à', 'chez'],
  addition: 'par l’intermédiaire d’',
};

export function frenchCheckpointParaphrase(set) {
  const item = set.row('checkpoint_items', FR_C0024.id);
  if (item.prompt !== FR_C0024.prompt) throw new Error('fr-C0024: the prompt moved');
  if (item.correct_answer !== FR_C0024.key) throw new Error('fr-C0024: the key moved');
  if (JSON.stringify(item.accepted_answers) !== JSON.stringify(FR_C0024.before)) throw new Error('fr-C0024: the accepted answers moved');
  set.update('checkpoint_items', FR_C0024.id, {
    accepted_answers: [...FR_C0024.before, FR_C0024.addition],
  }, `fr-C0024: RULING ${RULED_ON} — a B1 reading checkpoint whose key is a single connector also accepts a multi-word paraphrase of the same relation. "par l’intermédiaire d’un ami commun" expresses the same mediated-introduction relation as the keyed "par", and the phrase is the one held candidate on this row. The elision hypothesis it was filed under does not arise: checkpoint normalizeAnswer strips punctuation before comparing.`,
  ['https://www.larousse.fr/dictionnaires/francais/interm%C3%A9diaire/43672']);
  return 1;
}

/**
 * RULING 2, the subtractive half: accepted answers that are DOWNWARD from their
 * key, removed.
 *
 * This is the only part of round two that makes a previously accepted learner
 * answer start being rejected, so every row is argued rather than counted, and
 * the ones left alone are argued too. Four candidates were put to this producer;
 * two are removed and two are deliberately kept.
 *
 * The line drawn, because "less polite" is not one relation:
 *
 *   REFUSE a candidate that is the key's own formula with its politeness
 *   marking dropped, or that sits in the casual register against a polite key.
 *   That is the move the ruling names — おはよう for おはようございます, 아니 for
 *   아니요, 공부했다 for 공부했어요 — and it is what the corpus already refuses.
 *
 *   KEEP a candidate that is a distinct formula and is itself correct polite
 *   language, even when it is less formal than the key. Rejecting those tells a
 *   learner that natural, polite, correct output is wrong, which is a worse
 *   failure than the one being fixed.
 *
 * A mechanical sweep supports the line rather than just asserting it: across
 * every non-speaking Japanese and Korean row, NO accepted answer is the stored
 * key with a politeness marker removed (ございます / ます / なさい / です /
 * ください for Japanese, 습니다 / ㅂ니다 / 어요 / 아요 / 요 / 세요 for Korean).
 * The corpus does not contain the paradigm case at all. ちょっと失礼 is the one
 * near-miss and it is a truncation of its ROW-MATE 失礼します, not of the key.
 *
 * Also confirmed, and worth recording because it was the other half of the
 * contradiction triage raised: the translate rows keyed おはようございます and
 * おやすみなさい carry NO accepted answers. The corpus refuses おはよう and
 * おやすみ by having no alternative rather than by an authored refusal. Ruling 2
 * now makes that refusal deliberate; nothing needs to change on those rows.
 */
export const REGISTER_REMOVALS = [
  {
    id: 'aabbccdd-6666-1001-0004-e00000000006', ref: 'ja-E0042', prompt: 'Translate to Japanese: Excuse me',
    key: 'すみません', before: ['失礼します', 'ちょっと失礼'], remove: 'ちょっと失礼', after: ['失礼します'],
    why_downward: 'ちょっと失礼 is 失礼します with the polite verb ending dropped — the same formula as its own row-mate, minus its politeness marking. That is exactly the move the ruling refuses, and it is downward from the key and from the alternative it is derived from. It is also an ellipsis rather than a complete formula, so an A1 learner who produces it has produced something they would be corrected on in any setting where すみません is required, on a row that teaches nothing about when that is appropriate.',
  },
  {
    id: 'aabbccdd-6666-1001-0006-e00000000006', ref: 'ja-E0066', prompt: 'Translate to Japanese: No',
    key: 'いいえ', before: ['いや'], remove: 'いや', after: [],
    why_downward: 'いや is the casual negative. It occupies the same register slot as ううん, which the ruling names in its REFUSE list, and it sits outside the polite register rather than low within it: against a polite key at A1 it reads as blunt. The asymmetry with ええ on the neighbouring "Yes" row is the whole argument — for "no" the corpus was accepting the CASUAL tier, for "yes" only the polite-informal one.',
  },
];

/** Put to this producer and deliberately NOT removed. Recorded with the same
 * weight as the removals: a reviewer should be able to see what was considered
 * and rejected, not just what was done. */
export const REGISTER_KEPT = [
  {
    id: 'aabbccdd-6666-1001-0003-e00000000006', ref: 'ja-E0030', key: 'すみません', kept: 'ごめんなさい',
    why_kept: 'Not a de-politened すみません. ごめんなさい carries its own polite ending なさい and is a distinct apology formula — the casual form of it is ごめん, which appears nowhere in the corpus. It differs from すみません on intimacy rather than on deference, and the English cue "Sorry" does not select between two polite apologies. This overturns a reading that it should go.',
  },
  {
    id: 'aabbccdd-6666-1001-0003-e00000000006', ref: 'ja-E0030', key: 'すみません', kept: '申し訳ありません',
    why_kept: 'More formal than the key. Upward, which the ruling accepts.',
  },
  {
    id: 'aabbccdd-6666-1001-0003-e00000000006', ref: 'ja-E0030', key: 'すみません', kept: '申し訳ございません',
    why_kept: 'The most formal of the three. Upward.',
  },
  {
    id: 'aabbccdd-6666-1001-0004-e00000000006', ref: 'ja-E0042', key: 'すみません', kept: '失礼します',
    why_kept: 'A complete polite formula at or above the key\'s formality, and the standard "excuse me" for entering or leaving. Not downward.',
  },
  {
    id: 'aabbccdd-6666-1001-0005-e00000000006', ref: 'ja-E0054', key: 'はい', kept: 'ええ',
    why_kept: 'Inside the polite register, not below it: ええ、そうです is unremarkable polite Japanese, and the casual affirmative うん is accepted nowhere in the corpus. It is less FORMAL than はい, not less polite, and removing it would reject natural polite output from a learner who answered correctly. This overturns a reading that it is downward.',
  },
];

export function registerRemovals(set) {
  for (const entry of REGISTER_REMOVALS) {
    const original = set.row('exercises', entry.id);
    if (original.prompt !== entry.prompt) throw new Error(`${entry.ref}: the prompt moved`);
    if (original.correct_answer !== entry.key) throw new Error(`${entry.ref}: the key moved`);
    if (JSON.stringify(original.accepted_answers) !== JSON.stringify(entry.before)) {
      throw new Error(`${entry.ref}: accepted_answers is not what was adjudicated; re-read before removing`);
    }
    if (!entry.before.includes(entry.remove)) throw new Error(`${entry.ref}: nothing to remove`);
    if (JSON.stringify(entry.before.filter(value => value !== entry.remove)) !== JSON.stringify(entry.after)) {
      throw new Error(`${entry.ref}: the recorded result is not the list minus the removal`);
    }
    set.update('exercises', entry.id, { accepted_answers: entry.after },
      `${entry.ref} (ja, ${original.type}): RULING ${RULED_ON} — register, refuse downward. REMOVAL: "${entry.remove}" is withdrawn as an accepted answer for the keyed "${entry.key}". ${entry.why_downward} This makes a previously accepted learner answer start being rejected, which is why it is argued on the row rather than counted.`);
  }
  for (const entry of REGISTER_KEPT) {
    const original = set.row('exercises', entry.id);
    if (!(original.accepted_answers ?? []).includes(entry.kept)) throw new Error(`${entry.ref}: ${entry.kept} is not on the row`);
  }
  return { removed: REGISTER_REMOVALS.length, kept: REGISTER_KEPT.length };
}
