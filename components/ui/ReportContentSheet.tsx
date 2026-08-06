/**
 * ReportContentSheet — in-app reporting of offensive or harmful AI output.
 *
 * Google Play's generative-AI policy requires apps that surface AI-generated
 * content to provide an in-app way to flag that content. Rendered from any AI
 * surface (chat, writing feedback, voice transcript, story, hint).
 *
 * Composed from Sheet + existing typography/tokens — no new visual patterns.
 */

import React, { useState } from 'react';
import { View, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Sheet } from './Sheet';
import { Heading, Body, Caption } from './Text';
import { colors, radii, spacing, typography } from '../../config/theme';
import {
  reportAiContent,
  type AiReportReason,
  type AiReportSurface,
} from '../../lib/supabase-queries';

const REASONS: { key: AiReportReason; label: string }[] = [
  { key: 'offensive', label: 'Offensive or hateful' },
  { key: 'harmful', label: 'Harmful or unsafe' },
  { key: 'sexual', label: 'Sexual content' },
  { key: 'inaccurate', label: 'Wrong or misleading' },
  { key: 'nonsense', label: "Doesn't make sense" },
  { key: 'other', label: 'Something else' },
];

interface ReportContentSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** The AI output being reported. */
  content: string;
  surface: AiReportSurface;
  /** Non-identifying context to help reproduce (language, level, session id). */
  context?: Record<string, unknown>;
}

export function ReportContentSheet({
  visible,
  onDismiss,
  content,
  surface,
  context,
}: ReportContentSheetProps) {
  const [reason, setReason] = useState<AiReportReason | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setReason(null);
    setComment('');
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
  }

  function handleDismiss() {
    reset();
    onDismiss();
  }

  async function handleSubmit() {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await reportAiContent({ surface, reason, content, comment: comment.trim() || undefined, context });
      setSubmitted(true);
    } catch (err) {
      // Surface the failure — a silently dropped report is worse than none,
      // because the user believes it was filed.
      setError(err instanceof Error ? err.message : 'Could not send your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Sheet visible={visible} onDismiss={handleDismiss}>
        <View style={styles.body}>
          <Heading level={2}>Thanks for reporting</Heading>
          <Body tone="secondary" style={styles.para}>
            We review every report and use them to improve what the AI tutor says.
          </Body>
          <Pressable
            onPress={handleDismiss}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Body weight="semibold" tone="onPrimary">Done</Body>
          </Pressable>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onDismiss={handleDismiss}>
      <View style={styles.body}>
        <Heading level={2}>Report this response</Heading>
        <Body tone="secondary" style={styles.para}>
          Tell us what was wrong with it. Reports help us make the AI tutor safer.
        </Body>

        <View style={styles.reasons}>
          {REASONS.map((r) => {
            const selected = reason === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                style={[styles.reason, selected && styles.reasonSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={r.label}
              >
                <Body tone={selected ? 'accent' : 'primary'} weight={selected ? 'semibold' : 'regular'}>
                  {r.label}
                </Body>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Add detail (optional)"
          placeholderTextColor={colors.text.tertiary}
          style={styles.input}
          multiline
          maxLength={1000}
          accessibilityLabel="Additional detail about this report"
        />

        {error ? (
          <Caption tone="error" style={styles.error}>{error}</Caption>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={!reason || submitting}
          style={[styles.primaryBtn, (!reason || submitting) && styles.primaryBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Send report"
          accessibilityState={{ disabled: !reason || submitting }}
        >
          {submitting ? (
            <ActivityIndicator color={colors.text.onPrimary} />
          ) : (
            <Body weight="semibold" tone="onPrimary">Send report</Body>
          )}
        </Pressable>

        <Pressable onPress={handleDismiss} style={styles.cancelBtn} accessibilityRole="button">
          <Body tone="secondary">Cancel</Body>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingBottom: spacing.sm,
  },
  para: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  reasons: {
    gap: spacing.xs,
  },
  reason: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    // 44pt minimum touch target (Apple HIG).
    minHeight: 44,
    justifyContent: 'center',
  },
  reasonSelected: {
    borderColor: colors.border.focus,
    backgroundColor: colors.surface.cardAlt,
  },
  input: {
    marginTop: spacing.md,
    minHeight: 72,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    color: colors.text.primary,
    fontFamily: typography.family.regular,
    fontSize: typography.scale.body.fontSize,
    textAlignVertical: 'top',
  },
  error: {
    marginTop: spacing.sm,
  },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.action.primaryFill,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  cancelBtn: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
});
