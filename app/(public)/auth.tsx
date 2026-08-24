import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { Avatar } from '../../components/avatar/Avatar';
import { RotatingGreeting } from '../../components/auth/RotatingGreeting';
import { AmbientGreetings } from '../../components/auth/AmbientGreetings';
import { PasswordField } from '../../components/auth/PasswordField';
import { LEVEL_LABELS } from '../../components/onboarding/PlacementTest';
import { loadPendingOnboarding, type PendingOnboarding } from '../../lib/pending-onboarding';
import { authErrorCopy } from '../../lib/auth-errors';
import {
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
  SocialAuthCancelled,
} from '../../lib/social-auth';
import { SUPPORTED_LANGUAGES } from '../../config/app';
import { colors, radii, spacing, typography } from '../../config/theme';

type AuthMode = 'sign_in' | 'sign_up' | 'forgot_password';

const MIN_PASSWORD = 6;

/**
 * Sign up / sign in / reset, one screen, three modes.
 *
 * Sign-up is the hero treatment: the rotating multilingual greeting at 56px
 * with its language name beneath, drifting ambient words behind it, and the
 * pre-auth work shown as something to save. Sign-in is the same shell at a
 * quieter scale — a 34px greeting and a "Welcome back" heading — because a
 * returning user wants the form, not the pitch.
 *
 * Design decisions that are load-bearing (see docs/strategy/conversion-research.md):
 * - ONE password field with a visibility toggle, never confirm-password (+56.3%).
 * - Primary CTA reads "Continue", never "Create Account" (+45% / +40.6% on the
 *   equivalent swaps).
 * - Apple/Google sit below the email pair, not above it, because a learner
 *   arriving from onboarding already has an identity in flight.
 * - The pending-onboarding summary is the reason this screen converts: by the
 *   time they reach it they have a level and an avatar, so the ask reads as
 *   saving their own work rather than as a gate.
 */
export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingOnboarding | null>(null);
  // Apple's button renders only where the native sheet actually exists (iOS 13+).
  // A social button that cannot work is worse than no button at all.
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [socialPending, setSocialPending] = useState<'apple' | 'google' | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPendingOnboarding()
      .then((draft) => {
        if (cancelled || !draft?.completedAt) return;
        setPending(draft);
        setMode('sign_up');
      })
      .catch((err) => console.error('loadPendingOnboarding failed on auth screen:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    isAppleSignInAvailable()
      .then((ok) => {
        if (!cancelled) setAppleAvailable(ok);
      })
      .catch(() => {
        /* leave the button hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Both providers land here. A dismissed sheet is silent — the learner
   * already knows they backed out — and everything else goes through the same
   * `authErrorCopy` the email path uses, so a disabled provider or a network
   * drop reads the same way everywhere on this screen.
   */
  const runSocial = async (provider: 'apple' | 'google') => {
    if (socialPending || loading) return;
    setSocialPending(provider);
    try {
      if (provider === 'apple') await signInWithApple();
      else await signInWithGoogle();
    } catch (err: unknown) {
      if (err instanceof SocialAuthCancelled) return;
      const { title, message } = authErrorCopy(err);
      Alert.alert(title, message);
    } finally {
      setSocialPending(null);
    }
  };

  const isSignUp = mode === 'sign_up';
  const isSignIn = mode === 'sign_in';
  const isForgot = mode === 'forgot_password';
  const showPendingSummary = !!pending && isSignUp;

  const pendingLanguage = pending?.targetLanguage
    ? SUPPORTED_LANGUAGES.find((l) => l.code === pending.targetLanguage)?.name
    : null;

  const handleSubmit = async () => {
    if (!email.trim()) return;

    if (isForgot) {
      setLoading(true);
      try {
        await resetPassword(email.trim());
        Alert.alert('Check your email', 'We sent you a password reset link.');
        setMode('sign_in');
      } catch (err: unknown) {
        const { title, message } = authErrorCopy(err);
        Alert.alert(title, message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (password.length < MIN_PASSWORD) {
      Alert.alert('Password too short', `Use at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setLoading(true);
    try {
      if (isSignIn) await signInWithEmail(email.trim(), password);
      else await signUpWithEmail(email.trim(), password);
    } catch (err: unknown) {
      const { title, message } = authErrorCopy(err);
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setPassword('');
    setMode(isSignUp ? 'sign_in' : 'sign_up');
  };

  const ctaLabel = isForgot ? 'Send reset link' : isSignUp ? 'Continue' : 'Sign in';
  const submitDisabled =
    !email.trim() || (!isForgot && password.length < MIN_PASSWORD) || loading;

  return (
    <GradientBackground>
      <AmbientGreetings />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Scrolls rather than centring: at the larger Dynamic Type sizes the
              hero, pending card, two fields, CTA, social row and mode switch are
              taller than a small phone. */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xl }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ---------- Hero ---------- */}
            {isSignUp && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: 54, alignItems: 'center' }}>
                <RotatingGreeting size={56} showLanguage align="center" />
                <Text
                  style={{
                    fontFamily: typography.family.medium,
                    fontSize: 15,
                    lineHeight: 23,
                    color: colors.text.secondary,
                    textAlign: 'center',
                    marginTop: spacing.lg + 2,
                  }}
                >
                  Actually learn a language.{'\n'}Actually enjoy it.
                </Text>
              </View>
            )}

            {isSignIn && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: 64 }}>
                <RotatingGreeting size={34} color={colors.action.accent} align="left" />
                <Text
                  accessibilityRole="header"
                  style={{
                    fontFamily: typography.family.serif,
                    fontSize: 32,
                    lineHeight: 39,
                    letterSpacing: -0.6,
                    color: colors.text.primary,
                    marginTop: spacing.xs + 2,
                  }}
                >
                  Welcome back.
                </Text>
                <Text
                  style={{
                    fontFamily: typography.family.medium,
                    fontSize: 14,
                    lineHeight: 21,
                    color: colors.text.tertiary,
                    marginTop: spacing.xs + 2,
                  }}
                >
                  Your streak is where you left it.
                </Text>
              </View>
            )}

            {isForgot && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: 64 }}>
                <Text
                  accessibilityRole="header"
                  style={{
                    fontFamily: typography.family.serif,
                    fontSize: 32,
                    lineHeight: 39,
                    letterSpacing: -0.6,
                    color: colors.text.primary,
                  }}
                >
                  Reset your{'\n'}password.
                </Text>
                <Text
                  style={{
                    fontFamily: typography.family.medium,
                    fontSize: 14,
                    lineHeight: 21,
                    color: colors.text.tertiary,
                    marginTop: spacing.sm + 2,
                  }}
                >
                  Enter your email and we&apos;ll send a reset link. Your progress is untouched.
                </Text>
              </View>
            )}

            {/* ---------- What they stand to lose ---------- */}
            {showPendingSummary && (
              <View
                style={{
                  marginHorizontal: spacing.lg,
                  marginTop: spacing.lg,
                  padding: spacing.md,
                  borderRadius: radii.xl,
                  backgroundColor: colors.surface.raised,
                  borderWidth: 1,
                  borderColor: 'rgba(129,140,248,0.35)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                }}
              >
                <Avatar config={pending?.avatarConfig ?? undefined} size="medium" expression="happy" />
                <View style={{ flex: 1 }}>
                  {pending?.displayName ? (
                    <Text
                      style={{
                        fontFamily: typography.family.bold,
                        fontSize: 17,
                        color: colors.text.primary,
                      }}
                    >
                      {pending.displayName}
                    </Text>
                  ) : null}
                  {pendingLanguage ? (
                    <Text
                      style={{
                        fontFamily: typography.family.medium,
                        fontSize: 13,
                        color: colors.text.tertiary,
                        marginTop: 1,
                      }}
                    >
                      {pendingLanguage}
                    </Text>
                  ) : null}
                  {pending?.placement ? (
                    <Text
                      style={{
                        fontFamily: typography.family.mono,
                        fontSize: 10,
                        letterSpacing: 1.3,
                        color: colors.action.accent,
                        marginTop: spacing.xs,
                      }}
                    >
                      {`${LEVEL_LABELS[pending.placement.suggestedLevel].toUpperCase()} · ${pending.placement.correctCount}/${pending.placement.totalCount} ON YOUR PLACEMENT`}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* ---------- Form ---------- */}
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm + 2,
                  height: 58,
                  paddingHorizontal: spacing.md + 2,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surface.card,
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                }}
              >
                <Ionicons name="mail-outline" size={17} color={colors.text.tertiary} />
                <TextInput
                  style={{
                    flex: 1,
                    fontFamily: typography.family.medium,
                    fontSize: 15,
                    color: colors.text.primary,
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.text.quaternary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  accessibilityLabel="Email address"
                />
                {/* Confirms the address parsed, so the learner isn't left
                    wondering after a typo'd submit. */}
                {email.includes('@') && email.includes('.') && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.success.base} />
                )}
              </View>

              {!isForgot && (
                <View style={{ marginTop: spacing.sm + 2 }}>
                  <PasswordField
                    value={password}
                    onChangeText={setPassword}
                    showStrength={isSignUp}
                    placeholder={isSignUp ? 'Create a password' : 'Password'}
                    isNew={isSignUp}
                    onSubmitEditing={submitDisabled ? undefined : handleSubmit}
                  />
                </View>
              )}

              <View style={{ marginTop: spacing.md }}>
                <Button label={ctaLabel} onPress={handleSubmit} disabled={submitDisabled} loading={loading} />
              </View>

              {isSignIn && (
                <Pressable
                  onPress={() => setMode('forgot_password')}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password"
                  style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: spacing.sm }}
                >
                  <Text
                    style={{
                      fontFamily: typography.family.semibold,
                      fontSize: 13,
                      color: colors.action.accent,
                    }}
                  >
                    Forgot password?
                  </Text>
                </Pressable>
              )}

              {/* ---------- Social ----------
                  Both wired through lib/social-auth. Apple renders only where
                  its native sheet exists, so the row collapses to Google alone
                  on Android rather than showing a button that cannot work. */}
              {!isForgot && (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm + 2,
                      marginTop: spacing.lg,
                    }}
                  >
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border.subtle }} />
                    <Text
                      style={{
                        fontFamily: typography.family.mono,
                        fontSize: 10,
                        letterSpacing: 1.6,
                        color: colors.text.tertiary,
                      }}
                    >
                      OR
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border.subtle }} />
                  </View>

                  <View style={{ flexDirection: 'row', gap: spacing.xs + 2, marginTop: spacing.lg }}>
                    {appleAvailable && (
                    <Pressable
                      onPress={() => runSocial('apple')}
                      disabled={socialPending !== null || loading}
                      accessibilityRole="button"
                      accessibilityLabel="Continue with Apple"
                      accessibilityState={{ disabled: socialPending !== null || loading, busy: socialPending === 'apple' }}
                      style={{
                        flex: 1,
                        opacity: socialPending === 'google' ? 0.5 : 1,
                        height: 54,
                        borderRadius: radii.md,
                        backgroundColor: colors.text.primary,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing.xs + 2,
                      }}
                    >
                      <Ionicons name="logo-apple" size={18} color={colors.surface.base} />
                      <Text
                        style={{
                          fontFamily: typography.family.bold,
                          fontSize: 14,
                          color: colors.surface.base,
                        }}
                      >
                        {socialPending === 'apple' ? 'Signing in…' : 'Apple'}
                      </Text>
                    </Pressable>
                    )}
                    <Pressable
                      onPress={() => runSocial('google')}
                      disabled={socialPending !== null || loading}
                      accessibilityRole="button"
                      accessibilityLabel="Continue with Google"
                      accessibilityState={{ disabled: socialPending !== null || loading, busy: socialPending === 'google' }}
                      style={{
                        flex: 1,
                        opacity: socialPending === 'apple' ? 0.5 : 1,
                        height: 54,
                        borderRadius: radii.md,
                        backgroundColor: colors.surface.card,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing.xs + 2,
                      }}
                    >
                      <Ionicons name="logo-google" size={17} color={colors.action.accent} />
                      <Text
                        style={{
                          fontFamily: typography.family.bold,
                          fontSize: 14,
                          color: colors.text.primary,
                        }}
                      >
                        {socialPending === 'google' ? 'Signing in…' : 'Google'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>

            <View style={{ flex: 1, minHeight: spacing.xl }} />

            {/* ---------- Mode switch ---------- */}
            <Pressable
              onPress={isForgot ? () => setMode('sign_in') : switchMode}
              accessibilityRole="button"
              accessibilityLabel={
                isForgot ? 'Back to sign in' : isSignUp ? 'Sign in instead' : 'Create an account'
              }
              style={{
                alignItems: 'center',
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: spacing.lg,
              }}
            >
              <Text
                style={{
                  fontFamily: typography.family.medium,
                  fontSize: 13,
                  color: colors.text.tertiary,
                }}
              >
                {isForgot ? 'Remembered it? ' : isSignUp ? 'Already have an account? ' : 'New to Fluenci? '}
                <Text style={{ fontFamily: typography.family.bold, color: colors.action.accent }}>
                  {isForgot ? 'Back to sign in' : isSignUp ? 'Sign in' : 'Create an account'}
                </Text>
              </Text>
            </Pressable>

            {isSignUp && (
              <Text
                style={{
                  fontFamily: typography.family.medium,
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.text.tertiary,
                  textAlign: 'center',
                  marginTop: spacing.sm + 2,
                }}
              >
                Free to start. No card required.
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}
