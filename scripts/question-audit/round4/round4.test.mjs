import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../../../.question-audit/test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
const base='.';
const { patches } = JSON.parse(await readFile(`${base}/docs/audits/question-verification/round4/draft-patches.json`,'utf8'));
const sql = await readFile(`${base}/docs/audits/question-verification/round4/draft.sql`,'utf8');
const reverse = await readFile(`${base}/docs/audits/question-verification/round4/reverse.sql`,'utf8');
const snapshot = JSON.parse(await readFile(`${base}/.question-audit/snapshot-b758c2a2ae07.json`,'utf8'));
const tables=[...new Set(patches.map(p=>p.table))].sort();
const arrayFields=new Set(['accepted_answers','options','distractors','tags','target_vocabulary','accepted_speech_variants','collocations','search_terms']);
async function fixture(){
  const db=await PGlite.create();
  for(const table of tables){
    const rows=snapshot[table]; const fields=Object.keys(rows[0]);
    const cols=fields.map(f=>{const vals=rows.map(r=>r[f]).filter(v=>v!==null);
      let t='text';
      if(f==='id'||['course_id','unit_id','lesson_id','passage_id','card_id','user_id'].includes(f))t='uuid';
      else if(arrayFields.has(f))t='text[]';
      else if(vals.some(v=>typeof v==='object'))t='jsonb';
      else if(vals.some(v=>typeof v==='boolean'))t='boolean';
      else if(vals.some(v=>typeof v==='number'))t='numeric';
      return `"${f}" ${t}${f==='id'?' PRIMARY KEY':''}`;});
    await db.exec(`CREATE TABLE public."${table}" (${cols.join(',')});`);
    await db.query(`INSERT INTO public."${table}" SELECT * FROM jsonb_populate_recordset(NULL::public."${table}", $1::jsonb)`,[JSON.stringify(rows)]);
  }
  return db;
}
const contents=async db=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,(await db.query(`SELECT to_jsonb(x) AS row FROM public."${t}" x ORDER BY id`)).rows.map(r=>r.row)])));
const expected=Object.fromEntries(tables.map(t=>[t,snapshot[t].map(r=>({...r,...(patches.find(p=>p.table===t&&p.id===r.id)?.after??{})})).sort((a,b)=>a.id.localeCompare(b.id))]));

test('applies exactly, is idempotent, and the reverse restores the snapshot', async () => {
  const db=await fixture();
  try{
    const original=await contents(db);
    await db.exec(sql); assert.deepEqual(await contents(db), expected);
    await db.exec(sql); assert.deepEqual(await contents(db), expected);
    await db.exec(reverse); assert.deepEqual(await contents(db), original);
    await db.exec(reverse); assert.deepEqual(await contents(db), original);
  } finally { await db.close(); }
});

test('a concurrent edit aborts the whole block', async () => {
  const db=await fixture();
  try{
    const p=patches.find(x=>x.table==='exercises');
    await db.query(`UPDATE public."exercises" SET correct_answer=$1 WHERE id=$2::uuid`,['Someone else edited this',p.id]);
    const before=await contents(db);
    await assert.rejects(db.exec(sql), /Audited row changed/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }
});

test('no row keeps a Reservation gloss on 预约, and no audio field is touched', () => {
  const byId=new Map(snapshot.exercises.map(e=>[e.id,e]));
  for(const p of patches.filter(x=>x.table==='exercises')){
    const after={...byId.get(p.id),...p.after};
    if(after.correct_answer==='Appointment'||after.correct_answer==='预订'){
      assert(!(after.accepted_answers??[]).includes('Reservation'), `${p.id} still accepts Reservation`);
      assert(!(after.options??[]).includes('Reservation'), `${p.id} still offers Reservation`);
    }
    for(const field of Object.keys(p.after)) assert(!/audio|speech/.test(field), `${p.id}: ${field} is audio`);
  }
  const card=patches.find(p=>p.table==='cards');
  assert.equal(card.after.native_text,'Appointment');
  assert.equal(card.after.target_text,undefined,'the Chinese on the card must not move');
});
