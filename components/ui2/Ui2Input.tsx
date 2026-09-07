/**
 * Ui2Input — the UI 2.0 text field.
 *
 * There is no Dark Glow original to mirror: every screen that takes text today
 * hand-rolls a `<TextInput className="bg-dark-card …">`, which is why the
 * placeholder colour, the focus affordance and the error treatment differ on
 * every one of them. So this is designed from the DESIGN.md spec rather than
 * ported, and the prop names follow React Native's own `TextInputProps` —
 * `value`, `onChangeText`, `placeholder`, `editable`, `multiline` all pass
 * straight through — so a screen's existing `<TextInput>` still swaps in one
 * line even though there is no old component behind it.
 *
 * WHY `style` IS SPLIT IN TWO
 *
 * A hand-rolled field has one `style` and it means "the box". Here the box and
 * the text are separate elements with a label and an error stacked around
 * them, so a single `style` would be ambiguous: `containerStyle` positions the
 * whole block (margins, flex) and `inputStyle` reaches the text itself. Naming
 * them apart is better than silently applying a caller's `marginTop` to the
 * inner text node.
 *
 * FOCUS AND ERROR ARE BORDER STATES, NOT GLOWS
 *
 * Dark Glow signalled focus with a shadow. On a white ground a shadow is
 * nearly invisible, so focus thickens nothing and instead recolours the 2px
 * outline to `primary` — and an invalid field recolours it to `error` AND
 * prints the message with an alert glyph, because a red outline on its own is
 * the colour-only signal DESIGN.md forbids.
 *
 * `forwardRef` exists so a form can focus the next field on submit. Without it
 * a caller has no way to reach the underlying TextInput and ends up rebuilding
 * this component to get one.
 */
import { forwardRef, useCallback, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../config/theme';
import { Body, Caption } from './Ui2Text';

interface Ui2InputProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  /** Field name, rendered above the box and used as the a11y label. */
  label?: string;
  /** Guidance shown under the box. Hidden while `error` is set. */
  helper?: string;
  /** Validation failure. Its presence is what puts the field in the error state. */
  error?: string;
  /** Leading glyph inside the box (search, mail, lock). */
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

/** Taken from the props rather than named directly: React Native renamed the
 *  focus/blur event types between versions, and pinning either name here would
 *  break on the next upgrade for no benefit. */
type FocusHandler = NonNullable<TextInputProps['onFocus']>;
type BlurHandler = NonNullable<TextInputProps['onBlur']>;

export interface Ui2InputState {
  focused: boolean;
  invalid: boolean;
  disabled: boolean;
}

/**
 * The box's fill and outline for a given state. Pure so the precedence can be
 * asserted without a render harness — and precedence is the whole point:
 * disabled outranks error outranks focus, so a read-only field never shows a
 * live focus ring and an invalid field stays red while the caret is in it.
 */
export function inputSurface(c: Ui2Palette, state: Ui2InputState): { bg: string; border: string } {
  if (state.disabled) return { bg: c.surface2, border: c.cardBorder };
  if (state.invalid) return { bg: c.card, border: c.error };
  if (state.focused) return { bg: c.card, border: c.primary };
  return { bg: c.card, border: c.cardBorder };
}

export const Ui2Input = forwardRef<TextInput, Ui2InputProps>(function Ui2Input(
  { label, helper, error, icon, containerStyle, inputStyle, onFocus, onBlur, editable = true, multiline, accessibilityLabel, ...rest },
  ref,
) {
  const { c, type, shape } = useUi2Theme();
  const [focused, setFocused] = useState(false);

  // The caller's handlers still fire — wrapping them, not replacing them, is
  // what lets a screen keep its own onBlur validation.
  const handleFocus = useCallback<FocusHandler>(
    (e) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );
  const handleBlur = useCallback<BlurHandler>(
    (e) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  const invalid = !!error;
  const { bg, border } = inputSurface(c, { focused, invalid, disabled: !editable });

  return (
    <View style={containerStyle}>
      {label ? (
        <Caption tone="secondary" style={styles.label}>
          {label}
        </Caption>
      ) : null}

      <View
        style={[
          styles.box,
          {
            backgroundColor: bg,
            borderColor: border,
            borderWidth: shape.border,
            borderBottomWidth: shape.slab,
            borderRadius: shape.radiusCard,
          },
          multiline && styles.boxMultiline,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={focused ? c.primary : c.idle} /> : null}
        <TextInput
          {...rest}
          ref={ref}
          editable={editable}
          multiline={multiline}
          onFocus={handleFocus}
          onBlur={handleBlur}
          // A TextInput cannot be an Ui2Text, so the family is applied here
          // directly — `type.ui` is the same Nunito face `Body` resolves to.
          style={[
            styles.input,
            { fontFamily: type.ui, color: editable ? c.ink : c.muted },
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          placeholderTextColor={c.idle}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: !editable }}
          maxFontSizeMultiplier={1.6}
        />
      </View>

      {error ? (
        <View style={styles.footnote}>
          <Ionicons name="alert-circle" size={13} color={c.error} />
          <Body size="sm" tone="error" style={styles.footnoteText}>
            {error}
          </Body>
        </View>
      ) : helper ? (
        <Caption tone="secondary" style={styles.helper}>
          {helper}
        </Caption>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  boxMultiline: { alignItems: 'flex-start', paddingVertical: 12, minHeight: 96 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  inputMultiline: { textAlignVertical: 'top', paddingVertical: 0 },
  footnote: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  footnoteText: { flexShrink: 1 },
  helper: { marginTop: 6 },
});
