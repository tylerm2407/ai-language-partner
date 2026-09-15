# Remaining work — 2026-09-15

Both item-review passes are complete for all 21,763 in-scope questions. Round one
is deployed, the server half is deployed, every grading defect the audit
diagnosed is fixed in code, and round two is built. The audit is **still not
finished**, and the gap is now concentrated in one place rather than spread
across nine languages.

Historical first/second-pass files deliberately preserve findings as they were
recorded. Their pending labels are not a current count, and at least three
claims in this audit turned out to be prose that outlived its own correction —
check the machine-readable decisions beside a document before acting on its
narrative.

## What is live

| | |
|---|---|
| Round-one content patch | **deployed** 2026-09-14, 5,556 rows / 10,255 fields |
| `checkpoint`, `generate-goal-track`, `grade-writing`, `grade-response` | **deployed** 2026-09-15 |
| Semantic-grading caps | settled: 20 starter, 300 paid |
| Rollback for round one | `reverse.sql`, tested, **not applied** |

## What is built and not shipped

**The app binary.** Twelve commits of grading fixes are merged and green — 1,461
app tests, 43 audit tests, typecheck clean — and **none of it has been on a
screen.** The hint rendering alone changes what a learner sees on 398 rows and
is verified by typecheck and lint only. This is the single blocking item.

**Round two.** 640 rows, 723 fields, in `../round2/`. It carries an
`apply_precondition` in its own `draft-patches.json` and must ship in the same
release as the grader branch, never before it: its 391 accepted-answer additions
widen typo tolerance while the Japanese edit-distance gate is absent from the
shipped binary. A SQL patch cannot enforce that, which is why it is written into
the artifact rather than only into a report. **So the app build now gates a
database patch, not just the app.**

## Closed since the last revision

Every grading-behaviour item the register listed as awaiting a ruling is fixed:
fill-blank is graded as the completed word (1,789 rows stop rejecting correct
answers), another taught key is never a typo, Han script loses typo tolerance,
traditional Chinese folds to simplified inside `normalize()` so the 281
strict-graded rows are covered too, bare unaccented stems are refused, and
Korean and Japanese inflectional endings are never typos. Negation was fixed in
round one.

Declared readmissions: **88 → 71 → 29**. The guard was also rewired, because it
had been passing a subset of the runtime hints and so measuring a grader nobody
runs. Twenty of the surviving 29 are Portuguese preterites, which round two
closes by setting `target_grammar`.

The 371 Japanese and 29 Korean uncertain claims are triaged: 298 confirmed and
compiled, 35 withdrawn, and both remaining decisions ruled on by Tyler on
2026-09-15. That block is closed.

## Still open

1. **1,337 rows accept a string their language teaches as something else.** The
   largest open finding in the audit, measured across 10,212,995 grades with
   unit-scoped sibling keys already applied — so these are cross-unit. Spanish
   "Hablé" accepts "Table"; German "Hemd" accepts "Head". By language: es 270,
   pt 226, fr 209, it 209, de 153, ru 114, ko 108, ja 46, zh 2. Whether to widen
   `siblingKeys` from unit to course scope is under measurement; the cost to
   weigh is how many genuine slips would start being refused.
2. **`zh-E1321`** is held for the Travel unit's owner. The curriculum glosses
   预约 with nouns only and 预订 with a verb only, so this is part of speech as
   much as lexis and no dictionary settles it. A proposal is written and
   deliberately excluded from `draft.sql`.
3. **Forty-two correct Japanese answers** were withdrawn in an earlier batch to
   protect their neighbours. Confirm whether the shipped pair list and the new
   gates make them restorable.
4. **Nine readmissions** that round two does not close. Each needs a confusable
   pair or a content change.
5. **The Film & Theater and Describing Art pool** is repaired for 24 rows, but
   the two lessons still draw on one shared vocabulary; the titles remain closer
   to decorative than descriptive.

## Not defects

Recorded so they are not rediscovered. The Portuguese "fores" is the
second-person future subjunctive of *ir*, not a truncation. "Pressure group" is
a correct gloss of *Interessengruppe*, with dictionary evidence. Two Italian
items the register listed were already closed by round one. Four rows offering
distractors for vocabulary their lesson no longer teaches are a judgement, not a
defect: a distractor need not be taught.

## Housekeeping

The branch merges cleanly into `master` but conflicts with `redesign/ui-2.0` in
fourteen files, all lesson, reading and writing components both branches edited
for different reasons. About 80 MB of review evidence under
`docs/audits/question-verification/` is untracked pending a decision on whether
it belongs in git history; one file was committed out of it deliberately,
because it carries a correction to the record.

No statement of zero errors, audio certification, or guaranteed future
generation quality is supported by any of this.
