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
  | 'free_chat';

export interface ScenarioMeta {
  key: ScenarioKey;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const SCENARIO_META: Record<ScenarioKey, ScenarioMeta> = {
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
