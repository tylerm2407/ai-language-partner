import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

// ── Main Component ────────────────────────────────────────────
interface AuroraBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function AuroraBackground({ children, style }: AuroraBackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Looping nebula video background */}
      <Video
        source={require('../../assets/nebula-bg.mp4')}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        // Prevent video from stealing focus / showing controls
        useNativeControls={false}
        pointerEvents="none"
      />

      {/* Content */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08081a',
  },
});
