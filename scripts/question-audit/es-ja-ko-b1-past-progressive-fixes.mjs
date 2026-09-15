import {applyTopicRepairs, topicFields as f} from './topic-repair-helpers.mjs';

// Each order preserves the same ongoing reading and phone event. A/one both
// retain a singular book; only Japanese/Korean permit either phone article.
function readingPhoneEnglish(phones = ['the phone']) {
  return ['a book','one book'].flatMap(book => phones.flatMap(phone => {
    const subject=phone[0].toUpperCase()+phone.slice(1);
    return [
      `I was reading ${book} when ${phone} rang.`,
      `When ${phone} rang, I was reading ${book}.`,
      `When ${phone} rang I was reading ${book}.`,
      `${subject} rang while I was reading ${book}.`,
      `While I was reading ${book}, ${phone} rang.`,
      `While I was reading ${book} ${phone} rang.`,
      `${subject} rang when I was reading ${book}.`,
      `When I was reading ${book}, ${phone} rang.`,
      `When I was reading ${book} ${phone} rang.`,
    ];
  })).slice(1); // The first sentence is already the canonical key.
}
// New wording awaits independent review. The requested forms are specific
// learning objectives, not universal mappings from English tense/aspect.
export const pastProgressiveRepairs = [
  {language:'es',n:1585,oldKey:'Suddenly',
    fields:f('Anoche a las ocho, Marta estaba leyendo un libro. A las nueve, cerró el libro. ¿Qué estaba haciendo Marta a las ocho?',
      'Marta was reading a book.', [], 'imperfect estar + gerund as narrative background',
      'Estaba leyendo describes the reading already in progress at eight. Cerró describes the later closing event at nine.',
      ['Marta was writing a book.','Marta was closing the book.','Marta was reading a book.','Marta was buying a book.']),
    rationale:'Replace an isolated sequencing adverb with comprehension of an ongoing past action contrasted with a later event.',
    reject:['Marta was writing a book.','Marta was closing the book.','Marta was buying a book.']},
  {language:'es',n:1586,oldKey:'Mientras',
    fields:f('Translate to Spanish using the imperfect of estar plus a gerund: At eight last night, I was reading a book.',
      'Anoche a las ocho estaba leyendo un libro.',
      ['Anoche a las ocho, estaba leyendo un libro.','Anoche a las ocho yo estaba leyendo un libro.','Anoche a las ocho, yo estaba leyendo un libro.',
       'Estaba leyendo un libro anoche a las ocho.','Yo estaba leyendo un libro anoche a las ocho.',
       'A las ocho de anoche estaba leyendo un libro.','A las ocho de anoche, estaba leyendo un libro.','A las ocho de anoche yo estaba leyendo un libro.','A las ocho de anoche, yo estaba leyendo un libro.',
       'Estaba leyendo un libro a las ocho de anoche.','Yo estaba leyendo un libro a las ocho de anoche.',
       'Anoche estaba leyendo un libro a las ocho.','Anoche, estaba leyendo un libro a las ocho.','Anoche yo estaba leyendo un libro a las ocho.','Anoche, yo estaba leyendo un libro a las ocho.',
       'Yo anoche a las ocho estaba leyendo un libro.','Yo anoche estaba leyendo un libro a las ocho.',
       'Ayer a las ocho de la noche estaba leyendo un libro.','Ayer a las ocho de la noche, estaba leyendo un libro.','Ayer a las ocho de la noche yo estaba leyendo un libro.','Ayer a las ocho de la noche, yo estaba leyendo un libro.',
       'Estaba leyendo un libro ayer a las ocho de la noche.','Yo estaba leyendo un libro ayer a las ocho de la noche.'],
      'imperfect estar + leyendo',
      'The requested progressive construction is estaba leyendo: imperfect estar plus the gerund of leer. Anoche a las ocho supplies the past time. A simple imperfect can also describe past reading in other contexts; this task explicitly practises the progressive construction.'),
    rationale:'Require an actual past-progressive sentence at a stated time, with the chosen construction visibly requested.',
    reject:['Anoche a las ocho estoy leyendo un libro.','Anoche a las nueve estaba leyendo un libro.','Anoche a las ocho estaba escribiendo un libro.','Anoche a las ocho leía un libro.']},
  {language:'es',n:1587,oldKey:'First',
    fields:f('Translate to English: Yo estaba leyendo un libro cuando sonó el teléfono.',
      'I was reading a book when the phone rang.', readingPhoneEnglish(),
      'ongoing past action + new event',
      'The reading was in progress when the phone rang. The sentence does not say that the reader finished the book or stopped reading afterward.'),
    rationale:'Replace an isolated sequence word with a complete background-action/new-event relationship.',
    reject:['I had finished reading the book before the phone rang.','I was writing a book when the phone rang.','I am reading a book when the phone rings.']},
  {language:'es',n:1588,oldKey:'ego',
    fields:f('Complete with the imperfect form of estar: Cuando sonó el teléfono, yo ___ leyendo un libro.',
      'estaba', [], 'first-person singular imperfect estar + gerund',
      'With yo, the imperfect of estar is estaba. Estaba leyendo places the reading in progress when the phone rang.'),
    rationale:'Replace a sequencing-word fragment with the requested narrative progressive form in a complete context.',
    reject:['estoy','estuvo','estuve','estaban']},
  {language:'ja',n:1585,oldKey:'Suddenly',
    fields:f('昨夜八時、ミナは本を読んでいました。九時に本を閉じました。八時にミナは何をしていましたか。',
      'Mina was reading a book.', [], 'past -ていました for an action in progress',
      '読んでいました describes the reading in progress at eight. The separate closing event, 本を閉じました, happens at nine.',
      ['Mina was closing the book.','Mina was buying a book.','Mina was writing a book.','Mina was reading a book.']),
    rationale:'Ask about a past action in progress, contrasted with a later event, rather than another sequencing adverb.',
    reject:['Mina was closing the book.','Mina was buying a book.','Mina was writing a book.']},
  {language:'ja',n:1586,oldKey:'の間に',
    fields:f('Translate to Japanese: At eight last night, I was reading a book. Use 昨夜八時に and 本を; put 読む into the polite -ていました form and omit the understood subject.',
      '昨夜八時に本を読んでいました。',
      ['昨夜八時に、本を読んでいました。','本を昨夜八時に読んでいました。'],
      '読む → 読んでいました',
      '読む takes the て-form 読んで, producing 読んでいました for the requested polite past progressive. The reader is understood as the speaker in this translation context, so no explicit 私 is needed. The provided time and object phrases bound this form-focused task.'),
    rationale:'Practise the actual Japanese progressive form in a full past-time sentence, with natural subject omission and visible lexical/form constraints.',
    reject:['昨夜八時に本を読んでいます。','昨夜八時に本を読みました。','昨夜八時に本を読いていました。','昨夜九時に本を読んでいました。']},
  {language:'ja',n:1587,oldKey:'First',
    fields:f('Translate to English: 私が一冊の本を読んでいたとき、電話が鳴りました。',
      'I was reading a book when the phone rang.',
      readingPhoneEnglish(['the phone','a phone']),
      'past action in progress + とき event',
      '読んでいたとき sets the ongoing reading as the time background for 電話が鳴りました, “the phone rang.” 一冊の本 is one book. Japanese does not mark an English definite or indefinite article on 電話, so both “the phone” and “a phone” are possible.'),
    rationale:'Require interpretation of a full Japanese ongoing-action/event sequence; explicitly name the reader and one book to avoid accidental person/number ambiguity.',
    reject:['I had finished reading the book before the phone rang.','I was writing a book when the phone rang.','I am reading a book when the phone rings.']},
  {language:'ja',n:1588,oldKey:'に',
    fields:f('Complete with the past form of います: 電話が鳴ったとき、私は本を読んで___。',
      'いました', [], 'polite past -ていました',
      'The past form of います is いました. 読んでいました describes the reading in progress at the time the phone rang.'),
    rationale:'Replace an isolated sequencing fragment with a polite past-progressive construction in a complete event context.',
    reject:['います','いません','いましたか','いく']},
  {language:'ko',n:1585,oldKey:'Suddenly',
    fields:f('어젯밤 여덟 시에 민아는 책을 읽고 있었어요. 아홉 시에 책을 덮었어요. 여덟 시에 민아는 무엇을 하고 있었어요?',
      'Mina was reading a book.', [], 'past -고 있었다 for an action in progress',
      '읽고 있었어요 describes the reading in progress at eight. The book was closed later, at nine: 아홉 시에 책을 덮었어요.',
      ['Mina was reading a book.','Mina was buying a book.','Mina was closing the book.','Mina was writing a book.']),
    rationale:'Contrast a past action in progress with a later event instead of repeating an isolated narrative adverb.',
    reject:['Mina was buying a book.','Mina was closing the book.','Mina was writing a book.']},
  {language:'ko',n:1586,oldKey:'하는 동안',
    fields:f('Translate to Korean: At eight last night, I was reading a book. Use 어젯밤 여덟 시에 and 책을; put 읽다 into the polite -고 있었어요 form and omit the understood subject.',
      '어젯밤 여덟 시에 책을 읽고 있었어요.',
      ['책을 어젯밤 여덟 시에 읽고 있었어요.','어젯밤 여덟 시에, 책을 읽고 있었어요.'],
      '읽다 → 읽고 있었어요',
      'Attach -고 있었어요 to the stem 읽- to describe the reading in progress at that past time. The speaker is understood as the reader here; an explicit 저는 is not required. The task supplies the time and object phrases and requests this particular progressive ending.'),
    rationale:'Practise Korean’s actual past-progressive construction in a whole sentence, with visible form constraints and natural subject omission.',
    reject:['어젯밤 여덟 시에 책을 읽고 있어요.','어젯밤 여덟 시에 책을 읽었어요.','어젯밤 아홉 시에 책을 읽고 있었어요.','어젯밤 여덟 시에 책을 쓰고 있었어요.']},
  {language:'ko',n:1587,oldKey:'First',
    fields:f('Translate to English: 제가 책 한 권을 읽고 있을 때 전화가 울렸어요.',
      'I was reading a book when the phone rang.',
      readingPhoneEnglish(['the phone','a phone']),
      'ongoing -고 있을 때 action with a past event',
      'The reading is in progress when the phone rings; 울렸어요 places that event in the past. Korean can use -고 있을 때 for an action ongoing relative to that past event, without copying an English past-tense ending into every clause. 한 권 specifies one book; 전화 does not itself select “the” versus “a” in English.'),
    rationale:'Interpret the ongoing action and new event in Korean, avoiding an artificial word-for-word English tense rule.',
    reject:['I had finished reading the book before the phone rang.','I was writing a book when the phone rang.','I am reading a book when the phone rings.']},
  {language:'ko',n:1588,oldKey:'음에',
    fields:f('Complete with the -어요 polite past form of 있다: 전화가 울렸을 때 저는 책을 읽고 ___.',
      '있었어요', [], 'polite past -고 있었어요',
      'The requested polite past form of 있다 is 있었어요. 읽고 있었어요 describes the reading in progress at the past time when the phone rang.'),
    rationale:'Replace a sequencing-word fragment with the past-progressive ending in a complete narrative context.',
    reject:['있어요','있을 거예요','없었어요','있다']},
];

// Standard numeral/kana spellings of the already-authored time/verb phrases.
// These do not add different times, pronouns or alternate aspect constructions.
for (const p of pastProgressiveRepairs.filter(p => p.n === 1586)) {
  const answers=[p.fields.correct_answer,...p.fields.accepted_answers];
  const variants=p.language==='es'
    ? answers.map(a=>a.replace('ocho','8'))
    : p.language==='ja'
      ? answers.flatMap(a=>[a.replace('八時','8時'),a.replace('八時','８時'),a.replace('読んで','よんで'),a.replace('八時','8時').replace('読んで','よんで'),a.replace('八時','８時').replace('読んで','よんで')])
      : answers.flatMap(a=>[a.replace('여덟 시','8시'),a.replace('여덟 시','8 시')]);
  p.fields.accepted_answers=[...new Set([...p.fields.accepted_answers,...variants])];
}

export function pastProgressiveFixes(set) {
  applyTopicRepairs(set, pastProgressiveRepairs, {level:'B1',lesson:'Past Continuous',first:1585});
}

// Exact eight ES1586 alternatives requested after root archived source 7a5f.
pastProgressiveRepairs.find(p => p.language === 'es' && p.n === 1586).fields.accepted_answers.push(
  'Ayer por la noche, a las ocho, estaba leyendo un libro.',
  'Ayer por la noche, a las ocho, yo estaba leyendo un libro.',
  'Ayer por la noche a las ocho estaba leyendo un libro.',
  'Ayer por la noche a las ocho yo estaba leyendo un libro.',
  'Ayer por la noche, a las 8, estaba leyendo un libro.',
  'Ayer por la noche, a las 8, yo estaba leyendo un libro.',
  'Ayer por la noche a las 8 estaba leyendo un libro.',
  'Ayer por la noche a las 8 yo estaba leyendo un libro.',
);
