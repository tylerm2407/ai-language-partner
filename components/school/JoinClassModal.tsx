import React, { useState } from 'react';
import { View, Text, TextInput, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../ui/GlassSurface';
import { GradientButton } from '../ui/GradientButton';

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
              <Ionicons name="close" size={24} color="#94A3B8" />
            </Pressable>

            {/* Title */}
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 20,
                fontFamily: 'Inter_700Bold',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Join a Class
            </Text>
            <Text
              style={{
                color: '#94A3B8',
                fontSize: 14,
                fontFamily: 'Inter_400Regular',
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              Enter the 8-character invite code from your teacher.
            </Text>

            {/* Success state */}
            {success ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
                <Text
                  style={{
                    color: '#22C55E',
                    fontSize: 16,
                    fontFamily: 'Inter_600SemiBold',
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
                  placeholderTextColor="#64748B"
                  maxLength={8}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading}
                  accessibilityLabel="Invite code input"
                  style={{
                    backgroundColor: 'rgba(30, 35, 50, 0.8)',
                    color: '#FFFFFF',
                    fontSize: 22,
                    fontFamily: 'Inter_600SemiBold',
                    textAlign: 'center',
                    letterSpacing: 4,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: error ? '#EF4444' : 'rgba(255, 255, 255, 0.15)',
                    marginBottom: 8,
                  }}
                />

                {/* Error */}
                {error && (
                  <Text
                    style={{
                      color: '#EF4444',
                      fontSize: 13,
                      fontFamily: 'Inter_500Medium',
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
                    <ActivityIndicator size="large" color="#6366F1" />
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
    </Modal>
  );
}
