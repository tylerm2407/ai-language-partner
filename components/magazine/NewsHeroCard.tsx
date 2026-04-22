import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { MagazineGlassCard } from './MagazineGlassCard';
import { colors, typography } from '../../config/theme';
import type { DailyNewsArticle } from '../../types';

interface NewsHeroCardProps {
  article: DailyNewsArticle | null;
  isLoading: boolean;
  error: string | null;
  hasRead: boolean;
  level: string;
  onPress: () => void;
}

const serifFont = Platform.select({ ios: 'Georgia', default: 'serif' });

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
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Today's News">
      <MagazineGlassCard style={styles.card}>
        <Text style={styles.kicker}>
          TODAY'S READ {'·'} NIVEL {level.toUpperCase()}
        </Text>
        <Text style={styles.headline}>{article.title}</Text>
        {article.summary ? (
          <Text style={styles.lede} numberOfLines={2}>{article.summary}</Text>
        ) : null}
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
    fontWeight: 'bold',
    color: colors.text.primary,
    lineHeight: 32,
    marginBottom: 8,
  },
  lede: {
    fontFamily: typography.family.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 18,
    marginBottom: 12,
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
