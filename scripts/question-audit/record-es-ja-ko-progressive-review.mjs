import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {pastProgressiveFixes} from './es-ja-ko-b1-past-progressive-fixes.mjs';
const base='docs/audits/question-verification/remediation/es-ja-ko-progressive-root-review';
const source='scripts/question-audit/es-ja-ko-b1-past-progressive-fixes.mjs';
const expected='7a5f0f19d74e0abfdc2d35cad32d90fbb4fad7b5b71f6ec99d07514d1cba641c';
const sha=x=>createHash('sha256').update(x).digest('hex');
if(sha(await readFile(source))!==expected)throw Error('Changed source');
if(sha(await readFile('scripts/question-audit/topic-repair-helpers.mjs'))!=='122867600b13d45539fcaecf2a7ceaa514ad9a4f132787d44433535a058b8f2c')throw Error('Changed helper');
const set=await createPatchSet();pastProgressiveFixes(set);
const originals=[],rows=[],fields=[];
const requested=[
 'Ayer por la noche, a las ocho, estaba leyendo un libro.',
 'Ayer por la noche, a las ocho, yo estaba leyendo un libro.',
 'Ayer por la noche a las ocho estaba leyendo un libro.',
 'Ayer por la noche a las ocho yo estaba leyendo un libro.',
];
requested.push(...requested.map(x=>x.replace('ocho','8')));
const notes={
 1585:'Short source says reading in progress at eight, then closing book at nine. English MC reading is uniquely supported; writing/buying/closing at eight are not. Spanish estaba leyendo, Japanese 読んでいました, Korean 읽고 있었어요 carry ongoing meaning in this context; no imported universal tense equivalence.',
 1586:'Complete reading-at-eight-last-night translation with visible selected progressive. Spanish imperfect estar+gerund, subject omission and standard time orders checked; additional ayer por la noche placements requested. Japanese supplied 昨夜八時に/本を and polite 読んでいました with natural understood subject omission; numeral/kana forms valid. Korean supplied 어젯밤 여덟 시에/책을 and polite 읽고 있었어요, ordinary subject omission and digit spacing variants valid. These lexical/form constraints are visible rather than hidden grading rules.',
 1587:'Full reading/phone-ringing relation, not an assertion of finishing or stopping reading. English when/while clause order and singular a/one book variants preserve meaning. Japanese 一冊/Korean 한 권 bound book quantity; no target-language article means a/the phone both possible. Spanish el teléfono supports the phone. Korean -고 있을 때 can be relative to past 울렸어요 without every clause copying English past morphology.',
 1588:'Complete contextual blank uniquely selects Spanish yo estaba, Japanese polite past いました, Korean requested -어요 past 있었어요. Incorrect person, present forms or malformed endings do not satisfy the visible instruction; no unsupported lexical fragment remains.',
};
for(const lang of ['es','ja','ko']){
 const get=lessonRefs(set.snapshot,lang);
 originals.push({language:lang,questions:Array.from({length:14},(_,i)=>get(1585+i))});
 for(const n of [1585,1586,1587,1588]){
  const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id);
  rows.push({...full,patch:p,root_note:notes[n]});
  for(const[field,after]of Object.entries(p.after)){
   const revise=lang==='es'&&n===1586&&field==='accepted_answers';
   fields.push({reviewer:'root, independent of audit_german',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,decision:revise?'revise':'approve_as_correction',rationale:notes[n],source_sha256:expected,...(revise?{recommended_after:[...after,...requested]}:{})});
  }
 }
}
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-7a5f0f19d74e.json`,body=JSON.stringify({source_sha256:expected,rows,original_lessons:originals,requested_additions:requested},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
console.log(JSON.stringify({rows:12,full_originals:42,fields:fields.length,pending_arrays:fields.filter(x=>x.decision==='revise').length,requested_answers:8}));
