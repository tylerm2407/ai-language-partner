import { Redirect, Stack } from 'expo-router';
import { SCHOOL_ENABLED } from '../../../config/app';

export default function AssignmentsLayout() {
  // Classroom features are deferred post-launch. These learner-facing assignment
  // routes sit inside (app), so the root route guard in app/_layout.tsx doesn't
  // bounce them — seal the whole segment here instead.
  if (!SCHOOL_ENABLED) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
