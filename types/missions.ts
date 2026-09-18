/**
 * Client mirror of the mission ladder.
 *
 * The server owns the registry (`supabase/functions/_shared/missions.ts`):
 * it decides which stage is unlocked, what the model reports against, and
 * what passes. The client needs only what it renders — stage, band, title
 * and the objective texts for the checklist — and never the `detect`
 * strings, which describe what the model should look for and would read as
 * an answer key. `lib/mission-keys.test.ts` parses the server file as text
 * and asserts this mirror matches it exactly, and that `detect:` never
 * appears here.
 *
 * Plain literals, no imports from the server side: one is bundled into the
 * app, the other runs in Deno.
 */

import type { ScenarioKey } from './scenarios';

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
export type MissionBand = 'A1' | 'A2' | 'B1' | 'B2';

export interface MissionObjectiveMeta {
  id: string;
  text: string;
}

export interface MissionMeta {
  stage: number;
  band: MissionBand;
  title: string;
  objectives: readonly MissionObjectiveMeta[];
}

export const MISSION_STAGE_COUNT = 4;

export const MISSION_META: Record<MissionScenarioKey, readonly MissionMeta[]> = {
  restaurant: [
    { stage: 1, band: 'A1', title: 'A table and a drink', objectives: [
      { id: 'greet_table', text: 'Greet the server and ask for a table' },
      { id: 'order_drink', text: 'Order a drink' },
      { id: 'ask_price', text: 'Ask how much something costs' },
    ] },
    { stage: 2, band: 'A2', title: 'Order a full meal', objectives: [
      { id: 'ask_dish', text: 'Ask a question about a dish' },
      { id: 'order_meal', text: 'Order a main course and a drink' },
      { id: 'ask_bill', text: 'Ask for the bill' },
    ] },
    { stage: 3, band: 'B1', title: 'Something is wrong with the order', objectives: [
      { id: 'describe_problem', text: 'Explain what is wrong with your order' },
      { id: 'request_fix', text: 'Ask for a replacement or a change' },
      { id: 'answer_followup', text: 'Answer a follow-up question about the fix' },
    ] },
    { stage: 4, band: 'B2', title: 'Dispute the bill', objectives: [
      { id: 'identify_error', text: 'Point out a specific error on the bill' },
      { id: 'negotiate', text: 'Argue for a correction or a discount, with reasons' },
      { id: 'settle', text: 'Agree on a resolution and close politely' },
    ] },
  ],
  job_interview: [
    { stage: 1, band: 'A1', title: 'Introduce yourself', objectives: [
      { id: 'say_name', text: 'Say your name and where you are from' },
      { id: 'say_job', text: 'Say what you do or study' },
      { id: 'ask_question', text: 'Ask the interviewer one question' },
    ] },
    { stage: 2, band: 'A2', title: 'Talk about your experience', objectives: [
      { id: 'describe_past', text: 'Describe a past job or project' },
      { id: 'name_skill', text: 'Name a skill you have and give one example' },
      { id: 'say_why', text: 'Say why you want this job' },
    ] },
    { stage: 3, band: 'B1', title: 'A challenge you handled', objectives: [
      { id: 'describe_challenge', text: 'Describe a difficult situation at work' },
      { id: 'explain_action', text: 'Explain what you did about it' },
      { id: 'state_result', text: 'Say what the outcome was' },
    ] },
    { stage: 4, band: 'B2', title: 'Negotiate the offer', objectives: [
      { id: 'ask_terms', text: 'Ask about salary, hours or conditions' },
      { id: 'counter', text: 'Make a counter-proposal with reasons' },
      { id: 'confirm_next', text: 'Agree on the next step' },
    ] },
  ],
  directions: [
    { stage: 1, band: 'A1', title: 'Find the station', objectives: [
      { id: 'ask_where', text: 'Ask where the station is' },
      { id: 'confirm_direction', text: 'Repeat or confirm the direction you were given' },
      { id: 'say_thanks', text: 'Thank the person' },
    ] },
    { stage: 2, band: 'A2', title: 'Follow a route', objectives: [
      { id: 'ask_route', text: 'Ask how to get to a specific place' },
      { id: 'ask_distance', text: 'Ask how far it is or how long it takes' },
      { id: 'check_landmark', text: 'Check a landmark or turning you were told' },
    ] },
    { stage: 3, band: 'B1', title: 'You are lost', objectives: [
      { id: 'explain_lost', text: 'Explain where you were going and where you are now' },
      { id: 'ask_alternative', text: 'Ask for another way, such as a bus or a taxi' },
      { id: 'confirm_plan', text: 'Sum up the new route in your own words' },
    ] },
    { stage: 4, band: 'B2', title: 'The directions did not work', objectives: [
      { id: 'describe_what_happened', text: 'Describe what went wrong on the way' },
      { id: 'clarify', text: 'Ask clarifying questions to pin down the mistake' },
      { id: 'thank_and_close', text: 'Close the conversation politely after a solution' },
    ] },
  ],
  shopping: [
    { stage: 1, band: 'A1', title: 'Buy one thing', objectives: [
      { id: 'ask_have', text: 'Ask if the shop has an item' },
      { id: 'ask_price', text: 'Ask the price' },
      { id: 'say_take', text: 'Say you will take it' },
    ] },
    { stage: 2, band: 'A2', title: 'Find the right one', objectives: [
      { id: 'ask_size', text: 'Ask for a different size or colour' },
      { id: 'compare', text: 'Compare two options' },
      { id: 'decide', text: 'Choose one and ask to pay' },
    ] },
    { stage: 3, band: 'B1', title: 'Return an item', objectives: [
      { id: 'explain_problem', text: 'Explain what is wrong with the item' },
      { id: 'ask_refund', text: 'Ask for a refund or an exchange' },
      { id: 'show_proof', text: 'Say when you bought it and offer the receipt' },
    ] },
    { stage: 4, band: 'B2', title: 'Warranty dispute', objectives: [
      { id: 'state_case', text: 'State your case, citing the warranty or your rights' },
      { id: 'respond_objection', text: 'Respond to the objection' },
      { id: 'agree_outcome', text: 'Agree on an outcome and the next step' },
    ] },
  ],
  making_friends: [
    { stage: 1, band: 'A1', title: 'Say hello', objectives: [
      { id: 'introduce', text: 'Introduce yourself' },
      { id: 'ask_name', text: 'Ask their name or where they are from' },
      { id: 'say_like', text: 'Say one thing you like' },
    ] },
    { stage: 2, band: 'A2', title: 'Find common ground', objectives: [
      { id: 'ask_hobby', text: 'Ask about their hobbies or free time' },
      { id: 'share_hobby', text: 'Talk about something you both like' },
      { id: 'suggest_plan', text: 'Suggest doing something together' },
    ] },
    { stage: 3, band: 'B1', title: 'Tell a story', objectives: [
      { id: 'tell_event', text: 'Tell a short story about something that happened to you' },
      { id: 'ask_theirs', text: 'Ask about a similar experience of theirs' },
      { id: 'react', text: 'React to what they tell you' },
    ] },
    { stage: 4, band: 'B2', title: 'Disagree nicely', objectives: [
      { id: 'state_opinion', text: 'Give your opinion on a topic' },
      { id: 'disagree', text: 'Disagree politely, with a reason' },
      { id: 'find_middle', text: 'Find something you can agree on' },
    ] },
  ],
  doctor: [
    { stage: 1, band: 'A1', title: 'Say what hurts', objectives: [
      { id: 'say_hurts', text: 'Say what hurts or what is wrong' },
      { id: 'say_since', text: 'Say since when' },
      { id: 'ask_medicine', text: 'Ask for medicine or what to do' },
    ] },
    { stage: 2, band: 'A2', title: 'Describe symptoms', objectives: [
      { id: 'describe_symptoms', text: 'Describe two or more symptoms' },
      { id: 'answer_questions', text: 'Answer questions about your habits or history' },
      { id: 'ask_instructions', text: 'Ask how to take the treatment' },
    ] },
    { stage: 3, band: 'B1', title: 'It is not getting better', objectives: [
      { id: 'explain_history', text: 'Explain what you have already tried and how it went' },
      { id: 'ask_options', text: 'Ask what other options there are' },
      { id: 'clarify_risks', text: 'Ask about side effects or risks' },
    ] },
    { stage: 4, band: 'B2', title: 'Question the diagnosis', objectives: [
      { id: 'ask_reasoning', text: 'Ask for the reasoning behind the diagnosis' },
      { id: 'raise_concern', text: 'Raise a concern or an alternative explanation' },
      { id: 'agree_plan', text: 'Agree on a plan, including a follow-up' },
    ] },
  ],
  phone_call: [
    { stage: 1, band: 'A1', title: 'Book a table', objectives: [
      { id: 'say_want', text: 'Say you want to book a table' },
      { id: 'give_details', text: 'Give the day, time and number of people' },
      { id: 'give_name', text: 'Give your name and confirm' },
    ] },
    { stage: 2, band: 'A2', title: 'Change a booking', objectives: [
      { id: 'identify_booking', text: 'Identify your existing booking' },
      { id: 'request_change', text: 'Ask to change the time, date or size' },
      { id: 'confirm_change', text: 'Confirm the new details' },
    ] },
    { stage: 3, band: 'B1', title: 'Something went wrong', objectives: [
      { id: 'explain_issue', text: 'Explain the problem with the booking' },
      { id: 'propose_solution', text: 'Propose a solution' },
      { id: 'confirm_resolution', text: 'Confirm what has been agreed' },
    ] },
    { stage: 4, band: 'B2', title: 'Complain and get compensation', objectives: [
      { id: 'describe_incident', text: 'Describe what happened and its impact' },
      { id: 'request_compensation', text: 'Ask for specific compensation, with reasons' },
      { id: 'handle_pushback', text: 'Respond to pushback and settle' },
    ] },
  ],
  airport_hotel: [
    { stage: 1, band: 'A1', title: 'Check in', objectives: [
      { id: 'say_reservation', text: 'Say you have a reservation and give your name' },
      { id: 'answer_nights', text: 'Answer how many nights or people' },
      { id: 'ask_basic', text: 'Ask a basic question, like breakfast time or the Wi-Fi' },
    ] },
    { stage: 2, band: 'A2', title: 'Sort the details', objectives: [
      { id: 'ask_facility', text: 'Ask about a facility or service' },
      { id: 'request_change', text: 'Request a change, like another room or a late checkout' },
      { id: 'ask_directions', text: 'Ask how to get somewhere from here' },
    ] },
    { stage: 3, band: 'B1', title: 'A problem with the room or flight', objectives: [
      { id: 'describe_problem', text: 'Describe the problem clearly' },
      { id: 'ask_fix', text: 'Ask for it to be fixed or replaced' },
      { id: 'follow_up', text: 'Ask when it will be resolved or what to do meanwhile' },
    ] },
    { stage: 4, band: 'B2', title: 'Overbooked', objectives: [
      { id: 'state_situation', text: 'State what you were promised and what you got' },
      { id: 'negotiate_alternative', text: 'Negotiate an acceptable alternative' },
      { id: 'secure_commitment', text: 'Get a clear commitment, in writing or with a reference' },
    ] },
  ],
};
