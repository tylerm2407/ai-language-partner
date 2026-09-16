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

## Where this actually stands

**Both content rounds are live.** Round one landed 2026-09-14 (5,556 rows) and
round two on 2026-09-16 (820 rows). Round two's apply was clean — all 909 fields
match the intended end state — but its precondition was not met.

**The precondition was violated, and the cost is measured rather than feared.**
Round two declared that it must ship in the same release as the grading work,
because seven of its rows have no defence but the Japanese edit-distance gate.
It was applied while that gate existed only on a branch. Graded against a copy
of `lib/grading.ts` with the gate removed — which is what every installed build
runs — **sixteen wrong answers are currently accepted**:

| row | now accepts |
|---|---|
| Grandmother | mother, father, older sister, young lady, neighbour |
| Grandfather | mother, father, older sister, young lady, neighbour |
| Shorter | cheaper, more expensive, better, faster, slower, worse |

**The next app build closes all sixteen** and is the only thing that does. The
audit is merged into the trunk as of 2026-09-16, so the gate and the content now
travel together; nothing further is needed from the curriculum side.

Reverting those four rows was considered and rejected: it optimises for a
five-account test window at the cost of churn, and the build is coming anyway.

**A guard now exists so this cannot recur quietly.**
`scripts/question-audit/apply-remediation.mjs` refuses to apply any patch whose
draft declares `apply_precondition` unless the operator passes
`--precondition-met "<evidence>"`, which is echoed into the run log. It cannot
verify a build shipped — no script can — but it makes the claim a deliberate,
attributed act instead of an omission. A future round inherits the guard simply
by declaring the field.

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

## The integrated branch

`audit/integrate-ui2` carries this audit merged onto `redesign/ui-2.0`, which is
the live trunk — `master`'s last commit is 2026-09-05 and nothing targets it.
2,624 tests across 165 suites, typecheck and eslint clean. The merge runs with
the audit as first parent, so Tyler's branch was never written to.

Two things that worktree needs and no branch carries, because both are
gitignored. Recreate them or the verification misreads:

- `website/node_modules` — without it `npx eslint .` reports an unresolved
  `marked` in `website/build.mjs`. Pre-existing on Tyler's branch, unrelated to
  the audit; `npm install` inside `website/` clears it.
- `.question-audit/snapshot-8c7f381c78d8.json` — `readmission.test.mjs` fails at
  load with `ENOENT` without it, which reads as a broken suite rather than a
  missing fixture.

**Where to look first if round two ever misbehaves.** Content changing accepted
answers surfaces as movement in the readmission suite, not as a jest failure, so
that Deno run is the one to trust. The live-content graders inside the merge's
collision zone are `readingQuestionOptions` and `gradeReadingAnswer` in
`ComprehensionQuestions`, the `exerciseHints` path in `TranslationExercise` and
`ClozeExercise`, and `writingOverallScore` in `WritingFeedbackView`.

## Do not revert the writing-screen label

`components/writing/WritingExercise.tsx` labels the vocabulary chips
"Vocabulary ideas (use the target-language equivalents)" rather than the shorter
"Try to use these words". It reads like a copy edit and it is not.

352 of 550 writing prompts hold **English glosses** in `target_vocabulary`, and
`grade-writing` feeds that same column into the grading prompt. So the words
shown to the learner are the words the grader is told to look for, and the short
label instructs someone to type English strings into a target-language
composition that is then scored against them. The label plus the grading-prompt
change IS the approved remedy for those 352 rows, chosen in place of rewriting
the content. Reverting one half keeps the grading change and drops the interface
change that makes it coherent.

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
