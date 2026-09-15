import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {frenchTopicFixes} from '../../docs/audits/question-verification/remediation/fr-pt-ru/french-topic-proposals.mjs';
const base='docs/audits/question-verification/remediation/fr-topic-root-review';
const source='docs/audits/question-verification/remediation/fr-pt-ru/french-topic-proposals.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const sourceSha=sha(await readFile(source));
if(sourceSha!=='af27c1793d8807681ee18c29eaad42fc9b6ff4d54aff05bb772afdcd6c75edf2')throw Error('Unreviewed source');
const set=await createPatchSet();frenchTopicFixes(set);
const get=lessonRefs(set.snapshot,'fr');
const notes=new Map([
 [241,'Robe means dress and belongs to clothing, unlike isolated heure/time. Old Hour alternative must not carry over.'],
 [242,'Both t and te complete Ver to the masculine/feminine green adjective; tomorrow was unrelated to clothing/colors.'],
 [245,'Dictating robe reinforces clothing; transcript/key/hint are synchronized and the old heure card is detached.'],
 [246,'Listening to robe selects Dress uniquely among Shirt/Blue/Dress/Shoes; old heure card is detached.'],
 [317,'Il pleut means it is raining, uniquely among the four weather options; reading was unrelated to weather.'],
 [318,'Windy is il y a du vent or il vente, replacing unrelated cooking; also accept dictionary-attested Il fait du vent.'],
 [319,'Il fait beau expresses nice weather, replacing football; ordinary short English/weather contractions need a rejection check before release.'],
 [324,'Prin plus temps forms printemps/spring, replacing unrelated friend; previous amie completion is inapplicable.'],
 [325,'Il pleut is the correct rain transcript; English hint agrees and unrelated lire card is detached.'],
 [326,'Il pleut selects It is raining uniquely from weather choices, with unrelated lire card detached.'],
]);
const fields=[],rows=[];
for(const[n,note]of notes){
 const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id);
 rows.push({...full,patch:p,note});
 for(const[field,after]of Object.entries(p.after))fields.push({reviewer:'root, independent of author audit_spanish',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,decision:field==='accepted_answers'&&[318,319].includes(n)?'revise':'approve_as_correction',rationale:note,source_sha256:sourceSha,...(n===318&&field==='accepted_answers'?{recommended_after:[...after,'Il fait du vent.'],sources:['https://www.larousse.fr/dictionnaires/francais-anglais/vent/80457','https://www.dictionnaire-academie.fr/article/A9V0381']}:{})});
}
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-${sourceSha.slice(0,12)}.json`,body=JSON.stringify({source_sha256:sourceSha,rows},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
console.log(JSON.stringify({rows:rows.length,fields:fields.length,pending:fields.filter(f=>f.decision==='revise').map(f=>`${f.ref}.${f.field}`)}));
