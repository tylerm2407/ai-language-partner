/**
 * HeroHook — Home screen's greeting block.
 *
 * Replaces a generic "Welcome back!" with a personalized, outcome-framed
 * line tied to the learner's motivation (collected during onboarding) +
 * their daily goal minutes. Ties daily effort to the concrete outcome
 * they said they cared about.
 *
 * When motivation isn't set (e.g., existing users pre-motivation rollout,
 * or after full app restart that cleared the transient store), falls back
 * to a neutral "Learning {language}" line — same feel as today, no regression.
 */

import React from 'react';
import { View } from 'react-native';
import { Mascot } from '../mascot/Mascot';
import { Heading, Body } from '../ui/Text';
import { spacing } from '../../config/theme';
import { SUPPORTED_LANGUAGES } from '../../config/app';
import type { LanguageCode, MotivationReason } from '../../types';

function timeGreeting(hour: number): string {
  if (hour < 5) return 'Late-night learner';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function languageName(code: LanguageCode | null | undefined): string {
  if (!code) return 'your target language';
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  return match?.name ?? code.toUpperCase();
}

function motivationHook(
  motivation: MotivationReason | null | undefined,
  lang: string,
  min: number,
): string {
  switch (motivation) {
    case 'travel':
      return `Order coffee in ${lang} in 3 weeks at ${min} min/day.`;
    case 'family':
      return `Talk with family in ${lang} in 6 weeks at ${min} min/day.`;
    case 'work':
      return `Join your first ${lang} meeting in 8 weeks at ${min} min/day.`;
    case 'brain':
      return `${min} minutes a day keeps your brain sharp.`;
    case 'curious':
      return `See how far ${min} minutes a day can take you.`;
    default:
      return `Learning ${lang}`;
  }
}

interface HeroHookProps {
  displayName?: string | null;
  targetLanguage?: LanguageCode | null;
  dailyGoalMinutes?: number;
  streak?: number;
  motivation?: MotivationReason | null;
  /** Learner's persistent Ideal L2 Self (Dörnyei L2MSS). When set, it
   * overrides the enum-based motivationHook because a concrete personal
   * vision beats a generic outcome line. research.md §11.1. */
  idealL2Self?: string | null;
  /** Fallback when displayName + motivation are both absent — keeps layout. */
  fallbackSubtitle?: string | null;
}

/**
 * Format the Ideal L2 Self into a hook line. Kept tight because the
 * original user input can be long (up to 300 chars) but the hero card
 * reserves ~2 lines.
 */
function idealSelfHook(idealL2Self: string, lang: string): string {
  const trimmed = idealL2Self.trim();
  // Start with a lower-case fragment to read naturally after "You said you want to…"
  const fragment = trimmed.charAt(0).toLowerCase() + trimmed.slice(1).replace(/\.$/, '');
  const capped = fragment.length > 90 ? `${fragment.slice(0, 87).trimEnd()}…` : fragment;
  return `You said you want to ${capped}. Every minute in ${lang} gets you closer.`;
}

export function HeroHook({
  displayName,
  targetLanguage,
  dailyGoalMinutes = 10,
  streak = 0,
  motivation,
  idealL2Self,
  fallbackSubtitle,
}: HeroHookProps) {
  const hour = new Date().getHours();
  const greeting = timeGreeting(hour);
  const lang = languageName(targetLanguage);
  const hook = idealL2Self && idealL2Self.trim()
    ? idealSelfHook(idealL2Self, lang)
    : motivation
      ? motivationHook(motivation, lang, dailyGoalMinutes)
      : fallbackSubtitle ?? motivationHook('curious', lang, dailyGoalMinutes);
  const mascotState = streak >= 1 ? 'happy' : 'idle';

  return (
    <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
      <Mascot state={mascotState} size="md" style={{ marginBottom: spacing.sm }} />
      <Heading level={1} style={{ textAlign: 'center' }}>
        {greeting}
        {displayName ? `, ${displayName}` : ''}
      </Heading>
      <Body
        tone="secondary"
        style={{
          textAlign: 'center',
          marginTop: spacing.xxs,
          maxWidth: 320,
          paddingHorizontal: spacing.md,
        }}
        accessibilityLiveRegion="polite"
      >
        {hook}
      </Body>
    </View>
  );
}
