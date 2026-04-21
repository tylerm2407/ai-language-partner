import React, { useRef, useCallback, useEffect } from 'react';
import { StyleSheet, View, Animated, type ViewStyle } from 'react-native';
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';

const galaxyVideo = require('../../assets/galaxy-bg.mp4');

const CROSSFADE_MS = 1500;

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GradientBackground({ children, style }: GradientBackgroundProps) {
  const videoA = useRef<Video>(null);
  const videoB = useRef<Video>(null);
  const opacityA = useRef(new Animated.Value(1)).current;
  const opacityB = useRef(new Animated.Value(0)).current;
  const activeRef = useRef<'A' | 'B'>('A');
  const transitioningRef = useRef(false);
  // Guard async video method calls that fire after unmount (common during
  // auth/nav transitions mid-crossfade). expo-av throws "Video component has
  // not yet loaded" when the native backing is already disposed.
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  const handleStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!mountedRef.current) return;
    if (!status.isLoaded || transitioningRef.current) return;
    const { durationMillis, positionMillis } = status;
    if (!durationMillis || positionMillis < durationMillis - CROSSFADE_MS) return;

    transitioningRef.current = true;

    const isA = activeRef.current === 'A';
    const incomingVideo = isA ? videoB.current : videoA.current;
    const outgoingVideo = isA ? videoA.current : videoB.current;
    const fadeIn = isA ? opacityB : opacityA;
    const fadeOut = isA ? opacityA : opacityB;

    incomingVideo
      ?.setPositionAsync(0)
      .then(() => {
        if (!mountedRef.current) return;
        return incomingVideo?.playAsync();
      })
      .catch(() => { /* video unmounted mid-transition — harmless */ });

    Animated.parallel([
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: CROSSFADE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: CROSSFADE_MS,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (!mountedRef.current) return;
      outgoingVideo?.pauseAsync().catch(() => { /* unmounted — harmless */ });
      activeRef.current = isA ? 'B' : 'A';
      transitioningRef.current = false;
    });
  }, [opacityA, opacityB]);

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityA }]} pointerEvents="none">
        <Video
          ref={videoA}
          source={galaxyVideo}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isMuted
          onPlaybackStatusUpdate={handleStatusUpdate}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityB }]} pointerEvents="none">
        <Video
          ref={videoB}
          source={galaxyVideo}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isMuted
        />
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060610',
  },
});
