/** Japanese `accepted_answers` additions: rows where the stored key is right, the
 * learner's alternative is right too, and the real grader rejects it.
 *
 * Second version, after independent review (`remediation/ja-alternatives-root-review/`).
 * The first version patched 460 rows with 844 additions; the review approved 413 rows and
 * returned 47. It is now 428 rows with 762 additions.
 *
 * WHAT THE REVIEW CAUGHT, and the rule each fix rests on. `gradeAnswer` measures typo
 * distance against whichever accepted answer is NEAREST the learner's input, so every
 * addition carries a ball of radius min(2, floor(min(len(addition), len(key)) * 0.3)) and
 * silently admits whatever is already inside it. The first version opened 8 readmissions
 * inside `scripts/question-audit/readmission.test.mjs` and 79 in the wider scope, 29 of
 * them meaning flips: "More expensive" accepting より安い, "Grandmother" accepting Grandpa,
 * "To hire" accepting Fire, and the three 私は past-tense rows accepting each other's verbs.
 * A confusable pair written against the row's KEY is inert here, because the pair list is
 * consulted against the matched alternative, so `lib/confusable-pairs.ts` already declaring
 * the whole もっと+adjective set changed nothing. The rules now applied:
 *
 *   - INSIDE THE TYPO BALL OF SOMETHING THE UNIT TEACHES AS A DIFFERENT ITEM. An addition is
 *     withdrawn when a sibling key, a sibling addition, or a string this batch itself
 *     withdraws in the same unit sits within min(2, floor(min(len(addition), len(key)) * 0.3))
 *     edits of it. The metric is the grader's budget, not "minimal pair" — the first revision
 *     said minimal pair, which does not reach Granddad/Grandma at two edits and different
 *     lengths, although the practice already covered Old man/Old woman at that distance. That
 *     removes the whole より+adjective family, もっと短い, もっと速く / もっと遅く,
 *     最も良い / 最も悪い, Hire / Fire and the informal grandparent glosses. These are correct
 *     answers; the remedy is a confusable pair keyed on the ADDED string, and the pairs that
 *     would restore them are in the evidence file for the owner of that list.
 *   - THE OVERT PRONOUN IS WITHDRAWN. 私は + the keyed form is correct Japanese, but it lands
 *     on seven `cloze_deletion` rows that ask for one missing word, and the three past-tense
 *     forms are mutually one edit apart. Withdrawn uniformly rather than on the colliding
 *     rows only, so sibling rows do not disagree.
 *   - REGISTER, MADE UNIFORM. The batch refuses 55 candidates for swapping politeness and the
 *     reconciliation holds おはようございます -> おはよう on that ground; ごめん for すみません,
 *     うん for はい, ううん for いいえ and the ちゃん forms of さん kinship terms are the same
 *     move and are now refused too.
 *   - SELF-CONTRADICTIONS REMOVED. "Holidays" readmitted the "Holiday" this batch refuses;
 *     すべきだ readmitted the べき it refuses as a bound fragment; とびら granted a second
 *     orthography of an added lexeme while 350 rows wait on the script question.
 *   - THE PERSON GROUND HARMONISED. Every `person` row now carries all five persons; seven
 *     rows previously carried She/You/They while two carried all five.
 *
 * Input was the 552 Japanese `unpatched_accepted_answer_omission` proposals in
 * `lexical-defect-proposals-2026-09-14.json`, 1,163 alternatives. Counted against those
 * 1,163: 738 accepted, 323 refused, 102 withdrawn to the open `JA-KANA-KANJI-SCRIPT` question.
 * 24 further additions are harmonisations no proposal named on that row — taken from a
 * sibling row sharing the gloss and key, or added on review so every person row carries
 * all five persons. Every refusal and
 * withdrawal and its ground is in `japanese-accepted-alternatives-evidence.json`.
 *
 * Script variation is the dominant class here and is NOT decided by this batch. A candidate
 * that renders the same lexeme in another orthography — kana for a kanji spelling or the
 * reverse, the other kana, a variant kanji, okurigana moved — is withdrawn rather than
 * granted. Granting them one row at a time would settle a course-wide grading policy through
 * the rows a lexical sweep happened to surface, and would accept 犬 -> イヌ here while
 * 犬 -> いぬ stays rejected in the 371 rows already held for that decision.
 *
 * Politeness is decided the other way, and against the candidates: the course encodes
 * register in the English gloss ("To cook" keys 料理する, "I will study" keys 勉強します,
 * "I studied" keys 勉強しました) and the A2 units carrying these rows are named for the form
 * being drilled ("Past Tense Basics", "Future Plans").
 *
 * Sibling rows are decided together: every row sharing an English gloss and a stored key
 * carries the same additions. Dictation and listening_type rows are out of scope entirely:
 * they ask the learner to type what they heard, so a synonym is not an answer and the
 * spellings that would be are the held script question.
 *
 * Only `accepted_answers` is touched, and only by appending: each row guards its key, type,
 * level, lesson and the exact accepted list it started from, so a concurrent edit to any of
 * them fails the build instead of being overwritten. None of these rows carries `options`,
 * so no distractor can be turned correct here.
 *
 * Authored, then revised against one independent review. The revisions have not themselves
 * been reviewed.
 */
import { lessonRefs } from './lesson-refs.mjs';

/** Why each row's additions are licensed. A row may carry more than one. */
const GROUNDS = {
  lexical: 'an ordinary Japanese equivalent of the stored key, with nothing in the bare prompt narrowing the sense',
  english: 'an ordinary English rendering of the same sense, and the prompt supplies no context that selects the keyed wording',
  kinship: 'Japanese kinship, in-group and beautified vocabulary comes in own-side, other-side and honorific pairs, and a bare English gloss selects none of them',
  completion: 'the visible stem admits this completion as well as the keyed one, and the prompt selects neither',
  person: 'a subjectless Japanese predicate does not specify person, and the prompt names no subject',
  idiom: 'a standard equivalent of the same figurative meaning; the learner is asked to translate the idiom, not to reproduce one fixed form',
};

/** [frozen ref number, type, level/lesson, stored key, current accepted_answers, additions, grounds, sources?] */
export const japaneseAlternativeRows = [
  [2, "translate_to_target", "A1/Core Vocabulary", "さようなら", [], ["またね", "じゃあね", "失礼します"], ["lexical"]],
  [7, "translate_to_native", "A1/Core Vocabulary", "Thank you", [], ["Thanks", "Thank you very much"], ["english"]],
  [18, "translate_to_target", "A1/Phrases & Sentences", "ありがとうございます", [], ["どうもありがとう"], ["lexical"]],
  [19, "translate_to_native", "A1/Phrases & Sentences", "Sorry", ["Excuse me"], ["I’m sorry"], ["english"]],
  [30, "translate_to_target", "A1/Listening & Recognition", "すみません", [], ["ごめんなさい", "申し訳ありません", "申し訳ございません"], ["lexical"]],
  [31, "translate_to_native", "A1/Listening & Recognition", "Excuse me", ["Sorry"], ["I’m sorry"], ["english"]],
  [40, "fill_blank", "A1/Speaking Practice", "ございます", [], ["ございました"], ["completion"]],
  [42, "translate_to_target", "A1/Speaking Practice", "すみません", [], ["失礼します", "ちょっと失礼"], ["lexical"]],
  [50, "translate_to_target", "A1/Reading Simple Texts", "お願いします", [], ["どうぞ"], ["lexical"]],
  [51, "translate_to_native", "A1/Reading Simple Texts", "Thank you", [], ["Thanks", "Thank you very much"], ["english"]],
  [54, "translate_to_target", "A1/Reading Simple Texts", "はい", [], ["ええ"], ["lexical"]],
  [62, "translate_to_target", "A1/Review & Test", "ありがとうございます", [], ["どうもありがとう"], ["lexical"]],
  [63, "translate_to_native", "A1/Review & Test", "Sorry", ["Excuse me"], ["I’m sorry"], ["english"]],
  [66, "translate_to_target", "A1/Review & Test", "いいえ", [], ["いや"], ["lexical"]],
  [67, "translate_to_native", "A1/Review & Test", "Hello", [], ["Good afternoon", "Hi"], ["english"]],
  [68, "fill_blank", "A1/Review & Test", "うなら", [], ["なら"], ["completion"]],
  [72, "translate_to_target", "A1/Restaurant Basics", "鶏肉", [], ["チキン"], ["lexical"]],
  [89, "translate_to_native", "A1/Common Foods", "Rice", [], ["Cooked rice", "Meal"], ["english"]],
  [97, "translate_to_native", "A1/Drinks & Beverages", "Milk", [], ["Cow’s milk"], ["english"]],
  [100, "translate_to_target", "A1/Drinks & Beverages", "ご飯", [], ["米", "お米"], ["lexical"]],
  [108, "translate_to_target", "A1/Describing Taste", "牛乳", [], ["ミルク"], ["lexical"]],
  [113, "translate_to_native", "A1/Describing Taste", "Delicious", [], ["Tasty", "Yummy"], ["english"]],
  [124, "translate_to_target", "A1/Full Meal Order", "おいしい", [], ["うまい"], ["lexical"]],
  [133, "translate_to_native", "A1/Review & Test", "Rice", [], ["Cooked rice", "Meal"], ["english"]],
  [136, "translate_to_target", "A1/Review & Test", "メニュー", [], ["献立", "お品書き", "品書き"], ["lexical"]],
  [143, "translate_to_native", "A1/Asking Directions", "Straight", [], ["Straight ahead", "Directly"], ["english"]],
  [146, "translate_to_target", "A1/Asking Directions", "切符", [], ["チケット", "乗車券"], ["lexical"]],
  [147, "translate_to_native", "A1/Asking Directions", "Station", [], ["Train station", "Railway station"], ["english"]],
  [167, "translate_to_native", "A1/Places in Town", "Train", [], ["Electric train"], ["english"]],
  [178, "translate_to_target", "A1/Buying Tickets", "電車", [], ["列車"], ["lexical"]],
  [183, "translate_to_native", "A1/Buying Tickets", "Pharmacy", [], ["Drugstore", "Chemist’s"], ["english"]],
  [190, "translate_to_target", "A1/At the Airport", "切符", [], ["チケット", "乗車券"], ["lexical"]],
  [191, "translate_to_native", "A1/At the Airport", "Station", [], ["Train station", "Railway station"], ["english"]],
  [212, "translate_to_target", "A1/Daily Routine", "高い", [], ["高価", "高価な"], ["lexical"]],
  [213, "translate_to_native", "A1/Daily Routine", "Cheap", [], ["Inexpensive", "Low-priced"], ["english"]],
  [224, "translate_to_target", "A1/Shopping Basics", "安い", [], ["安価", "安価な"], ["lexical"]],
  [229, "translate_to_native", "A1/Shopping Basics", "To pay", [], ["Pay", "To settle"], ["english"]],
  [240, "translate_to_target", "A1/Clothes & Colors", "払う", [], ["支払う"], ["lexical"]],
  [248, "translate_to_target", "A1/Time & Schedule", "青い", [], ["ブルー"], ["lexical"]],
  [252, "translate_to_target", "A1/Time & Schedule", "時間", [], ["時刻"], ["lexical"]],
  [266, "fill_blank", "A1/At the Market", "ご飯", [], ["食"], ["completion"]],
  [273, "translate_to_native", "A1/Review & Test", "To pay", [], ["Pay", "To settle"], ["english"]],
  [282, "translate_to_target", "A1/Jobs & Professions", "医者", [], ["医師", "お医者さん"], ["kinship", "lexical"]],
  [294, "translate_to_target", "A1/Making Plans", "事務所", [], ["オフィス"], ["lexical"]],
  [295, "translate_to_native", "A1/Making Plans", "To read", [], ["Read"], ["english"]],
  [296, "fill_blank", "A1/Making Plans", "する", [], ["をする"], ["completion"]],
  [307, "translate_to_native", "A1/Hobbies & Interests", "To cook", [], ["Cook"], ["english"]],
  [335, "translate_to_native", "A1/Weekend Activities", "Friend", [], ["Pal", "Buddy"], ["english"]],
  [343, "translate_to_native", "A1/Review & Test", "Cold", [], ["Chilly"], ["english"]],
  [346, "translate_to_target", "A1/Review & Test", "友達", [], ["友人"], ["lexical"]],
  [347, "translate_to_native", "A1/Review & Test", "Teacher", [], ["Instructor"], ["english"]],
  [348, "fill_blank", "A1/Review & Test", "者", [], ["師"], ["completion"]],
  [352, "translate_to_target", "A1/Family Members", "父", [], ["お父さん", "父親"], ["kinship"]],
  [356, "translate_to_target", "A1/Family Members", "息子", [], ["ご子息"], ["kinship"]],
  [357, "translate_to_native", "A1/Family Members", "Grandmother", [], ["Granny"], ["kinship"]],
  [364, "translate_to_target", "A1/Describing People", "姉妹", [], ["姉", "妹", "お姉さん"], ["kinship", "lexical"]],
  [365, "translate_to_native", "A1/Describing People", "Brother", [], ["Siblings"], ["english"]],
  [366, "cloze_deletion", "A1/Describing People", "娘", [], ["お嬢さん"], ["kinship"]],
  [368, "translate_to_target", "A1/Describing People", "おばあさん", [], ["祖母"], ["kinship", "lexical"]],
  [380, "translate_to_target", "A1/Ages & Birthdays", "おじいさん", [], ["祖父"], ["kinship", "lexical"]],
  [388, "translate_to_target", "A1/Pets & Animals", "娘", [], ["お嬢さん"], ["kinship"]],
  [400, "translate_to_target", "A1/Family Activities", "息子", [], ["ご子息"], ["kinship"]],
  [401, "translate_to_native", "A1/Family Activities", "Grandmother", [], ["Granny"], ["kinship"]],
  [406, "cloze_deletion", "A1/Family Activities", "母", [], ["お母さん", "母親"], ["kinship"]],
  [412, "translate_to_target", "A1/Review & Test", "おばあさん", [], ["祖母"], ["kinship", "lexical"]],
  [418, "cloze_deletion", "A1/Review & Test", "父", [], ["父親", "お父さん"], ["kinship"]],
  [422, "translate_to_target", "A1/Parts of the House", "部屋", [], ["ルーム"], ["lexical"]],
  [426, "translate_to_target", "A1/Parts of the House", "ドア", [], ["戸", "扉"], ["lexical"]],
  [434, "translate_to_target", "A1/Furniture", "台所", [], ["キッチン"], ["lexical"]],
  [458, "translate_to_target", "A1/Bathroom & Bedroom", "寝室", [], ["ベッドルーム"], ["lexical"]],
  [464, "cloze_deletion", "A1/Bathroom & Bedroom", "庭", [], ["庭園"], ["lexical"]],
  [470, "translate_to_target", "A1/Describing Your Home", "ドア", [], ["戸", "扉"], ["lexical"]],
  [474, "translate_to_target", "A1/Describing Your Home", "ベッド", [], ["寝台"], ["lexical"]],
  [475, "translate_to_native", "A1/Describing Your Home", "Garden", [], ["Yard"], ["english"]],
  [476, "cloze_deletion", "A1/Describing Your Home", "家", [], ["住宅"], ["lexical"]],
  [486, "translate_to_target", "A1/Review & Test", "庭", [], ["庭園"], ["lexical"]],
  [487, "translate_to_native", "A1/Review & Test", "House", [], ["Home"], ["english"]],
  [493, "translate_to_native", "A1/Body Parts", "Eye", [], ["Eyes"], ["english"]],
  [496, "translate_to_target", "A1/Body Parts", "健康", [], ["元気", "健やか"], ["lexical"]],
  [497, "translate_to_native", "A1/Body Parts", "Medicine", [], ["Medication", "Drug", "Remedy"], ["english"]],
  [505, "translate_to_native", "A1/Feelings & Symptoms", "Stomach", [], ["Belly", "Tummy", "Abdomen"], ["english"]],
  [508, "translate_to_target", "A1/Feelings & Symptoms", "薬", [], ["医薬品"], ["lexical"]],
  [509, "translate_to_native", "A1/Feelings & Symptoms", "Pain", [], ["Ache"], ["english"]],
  [510, "cloze_deletion", "A1/Feelings & Symptoms", "熱", [], ["発熱"], ["lexical"]],
  [516, "translate_to_target", "A1/At the Doctor", "お腹", [], ["腹"], ["lexical"]],
  [517, "translate_to_native", "A1/At the Doctor", "Sick", [], ["Ill", "Illness"], ["english"]],
  [520, "translate_to_target", "A1/At the Doctor", "痛み", [], ["苦痛"], ["lexical"]],
  [521, "translate_to_native", "A1/At the Doctor", "Fever", [], ["Temperature"], ["english"]],
  [528, "translate_to_target", "A1/At the Pharmacy", "病気", [], ["具合が悪い", "気分が悪い", "体調が悪い"], ["lexical"]],
  [529, "translate_to_native", "A1/At the Pharmacy", "Healthy", [], ["Well"], ["english"]],
  [532, "translate_to_target", "A1/At the Pharmacy", "熱", [], ["発熱"], ["lexical"]],
  [533, "translate_to_native", "A1/At the Pharmacy", "Arm", [], ["Arms"], ["english"]],
  [534, "cloze_deletion", "A1/At the Pharmacy", "足", [], ["脚"], ["lexical"]],
  [540, "translate_to_target", "A1/Healthy Habits", "健康", [], ["元気", "健やか"], ["lexical"]],
  [541, "translate_to_native", "A1/Healthy Habits", "Medicine", [], ["Medication", "Drug", "Remedy"], ["english"]],
  [545, "translate_to_native", "A1/Healthy Habits", "Leg", ["Foot"], ["Feet", "Legs"], ["english"]],
  [552, "translate_to_target", "A1/Review & Test", "薬", [], ["医薬品"], ["lexical"]],
  [553, "translate_to_native", "A1/Review & Test", "Pain", [], ["Ache"], ["english"]],
  [556, "translate_to_target", "A1/Review & Test", "足", [], ["脚"], ["lexical"]],
  [562, "translate_to_target", "A2/Extended Family", "おばさん", [], ["叔母", "伯母", "おば"], ["kinship", "lexical"]],
  [568, "translate_to_target", "A2/Extended Family", "彼氏", [], ["ボーイフレンド", "恋人"], ["lexical"]],
  [577, "cloze_deletion", "A2/Describing Relationships", "夫", [], ["主人", "旦那", "ご主人"], ["kinship"]],
  [580, "translate_to_target", "A2/Describing Relationships", "彼女", [], ["ガールフレンド", "恋人"], ["lexical"]],
  [588, "cloze_deletion", "A2/Talking About Ages", "夫", [], ["主人", "旦那", "ご主人"], ["kinship"]],
  [589, "cloze_deletion", "A2/Talking About Ages", "妻", [], ["奥さん", "家内", "女房"], ["kinship"]],
  [592, "translate_to_target", "A2/Talking About Ages", "隣人", [], ["近所の人", "お隣さん"], ["kinship", "lexical"]],
  [600, "cloze_deletion", "A2/Life Events", "妻", [], ["奥さん", "家内", "女房"], ["kinship"]],
  [601, "cloze_deletion", "A2/Life Events", "彼氏", [], ["ボーイフレンド", "恋人"], ["lexical"]],
  [604, "translate_to_target", "A2/Life Events", "結婚式", [], ["婚礼", "挙式", "ウェディング", "ウエディング"], ["lexical"]],
  [610, "translate_to_target", "A2/Family Traditions", "夫", [], ["主人", "旦那", "ご主人"], ["kinship"]],
  [613, "cloze_deletion", "A2/Family Traditions", "彼女", [], ["ガールフレンド", "恋人"], ["lexical"]],
  [616, "translate_to_target", "A2/Family Traditions", "結婚している", [], ["既婚"], ["lexical"]],
  [622, "translate_to_target", "A2/Review & Test", "妻", [], ["奥さん", "家内", "女房"], ["kinship"]],
  [625, "cloze_deletion", "A2/Review & Test", "隣人", [], ["近所の人", "お隣さん"], ["kinship", "lexical"]],
  [628, "translate_to_target", "A2/Review & Test", "おじさん", [], ["叔父", "伯父", "おじ"], ["kinship", "lexical"]],
  [634, "translate_to_target", "A2/Common Symptoms", "頭痛", [], ["頭の痛み"], ["lexical"]],
  [636, "fill_blank", "A2/Common Symptoms", "方箋", [], ["方"], ["completion"]],
  [637, "cloze_deletion", "A2/Common Symptoms", "予約", [], ["アポイント", "アポイントメント"], ["lexical"]],
  [640, "translate_to_target", "A2/Common Symptoms", "ストレス", [], ["精神的負担"], ["lexical"]],
  [649, "cloze_deletion", "A2/At the Doctor Office", "看護師", [], ["ナース"], ["lexical"]],
  [658, "translate_to_target", "A2/At the Pharmacy", "処方箋", [], ["処方"], ["lexical"]],
  [659, "translate_to_native", "A2/At the Pharmacy", "Appointment", ["Reservation"], ["Booking"], ["english"]],
  [661, "cloze_deletion", "A2/At the Pharmacy", "歯医者", [], ["歯科医", "歯科医師"], ["lexical"]],
  [664, "translate_to_target", "A2/At the Pharmacy", "休む", [], ["休息する", "休憩する"], ["lexical"]],
  [670, "translate_to_target", "A2/Mental Health", "予約", [], ["アポイント", "アポイントメント"], ["lexical"]],
  [672, "fill_blank", "A2/Mental Health", "医者", [], ["科医", "科医師"], ["completion"]],
  [682, "translate_to_target", "A2/Healthy Lifestyle", "看護師", [], ["ナース"], ["lexical"]],
  [688, "translate_to_target", "A2/Healthy Lifestyle", "運動", [], ["体操", "エクササイズ"], ["lexical"]],
  [694, "translate_to_target", "A2/Review & Test", "歯医者", [], ["歯科医", "歯科医師"], ["lexical"]],
  [695, "translate_to_native", "A2/Review & Test", "Stress", [], ["Strain"], ["english"]],
  [697, "cloze_deletion", "A2/Review & Test", "休む", [], ["休息する", "休憩する"], ["lexical"]],
  [706, "translate_to_target", "A2/Rooms & Furniture", "棚", [], ["シェルフ"], ["lexical"]],
  [709, "cloze_deletion", "A2/Rooms & Furniture", "掃除する", [], ["掃除をする", "清掃する"], ["lexical"]],
  [719, "translate_to_native", "A2/Household Chores", "Carpet", [], ["Carpeting"], ["english"]],
  [720, "fill_blank", "A2/Household Chores", "する", [], ["をする"], ["completion"]],
  [721, "cloze_deletion", "A2/Household Chores", "洗う", [], ["洗濯する"], ["lexical"]],
  [724, "translate_to_target", "A2/Household Chores", "家賃", [], ["賃料"], ["lexical"]],
  [730, "translate_to_target", "A2/Moving & Housing", "カーペット", [], ["絨毯"], ["lexical"]],
  [731, "translate_to_native", "A2/Moving & Housing", "To clean", [], ["Clean", "To tidy up"], ["english"]],
  [736, "translate_to_target", "A2/Moving & Housing", "引っ越す", [], ["引っ越しする", "引越しする", "移る"], ["lexical"]],
  [742, "translate_to_target", "A2/Neighbors & Community", "掃除する", [], ["清掃する", "掃除をする"], ["lexical"]],
  [743, "translate_to_native", "A2/Neighbors & Community", "To wash", [], ["Wash"], ["english"]],
  [745, "cloze_deletion", "A2/Neighbors & Community", "料理する", [], ["料理をする", "調理する"], ["lexical"]],
  [754, "translate_to_target", "A2/Home Problems", "洗う", [], ["洗濯する"], ["lexical"]],
  [755, "translate_to_native", "A2/Home Problems", "To sweep", [], ["Sweep"], ["english"]],
  [756, "fill_blank", "A2/Home Problems", "する", [], ["をする"], ["completion"]],
  [757, "cloze_deletion", "A2/Home Problems", "家賃", [], ["賃料"], ["lexical"]],
  [760, "translate_to_target", "A2/Home Problems", "バルコニー", [], ["ベランダ"], ["lexical"]],
  [767, "translate_to_native", "A2/Review & Test", "To cook", [], ["Cook"], ["english"]],
  [769, "cloze_deletion", "A2/Review & Test", "引っ越す", [], ["引っ越しする", "引越しする", "移る"], ["lexical"]],
  [772, "translate_to_target", "A2/Review & Test", "ソファ", [], ["長椅子", "カウチ"], ["lexical"]],
  [779, "translate_to_native", "A2/Positive Emotions", "Angry", [], ["Mad", "Is angry"], ["english"]],
  [781, "cloze_deletion", "A2/Positive Emotions", "ワクワクする", [], ["興奮している", "興奮した"], ["lexical"]],
  [784, "translate_to_target", "A2/Positive Emotions", "優しい", [], ["親切", "親切な"], ["lexical"]],
  [790, "translate_to_target", "A2/Negative Emotions", "怒っている", [], ["腹が立っている"], ["lexical"]],
  [791, "translate_to_native", "A2/Negative Emotions", "Worried", [], ["Worry", "Concern"], ["english"]],
  [796, "translate_to_target", "A2/Negative Emotions", "寛大", [], ["気前がいい", "気前のよい"], ["lexical"]],
  [802, "translate_to_target", "A2/Personality Traits", "心配", [], ["気がかり", "不安な"], ["lexical"]],
  [803, "translate_to_native", "A2/Personality Traits", "Excited", [], ["To be excited", "To feel excited"], ["english"]],
  [805, "cloze_deletion", "A2/Personality Traits", "勇敢", [], ["勇気がある", "勇ましい"], ["lexical"]],
  [808, "translate_to_target", "A2/Personality Traits", "怠ける", [], ["怠惰な", "ものぐさな"], ["lexical"]],
  [814, "translate_to_target", "A2/Describing Character", "ワクワクする", [], ["興奮している", "興奮した"], ["lexical"]],
  [815, "translate_to_native", "A2/Describing Character", "Embarrassed", ["Ashamed"], ["Embarrassing", "Self-conscious"], ["english"]],
  [817, "cloze_deletion", "A2/Describing Character", "優しい", [], ["親切", "親切な"], ["lexical"]],
  [820, "translate_to_target", "A2/Describing Character", "忍耐強い", [], ["辛抱強い", "我慢強い"], ["lexical"]],
  [827, "translate_to_native", "A2/Emotional Reactions", "Brave", [], ["Courageous", "Valiant"], ["english"]],
  [829, "cloze_deletion", "A2/Emotional Reactions", "寛大", [], ["気前がいい", "気前のよい"], ["lexical"]],
  [832, "translate_to_target", "A2/Emotional Reactions", "誇りに思う", [], ["誇らしい"], ["lexical"]],
  [838, "translate_to_target", "A2/Review & Test", "勇敢", [], ["勇気がある", "勇ましい"], ["lexical"]],
  [839, "translate_to_native", "A2/Review & Test", "Kind", [], ["Gentle", "Tender", "Nice"], ["english"]],
  [840, "fill_blank", "A2/Review & Test", "大", [], ["容", "容な"], ["completion"]],
  [841, "cloze_deletion", "A2/Review & Test", "怠ける", [], ["怠惰な", "ものぐさな"], ["lexical"]],
  [844, "translate_to_target", "A2/Review & Test", "嬉しい", [], ["幸せ", "幸福な"], ["lexical"]],
  [851, "translate_to_native", "A2/What Happened Yesterday", "I went", [], ["He went", "She went", "You went", "We went", "They went"], ["person"]],
  [863, "translate_to_native", "A2/Last Weekend", "I ate", [], ["He ate", "She ate", "You ate", "We ate", "They ate"], ["person"]],
  [875, "translate_to_native", "A2/A Memorable Trip", "I saw", [], ["I watched"], ["english"]],
  [880, "translate_to_target", "A2/A Memorable Trip", "働きました", [], ["仕事をしました"], ["lexical"]],
  [887, "translate_to_native", "A2/Childhood Memories", "I bought", [], ["He bought", "She bought", "You bought", "We bought", "They bought"], ["person"]],
  [899, "translate_to_native", "A2/Recent News", "I traveled", [], ["I took a trip"], ["english"]],
  [911, "translate_to_native", "A2/Review & Test", "I studied", [], ["He studied", "She studied", "You studied", "We studied", "They studied"], ["person"]],
  [913, "cloze_deletion", "A2/Review & Test", "働きました", [], ["仕事をしました"], ["lexical"]],
  [923, "translate_to_native", "A2/Plans for Tomorrow", "I will go", [], ["I’ll go", "He will go", "She will go", "You will go", "We will go", "They will go"], ["english", "person"]],
  [928, "translate_to_target", "A2/Plans for Tomorrow", "休み", [], ["休暇", "バケーション"], ["lexical"]],
  [935, "translate_to_native", "A2/Next Vacation", "I will eat", [], ["I’ll eat", "He will eat", "She will eat", "You will eat", "We will eat", "They will eat"], ["english", "person"]],
  [936, "fill_blank", "A2/Next Vacation", "します", [], ["をします"], ["completion"]],
  [940, "translate_to_target", "A2/Next Vacation", "目標", [], ["ゴール"], ["lexical"]],
  [947, "translate_to_native", "A2/Life Goals", "I will study", [], ["I’ll study", "He will study", "She will study", "You will study", "We will study", "They will study"], ["english", "person"]],
  [948, "fill_blank", "A2/Life Goals", "します", [], ["をします"], ["completion"]],
  [949, "cloze_deletion", "A2/Life Goals", "働きます", [], ["仕事をします"], ["lexical"]],
  [959, "translate_to_native", "A2/Making Appointments", "I will travel", [], ["I’ll travel", "He will travel", "She will travel", "You will travel", "We will travel", "They will travel"], ["english", "person"]],
  [961, "cloze_deletion", "A2/Making Appointments", "休み", [], ["休暇", "バケーション"], ["lexical"]],
  [964, "translate_to_target", "A2/Making Appointments", "計画する", [], ["計画を立てる", "予定する", "プランを立てる"], ["lexical"]],
  [971, "translate_to_native", "A2/Predictions", "I will work", [], ["I’ll work", "He will work", "She will work", "You will work", "We will work", "They will work"], ["english", "person"]],
  [972, "fill_blank", "A2/Predictions", "み", [], ["暇"], ["completion"]],
  [973, "cloze_deletion", "A2/Predictions", "目標", [], ["ゴール"], ["lexical"]],
  [976, "translate_to_target", "A2/Predictions", "予約", [], ["アポイントメント", "アポイント"], ["lexical"]],
  [982, "translate_to_target", "A2/Review & Test", "働きます", [], ["仕事をします"], ["lexical"]],
  [983, "translate_to_native", "A2/Review & Test", "Vacation", [], ["Break", "Day off", "Time off"], ["english"]],
  [1009, "cloze_deletion", "A2/Comparing People", "もっと高い", [], ["もっと高価"], ["lexical"]],
  [1024, "translate_to_target", "A2/Superlatives", "もっと遅い", [], ["もっとゆっくり", "よりゆっくり"], ["lexical"]],
  [1031, "translate_to_native", "A2/Prices & Quality", "More expensive", [], ["Higher", "Costlier"], ["english"]],
  [1036, "translate_to_target", "A2/Prices & Quality", "一番良い", [], ["最高", "最良", "ベスト"], ["lexical"]],
  [1042, "translate_to_target", "A2/Preferences", "もっと高い", [], ["もっと高価"], ["lexical"]],
  [1044, "fill_blank", "A2/Preferences", "背が低い", [], ["短い"], ["completion"]],
  [1048, "translate_to_target", "A2/Preferences", "一番悪い", [], ["最悪"], ["lexical"]],
  [1056, "fill_blank", "A2/Review & Test", "と速い", [], ["と速く"], ["completion"]],
  [1057, "cloze_deletion", "A2/Review & Test", "もっと遅い", [], ["もっとゆっくり", "よりゆっくり"], ["lexical"]],
  [1067, "translate_to_native", "A2/National Holidays", "New Year", [], ["New Year’s Day", "New Year holiday"], ["english"]],
  [1069, "cloze_deletion", "A2/National Holidays", "伝統", [], ["慣習"], ["lexical"]],
  [1072, "translate_to_target", "A2/National Holidays", "お祝いする", [], ["祝う"], ["lexical"]],
  [1078, "translate_to_target", "A2/Food Traditions", "お正月", [], ["新年"], ["lexical"]],
  [1081, "cloze_deletion", "A2/Food Traditions", "プレゼント", [], ["贈り物", "贈物", "ギフト"], ["lexical"]],
  [1090, "translate_to_target", "A2/Music & Dance", "誕生日", [], ["バースデー"], ["lexical"]],
  [1091, "translate_to_native", "A2/Music & Dance", "Tradition", [], ["Custom"], ["english"]],
  [1093, "cloze_deletion", "A2/Music & Dance", "パーティー", [], ["宴会"], ["lexical"]],
  [1096, "translate_to_target", "A2/Music & Dance", "ダンス", [], ["踊り", "舞踊"], ["lexical"]],
  [1102, "translate_to_target", "A2/Festivals", "伝統", [], ["慣習"], ["lexical"]],
  [1103, "translate_to_native", "A2/Festivals", "Gift", [], ["Present"], ["english"]],
  [1105, "cloze_deletion", "A2/Festivals", "お祝いする", [], ["祝う"], ["lexical"]],
  [1108, "translate_to_target", "A2/Festivals", "お祭り", [], ["祭り", "フェスティバル", "祭典"], ["kinship", "lexical"]],
  [1114, "translate_to_target", "A2/Gift Giving", "プレゼント", [], ["贈り物", "贈物", "ギフト"], ["lexical"]],
  [1116, "fill_blank", "A2/Gift Giving", "いする", [], ["いをする"], ["completion"]],
  [1117, "cloze_deletion", "A2/Gift Giving", "音楽", [], ["ミュージック"], ["lexical"]],
  [1120, "translate_to_target", "A2/Gift Giving", "コスチューム", [], ["衣装", "衣裳", "仮装", "服装"], ["lexical"]],
  [1127, "translate_to_native", "A2/Review & Test", "To celebrate", [], ["Celebrate", "To congratulate", "Congratulate"], ["english"]],
  [1129, "cloze_deletion", "A2/Review & Test", "ダンス", [], ["踊り", "舞踊"], ["lexical"]],
  [1138, "translate_to_target", "B1/Expressing Opinions", "賛成です", [], ["同意します"], ["lexical"]],
  [1139, "translate_to_native", "B1/Expressing Opinions", "I disagree", [], ["I oppose it", "I am against it", "I’m against it"], ["english"]],
  [1140, "fill_blank", "B1/Expressing Opinions", "思います", [], ["考えます"], ["completion"]],
  [1141, "cloze_deletion", "B1/Expressing Opinions", "ニュース", [], ["報道"], ["lexical"]],
  [1152, "translate_to_target", "B1/Agreeing & Disagreeing", "反対です", [], ["同意しません"], ["lexical"]],
  [1153, "translate_to_native", "B1/Agreeing & Disagreeing", "I think that", [], ["This is what I think", "I think so"], ["english"]],
  [1166, "translate_to_target", "B1/Current Events", "私はこう思います", [], ["こう思う", "そう思います"], ["lexical"]],
  [1197, "cloze_deletion", "B1/Giving Reasons", "議論する", [], ["論じる", "議論をする"], ["lexical"]],
  [1210, "fill_blank", "B1/Review & Test", "する", [], ["をする"], ["completion"]],
  [1211, "cloze_deletion", "B1/Review & Test", "討論", [], ["ディベート", "討議"], ["lexical"]],
  [1222, "translate_to_target", "B1/Job Interviews", "履歴書", [], ["レジュメ"], ["lexical"]],
  [1223, "translate_to_native", "B1/Job Interviews", "Meeting", [], ["Conference"], ["english"]],
  [1224, "fill_blank", "B1/Job Interviews", "ゼン", [], ["ゼンテーション"], ["completion"]],
  [1225, "cloze_deletion", "B1/Job Interviews", "給料", [], ["給与", "サラリー", "俸給"], ["lexical"]],
  [1236, "translate_to_target", "B1/Office Communication", "会議", [], ["ミーティング", "打ち合わせ", "打合せ"], ["lexical"]],
  [1238, "fill_blank", "B1/Office Communication", "料", [], ["与"], ["completion"]],
  [1239, "cloze_deletion", "B1/Office Communication", "雇う", [], ["採用する", "雇用する"], ["lexical"]],
  [1250, "translate_to_target", "B1/Meetings", "プレゼン", [], ["プレゼンテーション", "発表"], ["lexical"]],
  [1251, "translate_to_native", "B1/Meetings", "Salary", [], ["Pay", "Wages"], ["english"]],
  [1253, "cloze_deletion", "B1/Meetings", "解雇する", [], ["クビにする"], ["lexical"]],
  [1264, "translate_to_target", "B1/Career Goals", "給料", [], ["給与", "サラリー", "俸給"], ["lexical"]],
  [1265, "translate_to_native", "B1/Career Goals", "To hire", [], ["To employ", "Employ"], ["english"]],
  [1278, "translate_to_target", "B1/Work Problems", "雇う", [], ["採用する", "雇用する"], ["lexical"]],
  [1279, "translate_to_native", "B1/Work Problems", "To fire", [], ["To dismiss", "Dismiss", "To sack", "Sack", "To lay off"], ["english"]],
  [1281, "cloze_deletion", "B1/Work Problems", "マネージャー", [], ["管理者", "管理職", "支配人", "経営者"], ["lexical"]],
  [1292, "translate_to_target", "B1/Review & Test", "解雇する", [], ["クビにする"], ["lexical"]],
  [1293, "translate_to_native", "B1/Review & Test", "Colleague", [], ["Coworker", "Co-worker", "Workmate"], ["english"]],
  [1295, "cloze_deletion", "B1/Review & Test", "締め切り", [], ["期限", "期日"], ["lexical"]],
  [1306, "translate_to_target", "B1/Booking Travel", "フライト", [], ["飛行", "飛行便"], ["lexical"]],
  [1309, "cloze_deletion", "B1/Booking Travel", "パスポート", [], ["旅券"], ["lexical"]],
  [1321, "translate_to_native", "B1/At the Airport", "Reservation", ["Appointment"], ["Booking"], ["english"]],
  [1334, "translate_to_target", "B1/Hotel Check-in", "予約", [], ["ブッキング"], ["lexical"]],
  [1337, "cloze_deletion", "B1/Hotel Check-in", "搭乗券", [], ["ボーディングパス"], ["lexical"]],
  [1348, "translate_to_target", "B1/Travel Experiences", "パスポート", [], ["旅券"], ["lexical"]],
  [1349, "translate_to_native", "B1/Travel Experiences", "Luggage", [], ["Bags"], ["english"]],
  [1351, "cloze_deletion", "B1/Travel Experiences", "遅延", [], ["遅れ"], ["lexical"]],
  [1363, "translate_to_native", "B1/Travel Problems", "Boarding pass", [], ["Boarding card"], ["english"]],
  [1365, "cloze_deletion", "B1/Travel Problems", "キャンセルする", [], ["取り消す"], ["lexical"]],
  [1376, "translate_to_target", "B1/Review & Test", "搭乗券", [], ["ボーディングパス"], ["lexical"]],
  [1377, "translate_to_native", "B1/Review & Test", "Delay", [], ["Hold-up", "Lateness"], ["english"]],
  [1379, "cloze_deletion", "B1/Review & Test", "冒険", [], ["アドベンチャー"], ["lexical"]],
  [1391, "translate_to_native", "B1/Climate & Weather", "To recycle", [], ["Recycle"], ["english"]],
  [1392, "cloze_deletion", "B1/Climate & Weather", "森", [], ["森林"], ["lexical"]],
  [1393, "cloze_deletion", "B1/Climate & Weather", "海", [], ["海洋", "大洋"], ["lexical"]],
  [1405, "translate_to_native", "B1/Wildlife", "Forest", [], ["Woods", "Woodland"], ["english"]],
  [1406, "cloze_deletion", "B1/Wildlife", "海", [], ["海洋", "大洋"], ["lexical"]],
  [1407, "cloze_deletion", "B1/Wildlife", "絶滅危惧", [], ["絶滅の危機にある", "絶滅が危惧される", "絶滅のおそれのある"], ["lexical"]],
  [1418, "translate_to_target", "B1/Conservation", "森", [], ["森林"], ["lexical"]],
  [1419, "translate_to_native", "B1/Conservation", "Ocean", [], ["Sea"], ["english"]],
  [1420, "fill_blank", "B1/Conservation", "危惧", [], ["の危機にある", "が危惧される"], ["completion"]],
  [1421, "cloze_deletion", "B1/Conservation", "保全", [], ["保護", "自然保護", "保存"], ["lexical"]],
  [1432, "translate_to_target", "B1/Pollution", "海", [], ["海洋", "大洋"], ["lexical"]],
  [1433, "translate_to_native", "B1/Pollution", "Endangered", [], ["At risk of extinction", "Danger of extinction"], ["english"]],
  [1434, "fill_blank", "B1/Pollution", "全", [], ["護"], ["completion"]],
  [1446, "translate_to_target", "B1/Sustainable Living", "絶滅危惧", [], ["絶滅の危機にある", "絶滅が危惧される", "絶滅のおそれのある"], ["lexical"]],
  [1447, "translate_to_native", "B1/Sustainable Living", "Conservation", [], ["Preservation", "Protection"], ["english"]],
  [1449, "cloze_deletion", "B1/Sustainable Living", "太陽の", [], ["ソーラー", "太陽光の"], ["lexical"]],
  [1460, "translate_to_target", "B1/Review & Test", "保全", [], ["保護", "自然保護", "保存"], ["lexical"]],
  [1462, "fill_blank", "B1/Review & Test", "陽の", [], ["陽光の"], ["completion"]],
  [1474, "translate_to_target", "B1/Internet & Social Media", "ウェブサイト", [], ["サイト", "ホームページ"], ["lexical"]],
  [1475, "translate_to_native", "B1/Internet & Social Media", "App", [], ["Application", "Software application"], ["english"]],
  [1477, "cloze_deletion", "B1/Internet & Social Media", "ダウンロードする", [], ["ダウンロードをする"], ["lexical"]],
  [1488, "translate_to_target", "B1/Smartphones & Apps", "アプリ", [], ["アプリケーション"], ["lexical"]],
  [1491, "cloze_deletion", "B1/Smartphones & Apps", "アップロードする", [], ["アップロードをする", "アップする"], ["lexical"]],
  [1503, "translate_to_native", "B1/Digital Communication", "To download", [], ["Download"], ["english"]],
  [1505, "cloze_deletion", "B1/Digital Communication", "画面", [], ["スクリーン", "ディスプレイ"], ["lexical"]],
  [1516, "translate_to_target", "B1/Tech Problems", "ダウンロードする", [], ["ダウンロードをする"], ["lexical"]],
  [1517, "translate_to_native", "B1/Tech Problems", "To upload", [], ["Upload"], ["english"]],
  [1530, "translate_to_target", "B1/Future Technology", "アップロードする", [], ["アップする", "アップロードをする"], ["lexical"]],
  [1531, "translate_to_native", "B1/Future Technology", "Screen", [], ["Display"], ["english"]],
  [1533, "cloze_deletion", "B1/Future Technology", "SNS", [], ["ソーシャルメディア"], ["lexical"]],
  [1544, "translate_to_target", "B1/Review & Test", "画面", [], ["スクリーン", "ディスプレイ"], ["lexical"]],
  [1547, "cloze_deletion", "B1/Review & Test", "人工知能", [], ["AI"], ["lexical"]],
  [1558, "translate_to_target", "B1/Telling a Story", "それから", [], ["その後", "そして"], ["lexical"]],
  [1559, "translate_to_native", "B1/Telling a Story", "Suddenly", [], ["All of a sudden", "Abruptly"], ["english"]],
  [1561, "cloze_deletion", "B1/Telling a Story", "まず", [], ["最初に", "初めに", "第一に"], ["lexical"]],
  [1572, "translate_to_target", "B1/Sequencing Events", "突然", [], ["急に"], ["lexical"]],
  [1573, "translate_to_native", "B1/Sequencing Events", "While", [], ["During"], ["english"]],
  [1575, "cloze_deletion", "B1/Sequencing Events", "次に", [], ["その次に"], ["lexical"]],
  [1589, "cloze_deletion", "B1/Past Continuous", "最後に", [], ["最終的に"], ["lexical"]],
  [1600, "translate_to_target", "B1/Interruptions", "まず", [], ["最初に", "初めに", "第一に"], ["lexical"]],
  [1601, "translate_to_native", "B1/Interruptions", "Next", [], ["After that"], ["english"]],
  [1602, "fill_blank", "B1/Interruptions", "後に", [], ["終的に"], ["completion"]],
  [1603, "cloze_deletion", "B1/Interruptions", "その間に", [], ["一方"], ["lexical"]],
  [1614, "translate_to_target", "B1/Describing Scenes", "次に", [], ["その次に"], ["lexical"]],
  [1615, "translate_to_native", "B1/Describing Scenes", "Finally", [], ["Lastly", "Last", "In the end"], ["english"]],
  [1617, "cloze_deletion", "B1/Describing Scenes", "登場人物", [], ["キャラクター"], ["lexical"]],
  [1628, "translate_to_target", "B1/Review & Test", "最後に", [], ["最終的に"], ["lexical"]],
  [1629, "translate_to_native", "B1/Review & Test", "Meanwhile", [], ["In the meantime", "During that time"], ["english"]],
  [1631, "cloze_deletion", "B1/Review & Test", "筋", [], ["筋書き", "プロット", "ストーリー"], ["lexical"]],
  [1643, "translate_to_native", "B1/First Conditional", "Could", [], ["Would be able to", "Will probably be able to", "Could do it"], ["english"]],
  [1644, "fill_blank", "B1/First Conditional", "べき", [], ["るべき", "べきだ", "るべきだ"], ["completion"]],
  [1656, "translate_to_target", "B1/Second Conditional", "できるだろう", [], ["できるでしょう", "できるかもしれない"], ["lexical"]],
  [1657, "translate_to_native", "B1/Second Conditional", "Should", [], ["Ought to", "Should do", "Ought to do"], ["english"]],
  [1659, "cloze_deletion", "B1/Second Conditional", "たぶん", [], ["もしかすると", "もしかしたら", "おそらく"], ["lexical"]],
  [1670, "translate_to_target", "B1/Giving Advice", "すべき", [], ["するべき"], ["lexical"]],
  [1671, "translate_to_native", "B1/Giving Advice", "I wish", [], ["I want to do it", "I would like to do it", "I wish to do it", "Want to do"], ["english"]],
  [1685, "translate_to_native", "B1/Expressing Wishes", "Perhaps", [], ["Maybe", "Possibly", "Probably"], ["english"]],
  [1698, "translate_to_target", "B1/Regrets", "たぶん", [], ["もしかすると", "もしかしたら", "おそらく"], ["lexical"]],
  [1699, "translate_to_native", "B1/Regrets", "Imagine", [], ["Imagine it", "Please imagine"], ["english"]],
  [1701, "cloze_deletion", "B1/Regrets", "その代わりに", [], ["代わりに"], ["lexical"]],
  [1713, "translate_to_native", "B1/Review & Test", "Suppose", [], ["Hypothetically", "Assuming"], ["english"]],
  [1715, "cloze_deletion", "B1/Review & Test", "そうでないと", [], ["そうでなければ", "さもないと", "さもなければ"], ["lexical"]],
  [1727, "translate_to_native", "B1/Formal Requests", "Sincerely", [], ["Yours sincerely", "Sincerely yours", "Yours faithfully", "Yours truly"], ["english"]],
  [1728, "fill_blank", "B1/Formal Requests", "願いします", [], ["願いいたします"], ["completion"]],
  [1729, "cloze_deletion", "B1/Formal Requests", "ちょっと", [], ["なんとなく", "ある程度"], ["lexical"]],
  [1741, "translate_to_native", "B1/Informal Speech", "Regards", [], ["Best regards", "Kind regards"], ["english"]],
  [1743, "cloze_deletion", "B1/Informal Speech", "かっこいい", [], ["クール"], ["lexical"]],
  [1755, "translate_to_native", "B1/Writing Emails", "Kind of", [], ["A little", "A bit", "Slightly"], ["english"]],
  [1757, "cloze_deletion", "B1/Writing Emails", "すごい", [], ["素晴らしい", "最高"], ["lexical"]],
  [1768, "translate_to_target", "B1/Phone Etiquette", "ちょっと", [], ["なんとなく", "ある程度"], ["lexical"]],
  [1769, "translate_to_native", "B1/Phone Etiquette", "Cool", [], ["Good-looking", "Handsome", "Stylish"], ["english"]],
  [1770, "fill_blank", "B1/Phone Etiquette", "ごい", [], ["ばらしい"], ["completion"]],
  [1771, "cloze_deletion", "B1/Phone Etiquette", "何でも", [], ["どうでもいい", "何だって"], ["lexical"]],
  [1782, "translate_to_target", "B1/Adapting Register", "かっこいい", [], ["クール"], ["lexical"]],
  [1783, "translate_to_native", "B1/Adapting Register", "Awesome", [], ["Amazing", "Great", "Terrific", "Incredible"], ["english"]],
  [1784, "fill_blank", "B1/Adapting Register", "でも", [], ["だって"], ["completion"]],
  [1785, "cloze_deletion", "B1/Adapting Register", "大丈夫", [], ["問題ない", "心配ない"], ["lexical"]],
  [1796, "translate_to_target", "B1/Review & Test", "すごい", [], ["素晴らしい", "最高"], ["lexical"]],
  [1797, "translate_to_native", "B1/Review & Test", "Whatever", [], ["Anything", "Everything", "No matter what"], ["english"]],
  [1810, "translate_to_target", "B2/Philosophy of Life", "正義", [], ["公正", "正当さ"], ["lexical"]],
  [1811, "translate_to_native", "B2/Philosophy of Life", "Purpose", [], ["Aim", "Objective", "Intention"], ["english"]],
  [1825, "translate_to_native", "B2/Beliefs & Values", "Consciousness", [], ["Awareness"], ["english"]],
  [1826, "fill_blank", "B2/Beliefs & Values", "理", [], ["理学"], ["completion"]],
  [1830, "cloze_deletion", "B2/Beliefs & Values", "真実", [], ["真理"], ["lexical"]],
  [1839, "translate_to_native", "B2/Abstract Concepts", "Ethics", [], ["Morals"], ["english"]],
  [1840, "fill_blank", "B2/Abstract Concepts", "徳", [], ["徳性"], ["completion"]],
  [1852, "translate_to_target", "B2/Critical Thinking", "倫理", [], ["倫理学"], ["lexical"]],
  [1853, "translate_to_native", "B2/Critical Thinking", "Morality", [], ["Morals"], ["english"]],
  [1858, "cloze_deletion", "B2/Critical Thinking", "信念", [], ["信仰"], ["lexical"]],
  [1866, "translate_to_target", "B2/Expressing Complex Ideas", "道徳", [], ["道徳性"], ["lexical"]],
  [1867, "translate_to_native", "B2/Expressing Complex Ideas", "Existence", [], ["Being", "Presence"], ["english"]],
  [1872, "cloze_deletion", "B2/Expressing Complex Ideas", "疑い", [], ["疑念"], ["lexical"]],
  [1894, "translate_to_target", "B2/Building Arguments", "説得する", [], ["説き伏せる"], ["lexical"]],
  [1895, "translate_to_native", "B2/Building Arguments", "Evidence", [], ["Proof"], ["english"]],
  [1900, "cloze_deletion", "B2/Building Arguments", "反駁する", [], ["論破する", "反証する"], ["lexical"]],
  [1909, "translate_to_native", "B2/Counterarguments", "Counterargument", [], ["Rebuttal", "Objection"], ["english"]],
  [1910, "fill_blank", "B2/Counterarguments", "かし", [], ["かしながら"], ["completion"]],
  [1914, "cloze_deletion", "B2/Counterarguments", "主張", [], ["言い分"], ["lexical"]],
  [1922, "translate_to_target", "B2/Persuasive Language", "反論", [], ["対論"], ["lexical"]],
  [1923, "translate_to_native", "B2/Persuasive Language", "However", [], ["But", "Yet"], ["english"]],
  [1924, "fill_blank", "B2/Persuasive Language", "でも", [], ["にもかかわらず"], ["completion"]],
  [1928, "cloze_deletion", "B2/Persuasive Language", "詭弁", [], ["誤謬"], ["lexical"]],
  [1936, "translate_to_target", "B2/Logical Fallacies", "しかし", [], ["しかしながら", "だが"], ["lexical"]],
  [1937, "translate_to_native", "B2/Logical Fallacies", "Nevertheless", [], ["Nonetheless", "Still", "Even so", "All the same"], ["english"]],
  [1938, "fill_blank", "B2/Logical Fallacies", "らに", [], ["らには"], ["completion"]],
  [1942, "cloze_deletion", "B2/Logical Fallacies", "修辞学", [], ["レトリック"], ["lexical"]],
  [1950, "translate_to_target", "B2/Formal Debate", "それでも", [], ["それにもかかわらず", "にもかかわらず"], ["lexical"]],
  [1951, "translate_to_native", "B2/Formal Debate", "Furthermore", [], ["Moreover", "In addition", "Further"], ["english"]],
  [1956, "cloze_deletion", "B2/Formal Debate", "偏見", [], ["バイアス", "先入観"], ["lexical"]],
  [1964, "translate_to_target", "B2/Review & Test", "さらに", [], ["その上", "加えて"], ["lexical"]],
  [1965, "translate_to_native", "B2/Review & Test", "To refute", [], ["Refute", "Rebut"], ["english"]],
  [1978, "translate_to_target", "B2/Business Emails", "提案", [], ["提議"], ["lexical"]],
  [1984, "cloze_deletion", "B2/Business Emails", "議題", [], ["議事日程", "アジェンダ"], ["lexical"]],
  [1992, "translate_to_target", "B2/Presentations", "契約", [], ["契約書"], ["lexical"]],
  [1993, "translate_to_native", "B2/Presentations", "To implement", [], ["Implement", "To carry out", "Carry out", "To conduct", "To execute"], ["english"]],
  [1998, "cloze_deletion", "B2/Presentations", "議事録", [], ["会議録"], ["lexical"]],
  [2012, "cloze_deletion", "B2/Negotiations", "委任する", [], ["任せる", "委ねる", "委譲する"], ["lexical"]],
  [2020, "translate_to_target", "B2/Reports & Proposals", "戦略", [], ["方策", "作戦"], ["lexical"]],
  [2026, "cloze_deletion", "B2/Reports & Proposals", "効率", [], ["能率"], ["lexical"]],
  [2035, "translate_to_native", "B2/Networking", "Stakeholder", [], ["Interested party"], ["english"]],
  [2036, "fill_blank", "B2/Networking", "題", [], ["事日程"], ["completion"]],
  [2040, "cloze_deletion", "B2/Networking", "締め切り", [], ["期限", "期日"], ["lexical"]],
  [2048, "translate_to_target", "B2/Review & Test", "利害関係者", [], ["ステークホルダー"], ["lexical"]],
  [2049, "translate_to_native", "B2/Review & Test", "Agenda", [], ["Item on the agenda", "Subject for discussion"], ["english"]],
  [2054, "cloze_deletion", "B2/Review & Test", "交渉", [], ["折衝"], ["lexical"]],
  [2062, "translate_to_target", "B2/Describing Art", "詩", [], ["詩歌", "ポエム"], ["lexical"]],
  [2063, "translate_to_native", "B2/Describing Art", "Painting", [], ["Picture"], ["english"]],
  [2064, "fill_blank", "B2/Describing Art", "刻", [], ["像"], ["completion"]],
  [2068, "cloze_deletion", "B2/Describing Art", "主人公", [], ["主役"], ["lexical"]],
  [2076, "translate_to_target", "B2/Book Reviews", "絵画", [], ["絵"], ["lexical"]],
  [2077, "translate_to_native", "B2/Book Reviews", "Sculpture", [], ["Carving", "Engraving"], ["english"]],
  [2082, "cloze_deletion", "B2/Book Reviews", "どんでん返し", [], ["意外な展開"], ["lexical"]],
  [2091, "translate_to_native", "B2/Film & Theater", "Metaphor", [], ["Figure of speech", "Figurative expression", "Trope"], ["english"]],
  [2096, "cloze_deletion", "B2/Film & Theater", "レビュー", [], ["書評", "評論", "批評", "論評"], ["lexical"]],
  [2104, "translate_to_target", "B2/Music Appreciation", "比喩", [], ["隠喩", "暗喩", "メタファー"], ["lexical"]],
  [2110, "cloze_deletion", "B2/Music Appreciation", "傑作", [], ["名作"], ["lexical"]],
  [2118, "translate_to_target", "B2/Creative Writing", "象徴主義", [], ["シンボリズム"], ["lexical"]],
  [2119, "translate_to_native", "B2/Creative Writing", "Genre", [], ["Category", "Type"], ["english"]],
  [2120, "fill_blank", "B2/Creative Writing", "人公", [], ["役"], ["completion"]],
  [2124, "cloze_deletion", "B2/Creative Writing", "インスピレーション", [], ["ひらめき", "着想"], ["lexical"]],
  [2133, "translate_to_native", "B2/Review & Test", "Protagonist", [], ["Main character", "Hero", "Central character"], ["english"]],
  [2138, "cloze_deletion", "B2/Review & Test", "小説", [], ["ノベル"], ["lexical"]],
  [2146, "translate_to_target", "B2/Common Idioms", "的を射る", [], ["核心を突く", "図星を突く"], ["idiom"]],
  [2147, "translate_to_native", "B2/Common Idioms", "A piece of cake", [], ["A cinch", "A breeze", "Very easy", "Easy as pie"], ["idiom"]],
  [2148, "fill_blank", "B2/Common Idioms", "飛び出る", [], ["飛び出るほど高い"], ["idiom"]],
  [2152, "cloze_deletion", "B2/Common Idioms", "めったに", [], ["ごくたまに", "まれに", "ごくまれに"], ["idiom"]],
  [2160, "translate_to_target", "B2/Proverbs", "朝飯前", [], ["お茶の子さいさい"], ["idiom"]],
  [2161, "translate_to_native", "B2/Proverbs", "To cost an arm and a leg", [], ["To make one’s eyes pop out"], ["idiom"]],
  [2166, "cloze_deletion", "B2/Proverbs", "口を滑らす", [], ["秘密を漏らす"], ["idiom"]],
  [2174, "translate_to_target", "B2/Collocations", "目の玉が飛び出る", [], ["目の玉が飛び出るほど高い"], ["idiom"]],
  [2176, "fill_blank", "B2/Collocations", "る気持ち", [], ["る気持ちになる"], ["idiom"]],
  [2180, "cloze_deletion", "B2/Collocations", "一石二鳥", [], ["一挙両得"], ["idiom"]],
  [2188, "translate_to_target", "B2/Figurative Language", "遅くてもしないよりまし", [], ["遅れてもやらないよりはまし"], ["idiom"]],
  [2189, "translate_to_native", "B2/Figurative Language", "To be on cloud nine", [], ["To be over the moon", "To be elated", "To be in seventh heaven"], ["idiom"]],
  [2194, "cloze_deletion", "B2/Figurative Language", "あなた次第", [], ["今度はあなたの番です"], ["idiom"]],
  [2202, "translate_to_target", "B2/Phrasal Verbs", "天にも昇る気持ち", [], ["天にも昇る気持ちになる", "有頂天になる", "大喜びする"], ["idiom"]],
  [2203, "translate_to_native", "B2/Phrasal Verbs", "To pull someone's leg", [], ["To tease", "Tease", "To kid", "To joke with someone"], ["idiom"]],
  [2208, "cloze_deletion", "B2/Phrasal Verbs", "能力以上のことをする", [], ["手に余ることを引き受ける", "無理な仕事を引き受ける"], ["idiom"]],
  [2216, "translate_to_target", "B2/Review & Test", "からかう", [], ["冗談を言う"], ["lexical"]],
  [2217, "translate_to_native", "B2/Review & Test", "Once in a blue moon", [], ["Rarely", "Seldom", "Hardly ever"], ["english"]],
  [2222, "cloze_deletion", "B2/Review & Test", "場を和ませる", [], ["緊張をほぐす", "打ち解ける"], ["lexical"]],
];

/** Adds to `accepted_answers` and nothing else. Existing entries are carried through
 * unchanged and first, so no stored alternative can be dropped by this producer. Every
 * declared fact about the frozen row is re-asserted, and an addition that is already
 * reachable — the key itself, an existing alternative, or a duplicate inside the row —
 * throws rather than being quietly discarded, because it means the claim was answered
 * somewhere else and this table is stale. A contested row throws too: two producers
 * reaching one field is a reconciliation for the integration owner, never a skip. */
export function japaneseAcceptedAlternatives(set) {
  const get = lessonRefs(set.snapshot, 'ja');
  const alreadyPatched = new Map(set.patches().map(p => [p.id, Object.keys(p.after ?? {})]));
  const contended = [];
  for (const [n, type, lesson, key, current, additions, grounds, sources = []] of japaneseAlternativeRows) {
    const { exercise: e, lesson: l, course, ref } = get(n);
    if (e.type !== type) throw new Error(`Unexpected exercise type: ${ref}`);
    if (`${course.cefr_level}/${l.title}` !== lesson) throw new Error(`Unexpected level or lesson: ${ref}`);
    if (e.correct_answer !== key) throw new Error(`Unexpected stored key: ${ref}`);
    if (e.skill_type !== 'vocabulary') throw new Error(`Unexpected skill type: ${ref}`);
    if (JSON.stringify(e.accepted_answers ?? []) !== JSON.stringify(current)) throw new Error(`Unexpected current alternatives: ${ref}`);
    if (e.options?.length || e.distractors?.length) throw new Error(`Choice row is out of scope for this producer: ${ref}`);
    if (!additions.length) throw new Error(`No actual addition: ${ref}`);
    const reachable = new Set([key, ...current]);
    const seen = new Set();
    for (const addition of additions) {
      if (typeof addition !== 'string' || !addition.trim()) throw new Error(`Empty addition: ${ref}`);
      if (reachable.has(addition)) throw new Error(`Addition already accepted: ${ref}: ${addition}`);
      if (seen.has(addition)) throw new Error(`Duplicate addition: ${ref}: ${addition}`);
      seen.add(addition);
    }
    if (!grounds.length || grounds.some(g => !GROUNDS[g])) throw new Error(`Unknown grounds: ${ref}`);
    if ((alreadyPatched.get(e.id) ?? []).includes('accepted_answers')) { contended.push(ref); continue; }
    const reason = `${ref}: ${additions.join(', ')} added because ${grounds.map(g => GROUNDS[g]).join('; and ')}.`;
    set.update('exercises', e.id, { accepted_answers: [...current, ...additions] }, reason, sources);
  }
  if (contended.length) throw new Error(`accepted_answers already patched by another producer, reconcile before building: ${contended.join(', ')}`);
}
