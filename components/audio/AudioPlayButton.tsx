import { useEffect } from 'react';
import { Pressable, Text, ActivityIndicator, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { colors } from '../../config/theme';

interface AudioPlayButtonProps {
  audioUrl: string;
  size?: number;
}

/**
 * Reusable play/pause button for audio clips.
 * Used in exercises, card reviews, and AI practice.
 */
export function AudioPlayButton({ audioUrl, size = 48 }: AudioPlayButtonProps) {
  const { play, stop, playing, loading, error } = useAudioPlayer();

  // Playback failure feedback — error haptic; the button flips to an
  // alert state ("!") and pressing it again retries.
  useEffect(() => {
    if (error && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [error]);

  const handlePress = async () => {
    if (playing) {
      await stop();
    } else {
      await play(audioUrl);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: error ? colors.error.base : colors.action.primaryFill,
        justifyContent: 'center',
        alignItems: 'center',
      }}
      accessibilityRole="button"
      accessibilityLabel={
        error
          ? 'Audio failed to play. Tap to retry.'
          : playing
            ? 'Pause audio'
            : 'Play audio'
      }
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>
          {error ? '!' : playing ? '||' : '▶'}
        </Text>
      )}
    </Pressable>
  );
}
