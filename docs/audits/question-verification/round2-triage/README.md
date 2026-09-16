# Round-2 triage — the 371 uncertain Japanese and 29 Korean claims

Every claim in the block is dispositioned. Nothing was forced: the split below
comes from one observation about what the learner is actually shown, and that
observation removes most of the block from the policy question it was filed
under.

- Frozen inputs: `.question-audit/snapshot-9a20145dc6b5.json` (production,
  captured 2026-09-15T02:38Z, i.e. after the content patch landed) and
  `remediation/es-ja-ko/lexical-reconciliation-2026-09-14.jsonl`.
- Grader: `lib/grading.ts` and `lib/confusable-pairs.ts` **as they stand on this
  branch**, i.e. including the app-half fixes that have not shipped. Where that
  matters it is said so.
- No production writes. Eight rows were re-read through the read-only Supabase
  endpoint to confirm the snapshot; all eight matched exactly.

## Where the claims are, and the counts actually found

The block is not in `pass1` or `pass2`. It is the `disposition: "uncertain"`
rows of `remediation/es-ja-ko/lexical-reconciliation-2026-09-14.jsonl`, where a
row was marked uncertain when *every* still-rejected candidate on it was
classified as systematic (one of five named policy families).

| | found | expected |
|---|---:|---:|
| Japanese uncertain claims | **371** | 371 |
| Korean uncertain claims | **29** | 29 |
| Candidate answers inside them | 479 | — |

Both counts reproduce exactly. One claim = one exercise, so 400 rows carrying
479 individual candidate strings; the buckets below are given both ways because
17 rows split across verdicts.

A drift check against today's production snapshot: **0 of 400 rows have moved**
— same key, and `accepted_answers` empty on all 400. The deployed content patch
did not touch any of them. Re-running the grader
reproduces the register's rejection for 478 of the 479 candidates; the one
disagreement is reported below and is new information.

## Buckets

| | rows (of 400) | candidates (of 479) |
|---|---:|---:|
| **Confirmed defect** | **298** | **313** |
| **Not a defect** | **35** | **81** |
| **Needs a human** | **67** | **85** |

By language — Japanese: 289 confirmed / 20 not-a-defect / 62 needing a decision.
Korean: 9 confirmed / 15 not-a-defect / 5 needing a decision.

Files: [confirmed.json](confirmed.json) (one entry per row, with the exact
`accepted_answers` value to write), [not-a-defect.md](not-a-defect.md),
[needs-human.md](needs-human.md). Supporting:
[candidate-decisions.json](candidate-decisions.json) — all 479 candidates with
their individual verdict and reason, so any single claim can be looked up — and
[collateral-check.json](collateral-check.json), the machine check behind the
`widens_typo_ball` and `blocking` flags.

## Method, and the one observation the whole triage turns on

The register filed 341 of the 371 Japanese rows under `JA-KANA-KANJI-SCRIPT`:
*should a kanji-keyed answer also accept its ordinary all-kana spelling?* Read
as a lexical question that is genuinely a policy call, and the register was
right to refuse to answer it.

It is not one question, because the rows are not one kind of task. **283 of the
371 are `listening_type` or `dictation`, and on those the learner is shown
nothing at all.** Verified in the shipped app, not inferred:

- `components/lesson/ListeningExercise.tsx` — the comment is explicit: "the card
  header shows a fixed 'Listen and answer' label, so the field is never
  rendered". The `prompt` is passed to TTS and never drawn. For all 231
  `listening_type` rows in this block, `prompt` is byte-identical to
  `correct_answer`, so the audio is exactly the key.
- `components/lesson/DictationExercise.tsx` — renders a fixed "Listen and type
  what you hear" and plays `exercise.correctAnswer`. It never renders `prompt`
  either, so the English gloss those 52 rows carry in their prompt text
  (`Listen and type what you hear (write the translation of: Informal)`) reaches
  neither the screen nor the speaker.
- `hintText` is rendered by exactly one component, `ClozeExercise.tsx`. On
  listening and dictation rows the English gloss in `hint_text` is not shown.

So the stimulus is audio and nothing else. Nothing in the task tells the learner
which script the author chose, and no orthography policy can fix that: a course
may legitimately insist on kanji, but it cannot test kanji production from audio
alone without saying so. A learner who hears みず and types みず has transcribed
correctly. That is decidable without settling `JA-KANA-KANJI-SCRIPT`, and it is
why 283 rows move out of the policy bucket and into confirmed defects.

The same cut then does real work in the other direction. On the 88 written-
production rows the learner *does* see a cue, so the policy question is real and
those rows stay open. And it explains the register's own observation that the
transcription argument "is the strongest part of the case" — it is not one
argument among several, it is a different argument that applies to a different
set of rows.

The remaining rows were read one at a time: every candidate classified `lexical`
(43 in Japanese, 25 in Korean), every Korean row, every sampled row, and every
`fill_blank`. Three rules did most of the sorting:

1. **The row's own instruction beats the taxonomy.** `Fill in the missing word:
   _____ means I studied` asks for one word, so `私は勉強しました` is refused there
   and `私は見ました` is confirmed on `Translate to Japanese: I saw`. Same
   candidate shape, opposite verdicts, because the prompts differ.
2. **A `fill_blank` claim is a claim about a stored fragment.** 48 of the 81
   refusals are this. Writing `はん` into `accepted_answers` on `ご_____ (Rice)`
   would make the bare fragment a passing answer — the 1,995-row grader finding,
   not a content defect.
3. **Register is content where the lesson teaches register, and noise where it
   does not.** `ko-E2246` states its whole target ("잡다 → passive, past tense")
   and sits in a passive/causative lesson, so refusing `잡혔습니다` grades
   something untaught: confirmed. `ko-E2275` sits in 높임말, where the speech
   level *is* the lesson: `드렸다` stays refused.

Every proposal was then machine-checked against the real `gradeAnswer` with the
runtime `exerciseHints`: all 313 become accepted; **none of them makes any of
the 2,281 Japanese / 2,152 Korean taught strings in the corpus newly acceptable,
except on four rows**, which are flagged `blocking` and described below.

## The ten most serious confirmed defects

**1. The 231 `listening_type` rows: a transcription task the learner cannot
pass by listening.** The worst are the single-kanji keys, 31 of them, where
there is no partial credit and no clue: `ja-E0511` plays て and demands `手`;
`ja-E0523` plays め and demands `目`; `ja-E2085` plays し and demands `詩`.
Also `ja-E0079` 水/みず, `ja-E0105` 魚/さかな, `ja-E0359` 母/はは, `ja-E0371`
父/ちち. A beginner who has not met the kanji is told their perfect
transcription is wrong. Spread across all four bands (A1 55, A2 67, B1 89,
B2 72), so it is not confined to material where kanji could be assumed.

**2. The 52 `dictation` rows, plus a design defect underneath them.** Same
rejection — `ja-E1788` plays ためぐち and refuses both `ため口` and `ためぐち`
against a key of `タメ口`, itself a non-standard katakana spelling. Underneath:
these rows were authored with an English gloss inside the prompt ("write the
translation of: Informal"), and `DictationExercise` renders neither the prompt
nor `hint_text` and speaks `correct_answer`. The authored task is not the task
that ships. Worth a separate look; it is outside this block's scope.

**3. `ja-E0361`, `ja-E0373`, `ja-E0569`, `ja-E0581` — correct, and blocking.**
The four kinship rows. `おばあさん` is keyed in kana and the correct kanji
spellings `お祖母さん` / `お婆さん` are refused, so the claim is upheld. But adding
them brings **お母さん (Mother), お父さん (Father), お姉さん, お嬢さん and お隣さん**
inside the typo budget on a row whose entire job is to tell kinship terms apart
— verified against the whole Japanese corpus, `Correct! (Minor typo)`. This is
the "Cheap"/"Inexpensive" class recurring on new material. **Do not land these
four until matching `lib/confusable-pairs.ts` entries exist**, or until Japanese
fuzzy tolerance is gated off (see the last section — under strict grading all
313 additions still pass and all 12 collateral acceptances disappear).

**4. `ko-E1465` — an `error_correction` row that demands a misspelling.** The
task is `Find and correct the error: 지속x능한` and the key is `지속가능한`.
`가능하다` is a separate predicate, so `지속 가능한` is the standard spacing; the
key is the permitted-but-less-standard joined form. A learner who corrects the
error *and* spaces it correctly is marked wrong, on a row whose instruction is
"correct the error", and `error_correction` is graded strictly so there is no
tolerance to save them.

**5. `ko-E1451` and `ko-E1521` — the same shape.** `야생 동물` and `인공 지능`
are both permitted under 한글 맞춤법 §50, which lets a technical term be written
with or without the space. Both refused. Strict grading again.

**6. `ko-E0661`** — `치과 의사` refused for `치과의사` on a cloze row. Same rule,
no tolerance, correct Korean marked wrong.

**7. `ko-E2246` and `ko-E2248` — grammar drills that silently grade register.**
`도둑이 결국 경찰에게 ___. (잡다 → passive, past tense)` states its entire target.
`잡혔다` and `잡혔습니다` satisfy it exactly and are refused. The lesson is
Passive & Causative; speech level is not what it teaches and the prompt names
none. Same for `ko-E2248` (`먹다 → causative, past tense`). Both are strict-mode
rows, so the additions carry zero tolerance risk. The alternative fix — naming
the required register in the prompt — is equally acceptable and cheaper to
reason about; either closes it, doing neither does not.

**8. `ko-E2275`** — `주다 → humble, past tense`, key `드렸어요`. `드렸습니다` is
humble, past and deferential-polite: it satisfies every stated requirement and
loses nothing the 높임말 lesson teaches. Confirmed. `드렸다` is refused on the
same row, because there the plain style does contradict the honorific frame —
this row is the clearest case in the block of register being content rather
than noise.

**9. Five Japanese and two Korean rows that refuse an overt subject the cue asks
for.** `Translate to Japanese: I saw` refuses `私は見ました`; `Translate to
Korean: I studied` refuses `저는 공부했어요`. Both languages drop subjects
optionally; neither forbids them, and the English cue says "I". Rows
`ja-E0886`, `ja-E0892`, `ja-E0898`, `ja-E0934`, `ja-E0970`, `ko-E0856`,
`ko-E0862`. The identical candidate is *refused* on the three "Fill in the
missing word" rows that carry it — `ja-E0889`, `ko-E0889`, `ko-E0901` — because
those prompts ask for one word.

**10. `ja-E1645`** — `Fill in the missing word: _____ means I wish`, key
`したい`. `願う` and `願っています` are the ordinary verbs for wishing and are
refused, while the key means "want to do". The claim is upheld, but the row also
deserves a second look on its own terms: `したい` is a loose gloss for "I wish"
in a conditional lesson, and adding the right answers does not make the key a
good one.

Two more that did not make the ten but should not be lost: `ja-E2059` refuses
`締切` and `〆切`, both standard spellings of a deadline, and `ja-E1364`
(`遅_____ (Delay)`) is a fragment row where the completed `遅れ` is a legitimate
answer the key `遅延` does not admit — recorded in `not-a-defect.md` as a
fragment claim, but the content point underneath is real.

## Three things that change how the rest of the audit should be finished

**The Korean tolerance fix has already quietly decided part of
`KO-SPEECH-LEVEL`.** Re-grading the 479 candidates reproduced the register
exactly on 478. The exception is `ko-E1032` (`더 키_____ (Taller)`, key
`가 크다`), where `가 큰` now returns `Correct! (Minor typo: "가 크다")` on this
branch and did not when the register was built. The cause is the Korean
decomposition fix in `lib/grading.ts`: measuring the budget on the decomposed
form gives a Korean key of this length a budget of 2 jamo, and Korean
inflectional endings — `-다` / `-요` / `-ㄴ` — are one or two jamo apart. So the
shipped grader will start accepting *some* speech-level variants by edit
distance, on rows chosen by string length rather than by pedagogy. Whichever way
Decision 2 in `needs-human.md` goes, it should be implemented deliberately
rather than inherited from a tolerance constant.

**Adding an answer still widens the typo ball, and the corpus check is the only
test that matters.** 88 of the 298 confirmed rows are flagged
`widens_typo_ball: true` — a new accepted string of any length creates a new
tolerance neighbourhood around itself. On 84 of them nothing real lives in that
neighbourhood. On four it does, and those are the kinship rows above. A
per-row "does this widen tolerance" check would have passed all 88 and caught
none; **the check that found them compares against every taught string in the
language, not against the row's own unit.** Recommend that test be adopted for
the remaining 1,250 accepted-answer omissions — the same four-row class will
recur wherever a kanji spelling is added to a short kana key.

**The Japanese edit-distance recommendation and this patch are complementary,
and should land together.** Gating Japanese fuzzy acceptance off is already
recommended in `CURRENT-REMAINING.md` on the grounds that a Han character is a
morpheme. Measured here: under strict grading **all 313 additions still pass**
(they become exact matches) and **all 12 collateral acceptances vanish**. So the
two changes are not in tension — the additions supply the correct answers that
tolerance was being asked to guess at, and strictness removes the guessing. Land
the transcription additions and the `ja` strictness gate in the same build and
the 283-row class closes with no widening at all.
