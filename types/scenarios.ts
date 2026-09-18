/**
 * Scenario keys and public-facing metadata.
 *
 * The CLIENT never sees the actual Claude system prompts — those live only on
 * the server in `supabase/functions/_shared/scenarios.ts`. This file holds
 * just the key union, labels, icons, and descriptions needed for scenario
 * picker UI. The mobile app sends `scenarioKey` to the `ai-chat` Edge
 * Function, which looks up the hidden prompt server-side.
 *
 * Keys are aligned with `app/(teacher)/assignments/create.tsx` and the
 * `assignments.scenario_key` column (migration 021) so teacher-authored
 * assignments resolve to the same server-side prompts.
 */

import type { Ionicons } from '@expo/vector-icons';

export type ScenarioKey =
  | 'restaurant'
  | 'job_interview'
  | 'directions'
  | 'shopping'
  | 'making_friends'
  | 'doctor'
  | 'phone_call'
  | 'airport_hotel'
  | 'free_chat'
  | 'level_test';

export interface ScenarioMeta {
  key: ScenarioKey;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const SCENARIO_META: Record<ScenarioKey, ScenarioMeta> = {
  // Never rendered in the picker — see SERVER_ONLY_SCENARIOS — but the record
  // is keyed by the full union, and a surface that resolves a session's key to
  // a label (chat history, a teacher's view) must not fall off a missing entry.
  level_test: {
    key: 'level_test',
    label: 'Level Test',
    description: 'The spoken conversation in your level test.',
    icon: 'clipboard',
  },
  restaurant: {
    key: 'restaurant',
    label: 'Ordering at a Restaurant',
    description: 'Practice ordering food, asking about menu items, expressing preferences and allergies.',
    icon: 'restaurant',
  },
  job_interview: {
    key: 'job_interview',
    label: 'Job Interview Practice',
    description: 'Introduce yourself, answer common interview questions, discuss experience.',
    icon: 'briefcase',
  },
  directions: {
    key: 'directions',
    label: 'Asking for Directions',
    description: 'Navigate to a destination, understand landmarks, give and receive directions.',
    icon: 'navigate',
  },
  shopping: {
    key: 'shopping',
    label: 'Shopping',
    description: 'Ask about sizes, colors, prices, and make purchases.',
    icon: 'cart',
  },
  making_friends: {
    key: 'making_friends',
    label: 'Making Friends',
    description: 'Talk about hobbies, interests, and make plans together.',
    icon: 'people',
  },
  doctor: {
    key: 'doctor',
    label: 'Doctor / Pharmacy Visit',
    description: 'Describe symptoms, understand medical advice, buy medication.',
    icon: 'medkit',
  },
  phone_call: {
    key: 'phone_call',
    label: 'Phone Call',
    description: 'Book appointments, make reservations, handle phone etiquette.',
    icon: 'call',
  },
  airport_hotel: {
    key: 'airport_hotel',
    label: 'Airport / Hotel',
    description: 'Check in, ask about amenities, handle travel situations.',
    icon: 'bed',
  },
  free_chat: {
    key: 'free_chat',
    label: 'Free Chat',
    description: 'Open conversation on any topic you choose.',
    icon: 'chatbubble',
  },
};

/** Ordered list for rendering a scenario picker grid. */
export const SCENARIO_ORDER: ScenarioKey[] = [
  'restaurant',
  'job_interview',
  'directions',
  'shopping',
  'making_friends',
  'doctor',
  'phone_call',
  'airport_hotel',
  'free_chat',
];

/**
 * Scenarios the learner can never pick, opened only by a server flow.
 *
 * `level_test` is the level test's conversation. It is a real scenario with an
 * authored prompt, so it belongs in `ScenarioKey` and in the server registry —
 * but it must not appear in `SCENARIO_ORDER`, which is the practice picker. Two
 * reasons, and the second is the load-bearing one:
 *
 *  - It is an assessment, not practice. The interlocutor's job is to elicit a
 *    language sample at a known band, not to be a good conversation partner.
 *  - Its `chat_sessions` row is created by the `checkpoint` edge function and
 *    bound to the attempt. `fetchOrCreateChatSession` resumes the most recent
 *    session for a (scenario, language) pair, so a pickable level-test scenario
 *    would let the practice screen resume an assessment session — and then the
 *    checkpoint would read those turns back as its own evidence.
 *
 * `lib/scenario-keys.test.ts` subtracts this list rather than being weakened:
 * a key missing from BOTH lists is still a drift failure.
 */
export const SERVER_ONLY_SCENARIOS: ScenarioKey[] = ['level_test'];
