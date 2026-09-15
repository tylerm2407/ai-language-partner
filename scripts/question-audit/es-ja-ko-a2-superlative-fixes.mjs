import {applyTopicRepairs, topicFields as f} from './topic-repair-helpers.mjs';

// Individually authored superlatives, not a claim that valid comparative
// review elsewhere should be removed. Root independently reviews these fields.
export const superlativeRepairs = [
  {language:'es',n:1017,oldKey:'Better',
    fields:f('El libro A cuesta 10 euros, el libro B cuesta 20 euros y el libro C cuesta 30 euros. ¿Cuál es el libro más caro?',
      'Book C', [], 'el más + adjective + comparison set',
      'El libro más caro is the most expensive book. Among the three stated prices, book C costs the most: 30 euros.',
      ['Book B','All three cost the same','Book C','Book A']),
    rationale:'Test a relative superlative against an explicit three-item set, replacing another isolated comparative gloss.',
    reject:['Book B','All three cost the same','Book A']},
  {language:'es',n:1018,oldKey:'Peor',
    fields:f('Context: You are comparing three books. Translate to Spanish using barato: This book is the cheapest.',
      'Este libro es el más barato.',
      ['Este es el libro más barato.','El libro más barato es este.','El más barato es este libro.','Este es el más barato.','Este libro es el más barato de los tres.','Este es el más barato de los tres.','Este libro es el más barato de estos tres libros.','Este es el más barato de estos tres libros.','De los tres libros, este es el más barato.','De los tres libros este es el más barato.'],
      'el más barato relative superlative',
      'El más barato means “the cheapest” in the comparison group. Este libro is “this book”; the masculine singular article el agrees with libro.'),
    rationale:'Practise a complete relative-superlative statement in a defined comparison group.',
    reject:['Este libro es el menos barato.','Este libro es la más barato.','Este libro es más barato.']},
  {language:'es',n:1019,oldKey:'Cheaper',
    fields:f('Translate to English: Este hotel es el más barato de la ciudad.',
      'This hotel is the cheapest in the city.',
      ['This is the cheapest hotel in the city.','This hotel is the least expensive in the city.','This is the least expensive hotel in the city.',"This hotel's the cheapest in the city.","This is the city's cheapest hotel."],
      'relative superlative with a location group',
      'El más barato de la ciudad identifies this hotel as the cheapest in the city, not merely cheaper than one other hotel.'),
    rationale:'Require interpretation of a superlative sentence and its group, not a comparative adjective alone.',
    reject:['This hotel is cheaper than the city.','This hotel is the most expensive in the city.','This hotel is the cheapest in the country.']},
  {language:'es',n:1020,oldKey:'caro',
    fields:f('Complete “This is the most expensive of these three hotels” with más or menos: De estos tres hoteles, este es el ___ caro.',
      'más', [], 'el más + adjective',
      'El más caro means “the most expensive”; el menos caro would mean “the least expensive.” The accent in más is part of the word.'),
    rationale:'Replace a spelling fragment with a full relative-superlative construction and explicit comparison set.',
    reject:['menos','mas','muy']},
  {language:'ja',n:1017,oldKey:'Better',
    fields:f('本Aは100円、本Bは200円、本Cは300円です。この三冊の中で、どの本が一番高いですか。',
      'Book C', [], 'comparison set + 一番 + adjective',
      '一番高い asks for the most expensive. Of these three books, book C has the highest stated price: 300 yen.',
      ['Book A','Book C','Book B','All three cost the same']),
    rationale:'Test Japanese superlative meaning over three concrete prices rather than reusing もっと良い.',
    reject:['Book A','Book B','All three cost the same']},
  {language:'ja',n:1018,oldKey:'もっと悪い',
    fields:f('Context: You are comparing three books. Translate to Japanese using この本 and 一番, ending with polite です: This book is the cheapest.',
      'この本が一番安いです。',
      ['この本は一番安いです。','この本がいちばん安いです。','この本はいちばん安いです。','一番安いのはこの本です。','いちばん安いのはこの本です。','一番安い本はこの本です。','いちばん安い本はこの本です。'],
      '一番 + adjective in a comparison group',
      '一番安い means “the cheapest” in this group. Both この本が and この本は can identify this book in the stated context. The instruction supplies a polite sentence frame; it does not make explicit topics mandatory in all Japanese sentences.'),
    rationale:'Practise a complete Japanese superlative statement with visible lexical and polite-form constraints.',
    reject:['この本が一番高いです。','この本がもっと安いです。','この本が一番安かったです。']},
  {language:'ja',n:1019,oldKey:'Cheaper',
    fields:f('Translate to English: このホテルはこの町で一番安いです。',
      'This hotel is the cheapest in this town.',
      ['This is the cheapest hotel in this town.','This hotel is the least expensive in this town.','This is the least expensive hotel in this town.',"This hotel's the cheapest in this town.","This is this town's cheapest hotel.",'This hotel is the cheapest in town.','This is the cheapest hotel in town.','This hotel is the least expensive in town.','This is the least expensive hotel in town.','This hotel is the cheapest in the town.','This is the cheapest hotel in the town.'],
      'location group + 一番 + adjective',
      'この町で gives the comparison group, “in this town.” 一番安い means “the cheapest,” not just “cheaper.”'),
    rationale:'Test the group-bounded superlative inside a natural hotel-price sentence.',
    reject:['This hotel is the most expensive in this town.','This hotel is cheaper than this town.','This hotel is the cheapest in this country.']},
  {language:'ja',n:1020,oldKey:'と高い',
    fields:f('Complete “This hotel is the most expensive of these three hotels”: この三つのホテルの中でこのホテルが___高いです。',
      '一番', ['いちばん','最も','もっとも'], '一番 or 最も + adjective',
      '一番高い and 最も高い both express “the most expensive” here. もっと高い means “more expensive” instead.'),
    rationale:'Replace the broken comparative fragment with a superlative marker in a full three-hotel comparison.',
    reject:['もっと','とても','少し']},
  {language:'ko',n:1017,oldKey:'Better',
    fields:f('책 A는 1000원, 책 B는 2000원, 책 C는 3000원이에요. 이 세 권 중에서 어떤 책이 가장 비싸요?',
      'Book C', [], 'comparison set + 가장 + adjective',
      '가장 비싸요 asks which is the most expensive. Book C costs 3000 won, the highest of the three stated prices.',
      ['All three cost the same','Book A','Book B','Book C']),
    rationale:'Require comprehension of a Korean superlative over three prices instead of an isolated comparative adjective.',
    reject:['All three cost the same','Book A','Book B']},
  {language:'ko',n:1018,oldKey:'더 나쁜',
    fields:f('Context: You are comparing three books. Translate to Korean using 싸다 and including 이 책. Use polite -요 speech: This book is the cheapest.',
      '이 책이 가장 싸요.',
      ['이 책은 가장 싸요.','이 책이 제일 싸요.','이 책은 제일 싸요.','가장 싼 책은 이 책이에요.','제일 싼 책은 이 책이에요.','가장 싼 것은 이 책이에요.','제일 싼 것은 이 책이에요.','가장 싼 건 이 책이에요.','제일 싼 건 이 책이에요.','가장 싼 책은 이 책이어요.','제일 싼 책은 이 책이어요.','가장 싼 것은 이 책이어요.','제일 싼 것은 이 책이어요.','가장 싼 건 이 책이어요.','제일 싼 건 이 책이어요.'],
      '가장 or 제일 + 싸다',
      '가장 싸요 and 제일 싸요 mean “is the cheapest” in this comparison group. 이 책이 and 이 책은 are both possible here. Before a noun, 싸다 becomes 싼, as in 가장 싼 책.'),
    rationale:'Practise an actual polite superlative sentence, accepting common topic/subject and 가장/제일 variants.',
    reject:['이 책이 가장 비싸요.','이 책이 더 싸요.','이 책이 가장 쌌어요.']},
  {language:'ko',n:1019,oldKey:'Cheaper',
    fields:f('Translate to English: 이 호텔이 이 도시에서 가장 싸요.',
      'This hotel is the cheapest in this city.',
      ['This is the cheapest hotel in this city.','This hotel is the least expensive in this city.','This is the least expensive hotel in this city.',"This hotel's the cheapest in this city.","This is this city's cheapest hotel.",'This hotel is the cheapest in the city.','This is the cheapest hotel in the city.','This hotel is the least expensive in the city.','This is the least expensive hotel in the city.'],
      'location group + 가장 + adjective',
      '이 도시에서 means “in this city.” 가장 싸요 identifies the cheapest hotel in that group, not simply one that is cheaper.'),
    rationale:'Test the full comparison-group meaning of a natural Korean price superlative.',
    reject:['This hotel is the most expensive in this city.','This hotel is cheaper than this city.','This hotel is the cheapest in this country.']},
  {language:'ko',n:1020,oldKey:'비싸다',
    fields:f('Complete “This hotel is the most expensive of these three hotels” with a word meaning “most”: 이 세 호텔 중에서 이 호텔이 ___ 비싸요.',
      '가장', ['제일'], '가장 or 제일 + adjective',
      '가장 비싸요 and 제일 비싸요 both mean “is the most expensive” in this group. 더 비싸요 would mean “is more expensive.”'),
    rationale:'Replace the comparative adjective fragment with a complete group-bounded superlative construction.',
    reject:['더','덜','조금']},
];

export function superlativeFixes(set) {
  applyTopicRepairs(set, superlativeRepairs, {level:'A2',lesson:'Superlatives',first:1017});
}

// Exact additions requested and independently adjudicated after the initial
// source was archived by root; all other authored fields remain unchanged.
for (const [language, n, additions] of [
  [
    "es",
    1019,
    [
      "In the city, this hotel is the cheapest.",
      "In the city this hotel is the cheapest.",
      "In the city, this is the cheapest hotel.",
      "In the city this is the cheapest hotel.",
      "In the city, this hotel is the least expensive.",
      "In the city this hotel is the least expensive.",
      "In the city, this is the least expensive hotel.",
      "In the city this is the least expensive hotel."
    ]
  ],
  [
    "ja",
    1018,
    [
      "この三冊の中でこの本が一番安いです。",
      "この三冊の中で、この本が一番安いです。",
      "この本がこの三冊の中で一番安いです。",
      "この三冊の中でこの本がいちばん安いです。",
      "この三冊の中で、この本がいちばん安いです。",
      "この本がこの三冊の中でいちばん安いです。",
      "この三冊の中でこの本は一番安いです。",
      "この三冊の中で、この本は一番安いです。",
      "この本はこの三冊の中で一番安いです。",
      "この三冊の中でこの本はいちばん安いです。",
      "この三冊の中で、この本はいちばん安いです。",
      "この本はこの三冊の中でいちばん安いです。"
    ]
  ],
  [
    "ja",
    1019,
    [
      "In this town, this hotel is the cheapest.",
      "In this town this hotel is the cheapest.",
      "In this town, this is the cheapest hotel.",
      "In this town this is the cheapest hotel.",
      "In this town, this hotel is the least expensive.",
      "In this town this hotel is the least expensive.",
      "In this town, this is the least expensive hotel.",
      "In this town this is the least expensive hotel.",
      "In town, this hotel is the cheapest.",
      "In town this hotel is the cheapest.",
      "In town, this is the cheapest hotel.",
      "In town this is the cheapest hotel.",
      "In town, this hotel is the least expensive.",
      "In town this hotel is the least expensive.",
      "In town, this is the least expensive hotel.",
      "In town this is the least expensive hotel.",
      "In the town, this hotel is the cheapest.",
      "In the town this hotel is the cheapest.",
      "In the town, this is the cheapest hotel.",
      "In the town this is the cheapest hotel."
    ]
  ],
  [
    "ko",
    1018,
    [
      "이 세 권 중에서 이 책이 가장 싸요.",
      "이 책이 이 세 권 중에서 가장 싸요.",
      "이 세 권 중에서 이 책이 제일 싸요.",
      "이 책이 이 세 권 중에서 제일 싸요.",
      "이 세 권 중에서 이 책은 가장 싸요.",
      "이 책은 이 세 권 중에서 가장 싸요.",
      "이 세 권 중에서 이 책은 제일 싸요.",
      "이 책은 이 세 권 중에서 제일 싸요."
    ]
  ],
  [
    "ko",
    1019,
    [
      "In this city, this hotel is the cheapest.",
      "In this city this hotel is the cheapest.",
      "In this city, this is the cheapest hotel.",
      "In this city this is the cheapest hotel.",
      "In this city, this hotel is the least expensive.",
      "In this city this hotel is the least expensive.",
      "In this city, this is the least expensive hotel.",
      "In this city this is the least expensive hotel.",
      "In the city, this hotel is the cheapest.",
      "In the city this hotel is the cheapest.",
      "In the city, this is the cheapest hotel.",
      "In the city this is the cheapest hotel.",
      "In the city, this hotel is the least expensive.",
      "In the city this hotel is the least expensive.",
      "In the city, this is the least expensive hotel.",
      "In the city this is the least expensive hotel."
    ]
  ]
]) {
  const proposal = superlativeRepairs.find(p => p.language === language && p.n === n);
  proposal.fields.accepted_answers = [...proposal.fields.accepted_answers, ...additions];
}
