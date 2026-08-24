import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../config/theme';

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

const METER_COLORS = [
  colors.border.subtle,
  colors.error.base,
  colors.warning.light,
  colors.warning.light,
  colors.success.base,
];

export function PasswordField({
  value,
  onChangeText,
  showStrength = false,
  placeholder = 'Password',
  isNew = false,
  onSubmitEditing,
}: PasswordFieldProps) {
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
          borderRadius: radii.lg,
          backgroundColor: colors.surface.card,
          borderWidth: focused ? 1.5 : 1,
          borderColor: focused ? 'rgba(129,140,248,0.5)' : colors.border.subtle,
        }}
      >
        <Ionicons name="lock-closed-outline" size={17} color={colors.text.tertiary} />
        <TextInput
          style={{
            flex: 1,
            fontFamily: typography.family.medium,
            fontSize: 15,
            color: colors.text.primary,
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.text.quaternary}
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
              fontFamily: typography.family.bold,
              fontSize: 11,
              letterSpacing: 1.2,
              color: colors.action.accent,
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
                    seg <= strength.score ? METER_COLORS[strength.score] : colors.border.subtle,
                }}
              />
            ))}
          </View>
          <Text
            style={{
              fontFamily: typography.family.mono,
              fontSize: 10,
              letterSpacing: 1.3,
              color: strength.score >= 4 ? colors.success.light : colors.text.tertiary,
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
