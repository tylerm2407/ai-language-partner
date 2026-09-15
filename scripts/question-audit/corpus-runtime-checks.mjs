// Exhaustive mechanical answer-routing regression, NOT semantic certification.
// Only local frozen curriculum and reviewed draft are read. No providers or DB.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as eq} from 'node:util';
import {gradeAnswer} from '../../lib/grading.ts';
import {gradeReadingAnswer,readingQuestionOptions} from '../../lib/reading-questions.ts';
import {isCorrect as checkpointCorrect} from '../../supabase/functions/checkpoint/checkpoint-core.ts';

const sha=x=>createHash('sha256').update(x).digest('hex');
const source=await readFile('.question-audit/snapshot-8c7f381c78d8.json','utf8');
if(sha(source)!=='8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f')throw Error('Changed frozen snapshot');
const snapshot=JSON.parse(source),text=await readFile('docs/audits/question-verification/remediation/draft-patches.json','utf8'),draft=JSON.parse(text);
if(draft.snapshot_sha256!==sha(source))throw Error('Wrong draft snapshot');
const indexes=new Map(Object.entries(snapshot).filter(([,v])=>Array.isArray(v)).map(([table,rows])=>[table,new Map(rows.map(r=>[r.id,r]))]));
// An insert has no prior row and carries `before: null`; it is added to the
// index so the checks below grade it exactly like a frozen row. Updates are
// unchanged: a drifted before-value still aborts.
for(const p of draft.patches){
 const index=indexes.get(p.table);
 if(!index)throw Error(`Out-of-scope table: ${p.table}`);
 if(p.op==='insert'){
  if(index.has(p.id))throw Error(`Insert collides with an existing row: ${p.table}/${p.id}`);
  index.set(p.id,{id:p.id,...p.after});
  continue;
 }
 const row=index.get(p.id);
 if(!row||!Object.entries(p.before).every(([f,v])=>eq(row[f],v)))throw Error(`Source drift: ${p.table}/${p.id}`);
 Object.assign(row,p.after);
}
const counts={lesson_rows:0,lesson_answers:0,lesson_choice_rows:0,reading_rows:0,reading_answers:0,reading_choice_rows:0,checkpoint_rows:0,checkpoint_answers:0};
const failures=[];
function answers(table,row,grade,counter){
 for(const answer of [row.correct_answer,...(row.accepted_answers??[])]){
  counts[counter]++;
  if(typeof answer!=='string'||!answer.trim()||!grade(answer))failures.push({table,id:row.id,kind:'stored_answer_rejected',answer});
 }
}
for(const e of snapshot.exercises){
 if(e.type==='speaking'||e.response_mode==='speak')continue;
 counts.lesson_rows++;
 const lesson=indexes.get('lessons').get(e.lesson_id),unit=indexes.get('units').get(lesson.unit_id),course=indexes.get('courses').get(unit.course_id);
 const grade=answer=>gradeAnswer(answer,e.correct_answer,e.accepted_answers,{exerciseHints:{exerciseType:e.type,skillType:e.skill_type,targetGrammar:e.target_grammar,targetWord:e.target_word,language:course.target_language}}).isCorrect;
 answers('exercises',e,grade,'lesson_answers');
 if(['multiple_choice','listening_choice'].includes(e.type)){
  counts.lesson_choice_rows++;
  const accepted=(e.options??[]).filter(grade);
  if(accepted.length!==1)failures.push({table:'exercises',id:e.id,kind:'choice_key_count',accepted,options:e.options});
 }
}
for(const row of indexes.get('reading_questions').values()){
 counts.reading_rows++;
 const question={questionType:row.question_type,correctAnswer:row.correct_answer,acceptedAnswers:row.accepted_answers,options:row.options};
 const grade=answer=>gradeReadingAnswer(answer,question).isCorrect;
 answers('reading_questions',row,grade,'reading_answers');
 if(row.question_type!=='short_answer'){
  counts.reading_choice_rows++;
  const options=readingQuestionOptions(question),accepted=options.filter(grade);
  if(accepted.length!==1)failures.push({table:'reading_questions',id:row.id,kind:'choice_key_count',accepted,options});
 }
}
for(const row of snapshot.checkpoint_items){
 // Writing uses model evaluation, not this fixed-answer helper.
 if(!['reading','listening'].includes(row.strand))continue;
 counts.checkpoint_rows++;
 answers('checkpoint_items',row,a=>checkpointCorrect(a,row),'checkpoint_answers');
}
const report={snapshot_sha256:sha(source),draft_sha256:sha(text),scope:'Every stored non-speaking lesson key/alias, every reading key/alias, fixed-answer checkpoint reading/listening. Open lesson keys passing only proves routing, NOT valid open-response grading. Writing, spoken audio and future generation are not certified.',counts,failures};
await writeFile('docs/audits/question-verification/remediation/corpus-runtime-results.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({counts,failures:failures.length,examples:failures.slice(0,10)}));
if(failures.length)throw Error('Corpus routing regression requires adjudication');
