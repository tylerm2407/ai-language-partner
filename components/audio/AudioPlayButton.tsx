import { useEffect } from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface AudioPlayButtonProps {
  audioUrl: string;
  size?: number;
}

/**
 * Reusable play/pause button for audio clips.
 * Used in exercises, card reviews, and AI practice.
 */
export function AudioPlayButton({ audioUrl, size = 48 }: AudioPlayButtonProps) {
  const { c } = useUi2Theme();
  const { play, stop, playing, loading, error } = useAudioPlayer();

  // Playback failure feedback — error haptic; the button flips to an
  // alert state ("!") and pressing it again retries.
  useEffect(() => {
    if (error) haptic('failure');
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
        backgroundColor: error ? c.error : c.primary,
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
        <ActivityIndicator color={c.onPrimary} size="small" />
      ) : (
        <Text style={{ color: c.onPrimary, fontSize: size * 0.4, fontWeight: '700' }}>
          {error ? '!' : playing ? '||' : '▶'}
        </Text>
      )}
    </Pressable>
  );
}
