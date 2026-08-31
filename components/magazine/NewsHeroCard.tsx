import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MagazineGlassCard } from './MagazineGlassCard';
import { cefrLabel, cefrAccessibilityLabel } from '../../lib/cefr-labels';
import { colors, typography } from '../../config/theme';
import type { DailyNewsArticle } from '../../types';

interface NewsHeroCardProps {
  article: DailyNewsArticle | null;
  isLoading: boolean;
  error: string | null;
  hasRead: boolean;
  /** CEFR code (A1–C2). Rendered through `cefrLabel`, never bare: the code says
   *  nothing on its own, and it is not a localizable noun either — the target
   *  language varies, so "Nivel"/"Niveau"/"Livello" would be 9 translations of
   *  a word the can-do line already replaces. */
  level: string;
  onPress: () => void;
}

// Editorial face. Fraunces_600SemiBold carries its own weight — never pair it
// with fontWeight, which makes Android synthesize a second bolding pass.
const serifFont = typography.family.serif;

export function NewsHeroCard({ article, isLoading, error, hasRead, level, onPress }: NewsHeroCardProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <MagazineGlassCard style={styles.card}>
        <Text style={styles.kicker}>TODAY'S READ</Text>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonLede} />
        <View style={styles.skeletonMeta} />
      </MagazineGlassCard>
    );
  }

  // No article available
  if (!article) {
    return (
      <MagazineGlassCard style={styles.card}>
        <Text style={styles.kicker}>TODAY'S READ</Text>
        <Text style={styles.headline}>No article today</Text>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <Text style={styles.lede}>Check back later for your daily reading</Text>
        )}
      </MagazineGlassCard>
    );
  }

  // Article exists
  return (
    // Pressable collapses its children for VoiceOver, so the level has to be on
    // the container or it is never announced at all.
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Today's News. ${article.title}. ${cefrAccessibilityLabel(level)}`}
    >
      <MagazineGlassCard style={styles.card}>
        <Text style={styles.kicker}>TODAY'S READ</Text>
        <Text style={styles.headline}>{article.title}</Text>
        {article.summary ? (
          <Text style={styles.lede} numberOfLines={2}>{article.summary}</Text>
        ) : null}
        {/* The level moved out of the kicker. Uppercased at 2pt tracking, "A2"
            was indistinguishable from the section label around it, and it said
            nothing anyway — this states what the article is pitched at. */}
        <Text style={styles.levelNote}>{cefrLabel(level)}</Text>
        <Text style={styles.meta}>
          3 MIN READ {'·'} {hasRead ? 'READ ✓' : 'READ →'}
        </Text>
      </MagazineGlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
  },
  kicker: {
    fontFamily: serifFont,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.magazine.accentLilac,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headline: {
    fontFamily: serifFont,
    fontSize: 26,
    color: colors.text.primary,
    lineHeight: 33, // minLineHeight(26, 'display') — headlines carry descenders
    marginBottom: 8,
  },
  lede: {
    fontFamily: typography.family.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 18,
    marginBottom: 12,
  },
  /** Sentence case on purpose: the mono meta row below is uppercase, and two
   *  uppercase rows under a serif headline read as a receipt. */
  levelNote: {
    fontFamily: typography.family.regular,
    fontSize: 12,
    color: colors.text.tertiary,
    lineHeight: 17,
    marginBottom: 8,
  },
  meta: {
    fontFamily: typography.family.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  errorText: {
    fontFamily: typography.family.regular,
    fontSize: 13,
    color: colors.error.base,
    marginBottom: 12,
  },
  // Skeleton shapes
  skeletonTitle: {
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    marginBottom: 8,
    width: '85%',
  },
  skeletonLede: {
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 4,
    marginBottom: 12,
    width: '65%',
  },
  skeletonMeta: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 4,
    width: '40%',
  },
});
