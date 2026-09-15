/** Independent exact-value review of the DE/IT/ZH hobby/music batch. Records decisions; does not author or integrate. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPatchSet,SNAPSHOT_SHA} from './patch-set.mjs';
import {lessonRefs} from './lesson-refs.mjs';
import {hobbyMusicTopics,hobbyMusicTopicFixes} from '../../docs/audits/question-verification/remediation/de-it-zh/hobby-music-topic-fixes.mjs';
const base='docs/audits/question-verification/remediation/de-it-zh-hobby-music-root-review';
const source='docs/audits/question-verification/remediation/de-it-zh/hobby-music-topic-fixes.mjs';
const expected='85d22ad396b6b0bb835a3228c7dea7064d77f55001ac41ff0893a4adff8c9ae1';
const reviewer='independent reviewer (Claude Fable 5.1, session 2026-09-14), independent of author';
const reviewedOn='2026-09-14';
const sha=x=>createHash('sha256').update(x).digest('hex');
const sourceSha=sha(await readFile(source));
if(sourceSha!==expected)throw Error('Unreviewed source');
const set=await createPatchSet();hobbyMusicTopicFixes(set);
if(set.patches().length!==21)throw Error('Unexpected patch count');
const src={
 duden_leise:'https://www.duden.de/rechtschreibung/leise',
 duden_tempo:'https://www.duden.de/rechtschreibung/Tempo_Geschwindigkeit',
 treccani_piano:'https://www.treccani.it/vocabolario/piano1/',
 treccani_tempo:'https://www.treccani.it/vocabolario/tempo/',
 mdbg_yinliang:'https://www.mdbg.net/chinese/dictionary?wdqb=%E9%9F%B3%E9%87%8F',
 mdbg_orchestra:'https://www.mdbg.net/chinese/dictionary?wdqb=%E7%AE%A1%E5%BC%A6%E4%B9%90%E9%98%9F',
};
// Whole-lesson context was read for every row: A1 Work & Social / Hobbies & Interests (14 exercises incl. speaking)
// and B2 Literature & Arts / Music Appreciation (16 exercises incl. speaking), per language.
const notes={
 de:{
  305:['Original Büro→Office is linguistically correct but is the only job word in a lesson titled Hobbies & Interests; the lesson otherwise holds reading, cooking, football and season/weather words. „Im Sommer zeichne ich gern im Park.“ is correct A1 German (V2 order, gern + present, „…“ quotes); Drawing is the unique key; Swimming/Cooking/Reading are wrong and plausible, two of them lesson vocabulary.',[]],
  313:['Original dictation of the isolated word Büro tested the same off-topic office item. Transcript Ich zeichne gern. is correct and natural; hint I like drawing. matches; the Office card (c003) no longer describes this row, so detaching it is required, and the app synthesises audio from the prompt when no URL is stored. Grader also accepts gerne/no-period variants.',[]],
  314:['Listening choice for Ich zeichne gern. keys I like drawing. uniquely; I like reading/cooking/swimming are wrong and plausible. Card detachment as for E0313.',[]],
  2103:['Original Skulptur→Sculpture is correct but is not music vocabulary in a lesson titled Music Appreciation. The review sentence is grammatical, natural German; immer leiser = progressively softer (Duden leise: nicht laut), so The orchestra gradually plays more softly is the unique key; louder / stops / same volume are all contradicted by the sentence.',[src.duden_leise]],
  2112:['Original Roman→Novel is correct but literary, not musical. Das Tempo wird schneller is natural German for a rising musical tempo (Duden: musikalisches Zeitmaß; Tempo erhöhen/steigern); The music gets faster is the unique key; quieter / slower / starts again are wrong.',[src.duden_tempo]],
  2113:['Transcript Das Tempo wird schneller. matches E2112; hint The music gets faster. agrees; stale Skulptur card (c004) detached; audio is synthesised from the prompt.',[src.duden_tempo]],
  2114:['Listening choice for Das Tempo wird schneller. keys The music gets faster. uniquely among quieter/slower/starts again. Card detachment as for E2113.',[src.duden_tempo]],
 },
 it:{
  305:['Original Ufficio→Office is correct but off-topic for Hobbies & Interests. «D’estate mi piace disegnare al parco.» is natural A1 Italian (d’estate, mi piace + infinitive, al parco, «» quotes, typographic apostrophe); Drawing is the unique key; distractors wrong and plausible.',[]],
  313:['Transcript Mi piace disegnare. is correct; hint I like drawing. agrees; Office card (c003) detached; audio synthesised from the prompt.',[]],
  314:['Listening choice for Mi piace disegnare. keys I like drawing. uniquely; other three preferences are wrong and plausible.',[]],
  2103:['Original Scultura→Sculpture is correct but not musical. «…l’orchestra suona sempre più piano…» uses piano in its attested adverbial/musical sense (Treccani piano¹: a voce bassa, contrapp. a forte; didascalia musicale), so gradually plays more softly is the unique key; the passage is natural Italian and the melody clause is consistent with the key.',[src.treccani_piano]],
  2112:['Original Romanzo→Novel is correct but literary. «Il tempo diventa più rapido» read in a music review means the tempo speeds up (Treccani tempo 5.a: movimento più o meno rapido; affrettare il tempo); the prompt supplies the music-review frame that disambiguates tempo from clock time. The music gets faster is the unique key.',[src.treccani_tempo]],
  2113:['Transcript Il tempo diventa più rapido. matches E2112; hint agrees; stale Scultura card (c004) detached. Grader accepts the accent-less variant.',[src.treccani_tempo]],
  2114:['Listening choice for Il tempo diventa più rapido. keys The music gets faster. uniquely; più rapido cannot mean quieter, slower or starting again.',[src.treccani_tempo]],
 },
 zh:{
  305:['Original 办公室→Office is correct but off-topic for Hobbies & Interests. “夏天，我喜欢在公园画画。” is natural A1 Chinese (time phrase, 喜欢 + verb, 在公园 locative, full-width punctuation); Drawing is the unique key; distractors wrong and plausible.',[]],
  313:['Transcript 我喜欢画画。 is correct; traditional 我喜歡畫畫。 is the exact traditional equivalent and belongs in accepted_answers; hint agrees; Office card (c003) detached; audio synthesised from the prompt.',[]],
  314:['Listening choice for 我喜欢画画。 keys I like drawing. uniquely; the three other preferences are wrong and plausible.',[]],
  2103:['Original 雕塑→Sculpture is correct but not musical. 管弦乐队 = orchestra and 音量逐渐降低 = volume gradually decreases (MDBG: 音量 loudness/volume; 管弦乐队 orchestra), so gradually plays more softly is the unique key; 主旋律反复出现 is consistent and the distractors are contradicted.',[src.mdbg_yinliang,src.mdbg_orchestra]],
  2112:['Original 小说→Novel is correct but literary. “音乐的速度加快了” unambiguously says the music’s speed increased; The music gets faster is the unique key. 节奏加快 would be equally idiomatic but 速度 is correct and cannot be read as volume.',[]],
  2113:['Transcript 音乐的速度加快了。 matches E2112; traditional 音樂的速度加快了。 is the exact traditional form; hint agrees; stale 雕塑 card (c004) detached.',[]],
  2114:['Listening choice for 音乐的速度加快了。 keys The music gets faster. uniquely among quieter/slower/starts again.',[]],
 },
};
const fields=[],rows=[];
for(const language of ['de','it','zh']){
 const get=lessonRefs(set.snapshot,language);
 for(const[n]of hobbyMusicTopics[language]){
  const full=get(n),e=full.exercise,p=set.patches().find(p=>p.id===e.id);
  const[note,sources]=notes[language][n];
  const lessonRows=set.snapshot.exercises.filter(x=>x.lesson_id===full.lesson.id).length;
  rows.push({ref:full.ref,language,course_level:full.course.cefr_level,unit:full.unit.title,lesson:full.lesson.title,lesson_exercise_count:lessonRows,exercise:e,patch:p,card_dependency:e.card_id?set.row('cards',e.card_id):null,reviewer_note:note,sources});
  for(const[field,after]of Object.entries(p.after))fields.push({reviewer,reviewed_on:reviewedOn,ref:full.ref,table:'exercises',id:e.id,field,before:e[field],after,decision:'approve_as_correction',rationale:note,sources,source_sha256:sourceSha});
 }
}
if(fields.length!==92)throw Error(`Unexpected field count ${fields.length}`);
await mkdir(base,{recursive:true});
const archive=`${base}/reviewed-source-${sourceSha.slice(0,12)}.json`,body=JSON.stringify({source_sha256:sourceSha,snapshot_sha256:SNAPSHOT_SHA,reviewer,reviewed_on:reviewedOn,rows},null,2)+'\n';
try{await writeFile(archive,body,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(archive,'utf8')!==body)throw e;}
const evidenceSha=sha(body);
await writeFile(`${base}/field-decisions.jsonl`,fields.map(f=>JSON.stringify({...f,evidence:archive,evidence_sha256:evidenceSha})).join('\n')+'\n');
const counts=fields.reduce((a,f)=>({...a,[f.decision]:(a[f.decision]??0)+1}),{});
const table=rows.map(r=>`| ${r.ref} | ${r.exercise.type} | ${JSON.stringify(r.exercise.correct_answer)} → ${JSON.stringify(r.patch.after.correct_answer)} | ${Object.keys(r.patch.after).join(', ')} | approve_as_correction |`).join('\n');
await writeFile(`${base}/README.md`,`# Independent DE/IT/ZH hobby/music exact-value review

Reviewer: ${reviewer}. Reviewed on ${reviewedOn}.

## Scope

Source \`docs/audits/question-verification/remediation/de-it-zh/hobby-music-topic-fixes.mjs\`, SHA-256 \`${sourceSha}\` (hard-checked by \`scripts/question-audit/record-de-it-zh-hobby-music-review.mjs\`). 21 exercise rows, 92 changed fields, in six lessons: A1 *Work & Social → Hobbies & Interests* and B2 *Literature & Arts → Music Appreciation* for German, Italian and Chinese. Every lesson was read in full from the frozen snapshot (14 and 16 exercises respectively, speaking rows included), each original row was judged before the proposal was read, and each card dependency (\`card_id\`) was inspected. Evidence archive: \`${archive}\` (SHA-256 \`${evidenceSha}\`). Exact field decisions: \`${base}/field-decisions.jsonl\`.

Counts: ${Object.entries(counts).map(([k,v])=>`${k} ${v}`).join(', ')}. No revise, reject or uncertain fields.

## Findings on the originals

- A1 E0305/E0313/E0314 (Büro / Ufficio / 办公室): linguistically correct, but the only job word inside a lesson titled Hobbies & Interests, whose other rows are reading, cooking, football and season/weather words. Replacing the isolated office item with a drawing preference, placed in summer in a park, is a real lesson-topic correction.
- B2 E2103/E2113/E2114 (Skulptur / Scultura / 雕塑) and E2112 (Roman / Romanzo / 小说): linguistically correct, but sculpture and novel are not music vocabulary in a lesson titled Music Appreciation. The replacements test volume (leiser / più piano / 音量逐渐降低) and tempo (Tempo wird schneller / tempo più rapido / 速度加快) with correct language-specific terms, verified against Duden, Treccani and MDBG (URLs in the decision lines).
- The 12 changed listening rows lose their stale card links. That is required, not incidental: the cards describe office/sculpture. \`components/lesson/ListeningExercise.tsx\` synthesises audio from the prompt whenever no stored URL exists, and every frozen \`prompt_audio_url\` here is null, so nulling \`card_id\` leaves the exercise playable. Generated pronunciation is not certified by this text review.

## Per-row verdicts

| Ref | Type | Key before → after | Changed fields | Verdict |
|---|---|---|---|---|
${table}

## Observations that did not block approval

- The Music Appreciation lessons remain mostly literary vocabulary (Protagonist, plot twist, novel-style words). This batch fixes only the two bare sculpture/novel targets and their audio copies; the lesson is not thereby a full music lesson. Out of scope here.
- Chinese E2112/E2113/E2114 use 速度 (speed). 节奏加快 would be equally idiomatic for tempo, but 速度 is correct and cannot be confused with volume.
- Italian E2112 wording «Il tempo diventa più rapido» relies on the prompt's music-review frame to exclude the clock-time reading; the listening rows only require transcription or the choice of *faster*, where no ambiguity survives.
- The grader is lenient on the new transcripts (case, final period, accents, gern/gerne all pass), so empty \`accepted_answers\` in German and Italian is not a gap.
- The batch's own deno test (3 tests) passed on 2026-09-14. That test is the author's; this review is the independent linguistic pass. It does not certify the whole course, generated audio, or production grading.
`);
console.log(JSON.stringify({rows:rows.length,fields:fields.length,counts,source_sha256:sourceSha,evidence:archive,evidence_sha256:evidenceSha}));
