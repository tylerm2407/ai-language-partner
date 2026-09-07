/**
 * AiConsentSheet — explicit permission before learner content is sent to a
 * third-party AI provider.
 *
 * Required by Apple guideline 5.1.2(i) and Google's prominent-disclosure rule,
 * both of which want the disclosure at the point of the action rather than
 * buried in a policy. Named providers, plain language, and a real decline path.
 *
 * Composed from Sheet + existing typography/tokens — no new visual patterns.
 * UI 2.0: colour comes from `useUi2Theme()`, the type from `Ui2Text`, and the
 * agree button carries the slab bottom edge like every other UI 2.0 CTA.
 * Copy lives in lib/ai-consent.ts so the sheet, Settings and the privacy policy
 * cannot drift apart.
 */

import React, { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from './Sheet';
import { Body, Caption } from '../ui2/Ui2Text';
import { radii, spacing } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { AI_CONSENT_COPY, type AiConsentKind } from '../../lib/ai-consent';

const PRIVACY_URL = 'https://fluenci.com/privacy';

interface AiConsentSheetProps {
  visible: boolean;
  kind: AiConsentKind;
  /** Learner agreed. Persist, then proceed with the action that triggered this. */
  onAgree: () => void;
  /** Learner declined or dismissed. The triggering action must NOT proceed. */
  onDecline: () => void;
}

export function AiConsentSheet({ visible, kind, onAgree, onDecline }: AiConsentSheetProps) {
  const { c, shape } = useUi2Theme();
  const [declined, setDeclined] = useState(false);
  const copy = AI_CONSENT_COPY[kind];

  function handleDecline() {
    // Show the consequence before closing, so "Not now" is an informed choice
    // rather than a dead end the learner has to guess the meaning of.
    setDeclined(true);
  }

  function handleClose() {
    setDeclined(false);
    onDecline();
  }

  function handleAgree() {
    setDeclined(false);
    onAgree();
  }

  return (
    <Sheet visible={visible} onDismiss={handleClose}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {declined ? (
          <>
            <Body weight="bold" style={styles.title}>Not a problem</Body>
            <Body tone="secondary" style={styles.paragraph}>{copy.declinedNote}</Body>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: c.primary, borderBottomColor: c.slab, borderBottomWidth: shape.buttonSlab }]}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Body weight="bold" tone="onPrimary">Got it</Body>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => setDeclined(false)}
              accessibilityRole="button"
              accessibilityLabel="Back to the details"
            >
              <Body tone="secondary">Read it again</Body>
            </Pressable>
          </>
        ) : (
          <>
            <View style={[styles.iconRow, { backgroundColor: c.primaryTint }]}>
              <Ionicons
                name={kind === 'voice' ? 'mic-outline' : 'chatbubbles-outline'}
                size={24}
                color={c.onTint}
              />
            </View>
            <Body weight="bold" style={styles.title}>{copy.title}</Body>
            <Body tone="secondary" style={styles.paragraph}>{copy.intro}</Body>

            <View style={[styles.noticeBox, { backgroundColor: c.surface2 }]}>
              {copy.points.map((point) => (
                <Caption key={point} tone="secondary">
                  {`• ${point}`}
                </Caption>
              ))}
            </View>

            <Pressable
              onPress={() => Linking.openURL(PRIVACY_URL)}
              accessibilityRole="link"
              accessibilityLabel="Read the full privacy policy"
              style={styles.linkRow}
            >
              <Caption tone="accent" style={styles.linkText}>Read the full privacy policy</Caption>
              <Ionicons name="open-outline" size={14} color={c.onTint} />
            </Pressable>

            <Pressable
              style={[styles.primaryButton, { backgroundColor: c.primary, borderBottomColor: c.slab, borderBottomWidth: shape.buttonSlab }]}
              onPress={handleAgree}
              accessibilityRole="button"
              accessibilityLabel={copy.agreeLabel}
            >
              <Body weight="bold" tone="onPrimary">{copy.agreeLabel}</Body>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={handleDecline}
              accessibilityRole="button"
              accessibilityLabel={copy.declineLabel}
            >
              <Body tone="secondary">{copy.declineLabel}</Body>
            </Pressable>
            <Caption style={styles.footnote}>
              You can withdraw this any time in Profile → Settings.
            </Caption>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  iconRow: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  paragraph: {
    marginBottom: spacing.md,
  },
  noticeBox: {
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // 44pt minimum touch target — matches ReportContentSheet.
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  primaryButton: {
    borderRadius: radii.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
