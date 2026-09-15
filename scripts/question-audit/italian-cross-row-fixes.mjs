/** Italian cross-row consistency: nineteen groups where two rows put *the same question*
 * and disagree on what they accept.
 *
 * Grouping every Italian free-text row by (direction, English gloss, stored key) gives 510
 * groups, 102 of them holding more than one row. In the frozen corpus none of the 102
 * disagreed, because every Italian `accepted_answers` was empty. After the current draft,
 * nineteen do: one member gained an alternative and its twin did not. Both members are bare
 * `Translate to Italian: X` / `Fill in the missing word: _____ means X` prompts with the same
 * key, the same band, no hint, no explanation and no options, so nothing in either row's
 * context licenses the difference. A learner meets the same question twice and is marked
 * differently.
 *
 * **The resolution is the union, not "copy the richer row."** `I bought` is the case that
 * proves it: it-E0865 holds `Ho comperato` and it-E0898 holds `Io ho comprato`, and neither
 * is a superset. Each addition was judged on its own merits in the receiving row before it
 * was propagated; none is accepted merely because its twin accepts it. The twin is what
 * makes the *inconsistency* a defect, not what makes the form correct.
 *
 * Two facts that had to be checked rather than assumed:
 *   - The reviewer reported 22 disagreeing groups, of which three were said to be explained
 *     by the declared passato remoto refusal (it-E0877, it-E0889, it-E0913). Re-derived
 *     against the draft, there are nineteen, and the passato remoto rows are among them for
 *     a different reason: what their cloze rows lack is an explicit subject pronoun
 *     (`Io ho studiato`), which has nothing to do with the refused tense. The refusal
 *     explains why those rows were never opened, not why they should stay unequal. Three of
 *     the reviewer's groups have since dissolved — it-E0287, it-E0592 and it-E1024 were
 *     rewritten wholesale by other producers and no longer carry the gloss they were grouped
 *     under, so Hot/Caldo, Neighbor/Vicino and Slower/Più lento are no longer groups at all.
 *   - A pronoun form on a `cloze_deletion` row is not against policy. it-E0925, it-E0937 and
 *     it-E0949 are cloze rows that already accept `Io studierò`, `Io viaggerò` and
 *     `Io lavorerò`, and their translate twins agree. The past-tense cloze rows are the
 *     inconsistency, not the rule.
 *
 * Fifteen of the twenty-two additions currently pass only by edit-distance tolerance — the
 * learner is told a correct Italian form is a "Minor typo". Seven are rejected outright.
 * Both are repairs, and the test pins the split so a grader change cannot move one into the
 * other silently.
 *
 * Seven receiving rows are reached first by `italian-accepted-alternatives.mjs`, which is
 * integrated and approved. This file does not edit it. `selectItalianAlternativesBeforeCrossRow`
 * supersedes that producer's write on exactly those seven rows, asserting the exact value it
 * would have written, and this producer then writes a strict superset of it. Nothing the
 * approved batch authored is dropped. Without the wrapper this producer throws rather than
 * patching over a live field.
 *
 * Also here: the fifth welded blank. it-E1008 renders as `Menocaro`.
 *
 * Applying this set is a content change and still needs independent remediation review.
 */
import { isDeepStrictEqual as eq } from 'node:util';
import { lessonRefs } from './lesson-refs.mjs';

const TRECCANI_USANZA = 'https://www.treccani.it/vocabolario/usanza/';
const TRECCANI_COMPRARE = 'https://www.treccani.it/vocabolario/comprare/';
const TRECCANI_BAGAGLIO = 'https://www.treccani.it/vocabolario/bagaglio/';
const TRECCANI_VACANZA = 'https://www.treccani.it/vocabolario/vacanza/';

/** Why each addition is licensed in the row that receives it, independently of its twin. */
const GROUNDS = {
  gender: 'the English is not gendered and the prompt names no referent, so the counterpart Italian form is equally grammatical',
  number: 'the English gloss is not marked for number and the prompt names no quantity, so the Italian form the language habitually uses for it is equally licensed',
  pronoun: 'Italian allows an explicit subject pronoun and nothing in the prompt forbids one',
  reflexive: 'the reflexive is a standard reading of the objectless English infinitive',
  person: 'the prompt names no addressee, so the other persons of the same verb are equally licensed',
  citation: 'the bare English gloss is a citation form, and the Italian infinitive is the matching citation form of the same verb',
  lexical: 'an ordinary dictionary equivalent of the stored key, with nothing in the bare prompt narrowing the sense',
};

/** One entry per (direction, English gloss, stored key) group that the draft leaves
 * disagreeing. Every row in the corpus is `to_target`: the learner writes Italian.
 *
 * rows: [frozen ref number, type, lesson title, alternatives the row already carries, additions]
 *   - a row with no additions is the twin, asserted and not patched;
 *   - a row with both a non-empty carried list and additions is reached first by
 *     italian-accepted-alternatives.mjs and needs the composition wrapper.
 * Every one of these rows carries `[]` in the frozen snapshot. */
export const italianCrossRowGroups = [
  { gloss: 'Nurse', key: 'Infermiera', grounds: ['gender'], sources: [],
    rows: [[649, 'cloze_deletion', 'At the Doctor Office', ['Infermiere'], []],
           [682, 'translate_to_target', 'Healthy Lifestyle', [], ['Infermiere']]] },
  { gloss: 'Tired', key: 'Stanco', grounds: ['gender'], sources: [],
    rows: [[685, 'cloze_deletion', 'Healthy Lifestyle', ['Stanca'], []],
           [652, 'translate_to_target', 'At the Doctor Office', [], ['Stanca']]] },
  { gloss: 'To rest', key: 'Riposare', grounds: ['reflexive'], sources: [],
    rows: [[697, 'cloze_deletion', 'Review & Test', ['Riposarsi'], []],
           [664, 'translate_to_target', 'At the Pharmacy', [], ['Riposarsi']]] },
  { gloss: 'Shy', key: 'Timido', grounds: ['gender'], sources: [],
    rows: [[793, 'cloze_deletion', 'Negative Emotions', ['Timida'], []],
           [826, 'translate_to_target', 'Emotional Reactions', [], ['Timida']]] },
  { gloss: 'Generous', key: 'Generoso', grounds: ['gender'], sources: [],
    rows: [[829, 'cloze_deletion', 'Emotional Reactions', ['Generosa'], []],
           [796, 'translate_to_target', 'Negative Emotions', [], ['Generosa']]] },
  { gloss: 'Brave', key: 'Coraggioso', grounds: ['gender'], sources: [],
    rows: [[805, 'cloze_deletion', 'Personality Traits', ['Coraggiosa'], []],
           [838, 'translate_to_target', 'Review & Test', [], ['Coraggiosa']]] },
  { gloss: 'Taller', key: 'Più alto', grounds: ['gender'], sources: [],
    rows: [[1021, 'cloze_deletion', 'Superlatives', ['Più alta'], []],
           [1054, 'translate_to_target', 'Review & Test', [], ['Più alta']]] },
  { gloss: 'Tradition', key: 'Tradizione', grounds: ['lexical'], sources: [TRECCANI_USANZA],
    rows: [[1102, 'translate_to_target', 'Festivals', ['Usanza'], []],
           [1069, 'cloze_deletion', 'National Holidays', [], ['Usanza']]] },
  { gloss: 'Luggage', key: 'Bagaglio', grounds: ['number'], sources: [TRECCANI_BAGAGLIO],
    rows: [[1323, 'cloze_deletion', 'At the Airport', ['Bagagli'], []],
           [1362, 'translate_to_target', 'Travel Problems', [], ['Bagagli']]] },
  { gloss: 'Awesome', key: 'Fantastico', grounds: ['gender'], sources: [],
    rows: [[1757, 'cloze_deletion', 'Writing Emails', ['Fantastica'], []],
           [1796, 'translate_to_target', 'Review & Test', [], ['Fantastica']]] },
  { gloss: 'I studied', key: 'Ho studiato', grounds: ['pronoun'], sources: [],
    rows: [[856, 'translate_to_target', 'What Happened Yesterday', ['Io ho studiato'], []],
           [889, 'cloze_deletion', 'Childhood Memories', [], ['Io ho studiato']]] },
  { gloss: 'I traveled', key: 'Ho viaggiato', grounds: ['pronoun'], sources: [],
    rows: [[910, 'translate_to_target', 'Review & Test', ['Io ho viaggiato'], []],
           [877, 'cloze_deletion', 'A Memorable Trip', [], ['Io ho viaggiato']]] },
  { gloss: 'I worked', key: 'Ho lavorato', grounds: ['pronoun'], sources: [],
    rows: [[880, 'translate_to_target', 'A Memorable Trip', ['Io ho lavorato'], []],
           [913, 'cloze_deletion', 'Review & Test', [], ['Io ho lavorato']]] },
  { gloss: 'I saw', key: 'Ho visto', grounds: ['pronoun'], sources: [],
    rows: [[886, 'translate_to_target', 'Childhood Memories', ['Ho veduto', 'Io ho visto'], []],
           [853, 'cloze_deletion', 'What Happened Yesterday', ['Ho veduto'], ['Io ho visto']]] },
  { gloss: 'I played', key: 'Ho giocato', grounds: ['pronoun'], sources: [],
    rows: [[868, 'translate_to_target', 'Last Weekend', ['Ho suonato', 'Io ho giocato'], []],
           [901, 'cloze_deletion', 'Recent News', ['Ho suonato'], ['Io ho giocato']]] },
  { gloss: 'I bought', key: 'Ho comprato', grounds: ['lexical', 'pronoun'], sources: [TRECCANI_COMPRARE],
    rows: [[865, 'cloze_deletion', 'Last Weekend', ['Ho comperato', 'Ho acquistato'], ['Io ho comprato']],
           [898, 'translate_to_target', 'Recent News', ['Ho acquistato', 'Io ho comprato'], ['Ho comperato']]] },
  { gloss: 'Vacation', key: 'Vacanza', grounds: ['number'], sources: [TRECCANI_VACANZA],
    rows: [[961, 'cloze_deletion', 'Making Appointments', ['Vacanze', 'Ferie'], []],
           [928, 'translate_to_target', 'Plans for Tomorrow', ['Ferie'], ['Vacanze']]] },
  { gloss: 'First', key: 'Prima', grounds: ['lexical'], sources: [],
    rows: [[1561, 'cloze_deletion', 'Telling a Story', ['Primo', 'Per prima cosa', 'Innanzitutto'], []],
           [1600, 'translate_to_target', 'Interruptions', ['Per prima cosa', 'Innanzitutto'], ['Primo']]] },
  { gloss: 'Imagine', key: 'Immagina', grounds: ['person', 'citation'], sources: [],
    rows: [[1673, 'cloze_deletion', 'Giving Advice', ['Immagini', 'Immaginate', 'Immaginiamo', 'Immaginare'], []],
           [1712, 'translate_to_target', 'Review & Test', ['Immaginiamo'], ['Immagini', 'Immaginate', 'Immaginare']]] },
];

/** The fifth welded blank, after the approved it-E2190 and it-E2204 and the it-E1546 fix in
 * italian-option-collision-fixes.mjs. `Meno` is a whole word and `caro` is a separate one.
 * The draft patches this row's `accepted_answers`, a different field, so nothing contends.
 * [ref number, lesson, frozen prompt, corrected prompt, key, reason] */
export const italianCrossRowPromptSpacing = [
  [1008, 'Comparing People', 'Meno_____ (Cheaper)', 'Meno _____ (Cheaper)', 'caro',
    'it-E1008: Separate the phrase-completion blank from the preceding whole word. Without the space the completed answer renders as Menocaro, and the key caro is a separate word.'],
];

const refOf = n => `it-E${String(n).padStart(4, '0')}`;
const asSet = list => JSON.stringify([...list].sort());

/** Rows this producer must write a superset of, keyed by frozen ref number, with the exact
 * value italian-accepted-alternatives.mjs writes to them. */
function supersededRows() {
  const out = [];
  for (const group of italianCrossRowGroups) {
    for (const [n, , , carried, additions] of group.rows) {
      if (carried.length && additions.length) out.push([n, carried]);
    }
  }
  return out;
}

/** Suppress `italian-accepted-alternatives.mjs` on exactly the seven rows this batch writes a
 * superset of, so one field has one writer. The exact superseded value is asserted, so a
 * revision to that producer surfaces here as a thrown error instead of a silent drop.
 *
 * Wrap the *alternatives* call, and run this producer after it:
 *   italianAcceptedAlternatives(selectItalianAlternativesBeforeCrossRow(set));
 *   italianCrossRowFixes(set);
 */
export function selectItalianAlternativesBeforeCrossRow(set) {
  const get = lessonRefs(set.snapshot, 'it');
  const superseded = new Map(supersededRows().map(([n, carried]) => [get(n).exercise.id, { ref: refOf(n), carried }]));
  return {
    ...set,
    update(table, id, after, reason, sources) {
      const hit = table === 'exercises' ? superseded.get(id) : undefined;
      if (hit) {
        if (!eq(after, { accepted_answers: hit.carried })) {
          throw new Error(`Changed Italian cross-row dependency: ${hit.ref}`);
        }
        return;
      }
      return set.update(table, id, after, reason, sources);
    },
  };
}

/** Writes `accepted_answers` on the twenty receiving rows and one `prompt`. Carried
 * alternatives are preserved unchanged and first, so nothing an earlier producer authored is
 * dropped. Every declared fact about the frozen row is re-asserted, and an addition already
 * reachable on its row throws rather than being quietly discarded. */
export function italianCrossRowFixes(set) {
  const get = lessonRefs(set.snapshot, 'it');
  const patched = new Map(set.patches().map(p => [p.id, p]));
  const guard = (ref, id, fields) => {
    const overlap = Object.keys(patched.get(id)?.after ?? {}).filter(f => fields.includes(f));
    if (overlap.length) {
      throw new Error(`${ref}: ${overlap.join(', ')} already patched by another producer — wrap italianAcceptedAlternatives in selectItalianAlternativesBeforeCrossRow(set) so this batch can write the union`);
    }
  };

  for (const group of italianCrossRowGroups) {
    if (group.rows.length !== 2) throw new Error(`Expected a pair: ${group.gloss}`);
    if (!group.grounds.length || group.grounds.some(g => !GROUNDS[g])) throw new Error(`Unknown grounds: ${group.gloss}`);
    const finals = [];
    for (const [n, type, lesson, carried, additions] of group.rows) {
      const { exercise: e, lesson: l, ref } = get(n);
      if (e.type !== type) throw new Error(`Unexpected exercise type: ${ref}`);
      if (l.title !== lesson) throw new Error(`Unexpected lesson: ${ref}`);
      if (e.correct_answer !== group.key) throw new Error(`Unexpected stored key: ${ref}`);
      if (e.options?.length) throw new Error(`Choice row is out of scope for this producer: ${ref}`);
      // The whole batch rests on the two rows asking one question; assert that, don't assume it.
      const expected = type === 'cloze_deletion'
        ? `Fill in the missing word: _____ means ${group.gloss}`
        : `Translate to Italian: ${group.gloss}`;
      if (e.prompt !== expected) throw new Error(`Unexpected prompt: ${ref}`);
      if (e.hint_text || e.explanation) throw new Error(`Row carries narrowing context: ${ref}`);
      if ((e.accepted_answers ?? []).length) throw new Error(`Unexpected frozen alternatives: ${ref}`);

      const final = [...carried, ...additions];
      finals.push(final);
      if (!additions.length) {
        // The twin. Not patched here; assert whatever the draft gives it matches the claim.
        const live = patched.get(e.id)?.after;
        if (live && Object.hasOwn(live, 'accepted_answers') && !eq(live.accepted_answers, carried)) {
          throw new Error(`Twin no longer carries the declared alternatives: ${ref}`);
        }
        continue;
      }
      const reachable = new Set([group.key, ...carried].map(a => a.toLowerCase()));
      const seen = new Set();
      for (const addition of additions) {
        if (typeof addition !== 'string' || !addition.trim()) throw new Error(`Empty addition: ${ref}`);
        if (reachable.has(addition.toLowerCase())) throw new Error(`Addition already accepted: ${ref}: ${addition}`);
        if (seen.has(addition.toLowerCase())) throw new Error(`Duplicate addition: ${ref}: ${addition}`);
        seen.add(addition.toLowerCase());
      }
      guard(ref, e.id, ['accepted_answers', 'correct_answer', 'prompt', 'options']);
      const twin = refOf(group.rows.find(r => r[0] !== n)[0]);
      const reason = `${ref}: ${additions.join(', ')} added because ${group.grounds.map(g => GROUNDS[g]).join('; and ')}. The identically-keyed ${twin} puts the same question and already accepts ${additions.length > 1 ? 'these forms' : 'this form'}.`;
      set.update('exercises', e.id, { accepted_answers: final }, reason, group.sources);
    }
    if (asSet(finals[0]) !== asSet(finals[1])) throw new Error(`Group does not end level: ${group.gloss}`);
  }

  for (const [n, lesson, prompt, corrected, key, reason] of italianCrossRowPromptSpacing) {
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
