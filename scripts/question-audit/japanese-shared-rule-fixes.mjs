// Separately identified shared-reference batch; keep all valid source examples.
// These authored fields await independent remediation review.
export function japaneseSharedRuleFixes(set) {
 const comparison=set.row('grammar_rules','58fb98aa-bf0f-4c78-ab28-dd683f502e67');
 if(comparison.common_errors.length!==1||comparison.common_errors[0].error!=='夏より冬が好きです。')throw Error('Unexpected comparison reference');
 set.update('grammar_rules',comparison.id,{
  explanation:'To compare two things, attach より to the comparison standard: 電車はバスより速いです means “The train is faster than the bus.” The pattern AよりBのほうがX explicitly contrasts B with A. のほうが is useful, but not required in every comparison: 夏より冬が好きです and 夏より冬のほうが好きです both express a preference for winter over summer.',
  common_errors:[],
 },'JA-SHARED-COMPARISON: remove the false error label on valid 夏より冬が好きです and explain that のほうが is optional, preserving both valid authored examples.', ['https://www.jpf.org.uk/language/download/StructuresListDec06.pdf']);
 const subject=set.row('grammar_rules','777b8c1a-e871-4e5f-bfac-ef88006b4d6f');
 if(subject.common_errors.length!==1||subject.common_errors[0].error!=='誰は来ましたか。')throw Error('Unexpected subject-particle reference');
 set.update('grammar_rules',subject.id,{
  explanation:'が marks the grammatical subject, often introducing new information or identifying who or what performs an action. In an ordinary question asking for the subject, use が with the question word: 誰が来ましたか asks “Who came?” This is not a rule that every question word must take が. Other roles use the appropriate particle, as in 何を食べますか (“What will you eat?”) or どこに行きますか (“Where will you go?”).',
  common_errors:subject.common_errors.map(x=>({...x,note:'For the ordinary subject-identification question “Who came?”, use 誰が, not 誰は. Question words in other grammatical roles do not automatically take が.'})),
 },'JA-SHARED-WH-SUBJECT: restrict the が contrast to an ordinary subject question, not every occurrence of 誰, 何 or どこ; preserve the valid source examples and correction.', ['https://www.coelang.tufs.ac.jp/mt/ja/gmod/contents/explanation/096.html','https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_L06.pdf']);
}
