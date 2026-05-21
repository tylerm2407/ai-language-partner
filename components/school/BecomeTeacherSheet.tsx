import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Sheet } from '../ui/Sheet';
import { TactileButton } from '../ui/TactileButton';
import { Heading, Body } from '../ui/Text';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '../../config/theme';

interface BecomeTeacherSheetProps {
  visible: boolean;
  onClose: () => void;
  onClaimed: () => void;
  userId: string;
}

export function BecomeTeacherSheet({
  visible,
  onClose,
  onClaimed,
  userId,
}: BecomeTeacherSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: insertError } = await supabase
        .from('user_roles')
        .upsert(
          { user_id: userId, role: 'teacher' },
          { onConflict: 'user_id,role' },
        );

      if (insertError) throw insertError;

      onClaimed();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet visible={visible} onDismiss={onClose}>
      <View style={styles.container}>
        <Heading level={2}>Become a Teacher</Heading>
        <Body tone="secondary" style={styles.body}>
          Switching to teacher mode gives you access to create classrooms, invite
          students, and assign conversation practice. You can switch back to
          learner mode at any time.
        </Body>

        {error && (
          <Body tone="error" size="sm" style={styles.error}>
            {error}
          </Body>
        )}

        {loading ? (
          <ActivityIndicator size="small" color={colors.indigo[400]} />
        ) : (
          <View style={styles.buttons}>
            <TactileButton
              label="Become a Teacher"
              variant="primary"
              onPress={handleConfirm}
              disabled={loading}
            />
            <TactileButton
              label="Cancel"
              variant="ghost"
              onPress={onClose}
              disabled={loading}
            />
          </View>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  body: {
    marginBottom: spacing.sm,
  },
  error: {
    marginBottom: spacing.xs,
  },
  buttons: {
    gap: spacing.sm,
  },
});
