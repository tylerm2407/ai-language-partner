import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Pressable } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import { useUi2Theme, type Ui2Theme } from '../../hooks/useUi2Theme';
import { Body, Heading } from '../ui2/Ui2Text';

/**
 * Hook bridge for the fallback UI.
 *
 * `ErrorBoundary` has to be a class — `getDerivedStateFromError` /
 * `componentDidCatch` have no hook equivalent — and a class cannot call
 * `useUi2Theme()`. Rather than lift the fallback markup out into its own
 * component (which would move `handleRetry` / `handleReload` through props and
 * make an unrelated refactor out of a re-theme), the palette is handed in
 * through a render prop. Written as an arrow const on purpose: it is a local
 * detail, not part of this module's API.
 */
const Ui2Themed = ({ children }: { children: (theme: Ui2Theme) => ReactNode }) => {
  const theme = useUi2Theme();
  return <>{children(theme)}</>;
};

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
        <Ui2Themed>
          {({ c, shape }) => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: c.bg }}>
              <Heading level={1} style={{ marginBottom: 8 }}>Something went wrong</Heading>
              <Body tone="secondary" style={{ textAlign: 'center', marginBottom: 24 }}>
                An unexpected error occurred. Please try again.
              </Body>
              <Pressable
                style={{ backgroundColor: c.primary, borderBottomColor: c.slab, borderBottomWidth: shape.buttonSlab, borderRadius: shape.radiusButton, paddingVertical: 16, paddingHorizontal: 48 }}
                onPress={this.handleRetry}
                accessibilityRole="button"
                accessibilityLabel="Try again"
              >
                <Body size="lg" weight="extrabold" tone="onPrimary">Try Again</Body>
              </Pressable>
              <Pressable
                style={{ paddingVertical: 16, paddingHorizontal: 48 }}
                onPress={this.handleReload}
                accessibilityRole="button"
                accessibilityLabel="Restart the app"
              >
                <Body weight="bold" tone="secondary">Restart the app</Body>
              </Pressable>
            </View>
          )}
        </Ui2Themed>
      );
    }

    return this.props.children;
  }
}
