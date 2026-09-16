# Not a defect — 81 claims across 35 rows fully refused

Grouped by the reason the claim fails, so the pattern is visible. A row appears
here for every candidate it carries that is refused; 17 rows are split (some
candidates confirmed or open, some refused) and appear in more than one file.
Row totals, and how the buckets add up, are in [README.md](README.md).

Three patterns carry almost all of it.

**Fragments (48 of 81).** `fill_blank` stores only the string that goes in the
blank, so a claim about `はん` on `ご_____ (Rice)` is a claim about a fragment,
not about a word. It cannot be granted as a content edit: adding `はん` to
`accepted_answers` makes the bare fragment a passing answer, which is the
1,995-row grader finding already open in `CURRENT-REMAINING.md` ("fill-blank
rows are graded against the bare filler, not the completed word"). Grade the
completed word and most of these re-open as ordinary script or register claims
against `ごはん` / `ご飯`; until then there is nothing correct to write into the
row. Two of them carry a real content observation underneath and are called out
in the README rather than lost here: `ja-E1364` (`遅_____ (Delay)`, where the
completed `遅れ` is a legitimate answer the key `遅延` does not admit) and
`ja-E0354` (`兄_____ (Brother)`, where the gloss is ambiguous between 兄弟 and
兄さん).

**Register lowered (12).** A plain or dictionary form offered against a polite
key — `見た` for `見ました`, `行く` for `行きます`, `드렸다` for `드렸어요`. Register is
a real distinction in both languages and the keys are consistently polite where
the course teaches politeness; refusing the drop is correct. Candidates that
*raise* politeness are a different question and are in
[needs-human.md](needs-human.md), not here.

**"One word" prompts (5).** `Fill in the missing word: _____ means I studied`
asks for one word. `私は勉強しました` and `저는 공부했어요` are a subject, a particle
and a predicate. The same candidate on a `translate_to_target` row *is*
confirmed — see the README; the instruction on the row is what separates them.

The rest are individually read: part-of-speech mismatches (`운동하다` for the noun
`운동`), a different word (`학습`/`学習` for the taught `勉強`), a nuance step
(`しゃべる` for `話す`), an added modality (`行くつもりです` for "I will go"), and two
rows where the distinction the candidate erases is exactly what the row teaches.

### 48 claim(s) — fill_blank stores only the blank filler, so the claim is against a fragment. Acting on it as a content edit would make the bare fragment a passing answer — the 1,995-row grader finding, not a content defect.

- `ja-E0016` (fill_blank, A1) — prompt `おやす_____ (Good night)`, key `みなさい` — refused candidate `み`
- `ja-E0078` (fill_blank, A1) — prompt `ご_____ (Rice)`, key `飯` — refused candidate `はん`
- `ja-E0122` (fill_blank, A1) — prompt `ご_____ (Rice)`, key `飯` — refused candidate `はん`
- `ja-E0254` (fill_blank, A1) — prompt `お_____ (Money)`, key `金` — refused candidate `かね`
- `ja-E0354` (fill_blank, A1) — prompt `兄_____ (Brother)`, key `弟` — refused candidate `さん`
- `ja-E0424` (fill_blank, A1) — prompt `お_____ (Bath)`, key `風呂` — refused candidate `ふろ`
- `ja-E0494` (fill_blank, A1) — prompt `お_____ (Stomach)`, key `腹` — refused candidate `なか`
- `ja-E0518` (fill_blank, A1) — prompt `健_____ (Healthy)`, key `康` — refused candidate `康な`
- `ja-E0518` (fill_blank, A1) — prompt `健_____ (Healthy)`, key `康` — refused candidate `やか`
- `ja-E0780` (fill_blank, A2) — prompt `心_____ (Worried)`, key `配` — refused candidate `配している`
- `ja-E0780` (fill_blank, A2) — prompt `心_____ (Worried)`, key `配` — refused candidate `配です`
- `ja-E0780` (fill_blank, A2) — prompt `心_____ (Worried)`, key `配` — refused candidate `配な`
- `ja-E0816` (fill_blank, A2) — prompt `勇_____ (Brave)`, key `敢` — refused candidate `敢な`
- `ja-E0816` (fill_blank, A2) — prompt `勇_____ (Brave)`, key `敢` — refused candidate `ましい`
- `ja-E0996` (fill_blank, A2) — prompt `もっ_____ (Worse)`, key `と悪い` — refused candidate `とわるい`
- `ja-E1008` (fill_blank, A2) — prompt `もっ_____ (Cheaper)`, key `と安い` — refused candidate `とやすい`
- `ja-E1364` (fill_blank, B1) — prompt `遅_____ (Delay)`, key `延` — refused candidate `れ`
- `ja-E1364` (fill_blank, B1) — prompt `遅_____ (Delay)`, key `延` — refused candidate `らせる`
- `ja-E1658` (fill_blank, B1) — prompt `し_____ (I wish)`, key `たい` — refused candidate `たいです`
- `ja-E1798` (fill_blank, B1) — prompt `大_____ (No worries)`, key `丈夫` — refused candidate `丈夫です`
- `ja-E1966` (fill_blank, B2) — prompt `主_____ (Claim)`, key `張` — refused candidate `張する`
- `ja-E2078` (fill_blank, B2) — prompt `比_____ (Metaphor)`, key `喩` — refused candidate `ゆ`
- `ja-E2134` (fill_blank, B2) — prompt `どんで_____ (Plot twist)`, key `ん返し` — refused candidate `んがえし`
- `ko-E0044` (fill_blank, A1) — prompt `아_____ (No)`, key `니요` — refused candidate `니`
- `ko-E0044` (fill_blank, A1) — prompt `아_____ (No)`, key `니요` — refused candidate `닙니다`
- `ko-E0052` (fill_blank, A1) — prompt `죄송_____ (Sorry)`, key `합니다` — refused candidate `해요`
- `ko-E0262` (fill_blank, A1) — prompt `계산_____ (To pay)`, key `하다` — refused candidate `해요`
- `ko-E0262` (fill_blank, A1) — prompt `계산_____ (To pay)`, key `하다` — refused candidate `합니다`
- `ko-E0792` (fill_blank, A2) — prompt `신_____ (Excited)`, key `나는` — refused candidate `난`
- `ko-E0792` (fill_blank, A2) — prompt `신_____ (Excited)`, key `나는` — refused candidate `나요`
- `ko-E0792` (fill_blank, A2) — prompt `신_____ (Excited)`, key `나는` — refused candidate `나`
- `ko-E0804` (fill_blank, A2) — prompt `부끄_____ (Shy)`, key `러운` — refused candidate `럽다`
- `ko-E0804` (fill_blank, A2) — prompt `부끄_____ (Shy)`, key `러운` — refused candidate `러워요`
- `ko-E0876` (fill_blank, A2) — prompt `샀_____ (I bought)`, key `어요` — refused candidate `다`
- `ko-E0876` (fill_blank, A2) — prompt `샀_____ (I bought)`, key `어요` — refused candidate `습니다`
- `ko-E1032` (fill_blank, A2) — prompt `더 키_____ (Taller)`, key `가 크다` — refused candidate `가 큰`
- `ko-E1032` (fill_blank, A2) — prompt `더 키_____ (Taller)`, key `가 크다` — refused candidate `가 커요`
- `ko-E1044` (fill_blank, A2) — prompt `더 키_____ (Shorter)`, key `가 작다` — refused candidate `가 작은`
- `ko-E1044` (fill_blank, A2) — prompt `더 키_____ (Shorter)`, key `가 작다` — refused candidate `가 작아요`
- `ko-E1140` (fill_blank, B1) — prompt `저는 생_____ (I think that)`, key `각합니다` — refused candidate `각해요`
- `ko-E1140` (fill_blank, B1) — prompt `저는 생_____ (I think that)`, key `각합니다` — refused candidate `각한다`
- `ko-E1490` (fill_blank, B1) — prompt `다운로_____ (To download)`, key `드하다` — refused candidate `드해요`
- `ko-E1490` (fill_blank, B1) — prompt `다운로_____ (To download)`, key `드하다` — refused candidate `드합니다`
- `ko-E1504` (fill_blank, B1) — prompt `업로_____ (To upload)`, key `드하다` — refused candidate `드해요`
- `ko-E1504` (fill_blank, B1) — prompt `업로_____ (To upload)`, key `드하다` — refused candidate `드합니다`
- `ko-E1700` (fill_blank, B1) — prompt `가정_____ (Suppose)`, key `하다` — refused candidate `해요`
- `ko-E1700` (fill_blank, B1) — prompt `가정_____ (Suppose)`, key `하다` — refused candidate `합니다`
- `ko-E1700` (fill_blank, B1) — prompt `가정_____ (Suppose)`, key `하다` — refused candidate `해 보세요`

### 6 claim(s) — Plain past against a polite key; register.

- `ja-E0886` (translate_to_target, A2) — prompt `Translate to Japanese: I saw`, key `見ました` — refused candidate `私は見た`
- `ja-E0889` (cloze_deletion, A2) — prompt `Fill in the missing word: _____ means I studied`, key `勉強しました` — refused candidate `勉強した`
- `ja-E0892` (translate_to_target, A2) — prompt `Translate to Japanese: I spoke`, key `話しました` — refused candidate `話した`
- `ja-E0892` (translate_to_target, A2) — prompt `Translate to Japanese: I spoke`, key `話しました` — refused candidate `私は話した`
- `ja-E0898` (translate_to_target, A2) — prompt `Translate to Japanese: I bought`, key `買いました` — refused candidate `買った`
- `ja-E0898` (translate_to_target, A2) — prompt `Translate to Japanese: I bought`, key `買いました` — refused candidate `私は買った`

### 2 claim(s) — Dictionary form against a polite key; register.

- `ja-E0934` (translate_to_target, A2) — prompt `Translate to Japanese: I will go`, key `行きます` — refused candidate `行く`
- `ja-E0970` (translate_to_target, A2) — prompt `Translate to Japanese: I will travel`, key `旅行します` — refused candidate `旅行する`

### 2 claim(s) — Claim is against the stored fragment, not a word. Routed to the fill_blank grader finding.

- `ja-E1266` (fill_blank, B1) — prompt `解雇_____ (To fire)`, key `する` — refused candidate `します`
- `ja-E1504` (fill_blank, B1) — prompt `アップロ_____ (To upload)`, key `ードする` — refused candidate `ードします`

### 2 claim(s) — The prompt is "Fill in the missing word". 저는 + predicate is not one word.

- `ko-E0889` (cloze_deletion, A2) — prompt `Fill in the missing word: _____ means I studied`, key `공부했어요` — refused candidate `저는 공부했어요`
- `ko-E0901` (cloze_deletion, A2) — prompt `Fill in the missing word: _____ means I played`, key `놀았어요` — refused candidate `저는 놀았어요`

### 1 claim(s) — お is an honorific prefix, not part of the word. The row asks for the word that "means Water"; accepting お水 would licence お- on any noun.

- `ja-E0126` (cloze_deletion, A1) — prompt `Fill in the missing word: _____ means Water`, key `水` — refused candidate `お水`

### 1 claim(s) — Plain past against a polite key; register, not a typo.

- `ja-E0886` (translate_to_target, A2) — prompt `Translate to Japanese: I saw`, key `見ました` — refused candidate `見た`

### 1 claim(s) — The prompt is "Fill in the missing word". A subject + particle + predicate is not one word.

- `ja-E0889` (cloze_deletion, A2) — prompt `Fill in the missing word: _____ means I studied`, key `勉強しました` — refused candidate `私は勉強しました`

### 1 claim(s) — Both a register change and more than one word on a missing-word prompt.

- `ja-E0889` (cloze_deletion, A2) — prompt `Fill in the missing word: _____ means I studied`, key `勉強しました` — refused candidate `私は勉強した`

### 1 claim(s) — 学習する is study-as-formal-learning and is a different word from the taught 勉強する; also plain past.

- `ja-E0889` (cloze_deletion, A2) — prompt `Fill in the missing word: _____ means I studied`, key `勉強しました` — refused candidate `学習した`

### 1 claim(s) — しゃべる is to chatter/chat, a register and nuance step away from 話す for "I spoke".

- `ja-E0892` (translate_to_target, A2) — prompt `Translate to Japanese: I spoke`, key `話しました` — refused candidate `しゃべりました`

### 1 claim(s) — Both the しゃべる nuance and a register change.

- `ja-E0892` (translate_to_target, A2) — prompt `Translate to Japanese: I spoke`, key `話しました` — refused candidate `しゃべった`

### 1 claim(s) — "I intend to go" adds a modality the cue "I will go" does not carry.

- `ja-E0934` (translate_to_target, A2) — prompt `Translate to Japanese: I will go`, key `行きます` — refused candidate `行くつもりです`

### 1 claim(s) — Adds an intention modality the cue does not carry.

- `ja-E0970` (translate_to_target, A2) — prompt `Translate to Japanese: I will travel`, key `旅行します` — refused candidate `旅行するつもりです`

### 1 claim(s) — であろう is a literary/archaic variant, wrong register for a B1 conditional lesson.

- `ja-E1642` (translate_to_target, B1) — prompt `Translate to Japanese: Would`, key `だろう` — refused candidate `であろう`

### 1 claim(s) — A full clause on a "Fill in the missing word" prompt.

- `ja-E1645` (cloze_deletion, B1) — prompt `Fill in the missing word: _____ means I wish`, key `したい` — refused candidate `そうならいいのに`

### 1 claim(s) — The key 想像して is the te-form, i.e. the imperative "Imagine". 想像する is the dictionary form and is not an imperative.

- `ja-E1673` (cloze_deletion, B1) — prompt `Fill in the missing word: _____ means Imagine`, key `想像して` — refused candidate `想像する`

### 1 claim(s) — Two words on a missing-word prompt, and a politeness the cue does not request.

- `ja-E1673` (cloze_deletion, B1) — prompt `Fill in the missing word: _____ means Imagine`, key `想像して` — refused candidate `想像してください`

### 1 claim(s) — 운동 is the noun the cue "Exercise" glosses; 운동하다 is the derived verb, a part-of-speech change, not a speech level.

- `ko-E0688` (translate_to_target, A2) — prompt `Translate to Korean: Exercise`, key `운동` — refused candidate `운동하다`

### 1 claim(s) — Same part-of-speech change as 운동하다, plus a register.

- `ko-E0688` (translate_to_target, A2) — prompt `Translate to Korean: Exercise`, key `운동` — refused candidate `운동해요`

### 1 claim(s) — 기침 is the noun "a cough"; 기침하다 is the verb "to cough".

- `ko-E0700` (translate_to_target, A2) — prompt `Translate to Korean: Cough`, key `기침` — refused candidate `기침하다`

### 1 claim(s) — 되다 for 하다 is a lexical swap bundled with a register change; it cannot be granted without settling the register decision, and the lexical half is a separate claim.

- `ko-E1670` (translate_to_target, B1) — prompt `Translate to Korean: Should`, key `해야 한다` — refused candidate `해야 돼요`

### 1 claim(s) — 소망하다 is formal and literary against a neutral "I wish" cue.

- `ko-E1684` (translate_to_target, B1) — prompt `Translate to Korean: I wish`, key `바란다` — refused candidate `소망합니다`

### 1 claim(s) — The hint on this row is rendered (ClozeExercise is the one component that shows hintText) and names the target form: "Its present polite form is 들려요."

- `ko-E2247` (cloze_deletion, B2) — prompt `이 노래는 요즘 라디오에서 자주 ___. (듣다 → passive, present tense)`, key `들려요` — refused candidate `들린다`

### 1 claim(s) — Same: the rendered hint names 들려요 as the form wanted.

- `ko-E2247` (cloze_deletion, B2) — prompt `이 노래는 요즘 라디오에서 자주 ___. (듣다 → passive, present tense)`, key `들려요` — refused candidate `들립니다`

### 1 claim(s) — Plain style to 부모님 contradicts the honorific frame this lesson is about; here register IS the taught content.

- `ko-E2275` (cloze_deletion, B2) — prompt `어제 부모님께 생신 선물을 ___. (주다 → humble, past tense)`, key `드렸어요` — refused candidate `드렸다`

