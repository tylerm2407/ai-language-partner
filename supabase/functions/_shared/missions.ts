/**
 * The mission ladder: four authored missions per guided-chat scene.
 *
 * Every other guidance layer in `ai-chat` is per-turn — the scene brief, the
 * level rules, the dialogue-act controller, the governors. Nothing tracked
 * progress per topic: scenes never ended, the success line in each scene
 * script was never checked, and one `chat_sessions` row per scene resumed
 * forever. This is the unit of progression that was missing.
 *
 * AUTHORED, not model-generated. Each scene climbs CEFR A1→B2 through four
 * "obtaining goods and services" style can-do statements, and each mission
 * carries 2-3 concrete objectives the model reports against per turn
 * (`objectivesMet` in the structured reply). Sequencing follows Robinson's
 * SSARC — by task complexity, not vocabulary — which is what the CEFR scale
 * already supplies.
 *
 * Three fields per objective:
 *   - `id`     the token the model reports and the client keys on
 *   - `text`   what the learner sees in the checklist
 *   - `detect` model-only: what counts, "in the student's own words". Never
 *              shipped to the client (`lib/mission-keys.test.ts` proves it).
 *
 * Authoring convention (the client-parity test parses this file as TEXT, so
 * keep it): each mission opens `{ stage: N, band: 'XX', title: '…',
 * objectives: [` and each objective is ONE line
 * `{ id: '…', text: '…', detect: '…' },`. No apostrophes inside the
 * single-quoted strings — use "do not" rather than "don't".
 *
 * Mission text lives in the CACHED system block (it is keyed by scenario +
 * stage, our content, not the learner's), so `buildMissionBlock` is capped at
 * 900 characters: the beginner-recast crowding problem in
 * `fluenci-conversation-loop` gets worse with every line of scene prompt, and
 * this is more scene prompt.
 */

import type { ScenarioKey } from './scenarios.ts';

/**
 * Scenes that have an authored mission ladder.
 *
 * Two exclusions, for different reasons. `free_chat` has no ladder because it
 * has no scene to have one about. `level_test` has none because it is an
 * assessment: its four turns are there to elicit a language sample at a known
 * band, and a pass/fail objective checklist on top of that would be a second,
 * contradictory verdict on the same conversation.
 */
export type MissionScenarioKey = Exclude<ScenarioKey, 'free_chat' | 'level_test'>;
export type MissionStage = 1 | 2 | 3 | 4;
export type MissionBand = 'A1' | 'A2' | 'B1' | 'B2';

export interface MissionObjective {
  id: string;
  text: string;
  /** Model-only. What counts, in the student's own words. */
  detect: string;
}

export interface Mission {
  stage: MissionStage;
  band: MissionBand;
  title: string;
  objectives: readonly MissionObjective[];
}

export const MISSION_STAGE_COUNT = 4;

/** Hard cap on what `buildMissionBlock` may add to the cached prompt. */
export const MAX_MISSION_BLOCK_CHARS = 900;

export const MISSIONS: Record<MissionScenarioKey, readonly Mission[]> = {
  restaurant: [
    { stage: 1, band: 'A1', title: 'A table and a drink', objectives: [
      { id: 'greet_table', text: 'Greet the server and ask for a table', detect: 'the student greets and asks for a table or seat' },
      { id: 'order_drink', text: 'Order a drink', detect: 'the student names a drink they want' },
      { id: 'ask_price', text: 'Ask how much something costs', detect: 'the student asks the price of something' },
    ] },
    { stage: 2, band: 'A2', title: 'Order a full meal', objectives: [
      { id: 'ask_dish', text: 'Ask a question about a dish', detect: 'the student asks what is in a dish, how it is cooked, or what you recommend' },
      { id: 'order_meal', text: 'Order a main course and a drink', detect: 'the student orders a main dish and a drink' },
      { id: 'ask_bill', text: 'Ask for the bill', detect: 'the student asks to pay or for the bill' },
    ] },
    { stage: 3, band: 'B1', title: 'Something is wrong with the order', objectives: [
      { id: 'describe_problem', text: 'Explain what is wrong with your order', detect: 'the student states a specific problem with the food or the order' },
      { id: 'request_fix', text: 'Ask for a replacement or a change', detect: 'the student asks for a replacement, a change, or the dish taken back' },
      { id: 'answer_followup', text: 'Answer a follow-up question about the fix', detect: 'the student answers a question you asked about the fix' },
    ] },
    { stage: 4, band: 'B2', title: 'Dispute the bill', objectives: [
      { id: 'identify_error', text: 'Point out a specific error on the bill', detect: 'the student names a specific wrong item or amount on the bill' },
      { id: 'negotiate', text: 'Argue for a correction or a discount, with reasons', detect: 'the student gives reasons why the bill should be corrected or reduced' },
      { id: 'settle', text: 'Agree on a resolution and close politely', detect: 'the student accepts or proposes a final resolution and closes politely' },
    ] },
  ],
  job_interview: [
    { stage: 1, band: 'A1', title: 'Introduce yourself', objectives: [
      { id: 'say_name', text: 'Say your name and where you are from', detect: 'the student gives their name and where they are from' },
      { id: 'say_job', text: 'Say what you do or study', detect: 'the student says their job or what they study' },
      { id: 'ask_question', text: 'Ask the interviewer one question', detect: 'the student asks the interviewer a question' },
    ] },
    { stage: 2, band: 'A2', title: 'Talk about your experience', objectives: [
      { id: 'describe_past', text: 'Describe a past job or project', detect: 'the student describes something they did in a past job or project' },
      { id: 'name_skill', text: 'Name a skill you have and give one example', detect: 'the student names a skill and gives an example of using it' },
      { id: 'say_why', text: 'Say why you want this job', detect: 'the student gives a reason for wanting the job' },
    ] },
    { stage: 3, band: 'B1', title: 'A challenge you handled', objectives: [
      { id: 'describe_challenge', text: 'Describe a difficult situation at work', detect: 'the student describes a specific difficult situation' },
      { id: 'explain_action', text: 'Explain what you did about it', detect: 'the student explains the action they took' },
      { id: 'state_result', text: 'Say what the outcome was', detect: 'the student states the result of their action' },
    ] },
    { stage: 4, band: 'B2', title: 'Negotiate the offer', objectives: [
      { id: 'ask_terms', text: 'Ask about salary, hours or conditions', detect: 'the student asks about pay, hours, or working conditions' },
      { id: 'counter', text: 'Make a counter-proposal with reasons', detect: 'the student proposes different terms and justifies them' },
      { id: 'confirm_next', text: 'Agree on the next step', detect: 'the student confirms what happens next' },
    ] },
  ],
  directions: [
    { stage: 1, band: 'A1', title: 'Find the station', objectives: [
      { id: 'ask_where', text: 'Ask where the station is', detect: 'the student asks where the station is' },
      { id: 'confirm_direction', text: 'Repeat or confirm the direction you were given', detect: 'the student repeats or confirms a direction you gave' },
      { id: 'say_thanks', text: 'Thank the person', detect: 'the student thanks you' },
    ] },
    { stage: 2, band: 'A2', title: 'Follow a route', objectives: [
      { id: 'ask_route', text: 'Ask how to get to a specific place', detect: 'the student asks how to reach a named place' },
      { id: 'ask_distance', text: 'Ask how far it is or how long it takes', detect: 'the student asks about distance or time' },
      { id: 'check_landmark', text: 'Check a landmark or turning you were told', detect: 'the student asks about or confirms a landmark or turn from your directions' },
    ] },
    { stage: 3, band: 'B1', title: 'You are lost', objectives: [
      { id: 'explain_lost', text: 'Explain where you were going and where you are now', detect: 'the student explains their destination and current position' },
      { id: 'ask_alternative', text: 'Ask for another way, such as a bus or a taxi', detect: 'the student asks about an alternative route or transport' },
      { id: 'confirm_plan', text: 'Sum up the new route in your own words', detect: 'the student restates the new route in their own words' },
    ] },
    { stage: 4, band: 'B2', title: 'The directions did not work', objectives: [
      { id: 'describe_what_happened', text: 'Describe what went wrong on the way', detect: 'the student describes what went wrong following the earlier directions' },
      { id: 'clarify', text: 'Ask clarifying questions to pin down the mistake', detect: 'the student asks a clarifying question about the route' },
      { id: 'thank_and_close', text: 'Close the conversation politely after a solution', detect: 'the student closes politely once a solution is found' },
    ] },
  ],
  shopping: [
    { stage: 1, band: 'A1', title: 'Buy one thing', objectives: [
      { id: 'ask_have', text: 'Ask if the shop has an item', detect: 'the student asks whether the shop has an item' },
      { id: 'ask_price', text: 'Ask the price', detect: 'the student asks how much something costs' },
      { id: 'say_take', text: 'Say you will take it', detect: 'the student says they will buy or take it' },
    ] },
    { stage: 2, band: 'A2', title: 'Find the right one', objectives: [
      { id: 'ask_size', text: 'Ask for a different size or colour', detect: 'the student asks for another size or colour' },
      { id: 'compare', text: 'Compare two options', detect: 'the student compares two items' },
      { id: 'decide', text: 'Choose one and ask to pay', detect: 'the student picks one and asks to pay' },
    ] },
    { stage: 3, band: 'B1', title: 'Return an item', objectives: [
      { id: 'explain_problem', text: 'Explain what is wrong with the item', detect: 'the student describes a specific fault with the item' },
      { id: 'ask_refund', text: 'Ask for a refund or an exchange', detect: 'the student asks for a refund or an exchange' },
      { id: 'show_proof', text: 'Say when you bought it and offer the receipt', detect: 'the student says when they bought it or mentions the receipt' },
    ] },
    { stage: 4, band: 'B2', title: 'Warranty dispute', objectives: [
      { id: 'state_case', text: 'State your case, citing the warranty or your rights', detect: 'the student refers to the warranty or consumer rights to support their case' },
      { id: 'respond_objection', text: 'Respond to the objection', detect: 'the student answers an objection you raised' },
      { id: 'agree_outcome', text: 'Agree on an outcome and the next step', detect: 'the student agrees an outcome and what happens next' },
    ] },
  ],
  making_friends: [
    { stage: 1, band: 'A1', title: 'Say hello', objectives: [
      { id: 'introduce', text: 'Introduce yourself', detect: 'the student gives their name' },
      { id: 'ask_name', text: 'Ask their name or where they are from', detect: 'the student asks your name or where you are from' },
      { id: 'say_like', text: 'Say one thing you like', detect: 'the student says something they like' },
    ] },
    { stage: 2, band: 'A2', title: 'Find common ground', objectives: [
      { id: 'ask_hobby', text: 'Ask about their hobbies or free time', detect: 'the student asks about your hobbies or free time' },
      { id: 'share_hobby', text: 'Talk about something you both like', detect: 'the student talks about a shared interest' },
      { id: 'suggest_plan', text: 'Suggest doing something together', detect: 'the student suggests meeting or doing something together' },
    ] },
    { stage: 3, band: 'B1', title: 'Tell a story', objectives: [
      { id: 'tell_event', text: 'Tell a short story about something that happened to you', detect: 'the student narrates a past event with at least two steps' },
      { id: 'ask_theirs', text: 'Ask about a similar experience of theirs', detect: 'the student asks whether you have had a similar experience' },
      { id: 'react', text: 'React to what they tell you', detect: 'the student reacts to something you told them' },
    ] },
    { stage: 4, band: 'B2', title: 'Disagree nicely', objectives: [
      { id: 'state_opinion', text: 'Give your opinion on a topic', detect: 'the student states an opinion' },
      { id: 'disagree', text: 'Disagree politely, with a reason', detect: 'the student disagrees with you and gives a reason' },
      { id: 'find_middle', text: 'Find something you can agree on', detect: 'the student proposes or accepts common ground' },
    ] },
  ],
  doctor: [
    { stage: 1, band: 'A1', title: 'Say what hurts', objectives: [
      { id: 'say_hurts', text: 'Say what hurts or what is wrong', detect: 'the student says what hurts or what is wrong' },
      { id: 'say_since', text: 'Say since when', detect: 'the student says when it started or how long it has lasted' },
      { id: 'ask_medicine', text: 'Ask for medicine or what to do', detect: 'the student asks for medicine or for advice' },
    ] },
    { stage: 2, band: 'A2', title: 'Describe symptoms', objectives: [
      { id: 'describe_symptoms', text: 'Describe two or more symptoms', detect: 'the student describes at least two symptoms' },
      { id: 'answer_questions', text: 'Answer questions about your habits or history', detect: 'the student answers a question you asked about habits or history' },
      { id: 'ask_instructions', text: 'Ask how to take the treatment', detect: 'the student asks how or when to take the treatment' },
    ] },
    { stage: 3, band: 'B1', title: 'It is not getting better', objectives: [
      { id: 'explain_history', text: 'Explain what you have already tried and how it went', detect: 'the student describes a treatment they tried and its result' },
      { id: 'ask_options', text: 'Ask what other options there are', detect: 'the student asks about alternative treatments' },
      { id: 'clarify_risks', text: 'Ask about side effects or risks', detect: 'the student asks about side effects or risks' },
    ] },
    { stage: 4, band: 'B2', title: 'Question the diagnosis', objectives: [
      { id: 'ask_reasoning', text: 'Ask for the reasoning behind the diagnosis', detect: 'the student asks why you reached the diagnosis' },
      { id: 'raise_concern', text: 'Raise a concern or an alternative explanation', detect: 'the student raises a concern or suggests another explanation' },
      { id: 'agree_plan', text: 'Agree on a plan, including a follow-up', detect: 'the student agrees a plan that includes a follow-up' },
    ] },
  ],
  phone_call: [
    { stage: 1, band: 'A1', title: 'Book a table', objectives: [
      { id: 'say_want', text: 'Say you want to book a table', detect: 'the student says they want to book or reserve' },
      { id: 'give_details', text: 'Give the day, time and number of people', detect: 'the student gives a day or time and how many people' },
      { id: 'give_name', text: 'Give your name and confirm', detect: 'the student gives a name for the booking' },
    ] },
    { stage: 2, band: 'A2', title: 'Change a booking', objectives: [
      { id: 'identify_booking', text: 'Identify your existing booking', detect: 'the student identifies an existing booking by name, date or time' },
      { id: 'request_change', text: 'Ask to change the time, date or size', detect: 'the student asks to change a detail of the booking' },
      { id: 'confirm_change', text: 'Confirm the new details', detect: 'the student confirms the changed details' },
    ] },
    { stage: 3, band: 'B1', title: 'Something went wrong', objectives: [
      { id: 'explain_issue', text: 'Explain the problem with the booking', detect: 'the student explains a specific problem with the booking' },
      { id: 'propose_solution', text: 'Propose a solution', detect: 'the student proposes a way to fix it' },
      { id: 'confirm_resolution', text: 'Confirm what has been agreed', detect: 'the student restates or confirms the agreed resolution' },
    ] },
    { stage: 4, band: 'B2', title: 'Complain and get compensation', objectives: [
      { id: 'describe_incident', text: 'Describe what happened and its impact', detect: 'the student describes the incident and how it affected them' },
      { id: 'request_compensation', text: 'Ask for specific compensation, with reasons', detect: 'the student asks for a specific remedy and justifies it' },
      { id: 'handle_pushback', text: 'Respond to pushback and settle', detect: 'the student answers an objection and reaches a settlement' },
    ] },
  ],
  airport_hotel: [
    { stage: 1, band: 'A1', title: 'Check in', objectives: [
      { id: 'say_reservation', text: 'Say you have a reservation and give your name', detect: 'the student says they have a reservation and gives a name' },
      { id: 'answer_nights', text: 'Answer how many nights or people', detect: 'the student states a number of nights or people' },
      { id: 'ask_basic', text: 'Ask a basic question, like breakfast time or the Wi-Fi', detect: 'the student asks a basic practical question' },
    ] },
    { stage: 2, band: 'A2', title: 'Sort the details', objectives: [
      { id: 'ask_facility', text: 'Ask about a facility or service', detect: 'the student asks about a facility or service' },
      { id: 'request_change', text: 'Request a change, like another room or a late checkout', detect: 'the student asks for a change to their booking or room' },
      { id: 'ask_directions', text: 'Ask how to get somewhere from here', detect: 'the student asks how to get to a place from the hotel or airport' },
    ] },
    { stage: 3, band: 'B1', title: 'A problem with the room or flight', objectives: [
      { id: 'describe_problem', text: 'Describe the problem clearly', detect: 'the student describes a specific problem with the room or flight' },
      { id: 'ask_fix', text: 'Ask for it to be fixed or replaced', detect: 'the student asks for a fix, a replacement, or a rebooking' },
      { id: 'follow_up', text: 'Ask when it will be resolved or what to do meanwhile', detect: 'the student asks about timing or what to do in the meantime' },
    ] },
    { stage: 4, band: 'B2', title: 'Overbooked', objectives: [
      { id: 'state_situation', text: 'State what you were promised and what you got', detect: 'the student contrasts what was booked with what was offered' },
      { id: 'negotiate_alternative', text: 'Negotiate an acceptable alternative', detect: 'the student proposes or bargains for an alternative' },
      { id: 'secure_commitment', text: 'Get a clear commitment, in writing or with a reference', detect: 'the student asks for written confirmation or a reference number' },
    ] },
  ],
};

/**
 * Resolve a mission, or null.
 *
 * Null for `free_chat` (no ladder), for an unknown scene, and for any stage
 * that is not exactly an integer 1..4 — `'1'`, `1.5`, `0`, `5` and `'open'`
 * all return null. The caller treats null as "plain chat", which is what an
 * old client that sends no stage gets.
 */
export function getMission(scenarioKey: string, stage: unknown): Mission | null {
  if (typeof stage !== 'number' || !Number.isInteger(stage) || stage < 1 || stage > MISSION_STAGE_COUNT) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(MISSIONS, scenarioKey)) return null;
  const ladder = MISSIONS[scenarioKey as MissionScenarioKey];
  return ladder.find((m) => m.stage === stage) ?? null;
}

export function missionObjectiveIds(mission: Mission): ReadonlySet<string> {
  return new Set(mission.objectives.map((o) => o.id));
}

/**
 * The mission's lines in the cached system prompt.
 *
 * Steers, never announces: the learner sees the checklist in the app, and a
 * tutor that reads the list out is a worksheet. The reporting rule is the
 * whole defence against over-awarding — "latest message", "own words", and
 * "an objective you offered does not count" are each there because Haiku
 * will otherwise tick an objective the moment the tutor models it.
 */
export function buildMissionBlock(mission: Mission, targetLanguage: string): string {
  const lines = mission.objectives.map(
    (o) => `- ${o.id}: ${o.text}. Counts when ${o.detect}.`,
  );
  return [
    `MISSION (stage ${mission.stage} of ${MISSION_STAGE_COUNT}, ${mission.band}): ${mission.title}`,
    'Steer the scene so the student gets a natural chance to do each of these. Never announce, list or tick them; the app shows the checklist.',
    ...lines,
    `OBJECTIVES REPORT: in "objectivesMet", list only the ids the student's LATEST message achieved, in their own words and in ${targetLanguage}. An objective you offered, modelled or asked about does not count. [] when none.`,
  ].join('\n');
}
