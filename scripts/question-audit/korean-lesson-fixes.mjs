import {lessonRefs} from './lesson-refs.mjs';

// Narrow reconciled proposals, not deployment or independent approval.
// Sole-tile E1772 is reserved for the separate sentence-order batch.
export const koreanNarrowAlternatives=[
 [68,['계세요'],'The fixed 안녕히 prefix also permits the goodbye addressed to someone staying.'],
 [575,['Niece'],'조카 is gender-neutral; the question supplies no male referent.'],
 [598,['조카'],'The gender-neutral kinship noun can denote the requested niece.'],
 [1153,['I think'],'The Korean sentence contains no complement corresponding to that.'],
 [1643,['Can','Can do','To be able to do'],'The isolated ability expression has ordinary can/be able to meanings, not only hypothetical could.'],
 [1657,['Must','Have to','Must do','Have to do'],'The isolated obligation expression has ordinary must/have to meanings.'],
 [2264,['돈이 많았다면 작년에 그 집을 샀을 거예요','돈이 많았다면 작년에 그 집을 샀을 텐데요'],'Both explicitly past conditional forms support the now-visible unreal-past instruction.'],
 [2306,['할머니께서 저에게 빨리 오라고 말하셨어요','할머니께서 저에게 빨리 오라고 말하셨습니다'],'말하다 with subject-honorific 시 is a valid repair; special lexical 말씀하다 is not obligatory.'],
];

export function koreanLessonFixes(set){
 const get=lessonRefs(set.snapshot,'ko');
 const edit=(n,fields,reason,sources=[])=>{const{exercise:e,ref}=get(n);set.update('exercises',e.id,fields,`${ref}: ${reason}`,sources);};
 const option=(n,before,after,reason,sources=[])=>{
  const e=get(n).exercise;
  if(e.options.filter(x=>x===before).length!==1||e.options.includes(after))throw Error(`Unexpected option ko-E${n}`);
  const fields={options:e.options.map(x=>x===before?after:x)};
  if(e.distractors.includes(before))fields.distractors=e.distractors.map(x=>x===before?after:x);
  edit(n,fields,reason,sources);
 };
 const kinship=['https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=91753&nation=eng'];
 option(606,'Niece','Grandfather','조카 can mean nephew or niece; replace the valid offered Niece rather than treating it as wrong.',kinship);
 edit(68,{prompt:'안녕히 _____ (Goodbye)'},'Preserve the word boundary between 안녕히 and either accepted goodbye verb.');
 const wash=['https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=17191&nation=eng'];
 edit(773,{prompt:'씻다',correct_answer:'씻다'},'Correct corrupted 씨다 to the intended wash verb 씻다; the shared card already has 씻다. Audio remains unauditioned.',wash);
 edit(774,{prompt:'씻다'},'Correct the paired listening transcript to 씻다; retain the valid To wash key. Audio remains unauditioned.',wash);
 option(1582,'Next','Before','그러고 나서 permits both Then and Next in narrative sequence.');
 option(1638,'Then','Before','다음에 permits both Next and Then in narrative sequence.');
 option(1738,'Cool','Goodbye','대박 as a positive exclamation permits both Awesome and Cool.');
 option(1865,'Morality','Existence','윤리 has overlapping ethics/morality senses, with no technical distinction supplied.');
 option(1879,'Ethics','Purpose','도덕 permits both Morality and Ethics.',['https://www.collinsdictionary.com/dictionary/korean-english/%EB%8F%84%EB%8D%95']);
 option(1934,'Argument','Conclusion','주장 can be a claim or an argument advanced for a position.',['https://www.collinsdictionary.com/dictionary/korean-english/%EC%A3%BC%EC%9E%A5']);
 option(1949,'Nevertheless','Therefore','그러나 can introduce a nevertheless/however contrast; Therefore is a distinct consequential connective.');
 option(2004,'Proposal','Deadline','안건 can denote an item or proposal to be discussed; remove the offered Proposal collision.',['https://www.collinsdictionary.com/dictionary/english-korean/proposal']);

 const salutation='Respected ... (before a name or title)';
 const salutationReason='존경하는 modifies a following person/name/title and does not itself contain Sir. Teach that respectful modifier rather than a complete male salutation.';
 const salutationSources=['https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=24605&nation=eng'];
 edit(1726,{prompt:'Translate to Korean: Respected ... (the modifier before a person’s name or title)'},salutationReason,salutationSources);
 for(const n of [1739,1750,1790]){
  const e=get(n).exercise;
  edit(n,{correct_answer:salutation,options:e.options.map(x=>x==='Dear Sir'?salutation:x)},salutationReason,salutationSources);
 }
 edit(1749,{hint_text:salutation},salutationReason,salutationSources);
 edit(1803,{prompt:'Write a sentence using 존경하는 (respected; placed before a person’s name or title).'},salutationReason+' The open-production grading issue is not resolved by this gloss correction.',salutationSources);
 set.update('cards','aabbccdd-7777-3008-c002-b10000000000',{native_text:salutation},salutationReason,salutationSources);

 const worry='걱정 마',worryReason='Standard spacing separates 걱정 and prohibitive 마. Preserve the natural informal meaning; sole-tile E1772 is handled separately.';
 const worrySources=['https://www.korean.go.kr/front/mcfaq/mcfaqView.do?mcfaq_seq=5937&mn_id=217'];
 edit(1733,{prompt:`Write a sentence using the expression: ${worry} (No worries)`,correct_answer:worry},worryReason+' The production key remains lexical pending the independent open-production fix.',worrySources);
 for(const n of [1746,1759,1785])edit(n,{correct_answer:worry},worryReason,worrySources);
 edit(1765,{prompt:worry,correct_answer:worry},worryReason+' Audio remains unauditioned.',worrySources);
 edit(1766,{prompt:worry},worryReason+' Audio remains unauditioned.',worrySources);
 edit(1798,{correct_answer:'정 마'},worryReason+' Complete the fixed 걱 prefix without losing the internal word boundary.',worrySources);
 set.update('cards','aabbccdd-7777-3008-c009-b10000000000',{target_text:worry,search_terms:[worry]},worryReason,worrySources);

 const regards='Please give my regards',regardsReason='안부 전해주세요 requests that someone pass on greetings; bare Regards as a letter closing omits the requested action.';
 edit(1728,{prompt:`안부 전_____ (${regards})`},regardsReason);
 edit(1741,{correct_answer:regards,accepted_answers:['Give my regards','Please pass on my regards','Pass on my regards','Please send my regards','Send my regards']},regardsReason);
 edit(1754,{prompt:`Translate to Korean: ${regards}`},regardsReason);
 for(const n of [1767,1778])edit(n,{correct_answer:regards,options:get(n).exercise.options.map(x=>x==='Regards'?regards:x)},regardsReason);
 edit(1777,{hint_text:regards},regardsReason);
 set.update('cards','aabbccdd-7777-3008-c004-b10000000000',{native_text:regards},regardsReason);

 edit(2148,{correct_answer:'둥그레질 정도로 비싸다'},'The fixed 눈이 휘 prefix needs the full expensive-price expression; eyes widening alone does not mean cost an arm and a leg.');
 edit(2153,{metadata:{...get(2153).exercise.metadata,distractors:['얼음을','정곡을']}},'Correct the malformed distractor 정곱을 to genuine 정곡을; neither distractor is the object of the intended reveal-a-secret expression. Preserve this existing two-tile bank.');
 edit(2157,{hint_text:"To pull someone's leg"},'Restore the possessive apostrophe in the English idiom hint.');
 edit(2235,{correct_answer:'수진 씨가 머리가 아프다고 했어요',accepted_answers:[]},'Correct corrupted 아픈고 to 아프다고. Keep the explicitly required spaced opening 수진 씨가 and -다고 했어요 frame; previous alternatives either joined the required honorific title or substituted 말했어요 for the requested ending.');
 edit(2234,{explanation:'Present action-verb statements use -ㄴ/는다고: vowel-final stems take -ㄴ다고 (가다 → 간다고), and most consonant-final stems take -는다고 (먹다 → 먹는다고). A final ㄹ drops before -ㄴ다고 (살다 → 산다고). Plain 가다고 is incorrect.'},'Include the ordinary ㄹ-final exception instead of treating all consonant-final stems alike.');
 const passiveSources=['https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=261&pageIndex=1&qna_seq=310084'];
 edit(2247,{hint_text:'Learn the passive counterpart 듣다 → 들리다 (to be heard). Its present polite form is 들려요.',explanation:'The passive counterpart of 듣다 is 들리다, meaning “to be heard.” Its present polite form is 들려요. Learn this lexical pair; it is not the usual ㄷ-irregular change before a consonant-initial -리- suffix.'},'Remove the false synchronic ㄷ-irregular-before-리 explanation; preserve the valid lexical passive.',passiveSources);
 edit(2250,{metadata:{...get(2250).exercise.metadata,error_sentence:'도둑이 경찰을 잡았어요.',correction_instruction:'Rewrite so that the thief was caught by the police, using a passive verb. The original instead says that the thief caught the police.'}},'State the intended perspective without labeling the valid active sentence grammatically impossible.');
 edit(2261,{hint_text:'Use the specifically requested connective -거든 after the stem 만나-.',explanation:'만나다 + -거든 gives 만나거든, “if you happen to meet.” The following clause requests that the listener pass on a book. -(으)면 can also occur before a request; this exercise specifically asks you to practise -거든.'},'The request does not categorically exclude -(으)면; retain the explicitly requested -거든 form.');
 edit(2263,{accepted_answers:['열심히 공부했더라면 시험에 합격했을 텐데요'],explanation:'This task asks for -았/었더라면 and a past unreal result: 공부했더라면 ... 합격했을 거예요 or 합격했을 텐데요. Both studying and passing refer to the imagined past here. Other counterfactual contexts can have present results; past marking in both clauses is not a universal requirement.'},'Honor the visible transformation instruction requiring -았/었더라면 and qualify the categorical past-result rule.');
 edit(2264,{metadata:{...get(2264).exercise.metadata,error_sentence:get(2264).exercise.prompt,correction_instruction:'Express an unreal past: you did not have enough money, so you did not buy that house last year. Rewrite the condition to mean “if I had had plenty of money.”'},hint_text:'For this explicitly unreal past, use 많았더라면 or 많았다면.',explanation:'The requested unreal-past meaning uses 많았더라면 or 많았다면 with 샀을 거예요 or 샀을 텐데요. The original can instead express an open condition and a guess about a past purchase. A past-time result alone does not make every condition counterfactual.'},'The source can have an open-condition/past-inference reading; make the intended counterfactual context visible.');
 const honorSources=['https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=76222','https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=24607'];
 edit(2271,{prompt:'Which sentence uses both the honorific subject particle and an honorific verb to say that the teacher came to school?',hint_text:'For this teacher-focused sentence, combine 께서 with the honorific verb ending -(으)시-.',explanation:'선생님께서 학교에 오셨어요 uses both 께서 and subject-honorific 시 to honor the teacher. The friend sentence has a different subject, so it does not answer this question. Honoring a friend can be appropriate in a respectful or formal context; it is not universally forbidden.'},'Remove the false ban on honoring friends and resolve the double-valid subject-honorific question by specifying the teacher and both taught markers.',honorSources);
 edit(2273,{explanation:'연세가 어떻게 되세요? uses honorific age vocabulary and an honorific polite verb, fitting the professor-directed question. Casual 몇 살이야? can be used where informal speech is appropriate, such as with close friends or children; it is not the respectful choice requested here.'},'Casual speech is not restricted to close friends; retain the appropriate professor-directed answer.',honorSources);
 edit(2304,{explanation:'The prompt explicitly requests a past counterfactual: 알았더라면 or 알았다면 means “if I had known.” Here it combines with 실수하지 않았을 거예요, “I would not have made a mistake.” Similar past-result wording can express inference in other contexts; the requested meaning determines this answer.'},'Do not claim the result ending alone forces a past counterfactual condition.');
 edit(2306,{metadata:{...get(2306).exercise.metadata,error_sentence:get(2306).exercise.prompt,correction_instruction:'Keep the message and use polite speech, but honor your grandmother’s speaking action with a subject-honorific verb.'},hint_text:'Use a subject-honorific speaking form: 말씀하셨어요 or 말하셨어요.',explanation:'말씀하셨어요 is a respectful lexical choice, and 말하셨어요 also marks the grandmother’s action with honorific 시. The quoted command 오라고 continues to describe what she told the speaker to do.'},'Do not make the special lexical verb 말씀하다 the sole possible subject-honorific repair.',honorSources);
 const passive=set.row('grammar_rules','0fad4453-fa0f-4e97-b4d8-172da04a2f77');
 set.update('grammar_rules',passive.id,{common_errors:passive.common_errors.map(x=>({...x,note:'For 잡히다 meaning “be caught” here, mark the police as the agent with 에게 or 한테. This is not a rule that all Korean passive constructions prohibit an object.'}))},'Dependent passive reference makes an overbroad direct-object prohibition; qualify it to the valid caught-by-police example.',['https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002419733']);
 const conditional=set.row('grammar_rules','2fcf2205-9c89-4448-8b64-c15bae98dd7c');
 set.update('grammar_rules',conditional.id,{
  explanation:'-(으)면 states a general or open condition and can also precede requests. Conditional -거든 commonly introduces a condition for a subsequent request, suggestion or plan. -았/었더라면 presents a counterfactual past condition. For an unreal past result, it can pair with -았/었을 거예요 or -았/었을 텐데; a different context can instead have a present result.',
  common_errors:conditional.common_errors.slice(1).map(x=>({...x,note:'For this future-conditional use, follow 집에 도착하거든 with an appropriate subsequent instruction or plan. 잤어요 instead presents sleeping as already completed.'})),
 },'Dependent conditional reference repeats the absolute request and past-result rules. Remove its falsely erroneous open-condition/past-inference example; keep the valid counterfactual source example.');
 for(const[n,variants,reason]of koreanNarrowAlternatives){const e=get(n).exercise;edit(n,{accepted_answers:[...new Set([...e.accepted_answers,...variants])]},reason);}
}
