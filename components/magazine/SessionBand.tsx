import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MagazineGlassCard } from './MagazineGlassCard';
import { typography, radii, ui2Dark, ui2Light, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { useAppStore } from '../../stores/useAppStore';

// Editorial face. Fraunces_600SemiBold carries its own weight — never pair it
// with fontWeight, which makes Android synthesize a second bolding pass.
const serifFont = typography.family.serif;

export function SessionBand() {
  const { c, scheme } = useUi2Theme();
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const language = profile?.targetLanguage?.toUpperCase() ?? 'LESSON';

  return (
    <Pressable
      onPress={() => router.push('/learn' as any)}
      accessibilityRole="button"
      accessibilityLabel="Continue your lesson"
    >
      <MagazineGlassCard style={themed[scheme].card}>
        <View style={themed[scheme].row}>
          {/* Play button */}
          <LinearGradient
            colors={[c.primary, c.pink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={themed[scheme].playButton}
          >
            <Ionicons name="play" size={18} color={c.onPrimary} />
          </LinearGradient>

          {/* Text */}
          <View style={themed[scheme].textCol}>
            <Text style={themed[scheme].kicker}>CONTINUE · {language}</Text>
            <Text style={themed[scheme].title}>Today's Session</Text>
          </View>

          {/* Duration pill */}
          <View style={themed[scheme].durationPill}>
            <Text style={themed[scheme].durationText}>15 min</Text>
          </View>
        </View>
      </MagazineGlassCard>
    </Pressable>
  );
}

const makeStyles = (c: Ui2Palette) =>
  StyleSheet.create({
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
    color: c.muted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontFamily: serifFont,
    fontSize: 18,
    color: c.ink,
  },
  durationPill: {
    backgroundColor: c.primaryTint,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  durationText: {
    fontFamily: typography.family.mono,
    fontSize: 11,
    color: c.onTint,
  },
  });

/** Both schemes built once at module load — see DateLabel for why. */
const themed = { light: makeStyles(ui2Light), dark: makeStyles(ui2Dark) } as const;
