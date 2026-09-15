# Remaining work — 2026-09-14 checkpoint

Both item-review passes are complete for all 21,763 in-scope questions, and a
large amount of remediation has since been authored, independently reviewed and
integrated. The audit is **still not finished**. Historical first/second-pass
files deliberately preserve findings as they were recorded; their old pending
labels are not a current count of unfixed errors, and a patched row does not
automatically close every claim attached to it.

**The content patch and the server half are deployed.** All 5,556 rows landed in
production on 2026-09-14 as one transaction, with zero drift before and zero
mismatches after; `reverse.sql` is the tested, unapplied rollback. The
`checkpoint`, `generate-goal-track`, `grade-writing` and new `grade-response`
functions are deployed too, with 118 Deno tests passing and all four answering
401 unauthenticated. The daily semantic-grading caps are settled at 20 starter
and 300 paid, costed rather than guessed.

**The app binary is the one thing still unshipped**, so readmissions stand at 88
rather than 71 until a build goes out. That is the only item below whose
remedy is already written and merely waiting.

Work is now in flight on three branches, none merged: `audit/grader-behaviour`
(the five grader defects and the sibling-key rule), `audit/content-round2` (a
second guarded patch for the named content defects) and
`audit/uncertain-triage` (the 371 Japanese and 29 Korean uncertain claims).
Items below marked *in flight* are being worked; the rest are untouched.

## Current state

| | |
|---|---:|
| Draft records | 5,556 |
| Changed fields | 10,255 |
| Exact-value independently approved | 10,246 |
| Approved with a recorded dependency | 9 |
| Rows inserted rather than updated | 5 |
| Declared readmissions carried under guard | 71 |

Draft SHA-256 `237ddddab42875e97dc5ecdea0b92658313dbcb0f185e548b676e79150f306d5`,
against frozen snapshot `8c7f381c78d8…`. 52 independent review directories now
hold exact-value evidence.

## What closed today

Five frozen proposal batches were independently reviewed and integrated: DE/IT/ZH
hobby and music (92 fields), ES/JA/KO jobs/kitchen/music (124) and
clothes/weather/hobbies (149), and Russian controlled-topic (120) and
targeted-skill (29). The 30 held boundary rows and the three Phrasal Verbs items
were adjudicated individually and integrated. Accepted-answer omissions were
authored and reviewed for German (217 rows), Italian (331) and Chinese (453),
together with five Italian option-collision defects where two offered options
were both correct.

Four questions the user settled on 2026-09-14 are implemented: AI semantic
grading for open responses, language-aware Japanese and Chinese writing length,
a register scaffold for the five health/sport passages at slot 3008, and
individual adjudication of the held boundary rows.

## Still open — content

- **868 key-to-key collisions across the frozen curriculum**, in all nine
  languages, with no patch applied at all. This is the largest single finding
  still open and it is not caused by the remediation. By class: 111 completion
  fragments of the receiving key, 97 other fill-blank completion keys, and **660
  whole-word keys, which is exactly the class confusable pairs are the right
  remedy for**. The 660 include antonym flips no addition created — Spanish
  "Más bajo" accepting "Más caro", "Paciente" accepting "Valiente", Korean
  "더 좋은" accepting "더 작은" and "더 비싼" accepting "더 싼". Per language:
  French 182, Italian 166, Spanish 155, Portuguese 144, German 126, Korean 59,
  Russian 19, Japanese 17. It needs a systematic corpus-wide pass rather than
  batch-by-batch additions.
- **Fill-blank rows are graded against the bare filler, not the completed word.**
  A learner typing ごい on an "Awesome" row whose key is the fragment ごい is told
  Correct!. Two reviewers found this independently, in Japanese and Korean, and
  the blast radius is 1,995 rows. The remedy belongs at the grader or the
  exercise level — grade the completed word — and explicitly NOT in the pair list
  or the readmission guard. Recorded as its own item so that scoping fragments
  out of the guard cannot be mistaken for closing it.
- **The readmission guard counts completion fragments as sibling keys**, which is
  a scoping defect in the guard rather than missing pairs. Excluding completion
  keys fixes all 17 Japanese instances and every future one; 17 pairs would fix
  17 instances and the next fill-blank row reintroduces them.
- **Forty-two correct Japanese answers are withdrawn to protect their
  neighbours**, restorable once the author's 39 confusable pairs land. They were
  deliberately not written to the shared pair file, which had a concurrent owner.
- **371 uncertain Japanese claims and 29 Korean**, the biggest uncertain block in
  the audit. They need triage, not a forced call.
- **One German field** left uncertain: "Pressure group" on `de-E2035`.
- **Nineteen Italian same-gloss-same-key inconsistencies**, where a cloze row
  carries an alternative and the identically-keyed translate row does not. A
  second reviewer pass found these after its own batch was integrated; the first
  pass had reported five. Being authored now, with a standing corpus-level test
  so new divergence fails immediately.
- **Three Italian choice rows** the integrated batch makes semantically
  ambiguous, because the batch asserts elsewhere that the offered option is
  correct: `it-E1074` Festa/Festival, `it-E1876` Etica/Morality, `it-E1960`
  Tuttavia/Nevertheless. No test can catch these — the grader still returns
  exactly one right answer; the defect is in meaning.
- **A fifth welded blank**, `it-E1008` rendering as "Menocaro".
- **Twenty-six further Korean confusable pairs**, plus 안녕히 가세요 / 안녕히 계세요,
  which needs its correct translation authored first or a right answer becomes a
  rejection. Being authored now.
- **`ko-E0218`**, where 하다 and 한다 are the same verb in two forms and a
  `fill_blank` testing a specific form arguably belongs in `isGrammarExercise`.
- **`zh-E1321`**, where the curriculum glosses 预约 with nouns only and 预订 with a
  verb only, so whether "Booking" and "To reserve" sit on the right side of that
  contrast is part-of-speech as much as lexical. No dictionary settles it; it
  needs a ruling from whoever owns the Travel unit. The row marks no wrong
  answer right either way. (A related claim against `zh-E1347` and six sibling
  rows was withdrawn: each distractor turns out to be the taught key of another
  item in the same unit, which is how a distractor is built. The reviewer that
  raised it applied a dictionary test where the curriculum test was the right
  one, and five dependent refusals stand as a result.)
- **Four untouched rows** now offer distractors for vocabulary their lesson no
  longer teaches (`es-E2097`, `es-E2098`, `ja-E2098`, `ko-E2102`). Distractors
  need not be taught, so this is a judgement, not a defect.
- **The Film & Theater mismatch is wider than the four rows adjudicated.** That
  lesson and Describing Art draw from one shared twelve-word pool; the titles are
  close to decorative. Only the two clearly visual-arts items were fixed.
- **The Phrasal Verbs lesson title still overstates its contents.** One authored
  row does not make an idiom-and-proverb lesson a phrasal-verb lesson.
- **A possibly malformed row**: the non-word "fores" appears as a taught string in
  the Portuguese B2 lesson O Futuro do Conjuntivo, which looks like truncation.

## Still open — grading behaviour

Three grader defects were found and fixed today; three more are diagnosed and
deliberately **not** fixed, because they change behaviour for every learner in a
language and are the product owner's call. All are evidenced in
`runtime-independent-review/`.

- **Edit-distance tolerance for Chinese and Japanese.** A Han character is a
  morpheme, so one edit replaces a whole unit of meaning, and IME input cannot
  produce those errors at all. The recommendation is to gate fuzzy acceptance off
  for `zh` entirely and for `ja` above a kana-only threshold. Korean is
  explicitly excluded: a jamo genuinely is a fraction of a word.
- **Traditional-script input.** There is no policy today: the same traditional
  substitution hard-fails on a two-character key and passes on a seven-character
  one as "Correct! (Minor typo)". Roughly 37 rows pass that way while telling the
  learner their correct answer was a typo. Recommendation is to fold traditional
  to simplified, gated on `hints.language === 'zh'` — and the fold must sit in
  `normalize()`, or at least before the strict-mode return, not in the tolerance
  path: 221 of the 692 affected rows are strict-graded and never reach tolerance
  at all, so a fix placed there would repair only the 37.
- **Bare unaccented stems.** Typing `avo` still passes for both Avô and Avó, so
  the Portuguese grandfather/grandmother contrast is untestable by typing for a
  learner who omits diacritics. Refusing it is pedagogically right and a real
  behaviour change on keyboards without easy accents.
- **Negation scored as a typo, now fixed.** 134 negated strings graded as
  correct across the draft, about 40 inverting meaning in the target language:
  `No estudié` for "I studied", `Nicht ausruhen` for "To rest", `Not fire` for
  "To fire". 48 of them held on the bare key with no authored alternative, so
  they predate this remediation entirely. A minor-typo pass rates as 3, which
  SM-2 treats as success, so the learner was told the inverse was right and then
  shown the card less often. No data could close it — the bare-key cases would
  need one pair per taught verb per language — so the rule went into the grader:
  a candidate differing from the expected string only by a leading negator is
  never a typo. It does not reach negation by suffix, French `ne … pas`, or
  Japanese and Korean verb endings, and those languages are not in the table.
- **Antonyms inside the typo budget in the frozen curriculum.** A sweep of the
  unpatched corpus found 21 rows already accepting a sibling question's key.
  Two were antonym pairs grading each other correct: "To hire" and "To fire",
  and 背が高い and 背が低い. Both are fixed. The rest are recorded, and they are
  the reason confusable pairs are needed independently of any batch.
- **Readmission by a correct addition.** Adding an accepted answer used to widen
  the typo budget for every wrong neighbour on that row, because the budget was
  scaled by the matched alternative rather than the key. The remediation had
  introduced 88 instances of this across seven languages — most starkly, the key
  "Cheap" plus the addition "Inexpensive" made the antonym "Expensive" score
  correct, in all seven. The budget is now scaled by the shorter of the two,
  which closes the inflation class. What remains is the ordinary pair class,
  where the wrong string sits inside the key's own budget: `es-E1138` still
  accepts "No estoy de acuerdo" on an "I agree" row, which is a polarity flip
  and the most serious single instance left. A re-measurement is in flight.
- **Productive paradigms.** Same-verb tense pairs (estudié/estudiaré) and
  derivational noun/verb pairs (reserva/reservar) are real holes a pair list
  cannot close. The recommended remedy is a content fix: set `target_grammar` on
  those rows, making the whole class strict at once.
- **`caliente`/`valiente`** was left uncertain because c and v are adjacent on
  QWERTY, unlike every other approved pair.

The 371 uncertain Japanese and 29 Korean claims are unchanged. The five uncertain
Chinese fields were settled by a second reviewer pass and are now applied.

The confusable-pair list is also **known to be incomplete**, and the scale of
that is now measured rather than assumed: a rescan against the shipped grader
found that the earlier Korean scan computed the budget on composed length and so
discarded 242 of 354 Korean keys, and that `fill_blank` — 1,995 rows taking full
typo tolerance — was never scanned at all by either pass. A further structural
gap cannot be closed by a pair list: `fill_blank` stores only the blank's filler,
so tolerance operates on fragments such as 간색 rather than 빨간색. It was built from a
same-lesson scan plus a whole-course rescan for some languages; a pair split
across two courses, or one whose member is never a typed answer, is invisible to
both. The CJK adjudicator measured a 34% miss rate for the scan in its own scope.

## Product decisions still required

1. **The two daily caps for AI semantic grading**, in `DAILY_SEMANTIC_GRADES`:
   20/day on the free tier and 150/day on paid. Marked configurable and awaiting
   confirmation.
2. **Whether a B1 reading checkpoint whose key is a single connector may also
   accept a multi-word periphrasis** of the same relation. This is the whole of
   the remaining `fr-C0024` question; the apostrophe hypothesis it was filed
   under is positively disproved.
3. **The reading pass mark.** Adding a third question to the five 3008 passages
   moves achievable comprehension scores from halves to thirds, so two of three
   is 0.667 and `READING_COMPREHENSION_PASS` is 0.70. A learner still needs a
   perfect score for B1 reading credit, but the bar moved from "both retrieval
   questions" to "those plus the register question". Defensible for a register
   unit, but it changes what those passages certify.
4. **The three grading-behaviour items above**, each of which is visible to every
   learner in the affected language.

## Implemented through runtime, not database rewriting

The historical 352 English writing-vocabulary claims use the approved
alternative remedy: the UI labels them as vocabulary ideas and the grading prompt
credits target-language equivalents. Higher-level writing delivery is gated by
the course ceiling; true/false reading choices have a renderer fallback;
checkpoint writing grading receives the actual assignment. Their unchanged
database fields are not proof those defects remain.

## Completion gates

Before this audit can be called finished: the ES/JA/KO author passes must land
and be independently reviewed; the uncertain blocks must be triaged; the change
register, approval ledger and source hashes must be refreshed; and the full
content, application, server and in-memory SQL regressions must pass on the
final draft. No statement of zero errors, audio certification or guaranteed
future generation quality is supported by any of this.
