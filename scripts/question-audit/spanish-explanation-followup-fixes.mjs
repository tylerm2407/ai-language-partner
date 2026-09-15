import {lessonRefs} from './lesson-refs.mjs';

// Separate follow-up proposals. Do not mutate the already frozen grammar8 file.
export const spanishExplanationFollowups=[
 [2279,
  'Here, se habla español is the idiomatic way to state that Spanish is spoken at this location. Está hablando describes an ongoing speaking event, not this general notice. Spanish also has ser + participle passives; their suitability depends on context, so they are not categorically excluded from general statements.',
  'Remove the categorical ban on periphrastic passives while retaining the natural se construction for this notice and the contrast with progressive speaking.',
  ['https://www.fundeu.es/consulta/oraciones-pasivas-1774/']],
];

// Parent integrates this through an explicit wrapper of the frozen grammar8
// function, not a second conflicting set.update on the same accepted list.
export const spanishAdditionalOrderFollowup={
 ref:2279,candidates:['Español se habla aquí'],
 reason:'The existing four-word bank has no start/end anchors. Topic-fronted español retains the requested general language-use statement, using all four original tiles once. The current frozen grammar8 list already adds Se habla aquí español; retain it as well.',
};

export function spanishExplanationFollowupFixes(set){
 const get=lessonRefs(set.snapshot,'es');
 for(const[n,explanation,reason,sources]of spanishExplanationFollowups){
  const{exercise:e,ref}=get(n);
  set.update('exercises',e.id,{explanation},`${ref}: ${reason}`,sources);
 }
}
