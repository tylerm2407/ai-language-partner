/**
 * LanguageSwitcherSheet — which language the app is in, and how to start
 * another one (migration 133).
 *
 * WHY A SHEET, AND WHY FROM HOME. A learner studying two languages switches
 * several times a week; a control three taps deep in Settings is a control
 * they stop using. It opens from the chip in the Home header, and Settings
 * opens the same sheet so the setting is still where someone would look for
 * it.
 *
 * WHAT A ROW SAYS. The language, and the band its lessons start at paired with
 * its can-do line — never a bare "A2" (CLAUDE.md §1). A language with no
 * lesson path says so in words rather than showing nothing.
 *
 * ADDING ONE ASKS FOR A LEVEL. A B1 Spanish speaker starting Japanese is a
 * beginner in Japanese, so the level is asked per language rather than carried
 * across from the profile. The answer resolves a course through
 * `lib/course-placement.ts`, exactly as onboarding and Settings do.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLanguageEnrollments } from '../../hooks/useLanguageEnrollments';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { cefrCanDo } from '../../lib/cefr-labels';
import { cefrBandForProficiencyLevel } from '../../lib/cefr-proficiency';
import { SUPPORTED_LANGUAGES } from '../../config/app';
import { spacing } from '../../config/theme';
import { loadErrorCopy } from '../../lib/error-copy';
import type { LanguageCode, LanguageEnrollment, ProficiencyLevel } from '../../types';
import { OptionRow } from './OptionRow';
import { Ui2InlineError } from './Ui2InlineError';
import { Ui2Sheet } from './Ui2Sheet';

const LEVELS: { value: ProficiencyLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'upper_intermediate', label: 'Upper Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export function languageName(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase();
}

export function languageFlag(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.flag ?? '🌐';
}

/**
 * The line under a language in the switcher. Pure so both halves — a placed
 * language and one with no lesson path — can be asserted without a render.
 */
export function enrollmentSubtitle(enrollment: LanguageEnrollment): string {
  if (!enrollment.placementBand) return 'Reading, chat and the tutor — no lesson path yet';
  return `Lessons start at ${enrollment.placementBand} · ${cefrCanDo(enrollment.placementBand)}`;
}

interface LanguageSwitcherSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

type Step = 'list' | 'pick-language' | 'pick-level';

export function LanguageSwitcherSheet({ visible, onDismiss }: LanguageSwitcherSheetProps) {
  const { c, type } = useUi2Theme();
  const { enrollments, active, loading, error, switching, reload, switchTo, addLanguage } =
    useLanguageEnrollments();

  const [step, setStep] = useState<Step>('list');
  const [pending, setPending] = useState<LanguageCode | null>(null);
  // A failed switch keeps the sheet open with the reason on it: the learner is
  // mid-decision, and an Alert over a dismissed sheet loses where they were.
  const [actionError, setActionError] = useState<ReturnType<typeof loadErrorCopy> | null>(null);

  useEffect(() => {
    if (!visible) {
      setStep('list');
      setPending(null);
      setActionError(null);
    }
  }, [visible]);

  const enrolled = new Set(enrollments.map((e) => e.language));
  const available = SUPPORTED_LANGUAGES.filter((l) => !enrolled.has(l.code));

  const onPickExisting = useCallback(
    async (language: LanguageCode) => {
      if (language === active) {
        onDismiss();
        return;
      }
      setActionError(null);
      try {
        await switchTo(language);
        onDismiss();
      } catch (err) {
        setActionError(loadErrorCopy(err, 'that language'));
      }
    },
    [active, switchTo, onDismiss],
  );

  const onPickLevel = useCallback(
    async (level: ProficiencyLevel) => {
      if (!pending) return;
      setActionError(null);
      try {
        await addLanguage(pending, level);
        onDismiss();
      } catch (err) {
        setActionError(loadErrorCopy(err, 'that language'));
      }
    },
    [pending, addLanguage, onDismiss],
  );

  const title =
    step === 'list' ? 'Your languages' : step === 'pick-language' ? 'Add a language' : `How much ${pending ? languageName(pending) : ''} do you know?`;

  return (
    <Ui2Sheet visible={visible} onDismiss={onDismiss}>
      <View style={styles.headerRow}>
        {step !== 'list' ? (
          <Pressable
            onPress={() => {
              setStep(step === 'pick-level' ? 'pick-language' : 'list');
              setActionError(null);
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
        ) : null}
        <Text
          accessibilityRole="header"
          style={{ fontFamily: type.heading, fontSize: 22, color: c.ink, flex: 1 }}
        >
          {title}
        </Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {actionError ? <Ui2InlineError copy={actionError} onRetry={() => setActionError(null)} retryLabel="Dismiss" /> : null}

        {step === 'list' ? (
          <>
            {error ? (
              <Ui2InlineError copy={error} onRetry={() => void reload()} />
            ) : loading && enrollments.length === 0 ? (
              <ActivityIndicator color={c.primary} style={styles.spinner} />
            ) : (
              enrollments.map((enrollment, i) => (
                <OptionRow
                  key={enrollment.language}
                  index={i}
                  title={languageName(enrollment.language)}
                  subtitle={enrollmentSubtitle(enrollment)}
                  selected={enrollment.language === active}
                  onSelect={() => void onPickExisting(enrollment.language)}
                  lead={<Text style={styles.flag}>{languageFlag(enrollment.language)}</Text>}
                  trail={
                    switching === enrollment.language ? <ActivityIndicator color={c.primary} /> : undefined
                  }
                  accessibilityLabel={`${languageName(enrollment.language)}. ${enrollmentSubtitle(enrollment)}`}
                />
              ))
            )}

            {available.length > 0 ? (
              <Pressable
                onPress={() => setStep('pick-language')}
                accessibilityRole="button"
                accessibilityLabel="Add a language"
                style={[styles.addRow, { borderColor: c.cardBorder }]}
              >
                <Ionicons name="add-circle-outline" size={22} color={c.primary} />
                <Text style={{ fontFamily: type.uiBold, fontSize: 16, color: c.ink, marginLeft: spacing.sm }}>
                  Add a language
                </Text>
              </Pressable>
            ) : null}

            <Text style={[styles.note, { color: c.muted, fontFamily: type.ui }]}>
              Your plan, your daily minutes and your reviews-per-day carry across every language you
              study. Each language keeps its own level, lessons and review deck.
            </Text>
          </>
        ) : null}

        {step === 'pick-language'
          ? available.map((lang, i) => (
              <OptionRow
                key={lang.code}
                index={i}
                title={lang.name}
                selected={false}
                onSelect={() => {
                  setPending(lang.code);
                  setStep('pick-level');
                }}
                lead={<Text style={styles.flag}>{lang.flag}</Text>}
              />
            ))
          : null}

        {step === 'pick-level'
          ? LEVELS.map((l, i) => (
              <OptionRow
                key={l.value}
                index={i}
                title={l.label}
                subtitle={cefrCanDo(cefrBandForProficiencyLevel(l.value))}
                selected={false}
                onSelect={() => void onPickLevel(l.value)}
                trail={switching === pending && pending ? <ActivityIndicator color={c.primary} /> : undefined}
                accessibilityLabel={`${l.label}. ${cefrCanDo(cefrBandForProficiencyLevel(l.value))}`}
              />
            ))
          : null}
      </ScrollView>
    </Ui2Sheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  back: { marginRight: spacing.sm },
  body: { maxHeight: 460 },
  bodyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  spinner: { marginVertical: spacing.xl },
  flag: { fontSize: 24 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    minHeight: 56,
  },
  note: { fontSize: 13, lineHeight: 18, marginTop: spacing.md },
});
