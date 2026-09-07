/**
 * Version footer with a hidden Sentry smoke test.
 *
 * Renders "Fluenci v1.0.0 (3)" at the foot of Settings. A long press (1.5s)
 * offers to send a JS error or force a native crash, so a preview build on a
 * real device can prove that events reach the Sentry project and arrive with
 * symbolicated stacks (see docs: source maps upload from the Xcode bundle
 * phase, debug symbols from the "Upload Debug Symbols to Sentry" phase).
 *
 * The long press is armed only when EXPO_PUBLIC_APP_ENV is not "production"
 * (`shouldArmSmokeTest`), so the production binary shows the version and does
 * nothing else. It is still meant to be removed once Sentry is verified.
 *
 * `__DEV__` is deliberately not consulted: Sentry.init already disables the
 * SDK in dev, so firing here in a dev build is a harmless no-op.
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Alert, Pressable, Text } from 'react-native';
import { spacing } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { shouldArmSmokeTest, smokeTestLabel } from '../../lib/sentry-smoke';

const ARMED = shouldArmSmokeTest(process.env.EXPO_PUBLIC_APP_ENV);

export function SentrySmokeTrigger() {
  const { c } = useUi2Theme();
  const label = smokeTestLabel(Constants.expoConfig?.version, Constants.nativeBuildVersion);

  const onLongPress = () => {
    if (!ARMED) return;
    Alert.alert(
      'Sentry smoke test',
      'Send a test event to Sentry. The native crash closes the app; relaunch it so the report uploads.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send JS error',
          onPress: () => {
            Sentry.captureException(new Error('sentry smoke test: JS error'), {
              tags: { area: 'smoke-test' },
            });
            Alert.alert('Sent', 'Check the fluenci project in Sentry for "sentry smoke test".');
          },
        },
        {
          text: 'Native crash',
          style: 'destructive',
          onPress: () => Sentry.nativeCrash(),
        },
      ]
    );
  };

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={1500}
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{ alignItems: 'center', paddingVertical: spacing.lg }}
    >
      <Text style={{ color: c.idle, fontSize: 12, fontFamily: 'Nunito_500Medium' }}>{label}</Text>
    </Pressable>
  );
}
