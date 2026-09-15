import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {russianLessonFixes,russianAlternativeAdditions} from './russian-lesson-fixes.mjs';
import {gradeAnswer} from '../../lib/grading.ts';
const base='docs/audits/question-verification/remediation/ru-root-review';
const source='scripts/question-audit/russian-lesson-fixes.mjs';
const expected='95c812eb74e4e09241e4cef899abb35ea060c277f158f8a9ab07c29d684baa0a';
const sha=x=>createHash('sha256').update(x).digest('hex');
if(sha(await readFile(source))!==expected)throw Error('Unreviewed source');
const set=await createPatchSet();russianLessonFixes(set);
const get=lessonRefs(set.snapshot,'ru'),refs=new Map();
for(let n=1;n<=2312;n++)refs.set(get(n).exercise.id,{n,...get(n)});
const additions=new Map(russianAlternativeAdditions.map(([n,answers,reason])=>[n,{answers,reason}]));
const special=new Map([
 [41,'Both Sorry/Excuse me fit Извините without a speech-act selector; morning greeting does not.'],
 [825,'Excited and Worried both fit Взволнованный without emotional-valence context; Calm does not.'],
 [1047,'Лучший can serve attributive better or best; Slower removes the competing meaning.'],
 [1052,'Same ambiguous лучший pair in listening choices; Cheaper is not a translation.'],
 [1059,'Худший can express attributive worse or worst; Faster is not a translation.'],
 [1571,'Temporal потом means then or next, not Before.'],[1599,'Пока has temporal adverb meanwhile as well as conjunction while; Afterwards does not preserve simultaneity.'],
 [1778,'Conventional closing С уважением can function as Sincerely or Regards; Awesome is not a closing equivalent.'],
 [1865,'Этика names moral principles as well as the discipline; Memory removes the collision.'],
 [1879,'Cambridge gives ethics as нравственность/moral principles; Reason is not the same meaning.'],
 [1949,'Concessive однако overlaps nevertheless; Therefore reverses the discourse relation.'],
 [2157,'English possessive apostrophe repair only; audio transcript unchanged.'],
 [2231,'Scope present-habit reading; no universal ban on perfective repetition.'],
 [2236,'Читал describes reading activity; за день прочитал can express completion; проспал весь день refutes a universal perfective-duration ban.'],
 [2238,'Partitive хлеба and both genders valid; remove four Я-initial alternatives that violate the visible Вчера anchor. General-factual imperfective can describe a completed purchase: perfective restriction must additionally appear in prompt, not only optional hint.'],
 [2243,'Уходит does not encode permanence; remove for good only.'],[2244,'Дошёл does not always require overt до; current exit-choice key unaffected.'],
 [2250,'Arrival can name source из класса. New visible exit instruction selects existing вышли/ушли without calling the original universally wrong.'],
 [2251,'Limit destination preposition contrast to this supplied centre phrase, not all при- verbs.'],
 [2275,'Perfective reflexive вернуться has вернувшись; imperfective улыбаться has улыбаясь, so the old hint overgeneralized.'],
 [2278,'Visible prior completion selects закончив; simultaneous finishing/departure is not inherently impossible.'],
 [2279,'Verbal-adverb transformation is the relevant constraint; Russian permits asyndetic finite clauses. Narrative verb-before-subject alternative retains all five tiles and leading adverbial.'],
 [2286,'Real future possibility matches останемся; polite wishes demonstrate бы is not only unreal hypothesis.'],
 [2287,'Finite conditional uses past form plus бы; infinitival wishes show why the explanation needs finite scope.'],
 [2288,'Separate ты subject selects finite past form after чтобы; purpose clauses can instead use an infinitive.'],
 [2289,'Был agrees with он in this finite conditional, without a universal restriction on all бы constructions.'],
 [2292,'Finite хотел бы plus infinitive expresses a polite wish; other uses of бы are not all past forms.'],
 [2299,'Ongoing reading clue selects читал; perfective is not necessarily instantaneous and can measure bounded duration.'],
 [2300,'Remove permanence/right-now-only claims. Optional vehicle hint alone does not exclude habitual directional walking; explicit present multidirectional vehicle-return viewpoint must be in the prompt.'],
 [2301,'Only of these options is the participle the required modifier; adjectives can also modify nouns.'],
 [2306,'Directional recurring walking is valid; visible selected round-trip visit viewpoint chooses хожу without condemning every иду habit.'],
]);
const requests=new Map([
 [2238,'Translate to Russian: "Yesterday I bought bread." Use the perfective past of «купить» and start with «Вчера».'],
 [2300,'Каждое лето мы ___ к бабушке в деревню. (Every summer we go to visit grandma in the village.) Choose the present-tense multidirectional verb for repeated trips by vehicle with a return journey.'],
]);
const rows=[],fields=[],runtime=[];
for(const p of set.patches()){
 const ref=refs.get(p.id),old=set.row(p.table,p.id),n=ref?.n;
 const note=ref?[special.get(n),additions.has(n)?`Every listed addition checked independently in its original cue/fixed prefix, lesson domain and unspecified gender/aspect/register context. Author rationale retained separately: ${additions.get(n).reason}`:null].filter(Boolean).join(' ')
  :p.id==='590c8ec1-0551-4b50-997f-a1763a6c89d5'?'Original error list contains only false arrival/source prohibition; emptying it removes no other error. Prefix examples retained; no one-prefix/one-preposition universal.'
  :p.id==='c49d0078-a69a-4d58-a8c8-31d119e0915c'?'Scope finite conditional and separate-subject wish; чтобы also introduces infinitives. Existing examples and error entry remain.'
  :'Original common_errors contains only the читать/прочитать duration contrast. Revised note scopes activity versus completion; valid examples remain.';
 if(!note)throw Error(`Missing review note ${n}`);
 rows.push({ref:ref?.ref??null,context:ref??old,patch:p,root_note:note});
 for(const[field,after]of Object.entries(p.after))fields.push({reviewer:'root, independent of audit_spanish',reviewed_on:'2026-09-13',ref:ref?.ref??null,table:p.table,id:p.id,field,before:p.before[field],after,decision:'approve_as_correction',rationale:note,source_sha256:expected,sources:p.sources});
 if(requests.has(n))fields.push({reviewer:'root, independent of audit_spanish',reviewed_on:'2026-09-13',ref:ref.ref,table:p.table,id:p.id,field:'prompt',before:old.prompt,after:old.prompt,decision:'revise',recommended_after:requests.get(n),rationale:special.get(n),source_sha256:expected});
 if(ref&&additions.has(n))for(const answer of additions.get(n).answers){
  const hints={exerciseHints:{exerciseType:old.type,skillType:old.skill_type,targetGrammar:old.target_grammar,language:'ru'}};
  const before=gradeAnswer(answer,old.correct_answer,old.accepted_answers,hints).isCorrect,after=gradeAnswer(answer,p.after.correct_answer??old.correct_answer,p.after.accepted_answers??old.accepted_answers,hints).isCorrect;
  if(before||!after)throw Error(`Missing actual repair ${ref.ref}: ${answer}`);
  runtime.push({ref:ref.ref,answer,before,after});
 }
}
if(rows.length!==415||fields.length!==432||runtime.length!==525)throw Error('Incomplete independent record');
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-95c812eb74e4.json`,body=JSON.stringify({source,source_sha256:expected,rows,requested_prompts:Object.fromEntries(requests)},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:sha(body)})).join('\n')+'\n');
await writeFile(`${base}/runtime-results.jsonl`,runtime.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({rows:rows.length,fields:fields.length,approved:430,pending_prompts:2,valid_answers_repaired:runtime.length}));
