import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {ageBirthdayFixes} from './es-ja-ko-a1-age-birthday-fixes.mjs';
import {superlativeFixes} from './es-ja-ko-a2-superlative-fixes.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const helper='scripts/question-audit/topic-repair-helpers.mjs';
const helperSha='122867600b13d45539fcaecf2a7ceaa514ad9a4f132787d44433535a058b8f2c';
if(sha(await readFile(helper))!==helperSha)throw Error('Unreviewed helper');
const candidatePath='docs/audits/question-verification/remediation/es-ja-ko/topic-followup-adjudication.json';
const candidateText=await readFile(candidatePath,'utf8');
if(sha(candidateText)!=='1da57ae490e523c71ebf400835668fc7530d353349b1b04d8c2c5e2d0133e84f')throw Error('Changed candidates');
const candidates=JSON.parse(candidateText);
const configs=[
 {batch:'ages',base:'es-ja-ko-age-root-review',source:'scripts/question-audit/es-ja-ko-a1-age-birthday-fixes.mjs',hash:'ac4416f9ed1e10ed8d077c5adaf2679693c6d3bba7a294ad9d389ce5d6cba8a7',apply:ageBirthdayFixes,first:375,expectedAdditions:18,notes:{
 375:'Named family age is twelve, not twenty/two/ten. Spanish tener, Japanese 歳です and Korean native-number 살 predicates accurately express the stated age. Context supplies younger sister in JA/KO.',
 376:'Age twenty and first person preserved. ES tener visibly requested, optional yo/number digits valid. JA 私は/politeです visible, ordinary age spellings accepted. KO 저는/살/polite요 visible; 나이가 and colloquial age-attainment 먹었어요 preserve those constraints. NIKL 먹다 sense7 supports age use; complete self-introduction current-age reading is an independent contextual judgment, not quoted dictionary text.',
 377:'All sources state speaker birthday in May. English contracted/expanded/copular alternatives preserve possession and month; two additional ordinary phrasings needed because no English template is prescribed.',
 378:'Full contextual age blank selects tiene for Spanish third-person present, 歳/才/さい Japanese counter, 살 Korean native-number counter. Different age units/subject forms cannot fill the requested relation.',
 }},
 {batch:'superlatives',base:'es-ja-ko-superlative-root-review',source:'scripts/question-audit/es-ja-ko-a2-superlative-fixes.mjs',hash:'7e8d6a50740f02b3f56341df383afeb42261cc07f8725bb102f0824431761aa5',apply:superlativeFixes,first:1017,expectedAdditions:64,notes:{
 1017:'Three explicit ascending prices unambiguously make book C most expensive. Spanish más caro/Japanese 一番高い/Korean 가장 비싸요 are contextual price superlatives, not arbitrary glosses.',
 1018:'Explicit three-book comparison supports cheapest relation. Spanish el más barato article agrees; JA は/が and identifying reversals permitted under politeです; KO 가장/제일 and nominalized 싼 forms preserve requested 싸다/이 책/polite요. Expressing the already supplied group in JA/KO is legitimate, as in existing Spanish de los tres.',
 1019:'Hotel is minimum price within city/town, not merely cheaper than another hotel or a country-wide minimum. English cheapest/least expensive, identifying reversal and locative fronting preserve complete relation; short introductory comma optional.',
 1020:'Full three-hotel comparison fixes most-expensive superlative. ES closed más/menos selects accented más; JA 一番/最も with kana forms both valid; KO 가장/제일 both valid. More/very/somewhat do not answer the requested maximum relation.',
 }},
];
for(const config of configs){
 if(sha(await readFile(config.source))!==config.hash)throw Error('Unreviewed source');
 const set=await createPatchSet();config.apply(set);
 const base=`docs/audits/question-verification/remediation/${config.base}`,rows=[],originals=[],fields=[],additions={};
 for(const lang of ['es','ja','ko']){
  const get=lessonRefs(set.snapshot,lang);
  originals.push({language:lang,questions:Array.from({length:12},(_,i)=>get(config.first+i))});
  for(let n=config.first;n<config.first+4;n++){
   const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id);
   const more=candidates.rows.filter(r=>r.batch===config.batch&&r.language===lang&&r.n===n).flatMap(r=>r.candidates);
   if(more.length)additions[full.ref]=more;
   rows.push({...full,patch:p,root_note:config.notes[n]});
   for(const[field,after]of Object.entries(p.after)){
    const revise=field==='accepted_answers'&&more.length>0;
    fields.push({reviewer:'root, independent of audit_german',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,decision:revise?'revise':'approve_as_correction',rationale:config.notes[n],source_sha256:config.hash,...(revise?{recommended_after:[...after,...more]}:{})});
   }
  }
 }
 if(Object.values(additions).flat().length!==config.expectedAdditions||rows.length!==12)throw Error('Incomplete review');
 await mkdir(base,{recursive:true});
 const archive=`${base}/reviewed-source-${config.hash.slice(0,12)}.json`,body=JSON.stringify({source_sha256:config.hash,helper_sha256:helperSha,rows,original_lessons:originals,requested_additions:additions,candidate_evidence:candidatePath,candidate_evidence_sha256:sha(candidateText),supplementary_sources:config.batch==='ages'?['https://krdict.korean.go.kr/kor/dicSearch/SearchView?ParaWordNo=58272']:[]},null,2)+'\n';
 try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
 await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
 console.log(JSON.stringify({batch:config.batch,rows:12,full_originals:36,fields:fields.length,pending_arrays:fields.filter(x=>x.decision==='revise').length,requested_answers:config.expectedAdditions}));
}
