import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='docs/audits/question-verification/remediation/runtime-independent-review';
const sha=x=>createHash('sha256').update(x).digest('hex');
const manifests=[['followup-source.json','3a4897e9714205d7246129125ec64dae1c02472217dc685aeef2a2f4dcd3f136'],['reportability-followup-source.json','d60a27d12cb63ac7bc02c3f1e8108857c8e3e992b6d030279f9383d0f19e8868']];
const files=new Map();
for(const[name,hash]of manifests){
 const body=await readFile(`${base}/${name}`,'utf8');
 if(sha(body)!==hash)throw Error('Changed reviewed manifest');
 for(const f of JSON.parse(body).files){
  if(sha(f.source)!==f.after_sha256)throw Error('Corrupt archived source');
  if(files.has(f.path)&&files.get(f.path).after_sha256!==f.before_sha256)throw Error('Follow-up does not start from reviewed source');
  files.set(f.path,{path:f.path,after_sha256:f.after_sha256,evidence:name});
 }
}
for(const f of files.values())if(sha(await readFile(f.path))!==f.after_sha256)throw Error(`Unreviewed current source ${f.path}`);
const result={reviewer:'root, independent of audit_german',reviewed_on:'2026-09-13',status:'approved for local audit branch; not deployed',files:[...files.values()],decisions:[
 {finding:'R2/R3',decision:'approve',rationale:'Fresh parser requires the existing requested rubric, diagnostics and safe display shape; computes total from rubric, preserves genuine zeros/empty advice/insertion and deletion spans, retries malformed output without fabricated assessment.'},
 {finding:'R4',decision:'approve',rationale:'Legacy diagnostic average retained; absent optional categories omitted, genuine zeros visible. Safe existing advice survives invalid entries. Root-required reportability follow-up preserves reporting of any remaining validated visible text even without overall prose.'},
 {finding:'R6',decision:'approve',rationale:'Credit and selected-option visual state use the same grade helper, including explicit alternatives and Unicode normalization. Wrong fuzzy-near tapped choices still reject; restored state emits neither duplicate credit nor haptics.'},
 ],root_verification:{focused_frontend:{suites:2,tests:25,passed:true},writing_deno:{tests:24,passed:true},typescript_no_emit:'pass',repository_eslint_quiet:'pass (warnings not suppressed or certified absent)'},limits:['No live model/provider invocation or production changes.','Semantic correctness of future generated feedback is not guaranteed.','JA/ZH length policy, open production semantics and other separately recorded runtime limitations remain open.']};
await writeFile(`${base}/root-followup-decisions.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({independently_approved_files:files.size,findings:['R2','R3','R4','R6']}));
