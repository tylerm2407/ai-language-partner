import { Stack } from 'expo-router';

/**
 * Stack passthrough for the voice-tutor tab, modelled on practice/_layout.tsx.
 *
 * Three screens, discovered from the directory rather than declared here: the
 * lobby (index), the live call pushed on top of it, and the debrief. The
 * debrief is a route rather than a mode of the call screen precisely so it
 * survives that screen unmounting — which is what happens when a call ends
 * badly, and exactly when the learner most wants to see what came out of it.
 *
 * `FloatingTabBar` hides itself while `tutor/call` is focused — see
 * FULL_SCREEN_ROUTES there. The debrief deliberately keeps the tab bar: the
 * call is over, and the learner should be able to leave in one tap.
 *
 * The swipe-back gesture stays enabled on the call screen. `call.tsx` handles
 * an unmount with the connection still live by ending the session, so leaving
 * that way is safe rather than something to prevent.
 */
export default function TutorLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
