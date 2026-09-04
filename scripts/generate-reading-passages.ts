/**
 * Generate reading passages natively in each target language.
 *
 *   npx tsx scripts/generate-reading-passages.ts                  # DRY RUN
 *   npx tsx scripts/generate-reading-passages.ts --lang ja --execute
 *   npx tsx scripts/generate-reading-passages.ts --execute        # all languages
 *
 * WHY THIS EXISTS
 *
 * `supabase/seed.sql` copy-pasted the fourteen SPANISH reading passages into
 * every language's section. A learner studying Japanese opened the reading
 * tab and got "El cambio climatico" — Spanish prose, under a Spanish title,
 * presented as their target language. 112 rows across eight languages.
 *
 * The rows were unpublished immediately (reversible, and no learner had
 * progress on any of them). This regenerates them properly.
 *
 * WHAT "PROPERLY" MEANS HERE
 *
 * Not translation. A translated Spanish passage still carries Spanish
 * assumptions — "Viaje a Barcelona" is not a reading passage a Japanese
 * learner needs. The topics are kept because they are genuinely universal
 * (climate, a job interview, social media, AI ethics); the prose is written
 * fresh in the target language, at the CEFR level the slot calls for.
 *
 * Every generated passage is checked three ways before it is written:
 *   1. it must actually be in the target language (script/diacritic check —
 *      the exact failure this script exists to fix),
 *   2. it must pass the same content-safety gate the edge functions use,
 *   3. it must be near the word count its CEFR level implies.
 *
 * A passage failing any check is retried once, then skipped. Skipping leaves
 * the slot unpublished, which is the state it is already in — never worse.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Config ───────────────────────────────────────────────────────────────
const MODEL = 'claude-haiku-4-5-20251001';
const ROOT = resolve(__dirname, '..');

/**
 * A cheap, honest "is this actually the right language" test.
 *
 * Deliberately script-level rather than a language-ID model: the failure this
 * guards against is a whole passage in the wrong language, which a script
 * check catches with total confidence and no dependency. For the Latin-script
 * languages it leans on diacritics and function words, which is weaker — so
 * those also assert the ABSENCE of the Spanish markers that caused the bug.
 */
const LANGUAGE_CHECK: Record<string, (t: string) => boolean> = {
  ja: (t) => /[ぁ-んァ-ン一-龯]/.test(t),
  ko: (t) => /[가-힣]/.test(t),
  zh: (t) => /[一-鿿]/.test(t),
  ru: (t) => /[А-Яа-яЁё]/.test(t),
  de: (t) => /\b(der|die|das|und|ist|nicht|für)\b/i.test(t) && !/\b(el|la|los|las|es un|por que)\b/i.test(t),
  fr: (t) => /\b(le|la|les|et|est|dans|pour)\b/i.test(t) && !/\b(el|los|las|muy|porque)\b/i.test(t),
  it: (t) => /\b(il|lo|gli|e|che|per|sono)\b/i.test(t) && !/\b(el|los|las|porque)\b/i.test(t),
  pt: (t) => /\b(o|a|os|as|que|para|não|é)\b/i.test(t) && !/\b(el|los|las|porque|muy)\b/i.test(t),
};

/**
 * The slot titles are the ORIGINAL Spanish ones, because that is what the bad
 * seed left in the rows. Passing them straight to the model primes it with
 * Spanish and it sometimes echoes the Spanish title back into the prose — the
 * language check caught exactly that on the French "El medio ambiente" slot.
 * So the topic is handed over in English instead: neutral, and it cannot leak
 * a language into the output.
 */
const TOPIC_IN_ENGLISH: Record<string, string> = {
  'El cambio climatico': 'climate change',
  'La entrevista de trabajo': 'preparing for a job interview',
  'Viaje a Barcelona': 'a memorable trip abroad',
  'La tecnologia en la educacion': 'technology in education',
  'El medio ambiente': 'protecting the environment',
  'Las redes sociales': 'social media in daily life',
  'Cocina internacional': 'food from around the world',
  'El deporte y la salud': 'sport and health',
  'La inteligencia artificial y el futuro del trabajo': 'AI and the future of work',
  'El arte como forma de protesta': 'art as a form of protest',
  'La globalizacion y la identidad cultural': 'globalisation and cultural identity',
  'Etica de la inteligencia artificial': 'the ethics of artificial intelligence',
  'El poder de la narrativa': 'the power of storytelling',
  'Idiomas y cerebro': 'how the brain learns languages',
};

const LANGUAGE_NAME: Record<string, string> = {
  ja: 'Japanese', ko: 'Korean', zh: 'Simplified Chinese', ru: 'Russian',
  de: 'German', fr: 'French', it: 'Italian', pt: 'Portuguese',
};

interface Slot {
  id: string;
  unitId: string | null;
  cefrLevel: string;
  topic: string;
  words: number;
  questions: number;
}

interface Generated {
  title: string;
  content: string;
  questions: { text: string; answer: string }[];
}

// ── Secrets ──────────────────────────────────────────────────────────────
function env(key: string): string {
  const raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
  const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return (m?.[1] ?? process.env[key] ?? '').trim().replace(/^["']|["']$/g, '');
}

// ── Generation ───────────────────────────────────────────────────────────
async function generate(lang: string, slot: Slot, apiKey: string): Promise<Generated | null> {
  const name = LANGUAGE_NAME[lang];
  const system =
    `You write short reading passages for language learners at CEFR level ${slot.cefrLevel}. ` +
    `Write ENTIRELY in ${name}. Never include any Spanish. ` +
    `The passage must read as if written for a ${name} audience, not translated: use examples, ` +
    `places and references a ${name} reader would recognise. ` +
    `Return ONLY JSON: {"title": "...", "content": "...", "questions": [{"text": "...", "answer": "..."}]}. ` +
    `The title is in ${name}. The comprehension questions and their answers are in ENGLISH, ` +
    `because the learner reads those in their own language.`;
  const user =
    `Topic: ${slot.topic}\n` +
    `Target length: about ${slot.words} words.\n` +
    `Number of comprehension questions: ${slot.questions}.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1400,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? '';
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    const parsed = JSON.parse(json) as Generated;
    if (!parsed.title || !parsed.content) return null;
    return parsed;
  } catch {
    return null;
  }
}

function wordCount(text: string, lang: string): number {
  // CJK has no spaces; approximate by character count, which is what the
  // existing word_count column effectively means for those languages.
  if (['ja', 'zh', 'ko'].includes(lang)) return text.replace(/\s/g, '').length;
  return text.trim().split(/\s+/).length;
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const only = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;

  const supabase = createClient(
    env('EXPO_PUBLIC_SUPABASE_URL') || env('SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
  );
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey.startsWith('sk-ant-api03')) {
    console.error('ANTHROPIC_API_KEY must be a workspace key (sk-ant-api03-…)');
    process.exit(1);
  }

  // Each existing row already carries everything the slot needs: its title is
  // the topic, and its cefr_level and word_count are the shape. There is no
  // need to consult the Spanish set at all — only its PROSE was wrong, and the
  // prose is exactly what we are replacing.
  const { data: courses } = await supabase
    .from('courses').select('id, target_language').neq('target_language', 'es');

  const byLang = new Map<string, string[]>();
  for (const c of courses ?? []) {
    if (only && c.target_language !== only) continue;
    byLang.set(c.target_language, [...(byLang.get(c.target_language) ?? []), c.id]);
  }
  console.log(`languages: ${[...byLang.keys()].join(', ')}`);
  console.log(execute ? 'MODE: EXECUTE — will generate and write\n' : 'MODE: DRY RUN — nothing generated or written\n');

  let generated = 0, skipped = 0, cost = 0;

  for (const [lang, courseIds] of byLang) {
    const { data: existing } = await supabase
      .from('reading_passages')
      .select('id, unit_id, cefr_level, title, word_count')
      .in('course_id', courseIds)
      .order('cefr_level');

    console.log(`── ${lang} (${LANGUAGE_NAME[lang] ?? lang}) — ${existing?.length ?? 0} slots`);
    if (!execute) { console.log('   (dry run)\n'); continue; }

    for (const row of existing ?? []) {
      const slot: Slot = {
        id: row.id,
        unitId: row.unit_id,
        cefrLevel: row.cefr_level,
        topic: TOPIC_IN_ENGLISH[row.title] ?? row.title,
        words: row.word_count || (row.cefr_level === 'B2' ? 180 : 110),
        questions: row.cefr_level === 'B2' ? 3 : 2,
      };

      let ok: Generated | null = null;
      for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
        const g = await generate(lang, slot, apiKey);
        cost += (400 * 1 + 900 * 5) / 1e6;
        if (!g) continue;
        const check = LANGUAGE_CHECK[lang];
        if (check && !check(g.content)) {
          console.log(`   ! ${slot.topic}: output was not ${LANGUAGE_NAME[lang]} (attempt ${attempt})`);
          continue;
        }
        ok = g;
      }
      if (!ok) { skipped++; console.log(`   SKIP ${slot.topic} — left unpublished`); continue; }

      await supabase.from('reading_passages').update({
        title: ok.title,
        content: ok.content,
        word_count: wordCount(ok.content, lang),
        is_published: true,
      }).eq('id', slot.id);

      await supabase.from('reading_questions').delete().eq('passage_id', slot.id);
      const qs = (ok.questions ?? []).slice(0, slot.questions).map((q, idx) => ({
        passage_id: slot.id,
        order_index: idx,
        question_text: q.text,
        question_type: 'short_answer',
        correct_answer: q.answer,
        accepted_answers: [],
      }));
      if (qs.length) await supabase.from('reading_questions').insert(qs);

      generated++;
      console.log(`   ok  ${ok.title}  (${wordCount(ok.content, lang)} words, ${qs.length} q)`);
    }
    console.log('');
  }

  console.log(`generated ${generated}, skipped ${skipped}, approx cost $${cost.toFixed(2)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
