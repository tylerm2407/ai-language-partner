import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { ChatBubble } from '../chat/ChatBubble';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { ConversationMessage } from '../../types';

interface TranscriptViewerProps {
  messages: ConversationMessage[];
  targetLanguage: string;
}

export default function TranscriptViewer({ messages, targetLanguage }: TranscriptViewerProps) {
  const { c } = useUi2Theme();
  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <Text
        style={{
          color: c.muted,
          fontSize: 13,
          fontFamily: 'Manrope_600SemiBold',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 12,
          paddingHorizontal: 4,
        }}
      >
        Transcript
      </Text>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatBubble
            message={item}
            targetLanguage={targetLanguage}
          />
        )}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Conversation transcript"
      />
    </View>
  );
}
