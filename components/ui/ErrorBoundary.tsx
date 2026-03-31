import { Component, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';

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

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
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
        </View>
      );
    }

    return this.props.children;
  }
}
