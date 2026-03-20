import { Stack } from 'expo-router';

export default function PracticeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="voice" />
      <Stack.Screen name="driving" />
      <Stack.Screen name="review" />
      <Stack.Screen name="scenarios" />
      <Stack.Screen name="voices" />
      <Stack.Screen name="writing" />
      <Stack.Screen name="pronunciation" />
      <Stack.Screen name="pronunciation-history" />
    </Stack>
  );
}
