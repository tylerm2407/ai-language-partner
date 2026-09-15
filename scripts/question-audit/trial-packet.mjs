import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const file = '.question-audit/trial-baseline.json';
const [language, mode = 'blind'] = process.argv.slice(2);
if (language === '--capture') {
  const { trialExercisesFor } = await import('../../components/onboarding/trial-lesson.ts');
  const rows = ['es', 'fr', 'de'].flatMap(language => trialExercisesFor(language).map((exercise, i) => ({
    ref: `${language}-T${String(i + 1).padStart(4, '0')}`, language, exercise,
  })));
  await writeFile(file, JSON.stringify(rows, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ captured: rows.length, file }));
} else {
  if (!['es', 'fr', 'de'].includes(language) || !['blind', 'key', 'full'].includes(mode)) throw new Error('Usage: trial-packet.mjs es|fr|de blind|key|full');
  const raw = await readFile(file);
  const rows = JSON.parse(raw).filter(row => row.language === language);
  console.log(JSON.stringify({ language, count: rows.length, baseline_sha256: createHash('sha256').update(raw).digest('hex'), source: 'Bundled baseline from default branch; whole trial is a mixed-topic A1 preview.' }));
  for (const { ref, exercise: e } of rows) {
    const visible = { ref, type: e.type, prompt: e.prompt, options: e.options, hint: e.hintText,
      ...(e.type === 'sentence_construction' ? { tiles: [...e.correctAnswer.split(/\s+/), ...(e.distractors ?? [])].sort() } : {}),
      skill: e.skillType, grammar: e.targetGrammar };
    const key = { ref, id: e.id, answer: e.correctAnswer, accepted: e.acceptedAnswers, explanation: e.explanation };
    console.log(JSON.stringify(mode === 'blind' ? visible : mode === 'key' ? key : { ...visible, ...key }));
  }
}
