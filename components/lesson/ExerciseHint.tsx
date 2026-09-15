import { Caption } from '../ui/Text';
import { spacing } from '../../config/theme';

interface ExerciseHintProps {
  /** `exercise.hintText` — the hint an author wrote for this row. */
  hint?: string | null;
  /** True once the answer is on screen; the hint stops being a hint then. */
  revealed: boolean;
}

/**
 * The authored hint for an exercise.
 *
 * `hint_text` is human-written scaffolding — "Present passive: conjugated
 * werden + Partizip II", "The conjunction meaning 'before'" — and until now
 * exactly one component rendered it, `ClozeExercise`. The curriculum carries
 * 398 more of them on typed grammar rows that never reached a learner: 100 on
 * fill-blank, 63 on error-correction, 57 on sentence-construction, 53 on
 * transformation, 42 on word-form and 83 on translate-to-target. Authored
 * teaching that ships as dead rows.
 *
 * Kept as one component rather than five copies so the hint looks the same
 * everywhere it appears, and so the rule about WHEN it appears has one home.
 *
 * Deliberately not rendered on:
 *  - `listening_type`, `listening_choice`, `speaking` and `dictation`, where
 *    `hint_text` is the English gloss of the answer (6,336 rows). The stimulus
 *    on those is audio and is meant to be: printing the gloss turns a
 *    transcription task into a translation prompt.
 *  - `translate_to_native` (22 rows), where the hint glosses the very words the
 *    learner is being asked to translate.
 *  - `multiple_choice` (243 rows), where the hint states the rule that picks
 *    the right option and the options are already on screen. Showing it is
 *    defensible, but it changes how hard those rows are, and that is a product
 *    decision rather than a rendering fix.
 */
export function ExerciseHint({ hint, revealed }: ExerciseHintProps) {
  if (!hint?.trim() || revealed) return null;
  return (
    <Caption tone="tertiary" style={{ fontStyle: 'italic', marginBottom: spacing.md }}>
      Hint: {hint}
    </Caption>
  );
}
