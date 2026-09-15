/**
 * Ui2Screen — the UI 2.0 screen shell: scheme background, safe area, a
 * scrolling body and a fixed CTA footer that stays above the keyboard.
 * Sets the status bar to match the scheme, since the root pins it to light.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface Ui2ScreenProps {
  children: ReactNode;
  /** Pinned under the scroll body. */
  footer?: ReactNode;
  /** Skip the ScrollView (full-bleed content that manages its own layout). */
  fixed?: boolean;
}

export function Ui2Screen({ children, footer, fixed }: Ui2ScreenProps) {
  const { c, scheme } = useUi2Theme();
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {fixed ? (
            <View style={styles.root}>{children}</View>
          ) : (
            <ScrollView
              style={styles.root}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 18 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 4 },
});
