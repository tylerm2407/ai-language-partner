// One-off verifier for supabase/seeds/grammar/ja.sql
// Re-implements lib/grading.ts normalize/levenshtein/threshold and checks the
// authored content against the app's real fuzzy-grading behavior.
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('./ja.sql', import.meta.url), 'utf8');

// ── grading.ts logic ──
function normalize(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
    .replace(/['‘’]/g, "'").replace(/["“”]/g, '"')
    .replace(/[.!?]+$/, '');
}
function lev(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n; if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i), curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
// Would gradeAnswer mark `user` correct against correct+accepted?
function wouldPass(user, correct, accepted) {
  const nu = normalize(user);
  const all = [normalize(correct), ...accepted.map(normalize)];
  if (all.includes(nu)) return { pass: true, how: 'exact' };
  const maxAllowed = nu.length <= 4 ? 1 : 2;
  for (const a of all) {
    if (lev(nu, a) <= maxAllowed) return { pass: true, how: `fuzzy(d=${lev(nu, a)} vs "${a}")` };
  }
  return { pass: false };
}

// ── parse exercise rows ──
const rowRe = /\('aabbccdd-6666-4006-[\s\S]*?'::jsonb\)/g;
const rawRows = sql.match(rowRe) ?? [];

function tokenize(row) {
  const vals = [];
  let i = 0;
  const s = row;
  while (i < s.length) {
    const c = s[i];
    if (c === '(' || c === ')' || c === ',' || /\s/.test(c)) { i++; continue; }
    if (s.startsWith('ARRAY[', i)) {
      i += 6;
      const arr = [];
      while (s[i] !== ']') {
        if (s[i] === "'") {
          const { str, next } = readString(s, i);
          arr.push(str); i = next;
        } else i++;
      }
      i++; // skip ]
      if (s.startsWith('::text[]', i)) i += 8;
      vals.push(arr);
      continue;
    }
    if (s.startsWith('NULL', i)) { vals.push(null); i += 4; continue; }
    if (c === "'") {
      const { str, next } = readString(s, i);
      i = next;
      if (s.startsWith('::jsonb', i)) { i += 7; vals.push({ jsonb: str }); }
      else vals.push(str);
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i; while (/[0-9]/.test(s[j])) j++;
      vals.push(Number(s.slice(i, j))); i = j; continue;
    }
    i++;
  }
  return vals;
}
function readString(s, i) {
  // s[i] === "'"
  let out = ''; i++;
  while (i < s.length) {
    if (s[i] === "'" && s[i + 1] === "'") { out += "'"; i += 2; continue; }
    if (s[i] === "'") { i++; break; }
    out += s[i]; i++;
  }
  return { str: out, next: i };
}

const exercises = rawRows.map((r) => {
  const v = tokenize(r);
  const [lesson_id, type, order_index, prompt, correct, accepted, options, hint,
    skill_type, subskill, response_mode, target_grammar, distractors, explanation,
    source_type, metadata] = v;
  return {
    lesson_id, type, order_index, prompt, correct,
    accepted: accepted === '{}' ? [] : (accepted ?? []),
    options, hint, skill_type, subskill, response_mode, target_grammar,
    distractors: distractors === '{}' ? [] : (distractors ?? []),
    explanation, source_type,
    metadata: metadata?.jsonb ? JSON.parse(metadata.jsonb) : {},
    nFields: v.length,
  };
});

let problems = [];
let notes = [];
const label = (e) => `${e.lesson_id.slice(19, 23)}#${e.order_index}(${e.type})`;

// ── structural checks ──
if (exercises.length !== 60) problems.push(`Expected 60 exercises, parsed ${exercises.length}`);
const byLesson = {};
for (const e of exercises) {
  (byLesson[e.lesson_id] ??= []).push(e);
  if (e.nFields !== 16) problems.push(`${label(e)}: parsed ${e.nFields} fields, expected 16`);
  if (e.skill_type !== 'grammar' || e.subskill !== 'grammar') problems.push(`${label(e)}: skill/subskill wrong`);
  if (!e.explanation || e.explanation.split(/\s+/).length > 60) problems.push(`${label(e)}: explanation missing or >60 words (${e.explanation?.split(/\s+/).length})`);
  if (!e.hint) problems.push(`${label(e)}: missing hint_text`);
  if (!e.target_grammar || !/^[a-z_]+$/.test(e.target_grammar)) problems.push(`${label(e)}: bad target_grammar`);
  const tapTypes = ['multiple_choice', 'sentence_construction'];
  const expectedMode = tapTypes.includes(e.type) ? 'tap' : 'type';
  if (e.response_mode !== expectedMode) problems.push(`${label(e)}: response_mode ${e.response_mode} != ${expectedMode}`);
  if (e.source_type !== 'manual') problems.push(`${label(e)}: source_type ${e.source_type}`);
}
for (const [lid, list] of Object.entries(byLesson)) {
  if (list.length !== 10) problems.push(`Lesson ${lid}: ${list.length} exercises`);
  const idxs = list.map((e) => e.order_index).sort((a, b) => a - b).join(',');
  if (idxs !== '0,1,2,3,4,5,6,7,8,9') problems.push(`Lesson ${lid}: order_index set ${idxs}`);
}

// ── per-type checks ──
for (const e of exercises) {
  if (e.type === 'multiple_choice') {
    if (!e.options || e.options.length !== 4) problems.push(`${label(e)}: options != 4`);
    if (!e.options.includes(e.correct)) problems.push(`${label(e)}: correct_answer not verbatim in options`);
    const wrongs = e.options.filter((o) => o !== e.correct);
    const dset = [...e.distractors].sort().join('|');
    const wset = [...wrongs].sort().join('|');
    if (dset !== wset) problems.push(`${label(e)}: distractors column != wrong options`);
    for (const w of wrongs) {
      const r = wouldPass(w, e.correct, e.accepted);
      if (r.pass) problems.push(`${label(e)}: DISTRACTOR ACCEPTED: "${w}" ${r.how}`);
    }
  }
  if (['fill_blank', 'cloze_deletion', 'word_form'].includes(e.type)) {
    const count = (e.prompt.match(/___/g) ?? []).length;
    if (count !== 1) problems.push(`${label(e)}: prompt must contain exactly one ___ (found ${count})`);
  }
  if (e.type === 'word_form' && !e.metadata.baseWord) notes.push(`${label(e)}: no metadata.baseWord`);
  if (e.type === 'error_correction') {
    const err = e.metadata.error_sentence;
    if (!err) { problems.push(`${label(e)}: missing metadata.error_sentence`); continue; }
    if (err !== e.prompt.split('(')[0].trim() && !e.prompt.startsWith(err)) notes.push(`${label(e)}: prompt does not start with error sentence`);
    const r = wouldPass(err, e.correct, e.accepted);
    if (r.pass) problems.push(`${label(e)}: RETYPING THE ERROR PASSES: ${r.how}`);
  }
  if (e.type === 'sentence_transformation') {
    const orig = e.metadata.originalSentence;
    if (!orig || !e.metadata.instruction) problems.push(`${label(e)}: missing originalSentence/instruction`);
    if (orig) {
      const r = wouldPass(orig, e.correct, e.accepted);
      if (r.pass) problems.push(`${label(e)}: RETYPING THE ORIGINAL PASSES: ${r.how}`);
    }
  }
  if (e.type === 'sentence_construction') {
    const tiles = e.metadata.tiles;
    if (!tiles) { problems.push(`${label(e)}: missing metadata.tiles`); continue; }
    if (tiles.join(' ') !== e.correct) problems.push(`${label(e)}: tiles join != correct_answer`);
    const multiset = (arr) => [...arr].sort().join('|');
    for (const a of e.accepted) {
      if (multiset(a.split(' ')) !== multiset(tiles)) problems.push(`${label(e)}: accepted "${a}" uses different tokens than tiles`);
    }
  }
}

// ── plausible-wrong-answer battery for typed items (lesson#order → wrongs) ──
const wrongBattery = {
  '0001#3': ['かったら', 'いなら'],
  '0001#4': ['と', 'ば', 'て', 'てから'],
  '0001#5': ['飲むと', '飲んだら', '飲んで'],
  '0001#6': ['春になると、暖かくなります。'],
  '0001#7': ['日本に着くと、電話してください。'],
  '0001#9': ['安いと、買います。'],
  '0002#3': ['盗んだ', '盗みました'],
  '0002#4': ['選んだ'],
  '0002#5': ['降った'],
  '0002#6': ['私は先生に叱った。', '先生は私に叱られた。'],
  '0002#7': ['私は犬が手を噛みました。'],
  '0002#9': ['母に日記を読んだ。'],
  '0003#3': ['遊ばれた', '遊んだ'],
  '0003#4': ['書かれた', '書いた'],
  '0003#5': ['習われた', '習わせた', '習った'],
  '0003#6': ['母は私に部屋を掃除させた。'],
  '0003#7': ['私は先週、部長に二時間も残業しました。'],
  '0003#9': ['コーチは私たちを毎朝走られた。'],
  '0004#3': ['になられ', 'された'],
  '0004#4': ['行きます', 'いきます'],
  '0004#5': ['申しました', '言いました'],
  '0004#6': ['先生はもう昼ご飯を食べましたか。'],
  '0004#7': ['先生、昨日の映画はもう拝見しましたか。'],
  '0004#9': ['明日、書類を送ります。'],
  '0005#3': ['らしい', 'よう'],
  '0005#4': ['そうです', 'らしいです'],
  '0005#6': ['田中さんは明日は休みますと言っていました。'],
  '0005#7': ['私は明日、会社を休むらしいです。'],
  '0005#9': ['山田さんは仕事を辞めそうです。'],
  '0006#3': ['飲まれた', '飲んだ'],
  '0006#4': ['らしい', 'よう'],
  '0006#5': ['来ます', 'きます'],
  '0006#6': ['泥棒が私の自転車を盗んだ。', '私は泥棒に自転車を盗んだ。'],
  '0006#7': ['先生はさっき、職員室で昼ご飯をいただきました。'],
  '0006#9': ['一時間も待たれた。', '一時間待った。'],
};
for (const e of exercises) {
  const key = `${e.lesson_id.slice(19, 23)}#${e.order_index}`;
  const wrongs = wrongBattery[key];
  if (!wrongs) continue;
  for (const w of wrongs) {
    const r = wouldPass(w, e.correct, e.accepted);
    if (r.pass) notes.push(`HOLE ${label(e)}: wrong answer "${w}" would pass: ${r.how}`);
  }
}

// ── grammar rules counts ──
const ruleRe = /\('ja',\s*'(A1|A2|B1|B2)',\s*'([a-z_]+)'/g;
const rules = [...sql.matchAll(ruleRe)].map((m) => ({ level: m[1], name: m[2] }));
if (rules.length !== 20) problems.push(`Expected 20 grammar rules, found ${rules.length}`);
for (const lvl of ['A1', 'A2', 'B1', 'B2']) {
  const n = rules.filter((r) => r.level === lvl).length;
  if (n !== 5) problems.push(`Level ${lvl}: ${n} rules`);
}
const names = rules.map((r) => r.name);
if (new Set(names).size !== names.length) problems.push('Duplicate rule_name');

// B2 rule containment for RuleCard
const b2names = rules.filter((r) => r.level === 'B2').map((r) => r.name);
const tags = new Set(exercises.map((e) => e.target_grammar));
for (const t of tags) {
  const hit = b2names.some((n) => t.includes(n) || n.includes(t));
  if (!hit) problems.push(`target_grammar "${t}" matches no B2 rule_name`);
}

// jsonb validity for rules
const jsonbRe = /'(\[[\s\S]*?\])'::jsonb/g;
let jn = 0;
for (const m of sql.matchAll(jsonbRe)) {
  jn++;
  try { JSON.parse(m[1].replace(/''/g, "'")) } catch (err) { problems.push(`Invalid rules jsonb #${jn}: ${err.message}`); }
}

// quote balance sanity: each line should have an even number of single quotes
sql.split('\n').forEach((line, i) => {
  const q = (line.match(/'/g) ?? []).length;
  if (q % 2 !== 0) problems.push(`Line ${i + 1}: odd number of single quotes — check escaping`);
});

console.log(`Parsed ${exercises.length} exercises, ${rules.length} grammar rules, ${jn} jsonb blocks.`);
console.log('\n=== PROBLEMS (must fix) ===');
console.log(problems.length ? problems.join('\n') : '(none)');
console.log('\n=== NOTES / KNOWN HOLES ===');
console.log(notes.length ? notes.join('\n') : '(none)');
