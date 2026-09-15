// Minimal controlled-topic proposals following the two completed independent audits.
// Draft only: root must independently review every emitted new value.
import { lessonRefs } from './lesson-refs.mjs';

const choice = (prompt, correct_answer, options) => ({ prompt, correct_answer, options, distractors: options.filter(a => a !== correct_answer), accepted_answers: [] });

// [frozen E number, exact original key, exact lesson, replacement fields, reason]
export const frenchControlledTopics = [
  [49, 'Good night', 'Reading Simple Texts', choice('Read this short exchange:\nPaul : Bonne nuit, Léa. À demain !\nLéa : Bonne nuit, Paul !\nWhat are Paul and Léa wishing each other?', 'Good night', ['Good morning', 'Good night', 'Happy birthday', 'Good luck']), 'The named reading lesson had only isolated vocabulary and no text. Supply a short, connected greeting exchange; retain elementary greetings.'],
  [119, 'Milk', 'Full Meal Order', choice('At a restaurant, a customer says: « Je voudrais du poisson, du pain et de l’eau, s’il vous plaît. » What is the customer ordering?', 'Fish, bread and water', ['Chicken, bread and coffee', 'Fish, bread and water', 'Fish, an apple and milk', 'Chicken, an apple and water']), 'The named full-meal-order lesson had no order or request. Supply one complete polite order containing food and a drink; retain the other food prerequisites.'],
  [141, 'Left', 'Asking Directions', choice('Read the exchange:\n— Excusez-moi, où est la gare ?\n— Allez tout droit, puis tournez à gauche.\nWhich directions are given?', 'Go straight, then turn left', ['Turn right, then go straight', 'Go straight, then turn right', 'Go straight, then turn left', 'Turn left, then turn right']), 'The named asking-directions lesson had no direction question or response. Supply both in a short A1 exchange while retaining gauche and the other travel words.'],
  [177, 'Bus', 'Buying Tickets', choice('You want to buy a train ticket to Paris. Which phrase politely asks for the ticket?', 'Un billet pour Paris, s’il vous plaît.', ['La gare est à gauche.', 'Le train arrive demain.', 'Je suis de Paris.', 'Un billet pour Paris, s’il vous plaît.']), 'The named ticket-buying lesson had no purchase request. Add recognition of a polite ticket request, not a wholesale replacement of travel vocabulary.'],
  [211, 'Breakfast', 'Daily Routine', choice('Read: « Chaque matin, je prends mon petit déjeuner à huit heures. » When does the speaker have breakfast?', 'Every morning at eight', ['Every morning at eight', 'Every evening at eight', 'Every morning at nine', 'Every day at noon']), 'The daily-routine lesson had no stated routine. Contextualize its existing breakfast target in a simple habitual sentence.'],
  [247, 'Red', 'Time & Schedule', choice('Read the shop schedule: « Le magasin ouvre à neuf heures du matin et ferme à dix-huit heures. » When does the shop open?', 'At 9 a.m.', ['At 6 a.m.', 'At 9 p.m.', 'At 9 a.m.', 'At 6 p.m.']), 'The time-and-schedule lesson had no stated time or schedule. Replace one isolated color prompt with basic opening-hours comprehension.'],
  [286, 'Football', 'Jobs & Professions', { prompt: 'Translate to French: waiter (a man who serves customers in a restaurant). Give the noun without an article.', correct_answer: 'Serveur', accepted_answers: ['Garçon'] }, 'The isolated sport was unrelated to the precise jobs lesson. Replace it with a basic occupation; accept the ordinary restaurant-context alternative.'],
  [287, 'Hot', 'Jobs & Professions', { prompt: 'Translate to English: Cuisinier (a person whose job is to prepare food). Give the noun without an article.', correct_answer: 'Cook', accepted_answers: ['Chef'] }, 'The isolated temperature adjective was unrelated to the precise jobs lesson. Replace it with a basic occupation, allowing ordinary English occupational wording.'],
  [288, 'oid', 'Jobs & Professions', { prompt: 'Boulan_____ (Baker: complete the noun with a masculine or feminine ending)', correct_answer: 'ger', accepted_answers: ['gère'] }, 'The isolated cold adjective was unrelated to the precise jobs lesson. Add a profession with both valid gender endings rather than pretending one is uniquely required.'],
  [291, 'Chaud', 'Jobs & Professions', { prompt: 'Cuisinier', correct_answer: 'Cuisinier', hint_text: 'Cook', card_id: null, accepted_answers: [] }, 'Dependent listening copy of the unrelated temperature item: use the new occupation and detach its stale temperature card.'],
  [292, 'Hot', 'Jobs & Professions', { ...choice('Cuisinier', 'Cook', ['Teacher', 'Cook', 'Doctor', 'Driver']), card_id: null }, 'Dependent listening meaning copy of the unrelated temperature item: use the new occupation and detach its stale temperature card.'],
  [293, 'Doctor', 'Making Plans', choice('Read: « Demain, je vais jouer au football avec un ami. » What does the speaker plan to do tomorrow?', 'Play soccer with a friend', ['Read a book alone', 'Cook with a friend', 'Play soccer with a friend', 'Visit a doctor']), 'The named making-plans lesson had no stated plan. Supply one short near-future activity; preserve the other possible social-context prerequisites.'],
  [305, 'Office', 'Hobbies & Interests', choice('Read: « Léa aime dessiner à son bureau. » What does Léa enjoy doing?', 'Drawing', ['Swimming', 'Cooking', 'Reading', 'Drawing']), 'The isolated office/desk item did not teach a hobby. Retain bureau inside a simple drawing context and ask about the activity.'],
  [313, 'Bureau', 'Hobbies & Interests', { prompt: 'J’aime dessiner.', correct_answer: 'J’aime dessiner.', hint_text: 'I like drawing.', card_id: null, accepted_answers: [] }, 'Replace the dependent isolated office listening copy with the actual hobby introduced in E305 and detach the stale card.'],
  [314, 'Office', 'Hobbies & Interests', { ...choice('J’aime dessiner.', 'I like drawing.', ['I like reading.', 'I like cooking.', 'I like drawing.', 'I like swimming.']), card_id: null }, 'Replace the dependent isolated office listening meaning copy with the E305 hobby and detach the stale card.'],
  [363, 'Father', 'Describing People', choice('Read: « Mon père est grand. Il a les cheveux bruns. » What color is his hair?', 'Brown', ['Blond', 'Black', 'Brown', 'Red']), 'The named describing-people lesson had family relations but no description. Add a short physical description while retaining père.'],
  [375, 'Sister', 'Ages & Birthdays', choice('Read the exchange:\n— Quel âge as-tu ?\n— J’ai quinze ans.\nHow old is the person answering?', '15', ['5', '15', '20', '50']), 'The named ages-and-birthdays lesson had no age example. Add the ordinary age question and avoir response.'],
  [379, 'Grandmother', 'Ages & Birthdays', choice('Read: « Mon anniversaire est le dix mai. » When is the speaker’s birthday?', 'May 10', ['March 10', 'May 5', 'March 5', 'May 10']), 'The named ages-and-birthdays lesson also had no birthday/date example. Add a basic birthday sentence and an unambiguous date question.'],
  [399, 'Daughter', 'Family Activities', choice('Read: « Le dimanche, ma famille mange ensemble. » What does the family do together on Sundays?', 'Eat', ['Sing', 'Run', 'Eat', 'Swim']), 'The family-activities lesson had relations but no activity. Supply one simple shared activity while retaining family vocabulary elsewhere.'],
  [446, 'Salle de bain', 'In the Kitchen', { prompt: 'Translate to French: spoon. Give the noun without an article.', correct_answer: 'Cuillère', accepted_answers: [] }, 'The isolated bathroom target was unrelated to the precise kitchen lesson. Replace it with a kitchen object; the actual vocabulary grader already accepts the other standard spelling Cuiller without an added alternative.'],
  [447, 'Bedroom', 'In the Kitchen', { prompt: 'Translate to English: une assiette (the item you eat from). Give the noun without an article.', correct_answer: 'Plate', accepted_answers: ['Dish'] }, 'The isolated bedroom target was unrelated to the precise kitchen lesson. Replace it with an ordinary eating utensil, allowing both ordinary English names in this sense.'],
  [452, 'it', 'In the Kitchen', { prompt: 'Fourche_____ (Fork)', correct_answer: 'tte', accepted_answers: [] }, 'The isolated bed target was unrelated to the precise kitchen lesson. Replace it with a basic cutlery completion.'],
  [469, 'Bedroom', 'Describing Your Home', choice('Read: « Ma maison est petite. La cuisine est près du salon. » Which room is near the living room?', 'The kitchen', ['The bedroom', 'The bathroom', 'The kitchen', 'The garage']), 'The named home-description lesson contained no description. Supply a short size/location description rather than replacing valid room words wholesale.'],
  [539, 'Sick', 'Healthy Habits', choice('Read: « Chaque jour, je marche. Je dors huit heures par nuit. » Which daily activity does the speaker mention?', 'Walking', ['Running', 'Walking', 'Swimming', 'Cycling']), 'The named habits lesson contained no habitual action. Add a neutral first-person routine without making a health recommendation or treatment claim.'],
];

// Compose BEFORE any earlier French compiler. This filters only exact fields
// selected above, including accepted_answers: [] that clears a superseded
// lexical key even though it equals the original snapshot's empty array.
// Example:
//   const selected = selectFrenchBeforeControlledTopics(set);
//   frenchLessonFixes(selectFrenchNarrowBeforeTopic(selected));
//   frenchTopicFixes(selected);
//   frenchWordOrderFixes(selected);
//   frenchControlledTopicFixes(set);
// Do not invoke those earlier compilers against the unfiltered set as well.
export function selectFrenchBeforeControlledTopics(set) {
  const get = lessonRefs(set.snapshot, 'fr');
  const fields = new Map(frenchControlledTopics.map(([n, , , after]) => [get(n).exercise.id, new Set(Object.keys(after))]));
  return { ...set, update(table, id, after, reason, sources) {
    const replaced = table === 'exercises' && fields.get(id);
    if (!replaced) return set.update(table, id, after, reason, sources);
    const retained = Object.fromEntries(Object.entries(after).filter(([field]) => !replaced.has(field)));
    if (Object.keys(retained).length) set.update(table, id, retained, reason, sources);
  } };
}

export function frenchControlledTopicFixes(set) {
  const get = lessonRefs(set.snapshot, 'fr');
  for (const [n, oldKey, lesson, after, reason] of frenchControlledTopics) {
    const e = get(n);
    if (e.exercise.correct_answer !== oldKey || e.lesson.title !== lesson || e.course.cefr_level !== 'A1' || e.exercise.prompt_audio_url !== null) throw new Error(`Changed controlled-topic dependency ${e.ref}`);
    set.update('exercises', e.exercise.id, after, `${e.ref}: ${reason} Preserve ID, type and exact lesson. This minimal task does not certify whole-lesson mastery, open production or generated audio.`);
  }
}
