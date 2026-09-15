import {lessonRefs} from './lesson-refs.mjs';

// Independent author proposals; exact new fields need root review.
// Root's 101 sole-token replacement refs are intentionally excluded.
export const spanishAdditionalAlternatives=[
 [2238,['Yo dudo de que él tenga el dinero','Yo dudo de que tenga el dinero'],'The source already permits dudar de que and explicit yo separately; their combination is standard.'],
 [2249,['Si tuviera tiempo, yo iría al gimnasio','Si tuviese tiempo, yo iría al gimnasio'],'The requested Si opening is preserved; explicit yo in the result does not change the hypothetical identity.'],
 [2252,['Nos quedaremos en casa si llueve mañana','Nos quedaremos en casa si mañana llueve','Si llueve mañana, vamos a quedarnos en casa'],'Both clause orders and the ordinary ir a future express the same future condition and stay-at-home result.'],
 [2266,['Dijo que ella estaba cansada','Ella dijo que se encontraba cansada'],'Explicit ella and the standard state expression encontrarse cansada retain the reported statement.'],
 [2277,['En 1990 se construyó este puente','Se construyó en 1990 este puente'],'Moving the time phrase preserves the required pasiva refleja, bridge and construction date.'],
 [2279,['Se habla aquí español'],'This natural placement of aquí uses all four original tiles; it is not a sole-token replacement.'],
 [2280,['En una hora se vendieron las entradas','Los boletos se vendieron en una hora','Los billetes se vendieron en una hora','Se vendieron los boletos en una hora'],'The time-first order and ordinary regional ticket nouns retain se, plural agreement and preterite sale in one hour.'],
 [2308,['Si yo fuera usted, compraría la casa','Si fuera usted, compraría la casa','Si yo fuese usted, compraría la casa','Si fuese usted, compraría la casa'],'English you does not specify informal tú; respectful usted fits the identical hypothetical pattern.'],
];

// Root owns E2294.accepted_answers. These exact candidates are NOT applied here.
export const spanishAdditionalConflicts=[
 {ref:2294,field:'accepted_answers',candidates:['Yo busco a alguien que tenga experiencia en ventas','Busco una persona que tenga experiencia en ventas'],reason:'Explicit yo and una persona preserve the requested non-specific person and sales-experience meaning; both remain in the subjunctive. Merge only after independent review into root’s existing accepted-answer correction.'},
];

export function spanishLessonAdditionalFixes(set){
 const get=lessonRefs(set.snapshot,'es');
 for(const[n,variants,reason]of spanishAdditionalAlternatives){
  const{exercise:e,ref}=get(n);
  if(e.type==='sentence_construction'&&e.metadata.tiles.length===1)throw Error(`${ref}: root-owned replacement`);
  set.update('exercises',e.id,{accepted_answers:[...new Set([...e.accepted_answers,...variants])]},`${ref}: ${reason}`);
 }
}
