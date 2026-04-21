import { useState, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { getTextToSpeech, VoiceError } from '../../lib/ai';
import type { ConversationMessage } from '../../types';

interface ChatBubbleProps {
  message: ConversationMessage;
  targetLanguage?: string;
  userId?: string;
}

/** Render message content with **bold** words highlighted as vocabulary. */
function HighlightedContent({ text, isUser }: { text: string; isUser: boolean }) {
  // Split on **word** patterns, keeping the delimiters
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <Text className={isUser ? 'text-white text-base' : 'text-text-primary text-base'}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const word = part.slice(2, -2);
          return (
            <Text
              key={index}
              className="font-bold"
              style={!isUser ? { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderRadius: 4 } : undefined}
            >
              {word}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Cache audio URIs by message ID to avoid re-fetching
const audioCache = new Map<string, Audio.Sound>();

export function ChatBubble({ message, targetLanguage, userId }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const handleSpeak = async () => {
    // If already playing, stop
    if (isPlaying && soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
      return;
    }

    // Check cache first
    const cached = audioCache.get(message.id);
    if (cached) {
      soundRef.current = cached;
      setIsPlaying(true);
      await cached.replayAsync();
      cached.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      return;
    }

    setIsLoadingAudio(true);
    try {
      const base64 = await getTextToSpeech(
        message.content,
        targetLanguage ?? 'en',
        userId
      );
      const dataUri = `data:audio/mpeg;base64,${base64}`;

      const { sound } = await Audio.Sound.createAsync({ uri: dataUri });
      soundRef.current = sound;
      audioCache.set(message.id, sound);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });

      setIsPlaying(true);
      await sound.playAsync();
    } catch (err) {
      console.error('TTS playback failed:', err);
      const message = err instanceof VoiceError
        ? err.code === 'DAILY_LIMIT'
          ? "You've reached your daily voice limit. Upgrade your plan for more."
          : err.code === 'NOT_CONFIGURED'
            ? 'Voice features are not yet configured. Please try again later.'
            : 'Voice features are temporarily unavailable. You can continue using text.'
        : 'Voice features are temporarily unavailable. You can continue using text.';
      Alert.alert('Voice Unavailable', message, [{ text: 'OK' }]);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <View className={`mb-2 max-w-[82%] ${isUser ? 'self-end' : 'self-start'}`}>
      <View
        className={`p-[14px] ${
          isUser
            ? 'bg-primary rounded-[18px] rounded-br-[4px]'
            : 'bg-dark-card rounded-[18px] rounded-bl-[4px]'
        }`}
        accessibilityLabel={`${isUser ? 'You' : 'Assistant'}: ${message.content}`}
      >
        <HighlightedContent text={message.content} isUser={isUser} />

        {/* Speaker button for assistant messages */}
        {!isUser && (
          <Pressable
            onPress={handleSpeak}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Stop audio' : 'Listen to this message'}
            className={`flex-row items-center mt-2 ${isPlaying ? 'bg-error-bg rounded-lg px-2 py-1' : ''}`}
            hitSlop={8}
          >
            {isLoadingAudio ? (
              <ActivityIndicator size="small" color="#7DD3FC" />
            ) : (
              <Ionicons
                name={isPlaying ? 'stop-circle' : 'volume-medium-outline'}
                size={isPlaying ? 20 : 16}
                color={isPlaying ? '#EF4444' : '#7DD3FC'}
              />
            )}
            <Text className="text-xs ml-1" style={{ color: '#C4B5FD' }}>
              {isLoadingAudio ? 'Loading...' : isPlaying ? 'Stop' : 'Listen'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Timestamp */}
      <Text className={`text-[10px] text-text-secondary mt-0.5 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
        {formatTimestamp(message.timestamp)}
      </Text>

      {message.correction && (
        <CorrectionBanner correction={message.correction} isUser={isUser} />
      )}
    </View>
  );
}

interface CorrectionBannerProps {
  correction: string;
  isUser: boolean;
}

export function CorrectionBanner({ correction, isUser }: CorrectionBannerProps) {
  return (
    <View className={`bg-error-bg rounded-xl p-3 mt-1 ${isUser ? 'self-end' : 'self-start'}`}>
      <Text className="text-xs font-semibold text-error-dark mb-1">Correction</Text>
      <Text className="text-sm text-error-dark">{correction}</Text>
    </View>
  );
}
