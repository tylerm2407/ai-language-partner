/**
 * 预约 and 预订 — the Travel unit ruling, made 2026-09-16.
 *
 * Held through round two because no dictionary settles it. MDBG glosses 预约 as
 * "booking / reservation / to book / to make an appointment", so both contested
 * alternatives sit inside the dictionary range of the word taken alone.
 *
 * WHAT SETTLES IT IS THE CURRICULUM, WHICH IS NARROWER THAN THE DICTIONARY AND
 * CONSISTENT ABOUT IT. Across all 25 rows mentioning either word, 预约 is
 * glossed only as a noun — "Appointment" in A2 Health & Wellness, "Reservation"
 * in B1 Travel & Adventure — and 预订 only as a verb, "To book", in all six of
 * its rows. That part-of-speech split is the entire signal the learner has for
 * telling them apart, and it matches how the words are actually used: 预约 for
 * scheduling a person or a service, 预订 for reserving a thing or a space.
 *
 * THE HELD PROPOSAL WAS WIDER THAN THE EVIDENCE SUPPORTS, and reading the
 * neighbouring rows rather than the finding is what showed it. It asked to drop
 * both "Booking" and "To reserve" from the Chinese row. But the row
 * "Translate to English: <word>" keyed "Reservation" exists in all nine
 * languages, and every one of them accepts "Booking" — Spanish Reserva, French
 * Réservation, German Reservierung, Italian Prenotazione, Portuguese Reserva,
 * Russian Бронирование, Japanese 予約, Korean 예약. Dropping it from Chinese
 * alone would make Chinese the only course that refuses a gloss the other eight
 * accept, which is a new inconsistency in place of the old one.
 *
 * What is unique to the Chinese row is "To reserve". It is the only VERB on any
 * of those nine rows, and it is exactly what this curriculum teaches 预订 to
 * mean in all six of 预订's rows. That one entry is the whole defect.
 *
 * TWO ROWS, RULED TOGETHER, IN OPPOSITE DIRECTIONS.
 *
 * 1. `zh-E1321` is `translate_to_native`: 预约 -> "Reservation", also accepting
 *    "Appointment", "Booking" and "To reserve". Only "To reserve" is removed.
 *    "Appointment" is the curriculum's own other gloss for 预约, and "Booking"
 *    is what its eight sibling rows accept.
 *
 * 2. The Hotel Check-in row is `translate_to_target`: "Reservation" -> 预约,
 *    accepting nothing else. A hotel reservation is 预订 — a room is a space,
 *    not an appointment — so a learner who writes 预订 there is right and is
 *    told they are wrong. 预订 is added.
 *
 * WHAT THIS RULING DOES NOT DO, deliberately. It does not change that row's
 * KEY. Three Travel rows teach 预约 as "Reservation", and rekeying one of them
 * leaves the other two teaching the opposite — a worse inconsistency than the
 * one being fixed, and a bigger change than a stuck learner needs. Whether
 * Travel should gloss 预约 as "Reservation" at all is a curriculum question
 * about those three rows together, and it is recorded as still open rather than
 * quietly decided here by patching one of them.
 *
 * GRADING: removal 1 makes two previously accepted answers start being refused
 * on a row that marks no wrong answer right either way — the cost is teaching
 * clarity, which is the point. Addition 2 makes a correct answer stop being
 * refused and admits nothing else: 预订 is checked against every taught Chinese
 * string by the round-2 runtime check like every other addition.
 */

const REMOVE_FROM_YUYUE = {
  id: 'aabbccdd-8888-3003-0002-e00000000003',
  key: 'Reservation',
  before: ['Appointment', 'Booking', 'To reserve'],
  after: ['Appointment', 'Booking'],
  /** Every sibling of this row, in the eight other courses, accepts "Booking".
   *  Removing it here would make Chinese the odd one out. */
  siblings_accepting_booking: 8,
};

const ADD_TO_HOTEL = {
  id: 'aabbccdd-8888-3003-0003-e00000000002',
  add: '预订',
};

const SOURCES = [
  'https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E9%A2%84%E7%BA%A6',
  'https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E9%A2%84%E8%AE%A2',
];

export function travelBookingRuling(set) {
  const { row, update } = set;

  const yuyue = row('exercises', REMOVE_FROM_YUYUE.id);
  // translate_to_native: the KEY is the English gloss, the Chinese is the prompt.
  if (yuyue.correct_answer !== REMOVE_FROM_YUYUE.key) throw new Error('zh-E1321 is no longer keyed "Reservation"; re-read before ruling');
  if (!yuyue.prompt.includes('预约')) throw new Error('zh-E1321 no longer prompts 预约; re-read before ruling');
  if (yuyue.accepted_answers.join('|') !== REMOVE_FROM_YUYUE.before.join('|')) {
    throw new Error('zh-E1321 alternatives have changed since the ruling was written');
  }
  update('exercises', REMOVE_FROM_YUYUE.id, { accepted_answers: REMOVE_FROM_YUYUE.after },
    'Travel unit ruling 2026-09-16: REMOVES one accepted answer, "To reserve". It is the only verb on this row and exactly what this curriculum teaches 预订 to mean, in all six of 预订\'s rows, so accepting it on a 预约 row erases the part-of-speech contrast that is the learner\'s only signal for telling the two words apart — 预约 is glossed as a noun throughout, 预订 as a verb. "Booking" is deliberately KEPT, against the held proposal: the same row exists in all nine languages and the other eight all accept it, so removing it from Chinese alone would trade one inconsistency for another. "Appointment" is the curriculum\'s own other gloss for 预约. No wrong answer was being graded right either way; the cost of leaving this was teaching clarity rather than scoring.',
    SOURCES);

  const hotel = row('exercises', ADD_TO_HOTEL.id);
  if (hotel.correct_answer !== '预约') throw new Error('The Hotel Check-in row is no longer keyed 预约; re-read before ruling');
  if (hotel.type !== 'translate_to_target') throw new Error('The Hotel Check-in row is no longer translate_to_target');
  if (hotel.accepted_answers.includes(ADD_TO_HOTEL.add)) throw new Error('The Hotel Check-in row already accepts 预订');
  const after = [...hotel.accepted_answers, ADD_TO_HOTEL.add];
  update('exercises', ADD_TO_HOTEL.id, { accepted_answers: after },
    'Travel unit ruling 2026-09-16: a hotel reservation is 预订. A room is a space, not an appointment, so a learner answering 预订 on this Hotel Check-in row is correct and was being told otherwise. The KEY is deliberately left as 预约: three Travel rows gloss 预约 as "Reservation", and rekeying one leaves the other two teaching the opposite. Whether Travel should gloss 预约 that way at all is a question about those three rows together and stays open.',
    SOURCES);

  return { rows: 2, removed: 1, added: 1 };
}

/** Recorded as decided, and as deliberately bounded. */
export const TRAVEL_BOOKING_RULING = {
  ruled_on: '2026-09-16',
  rows: [REMOVE_FROM_YUYUE.id, ADD_TO_HOTEL.id],
  still_open:
    'Whether B1 Travel & Adventure should gloss 预约 as "Reservation" on its three rows at all, given that the same unit teaches 预订 as the verb for reserving a space. Ruling on that means rekeying three rows together, not one, and it was not part of what this audit was asked to settle.',
};
