import { Stack } from 'expo-router';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';

export default function PublicLayout() {
  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }} />
    </ErrorBoundary>
  );
}
