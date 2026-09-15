import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet,SNAPSHOT_SHA} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {koreanWordOrder,koreanWordOrderFixes} from './korean-word-order-fixes.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/ko-word-order-root-review';
const source='scripts/question-audit/korean-word-order-fixes.mjs';
const expected='09cc155c618f233d67723d4b2172f7c9cb825cbfb91b5a48593cb7c5f051077b';
const sha=x=>createHash('sha256').update(x).digest('hex');
if(sha(await readFile(source))!==expected)throw Error('Unreviewed source');
const notes=new Map([
 [566,'Nested husband/older-sister relation; doctor predicate and modifier agree.'],
 [578,'Warm-hearted spouse; really modifies character.'],[590,'Native age numeral and future next-year timing; add time after age complement.'],
 [602,'Hospital employment event with past spring timing.'],[614,'Weekly family-meal custom, six middle orders.'],[626,'Wedding calendar date and female-speaker kinship term.'],
 [638,'Embedded symptom question with recipient outside intact complement.'],[650,'Dentist treats aching tooth, not a sore doctor.'],[662,'Pharmacy consultation occasion and stress reason.'],
 [674,'Tired-day relative expression and short home rest.'],[686,'Health purpose and sufficient rest.'],[698,'Weight-loss purpose and reduction in sweet drinks, past event.'],
 [710,'Small sink, not small hands; retain modifier scope.'],[722,'Regular yard-sweeping event.'],[734,'Cramped kitchen explains difficulty cooking in new home.'],
 [746,'Neighbor source and embedded future rent rise.'],[758,'Noise reason and next-month moving intention.'],[770,'Two small rooms in apartment; postnominal native numeral.'],
 [782,'Embarrassment coexists with praise-induced happiness.'],[794,'Brave brother contrasted with fear of heights.'],[806,'Respectful teacher description using 분.'],
 [818,'Generous judgment illustrated by forgiving mistake with honorification.'],[830,'Lazy sibling scolded because of repeated homework delay.'],
 [854,'Past book purchase, new modifies book.'],[866,'Past-weekend Busan train trip and brother companion.'],[878,'Study event during trip at small school.'],
 [890,'Childhood play with cousins near home.'],[902,'Past-month work in new restaurant, not new home.'],[914,'Past detailed school-life account and older-sister recipient.'],
 [950,'Vacation-taking and travel as nominalized goal.'],[962,'Forthcoming consultation with teacher and stated goal; not full appointment-making skill certification.'],
 [974,'One-day prediction of daughter dream realization.'],[986,'Future trip planning with friends.'],[1070,'Personal Children’s Day gift, no universal custom claim.'],
 [1082,'Friend-made traditional food at party.'],[1094,'Song as marriage celebration with male-speaker older-sister relation.'],[1106,'Village performers, traditional modifies music.'],
 [1118,'Dance is subject of birthday-gift book.'],[1130,'Past dance watching and food eating linked by 도.'],
 [1142,'Opinion about society with freely expressing young people.'],[1156,'Agreement with increased political-interest obligation.'],[1170,'Attributed recovery contrasts with unstable employment.'],
 [1184,'Prior fact checking before policy debate.'],[1198,'Understanding different opinions supports worthwhile-participation judgment.'],[1212,'Concession and effort to understand opinion reasons.'],
 [1226,'Hiring combines experience and cooperation-ability assessment.'],[1240,'Reported dismissal and coworkers desire to know reason.'],[1254,'Meeting proposal to change plan for time saving.'],
 [1268,'Team-leading experience as preparation for management.'],[1282,'Earlier deadline causes decision to request coworker help.'],[1296,'Conditional completion and reflection on success/improvement.'],
 [1310,'Check inclusion of checked-baggage fee before booking.'],[1324,'Lost boarding pass motivates predeparture help request.'],
 [1338,'Delayed arrival notice, not late notification; root’s additional 미리 호텔에 order violates visible final 미리 연락했어요 anchor and is withdrawn.'],
 [1352,'Weather causes anticipated-hike cancellation and disappointment.'],[1366,'Getting lost during first adventure trip motivates map check.'],
 [1380,'Unrealized failure-to-book and room availability; alternative 방을 can be booking object with shared understood room.'],
 [1394,'Climate change and dwindling endangered-animal habitat; ordinary spaced 멸종 위기.'],[1408,'Wildlife conservation purpose and habitat protection priority.'],
 [1422,'Energy saving through lights in unused rooms.'],[1436,'Solar electricity conditional and possible pollution reduction.'],[1450,'Carbon-reduction purpose and conditional bicycle commuting.'],
 [1464,'Wildlife encounter concession and no-feeding recommendation; distance belongs to observation.'],[1478,'Permission question to photo subjects before upload.'],
 [1492,'Small-screen visibility problem and settings advice.'],[1506,'Keyboard entry context and pre-send typo check.'],[1520,'Access failure and password-change help from support.'],
 [1534,'AI-development condition, more modifies creative work not development.'],[1548,'Robot movement despite no instructions.'],
 [1562,'Unfamiliar sound outside door and character stopping.'],[1576,'Return found wallet to original owner as final successful event.'],[1604,'Imminent secret disclosure interrupted by ringing.'],
 [1618,'Complex-plot novel describes characters’ town in detail.'],[1632,'Beginning leaves departure reason unknown, why/still scope preserved.'],
 [1646,'Open rain condition and probable match postponement.'],[1660,'Fanciful bird condition with desired destination question.'],[1674,'Assumed failure followed by analysis then retry.'],
 [1688,'Wish for relaxed family time instead of weekend work.'],[1716,'Past counterfactual disclosure related to present regret.'],
 [1730,'Respectful request for design examples, not bare cool adjective.'],[1744,'Informal movie evaluation and unexpected final character return.'],
 [1758,'Explicit email-register substitution, not universal ban on 상관없어.'],[1772,'Respectful negative request and promised customer followup, valid spacing.'],
 [1786,'Adult attention-getting comparison, not insulting address instruction.'],[1800,'Adjust speech style for formal situation even with close friend.'],
 [1817,'Qualified negation distinguishes belief from objective grounding.'],[1831,'Wisdom includes openness to values, not knowledge alone.'],[1845,'Conviction and evidence-receptive attitude can coexist.'],
 [1859,'Doubted conclusion motivates renewed premise examination.'],[1873,'Freedom related to responsibility to respect others’ rights.'],[1887,'Justice meaning varies with adopted perspective.'],
 [1901,'Persuasive claim requires ability to present concrete evidence.'],[1915,'Perceived-error concession and specific identification; add preverbal-adverb-before-question order.'],
 [1929,'Rhetoric enables analysis of emotionally appealing expressions.'],[1943,'Single-case generalization risks reinforcing prejudice.'],[1957,'Debate needs responses and shared-premise checking.'],
 [1971,'Repeating rightness alone insufficient for persuasion.'],[1985,'Formal minutes review and deadline for identifying corrections.'],[1999,'Formal presentation of possible delegation effects.'],
 [2013,'Mutual efficiency purpose and respectful delivery-frequency proposal.'],[2027,'Report of delay causes/improvements explains deadline-extension need.'],[2041,'Networking contact trust enables later smooth negotiations.'],
 [2055,'Cost reduction and quality preservation as simultaneous proposal goals.'],[2069,'Narrative video art’s twist changes interpretation.'],[2083,'Balanced review of strengths/weaknesses with examples.'],
 [2097,'Film masterpiece evaluation explained by visuals and script.'],[2111,'Reported composition inspired by hometown scenery.'],[2125,'Novel writing contrasts character development with event listing.'],
 [2139,'Poem meaning and sound reveal new appeal.'],[2167,'Two commuting benefits make the one-stone idiom concrete.'],
]);
if(notes.size!==110||koreanWordOrder.some(r=>!notes.has(r[0])))throw Error('Incomplete independent notes');
const additions=new Map([[590,'제 남자친구는 스무 살이 내년에 돼요.'],[1915,'상대의 설명에 오류가 있다고 느껴지더라도 구체적으로 무엇이 문제인지 밝혀야 합니다.']]);
const set=await createPatchSet();koreanWordOrderFixes(set);
const get=lessonRefs(set.snapshot,'ko'),patches=new Map(set.patches().map(p=>[p.id,p]));
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-09cc155c618f.json`;
const body=JSON.stringify({source_sha256:expected,snapshot_sha256:SNAPSHOT_SHA,rows:koreanWordOrder,patches:set.patches(),originals:koreanWordOrder.map(([n])=>get(n)),notes:Object.fromEntries(notes)},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
const fields=[],runtime=[];
for(const[n]of koreanWordOrder){
 const{exercise:e,ref}=get(n),p=patches.get(e.id),after={...e,...p.after};
 const hints={exerciseHints:{exerciseType:e.type,skillType:e.skill_type,language:'ko'}};
 for(const answer of [after.correct_answer,...after.accepted_answers]){
  if(!gradeAnswer(answer,after.correct_answer,after.accepted_answers,hints).isCorrect)throw Error(`Rejected reviewed answer ${ref}`);
  runtime.push({ref,answer,accepted:true});
 }
 for(const field of new Set([...Object.keys(p.after),...(additions.has(n)?['accepted_answers']:[])])){
  const revise=field==='accepted_answers'&&additions.has(n),value=after[field];
  fields.push({reviewer:'root, independent of audit_german',reviewed_on:'2026-09-13',ref,table:'exercises',id:e.id,field,before:e[field],after:value,decision:revise?'revise':'approve_as_correction',rationale:notes.get(n),evidence:archive,evidence_sha256:sha(body),source_sha256:expected,...(revise?{recommended_after:[...value,additions.get(n)]}:{})});
 }
}
for(const[name,rows]of [['field-decisions',fields],['runtime-results',runtime]])await writeFile(`${base}/${name}.jsonl`,rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({rows:notes.size,fields:fields.length,pending:fields.filter(x=>x.decision==='revise').map(x=>x.ref),accepted_answers:runtime.length}));
