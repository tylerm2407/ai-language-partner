import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet,SNAPSHOT_SHA} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {portugueseWordOrder,portugueseWordOrderFixes} from './portuguese-word-order-fixes.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/pt-word-order-root-review';
const expected='652a416fcea098e7323eb0313bf4e6c34a09ce89d5ae094587b1404f91c81a12';
const sha=x=>createHash('sha256').update(x).digest('hex');
if(sha(await readFile('scripts/question-audit/portuguese-word-order-fixes.mjs'))!==expected)throw Error('Unreviewed source');
const notes=new Map([
 [566,'Aunt’s husband is uncle by marriage; da minha tia possessive attachment.'],
 [578,'Pedro’s wife is sister’s friend; amiga without indefinite article natural predication.'],
 [590,'Sister’s boyfriend age twenty uses ter anos, supplying actual age content.'],
 [602,'Girlfriend finishing college this year supplies a life event.'],
 [614,'Recurring Sunday family lunch, not merely neighbor vocabulary.'],
 [626,'Wedding in December with prospective vai ser; cousin gender selected by tiles.'],
 [638,'Nurse asks whether speaker has headache; omitted tenho subject is first person.'],
 [650,'Dental appointment tomorrow morning; consulta com and de manhã.'],
 [662,'Pharmacy advice on stress reduction; no asserted medical efficacy.'],
 [674,'Worry causing tiredness is contextual wellbeing practice; fico/estou distinct.'],
 [686,'Need to rest a little after work; infinitive complement and time phrase.'],
 [698,'Diet contents fruits/vegetables/water; legumes contextual vegetables.'],
 [710,'Washing machine beside kitchen door fits furniture/location.'],
 [722,'Planned sweeping before visitor arrival; nominal chegada preserves temporal relation.'],
 [734,'New home with more cooking space fits moving/housing.'],
 [746,'Same rent as speaker; que eu elliptical comparison valid.'],
 [758,'Cold house motivates moving; attached infinitival mudar-se valid supplied clitic form.'],
 [770,'Apartment has two bedrooms and large kitchen; adjective grande scope kitchen.'],
 [782,'Shy brother happy with friends supplies positive emotion.'],
 [794,'Brave father nonetheless fears heights supplies negative emotion.'],
 [806,'Kind cousin toward new neighbors; noun-adjective agreement.'],
 [818,'Generosity exemplified through food sharing; divide sua comida natural.'],
 [830,'Upset at being called lazy: object o before chamam, de predicative.'],
 [842,'Patience when speaker asks excessively many questions; demais quantity.'],
 [950,'Learning to drive before vacation supplies explicit goal.'],
 [962,'Goal to arrange tomorrow’s appointment; marcar uma consulta.'],
 [974,'Prediction dream becomes reality one day; omitted acho subject.'],
 [986,'Plan trip after dinner with future auxiliary vamos.'],
 [1070,'Fictional family gifts each child at Christmas, not universal national claim.'],
 [1082,'Grandmother preparing traditional dish for party fits food traditions.'],
 [1094,'Celebrating date through music/dance fits exact lesson.'],
 [1106,'Music begins when festival opens; metaphorical doors natural venue usage.'],
 [1118,'Received dance course as gift; ganhou ... de presente.'],
 [1130,'Annual family visit to city festival fits cultural review.'],
 [1142,'Explicit opinion on investing more in education.'],
 [1156,'Agreement with person contrasted with disagreement on transport policy.'],
 [1170,'News report on drought’s impact on regional economy.'],
 [1184,'Argument against school closure based on resulting problems.'],
 [1198,'Debate participation motivated by neighborhood consequences.'],
 [1212,'Reason states inability to pay electricity bill; conta de luz.'],
 [1226,'Interview question reports intended hiring, pretendia contratar.'],
 [1240,'Manager warns of projected dismissal; teria de future in past.'],
 [1254,'Meeting explanation of prior delivery delay; por que embedded why.'],
 [1268,'Career goal manager role to learn leadership; linked infinitive purposes.'],
 [1282,'Deadline missed after computer malfunction during presentation.'],
 [1296,'Project postponement because incomplete information; adiamos allows past reading in supplied cue.'],
 [1310,'Ticket purchase checks luggage inclusion; no invented carrier policy.'],
 [1338,'Hotel reception explains traffic-caused delay with prior passive tinha sido causado.'],
 [1352,'Cancelled outing due to heavy rain; começou a chover muito.'],
 [1366,'Lost map makes adventure harder; event cause and comparison preserved.'],
 [1380,'Tourist indirect rental question for city exploration; poderia alugar.'],
 [1408,'Forest conservation supports animals living there; nelas agrees with florestas.'],
 [1422,'Saving energy by switching lights off when leaving home; gerund means.'],
 [1436,'Solar electricity without coal burning; no universal lifecycle-impact claim.'],
 [1450,'Rail preference when possible for carbon reduction fits sustainable living.'],
 [1478,'Permission before uploading depicted people’s photos; carregar contextual upload.'],
 [1492,'Reduced screen brightness due to low battery; event versus prior state.'],
 [1506,'Keyboard preference for long messages with comfort reason; omitted object recoverable.'],
 [1548,'Robot answers but not always understands intended meaning; nem sempre scope correct.'],
 [1562,'Key found before entry into empty house; both depois positions preserve sequence.'],
 [1576,'Arrival at destination after long journey; both finalmente orders retain anchors.'],
 [1604,'Imperfect street crossing interrupted by heard name call.'],
 [1618,'Plot village where everyone knows protagonist’s family; se passa numa valid.'],
 [1632,'Initial ignorance of reason door was open; ninguém with no extra não.'],
 [1646,'Talvez selects subjunctive fiquemos/vejamos, prospective se chover future subjunctive.'],
 [1660,'Imagined life in another country; conditional seria and morasse. Embedded como clause permits natural postverbal sua vida.'],
 [1674,'Supposed passport loss perca followed by advice seria melhor.'],
 [1716,'Regret about not asking for help when needed; negative perfect infinitive.'],
 [1730,'Formal thanks contrasted with writing legal; informal word is explicitly avoided.'],
 [1744,'Informal enthusiasm at reunion followed by need to leave now.'],
 [1786,'Job interview explicitly avoids cara address, not endorsing it as formal.'],
 [1800,'More formal language to unfamiliar recipient; relative negative clause.'],
 [1817,'Truth search requires revising conclusions with new evidence, qualified inquiry.'],
 [1831,'Personal view of wisdom acknowledges possibly mistaken convictions.'],
 [1845,'Belief can guide choices without adequate justification; both suficientes positions valid and clitic la refers crença.'],
 [1859,'Productive doubt investigates reasons supporting assertion.'],
 [1873,'Expression freedom contrasted with responsibility for statements.'],
 [1887,'Legal status distinguished from everyone’s conception of justice.'],
 [1901,'Convincing claim requires reliable supporting data; só será ... se and será ... só se preserve necessary condition.'],
 [1915,'Ad hominem described as attacking person without addressing ideas, not endorsed.'],
 [1929,'Attractive rhetoric not guarantee of truth; embora plus garanta, embedded seja.'],
 [1943,'Confirmation bias countered by contrary evidence; three também positions preserve inclusion.'],
 [1957,'Formal argument evaluation asks if conclusion follows from stated premises.'],
 [1971,'Persuasion asks explanation why proposal merits serious consideration.'],
 [1985,'Email forwards minutes for verification before document approval; aprová-la refers ata as document.'],
 [1999,'Presentation describes delegable tasks without quality compromise; quais tarefas object of delegar, not subject of será.'],
 [2013,'Agreement terms review conditional on efficiency preservation; desde que seja.'],
 [2027,'Report recommends extending deadline to permit careful analysis; para que possam.'],
 [2041,'Resumed negotiation after partner meeting based on identified priorities.'],
 [2055,'Gradual cost reduction conditional on investment approval; both gradual adjective placements valid.'],
 [2069,'Final film twist reinterprets apparently decorative early images; temporal narrative contrast.'],
 [2083,'Review praises characterization but questions whether ending fulfills expectations.'],
 [2097,'Controversial staging contrasted with critical masterpiece judgment; embora seja.'],
 [2111,'Musician reinterprets local rhythms for own sound; relative omitted subject same musician.'],
 [2125,'Alternating narrators exposes contradictory accounts; para que perceba.'],
 [2139,'Fragmented images explore memory; reader reconstructs past in extended gerund clause.'],
]);
if(notes.size!==96||portugueseWordOrder.some(r=>!notes.has(r[0])))throw Error('Incomplete individual review');
const set=await createPatchSet();portugueseWordOrderFixes(set);
const get=lessonRefs(set.snapshot,'pt'),fields=[],runtime=[];
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-652a416fcea0.json`,body=JSON.stringify({source_sha256:expected,snapshot_sha256:SNAPSHOT_SHA,rows:portugueseWordOrder,patches:set.patches(),originals:portugueseWordOrder.map(([n])=>get(n)),notes:Object.fromEntries(notes)},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
for(const[n]of portugueseWordOrder){
 const {exercise:e,ref}=get(n),p=set.patches().find(p=>p.id===e.id),a={...e,...p.after};
 for(const answer of [a.correct_answer,...a.accepted_answers]){
  if(!gradeAnswer(answer,a.correct_answer,a.accepted_answers,{exerciseHints:{exerciseType:e.type,skillType:e.skill_type,language:'pt'}}).isCorrect)throw Error(`Rejected reviewed answer ${ref}`);
  runtime.push({ref,answer,accepted:true});
 }
 for(const[field,after]of Object.entries(p.after))fields.push({reviewer:'root, independent of audit_spanish',reviewed_on:'2026-09-13',ref,table:'exercises',id:e.id,field,before:e[field],after,decision:'approve_as_correction',rationale:notes.get(n),source_sha256:expected,evidence:archive,evidence_sha256:sha(body)});
}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(x=>JSON.stringify(x)).join('\n')+'\n');
await writeFile(`${base}/runtime-results.jsonl`,runtime.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({rows:96,fields:fields.length,answers:runtime.length}));
