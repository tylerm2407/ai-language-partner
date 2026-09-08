/**
 * "How should I correct you?" — asked, not assumed.
 *
 * `mode === null` is a first-class state here, and rendering it as a genuine
 * unanswered question is the whole reason this component is not a switch.
 * `lib/tutor-storage.ts` goes to real trouble to keep "never chosen" distinct
 * from either answer; pre-selecting one on screen would throw that away at the
 * last possible moment. A learner who sees "Correct me as I go" already
 * highlighted has been told what they chose, and will mostly leave it — which
 * is exactly the silent imposition the storage layer exists to prevent.
 *
 * So in the unanswered state NEITHER row is selected and the group carries a
 * question. The learner picks. That is one tap of friction, once, in exchange
 * for the setting actually meaning something.
 *
 * ── COMPACT ──
 *
 * `compact` is the in-call header: the question has already been answered, so
 * the header shows the current answer and lets it be changed mid-call — the
 * moment a learner most wants to change it is the moment they are being
 * interrupted for the third time. It drops the question text and the
 * descriptions, not the touch target and not the labels. Every option stays
 * ≥44pt and stays a labelled radio; shrinking a control on a screen someone is
 * using while talking is the wrong place to save space.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { radii, spacing } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Body, Caption } from '../ui2/Ui2Text';
import type { CorrectionMode } from '../../lib/tutor-storage';

export interface CorrectionModeOption {
  mode: CorrectionMode;
  /** What the learner reads. First person, because they are choosing for
   *  themselves — "Correct me", not "Live corrections". */
  label: string;
  /** The consequence, in plain words. Shown in the full-size layout only. */
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * The closed set, in the order they are shown.
 *
 * "Correct me as I go" is first because it is the one a learner who came here
 * to be taught expects to exist; it is NOT first because it is a default. It
 * is not a default — see the header.
 */
export const CORRECTION_MODE_OPTIONS: readonly CorrectionModeOption[] = [
  {
    mode: 'as_you_go',
    label: 'Correct me as I go',
    description: 'I’ll fix mistakes in the moment, while you can still hear what changed.',
    icon: 'flash-outline',
  },
  {
    mode: 'let_me_talk',
    label: 'Just let me talk',
    description: 'I’ll stay out of the way and save what I noticed for the end.',
    icon: 'chatbubbles-outline',
  },
];

/** The prompt. Exported so a screen can use the same words in a sheet title
 *  without two copies drifting apart. */
export const CORRECTION_MODE_QUESTION = 'How should I correct you?';

/** VoiceOver text for one option. The selected state is carried by
 *  `accessibilityState`, so the label must not repeat it — a screen reader
 *  would then say "selected" twice. */
export function correctionOptionHint(option: CorrectionModeOption): string {
  return option.description;
}

/** Minimum touch target. 56 rather than the bare 44 because these rows are
 *  full-width and a taller row is easier to hit without looking. */
const OPTION_MIN_HEIGHT = 56;
/** In the call header the rows sit side by side, so they lose width, not
 *  height — this stays above the HIG minimum. */
const COMPACT_MIN_HEIGHT = 44;

interface CorrectionModeToggleProps {
  /** `null` = not yet chosen. Renders as a question with nothing selected. */
  mode: CorrectionMode | null;
  onChange: (mode: CorrectionMode) => void;
  compact?: boolean;
}

export function CorrectionModeToggle({ mode, onChange, compact = false }: CorrectionModeToggleProps) {
  const { c, shape } = useUi2Theme();

  // Tint blocks: filled surfaces, no outline. The fill carries selection and
  // the checkmark below is still the non-colour cue. The compact in-call row is two
  // pills and the chosen one goes solid; the lobby's full cards stay on the
  // tint so their descriptions keep reading.
  const surface = {
    backgroundColor: c.card,
    borderRadius: compact ? radii.pill : shape.radiusCard,
  };
  const selectedSurface = compact ? { backgroundColor: c.primary } : { backgroundColor: c.primaryTint };
  const selectedFg = compact ? c.onPrimary : c.onTint;

  return (
    <View
      accessibilityRole="radiogroup"
      // The group carries the question for VoiceOver even in compact, where it
      // is not drawn: a screen-reader user landing on two radios needs to know
      // what they are answering.
      accessibilityLabel={CORRECTION_MODE_QUESTION}
      style={compact ? styles.groupCompact : styles.group}
    >
      {!compact ? (
        <Body weight="extrabold" style={styles.question}>
          {CORRECTION_MODE_QUESTION}
        </Body>
      ) : null}

      {CORRECTION_MODE_OPTIONS.map((option) => {
        const selected = mode === option.mode;
        return (
          <Pressable
            key={option.mode}
            onPress={() => onChange(option.mode)}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={option.label}
            accessibilityHint={correctionOptionHint(option)}
            style={[
              compact ? styles.optionCompact : styles.option,
              surface,
              selected && selectedSurface,
            ]}
          >
            <Ionicons
              name={option.icon}
              size={compact ? 16 : 20}
              color={selected ? selectedFg : c.idle}
            />
            <View style={styles.optionText}>
              <Body
                size={compact ? 'sm' : 'md'}
                weight={selected ? 'extrabold' : 'medium'}
                numberOfLines={compact ? 1 : undefined}
                style={selected && compact ? { color: selectedFg } : undefined}
              >
                {option.label}
              </Body>
              {!compact ? <Caption tone="tertiary">{option.description}</Caption> : null}
            </View>
            {/* Selection is never carried by the fill alone: the checkmark is
                the non-colour cue §Accessibility requires, and it is the same
                rule the correct/incorrect feedback follows. */}
            {selected ? (
              <Ionicons name="checkmark-circle" size={compact ? 16 : 22} color={selectedFg} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.xs,
  },
  groupCompact: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  question: {
    marginBottom: spacing.xxs,
  },
  option: {
    minHeight: OPTION_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionCompact: {
    flex: 1,
    minHeight: COMPACT_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  optionText: {
    flex: 1,
    gap: spacing.xxs,
  },
});
