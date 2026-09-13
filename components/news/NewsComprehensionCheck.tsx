/**
 * "Check your understanding" — the three-question block under a daily-news
 * article (migration 129). Single-select per question, one Submit, then a
 * plain "n of 3" that never changes: the first attempt is the one the server
 * keeps, so the picks freeze the moment Submit is tapped.
 *
 * All the rules live in `news-comprehension.ts`; this file only draws them.
 * Options are radio buttons to a screen reader (`accessibilityRole="radio"`,
 * `checked`) because that is what they are — a labelled group with exactly
 * one pick — and a bare Pressable would read as four unrelated buttons.
 */
import { useCallback, useEffect, useReducer } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { saveErrorCopy } from '../../lib/error-copy';
import { spacing, radii } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { SlabButton } from '../ui2/SlabButton';
import { SlabCard } from '../ui2/SlabCard';
import { Ui2InlineError } from '../ui2/Ui2InlineError';
import { Body, Caption, Heading } from '../ui2/Ui2Text';
import {
  answersForSubmit,
  canSubmit,
  comprehensionReducer,
  initialComprehensionState,
  isLocked,
  resultCopy,
} from './news-comprehension';
import type { NewsComprehensionQuestion, NewsReadingResult } from '../../types';

interface NewsComprehensionCheckProps {
  questions: NewsComprehensionQuestion[];
  /** A result already stored for this article, if the learner is back. */
  existing: NewsReadingResult | null;
  onSubmit: (answers: number[]) => Promise<NewsReadingResult>;
}

export function NewsComprehensionCheck({ questions, existing, onSubmit }: NewsComprehensionCheckProps) {
  const { c } = useUi2Theme();
  const [state, dispatch] = useReducer(
    comprehensionReducer,
    { count: questions.length, existing },
    (init) => initialComprehensionState(init.count, init.existing),
  );

  // The stored result usually arrives with the article, but on a cold cache
  // it can land after this mounted with the questions open.
  useEffect(() => {
    if (existing && state.status !== 'done') dispatch({ type: 'restore', result: existing });
    // `state.status` is read, not depended on: this reacts to `existing`
    // arriving, not to the learner's own transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  const submit = useCallback(async () => {
    try {
      const result = await onSubmit(answersForSubmit(state));
      haptic('complete');
      dispatch({ type: 'succeeded', result });
    } catch (err) {
      dispatch({ type: 'failed', error: saveErrorCopy(err, 'your answers') });
    }
  }, [onSubmit, state]);

  // Submit and Retry both move the state to `submitting`; the request itself
  // is fired from here so the two paths cannot drift.
  useEffect(() => {
    if (state.status === 'submitting') void submit();
    // `submit` closes over the answers, which are frozen while submitting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const locked = isLocked(state);
  const copy = state.result ? resultCopy(state.result) : null;

  return (
    <View style={{ marginBottom: spacing.xl }} accessibilityLabel="Check your understanding">
      <Heading level={3} style={{ marginBottom: spacing.xs }}>
        Check your understanding
      </Heading>
      <Caption tone="secondary" style={{ marginBottom: spacing.md }}>
        {copy ? 'Your first answers are the ones that count.' : 'Three questions about what you just read. One pick each.'}
      </Caption>

      {questions.map((q, qi) => {
        const picked = state.answers[qi];
        return (
          <SlabCard key={qi} style={{ marginBottom: spacing.sm, padding: 14 }}>
            <Body weight="bold" style={{ marginBottom: spacing.xs }}>
              {q.question}
            </Body>
            <View accessibilityRole="radiogroup">
              {q.options.map((option, oi) => {
                const selected = picked === oi;
                return (
                  <Pressable
                    key={oi}
                    onPress={() => {
                      haptic('buttonPress');
                      dispatch({ type: 'select', question: qi, option: oi });
                    }}
                    disabled={locked}
                    accessibilityRole="radio"
                    accessibilityLabel={option}
                    accessibilityState={{ checked: selected, disabled: locked }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      minHeight: 44,
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.sm,
                      marginTop: 6,
                      borderRadius: radii.lg,
                      borderWidth: 1,
                      borderColor: selected ? c.primary : c.cardBorder,
                      backgroundColor: selected ? c.primaryTint : 'transparent',
                      opacity: locked && !selected ? 0.6 : 1,
                    }}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? c.primary : c.idle}
                    />
                    <Body size="sm" style={{ marginLeft: spacing.xs, flex: 1 }}>
                      {option}
                    </Body>
                  </Pressable>
                );
              })}
            </View>
          </SlabCard>
        );
      })}

      {state.status === 'error' && state.error ? (
        <Ui2InlineError copy={state.error} onRetry={() => dispatch({ type: 'retry' })} />
      ) : null}

      {copy ? (
        <SlabCard style={{ marginTop: spacing.xs, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityRole="summary">
            <Ionicons name="checkmark-circle" size={22} color={c.green} />
            <Body weight="extrabold" style={{ marginLeft: spacing.xs }}>
              {copy.score}
            </Body>
          </View>
          <Body size="sm" tone="secondary" style={{ marginTop: spacing.xxs }}>
            {copy.note}
          </Body>
        </SlabCard>
      ) : (
        <View style={{ marginTop: spacing.xs }}>
          <SlabButton
            label="Submit"
            onPress={() => dispatch({ type: 'submit' })}
            disabled={!canSubmit(state)}
            loading={state.status === 'submitting'}
            arrow={false}
            accessibilityHint="Check your three answers. Your first answers are the ones that count."
          />
        </View>
      )}
    </View>
  );
}
