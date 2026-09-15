// Pure checkpoint authoring/structural validation; this does not certify
// language, factual accuracy or CEFR calibration of generated items.
import { POOL_SIZE, STRANDS, type Strand } from './checkpoint-core.ts';

export function buildSeedPrompt(language: string, band: string): string {
  return [
    `Write checkpoint assessment items for learners of ${language} at CEFR ${band}.`,
    ``,
    `Return one JSON object and nothing else:`,
    `{"items": [{"strand": ..., "prompt": ..., "audioText": ..., "correctAnswer": ..., "acceptedAnswers": [...]}]}`,
    ``,
    `Produce exactly ${POOL_SIZE} items for EACH of these strands, so ${POOL_SIZE * 4} in total:`,
    `- listening: audioText is one ${language} sentence to be read aloud; prompt is the English instruction ("Type what you hear"); correctAnswer is that same sentence.`,
    `- reading: prompt is a ${language} sentence with exactly one ___ gap. Include a short English meaning cue or enough explicit context to constrain the intended completion; correctAnswer is the missing text.`,
    `- speaking: prompt is one short ${language} sentence for the learner to read aloud; correctAnswer is that sentence. No audioText.`,
    `- writing: prompt is one short English instruction asking for 2-3 sentences in ${language}. No correctAnswer, no acceptedAnswers.`,
    ``,
    `acceptedAnswers lists every reasonable variant, including correctAnswer itself.`,
    `For reading, mentally insert each accepted answer into the complete visible sentence; check gender, number, agreement, particles, prepositions, and elision. Do not use an unrestricted personal-response gap with a single arbitrary key.`,
    `For listening, do not paraphrase the source in correctAnswer. Include valid numeral or orthographic transcription variants when appropriate, but not a different meaning.`,
    `For writing, vary the communicative task and make the requested content and complexity appropriate to ${band}; do not impose advanced essay conventions on beginner sentences.`,
    `Keep every item inside ${band} vocabulary and grammar. Vary the topics.`,
    `Use complete prompts of at most 500 characters and complete keys/audio text of at most 300 characters; never truncate a sentence to fit.`,
    `These measure a learner, so no item may be answerable without knowing ${language}.`,
  ].join('\n');
}

export interface SeededItem {
  strand: Strand;
  prompt: string;
  audioText: string | null;
  correctAnswer: string | null;
  acceptedAnswers: string[];
}

export function parseSeeded(value: unknown): SeededItem[] {
  if (typeof value !== 'object' || value === null) return [];
  const raw = (value as Record<string, unknown>).items;
  if (!Array.isArray(raw)) return [];

  const clean = (v: unknown, max: number, legacySpeaking: boolean): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.replace(/\s+/g, ' ').trim();
    if (!t || (!legacySpeaking && t.length > max)) return null;
    // Speaking content/behavior is outside this question audit's scope.
    return legacySpeaking ? t.slice(0, max) : t;
  };

  const out: SeededItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.strand !== 'string' || !(STRANDS as readonly string[]).includes(e.strand)) continue;
    const strand = e.strand as Strand;
    const legacySpeaking = strand === 'speaking';
    const prompt = clean(e.prompt, 500, legacySpeaking);
    if (!prompt) continue;

    // Open writing is assessed against its task, never a fixed response key.
    if (strand === 'writing') {
      out.push({ strand, prompt, audioText: null, correctAnswer: null, acceptedAnswers: [] });
      continue;
    }

    const correctAnswer = clean(e.correctAnswer, 300, legacySpeaking);
    const audioText = clean(e.audioText, 300, legacySpeaking);
    if (!correctAnswer) continue;
    if (strand === 'listening' && (!audioText || audioText.normalize('NFC') !== correctAnswer.normalize('NFC'))) continue;
    if (strand === 'reading') {
      const gaps = prompt.match(/_+/g) ?? [];
      if (gaps.length !== 1 || gaps[0] !== '___') continue;
    }

    const accepted = Array.isArray(e.acceptedAnswers)
      ? e.acceptedAnswers.map((a) => clean(a, 300, legacySpeaking)).filter((a): a is string => a !== null)
      : [];
    if (!accepted.includes(correctAnswer)) accepted.unshift(correctAnswer);

    out.push({ strand, prompt, audioText, correctAnswer, acceptedAnswers: accepted });
  }
  return out;
}
