# Needs a human — 1 decision left, 12 rows

> **Decision 1 is RULED (2026-09-16): accept the reading.** See
> [`../round3/README.md`](../round3/README.md). All 66 readings were already
> live — round two carried the whole class and the 2026-09-16 deploy wrote them
> — and the ruling has since been gated by `widening-check` against the
> post-round-two corpus: 294,732 grades, nothing newly accepted. Everything
> below about Decision 1 is kept as the reasoning that was weighed, not as open
> work. **Decision 2 is still open.**

# Original: 2 decisions, 67 rows

Two decisions are left, both product/pedagogy calls rather than facts. They
touch 71 of the 400 rows and 85 of the 479 candidate claims; on 67 of those rows
a decision is the only thing outstanding, and on the other four a decision
settles the remaining candidate on a row that also carries a confirmed defect
(`ja-E0892`, `ja-E0970`, `ko-E0856`, `ko-E0862`). Nothing else in the block needs
a ruling: the rest is decided in
[confirmed.json](confirmed.json) and [not-a-defect.md](not-a-defect.md).

The point of this triage is that these two decisions are much smaller than the
register said. `JA-KANA-KANJI-SCRIPT` was carrying 341 of the 371 Japanese rows.
283 of those are `listening_type`/`dictation` rows where no orthography policy
can help, because the learner is never shown anything to take a script from —
those are now confirmed defects. What is left below is only the rows where the
learner *can* see a written cue and the question is therefore real.

---

## Decision 1 — Japanese orthography on written-production rows

**61 rows, 65 candidates.** 40 `translate_to_target`, 25 `cloze_deletion`. All
of them: the key is written in kanji (or, on four rows, in kana) and the learner
typed the same word in the other script — `みぎ` for `右`, `しゃかい` for `社会`,
`いす`/`イス` for `椅子`.

**What is being decided.** On a row whose cue is an English gloss —
`Translate to Japanese: Right`, `Fill in the missing word: _____ means Society` —
does a correct Japanese word written in a different script count as a correct
answer, or is the taught spelling part of what the item tests?

**What each option costs.**

*Accept the reading (recommended).* 61 rows stop rejecting correct Japanese. The
implementation is 65 `accepted_answers` additions, all of which are exact
matches once added, so no fuzzy tolerance is involved and — verified — none of
them brings another taught string in the corpus inside the typo budget. The cost
is that the course stops asking anyone to produce kanji anywhere: a learner can
finish the Japanese track in hiragana. That is a real pedagogical loss and it is
the reason this is not simply a defect.

*Refuse the reading.* 61 rows close as correct and the kanji requirement stands.
The cost is that the requirement is nowhere stated and the curriculum does not
itself follow one: `明日`, `社会` and `椅子` are keyed in kanji while `まっすぐ`,
`おいしい`, `すごい`, `たぶん`, `さらに` and `めったに` are keyed in kana, and
`ご飯`, `お風呂` and `もっと大きい` are mixed. A learner cannot infer a rule the
corpus does not hold to, so refusing means telling some learners their correct
answer is wrong with no way for them to have known.

*Middle option.* Accept the reading on `cloze_deletion` (25 rows) and refuse it
on `translate_to_target` (40) — or the reverse. Nothing in the data recommends
this; the two prompts differ only in wording.

**Note for whoever decides.** One row in this class has already been decided the
other way, by accident: `ja-E2267` (`listening_type`, key `受身`) had `うけみ`
added by the deployed content patch. Under this triage that row is part of the
confirmed transcription class, so the precedent is no longer isolated — but the
written-production question is still open and should be settled deliberately,
not inherited.

Rows: `ja-E0090` `ja-E0112` `ja-E0126` `ja-E0134` `ja-E0142` `ja-E0154`
`ja-E0158` `ja-E0170` `ja-E0180` `ja-E0182` `ja-E0196` `ja-E0202` `ja-E0206`
`ja-E0208` `ja-E0228` `ja-E0250` `ja-E0264` `ja-E0272` `ja-E0300` `ja-E0322`
`ja-E0334` `ja-E0344` `ja-E0392` `ja-E0438` `ja-E0460` `ja-E0462` `ja-E0482`
`ja-E0492` `ja-E0504` `ja-E0522` `ja-E0544` `ja-E0546` `ja-E0558` `ja-E0564`
`ja-E0565` `ja-E0576` `ja-E0586` `ja-E0598` `ja-E0712` `ja-E0850` `ja-E0889`
`ja-E0892` `ja-E0916` `ja-E0922` `ja-E0952` `ja-E0970` `ja-E0985` `ja-E0988`
`ja-E1155` `ja-E1169` `ja-E1183` `ja-E1194` `ja-E1208` `ja-E1463` `ja-E1673`
`ja-E1726` `ja-E1816` `ja-E1838` `ja-E1880` `ja-E1886` `ja-E2034`

---

## Decision 2 — register variants on a cue that names no register

**12 rows, 20 candidates.** Two of them — `ja-E0462` and `ja-E0712` — also sit
under Decision 1, because they bundle a script question with a register one, so
the two decisions touch 71 distinct rows rather than 73.

**What is being decided.** When the cue is a bare English gloss —
`Translate to Japanese: Good morning`, `Translate to Korean: No` — and the key
is at one politeness level, does the same word at another politeness level
count? Two sub-cases, and they should probably not be answered the same way:

- **Politeness raised.** `공부했습니다` for `공부했어요`, `바랍니다` for `바란다`,
  `아닙니다` for `아니요`, `でしょう` for `だろう`, `料理します` for `料理する`. Both
  forms are 존댓말 / polite; the learner has answered correctly at a different
  level. Refusing this is hard to justify on a cue that names no register.
- **Politeness dropped.** `おはよう` for `おはようございます`, `おやすみ` for
  `おやすみなさい`, `아니` for `아니요`, `해야 해요` for `해야 한다`. Here the learner
  has changed the register. The A1 curriculum teaches the polite greeting
  specifically.

**What each option costs.** Accepting both directions makes the course
register-blind in two languages where register is a graded social fact, and
undoes teaching that A1 explicitly does. Refusing both direction leaves correct
polite answers marked wrong. Splitting them — accept upward, refuse downward —
is the option this triage would recommend, and it is implementable per row.

**Consistency problem the decision must also settle.** The Japanese alternatives
batch already refuses `おはよう` for `おはようございます` under `JA-POLITE-AFFIX` while
accepting `ごめん` for `すみません`, `うん` for `はい` and `ううん` for `いいえ` under
`lexical` — the same casual-for-polite move on the same kind of bare A1 gloss.
One of those two positions has to give, and whichever way this decision goes,
those four rows should be made to match it. (Recorded independently in
`remediation/ja-alternatives-root-review/README.md` §2.)

Rows: `ja-E0014` `ja-E0038` `ja-E0462` `ja-E0712` `ja-E1642` `ko-E0066`
`ko-E0856` `ko-E0862` `ko-E0889` `ko-E0901` `ko-E1670` `ko-E1684`

On `ko-E0856`, `ko-E0862`, `ko-E0889`, `ko-E0901` and `ko-E1684` only the
register half is open — the overt-subject half of each row is decided (confirmed
on the two `translate_to_target` rows, refused on the two "missing word" rows).
