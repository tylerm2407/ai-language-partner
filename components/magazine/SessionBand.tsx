import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MagazineGlassCard } from './MagazineGlassCard';
import { colors, typography, radii } from '../../config/theme';
import { useAppStore } from '../../stores/useAppStore';

const serifFont = Platform.select({ ios: 'Georgia', default: 'serif' });

export function SessionBand() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const language = profile?.targetLanguage?.toUpperCase() ?? 'LESSON';

  return (
    <Pressable
      onPress={() => router.push('/learn' as any)}
      accessibilityRole="button"
      accessibilityLabel="Continue your lesson"
    >
      <MagazineGlassCard style={styles.card}>
        <View style={styles.row}>
          {/* Play button */}
          <LinearGradient
            colors={[colors.magazine.accentBlue, colors.magazine.accentViolet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.playButton}
          >
            <Ionicons name="play" size={18} color="#FFFFFF" />
          </LinearGradient>

          {/* Text */}
          <View style={styles.textCol}>
            <Text style={styles.kicker}>CONTINUE · {language}</Text>
            <Text style={styles.title}>Today's Session</Text>
          </View>

          {/* Duration pill */}
          <View style={styles.durationPill}>
            <Text style={styles.durationText}>15 min</Text>
          </View>
        </View>
      </MagazineGlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textCol: {
    flex: 1,
  },
  kicker: {
    fontFamily: typography.family.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontFamily: serifFont,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  durationPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  durationText: {
    fontFamily: typography.family.mono,
    fontSize: 11,
    color: colors.text.secondary,
  },
});
