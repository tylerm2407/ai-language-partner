import { View, Text, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';

interface StreakRepairModalProps {
  visible: boolean;
  brokenStreak: number;
  freezesAvailable: number;
  onRepair: () => void;
  onDismiss: () => void;
}

export function StreakRepairModal({ visible, brokenStreak, freezesAvailable, onRepair, onDismiss }: StreakRepairModalProps) {
  const router = useRouter();

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
              {/* Broken streak icon */}
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F59E0B20', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="snow" size={40} color="#F59E0B" />
              </View>

              <Text style={{ color: '#F1F5F9', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
                Oh no!
              </Text>

              <Text style={{ color: '#94A3B8', fontSize: 16, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
                Your {brokenStreak}-day streak was broken! Use a streak freeze to repair it.
              </Text>

              {freezesAvailable > 0 ? (
                <Pressable
                  style={{ width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}
                  onPress={onRepair}
                  accessibilityRole="button"
                  accessibilityLabel="Use streak freeze"
                >
                  <LinearGradient
                    colors={['#F59E0B', '#F59E0BCC']}
                    start={GRADIENT_START}
                    end={GRADIENT_END}
                    style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 14, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  >
                    <Ionicons name="snow" size={20} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
                      Use Streak Freeze ({freezesAvailable} left)
                    </Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <View style={{ width: '100%', marginBottom: 12 }}>
                  <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', marginBottom: 12 }}>
                    No streak freezes available
                  </Text>
                  <Pressable
                    style={{ width: '100%', borderRadius: 14, overflow: 'hidden' }}
                    onPress={() => {
                      onDismiss();
                      router.push('/profile/subscription' as any);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Upgrade for streak shield"
                  >
                    <LinearGradient
                      colors={[...GRADIENT_COLORS]}
                      start={GRADIENT_START}
                      end={GRADIENT_END}
                      style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 14 }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
                        Upgrade for Streak Shield
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              )}

              <Pressable
                style={{ paddingVertical: 12 }}
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              >
                <Text style={{ color: '#64748B', fontSize: 16 }}>Start fresh</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}
