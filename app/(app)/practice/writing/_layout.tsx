import { Stack } from 'expo-router';

export default function WritingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[promptId]" />
      <Stack.Screen name="history" />
    </Stack>
  );
}
