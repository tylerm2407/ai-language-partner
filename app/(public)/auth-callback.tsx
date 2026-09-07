import { ActivityIndicator, View } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';

/**
 * Landing route for the hosted OAuth redirect (`fluenci://auth-callback`).
 *
 * On iOS the auth session swallows the redirect and hands the URL straight
 * back to `signInWithGoogle`, so this screen never mounts. On Android the
 * same URL also reaches expo-router as a navigation, and without a matching
 * route it would flash the default "Unmatched Route" page while the session
 * is being set. This renders a quiet spinner instead; the root route guard
 * in app/_layout.tsx moves the learner on the moment the session lands.
 */
export default function AuthCallbackScreen() {
  const { c } = useUi2Theme();
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}
      accessibilityLabel="Finishing sign-in"
    >
      <ActivityIndicator color={c.primary} />
    </View>
  );
}
