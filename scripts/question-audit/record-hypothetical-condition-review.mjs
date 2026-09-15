import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {b1HypotheticalConditionFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/b1-hypothetical-condition-fixes.mjs';
const base='docs/audits/question-verification/remediation/hypothetical-condition-root-review';
const source='docs/audits/question-verification/remediation/de-it-zh/b1-hypothetical-condition-fixes.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const expected='4b4fa4447b0217b0b571bfed79dad2137531643b98a6dc0e085f2a87ff805f7d';
if(sha(await readFile(source))!==expected)throw Error('Unreviewed source');
const set=await createPatchSet();b1HypotheticalConditionFixes(set);
const rows=[],fields=[],originals=[],additions={de:{},it:{},zh:{}};
const notes={
 1655:'Explicit no-car current fact fixes imagined-present reading; consequent seaside car journey unique among choices. DE hätte/würde fahren, IT avessi/andrei, ZH contextual 如果...就会 do not assert actual ownership or completed journey.',
 1656:'Little present free time anchors hypothetical reading. DE visible one-word hätte condition with synthetic läse or würde lesen result; additional middle-field dann valid. IT requested avessi/leggerei, optional io and allora variants preserve condition/result. ZH visible 如果我...我就 frame, 更多(的)时间 and 多读书; optional 会/的话 and traditional forms valid, without imaginary tense inflection.',
 1657:'Counterfactual present wealth with reduced work, English would/work/less explicit. Were and informal was both valid; rich/wealthy, clause order, contractions, optional then and commas checked. Only Chinese 很有钱 additionally permits very rich/very wealthy; no unexpressed intensifier added to DE/IT. Italian Marco context supplies masculine ricco and first-person forms.',
 1658:'Closed form targets uniquely select DE hätte, IT first-person avessi, ZH 会/會 versus misplaced experience 过. Genuine hypothesis from explicit context, not universal English-style tense mapping.',
 1661:'Real form/order errors: German finite liest after würde→lesen; Italian io leggerebbe→leggerei; Chinese misplaced 就 moves before 多. Keep-other-words constraint visible; IT/ZH comma omission and ZH traditional writing valid. Broader translation variants not silently allowed in constrained correction.',
 1664:'Stated little time today plus now in quotation makes imagined present the unique interpretation; neither completed past trip nor unconditional future appointment nor abundant present time follows.',
};
for(const lang of ['de','it','zh']){
 const get=lessonRefs(set.snapshot,lang);
 originals.push({language:lang,questions:Array.from({length:14},(_,i)=>get(1655+i))});
 for(const n of [1655,1656,1657,1658,1661,1664]){
  const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id);
  if(lang==='de'&&n===1656)additions.de[n]=['Wenn ich mehr Zeit hätte, würde ich dann mehr lesen.','Wenn ich mehr Zeit hätte, läse ich dann mehr.'];
  if(lang==='zh'&&n===1657)additions.zh[n]=[p.after.correct_answer,...p.after.accepted_answers].map(x=>x.replace(/\b(rich|wealthy)\b/,'very $1'));
  rows.push({...full,patch:p,root_note:notes[n]});
  for(const[field,after]of Object.entries(p.after)){
   const revise=field==='accepted_answers'&&additions[lang][n];
   fields.push({reviewer:'root, independent of audit_french',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,decision:revise?'revise':'approve_as_correction',rationale:notes[n],source_sha256:expected,...(revise?{recommended_after:[...after,...additions[lang][n]]}:{})});
  }
 }
}
if(Object.values(additions).flatMap(x=>Object.values(x)).flat().length!==50)throw Error('Unexpected additions');
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-4b4fa4447b02.json`,body=JSON.stringify({source_sha256:expected,rows,original_lessons:originals,requested_additions:additions},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
console.log(JSON.stringify({rows:18,full_originals:42,fields:fields.length,pending_arrays:fields.filter(x=>x.decision==='revise').length,requested_answers:50}));
