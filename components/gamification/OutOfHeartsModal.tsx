import { View, Text, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';
import { formatRegenTime } from '../../lib/hearts';
import { useAppStore } from '../../stores/useAppStore';
import { colors } from '../../config/theme';

interface OutOfHeartsModalProps {
  visible: boolean;
  nextRegenAt: Date | null;
  onDismiss: () => void;
}

export function OutOfHeartsModal({ visible, nextRegenAt, onDismiss }: OutOfHeartsModalProps) {
  const router = useRouter();
  const { profile, dailyStats } = useAppStore();
  const regenText = formatRegenTime(nextRegenAt);

  // Loss aversion (DESIGN.md §UX Psychology Principles #5), bound by the
  // ethical guardrails in that section: the stake named here must be real and
  // already owned. Only surfaced when the learner genuinely has a live streak
  // and has not yet banked XP today — otherwise nothing is actually at risk
  // and the line is not shown at all.
  const streak = profile?.streak ?? 0;
  const streakAtRisk = streak > 0 && (dailyStats?.xpEarned ?? 0) === 0;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface.overlay }}>
        <View style={{ width: '85%', borderRadius: 24, overflow: 'hidden' }}>
          <LinearGradient
            colors={[...GRADIENT_COLORS]}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={{ borderRadius: 24, padding: 1.5 }}
          >
            <View style={{ borderRadius: 22.5, padding: 32, alignItems: 'center', backgroundColor: '#1B1A17' }}>
              {/* Broken heart icon */}
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.error.tint, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="heart-dislike" size={40} color="#C0555F" />
              </View>

              <Text className="text-2xl font-bold text-text-primary text-center mb-2">
                Out of Hearts!
              </Text>

              <Text className="text-base text-text-secondary text-center mb-6">
                You've run out of hearts. Wait for them to regenerate or upgrade for unlimited hearts.
              </Text>

              {/* Real, already-owned stake — rendered only when it is true */}
              {streakAtRisk && (
                <View
                  className="w-full flex-row items-center gap-2 mb-6 p-3 rounded-2xl"
                  style={{ backgroundColor: colors.streak.tint }}
                >
                  <Ionicons name="flame" size={18} color={colors.streak.fire} />
                  <Text className="flex-1 text-sm text-text-secondary">
                    Your{' '}
                    <Text style={{ color: colors.streak.fire, fontWeight: '700' }}>
                      {streak}-day streak
                    </Text>{' '}
                    still needs a lesson today.
                  </Text>
                </View>
              )}

              {/* Regen timer */}
              {nextRegenAt && (
                <View className="flex-row items-center gap-2 mb-6">
                  <Ionicons name="time" size={18} color={colors.league.diamond} />
                  <Text className="text-base text-text-secondary">
                    Next heart in <Text style={{ color: colors.league.diamond, fontWeight: '700' }}>{regenText}</Text>
                  </Text>
                </View>
              )}

              {/* Upgrade CTA */}
              <Pressable
                style={{ width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}
                onPress={() => {
                  onDismiss();
                  router.push('/profile/subscription' as any);
                }}
                accessibilityRole="button"
                accessibilityLabel="Upgrade for unlimited hearts"
              >
                <LinearGradient
                  colors={[...GRADIENT_COLORS]}
                  start={GRADIENT_START}
                  end={GRADIENT_END}
                  style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 14 }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                    Upgrade for Unlimited Hearts
                  </Text>
                </LinearGradient>
              </Pressable>

              {/* Dismiss */}
              <Pressable
                style={{ paddingVertical: 12 }}
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel="Wait for hearts"
              >
                <Text className="text-base text-text-tertiary">Wait for hearts</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}
