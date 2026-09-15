// Exact-value record after root read all 340 proposed rows and original contexts.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {portugueseLessonFixes, portugueseAlternativeAdditions} from './portuguese-lesson-fixes.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/pt-root-review';
const source='scripts/question-audit/portuguese-lesson-fixes.mjs';
const expected='fb8a4fe85d9df39fd6d73122cfe8b21bcc92959873a62d414a2ed0a9eaaa973a';
const sha=x=>createHash('sha256').update(x).digest('hex');
if(sha(await readFile(source))!==expected)throw Error('Unreviewed Portuguese source');
const set=await createPatchSet();portugueseLessonFixes(set);
const get=lessonRefs(set.snapshot,'pt'),refs=new Map();
for(let n=1;n<=2312;n++)refs.set(get(n).exercise.id,{n,...get(n)});
const alternatives=new Map(portugueseAlternativeAdditions.map(([n,answers,reason])=>[n,{answers,reason}]));
const special=new Map([
 [24,'Desculpe permits both offered apologies/attention requests; Good night is not equivalent.'],
 [49,'Boa noite permits evening greeting and night farewell; Thank you removes the collision.'],
 [810,'Collins explicitly gives bravo both brave and angry; Lazy is not either.'],
 [1071,'Festa can name a party or festival; Calendar is not a translation.'],
 [1627,'Temporal depois permits next and then; Before reverses sequencing.'],
 [1642,'Visible first person and conditional fazer select faria/Eu faria without losing lexical do/make.'],
 [1655,'Faria retains conditional do/make, not a freestanding auxiliary.'],
 [1665,'Only the English gloss changes; Portuguese audio transcript is untouched.'],
 [1666,'Correct lexical gloss in choice key and matching option; other choices do not compete.'],
 [1706,'Conditional lexical fazer sense restored, with key and option synchronized.'],
 [1719,'Only the erroneous auxiliary-only supplied glossary cue is repaired; production grading remains pending.'],
 [1649,'Complement-taking em vez de corresponds to instead of; no production-level certification.'],
 [1688,'Instead of preserves the prepositional phrase; one-tile pedagogy remains a separate finding.'],
 [1701,'Complement-taking phrase corrected without altering its Portuguese answer.'],
 [1714,'Fixed Em v prefix plus ez de still forms the correct preposition.'],
 [1681,'Only the English preposition gloss changes, not the listening transcript.'],
 [1682,'Key and matching option now preserve the English complement-taking preposition.'],
 [2157,'Possessive apostrophe only. The pegar-no-pe idiom equivalence is disputed and not certified.'],
 [2190,'Infopedia leg explicitly attests gracejar com alguem for joking deception. New cue selects this sense and fixed Gracejar prefix; literal puxar a perna is not retained as the taught idiom.'],
 [2250,'Neutral visible future-occasion/tu/poder instruction selects puderes without condemning a habitual present invitation.'],
 [2273,'Visible imperfeito backshift request selects falava; present reporting can otherwise be valid.'],
 [2277,'The rendered metadata instruction selects a later past viewpoint and podia; source sentence and valid key remain.'],
 [2278,'Visible later-report context selects eram; then/that instant/that moment variants preserve reference, with both pronoun positions allowed.'],
 [2290,'Visible present passive-se request selects plural vendem without silently excluding valid other tenses.'],
 [2302,'Galician educational grammar explicitly gives personal infinitives after prepositions; remove only false uniqueness.'],
]);
const rows=[],fields=[],runtime=[];
for(const p of set.patches()){
 const ref=refs.get(p.id),old=set.row(p.table,p.id),n=ref?.n;
 const note=ref
  ? [special.get(n),alternatives.has(n)?`Independently checked every listed alternative against the original prompt, fixed fragment, lesson context and unspecified gender/register/variety: ${alternatives.get(n).reason}`:null].filter(Boolean).join(' ')
  : p.table==='cards'?'Shared card preserves the lexical meaning of fazer or complement-taking em vez de; target text and speaking exercises unchanged.'
  : p.id==='a1d73f33-289d-4dd9-9c75-a2ba5cf08c71'?'Original common_errors contained only one false universal: a still-current vai amanha report. Emptying that list removes no independently valid error example. Context-qualified explanation preserves legitimate backshift examples.'
  : p.table==='grammar_rules'?'Galician also has inflected infinitives. Contrast finite que clauses without an unscoped ban; preserve example structures and remove only uniqueness tag.'
  :'Spanish also has a future subjunctive; remove uniqueness claim without changing Portuguese lesson scope.';
 if(!note)throw Error(`Missing independent disposition ${n}`);
 rows.push({ref:ref?.ref??null,context:ref??old,patch:p,root_note:note});
 for(const[field,after]of Object.entries(p.after))fields.push({reviewer:'root, independent of audit_spanish',reviewed_on:'2026-09-13',ref:ref?.ref??null,table:p.table,id:p.id,field,before:p.before[field],after,decision:'approve_as_correction',rationale:note,source_sha256:expected,sources:p.sources});
 if(ref&&alternatives.has(n))for(const answer of alternatives.get(n).answers){
  const hints={exerciseHints:{exerciseType:old.type,skillType:old.skill_type,targetGrammar:old.target_grammar,language:'pt'}};
  const before=gradeAnswer(answer,old.correct_answer,old.accepted_answers,hints).isCorrect;
  const after=gradeAnswer(answer,p.after.correct_answer??old.correct_answer,p.after.accepted_answers??old.accepted_answers,hints).isCorrect;
  if(before||!after)throw Error(`Not an actual rejected-answer repair ${ref.ref}: ${answer}`);
  runtime.push({ref:ref.ref,answer,before,after});
 }
}
if(rows.length!==340||fields.length!==360||runtime.length!==529)throw Error('Incomplete independent record');
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-fb8a4fe85d9d.json`,body=JSON.stringify({source,source_sha256:expected,rows},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(x=>JSON.stringify({...x,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
await writeFile(`${base}/runtime-results.jsonl`,runtime.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({rows:rows.length,fields:fields.length,rejected_valid_answers_fixed:runtime.length}));
