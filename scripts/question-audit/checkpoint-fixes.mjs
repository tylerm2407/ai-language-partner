/** Confirmed French checkpoint corrections; speaking rows are never touched. */
export function checkpointFixes({ row, update }) {
  const remove = (id, invalid, reason) => {
    const item = row('checkpoint_items', id);
    for (const answer of invalid) if (!item.accepted_answers.includes(answer)) throw new Error(`Missing audited invalid answer: ${id}/${answer}`);
    update('checkpoint_items', id, { accepted_answers: item.accepted_answers.filter(a => !invalid.includes(a)) }, reason);
  };
  const add = (id, answers, reason) => update('checkpoint_items', id, {
    accepted_answers: [...new Set([...row('checkpoint_items', id).accepted_answers, ...answers])],
  }, reason);

  remove('204d6869-fe87-4d20-972e-33aa155a3435', ['raisin'],
    'fr-C0012: raisin is masculine, so it cannot complete La ___ est un fruit délicieux. Preserve the six valid feminine fruit answers.');
  update('checkpoint_items', '6bbf4303-2afc-41a2-b936-e09f18bc9458', {
    prompt: 'Fill in the gap with the French word for “children”: Combien d’___ avez-vous ?',
    accepted_answers: ['enfants'],
  }, 'fr-C0033: de must elide before enfants. Specify children so the corrected d’ frame does not imply that previously accepted fils/filles still fit. The stored primary answer enfants remains correct.');
  update('checkpoint_items', '70544811-0349-41ae-a044-f0348a20b7d5', {
    accepted_answers: ['exercice', 'air'],
  }, 'fr-C0037: l’sport has invalid elision and l’activité physique est bon has invalid feminine agreement. Preserve exercice and accept air, a masculine vowel-initial noun that also fits the unqualified sentence On dit que l’air est bon pour la santé. This is a grammar completion, not a clinical endorsement of all air quality.');
  update('checkpoint_items', 'f071565c-bc9d-4092-acff-9ab447ca545b', {
    accepted_answers: ['film', 'documentaire', 'dessin animé', 'court métrage', 'long métrage', 'western', 'thriller'],
  }, 'fr-C0066: remove the English word movie from the French gap; accept common French film types that form grammatical sentences with un. This does not claim to enumerate every possible open completion.');
  add('1b30a9c0-8ded-4c44-bfc4-75e4fd50feb9', ['bouger', 'marcher', 'courir', 'nager', 'dormir', 'se promener', 'faire du sport', 'faire de l’exercice', "faire de l'exercice"],
    'fr-C0009: the health prompt does not require eating; these independently authored exercise/sleep actions also satisfy it and were rejected by exact matching.');
  add('ea1c1522-9314-4ee7-a43e-b505b8ee759c', ['tartine', 'brioche', 'crêpe', 'biscotte'],
    'fr-C0063: the breakfast prompt does not restrict the learner to fruit. These feminine breakfast foods correctly follow une and were rejected.');
  add('1c45f33f-359c-44ce-b0a5-62213635c598', ['Elle a travaillé dans cette entreprise pendant 5 ans.'],
    'fr-C0010: a typed numeral is a valid transcription of cinq; preserve the spoken source and existing written-number answer.');
  add('646981e7-0b4a-4264-8a61-e7f7374f977b', ['Nous nous réunissons à 3 heures.'],
    'fr-C0031: a typed numeral is a valid transcription of trois; preserve the spoken source and existing written-number answer.');
}
