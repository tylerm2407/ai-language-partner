import { Stack } from 'expo-router';

export default function LearnLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[lessonId]" />
      <Stack.Screen name="reading" />
    </Stack>
  );
}
