import { Stack } from 'expo-router';

/**
 * The learn tab is a stack. Same trap as the profile stack (see its layout):
 * the review screen is reached from OTHER tabs — Home's due-cards card, the
 * chat debrief, the patterns screen — and without an initial route it is the
 * only thing on this stack. Exit then found nothing to pop, `useSafeBack`
 * replaced to Home, and the review stayed on top of the learn stack, so the
 * next tap on Learn opened straight into the questions again. Naming the
 * index as the initial route puts it underneath, so Exit and Done pop to
 * Learn like they do when the review was opened from Learn.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function LearnLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
