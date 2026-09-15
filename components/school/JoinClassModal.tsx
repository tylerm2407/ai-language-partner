import React, { useState } from 'react';
import { View, Text, TextInput, Modal, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../ui2/SlabCard';
import { SlabButton } from '../ui2/SlabButton';
import { scrimColor } from '../ui2/Ui2Sheet';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface JoinClassModalProps {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}

/** 0x8C ≈ 55% — the same scrim strength Ui2Sheet uses, appended to the
 *  scheme's scrim token so the modal darkens correctly in both schemes. */
const SCRIM_ALPHA = '8C';

export default function JoinClassModal({ visible, onClose, onJoin }: JoinClassModalProps) {
  const { c, scheme } = useUi2Theme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleJoin = async () => {
    if (code.length !== 8) {
      setError('Invite code must be 8 characters.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await onJoin(code.toUpperCase());
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCode('');
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join class. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: scrimColor(scheme, c) + SCRIM_ALPHA,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="Close modal"
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 400 }}>
          <SlabCard
            style={{ padding: 24, borderRadius: 20 }}
          >
            {/* Close button */}
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color={c.muted} />
            </Pressable>

            {/* Title */}
            <Text
              style={{
                color: c.ink,
                fontSize: 20,
                fontFamily: 'Manrope_800ExtraBold',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Join a Class
            </Text>
            <Text
              style={{
                color: c.muted,
                fontSize: 14,
                fontFamily: 'Manrope_400Regular',
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              Enter the 8-character invite code from your teacher.
            </Text>

            {/* Success state */}
            {success ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Ionicons name="checkmark-circle" size={48} color={c.green} />
                <Text
                  style={{
                    color: c.ink,
                    fontSize: 16,
                    fontFamily: 'Manrope_600SemiBold',
                    marginTop: 12,
                  }}
                >
                  Joined successfully!
                </Text>
              </View>
            ) : (
              <>
                {/* Code input */}
                <TextInput
                  value={code}
                  onChangeText={(text) => {
                    setError(null);
                    setCode(text.toUpperCase().slice(0, 8));
                  }}
                  placeholder="ABCD1234"
                  placeholderTextColor={c.idle}
                  maxLength={8}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading}
                  accessibilityLabel="Invite code input"
                  style={{
                    backgroundColor: c.surface2,
                    color: c.ink,
                    fontSize: 22,
                    fontFamily: 'Manrope_600SemiBold',
                    textAlign: 'center',
                    letterSpacing: 4,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: error ? c.error : c.cardBorder,
                    marginBottom: 8,
                  }}
                />

                {/* Error */}
                {error && (
                  <Text
                    style={{
                      color: c.error,
                      fontSize: 13,
                      fontFamily: 'Manrope_500Medium',
                      textAlign: 'center',
                      marginBottom: 8,
                    }}
                    accessibilityRole="alert"
                  >
                    {error}
                  </Text>
                )}

                {/* Join button */}
                <View style={{ marginTop: 12, alignItems: 'center' }}>
                  {loading ? (
                    <ActivityIndicator size="large" color={c.primary} />
                  ) : (
                    <SlabButton
                      label="Join Class"
                      onPress={handleJoin}
                      disabled={code.length !== 8}
                      accessibilityHint="Join the class with the entered invite code"
                      arrow={false}
                    />
                  )}
                </View>
              </>
            )}
          </SlabCard>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
