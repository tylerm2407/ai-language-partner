# Japanese accepted-alternatives batch — independent review

Source: `scripts/question-audit/japanese-accepted-alternatives.mjs`
SHA-256: `747140d378eb60965259921119be85be0270aaa80e21643e86a96f01ea43537e` (verified)
Snapshot: `8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f`
Reviewer: independent reviewer (Claude Opus 5, session 2026-09-14), did not author this batch
Reviewed: 2026-09-14
Record: `record-japanese-alternatives-review.mjs` → `reviewed-source-747140d378eb.json`, `field-decisions.jsonl`

## Verdict

**Do not integrate.** The Japanese judgements are largely sound and the batch's script policy is
the right call, but the patch fails the readmission guard and the failure is the largest and the
worst-flavoured of any batch reviewed so far.

| | |
|---|---:|
| Rows | 460 |
| Additions | 844 |
| `approve_as_correction` | 413 |
| `revise` | 47 |
| Additions returning exactly `Correct!` after the patch | 844 of 844 |
| Additions still refused after the patch | 0 |
| Additions already typo-tolerated before the patch | 8 (matches the author's disclosure exactly) |
| Readmissions in the declared guard's scope | 8, on 2 rows |
| Readmissions of strings this batch itself refused | 2 |
| Readmissions across the batch's own additions | 68 |
| Readmissions that flip meaning | 29 of 78 |

Re-verified independently against the frozen snapshot: every declared type, band, lesson title,
stored key and frozen alternative list matches; no patched row carries `options` or `distractors`;
nothing already reachable is added; the producer appends only and throws on contention. The
author's 7-test suite is green and its output matches the handoff verbatim. Every before-value in
this review was re-derived after the 2026-09-14 grader changes; none was taken from the evidence.

## 1. Readmissions — the blocking finding

`scripts/question-audit/readmission.test.mjs` reads `draft-patches.json`, which this review does
not write, so the guard was replayed in scratch through the same measurement it uses, applied to
the current draft plus this batch's 460 patches. The replay reproduces the guard's green state on
the draft alone — 65 found, 65 declared, none undeclared — and **finds 8 new readmissions on 2
rows once the batch is applied.** Japanese has no allowlist entries today; these would be the
first. None of the batch's 460 rows is touched by the current draft, so the two do not interact.

The mechanism is the one the guard documents. `gradeAnswer` measures typo distance against
whichever accepted answer is NEAREST by similarity, so every addition carries a ball of radius
`min(2, floor(min(len(addition), len(key)) * 0.3))` and admits anything already inside it.

**ja-E1000** — `Translate to Japanese: Shorter`, key `もっと背が低い`, gains `より背が低い`,
`もっと短い`, `より短い`. `もっと短い` is five characters, so its budget is 1, and every other
comparative the unit teaches is `もっと` plus one kanji plus `い` — exactly one substitution away.
Seven sibling keys are readmitted:

| Readmitted | Means | Owned by | Severity |
|---|---|---|---|
| `もっと高い` | taller / more expensive | ja-E1061 | **meaning flip** |
| `もっと悪い` | worse | ja-E1037 | card blur |
| `もっと良い` | better | ja-E1025 | card blur |
| `もっと速い` | faster | ja-E1045 | card blur |
| `もっと遅い` | slower | ja-E1057 | card blur |
| `もっと安い` | cheaper | ja-E1049 | card blur |
| `背が低い` | short (positive) | ja-E1044 | card blur |

**ja-E1054** — `Translate to Japanese: Taller`, key `もっと背が高い`, gains `より背が高い`, which
sits two edits from `背が高い` (ja-E1032) against a budget of 2, collapsing the comparative the
unit exists to teach.

### The pair list is already correct and is inert here

`lib/confusable-pairs.ts` already enumerates the whole `もっと` + adjective set, including
`['もっと背が低い', 'もっと背が高い']` and `['もっと安い', 'もっと高い']`. None of it fires,
because `isConfusablePair` is consulted against `expectedForTolerance`, which is the matched
alternative — here `もっと短い` or `より背が低い`, neither of which appears in any pair. **A pair
written against the row's key is inert.** Any remedy must be keyed on the ADDED string.

### Two strings this batch examined and refused, readmitted anyway

The declared guard cannot see these, because it does not read the evidence file.

- **ja-E0983** `Translate to English: 休み`, key `Vacation`. The batch refuses `Holiday` under
  `course_distinction`, then adds `Holidays`, which readmits `Holiday` at one edit.
- **ja-E1006** `Translate to Japanese: Better`, key `もっと良い`. The batch withdraws `よりいい`
  to the open `JA-KANA-KANJI-SCRIPT` question, then adds `より良い`, which readmits `よりいい`.
  The script policy's central claim — that no addition in this batch turns on how a word is
  written — is false in effect on this row.

### The larger surface the guard cannot reach: 68 more

The guard's scope is own distractors plus unit sibling *keys*. This batch's additions form new
families of strings one edit apart that are not keys anywhere, so nothing checks them. Measuring
the wider scope (unit keys, plus every addition this batch makes elsewhere in the same unit)
finds **78 readmissions on 23 rows, 29 of which flip meaning.** The worst:

| Row | Prompt | Readmits | Which means |
|---|---|---|---|
| ja-E1042 | More expensive | `より安い` | cheaper — the cheap/expensive case that prompted the guard, rebuilt in Japanese |
| ja-E1030 | Cheaper | `より高い` | more expensive |
| ja-E1036 | The best | `最も悪い` | the worst |
| ja-E1048 | The worst | `最も良い` | the best |
| ja-E1000 | Shorter | `より背が高い` | taller |
| ja-E1054 | Taller | `より背が低い` | shorter |
| ja-E1012 | Faster | `より遅い`, `もっと遅く` | slower |
| ja-E1024 | Slower | `より速い`, `もっと速く` | faster |
| ja-E1265 | To hire | `Fire` | to fire |
| ja-E1279 | To fire | `Hire` | to hire |
| ja-E0357, ja-E0401 | Grandmother | `Grandpa`, `Granddad`, `Old man`, `Elderly man` | a grandfather |
| ja-E0369, ja-E0413 | Grandfather | `Grandma`, `Old woman`, `Elderly woman` | a grandmother |
| ja-E0562 | Aunt (おばさん) | `おじちゃん` | uncle |
| ja-E0628 | Uncle (おじさん) | `おばちゃん` | aunt |

Three more are wrong without being opposites: `ja-E0862` / `ja-E0880` / `ja-E0904` gain
`私は行きました` / `私は働きました` / `私は書きました`, which are mutually one edit apart, so
each of the three past-tense rows accepts the other two verbs. That is the author's own
"hardest call 3" turning out worse than noise.

This count is a lower bound. It only tests strings that occur somewhere in the course or in this
batch; `より悪い` is accepted on ja-E1006 and is not counted because no row stores it.

## 2. The script policy — endorsed, but not enforced by the patch

The policy is right. Withdrawing every same-lexeme-different-orthography candidate to
`JA-KANA-KANJI-SCRIPT` rather than granting it on the 98 rows this batch happens to touch is the
correct call, for the reason given: those rows are not special, and granting them would have the
course accepting `犬 → イヌ` while `犬 → いぬ` stays refused on 350 held rows. Deciding a
course-wide grading policy through the rows a lexical sweep happened to surface is not a decision,
it is an accident. The alternative the author names — reading-aware normalisation in
`lib/grading.ts` — is the right shape for a yes answer, and 357 `accepted_answers` edits is not.

Two places where the patch does not keep the policy:

- **ja-E1006**, above: the withdrawn `よりいい` becomes acceptable through the typo ball anyway.
  The policy is stated and then defeated by the grader on the same row.
- **ja-E0426 / ja-E0470** (`Door`): `扉` and `とびら` are both added. The policy is written about
  the *key's* script, so this passes the letter of it, but granting both spellings of one added
  lexeme settles the same question for that word while 350 rows wait.

**Politeness is decided the other way, and is not applied consistently.** The batch refuses 55
candidates for swapping register, and holds `おはようございます → おはよう` under
`JA-POLITE-AFFIX` on the ground that the gloss selects the polite form. It then accepts `ごめん`
for `すみません`, `うん` for `はい` and `ううん` for `いいえ` — the same casual-for-polite move, on
bare A1 glosses, under `lexical`. One of those two positions has to give.

> **Correction, 2026-09-15 — the paragraph above describes a SUPERSEDED draft.**
> It was written against source sha `747140d378eb`, in which `ごめん`, `うん` and
> `ううん` were indeed added. That is exactly what this review objected to, and the
> objection worked: the author removed all three, and the final reviewed source
> `0f0764d3b340` carries `ごめんなさい` / `申し訳ありません` / `申し訳ございません`,
> `ええ` and `いや` instead. That is what deployed. The prose was never updated
> after the revision landed, and the withdrawn claim has since been inherited
> twice by later work.
>
> **`field-decisions.jsonl` and `followup-field-decisions.jsonl` are authoritative
> for what this batch actually ships; this README's prose is not.** Verified
> against production on 2026-09-15: no row accepts `ごめん`, `うん` or `ううん`, and
> no patch in the round-1 draft adds them. The register question the paragraph
> raises was real and was settled by ruling on 2026-09-15 — see
> `docs/audits/question-verification/round2/findings.json`.

## 3. The 371 uncertain claims — triage verified, the inconsistency is real

Every number reproduces exactly against `lexical-reconciliation-2026-09-14.jsonl`:

| Claim | Verified |
|---|---|
| 371 uncertain Japanese claims | 371 |
| Rows with no live candidate but a form variant | 350 (21 carry a `lexical` candidate) |
| `dictation` / `listening_type` rows | 283 (231 listening_type + 52 dictation); 88 written production |
| Live candidates | 418 |
| kanji key → kana answer | 346 |
| kanji → kanji (okurigana or variant) | 36 |
| kana key → kanji answer | 25 |
| kana → other kana | 9; other 2 |
| Distinct key → variant pairs | 304 |
| Union with this batch's withdrawals | 357 |
| Rows this batch's own rules would settle | 21 (9 of them `JA-POLITE-AFFIX`) |

"One question, not 371" is a fair characterisation for 350 of them. The transcription argument is
the strongest part of the case: on a `listening_type` row the prompt IS the Japanese word, and a
learner cannot know which script the author used, so rejecting the kana measures IME conversion.

**ja-E2267 is exactly as described.** `listening_type`, key `受身`, `accepted_answers` `[]` in the
snapshot; the draft adds `うけみ`, carrying `exact_value_independently_approved` in
`current-review-status.json` with evidence in `ja-ko-root-review/field-decisions.jsonl`. It is the
only one of the 552 input rows the draft touches, and this batch empties it, so there is no
collision. One row granted by reading while 350 are refused is a genuine inconsistency, and it
should be resolved as a policy rather than left standing as a precedent of one.

## 4. Cross-row work — verified, with one claim overstated

- **`すみません` → "Thank you": verified.** It is an option on ja-E0024 (`listening_choice`, key
  `Sorry`) and on ja-E0041 (`multiple_choice`, key `Sorry`), both on the identical stimulus, and
  the batch refuses it on ja-E0031 and ja-E0063 under `course_distinction`. Correct.
- **The pairs: three of seven are refused in both directions.** `目標`/`目的`, `倫理`/`道徳` and
  `それから`/`次に` each carry decisions both ways. `しかし`/`それでも`, `もし`/`仮に` and
  `もっと高い`/`もっと背が高い` carry one direction only, because the reverse was never proposed —
  defensible, but not what "refused in both directions" says. **`休み`/`祝日` carries no decision
  at all**; the nearest real refusal is `Vacation` refusing `Holiday` on ja-E0983, which is the
  English side. That claim in the handoff should be corrected.
- **17 sibling groups levelled, 13 rows gaining an addition: verified at 13 rows.** The addition
  count is 15, not 14.
- **The 8 already-passing additions: verified exactly**, same rows, same feedback strings, same
  `Correct! (Minor typo: ...)` shape. The diagnosis is right: `もっと速い` / `もっと速く` is
  adjective versus adverb and `もっと高価` is a different word, so the learner is shown the key as
  a correction of their own correct answer.

## 5. Ordinary review — 23 non-readmission objections on 24 rows

Full per-row rationale is in `field-decisions.jsonl`. Grouped:

**Refuse on meaning.** `看護婦` (ja-E0649, ja-E0682) is the superseded female-only word for a
nurse. `合言葉` for `パスワード` (ja-E1502) is a watchword, not a computer password.
`"Economics"` for `経済` (ja-E1209) is `経済学`, which the batch itself treats as distinct when it
adds `倫理学` for `倫理`. `"Cargo"` for `荷物` (ja-E1349) is `貨物`. `反証` for "Counterargument"
(ja-E1922) is counter-evidence, and the batch glosses it "To refute" elsewhere. `習慣` for
"Tradition" (ja-E1069, ja-E1102) is a habit. `"Provisionally"` and `"Temporarily"` for `仮に`
(ja-E1713) are the wrong sense for a Hypothetical Situations lesson.

**Refuse as self-contradicting.** `ダンスをする` (ja-E1096, ja-E1129) is a verb phrase added to a
noun gloss on a row that refuses `踊る` as a drilled-form error for being a verb. `目当て`
(ja-E0940) is further from "Goal" than `目的`, which the same row refuses.

**Harmonise.** Seven rows (ja-E0887, ja-E0911, ja-E0923, ja-E0935, ja-E0947, ja-E0959, ja-E0971)
accept She/You/They but not He/We, while ja-E0851 and ja-E0863 accept all five under the same
`person` ground. Nothing in the prompts distinguishes them.

**Noted, not blocked.** The `私は` additions land on seven `cloze_deletion` rows whose prompt is
"Fill in the missing word"; a subject plus particle plus predicate is not one word. This is a
judgement the policy owner may want, so it is recorded rather than marked `revise`.

**The 66 `drilled_form` refusals are correct.** The A2 units are named for the form and several
rows test the ending directly (`食べ_____ (I ate)` keyed `ました`, refusing `た`). The
`not_an_answer`, `register` and `course_distinction` refusals are likewise well grounded.

## 6. Evidence bookkeeping

None of these changes a patched value; all of them make the record wrong.

1. **ja-E1732 is recorded as both `accepted` and `rows_emptied`.** It is a `dictation` row, which
   the batch's transcription policy puts out of scope; the producer correctly omits it. The
   `accepted` list should not contain it. This is the single row behind the `93` rows with no
   realised acceptance versus the declared `92`.
2. **The reconciliation line is wrong in both terms.** "accept (830) + harmonised additions (14) =
   844" should be 829 realised acceptances plus 15 harmonised additions. The evidence's own
   `additions_from_harmonisation_only: 15` contradicts it.
3. **The producer header mixes two counting bases.** It states an input of 1,163 alternatives and
   then "229 refused and 94 withdrawn", which are distinct-decision-unit counts. Against 1,163 the
   figures are 235 and 98, as the handoff table has them.
4. The `休み`/`祝日` claim in the handoff, above.

## What would make this integrable

1. Add confusable pairs keyed on the ADDED strings, not the keys: `もっと短い` against each of
   `もっと悪い` / `もっと遅い` / `もっと安い` / `もっと速い` / `もっと高い` / `もっと良い`; the
   whole `より` + adjective family against itself and against the `もっと` family; `より背が低い`
   against `背が低い` and `より背が高い` against `背が高い`; `Holidays` against `Holiday`;
   `Hire` against `Fire`; the four grandparent glosses against each other; `おじちゃん` against
   `おばちゃん`; `最も良い` against `最も悪い`; the three `私は` past-tense forms against each other.
2. Or drop the additions that open the balls — `もっと短い` on ja-E1000 is the single most
   expensive one — and take the narrower row.
3. `よりいい` on ja-E1006 should not be settled by a pair in either direction; it belongs to the
   held script question, so the remedy there is to drop `より良い` until the policy lands, or to
   accept that this row answers it.
4. Fix the four bookkeeping items, then re-run `readmission.test.mjs` with the batch applied and
   confirm it is green with no new allowlist entries.

## Limits

- One reviewer, one pass. The linguistic calls are this reviewer's reading of each row against its
  prompt, key, lesson, unit and siblings in the frozen snapshot; no per-candidate dictionary
  lookup was performed and no source is cited for an individual call.
- The 78-readmission figure is a lower bound, for the reason given in section 1.
- 413 rows are marked `approve_as_correction`. That means no objection was found, not that the
  batch is error-free.

---

# Round 2 — revised batch, sha `4b597e1fb4b4` (delta review)

Reviewed 2026-09-14. Record: `record-japanese-alternatives-followup.mjs` →
`reviewed-source-4b597e1fb4b4.json`, `followup-field-decisions.jsonl`.

SHA verified. 430 rows, 766 additions, re-counted from the source. The author's 8 tests pass and
the output matches the handoff verbatim.

## Verdict: two rows short of integrable

**428 of 430 rows are clear.** Every objection from round 1 is resolved, and 27 of the 29 meaning
flips are gone. **ja-E0369 and ja-E0413 still readmit 4 strings, 2 of them the gender flip.**
Withdraw `Granddad` from those two rows — their only addition, so both become unpatched — and the
widest scope I can measure returns zero at 428 rows and 764 additions. I verified that directly.

## The two rows

Both are `Translate to English: おじいさん`, key `Grandfather`, gaining `Granddad`.

| Readmits | Means | Batch's own disposition | Severity |
|---|---|---|---|
| `Grandma` | a grandmother | refused on ja-E0357, `minimal_pair` | **meaning flip** |
| `Grandpa` | a grandfather | refused on ja-E0369, `minimal_pair` | card blur |

`Granddad` is two edits from each, against a budget of 2: the basis is
`min(len("Granddad") = 8, len("Grandfather") = 11) = 8`, and `floor(8 * 0.3) = 2`.

**Why the minimal-pair rule misses it.** The rule is stated over *minimal pairs* of a sibling key
or addition. `Granddad`/`Grandma` is not a minimal pair — different lengths, two edits — so the
rule does not reach it, while the typo ball, which measures edit distance and not minimal pairs,
does. The rule is right in intent and wrong in metric. Restate it over the ball (*within
`min(2, floor(min(len(addition), len(key)) * 0.3))` of a sibling key, sibling addition, or any
string this batch withdraws in the unit*) and these two rows fall out by construction, as do
`Old man`/`Old woman`, which the batch already withdrew at two edits rather than one.

The author knew about this collision: `['Granddad', 'Grandma']` is in the 39-pair block. It is the
rule's wording, not the analysis, that left the addition live.

**Why the batch's eighth test cannot see it.** Its pool is the row's distractors, the unit's stored
keys, and the unit's additions. `Grandma` and `Grandpa` are withdrawn, so they are none of those.
A refusal recorded in the evidence cannot be enforced by `accepted_answers`, which is why my scope
adds every string the batch declares it refuses anywhere in the unit. That dimension found
ja-E0983 and ja-E1006 in round 1 and finds these two now. Adding it to the eighth test would close
the structural gap; the test is otherwise a real improvement and should stay.

## 11 pre-existing collisions this batch does not cause

Accepted before the patch as well, so not regressions, but they bear on the pairs decision.
Measured against the frozen curriculum with no patch at all, **21 rows already accept a stored
sibling key**, including two antonym pairs that no addition created:

- ja-E1265 `To hire` accepts `To fire`, and ja-E1279 `To fire` accepts `To hire`.
- ja-E1032 `背が高い` accepts `背が低い`, and ja-E1044 `背が低い` accepts `背が高い`.

Also pre-existing: ja-E1670 `すべき` accepts `べき`, which this batch refuses as a bound fragment;
ja-E1698 `たぶん` accepts `ぶん`; ja-E1796 `すごい` accepts `ごい`; ja-E1782 `かっこいい` accepts
`かっこういい`; and ja-E1024 and ja-E1042 already accept `もっと短い`, so withdrawing it from
ja-E1000 bought those two rows nothing.

## The minimal-pair rule, and pairs versus withdrawal

**The rule is sound in intent, wrong in metric, and right only as an interim.** It withdraws 40
correct answers to protect neighbours, and the batch says so honestly. My recommendation is to
ship the pairs and restore the 40, for three reasons that are measurements rather than taste:

1. **The pair mechanism already exists and already carries this exact family.** The frozen
   curriculum has only 21 key-to-key collisions, and the `もっと` + adjective set is not among them
   precisely because `lib/confusable-pairs.ts` already declares it. Extending the list to the added
   strings continues a mechanism that is already load-bearing, rather than introducing one.
2. **Withdrawal cannot reach what is already broken.** None of the 21 pre-existing collisions
   involves an addition, so no withdrawal touches them. The `To hire`/`To fire` and
   `背が高い`/`背が低い` antonym pairs need pairs written regardless of this batch.
3. **Withdrawal costs the learner the thing the batch exists to fix.** A learner typing `より速い`
   for "Faster" is correct and is told they are wrong, 40 times over.

A pair is global to Japanese and a withdrawal is local to a row. For a closed contrastive set that
recurs across units, global is the right scope.

**The author was right not to write `lib/confusable-pairs.ts`.** It has a live owner this session,
and two writers in one file is what the project forbids. Hand the block over as its own change.

**Three pairs are missing from the block of 39**, each verified live by measurement:

```js
['Granddad', 'Grandpa'],   // the two rows above, once Granddad stays
['To fire', 'To hire'],    // pre-existing antonym collision, ja-E1265 / ja-E1279
['背が高い', '背が低い'],      // pre-existing antonym collision, ja-E1032 / ja-E1044
```

The block has `['Fire', 'Hire']` and `['より背が低い', '背が低い']` but not the bare key pairs, so
the pre-existing collisions survive the block as written.

## Register line: endorsed as drawn

Refusing the plain or casual counterpart of a polite key, and not covering formal-versus-colloquial
lexical choice, is the right place to draw it. `解雇する` is formal and `クビにする` is colloquial,
but the gloss "To fire" is itself colloquial English and selects no register, so keeping it is
correct. The kinship `ちゃん` forms are an honorific-suffix swap and belong on the refused side,
while `祖母` for `おばあさん` stays accepted because own-side versus other-side is a reference frame
rather than a politeness level. That distinction holds.

## Other delta items, all verified

- **Overt pronoun withdrawn entirely, 18 refusals.** Withdrawing the family rather than the three
  colliding rows is the better call, for the reason given: partial withdrawal leaves siblings
  disagreeing.
- **Person harmonised.** All 9 rows now carry He/She/You/We/They, 45 additions.
- **17 meaning objections, all accepted.** Verified absent from the additions.
- **Bookkeeping, all four fixed and now self-asserting.** Declared acceptances and realised
  additions are the same 766-element set, zero drift in either direction. 742 + 321 + 100 = 1,163
  on one base; refusal grounds sum to 321; 92 + 30 = 122 rows emptied and 552 − 122 = 430.
  ja-E1732 appears once, as `transcription_out_of_scope`. The 休み/祝日 claim is withdrawn and the
  corrected six-pairs statement is accurate.

## Two residual notes, neither blocking

1. **`首にする` and `クビにする` are both accepted** on ja-E1253 and ja-E1292. That is one lexeme in
   two scripts, which is the pattern `とびら` was withdrawn for. `クビ` is a genuine orthographic
   convention for this idiom, so I would not block on it, but by the batch's own script policy it
   should be one entry or a withdrawal.
2. **The handoff names `とびら` as one of the three self-contradictions**; the evidence's three are
   `Holidays`, `すべきだ` and `しかしながら`, with `とびら` correctly moved to `script_variant`.
   The evidence is right and the prose is stale.

---

# Round 3 — final, sha `0f0764d3b340` — SIGNED OFF

Reviewed 2026-09-14. Record: `reviewed-source-0f0764d3b340.json`,
`followup-field-decisions.jsonl` (428 rows, 428 `approve_as_correction`, 0 `revise`).

SHA verified. 428 rows, 762 additions, re-counted from source. 9 tests pass.

## Zero reproduced in my own scope

The scope that found the four the batch's own test could not — unit stored keys, every string this
batch adds elsewhere in the unit, **and every string this batch declares it refuses anywhere in
the unit** — returns **0 introduced readmissions**. The declared guard is also clean: 71 found
against 71 declared, nothing new, no Japanese allowlist entries.

The two pairs that landed also closed three of the pre-existing collisions I reported in round 2:
`To hire`/`To fire` on ja-E1265 and ja-E1279, and `背が高い`/`背が低い` on ja-E1044. That is the
pair mechanism working exactly as argued. Eight pre-existing collisions remain, all untouched by
this batch, and seven of them are the fill-blank fragment artefact discussed below.

The renamed `within_typo_ball` ground is the correct metric and the wording now matches what the
practice was already doing. 42 refusals on that ground, grounds summing to 323, and
738 + 323 + 102 = 1,163 on one base.

## The 首にする withdrawal: accepted

Granting one orthography of an added lexeme rather than both is right, and it is the same call as
`とびら`. On *which* survived, the grader is indifferent: I tested both directions and whichever
is stored, the other is refused, because they sit two edits apart against a budget of 1
(basis `min(len("クビにする") = 5, len("解雇する") = 4) = 4`). So this is purely lexicographic.
Both spellings are standard; katakana `クビ` is the conventional writing for the idiomatic
dismissal sense and `首` is the kanji headword that generalises to `首になる`. Either is
defensible and I do not block on it. When `JA-KANA-KANJI-SCRIPT` is settled, both should be
accepted and this choice becomes moot.

## Cross-course sweep for the new English pair: clean

The English list is consulted for every language, and I had not run this either. Re-graded **every
stored answer in all nine courses** — each row's `correct_answer` and every entry of its
`accepted_answers`, with the current draft and this batch overlaid — against its own row:

| | |
|---|---:|
| Stored answers re-graded | 28,726 |
| ja / ko / zh | 3,521 / 3,432 / 3,667 |
| es / it / fr / de / pt / ru | 3,273 / 3,241 / 2,678 / 3,051 / 2,896 / 2,967 |
| Broken by the confusable lists | **0** |
| English pairs firing between two stored answers of one row | **0** |

The Korean figure of 3,432 reproduces the Korean reviewer's count exactly, which cross-validates
the harness. Nothing a learner can reach today became unreachable.

## Ruling on the 17: the author is right — a guard scoping defect

I reproduced the 17 independently and they are one artefact, exactly as claimed. Every one is a
`fill_blank` completion key that is a **substring** of the receiving row's key, and every
receiving row is a `listening_type`, `dictation` or `translate_to_target` row where the learner
types the whole word:

`チ_____ (Cheese)` keys `ーズ`, so `チーズ` accepts `ーズ`; `り_____ (Apple)` keys `んご`;
`遊び_____ (I played)` keys `ました`, so `見ました` accepts `ました`; `キー_____ (Keyboard)` keys
`ボード`; `す_____ (Should)` keys `べき`; `た_____ (Perhaps)` keys `ぶん`; `何_____ (Whatever)`
keys `でも`; `す_____ (Awesome)` keys `ごい`. None is a meaning flip. All predate any patch.

**Record it as a scoping defect, not 17 missing pairs.** Three reasons:

1. **A pair is not the wrong *mechanism* but it is the wrong *instrument*.** It would not break
   anything — my 28,726-answer sweep shows pairs never make a stored answer unreachable — but
   `べき` and `すべき` are not confusable words. `べき` is the correct and complete answer to its
   own row. The defect is that a fragment is in the sibling-key pool at all.
2. **Scoping generalises; pairs do not.** Excluding fill-blank completion keys fixes all 17 and
   every future one. Seventeen pairs fix seventeen instances, and the next fill-blank row
   reintroduces the problem.
3. **A pair is global to Japanese.** `['べき', 'すべき']` would apply everywhere in the language,
   for a reason that is an artefact of one row's storage format.

**One condition on that ruling.** Scoping them out of the guard must not close the underlying
question. A learner typing `ごい` on the "Awesome" row is told `Correct!` today, and that is a real
defect with a blast radius the Korean reviewer sized at 1,995 fill-blank rows. Its fix belongs at
the grader or exercise level — grade a fill-blank answer against the completed word rather than the
bare filler — not in the pair list and not in the guard. Record the scoping change and the grader
defect as **two** items, so the second is not closed by the first.

## A larger finding the 17 is a slice of

Sweeping key-to-key collisions across the frozen curriculum in all nine courses, with no patch
applied at all, finds **868**, of which Japanese is 17:

| Class | Count |
|---|---:|
| Completion fragment of the receiving key | 111 |
| Other fill-blank completion key | 97 |
| **Whole-word key — the class pairs are right for** | **660** |

| Course | ja | ru | ko | de | pt | es | it | fr |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Collisions | 17 | 19 | 59 | 126 | 144 | 155 | 166 | 182 |

The 660 include genuine antonym and different-word flips that no addition created: es-E1000
`Más bajo` accepts `Más caro`, es-E0820 `Paciente` accepts `Valiente`, ko-E1006 `더 좋은` accepts
`더 작은`, ko-E1018 `더 나쁜` accepts `더 빠른`, ko-E1042 `더 비싼` accepts `더 싼`. Japanese is
the *least* affected course in the corpus. This is well outside this batch and outside Japanese,
but it is the same mechanism, and it says the pair list needs a systematic pass rather than
batch-by-batch additions.

## Sign-off

**Safe to integrate at 428 rows and 762 additions.** All three rounds of objections are resolved,
the zero reproduces in the widest scope I can construct, and the cross-course pair sweep is clean.

Standing caveats: one reviewer, three passes. 428 rows carrying no objection means none was found,
not that they are right. The 102 script withdrawals and the 42 `within_typo_ball` withdrawals
remove correct answers pending decisions that have not been made, and the second group can be
restored once the 39 pairs land. The eight pre-existing collisions and the 868 corpus-wide ones
are untouched by this batch and need their own work.
