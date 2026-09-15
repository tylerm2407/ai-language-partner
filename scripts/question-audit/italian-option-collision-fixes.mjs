/** Four Italian choice rows that offer two correct options, plus one blank that renders
 * as a single word. These change `options`, `distractors` and one `prompt`; they are kept
 * apart from italian-accepted-alternatives.mjs, which only ever adds `accepted_answers`.
 *
 * Each collision was re-read against the live frozen row and confirmed against
 * WordReference's editorial Italian-English entry, which is what makes the second option
 * correct rather than merely close:
 *   - `lavare` carries "clean" and "wash" as principal translations of one sense, and the
 *     prompt supplies no object to separate them.
 *   - `colloquio` carries "conversation, meeting" as principal translations alongside
 *     "job interview".
 *   - `buongiorno` is the ordinary formal Hello, which is also why the free-text row
 *     it-E0003 accepts "Hello" in the other file.
 * In each case the stored key is right and the distractor is wrong, so the distractor is
 * what moves. Replacements are drawn from the same unit's own vocabulary and each is a
 * word the prompt plainly does not mean: `buonanotte`, `cucinare`, `stipendio`,
 * `scadenza`.
 *
 * On `distractors` the two row types behave differently in the frozen corpus and both
 * conventions are preserved here rather than normalised: all 3,168 `listening_choice`
 * rows carry a non-empty list and 3,134 of them hold exactly options-minus-key as a set,
 * so those are re-mirrored in place; 3,132 of the 3,288 `multiple_choice` rows carry an
 * empty list, which is the convention for the two `multiple_choice` rows here, so their
 * empty lists are left alone.
 *
 * it-E1546 is the same defect class as the already-approved it-E2190 and it-E2204 spacing
 * fixes and takes their wording: a blank welded to the preceding whole word renders the
 * completed answer as `Socialmedia`, and the key `media` is a separate word.
 *
 * Applying this set is a content change and still needs independent remediation review.
 */
import { lessonRefs } from './lesson-refs.mjs';

const WORDREFERENCE_LAVARE = 'https://www.wordreference.com/iten/lavare';
const WORDREFERENCE_COLLOQUIO = 'https://www.wordreference.com/iten/colloquio';

/** [ref number, type, lesson, prompt, key, frozen options, replaced option, replacement, reason, sources] */
export const italianOptionCollisions = [
  [34, 'listening_choice', 'Listening & Recognition', 'Buongiorno', 'Good morning',
    ['Good morning', 'Hello', 'Good evening', 'Yes'], 'Hello', 'Good night',
    'Buongiorno is also the ordinary formal Hello, so the row offered two correct options and had no single answer. Good night is buonanotte, which buongiorno never means, and it sits beside the unit’s other greeting distractors.',
    []],
  [765, 'multiple_choice', 'Review & Test', 'What does "Lavare" mean in English?', 'To wash',
    ['To clean', 'To sweep', 'To wash', 'Balcony'], 'To clean', 'To cook',
    'WordReference gives clean and wash as principal translations of one sense of lavare, and the prompt supplies no object to separate them, so the row offered two correct options. To cook is cucinare or cuocere, taught separately in this same At Home unit.',
    [WORDREFERENCE_LAVARE]],
  [1232, 'listening_choice', 'Job Interviews', 'Colloquio', 'Interview',
    ['Manager', 'Interview', 'Meeting', 'Project'], 'Meeting', 'Salary',
    'WordReference gives conversation and meeting as principal translations of colloquio alongside job interview, so the row offered two correct options. Salary is stipendio, keyed elsewhere in this same Work & Career unit and never a reading of colloquio.',
    [WORDREFERENCE_COLLOQUIO]],
  [1272, 'multiple_choice', 'Career Goals', 'What does "Colloquio" mean in English?', 'Interview',
    ['Interview', 'Project', 'Colleague', 'Meeting'], 'Meeting', 'Deadline',
    'The same colloquio/meeting collision as it-E1232, in the typed form. Deadline is scadenza, keyed elsewhere in this same Work & Career unit, and a different replacement from it-E1232 so the two rows do not become the same question.',
    [WORDREFERENCE_COLLOQUIO]],
];

/** [ref number, lesson, frozen prompt, corrected prompt, key, reason] */
export const italianPromptSpacing = [
  [1546, 'Review & Test', 'Social_____ (Social media)', 'Social _____ (Social media)', 'media',
    'it-E1546: Separate the phrase-completion blank from the preceding whole word. Without the space the completed answer renders as Socialmedia, and the key media is a separate word.'],
];

export function italianOptionCollisionFixes(set) {
  const get = lessonRefs(set.snapshot, 'it');
  const alreadyPatched = new Map(set.patches().map(p => [p.id, Object.keys(p.after ?? {})]));
  const guard = (ref, id, fields) => {
    const overlap = (alreadyPatched.get(id) ?? []).filter(f => fields.includes(f));
    if (overlap.length) throw new Error(`${ref}: ${overlap.join(', ')} already patched by another producer`);
  };
  for (const [n, type, lesson, prompt, key, options, replaced, replacement, reason, sources] of italianOptionCollisions) {
    const { exercise: e, lesson: l, ref } = get(n);
    if (e.type !== type) throw new Error(`Unexpected exercise type: ${ref}`);
    if (l.title !== lesson) throw new Error(`Unexpected lesson: ${ref}`);
    if (e.prompt !== prompt) throw new Error(`Unexpected prompt: ${ref}`);
    if (e.correct_answer !== key) throw new Error(`Unexpected stored key: ${ref}`);
    if (JSON.stringify(e.options) !== JSON.stringify(options)) throw new Error(`Unexpected options: ${ref}`);
    if (replaced === key) throw new Error(`Refusing to replace the key: ${ref}`);
    if (!options.includes(replaced)) throw new Error(`Replaced option is not present: ${ref}`);
    if (options.includes(replacement)) throw new Error(`Replacement duplicates an existing option: ${ref}`);
    if (!options.includes(key)) throw new Error(`Key is not among the options: ${ref}`);
    guard(ref, e.id, ['options', 'distractors', 'correct_answer', 'accepted_answers']);
    const after = { options: options.map(option => (option === replaced ? replacement : option)) };
    // listening_choice mirrors options-minus-key; multiple_choice holds an empty list.
    // Whichever this row does, it keeps doing after the swap.
    const frozen = e.distractors ?? [];
    const mirrored = JSON.stringify([...frozen].sort()) === JSON.stringify(options.filter(o => o !== key).sort());
    if (type === 'listening_choice' && !mirrored) throw new Error(`Unmirrored listening_choice distractors: ${ref}`);
    if (type === 'multiple_choice' && frozen.length) throw new Error(`Unexpected multiple_choice distractors: ${ref}`);
    if (mirrored) after.distractors = frozen.map(d => (d === replaced ? replacement : d));
    set.update('exercises', e.id, after, `${ref}: ${reason}`, sources);
  }
  for (const [n, lesson, prompt, corrected, key, reason] of italianPromptSpacing) {
    const { exercise: e, lesson: l, ref } = get(n);
    if (e.type !== 'fill_blank') throw new Error(`Unexpected exercise type: ${ref}`);
    if (l.title !== lesson) throw new Error(`Unexpected lesson: ${ref}`);
    if (e.correct_answer !== key) throw new Error(`Unexpected stored key: ${ref}`);
    if (e.prompt !== prompt) throw new Error(`Unexpected prompt: ${ref}`);
    if (corrected !== prompt.replace('_____', ' _____')) throw new Error(`Correction is not the spacing fix: ${ref}`);
    guard(ref, e.id, ['prompt', 'correct_answer']);
    set.replaceText('exercises', e.id, 'prompt', [['_____', ' _____']], reason);
  }
}
