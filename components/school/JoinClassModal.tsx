import React, { useState } from 'react';
import { View, Text, TextInput, Modal, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../ui/GlassSurface';
import { GradientButton } from '../ui/GradientButton';
import { colors } from '../../config/theme';

interface JoinClassModalProps {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}

export default function JoinClassModal({ visible, onClose, onJoin }: JoinClassModalProps) {
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
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="Close modal"
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 400 }}>
          <GlassSurface
            innerStyle={{ padding: 24 }}
            borderRadius={20}
          >
            {/* Close button */}
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color="#9C968A" />
            </Pressable>

            {/* Title */}
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 20,
                fontFamily: 'Nunito_800ExtraBold',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Join a Class
            </Text>
            <Text
              style={{
                color: '#9C968A',
                fontSize: 14,
                fontFamily: 'Nunito_400Regular',
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              Enter the 8-character invite code from your teacher.
            </Text>

            {/* Success state */}
            {success ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Ionicons name="checkmark-circle" size={48} color="#4E9F6B" />
                <Text
                  style={{
                    color: '#4E9F6B',
                    fontSize: 16,
                    fontFamily: 'Nunito_600SemiBold',
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
                  placeholderTextColor="#7A756B"
                  maxLength={8}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading}
                  accessibilityLabel="Invite code input"
                  style={{
                    backgroundColor: colors.surface.cardAlt,
                    color: '#FFFFFF',
                    fontSize: 22,
                    fontFamily: 'Nunito_600SemiBold',
                    textAlign: 'center',
                    letterSpacing: 4,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: error ? '#C0555F' : 'rgba(255, 255, 255, 0.15)',
                    marginBottom: 8,
                  }}
                />

                {/* Error */}
                {error && (
                  <Text
                    style={{
                      color: '#C0555F',
                      fontSize: 13,
                      fontFamily: 'Nunito_500Medium',
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
                    <ActivityIndicator size="large" color="#E0BE6B" />
                  ) : (
                    <GradientButton
                      label="Join Class"
                      onPress={handleJoin}
                      disabled={code.length !== 8}
                      accessibilityHint="Join the class with the entered invite code"
                    />
                  )}
                </View>
              </>
            )}
          </GlassSurface>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
