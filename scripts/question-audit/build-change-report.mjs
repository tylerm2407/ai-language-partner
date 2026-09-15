// Reproducible human-readable index; exact before/after values remain in the
// reviewed JSON rather than being truncated or paraphrased into new claims.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
const base='docs/audits/question-verification/remediation';
const text=await readFile(`${base}/draft-patches.json`,'utf8');
const draft=JSON.parse(text),review=JSON.parse(await readFile(`${base}/current-review-status.json`,'utf8'));
const sha=createHash('sha256').update(text).digest('hex');
if(review.draft_sha256!==sha)throw Error('Review status belongs to a different draft');
const set=await createPatchSet(),s=set.snapshot;
const maps=Object.fromEntries(Object.entries(s).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,new Map(v.map(r=>[r.id,r]))]));
const refs=new Map();
for(const lang of ['es','fr','de','it','pt','ja','ko','zh','ru']){
 const get=lessonRefs(s,lang);
 for(let n=1;n<=2312;n++){const x=get(n);refs.set(x.exercise.id,x.ref);}
}
const lineMap=new Map(text.split('\n').flatMap((line,i)=>{
 const m=line.match(/^      "id": "([^"]+)",$/);return m?[[m[1],i+1]]:[];
}));
const clean=x=>String(x??'').replace(/[\r\n]+/g,' ').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;').replace(/\|/g,'\\|');
const rows=draft.patches.map(p=>{
 // An insert has no frozen row: the authored payload IS the record. Everything
 // below reads context off `original`, so a synthesised one keeps that working
 // and the report describes a new row rather than throwing on it.
 const original=p.op==='insert'?{id:p.id,...p.after}:maps[p.table]?.get(p.id);
 if(!original)throw Error(`Missing row ${p.id}`);
 const lesson=p.table==='lessons'?original:maps.lessons?.get(original.lesson_id);
 const passage=maps.reading_passages?.get(original.passage_id);
 const unit=maps.units?.get(original.unit_id??lesson?.unit_id);
 const course=maps.courses?.get(original.course_id??passage?.course_id??unit?.course_id);
 const language=original.language??course?.target_language??'unresolved';
 const level=original.cefr_level??original.band??course?.cefr_level??'shared';
 const question=original.prompt??original.prompt_text??original.question_text??original.title??original.rule_name??original.target_text??'';
 if(!lineMap.has(p.id))throw Error(`Missing exact JSON link ${p.id}`);
 return {p,language,level,ref:refs.get(p.id)??`${p.table}/${p.id}`,context:[unit?.title,lesson?.title,passage?.title].filter(Boolean).join(' / '),question};
});
const fieldCount=rows.reduce((n,r)=>n+Object.keys(r.p.after).length,0);
if(new Set(rows.map(r=>`${r.p.table}/${r.p.id}`)).size!==rows.length)throw Error('Duplicate record');
// Review file schema may grow; exact draft hash and field totals are displayed
// from their own current sources without inventing a blanket completion gate.
const counts={};
for(const r of rows){const key=`${r.language} / ${r.p.table}`;counts[key]=(counts[key]??0)+1;}
const lines=[
 '# Question audit — current change register','',
 '**In progress; local draft only. Nothing deployed.**','',
 `This generated index covers ${rows.length.toLocaleString('en-US')} changed records and ${fieldCount.toLocaleString('en-US')} changed fields. It is not an error-free certificate or a statement that all audit findings are closed. Both complete item-review passes and remaining limitations are documented in [the audit overview](../README.md).`, '',
 `Draft SHA-256: \`${sha}\`. Exact-value independent review is in [current-review-status.json](current-review-status.json).`,'',
 'Each entry links directly to its complete JSON record, including original and replacement values, IDs, context guards, reasons and sources. Field names below describe what changed; long question cues are shortened only in this index. Unchanged questions are not listed. Runtime code changes and their independent evidence are recorded separately under [runtime-independent-review](runtime-independent-review/REPORT.md), its [follow-up](runtime-independent-review/FOLLOWUP.md) and the [checkpoint numeric review](runtime-independent-review/CHECKPOINT-NUMERIC-ROOT-STATUS.md); this database-content register does not count code files as question records.','',
 '## Changed-record counts','', '| Language / table | Records |','| --- | ---: |',
 ...Object.entries(counts).sort().map(([k,v])=>`| ${k} | ${v} |`),'',
 '## Individual records','',
 ];
let previous='';
for(const r of rows.sort((a,b)=>`${a.language}/${a.level}/${a.ref}`.localeCompare(`${b.language}/${b.level}/${b.ref}`))){
 const group=`${r.language} — ${r.level}`;
 if(group!==previous){lines.push(`### ${group}`,'');previous=group;}
 const cue=r.question.length>180?`${r.question.slice(0,180)}…`:r.question;
 const jsonPath=`${process.cwd()}/${base}/draft-patches.json:${lineMap.get(r.p.id)}`;
 lines.push(`- [${clean(r.ref)}](${jsonPath})${r.context?` — ${clean(r.context)}`:''}: ${clean(cue)}`,
  r.p.op==='insert'
   ?`  Added: a new ${r.p.table.replace(/s$/,'').replace(/_/g,' ')}, with \`${Object.keys(r.p.after).join('`, `')}\`.`
   :`  Changed: ${Object.keys(r.p.after).map(x=>`\`${x}\``).join(', ')}.`,
  `  Reason: ${clean((r.p.reasons??[r.p.reason??'See exact record']).join(' '))}`,'');
}
await writeFile(`${base}/CHANGE-REPORT.md`,lines.join('\n')+'\n');
console.log(JSON.stringify({records:rows.length,fields:fieldCount,draft_sha256:sha,review_status_keys:Object.keys(review),unresolved_contexts:rows.filter(r=>r.language==='unresolved').length}));
