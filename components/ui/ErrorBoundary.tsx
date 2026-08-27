import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, {
      contexts: {
        react: { componentStack: errorInfo.componentStack ?? null },
      },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  /**
   * Last resort for a DETERMINISTIC render error.
   *
   * "Try Again" only clears the error state and re-renders the same children
   * with the same props, so anything that throws every time lands straight back
   * here. This boundary wraps all four route groups — including the one around
   * the tab tree — so when that happens the tab bar is gone too and there is no
   * way out of the app but a force-quit.
   *
   * A reload rebuilds from the entry point, which is the only thing that
   * actually escapes.
   */
  handleReload = () => {
    Updates.reloadAsync().catch(() => {
      // Dev client, or reload unavailable in this build — clearing the error
      // is all that is left, and is what the button did before.
      this.setState({ hasError: false, error: null });
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View className="flex-1 items-center justify-center px-8 bg-dark">
          <Text className="text-2xl font-sans-bold text-text-primary mb-2">Something went wrong</Text>
          <Text className="text-base font-sans text-text-secondary text-center mb-6">
            An unexpected error occurred. Please try again.
          </Text>
          <Pressable
            className="bg-primary py-4 px-12 rounded-[14px]"
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text className="text-white text-lg font-semibold">Try Again</Text>
          </Pressable>
          <Pressable
            className="py-4 px-12"
            onPress={this.handleReload}
            accessibilityRole="button"
            accessibilityLabel="Restart the app"
          >
            <Text className="text-text-secondary text-base font-semibold">Restart the app</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
