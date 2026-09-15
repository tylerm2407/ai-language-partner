import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface PasswordFieldProps {
  value: string;
  onChangeText: (v: string) => void;
  /** Sign-up shows the strength meter; sign-in does not. */
  showStrength?: boolean;
  placeholder?: string;
  /** iOS/Android password-manager hint. */
  isNew?: boolean;
  onSubmitEditing?: () => void;
}

/**
 * One password field with a visibility toggle — and deliberately NO
 * confirm-password field.
 *
 * Per `docs/strategy/conversion-research.md`: removing confirm-password and
 * adding a visibility toggle is a +56.3% signup-completion finding. The toggle
 * is what makes the removal safe — the user can check what they typed instead
 * of typing it twice.
 */

const MIN_LENGTH = 6;

/**
 * Deliberately simple and honest: length plus character variety. No
 * dictionary check, because a meter that calls a strong passphrase "weak"
 * trains people to add symbols instead of length.
 */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= MIN_LENGTH) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw) || /[^\w\s]/.test(pw)) score += 1;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  return { score: clamped, label: labels[clamped] };
}

/** Indexed by strength score, so segment 0 is the empty-meter grey. Taking the
 *  palette as an argument rather than reading a module-level `colors` is what
 *  lets the meter follow the phone's light/dark setting. */
const meterColors = (c: Ui2Palette): string[] => [
  c.track,
  c.error,
  c.yellow,
  c.yellow,
  c.green,
];

export function PasswordField({
  value,
  onChangeText,
  showStrength = false,
  placeholder = 'Password',
  isNew = false,
  onSubmitEditing,
}: PasswordFieldProps) {
  const { c, type, shape } = useUi2Theme();
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const strength = passwordStrength(value);

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm + 2,
          height: 58,
          paddingHorizontal: spacing.md + 2,
          borderRadius: shape.radiusCard,
          backgroundColor: c.card,
          // Focus recolours the outline instead of thickening it, the same way
          // Ui2Input does: on a white ground a 0.5px growth is invisible.
          borderWidth: shape.border,
          borderBottomWidth: shape.slab,
          borderColor: focused ? c.primary : c.cardBorder,
        }}
      >
        <Ionicons name="lock-closed-outline" size={17} color={focused ? c.primary : c.idle} />
        <TextInput
          style={{
            flex: 1,
            fontFamily: type.ui,
            fontSize: 15,
            color: c.ink,
          }}
          placeholder={placeholder}
          placeholderTextColor={c.idle}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          secureTextEntry={!revealed}
          autoCapitalize="none"
          autoCorrect={false}
          // `new-password` lets iCloud Keychain / Google Password Manager offer
          // a generated password; `password` lets them autofill an existing one.
          autoComplete={isNew ? 'new-password' : 'password'}
          textContentType={isNew ? 'newPassword' : 'password'}
          returnKeyType="go"
          accessibilityLabel={placeholder}
        />
        <Pressable
          onPress={() => setRevealed((r) => !r)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          accessibilityState={{ selected: revealed }}
          style={{ minHeight: 44, justifyContent: 'center', paddingLeft: spacing.xs }}
        >
          <Text
            style={{
              fontFamily: type.uiBold,
              fontSize: 11,
              letterSpacing: 1.2,
              color: c.primary,
            }}
          >
            {revealed ? 'HIDE' : 'SHOW'}
          </Text>
        </Pressable>
      </View>

      {showStrength && value.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs + 2,
            marginTop: spacing.xs + 2,
            paddingHorizontal: spacing.xs,
          }}
        >
          <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3, 4].map((seg) => (
              <View
                key={seg}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor:
                    seg <= strength.score ? meterColors(c)[strength.score] : c.track,
                }}
              />
            ))}
          </View>
          <Text
            style={{
              fontFamily: type.uiBold,
              fontSize: 10,
              letterSpacing: 1.3,
              color: strength.score >= 4 ? c.green : c.muted,
            }}
            accessibilityLiveRegion="polite"
          >
            {strength.label.toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}
