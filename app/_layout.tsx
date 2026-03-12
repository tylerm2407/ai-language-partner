import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';

/**
 * Root layout: gates navigation between (public) and (app) based on auth state.
 */
export default function RootLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inPublicGroup = segments[0] === '(public)';

    if (!user && !inPublicGroup) {
      // Not signed in → redirect to public landing
      router.replace('/(public)');
    } else if (user && inPublicGroup) {
      // Signed in → redirect to app home
      router.replace('/(app)');
    }
  }, [user, isLoading, segments]);

  return (
    <>
      <StatusBar style="auto" />
      <Slot />
    </>
  );
}
