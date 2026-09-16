# Round three — the Japanese orthography ruling

**Decision 1 of [`../round2-triage/needs-human.md`](../round2-triage/needs-human.md)
is ruled: accept the reading.** On a written-production row whose cue is an
English gloss, a correct Japanese word written in the other script is a correct
answer. 61 rows, 66 readings.

**Decision 2 is also ruled: fix the cue, not the grading.** Seven prompts gain
an explicit register marker; no accepted answer moves. See
[Decision 2](#decision-2--register) below.

Both ruled 2026-09-16. `round2-triage/needs-human.md` is now closed.

## The ruling

Three reasons, in the order they actually carry weight.

**1. The corpus does not hold the rule it would be enforcing.** `明日`, `社会`
and `椅子` are keyed in kanji; `まっすぐ`, `おいしい`, `すごい`, `たぶん`, `さらに`
and `めったに` in kana; `ご飯`, `お風呂` and `もっと大きい` mixed. Refusing the
reading means telling a learner their correct Japanese is wrong for breaking a
convention the course itself breaks and never states. A learner cannot infer a
rule the corpus does not follow, so the refusal is unteachable as well as wrong.

**2. The item is testing the wrong thing.** `Translate to Japanese: Right` asks
whether the learner knows the word, not whether they can write it in kanji.
Grading on script folds an orthographic skill into a vocabulary item — exactly
the conflation the five-strand measured level exists to prevent.

**3. The costs are asymmetric in time.** These are exact-match additions and can
be withdrawn with no residue (see `withdraw.sql`). A learner told their correct
answer was wrong cannot be un-told.

The middle option — accept on `cloze_deletion`, refuse on `translate_to_target`,
or the reverse — was rejected. The triage found nothing in the data separating
the two prompts, and a split no one can justify is a rule no one can maintain.

## What this ruling does NOT do

It does not drop the kanji requirement. It drops the requirement **from items
that never asked for it**. If producing kanji should be graded, it needs a cue
that says so — an explicit instruction, or an orthography item type — and that
is a content change, not a grader rule. That follow-up is open and unscheduled;
until it exists, the Japanese track can be completed without producing kanji,
which is a real pedagogical gap and is recorded here as one.

## It was already live before it was ruled

Every one of the 66 readings was already in production when this ruling was
written. **Round two carried all 61 rows**, and applying round two on
2026-09-16 wrote them. So the deploy decided Decision 1 before anyone ruled on
it, in the same direction this ruling reaches.

`needs-human.md` half-saw this. It flagged `ja-E2267` as "already decided the
other way, by accident" by the round-one patch — one row. It did not record that
round two's draft carried the whole class. The triage was built against that
draft and re-opened claims the draft had already settled, so its `needs_human`
verdict described the *claim*, not the *shipped state*.

The lesson for the next round: **a triage verdict is not a deploy state.** Check
the draft you are about to apply for the rows a triage says are open, because a
patch set built earlier may already answer them.

## The check this class never got

Round two's `apply_precondition` was about the grader gate — the Japanese
edit-distance rule and the kinship confusable pairs — not about this ruling. The
additions themselves were never measured against the corpus.

They are now. `build-round3.mjs` reconstructs each row's `accepted_answers` as
it would be had the ruling gone the other way, and grades the whole Japanese
corpus against the difference:

```
node scripts/question-audit/round3/build-round3.mjs --snapshot .question-audit/snapshot-b982b1e00c0f.json
deno run -A --no-check --sloppy-imports scripts/grading/widening-check.mjs \
  --snapshot .question-audit/snapshot-b982b1e00c0f.json \
  --additions docs/audits/question-verification/round3/proposal.json \
  --language ja --sibling-scope language
```

**61 rows, 294,732 grades, no taught string newly accepted anywhere.** Clean at
`unit` sibling scope and at `language` scope, which is the scope the shipped
grader uses. Snapshot `b982b1e00c0f`, taken after round two landed, so this is
the corpus as it actually stands and not the frozen pre-patch one.

## Files

| file | what it is |
|---|---|
| `proposal.json` | the 61 rows, each with the live list and the list without these readings |
| `draft-patches.json` | the guarded patch objects — empty of pending writes, kept as the record |
| `withdraw.sql` | the guarded undo, **not applied**, if kanji is ever required explicitly |
| `widening-check.json` | the full harness output |


---

# Decision 2 — register

**Ruling: fix the cue, not the grading.** Applied as
`supabase/migrations/137_register_cues.sql`, 7 rows, prompt copy only.

## Why not accept-upward / refuse-downward

The triage recommended accepting a raised register and refusing a dropped one.
Upward turned out to be live already — round two added 料理します, でしょう,
아닙니다, 공부했습니다, 갔습니다, 해야 합니다, 해야 해요, 바라요, 바랍니다 and
저는 바랍니다 — so the only thing still refused anywhere in this class was
downward, on seven rows.

And refusing downward fails by the triage's own argument. It justified accepting
upward with "hard to justify refusing on a cue that names no register", and
`Translate to Korean: I studied` names no register in either direction. The
asymmetry is pedagogical (A1 teaches the polite greeting), not evidential, and a
grading rule cannot carry a distinction the prompt does not make.

So the prompt makes it:

| ref | was | is now | now honestly refuses |
|---|---|---|---|
| `ja-E0014` | `Translate to Japanese: Good morning` | `Translate to Japanese (polite): Good morning` | おはよう |
| `ja-E0038` | `Translate to Japanese: Good night` | `Translate to Japanese (polite): Good night` | おやすみ |
| `ko-E0066` | `Translate to Korean: No` | `Translate to Korean (polite): No` | 아니 |
| `ko-E0856` | `Translate to Korean: I studied` | `Translate to Korean (polite): I studied` | 공부했다 |
| `ko-E0862` | `Translate to Korean: I went` | `Translate to Korean (polite): I went` | 갔다 |
| `ko-E0889` | `Fill in the missing word: _____ means I studied` | `Fill in the missing word (polite form): _____ means I studied` | 공부했다 |
| `ko-E0901` | `Fill in the missing word: _____ means I played` | `Fill in the missing word (polite form): _____ means I played` | 놀았다 |

## This resolves the §2 inconsistency without touching those rows

The triage flags `JA-POLITE-AFFIX` refusing おはよう while `lexical` accepts
ごめん for すみません, うん for はい and ううん for いいえ — the same casual-for-polite
move on the same kind of bare A1 gloss — and says one position has to give.

Neither has to. Those four keep bare-gloss cues, and a bare gloss accepting
either register is right. The grading now differs because the **cues** differ,
which is a distinction the learner can see. Withdrawing three live acceptances
was the other way to make it consistent, and the worse one: it newly rejects
correct answers to fix a wording problem.

## Five of the twelve rows need no cue

`ja-E0462` is the script decision. `ja-E0712`, `ja-E1642`, `ko-E1670` and
`ko-E1684` are keyed at the PLAIN level with the polite forms already accepted,
so they refuse nothing and a marker would only narrow a row that is currently
correct.

## No widening check is needed here

Round three part one needed one because it added accepted answers. This adds
none — it is prompt copy — so no typo neighbourhood moves and nothing new can
be admitted. `reverse.sql` is the guarded undo, unapplied.
