import { Stack } from 'expo-router';

/**
 * The profile tab is a stack. Without an initial route, a sub-screen reached
 * from ANOTHER tab (`router.push('/(app)/profile/subscription')` from chat,
 * a book, the tutor) is the only thing on this stack: its back chevron finds
 * nothing to pop, `useSafeBack` replaces to Home, and the sub-screen stays
 * sitting on top of the profile stack — so the next tap on Profile shows it
 * again, forever. Naming the index as the initial route makes expo-router put
 * it underneath, so back pops to the profile like it does from the profile.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
