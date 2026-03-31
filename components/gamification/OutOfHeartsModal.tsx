import { View, Text, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';
import { formatRegenTime } from '../../lib/hearts';

interface OutOfHeartsModalProps {
  visible: boolean;
  nextRegenAt: Date | null;
  onDismiss: () => void;
}

export function OutOfHeartsModal({ visible, nextRegenAt, onDismiss }: OutOfHeartsModalProps) {
  const router = useRouter();
  const regenText = formatRegenTime(nextRegenAt);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
        <View style={{ width: '85%', borderRadius: 24, overflow: 'hidden' }}>
          <LinearGradient
            colors={[...GRADIENT_COLORS]}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={{ borderRadius: 24, padding: 1.5 }}
          >
            <View style={{ borderRadius: 22.5, padding: 32, alignItems: 'center', backgroundColor: '#151921' }}>
              {/* Broken heart icon */}
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EF444420', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="heart-dislike" size={40} color="#EF4444" />
              </View>

              <Text className="text-2xl font-bold text-text-primary text-center mb-2">
                Out of Hearts!
              </Text>

              <Text className="text-base text-text-secondary text-center mb-6">
                You've run out of hearts. Wait for them to regenerate or upgrade for unlimited hearts.
              </Text>

              {/* Regen timer */}
              {nextRegenAt && (
                <View className="flex-row items-center gap-2 mb-6">
                  <Ionicons name="time" size={18} color="#38BDF8" />
                  <Text className="text-base text-text-secondary">
                    Next heart in <Text style={{ color: '#38BDF8', fontWeight: '700' }}>{regenText}</Text>
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
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
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
