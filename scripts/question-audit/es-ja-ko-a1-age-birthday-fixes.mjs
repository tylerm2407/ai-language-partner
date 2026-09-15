import {applyTopicRepairs, topicFields as f} from './topic-repair-helpers.mjs';

// New wording awaits independent review. Four selected slots per language;
// preserve the remaining family-review tasks, all banks and all audio.
const birthdayEnglish = ["My birthday's in May.", 'My birthday falls in May.', 'I have my birthday in May.'];
export const ageBirthdayRepairs = [
  {language:'es',n:375,oldKey:'Sister',
    fields:f('Read: «Mi hermana tiene doce años». How old is my sister?', 'Twelve years old', [], 'tener + age + años',
      'Doce means twelve. Tiene doce años states that she is twelve years old; Spanish uses tener to state age.',
      ['Twenty years old','Two years old','Twelve years old','Ten years old']),
    rationale:'Replace isolated kinship recognition with age comprehension while retaining hermana in the Family & Friends context.',
    reject:['Twenty years old','Two years old','Ten years old']},
  {language:'es',n:376,oldKey:'Hermano',
    fields:f('Translate to Spanish using tener: I am twenty years old.', 'Tengo veinte años.',
      ['Yo tengo veinte años.','Tengo 20 años.','Yo tengo 20 años.'], 'tener + age + años',
      'Tengo veinte años expresses “I am twenty years old.” Yo is optional here; veinte or 20 gives the same age.'),
    rationale:'Practise a complete age statement instead of another isolated family noun.',
    reject:['Tengo doce años.','Tengo veinte año.','Soy veinte años.','Tiene veinte años.']},
  {language:'es',n:377,oldKey:'Daughter',
    fields:f('Translate to English: Mi cumpleaños es en mayo.', 'My birthday is in May.', birthdayEnglish,
      'birthday month statement', 'Mi cumpleaños means “my birthday”; en mayo means “in May.”'),
    rationale:'Add actual birthday-month comprehension at A1, not just kinship vocabulary.',
    reject:['My birthday is in March.','Her birthday is in May.','My birthday was in May.']},
  {language:'es',n:378,oldKey:'jo',
    fields:f('Complete the age statement with the present-tense form of tener: Mi hermano ___ diez años.', 'tiene', [],
      'third-person singular tener for age', 'Mi hermano is third-person singular, so tener becomes tiene: Mi hermano tiene diez años.'),
    rationale:'Replace a partial spelling fragment with the age construction in a complete family sentence.',
    reject:['tengo','tienen','es','tenía']},
  {language:'ja',n:375,oldKey:'Sister',
    fields:f('Read: 妹は十二歳です。How old is my younger sister?', 'Twelve years old', [], 'age + 歳です',
      '十二 is twelve and 歳 is the age counter. 妹は十二歳です states that my younger sister is twelve years old.',
      ['Ten years old','Twelve years old','Twenty years old','Two years old']),
    rationale:'Retain the family context but ask about a concrete age rather than the ambiguous isolated sibling label.',
    reject:['Ten years old','Twenty years old','Two years old']},
  {language:'ja',n:376,oldKey:'兄弟',
    fields:f('Translate to Japanese. Begin with 私は and end with polite です: I am twenty years old.', '私は二十歳です。',
      ['私は二十才です。','私は20歳です。','私は２０歳です。','私は20才です。','私は２０才です。','私ははたちです。','私は20さいです。','私は２０さいです。','私は二十さいです。'],
      '私は + age + です', '二十歳 is read はたち and means twenty years old. 私は supplies the requested introduction frame; Japanese can omit this topic in other contexts. 歳 and the informal alternative 才 are both used for age.'),
    rationale:'Practise a polite age introduction with visible opening/ending constraints; the constraints belong to this task, not a universal pronoun rule.',
    reject:['私は十二歳です。','私は二十歳でした。','私は二十歳ではありません。']},
  {language:'ja',n:377,oldKey:'Daughter',
    fields:f('Translate to English: 私の誕生日は五月です。', 'My birthday is in May.', birthdayEnglish,
      'birthday month statement', '私の誕生日 means “my birthday”; 五月 is May. The sentence gives the month, not a particular day.'),
    rationale:'Add actual birthday-month comprehension using a short A1 statement.',
    reject:['My birthday is in March.','Her birthday is in May.','My birthday was in May.']},
  {language:'ja',n:378,oldKey:'子',
    fields:f('Complete “My son is ten years old” with the age counter: 息子は十___です。', '歳', ['才','さい'],
      '歳 age counter', 'The age counter 歳 follows the number: 十歳 means ten years old. 才 and さい are accepted spellings for this counter.'),
    rationale:'Place the original son vocabulary inside a complete age statement and test its counter.',
    reject:['年','人','月']},
  {language:'ko',n:375,oldKey:'Sister',
    fields:f('Read: 제 여동생은 열두 살이에요. How old is my younger sister?', 'Twelve years old', [], 'native Korean number + 살이에요',
      '열두 is twelve and 살 counts years of age. The sentence says that my younger sister is twelve years old.',
      ['Two years old','Twenty years old','Ten years old','Twelve years old']),
    rationale:'Retain the family context but require comprehension of an actual age statement.',
    reject:['Two years old','Twenty years old','Ten years old']},
  {language:'ko',n:376,oldKey:'형제',
    fields:f('Translate to Korean. Begin with 저는, use the age counter 살, and use polite -요 speech: I am twenty years old.', '저는 스무 살이에요.',
      ['저는 20살이에요.','저는 20 살이에요.','저는 스무 살이어요.','저는 20살이어요.','저는 20 살이어요.'],
      '저는 + age + 살이에요', 'Before 살, the native Korean number 스물 takes the form 스무: 스무 살이에요. 저는 is the requested introduction frame, not an obligatory topic in every Korean age statement. 이에요 and 이어요 are both valid polite endings.'),
    rationale:'Replace the underspecified sibling translation with a visibly bounded polite age introduction.',
    reject:['저는 열두 살이에요.','저는 스물 살이에요.','저는 스무 살이었어요.','저는 스무 살이 아니에요.']},
  {language:'ko',n:377,oldKey:'Daughter',
    fields:f('Translate to English: 제 생일은 5월이에요.', 'My birthday is in May.', birthdayEnglish,
      'birthday month statement', '제 생일 means “my birthday”; 5월 is May. The sentence states the month of the birthday.'),
    rationale:'Add birthday-month comprehension at A1 rather than another isolated kinship term.',
    reject:['My birthday is in March.','Her birthday is in May.','My birthday was in May.']},
  {language:'ko',n:378,oldKey:'들',
    fields:f('Complete “My younger sibling is ten years old” with the age counter: 동생은 열 ___이에요.', '살', [],
      'native Korean number + 살', '열 is the native Korean number ten. With the age counter 살, 열 살 means ten years old.'),
    rationale:'Replace a noun fragment with a complete sentence that practises the actual native-number age pattern.',
    reject:['세','명','년']},
];

export function ageBirthdayFixes(set) {
  applyTopicRepairs(set, ageBirthdayRepairs, {level:'A1',lesson:'Ages & Birthdays',first:375});
}

// Exact additions requested and independently adjudicated after the initial
// source was archived by root; all other authored fields remain unchanged.
for (const [language, n, additions] of [
  [
    "es",
    377,
    [
      "May is my birthday month.",
      "My birthday is in the month of May."
    ]
  ],
  [
    "ja",
    377,
    [
      "May is my birthday month.",
      "My birthday is in the month of May."
    ]
  ],
  [
    "ko",
    376,
    [
      "저는 나이가 스무 살이에요.",
      "저는 나이가 스무 살이어요.",
      "저는 나이가 20살이에요.",
      "저는 나이가 20살이어요.",
      "저는 나이가 20 살이에요.",
      "저는 나이가 20 살이어요.",
      "저는 스무 살 먹었어요.",
      "저는 스무 살을 먹었어요.",
      "저는 20살 먹었어요.",
      "저는 20살을 먹었어요.",
      "저는 20 살 먹었어요.",
      "저는 20 살을 먹었어요."
    ]
  ],
  [
    "ko",
    377,
    [
      "May is my birthday month.",
      "My birthday is in the month of May."
    ]
  ]
]) {
  const proposal = ageBirthdayRepairs.find(p => p.language === language && p.n === n);
  proposal.fields.accepted_answers = [...proposal.fields.accepted_answers, ...additions];
}
