import {lessonRefs} from './lesson-refs.mjs';

// Reconciled exact-context proposals. Every new field awaits independent review.
// No open-production conversion, sole-tile replacements, or audio certification.
export const japaneseGrammarAlternatives = [
 [2238,['安いなら買う'], 'The unconstrained translation already permits なら and plain speech separately; their ordinary combination retains the future decision.'],
 [2239,['かていほう'], 'The normal kana transcription preserves 仮定法; audio was not auditioned.'],
 [2241,['せつ'], 'The normal grammatical reading of 節 is せつ; audio was not auditioned.'],
 [2252,['母に日記を読まれました','私は母に日記を読まれました','ははににっきをよまれました'], 'Unspecified politeness permits the ordinary polite adversity passive with the same affected speaker and diary.'],
 [2253,['かんせつわほう'], 'The normal kana transcription preserves 間接話法; audio was not auditioned.'],
 [2255,['せつぞくし'], 'The normal kana transcription preserves 接続詞; audio was not auditioned.'],
 [2263,['私は部屋を母に掃除させられた'], 'Reordering the object and causee-agent phrase preserves the requested first-person causative-passive.'],
 [2264,['先週、私は部長に二時間も残業させられました','先週私は部長に二時間も残業させられました'], 'A sentence-initial time phrase preserves the intended forced overtime and polite past.'],
 [2267,['うけみ'], 'The normal kana transcription preserves 受身; audio was not auditioned.'],
 [2269,['だいめいし'], 'The normal kana transcription preserves 代名詞; audio was not auditioned.'],
 [2278,['先生昨日の映画はもうご覧になりましたか','先生昨日の映画はもう見られましたか'], 'Omitting the optional vocative comma retains the teacher-directed respectful question.'],
 [2280,['明日、書類をお送りします。','明日書類をお送りします。','書類は明日お送りします。','あした、しょるいをおおくりします。','あしたしょるいをおおくりします。'], 'The authored explanation explicitly promises standard humble お送りします; these ordinary full sentences satisfy the client-facing translation.'],
 [2281,['じょうけんけい'], 'The normal kana transcription preserves 条件形; audio was not auditioned.'],
 [2283,['ぜんちし'], 'The normal kana transcription preserves 前置詞; audio was not auditioned.'],
 [2292,['私は明日会社を休むつもりです','私は明日会社を休む予定です','私は明日会社を休みます'], 'Omitting the optional internal comma preserves each already authored direct-intention answer.'],
 [2295,['どうめいし'], 'The normal kana transcription preserves 動名詞; audio was not auditioned.'],
 [2297,['じせい'], 'The normal kana transcription preserves 時制; audio was not auditioned.'],
 [2304,['お越しになります','おこしになります'], 'Standard respectful polite nonpast of 来る, fitting お客様は何時に___か.'],
 [2305,['私は自転車を泥棒に盗まれた'], 'Object before agent preserves the requested first-person victim passive and the stolen bicycle.'],
 [2306,['先生はさっき職員室で昼ご飯を召し上がりました','先生はさっき職員室で昼ご飯を食べられました'], 'Omitting the optional internal comma retains the teacher-honorific lunch description.'],
 [2309,['ふていし'], 'The normal kana transcription preserves 不定詞; audio was not auditioned.'],
 [2311,['いっち'], 'The normal kana transcription preserves 一致; audio was not auditioned.'],
];

export function japaneseLessonFixes(set){
 const get=lessonRefs(set.snapshot,'ja');
 const edit=(n,fields,reason,sources=[])=>{const{exercise:e,ref}=get(n);set.update('exercises',e.id,fields,`${ref}: ${reason}`,sources);};
 const option=(n,before,after,reason,sources=[])=>{
  const e=get(n).exercise;
  if(e.options.filter(x=>x===before).length!==1||e.options.includes(after))throw Error(`Unexpected option ja-E${n}`);
  const fields={options:e.options.map(x=>x===before?after:x)};
  if(e.distractors.includes(before))fields.distractors=e.distractors.map(x=>x===before?after:x);
  edit(n,fields,reason,sources);
 };
 const sumimasen=['https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_L01.pdf'];
 for(const n of [24,41])option(n,'Thank you','Good morning','Bare すみません permits apology and gratitude; remove the offered gratitude collision, retaining valid Sorry.',sumimasen);
 // E24 has an independently inconsistent distractor mirror containing Excuse me.
 const e24=get(24).exercise;
 edit(24,{distractors:e24.options.map(x=>x==='Thank you'?'Good morning':x).filter(x=>x!==e24.correct_answer)},'Synchronize the distractor mirror with the actual corrected options; Excuse me is another valid すみません gloss, not a wrong option.',sumimasen);
 option(1062,'Taller','Slower','Bare もっと高い supports height and price; Slower is a distinct comparison.', ['https://dictionary.cambridge.org/dictionary/japanese-english/高い']);
 option(1178,'Debate','To whisper','議論する can mean argue or debate; the infinitive marker does not make Debate exclusively a noun.');
 option(1622,'Next','Before','それから permits both Then and Next in narrative sequencing.');
 option(1627,'Then','Before','次に permits both Next and Then in narrative sequencing.');
 option(1668,'If','Because','仮に introduces a supposition; both If and Suppose were defensible without a clause.', ['https://dictionary.cambridge.org/dictionary/japanese-english/仮に']);
 for(const n of [1753,1804])option(n,'Regards','Perhaps','敬具 is a letter closing permitting Sincerely and Regards; replace the colliding closing.', ['https://dictionary.cambridge.org/ja/dictionary/japanese-english/敬具']);
 option(1879,'Ethics','Existence','道徳 admits Morality and Ethics; replace the overlapping abstract noun.', ['https://dictionary.cambridge.org/dictionary/japanese-english/道徳']);
 option(1934,'Argument','Conclusion','主張 can be a claim or an argument advanced for a position; Conclusion is a distinct option in this bare-word question.');

 // The initial seven-row price-idiom rewrite was withdrawn after independent
 // review found an explicit high-price sense in Shogakukan's dictionary.
 // Preserve the original prompts/keys/card; see price-bundle-withdrawal.md.

 edit(2230,{explanation:'行くなら takes up the other speaker’s stated plan and introduces advice about it. Here the reply recommends autumn before the trip is arranged. The uses of と, ば and たら differ with the predicates and context; they do not all require a trip already to have happened.'},'Remove the false shared temporal restriction while retaining the natural なら response.');
 edit(2248,{explanation:'降られた is the plain-past adversity passive of 降る: the speaker was affected by the rain. English can say “I was rained on”; Japanese explicitly presents the event from the affected person’s viewpoint.'},'English does permit a rain passive; distinguish Japanese affectedness without an invented English prohibition.');
 const causativeSources=['https://www.coelang.tufs.ac.jp/modules/grammar/gmod/contents/card/040.html'];
 edit(2260,{explanation:'遊ばせた is the causative of 遊ぶ: someone caused or allowed the child to play. In this sentence 子どもを marks the child. Intransitive causatives can also use に in suitable contexts; を is not an absolute rule. Passive 遊ばれた has a different meaning.'},'Qualify causee case for intransitive verbs; preserve valid を primary.',causativeSources);
 edit(2266,{hint_text:'走らせる is the causative of 走る. Here 私たちを identifies the people the coach made run.',explanation:'コーチ is the causer, and 私たちを identifies the runners. The causative 走らせた supports “made us run” here. を is common in coercive intransitive causatives; に is also possible with suitable verbs and contexts. Passive 走られた would express being affected by someone’s running.'},'Avoid categorical intransitive を and mechanical coercion/permission claims.',causativeSources);
 edit(2264,{metadata:{...get(2264).exercise.metadata,correction_instruction:'Use the causative-passive to say that your manager made you do two hours of overtime last week.'}},'The intended forced-action meaning was only in the raw prompt, which the error-correction view does not display.');
 const rule=set.row('grammar_rules','9eb20e28-279b-4cae-97c3-26a7f7f8478d');
 set.update('grammar_rules',rule.id,{explanation:'Godan verbs use the -a stem plus せる (書く→書かせる); ichidan verbs add させる to the stem (食べる→食べさせる). Causatives can mean make or let someone act. With an expressed transitive object marked を, the causee normally takes に. Intransitive causees commonly take を, but に is also possible depending on the verb and context.'},'Dependent causative reference repeats the categorical intransitive-case rule.',causativeSources);
 const keigoSources=['https://www.bunka.go.jp/seisaku/kokugo_nihongo/kokugo_shisaku/keigo/chapter2/detail.html'];
 edit(2278,{metadata:{...get(2278).exercise.metadata,correction_instruction:'You are asking your teacher whether the teacher has seen the film. Rewrite with respectful language that honors the teacher’s viewing action.'},hint_text:'Honor the teacher’s viewing with ご覧になる or respectful 見られる.',explanation:'Here the teacher is the person being honored, so use ご覧になりましたか or respectful 見られましたか. 拝見する is humble: it can describe the speaker or someone on the speaker’s side in an appropriate relationship, not only first-person actions.'},'Keep the intended teacher-honorific context visible and remove first-person-only humble restriction.',keigoSources);
 edit(2306,{metadata:{...get(2306).exercise.metadata,correction_instruction:'You are respectfully describing your teacher’s eating to another person. Honor the teacher’s action; do not present the teacher as your own in-group representative.'},hint_text:'For the honored teacher’s eating, use 召し上がる or respectful 食べられる.',explanation:'For the teacher being honored here, use 召し上がりました or respectful 食べられました. Humble いただく is not restricted to the speaker alone; it can describe an in-group person’s action in an appropriate relationship.'},'State the intended social perspective and remove the false first-person-only rule.',keigoSources);
 const keigo=set.row('grammar_rules','6bf12c54-f0de-43a4-9c95-0d7dbc793b6c');
 set.update('grammar_rules',keigo.id,{common_errors:keigo.common_errors.map(x=>({...x,note:'When the teacher is the person being honored in this context, use おっしゃる. Humble 申す is not limited to first-person speech; an in-group representative can use it when addressing outsiders.'}))},'Dependent keigo error note says never for a superior, ignoring in-group perspective.',keigoSources);
 edit(2301,{explanation:'The requested subject-honorific pattern is お + verb stem + になる: お帰りになりました. 帰りました is polite to the listener through ます, but does not itself elevate the president as the subject. Use the taught お帰りになる pattern here.'},'Distinguish addressee politeness from subject honorification.',keigoSources);
 edit(2288,{prompt:'ニュースによると、九州で大きな地震があった___です。— Report the news using the hearsay form.',explanation:'For the requested hearsay report, use plain past あった + そうです. によると names the source. はず expresses an expectation or deduction, not this direct hearsay report; citing a source does not make はず universally ungrammatical.'},'Specify hearsay meaning and remove an invented syntactic ban on source-based deduction.');
 edit(2303,{prompt:'新聞によると、来年この町で国際会議が開かれる___です。— Report the newspaper’s information using the hearsay form.',explanation:'For the requested hearsay report, use the plain passive 開かれる followed by そうです. によると identifies the newspaper as the source. はず instead presents expectation or deduction; the source phrase alone does not prohibit that different meaning.'},'Make the tested evidential meaning explicit rather than declaring によると requires そう.');
 edit(2292,{metadata:{...get(2292).exercise.metadata,correction_instruction:'State your own deliberate plan directly, rather than reporting information you heard about your schedule. Use つもりです, 予定です, or a direct polite statement.'},hint_text:'Use a direct expression of your intention or plan, such as 休むつもりです.',explanation:'For your directly stated plan, use 休むつもりです, 休む予定です or 休みます. らしい would instead suggest information or inference, possibly even about your own schedule; it is not the direct-intention meaning requested here.'},'The original can be grammatical for externally learned plans; display the required change in perspective.');
 for(const[n,variants,reason]of japaneseGrammarAlternatives){const e=get(n).exercise;edit(n,{accepted_answers:[...new Set([...e.accepted_answers,...variants])]},reason);}
}
