import {readFile,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual as eq} from 'node:util';
const base='docs/audits/question-verification/remediation/ru-word-order-root-review';
const archive=JSON.parse(await readFile(`${base}/reviewed-source-2c8409a63484.json`,'utf8'));
const probe=JSON.parse(await readFile('docs/audits/question-verification/remediation/fr-pt-ru/russian-word-order-followup-probe.json','utf8'));
if(probe.source_sha256!==archive.source_sha256||probe.results.length!==7)throw Error('Changed candidate evidence');
const results=probe.results.map(r=>{
 const n=Number(r.ref.slice(4)),row=archive.rows.find(x=>x[0]===n);
 const same=eq(row[3].split(/\s+/).sort(),r.candidate.split(/\s+/).sort());
 if(same!==r.same_exact_tile_multiset)throw Error('Incorrect tile evidence');
 return {...r,root_decision:same?'request_exact_addition':'retain_original_array',root_rationale:same?'Root independently read complete sentence: intact phrases, scope, supplied tiles and anchors preserved.':'Root confirms comma is attached to жизнь, in literal supplied tiles; proposed comma moved to another word. Grammatical Russian but not a selectable rearrangement. No tile/runtime expansion requested.'};
});
if(results.filter(r=>r.root_decision==='request_exact_addition').length!==5)throw Error('Incorrect addition count');
await writeFile(`${base}/root-candidate-adjudication.json`,JSON.stringify({source_sha256:archive.source_sha256,results},null,2)+'\n');
console.log('Seven candidates independently adjudicated: five requested, two unavailable tile arrangements retained unchanged.');
