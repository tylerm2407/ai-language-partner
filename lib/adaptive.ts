import type { CEFRLevel, TutorProfile } from '../types';
import { fetchOrCreateTutorProfile, updateTutorProfile } from './supabase-queries';

/**
 * Map error rate + vocab mastery to a CEFR level estimate.
 * This is a simplified heuristic — in production, consider using
 * standardized placement tests.
 */
export function calculateCEFR(profile: TutorProfile): CEFRLevel {
  const { avgErrorRate, masteredVocab, sessionsCount } = profile;
  const vocabCount = masteredVocab.length;

  if (sessionsCount < 3) return profile.cefrEstimate; // not enough data

  // Low error rate + high vocab = higher level
  if (avgErrorRate < 0.10 && vocabCount >= 500) return 'C2';
  if (avgErrorRate < 0.12 && vocabCount >= 300) return 'C1';
  if (avgErrorRate < 0.15 && vocabCount >= 150) return 'B2';
  if (avgErrorRate < 0.25 && vocabCount >= 80) return 'B1';
  if (avgErrorRate < 0.35 && vocabCount >= 30) return 'A2';
  return 'A1';
}

/**
 * Should we suggest the user level up?
 * Criteria: error rate < 15% over at least 5 sessions since last recalculation.
 */
export function shouldLevelUp(profile: TutorProfile): boolean {
  if (profile.sessionsCount < 5) return false;
  if (profile.sessionsCount % 5 !== 0) return false; // only check every 5 sessions
  return profile.avgErrorRate < 0.15;
}

/**
 * Should we auto-simplify prompts?
 * Criteria: error rate > 40%.
 */
export function shouldLevelDown(profile: TutorProfile): boolean {
  if (profile.sessionsCount < 5) return false;
  return profile.avgErrorRate > 0.40;
}

/**
 * Get system prompt modifier based on CEFR level.
 */
export function getAdaptivePromptModifier(cefrLevel: CEFRLevel): string {
  const modifiers: Record<CEFRLevel, string> = {
    A1: 'The student is an absolute beginner (CEFR A1). Use only the most basic vocabulary. Speak very slowly. Use present tense only. Keep sentences under 5 words when possible.',
    A2: 'The student is at elementary level (CEFR A2). Use basic vocabulary and simple sentence structures. Introduce common past tense. Keep sentences short.',
    B1: 'The student is at intermediate level (CEFR B1). Use natural conversational language. Introduce varied tenses and some complex grammar. Expect them to form complete sentences.',
    B2: 'The student is at upper-intermediate level (CEFR B2). Use rich vocabulary and complex sentences. Introduce subjunctive, conditional, and idiomatic expressions.',
    C1: 'The student is advanced (CEFR C1). Speak naturally as you would to a near-native speaker. Use idioms, nuance, humor, and complex structures.',
    C2: 'The student is near-native (CEFR C2). Speak exactly as you would to a native speaker. Use colloquialisms, cultural references, wordplay.',
  };
  return modifiers[cefrLevel];
}

/**
 * Record the result of a practice session and update the tutor profile.
 * Recalculates CEFR every 5 sessions.
 */
export async function recordSessionResult(
  userId: string,
  language: string,
  errorRate: number,
  newVocab: string[]
): Promise<{ profile: TutorProfile; levelChanged: boolean; newLevel: CEFRLevel | null }> {
  const profile = await fetchOrCreateTutorProfile(userId, language);

  const newSessionsCount = profile.sessionsCount + 1;

  // Rolling average error rate (exponential moving average, alpha = 0.3)
  const alpha = 0.3;
  const newAvgErrorRate =
    profile.sessionsCount === 0
      ? errorRate
      : alpha * errorRate + (1 - alpha) * profile.avgErrorRate;

  // Merge new vocab into mastered list (deduplicate)
  const existingVocab = new Set(profile.masteredVocab);
  for (const word of newVocab) {
    existingVocab.add(word.toLowerCase());
  }
  const mergedVocab = Array.from(existingVocab);

  const updates: Partial<TutorProfile> = {
    sessionsCount: newSessionsCount,
    avgErrorRate: Math.round(newAvgErrorRate * 1000) / 1000,
    masteredVocab: mergedVocab,
  };

  // Recalculate CEFR every 5 sessions
  let levelChanged = false;
  let newLevel: CEFRLevel | null = null;

  if (newSessionsCount % 5 === 0) {
    const updatedProfile = { ...profile, ...updates };
    const calculatedLevel = calculateCEFR(updatedProfile);

    if (calculatedLevel !== profile.cefrEstimate) {
      levelChanged = true;
      newLevel = calculatedLevel;
      updates.cefrEstimate = calculatedLevel;
    }

    updates.lastRecalculatedAt = new Date().toISOString();
  }

  const updated = await updateTutorProfile(userId, language, updates);

  return { profile: updated, levelChanged, newLevel };
}
