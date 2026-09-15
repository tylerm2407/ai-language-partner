import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet,SNAPSHOT_SHA} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {frenchWordOrder,frenchWordOrderFixes} from './french-word-order-fixes.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/fr-word-order-root-review';
const expected='a371330f1da35246190f7233718e20bac69df0d139f44d4709b01519d3f34a1b';
const sha=x=>createHash('sha256').update(x).digest('hex');
if(sha(await readFile('scripts/question-audit/french-word-order-fixes.mjs'))!==expected)throw Error('Unreviewed source');
const notes=new Map([
 [566,'Aunt’s husband is an uncle by marriage; linked possessives and mon agree.'],
 [578,'Wife and female friend relation explicit; une amie de ma sœur preserves indefinite friendship.'],
 [614,'Habitual Sunday lunch with grandparents supplies family tradition, not merely neighbor noun.'],
 [626,'Wedding future aura lieu in June; feminine cousin selected by supplied tiles.'],
 [638,'Nurse asks about fever: si j’ai is an embedded yes/no question, not conditional.'],
 [650,'Dental appointment demain matin; chez with professional, both anchored words preserved.'],
 [662,'Pharmacist advice on stress reduction, without asserting medical treatment efficacy.'],
 [674,'Feeling tired after difficult day is contextual wellbeing practice.'],
 [698,'Doctor’s balanced diet recommendation in review; régime alimentaire removes political-regime sense.'],
 [710,'Washing machine location relative to fridge fits rooms/furniture.'],
 [722,'Obligation to sweep kitchen floor, not noun recognition.'],
 [734,'Space to cook in new apartment contextualizes housing.'],
 [746,'Neighbor pays same rent as us; le même ... que comparison correct.'],
 [758,'Move motivated by noisy apartment fits home problems and parce que cause.'],
 [770,'Two bedrooms plus small balcony; cet agrees with appartement.'],
 [782,'Shy brother nevertheless happy with friends includes positive emotion.'],
 [794,'Brave father nonetheless fears snakes includes negative emotion.'],
 [806,'Kind cousin toward all children; gentil avec natural.'],
 [818,'Generosity expressed through sharing lunch; possessives preserve subject.'],
 [830,'Reaction se fâche to being called lazy; traiter de construction valid.'],
 [842,'Remaining patient during speaker mistakes; quand temporal relation correct.'],
 [950,'Learning to swim before vacation is an explicit goal.'],
 [962,'Appointment for next Monday; prendre rendez-vous pour marks date.'],
 [974,'Future dream realization plus un jour fits prediction.'],
 [986,'Near-future planifier next trip ensemble fits future-plan review.'],
 [1070,'Fictional family gives each child Christmas gift, not a national universal.'],
 [1082,'Traditional cake prepared for family party fits food traditions.'],
 [1094,'Celebration through music/dances fits lesson; plural des danses legitimate.'],
 [1106,'Festival music on square; il y a and sur la place valid.'],
 [1118,'Offrir sister dance lessons expresses gift action.'],
 [1130,'Annual family attendance at village festival fits cultural review.'],
 [1142,'Opinion plus education making society fairer; rendre ... plus juste construction.'],
 [1156,'Respect opinion but disagree with policy; politique contextual policy not partisan politics.'],
 [1170,'Article explains tourism impact on local economy, embedded comment.'],
 [1184,'Argument in favor of reform and effects on families fits social issues.'],
 [1198,'Participation reason tied to neighborhood effect; parce que causal.'],
 [1212,'Inability to afford rent expressed ne peuvent pas payer; no hidden only synonym.'],
 [1226,'Interview question with past projected hiring comptait embaucher.'],
 [1240,'Reported planned layoffs: devrait licencier is future in past; informed agreement with nous.'],
 [1254,'Meeting explanation of prior delay with avait pris du retard.'],
 [1268,'Career aspiration devenir directeur plus purpose diriger own team.'],
 [1296,'Postponed project because information was missing; information plural French valid.'],
 [1310,'Flight booking checks baggage inclusion, without asserting airline policy.'],
 [1338,'Same-subject arrival gerund plus train prior delay in hotel context.'],
 [1352,'Cancelled excursion because closed road; passé composé event/imperfect state.'],
 [1366,'Adventure complicated at missed last bus; pronominal agreement s’est compliquée.'],
 [1380,'Tourist’s indirect route question uses comment aller and sans prendre.'],
 [1408,'Forest conservation supported by animal habitat reason; y correctly refers to forests.'],
 [1422,'Turning lights off on departure is contextual energy conservation.'],
 [1436,'Solar power without burning coal fits pollution topic without universal zero-impact claim.'],
 [1450,'Rail instead of plane expresses carbon-reduction choice in sustainability lesson.'],
 [1478,'Asking depicted people permission before uploading photo fits social-media action.'],
 [1492,'Reduced brightness because nearly depleted battery; state/event contrast.'],
 [1506,'Keyboard preference for long messages plus comparative comfort rationale.'],
 [1548,'Robot capability qualified by not always understanding context; negation scope preserved.'],
 [1562,'Found map before search; four ensuite placements preserve event order and both anchors.'],
 [1576,'Reached village after walking for hours; three enfin placements preserve final achievement.'],
 [1604,'Imperfect walking interrupted by completed hearing of noise; same male character.'],
 [1618,'Plot located in village with reciprocal knowing; où and se connaître valid.'],
 [1632,'Nobody knew previous letter author: ne ... personne subject plus plus-que-parfait.'],
 [1646,'Real rain condition present pleut, future resterons and perhaps uncertainty.'],
 [1660,'Imagined residence: ferais conditional with pouvais imperfect.'],
 [1674,'Supposons que plus perdes subjunctive, consular contact advice devrais.'],
 [1702,'Past regret contrasts actual late departure with counterfactual missed train.'],
 [1716,'Regret plus negative perfect infinitive not having accepted invitation.'],
 [1730,'Explicit register comparison thank-you versus génial, not teaching slang as formal.'],
 [1744,'Informal super meeting with obligation to return before midnight.'],
 [1786,'Professional interview explicitly avoids mec; not presented as appropriate address.'],
 [1800,'More formal tone to unknown addressee, relative ne connais pas.'],
 [1817,'Truth inquiry requires distinction between facts and interpretations; subjunctive distinguions.'],
 [1831,'Not only knowing but recognizing knowledge limits; coordinated infinitives.'],
 [1845,'Belief may give meaning without proving asserted content; no assertion that belief proves itself.'],
 [1859,'Useful doubt examines evidence instead of rejecting all novelty.'],
 [1873,'Ne saurait justifier conveys cannot legitimately justify threats to others.'],
 [1887,'Justice-oriented society ensures everyone can assert rights; veiller à ce que puisse.'],
 [1901,'Qualified assertion remains contestable while lacking verifiable grounding.'],
 [1915,'False-dilemma critique gives alternative solutions rather than endorsing the fallacy.'],
 [1929,'Rhetoric does not excuse evidence requirement; dispenser de and à l’appui de valid.'],
 [1943,'Identifies prejudicial overgeneralization to all group members, not endorsing it.'],
 [1957,'Examines conclusion-premise relation; alternate réellement placement keeps both anchors.'],
 [1971,'Persuasion requires addressing skeptical audience objections not ignoring them.'],
 [1999,'Presentation schedule plus specifying future delegable tasks; pourrons prospective can.'],
 [2013,'Conditional compromise acceptance if effectiveness not impaired; subjunctive soit compromise.'],
 [2027,'Report recommends deadline extension for teams to verify; afin que puisse.'],
 [2041,'Professional gathering proposal after consulting partners; perfect infinitive establishes prior consultation.'],
 [2055,'Proposal conditional on additional cost coverage; sous réserve que soient pris en charge.'],
 [2069,'Film twist prompts reinterpretation of opening imagery, a contextual art description.'],
 [2083,'Review praises style but regrets shallow characters; tout en regrettant que plus subjunctive.'],
 [2097,'Although staging divides viewers some judge masterpiece; bien que divise is subjunctive-compatible.'],
 [2111,'Composer draws on melodies and changes their rhythms; dont possessive relation correct.'],
 [2125,'Alternating viewpoints to reveal motivations gradually; both adverb orders retain endpoints.'],
 [2139,'Poem conveys solitude without directly naming it; both directement positions preserve meaning.'],
]);
if(notes.size!==92||frenchWordOrder.some(r=>!notes.has(r[0])))throw Error('Incomplete individual review');
const set=await createPatchSet();frenchWordOrderFixes(set);
const get=lessonRefs(set.snapshot,'fr'),fields=[],runtime=[];
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-a371330f1da3.json`,body=JSON.stringify({source_sha256:expected,snapshot_sha256:SNAPSHOT_SHA,rows:frenchWordOrder,patches:set.patches(),originals:frenchWordOrder.map(([n])=>get(n)),notes:Object.fromEntries(notes)},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
for(const[n]of frenchWordOrder){
 const {exercise:e,ref}=get(n),p=set.patches().find(p=>p.id===e.id),a={...e,...p.after};
 for(const answer of [a.correct_answer,...a.accepted_answers]){
  if(!gradeAnswer(answer,a.correct_answer,a.accepted_answers,{exerciseHints:{exerciseType:e.type,skillType:e.skill_type,language:'fr'}}).isCorrect)throw Error(`Rejected reviewed answer ${ref}`);
  runtime.push({ref,answer,accepted:true});
 }
 for(const[field,after]of Object.entries(p.after))fields.push({reviewer:'root, independent of audit_spanish',reviewed_on:'2026-09-13',ref,table:'exercises',id:e.id,field,before:e[field],after,decision:'approve_as_correction',rationale:notes.get(n),source_sha256:expected,evidence:archive,evidence_sha256:sha(body)});
}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(x=>JSON.stringify(x)).join('\n')+'\n');
await writeFile(`${base}/runtime-results.jsonl`,runtime.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({rows:92,fields:fields.length,answers:runtime.length}));
