import {lessonRefs} from './lesson-refs.mjs';

const fields=(prompt,key,options,explanation)=>({prompt,correct_answer:key,accepted_answers:[],options,explanation,
  skill_type:'mixed',target_grammar:null,target_word:null,hint_text:null,distractors:[]});
const orders=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];

// Bounded request patterns named in the visible prompts. Reordering a list
// does not change the meal, so all six Japanese/Korean item orders are valid.
const spanishOrders=['pollo con arroz y agua','agua y pollo con arroz'].flatMap(meal=>[
  `Quiero ${meal}, por favor.`,`Quiero ${meal} por favor.`,
  `Yo quiero ${meal}, por favor.`,`Yo quiero ${meal} por favor.`,
  `Por favor, quiero ${meal}.`,`Por favor quiero ${meal}.`,
  `Por favor, yo quiero ${meal}.`,`Por favor yo quiero ${meal}.`,
]);
const japaneseOrders=['ご飯','ごはん','御飯'].flatMap(rice=>['水','みず'].flatMap(water=>orders.flatMap(order=>{
  const items=['チキン',rice,water],meal=order.map(i=>items[i]).join('と');
  return [`${meal}をください。`,`${meal}を下さい。`];
})));
const koreanOrders=orders.flatMap(order=>{
  const items=['닭고기','밥','물'],meal=order.map(i=>items[i]).join('하고 '),last=items[order[2]];
  return ['',last==='닭고기'?'를':'을'].flatMap(particle=>['','좀 '].flatMap(softener=>['','저는 '].map(topic=>`${topic}${meal}${particle} ${softener}주세요.`)));
});

const fallacyOptions=[
  'It generalizes from two visits to one café to every café in the city.',
  'It rejects a claim solely because of the person who made it.',
  'It treats a low price as proof of fast service.',
  'It treats a popular belief as proof that the belief is true.',
];
const japaneseFallacyAnswer='It generalizes from two visits to one café to every café in the town.';
const fallacyReason='Two visits to one café do not establish what happens at every café, every time. This is an unsupported generalization from a very limited sample. The claim might happen to be true or false; these observations do not justify it.';

export const namedSkillContextRepairs=[
  {language:'es',n:49,oldKey:'Good night',lesson:'Reading Simple Texts',level:'A1',
    fields:fields('Read the short introduction: «Hola. Me llamo Ana. Mi amigo se llama Luis». Who is the speaker’s friend?',
      'Luis',['Ana','Marta','Luis','Pablo'],
      'Me llamo Ana identifies the speaker. Mi amigo se llama Luis says that the speaker’s friend is named Luis.'),
    rationale:'Supply the previously absent connected text and one actual detail-comprehension decision; keep the other greeting and politeness review.'},
  {language:'es',n:119,oldKey:'Milk',lesson:'Full Meal Order',level:'A1',
    fields:fields('Read the restaurant order. Cliente: «Quiero pescado con arroz y agua, por favor». Camarero: «Muy bien». Which order did the customer request?',
      'Fish, rice and water.',['Chicken, rice and water.','Fish, bread and water.','Fish, rice and coffee.','Fish, rice and water.'],
      'Pescado is fish, arroz is rice and agua is water. Quiero …, por favor is the customer’s request, not just a list of food vocabulary.'),
    rationale:'Require comprehension of an actual complete food-and-drink order instead of another isolated food noun.'},
  {language:'es',n:120,oldKey:'Café',lesson:'Full Meal Order',level:'A1',
    fields:{...fields('At a restaurant, translate using Quiero and por favor: Chicken with rice and water, please.',
      spanishOrders[0],null,'Quiero makes the request explicit; por favor adds please. Pollo con arroz is chicken with rice, and agua is water. The meal and drink may be listed in either order. Other request formulas are possible in Spanish; this task practises Quiero.'),
      accepted_answers:spanishOrders.slice(1),skill_type:'grammar',target_grammar:'Quiero + meal request + por favor'},
    rationale:'Add a bounded complete ordering request while retaining ordinary Spanish subject omission and both meal/drink orders.'},
  {language:'es',n:1935,oldKey:'Counterargument',lesson:'Logical Fallacies',level:'B2',
    fields:fields('Evaluate this argument: «Solo he visitado esta cafetería dos veces y en ambas el servicio fue lento. Por tanto, todas las cafeterías de la ciudad ofrecen siempre un servicio lento». Why do the observations not justify the conclusion?',
      fallacyOptions[0],fallacyOptions,fallacyReason),
    rationale:'Present a concrete premise and overgeneralized conclusion for evaluation, preserving the existing general bias principle and other argument vocabulary.'},
  {language:'ja',n:49,oldKey:'Good night',lesson:'Reading Simple Texts',level:'A1',
    fields:fields('Read the short introduction: こんにちは。わたしはアナです。ともだちはルイスです。 Who is the speaker’s friend?',
      'Luis',['Maria','Luis','Ana','Carlos'],
      'わたしはアナです identifies the speaker as Ana. ともだちはルイスです identifies the friend as Luis.'),
    rationale:'Add one short connected A1 introduction and a detail question, not a replacement of the whole valid greeting lesson.'},
  {language:'ja',n:119,oldKey:'Milk',lesson:'Full Meal Order',level:'A1',
    fields:fields('Read the restaurant order. 客:「魚とご飯と水をください。」店員:「はい。」 Which order did the customer request?',
      'Fish, rice and water.',['Fish, rice and coffee.','Fish, rice and water.','Chicken, rice and water.','Fish, bread and water.'],
      '魚 is fish, ご飯 is rice and 水 is water. と joins the items; をください turns the list into a polite request.'),
    rationale:'Add actual food-and-drink ordering comprehension while preserving all other food vocabulary and audio.'},
  {language:'ja',n:120,oldKey:'コーヒー',lesson:'Full Meal Order',level:'A1',
    fields:{...fields('At a restaurant, translate: Chicken, rice and water, please. Use チキン, ご飯 and 水, join the items with と, and end with をください.',
      japaneseOrders[0],null,'Join the requested items with と and use をください for the requested polite ordering pattern. Their list order may vary without changing the meal. ご飯/ごはん/御飯, 水/みず and ください/下さい are accepted written forms here.'),
      accepted_answers:japaneseOrders.slice(1),skill_type:'grammar',target_grammar:'noun と noun と noun をください'},
    rationale:'Practise a complete polite meal order with an explicit beginner request pattern, accepting every item order and listed standard spellings.'},
  {language:'ja',n:1935,oldKey:'Counterargument',lesson:'Logical Fallacies',level:'B2',
    fields:fields('Evaluate this argument:「このカフェを二度利用したが、どちらも料理が出てくるまで長く待った。だから、この町のカフェはどこも、いつ行っても料理が出てくるのが遅いはずだ。」 Why do the observations not justify the conclusion?',
      japaneseFallacyAnswer,[fallacyOptions[2],japaneseFallacyAnswer,fallacyOptions[3],fallacyOptions[1]],fallacyReason),
    rationale:'Require identifying the unsupported move from two experiences at one café to every café, not merely assembling a general warning about prejudice.'},
  {language:'ko',n:49,oldKey:'Good night',lesson:'Reading Simple Texts',level:'A1',
    fields:fields('Read the short introduction: 안녕하세요. 저는 아나예요. 제 친구는 루이스예요. Who is the speaker’s friend?',
      'Luis',['Carlos','Ana','Maria','Luis'],
      '저는 아나예요 identifies the speaker as Ana. 제 친구는 루이스예요 says that the speaker’s friend is Luis.'),
    rationale:'Supply a connected A1 introduction and a referent-comprehension question, retaining the other greeting review.'},
  {language:'ko',n:119,oldKey:'Milk',lesson:'Full Meal Order',level:'A1',
    fields:fields('Read the restaurant order. 손님: “생선하고 밥하고 물을 주세요.” 직원: “네.” Which order did the customer request?',
      'Fish, rice and water.',['Fish, rice and water.','Fish, rice and coffee.','Fish, bread and water.','Chicken, rice and water.'],
      '생선 is fish, 밥 is rice and 물 is water. -하고 joins the items; 주세요 expresses the polite request.'),
    rationale:'Add comprehension of a complete food-and-drink request rather than another food-label choice.'},
  {language:'ko',n:120,oldKey:'커피',lesson:'Full Meal Order',level:'A1',
    fields:{...fields('At a restaurant, translate: Chicken, rice and water, please. Use 닭고기, 밥 and 물, join the items with -하고, and end with 주세요.',
      '닭고기하고 밥하고 물을 주세요.',null,'-하고 joins the three items and 주세요 makes the polite request. A final object particle is natural but may be omitted in this spoken-style order. 좀 can soften the request, and 저는 can introduce the customer’s choice. The items may be listed in any order.'),
      accepted_answers:koreanOrders.filter(a=>a!=='닭고기하고 밥하고 물을 주세요.'),skill_type:'grammar',target_grammar:'noun 하고 noun 하고 noun + 주세요'},
    rationale:'Practise the actual polite meal-request pattern, allowing ordinary particle omission, softening, topic introduction and all six item orders.'},
  {language:'ko',n:1935,oldKey:'Counterargument',lesson:'Logical Fallacies',level:'B2',
    fields:fields('Evaluate this argument: “이 카페에 두 번 갔는데 두 번 모두 음식이 늦게 나왔어요. 그러니 이 도시의 모든 카페에서는 언제나 음식이 늦게 나와요.” Why do the observations not justify the conclusion?',
      fallacyOptions[0],[fallacyOptions[1],fallacyOptions[3],fallacyOptions[0],fallacyOptions[2]],fallacyReason),
    rationale:'Add one evaluable inference with clearly insufficient evidence, preserving the existing generalization/prejudice bank and related vocabulary.'},
];

export function namedSkillContextFixes(set){
  const ids=new Set();
  for(const p of namedSkillContextRepairs){
    const {exercise:e,lesson,course,ref}=lessonRefs(set.snapshot,p.language)(p.n);
    const type=p.n===120?'translate_to_target':'multiple_choice';
    if(e.correct_answer!==p.oldKey||e.type!==type||lesson.title!==p.lesson||course.cefr_level!==p.level||e.prompt_audio_url!==null||e.card_id!==null||Object.keys(e.metadata).length)throw Error(`${ref}: changed named-skill target`);
    if(ids.has(e.id))throw Error(`${ref}: duplicate target`);ids.add(e.id);
    set.update('exercises',e.id,p.fields,`${ref}: ${p.rationale}`);
  }
  if(ids.size!==12)throw Error('Expected twelve individually selected named-skill tasks');
}
