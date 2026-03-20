import React from 'react';
import { PostHogProvider as PHProvider } from 'posthog-react-native';
import { posthog } from './analytics';

/**
 * Wraps the app with PostHog context for React-level analytics features
 * (autocapture, screen tracking, feature flags).
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog} autocapture={{ captureScreens: true, captureTouches: false }}>
      {children}
    </PHProvider>
  );
}
