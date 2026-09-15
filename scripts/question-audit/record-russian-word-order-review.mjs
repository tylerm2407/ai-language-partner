import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet,SNAPSHOT_SHA} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {russianWordOrder,russianWordOrderFixes} from './russian-word-order-fixes.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/ru-word-order-root-review';
const expected='2c8409a63484403a6faf1901c5583ee81c9aaed0dc12231726e645931066037e';
const sha=x=>createHash('sha256').update(x).digest('hex');
if(sha(await readFile('scripts/question-audit/russian-word-order-fixes.mjs'))!==expected)throw Error('Changed source');
const notes=new Map([
 [566,'Aunt’s husband works as doctor: genitive моей тёти, instrumental врачом and hospital locative agree.'],
 [578,'Brother’s wife knows family; both хорошо placements preserve manner and selected object order.'],
 [590,'Boyfriend age uses dative Моему парню and twenty-one singular год, not dictionary nominative.'],
 [602,'Girlfriend will graduate next year; perfective окончит university accusative.'],
 [614,'Neighbor lunches with parents each Sunday; both instrumental companion positions valid.'],
 [626,'Sister’s wedding at end of August; prospective состоится, date genitive.'],
 [638,'Nurse asks about fever, есть ли existential question; no English tense backshift imposed.'],
 [650,'Dentist will examine aching tooth tomorrow morning; больной зуб legitimate symptomatic reading.'],
 [662,'Pharmacy question about stress relief supplies contextual location without medical efficacy claim.'],
 [674,'Friend looks tired when anxious; instrumental усталым with выглядит.'],
 [686,'Resting in silence after work; infinitive complement люблю отдыхать.'],
 [698,'Doctor explains need for diet; dative мне and predicate нужна agree with диета in both orders.'],
 [710,'Future dishwashing in new kitchen; буду мыть imperfective compound future.'],
 [722,'Helping mother sweep on Saturdays; dative маме before/after помогаю both within task.'],
 [734,'Cooking together in new home, future activity and moving context.'],
 [746,'Neighbor reports rental cost; embedded сколько costs question permits subject after стоит.'],
 [758,'Desired relocation because noisy apartment; переехать aspect counterpart of original target.'],
 [770,'Apartment beside park; рядом с instrumental, городской парк inflected correctly.'],
 [782,'Shy brother nevertheless enjoys friend meetings, adding actual positive emotion.'],
 [794,'Brave father fears dogs, genuine negative emotion despite positive trait.'],
 [806,'Kind grandfather helps elderly neighbors; dative plural object.'],
 [818,'Generosity shown by sharing food; instrumental едой placements preserve meaning.'],
 [830,'He takes offense when friends call him lazy; emotional reaction, embedded predicate.'],
 [842,'Patient teacher calmly explains mistakes; both calmly placements preserve manner.'],
 [950,'Learning to swim before vacation starts adds explicit life goal.'],
 [962,'Appointment goal uses записаться к врачу на пятницу; both infinitive/dative orders valid.'],
 [974,'Dream will soon come true, actual prediction; feminine possessive and perfective сбудется.'],
 [986,'Future trip planning after family dinner, imperfective планировать intentional activity.'],
 [998,'Higher ticket price explained by luggage inclusion, not invented actual carrier terms.'],
 [1010,'Brother five centimeters taller; comparative genitive меня and measure на пять сантиметров.'],
 [1022,'Lowest building explicitly below all other buildings on street; genuine superlative use of comparative ниже.'],
 [1034,'More expensive computer nonetheless considerably faster; comparative quality and price.'],
 [1046,'Choosing slower train despite speed, actual preference with concessive хотя.'],
 [1058,'Best option for small family; superlative лучший and genitive family phrase.'],
 [1070,'New Year gifts to children, personal practice rather than universal cultural rule.'],
 [1082,'Grandmother makes pancakes using family recipe; actual food-tradition context.'],
 [1094,'Future celebration through music and dance, instrumental pair.'],
 [1106,'Festival music until late evening supplies event context.'],
 [1118,'Prepared dance as grandmother’s gift, в подарок plus dative.'],
 [1130,'Recurring autumn family festival attendance, accusative festival.'],
 [1142,'Opinion on society’s elder care; должно заботиться о locative and more positions valid.'],
 [1156,'Agreement with person but disagreement on policy fairness; dative experiencer мне.'],
 [1170,'Article on rising prices affecting economy; рост цен subject and на accusative.'],
 [1184,'Debating poverty causes requires first studying facts; both сначала placements preserve sequence.'],
 [1198,'Debate participation motivated by outcome affecting neighborhood; plural их with дебатах.'],
 [1212,'Reason states families cannot pay treatment; заключается в том, что clausal complement.'],
 [1226,'Interview asks when hiring will begin; Russian future in indirect question matches English would.'],
 [1240,'Manager reports no planned firings after merger; увольнять imperfective intention.'],
 [1254,'Meeting explains one-week delay; задержалась на неделю, reason вопрос почему.'],
 [1268,'Manager career goal links leadership instrumental командой and project development.'],
 [1296,'Contractor failed to prepare documents, explaining postponed project.'],
 [1310,'Booking checks whether baggage included in flight price, входит ли question exempt from subject rule.'],
 [1338,'Reception explains train delay prevented timely arrival, помешала мне приехать.'],
 [1352,'Road flooded by heavy rain, forced cancellation; пришлось plus infinitive.'],
 [1366,'Adventure becomes dangerous after losing way and group contact.'],
 [1380,'Tourist asks bicycle rental location for exploring city; взять напрокат, purpose чтобы.'],
 [1408,'Wildlife protection includes habitats for living/breeding; где relative location.'],
 [1422,'Turning off lights in unused rooms saves energy; которыми instrumental with пользуемся.'],
 [1436,'Solar panels generate without polluting smoke, contextual operational claim not lifecycle guarantee.'],
 [1450,'More frequent public transport as carbon reduction attempt; instrumental transport and both чаще positions.'],
 [1478,'Permission before photo upload; разрешения genitive with спрашиваю, у friends source.'],
 [1492,'Screen dimmed after phone began quickly losing charge; quickly remains scoped to loss, not onset.'],
 [1506,'Keyboard makes long messages more comfortable; three impersonal locative/adverb placements valid.'],
 [1548,'Robot answers but not always understands interlocutor intentions; не всегда partial negation.'],
 [1562,'Map found then road search; three затем positions preserve sequence and anchors.'],
 [1576,'Long journey concludes at village; finally positions preserve narrative result.'],
 [1604,'Imperfective street crossing interrupted by perfective heard cry; genuine ongoing/completed contrast.'],
 [1618,'Village plot setting and residents’ shared family history; descriptive narrative.'],
 [1632,'Story opening mystery of heroine refusing stranger entry; никто не required negative concord.'],
 [1646,'Future bad weather condition and possible film/home result, no imported English tense prohibition.'],
 [1660,'Imagined changed life abroad uses бы, indirect как clause. Existing particle variants valid; two additional subject-first orders requested.'],
 [1674,'Supposed passport loss followed by consular-help advice; тебе стоит обратиться.'],
 [1688,'Wish to spend weekend in nature rather than noisy party; вместо genitive.'],
 [1702,'Missed train counterfactual via otherwise and бы, both particle placements valid.'],
 [1716,'Regret for failure to support close friend; не смог supplies past inability.'],
 [1730,'Formal благодарю вас contrasted with colloquial круто; explicit audience/register practice.'],
 [1744,'Reunion after years apart, потрясающе colloquial evaluative predicate; three additional с тобой placements requested.'],
 [1758,'Business refusal explains reason instead of dismissive неважно, quoted word instrumental metalinguistic use.'],
 [1786,'Interview avoids dude address for stranger, contextual register not universal ban.'],
 [1800,'Formal style for unknown addressee, которого direct object in relative clause.'],
 [1817,'Truth seeking requires revising beliefs against contradictory new facts, sustained abstract reasoning.'],
 [1831,'Wisdom contrasted with certainty of being right; not-in/but-in parallelism and error acknowledgment.'],
 [1845,'Beliefs affect decisions even without evidence; object его after infinitive; even-if variants valid.'],
 [1859,'Doubt separates verified information from merely reliable-seeming assumptions; от genitive.'],
 [1873,'Freedom entails consequences affecting self and others, not-only/but-also scope retained.'],
 [1887,'Diverse justice concepts motivate open discussion/justification; two therefore positions preserve causal relation.'],
 [1901,'Convincing claim conditional on evidence explanation; in-that-only-case particle variant retained.'],
 [1915,'Misconception of opinion popularity proving truth; якобы scopes reported erroneous claim in both placements.'],
 [1929,'Rhetoric attracts attention but cannot replace evidence/reasoning; сама по себе feminine agreement.'],
 [1943,'Bias described as preemptive rejection of contradicting evidence; all three заранее placements valid.'],
 [1957,'Argument connects evidence to conclusion rather than personal attacks, genuine formal debate content.'],
 [1971,'Persuasion requires audience interests and responding to objections, not repetition alone.'],
 [1985,'Business email forwards minutes and requests corrections, both неточно placements valid.'],
 [1999,'Presentation on safely delegating tasks; embedded какие задачи indirect question and dative партнёрам movements valid.'],
 [2013,'Contract renegotiation conditional on sustained effectiveness and predictable costs, future perfective снизится.'],
 [2041,'Potential partner meeting leads to negotiation using identified priorities, networking context.'],
 [2055,'Cost reduction proposal conditional on investment agreement; удастся ли impersonal embedded question.'],
 [2083,'Book review contrasts expressive language with implausible denouement, relative к которой.'],
 [2097,'Mixed reception versus critics’ masterpiece assessment of staging, instrumental шедевром.'],
 [2111,'Composer transforms folk rhythm for modern audience, purpose clause чтобы звучали.'],
 [2125,'Alternating narrators expose contradictions about same events, одних и тех же idiomatic identity.'],
 [2139,'Fragmented poetic loss images allow independent reconstruction; dative recipient can follow возможность, two alternatives requested.'],
 [2153,'Surprise context combines проболтаться with genuine держать язык за зубами idiom.'],
]);
if(notes.size!==103||russianWordOrder.some(r=>!notes.has(r[0])))throw Error('Incomplete individual notes');
const pending=new Set([1660,1744,2139]);
const set=await createPatchSet();russianWordOrderFixes(set);
const get=lessonRefs(set.snapshot,'ru'),fields=[],runtime=[];
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-2c8409a63484.json`,body=JSON.stringify({source_sha256:expected,snapshot_sha256:SNAPSHOT_SHA,rows:russianWordOrder,patches:set.patches(),originals:russianWordOrder.map(([n])=>get(n)),notes:Object.fromEntries(notes)},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
for(const[n]of russianWordOrder){
 const {exercise:e,ref}=get(n),p=set.patches().find(p=>p.id===e.id),a={...e,...p.after};
 for(const answer of [a.correct_answer,...a.accepted_answers]){
  if(!gradeAnswer(answer,a.correct_answer,a.accepted_answers,{exerciseHints:{exerciseType:e.type,skillType:e.skill_type,language:'ru'}}).isCorrect)throw Error(`Rejected reviewed answer ${ref}`);
  runtime.push({ref,answer,accepted:true});
 }
 for(const[field,after]of Object.entries(p.after))fields.push({reviewer:'root, independent of audit_spanish',reviewed_on:'2026-09-13',ref,table:'exercises',id:e.id,field,before:e[field],after,decision:field==='accepted_answers'&&pending.has(n)?'revise':'approve_as_correction',rationale:notes.get(n),source_sha256:expected,evidence:archive,evidence_sha256:sha(body)});
}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(x=>JSON.stringify(x)).join('\n')+'\n');
await writeFile(`${base}/runtime-results.jsonl`,runtime.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({rows:103,fields:fields.length,answers:runtime.length,pending_arrays:fields.filter(x=>x.decision==='revise').length}));
