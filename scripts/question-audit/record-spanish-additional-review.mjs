import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
import {lexicalAdditionalAlternatives,lexicalAdditionalFixes} from './es-ja-ko-lexical-additional-fixes.mjs';
import {spanishAdditionalAlternatives,spanishLessonAdditionalFixes} from './spanish-lesson-additional-fixes.mjs';
const base='docs/audits/question-verification/remediation/es-additional-root-review';
const sha=x=>createHash('sha256').update(x).digest('hex');
const sources={
 lexical:['scripts/question-audit/es-ja-ko-lexical-additional-fixes.mjs','4da0f01021013ad7cdd0558a683fce21c0c16fc0d0eacd164eb9779449dfcaa9'],
 grammar:['scripts/question-audit/spanish-lesson-additional-fixes.mjs','9046b07f1faaf38d6617c627a2260226390ef0bef11a460278435e2d1b6f3d9c'],
};
for(const[path,hash]of Object.values(sources))if(sha(await readFile(path))!==hash)throw Error('Unreviewed source');
if(lexicalAdditionalAlternatives.es.length!==243||spanishAdditionalAlternatives.length!==8)throw Error('Changed review scope');
const primarySources=[
 'https://www.rae.es/dpd/d%C3%ADa',
 'https://dictionary.cambridge.org/dictionary/english-spanish/good-evening',
 'https://dictionary.cambridge.org/es/diccionario/espanol-ingles/esposo',
 'https://dictionary.cambridge.org/es/diccionario/espanol-ingles/turno',
 'https://www.asale.org/damer/enamorado','https://www.asale.org/damer/pololo',
 'https://www.fundeu.es/recomendacion/vergonzantevergonzoso/',
 'https://dle.rae.es/canap%C3%A9','https://dle.rae.es/festivo','https://dle.rae.es/costumbre',
 'https://lyon.cervantes.es/imagenes/icl-20231210-transporte-e.pdf',
];
const grammarNotes=new Map([
 [2238,'Explicit yo combines correctly with dudar de que and optional él; subjunctive retained. The original ending/person explanation needs a separate correction.'],
 [2249,'Result-clause yo preserves the required Si opening, imperfect subjunctive and conditional.'],
 [2252,'Both clause orders and planned ir a future preserve rain tomorrow and staying home.'],
 [2266,'Explicit embedded ella and encontrarse cansada are valid reports of the same state.'],
 [2277,'Time-first and time-before-subject preserve se, singular bridge and 1990.'],
 [2279,'Se habla aquí español uses all four tiles, with no anchor constraint. Also accept Español se habla aquí after exact follow-up. A separate explanation overstatement remains.'],
 [2280,'Time-fronting and regional ticket nouns retain plural se vendieron and one-hour duration.'],
 [2308,'English you does not select tú over usted; four respectful hypothetical variants preserve agreement and conditional.'],
]);
const groupNote=n=>n<561?'Read in A1 context; unrestricted register, region, sense or gender admits this proposed ordinary equivalent. Fixed-prefix completions were assembled, not treated as whole-word answers.':
 n<634?'Read in family context; valid regional relationship, marital/event or unspecified-gender sense, not an unrelated dictionary homonym.':
 n<706?'Read in healthcare context; medical synonym, unspecified gender or noun/verb ambiguity remains compatible with the visible cue.':
 n<778?'Read in home context; housing/furnishing sense or reflexive washing is not excluded by an object or part-of-speech instruction.':
 n<850?'Read in emotion/personality context; character/state sense and unspecified gender match the cue, including attested shy vergonzoso.':
 n<922?'Read in past-time context; optional yo, lexical ser/ir ambiguity or musical played sense does not violate the bare cue.':
 n<994?'Read in future-plans context; no morphology-only restriction excludes ir a, explicit yo or English contraction. Aspiration/appointment senses fit context.':
 n<1069?'Read in comparison context; no supplied referent fixes adjective/adverb, length/height, gender or number. This does not close missing superlative practice.':
 'Read in cultural context; celebration, customary practice, gift, costume and public-holiday senses fit the visible unrestricted cue.';
const set=await createPatchSet();lexicalAdditionalFixes(set,'es');spanishLessonAdditionalFixes(set);
const get=lessonRefs(set.snapshot,'es'),rows=[],fields=[],runtime=[];
for(const[n,additions,authorRationale]of [...lexicalAdditionalAlternatives.es,...spanishAdditionalAlternatives]){
 const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id),grammar=grammarNotes.has(n);
 if(!p||Object.keys(p.after).join()!=='accepted_answers')throw Error('Unexpected field scope');
 const note=grammar?grammarNotes.get(n):groupNote(n);
 rows.push({...full,patch:p,root_adjudication:note,author_rationale:authorRationale});
 const hints={exerciseHints:{exerciseType:e.type,skillType:e.skill_type,targetGrammar:e.target_grammar,language:'es'}};
 for(const answer of additions){
  if(gradeAnswer(answer,e.correct_answer,e.accepted_answers,hints).isCorrect||!gradeAnswer(answer,e.correct_answer,p.after.accepted_answers,hints).isCorrect)throw Error(`Missing rejection repair ${full.ref}: ${answer}`);
  runtime.push({ref:full.ref,answer,before:false,after:true});
 }
 fields.push({reviewer:'root, independent of author audit_german',reviewed_on:'2026-09-13',ref:full.ref,table:'exercises',id:e.id,field:'accepted_answers',before:e.accepted_answers,after:p.after.accepted_answers,decision:n===2279?'revise':'approve_as_correction',rationale:note,author_rationale:authorRationale,source_sha256:sources[grammar?'grammar':'lexical'][1],...(n===2279?{recommended_after:[...p.after.accepted_answers,'Español se habla aquí']}:{})});
}
if(runtime.length!==451||rows.length!==251)throw Error('Incomplete review');
await mkdir(base,{recursive:true});const archive=`${base}/reviewed-batch.json`,body=JSON.stringify({sources,primary_sources:primarySources,rows},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
await writeFile(`${base}/runtime-results.jsonl`,runtime.map(r=>JSON.stringify(r)).join('\n')+'\n');
console.log(JSON.stringify({reviewed_rows:251,approved_fields:250,pending_fields:1,actual_valid_answer_repairs:451}));
