# Round three — the Japanese orthography ruling

**Decision 1 of [`../round2-triage/needs-human.md`](../round2-triage/needs-human.md)
is ruled: accept the reading.** On a written-production row whose cue is an
English gloss, a correct Japanese word written in the other script is a correct
answer. 61 rows, 66 readings.

Ruled 2026-09-16. Decision 2 (register) is **not** ruled and remains open.

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
