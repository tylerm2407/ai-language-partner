import { lessonRefs } from './lesson-refs.mjs';

export function chineseLessonFixes(set) {
  const { row, update } = set;
  const get = lessonRefs(set.snapshot, 'zh');
  const edit = (n, fields, reason, sources = []) => update('exercises', get(n).exercise.id, fields, `${get(n).ref}: ${reason}`, sources);
  const choice = (n, before, after, reason, sources = []) => {
    const e = get(n).exercise;
    if (e.options.filter(x => x === before).length !== 1 || e.options.includes(after) || e.correct_answer === before) throw new Error(`Unexpected zh-E${n} options`);
    edit(n, { options: e.options.map(x => x === before ? after : x), ...(e.distractors.includes(before) ? { distractors: e.distractors.map(x => x === before ? after : x) } : {}) }, reason, sources);
  };
  choice(36, 'Sorry', 'Good morning', '不好意思 allows apology and excuse-me readings; preserve the valid primary key and remove the competing gloss.', ['https://dictionary.cambridge.org/dictionary/chinese-simplified-english/%E4%B8%8D%E5%A5%BD%E6%84%8F%E6%80%9D']);
  choice(41, 'Excuse me', 'Good night', '对不起 can be rendered Sorry or Excuse me; no context excludes the offered alternative.', ['https://dictionary.cambridge.org/dictionary/english-chinese-simplified/excuse-me']);
  choice(753, 'To sweep', 'To repair', '打扫 permits both clean and sweep, making the offered translations overlap.', ['https://dictionary.cambridge.org/ta/dictionary/chinese-simplified-english/%E6%89%93%E6%89%AB']);
  choice(1347, 'To book', 'Passport', '预约 has verbal booking and nominal reservation uses; a bare word cannot distinguish the two options.', ['https://dictionary.cambridge.org/us/dictionary/chinese-simplified-english/%E9%A2%84%E7%BA%A6']);
  choice(1622, 'Next', 'Before', '然后 in this sequence context permits both Then and Next.');
  choice(1627, 'Then', 'Before', '接下来 permits both Next and Then; remove the competing sequence translation.');
  for (const n of [811, 812]) {
    const e = get(n).exercise;
    if (e.prompt !== '慰概' || e.prompt_audio_url !== null) throw new Error(`Unexpected corrupt transcript/audio at zh-E${n}`);
    edit(n, { prompt: '慷慨', ...(n === 811 ? { correct_answer: '慷慨' } : {}) }, '慰概 is corrupted text, not the word generous. 慷慨 is correctly spelled. The stored audio URL is null, so fallback TTS will use the corrected text. The shared card 大方 is also a valid generous synonym and is preserved.', ['https://dictionary.cambridge.org/dictionary/english-chinese-simplified/generous']);
  }
  edit(2157, { hint_text: "To pull someone's leg" }, 'Restore the possessive apostrophe in the English listening hint.');

  const oxfordGrammar = ['https://www.ctcfl.ox.ac.uk/media/pages/pdf/lang-work_grammar-database_grammar-database-for-hard-copy.pdf'];
  const rvcSources = ['https://www.ctcfl.ox.ac.uk/materials_grammar-exercises_rvc-answers/'];
  const zheSources = ['https://www.ctcfl.ox.ac.uk/materials_grammar-exercises_progressive-aspect-and-zhe/'];
  edit(2231, { explanation: '洗干净 states the washing result: clean. A 把 predicate normally needs more than a bare verb, but that extra material is not necessarily a result complement; aspect or an action measure can also complete it.' }, 'A result complement is one valid 把 pattern, not the only possible elaboration.', oxfordGrammar);
  edit(2250, { explanation: 'In this neutral passive, 我的钱包 is the affected subject and precedes 被: 我的钱包被小偷偷走了. A time or setting phrase could precede that subject in a longer sentence, so the receiver need not be the first words of every 被-sentence.' }, 'Scope the subject-order rule instead of requiring the receiver to start every passive.');
  const passive = row('grammar_rules', 'c742ef90-fb40-42e9-845b-bc866665638f');
  update('grammar_rules', passive.id, { common_errors: passive.common_errors.map(x => x.error === '被小偷偷走了我的钱包。' ? { ...x, note: 'In this neutral passive, put the affected subject 我的钱包 before 被.' } : x) }, 'Dependent passive reference repeats the sentence-initial receiver overstatement.');
  edit(2258, { explanation: 'The neutral new-information order here is 他从书包里拿出了一本词典: source phrase before the verb, then the newly introduced dictionary. Other discourse contexts can use topicalized objects; they do not make the displayed rearrangements the neutral answer to this prompt.' }, 'Replace the universal ban on pre-verbal indefinite objects with the actual information-structure target.');
  edit(2263, { explanation: 'This transformation specifically requests the potential complement: insert 不 between 看 and 懂 to form 看不懂. 能/不能 can combine with resultative predicates in other constructions; the source sentence is being rewritten, not declared universally ungrammatical.' }, 'Potential complements are not the only way to describe ability to achieve a result.', rvcSources);
  const resultRule = row('grammar_rules', '5e04f672-e66b-4d3c-ac95-95eae46e37f5');
  update('grammar_rules', resultRule.id, {
    explanation: 'A result follows the verb: 听懂, 找到, 写错. Inserting 得/不 forms a potential complement: 听得懂, 听不懂. This pattern expresses whether a result can be achieved; modal 能/不能 can also combine with resultative predicates in appropriate contexts.',
    common_errors: resultRule.common_errors.map(x => x.error === '我不能听懂。' ? { ...x, error: '我听不得懂。', note: 'For the negative potential pattern, insert 不 directly between the verb and result.' } : x.error === '我找不到了我的手机。' ? { ...x, note: 'Do not place 了 between 找不到 and its object. Sentence-final changed-state 了 is a different use and can occur after the object.' } : x),
  }, 'Dependent grammar reference must not label all 不能 + resultative predicates incorrect; replace that example with a genuine malformed potential.', rvcSources);
  edit(2272, { hint_text: 'Here 开着 describes the continuing state of being open.', explanation: '开着 describes the door as open, followed by an invitation to enter. Here 着 marks a state; with other predicates it can also mark a continuing or background action.' }, 'Do not generalize this stative use into a ban on action uses of 着.', zheSources);
  const zheRule = row('grammar_rules', 'ef310328-8f4c-4899-93ce-bd43840bb33c');
  update('grammar_rules', zheRule.id, { explanation: 'Verb + 着 marks a continuing state or background action: 门开着 describes an open door; 他笑着说 describes speaking while smiling. With activity verbs, 着 can also participate in a progressive description.' }, 'Dependent reference contradicts its own background-action example by saying states, not events.', zheSources);
  edit(2273, { explanation: '去了 reports the going event; 去过 presents a prior experience of visiting. A completed earlier visit does not determine where the person is now: they could have returned for another visit.' }, 'Remove the false inference that a person with a prior Beijing experience cannot currently be there.', ['https://www.sciencedirect.com/science/article/pii/S0024384119301111']);
  edit(2274, { explanation: '穿着一件红大衣 gives the state of wearing the coat. 正在穿 describes putting it on, while 要去买 describes a planned purchase. The displayed pre-verbal object order is not the neutral way to express the requested wearing state; this is not a general ban on topicalized objects.' }, 'Keep the uniquely appropriate state option while removing the absolute object-order rule.');
  edit(2278, { explanation: 'With 过 in this experiential sentence, put the setting 在上海 before 住过: 我以前在上海住过. This does not mean every 在 phrase must precede its verb; 住在上海 is grammatical in other constructions.' }, 'Correct the scope of the locative rule; the requested 过 repair remains unchanged.', rvcSources);

  const compareSources = ['https://openbooks.lib.msu.edu/chs102/open/download?type=pdf', 'https://static1.squarespace.com/static/5d77234ef15df96deffc2df7/t/5dbfd88688977b62a3947600/1572853911859/Picture%2BSet%2B-%2BPractice%2BUsing%2B%E6%AF%94%2B%28bi%CC%8C%29.pdf'];
  edit(2286, { hint_text: 'Express much taller after 高 with 多了, 得多 or 很多; do not use 比我很高.', explanation: 'The offered correct answer is 哥哥比我高多了. A large difference can be expressed after the adjective with 多了, 得多 or 很多. Bare 很 before 高 does not form this comparison; swapping the brothers reverses its meaning.' }, 'The character 很 is not banned from every 比 sentence: post-adjectival 很多 is standard.', compareSources);
  edit(2292, { hint_text: 'Remove 很 before 冷 and express much colder after 冷 with 多了, 得多 or 很多.', explanation: 'Use 今天比昨天冷多了, 冷得多 or 冷很多. The degree-of-difference expression follows 冷, unlike the erroneous 很冷 placement in the source.' }, 'Acknowledge the valid post-adjectival 很多 variant while retaining the comparative target.', compareSources);
  edit(2307, { hint_text: 'Remove 很 before 大; use 多了, 得多 or 很多 after 大 for much bigger.', explanation: 'For much bigger, use 比那个大多了, 大得多 or 大很多. Bare 很 before 大 does not express the intended degree of difference in this construction.' }, 'The third common degree-of-difference form is valid here too.', compareSources);
  edit(2292, { metadata: { ...get(2292).exercise.metadata, correction_instruction: 'Rewrite to say: Today is much colder than yesterday. Keep the comparison with 比 and express much colder after 冷.' } }, 'The required large degree of difference must be visible, so merely deleting 很 is not rejected under an unrestricted correction instruction.');
  edit(2307, { metadata: { ...get(2307).exercise.metadata, correction_instruction: 'Rewrite to say: This room is much bigger than that one. Keep the comparison with 比 and express much bigger after 大.' } }, 'Show the requested much-bigger meaning before the learner answers.');
  const compareRule = row('grammar_rules', 'ae55c745-21b1-405e-b1d2-7a490518f814');
  update('grammar_rules', compareRule.id, {
    explanation: 'A 比 B + adjective compares two things. Put a measure or degree of difference after the adjective: 大三岁, 高得多, 高多了, 高很多. Negatives include A 没有 B (那么) adjective and A 不如 B. 越来越 + adjective expresses an increasing degree. Avoid bare 很 before the adjective in the basic 比 pattern.',
    common_errors: compareRule.common_errors.map(x => x.error === '今天比昨天很冷。' ? { ...x, note: 'Put the degree of difference after 冷: 冷多了, 冷得多 or 冷很多.' } : x),
  }, 'Dependent comparison reference must allow 很多 after the adjective.', compareSources);
  for (const [n, answers, reason] of [
    [2260, ['清'], '听清 and 听清楚 both mean hearing clearly and fit the supplied question.'],
    [2304, ['清'], '听不清 and 听不清楚 both fit the potential-complement meaning.'],
    [2292, ['今天比昨天冷很多'], '冷很多 expresses the requested much colder, with the degree after the adjective.'],
    [2307, ['这个房间比那个大很多'], '大很多 expresses the requested much bigger, with the degree after the adjective.'],
    [2149, ['迟到比不到好'], 'Deleting the extraneous x already produces a grammatical better-late-than-never sentence; 总 is not obligatory.'],
  ]) edit(n, { accepted_answers: [...get(n).exercise.accepted_answers, ...answers] }, reason, [2292, 2307].includes(n) ? compareSources : []);
  edit(2260, { hint_text: 'Use a result complement meaning clearly after 听.' }, 'The hint must not falsely imply that the longer 清楚 is the only valid result complement.');
  edit(2304, { hint_text: 'Complete the potential complement meaning cannot hear clearly: 听不…' }, 'Allow the shorter 清 as well as 清楚 within the same requested pattern.');
}
