import { Pressable, Text, ActivityIndicator } from 'react-native';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';

interface AudioPlayButtonProps {
  audioUrl: string;
  size?: number;
}

/**
 * Reusable play/pause button for audio clips.
 * Used in exercises, card reviews, and AI practice.
 */
export function AudioPlayButton({ audioUrl, size = 48 }: AudioPlayButtonProps) {
  const { play, stop, playing, loading } = useAudioPlayer();

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
        backgroundColor: '#6366F1',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause audio' : 'Play audio'}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>
          {playing ? '||' : '\u25B6'}
        </Text>
      )}
    </Pressable>
  );
}
