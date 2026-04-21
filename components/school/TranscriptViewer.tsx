import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { ChatBubble } from '../chat/ChatBubble';
import type { ConversationMessage } from '../../types';

interface TranscriptViewerProps {
  messages: ConversationMessage[];
  targetLanguage: string;
}

export default function TranscriptViewer({ messages, targetLanguage }: TranscriptViewerProps) {
  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <Text
        style={{
          color: '#94A3B8',
          fontSize: 13,
          fontFamily: 'Inter_600SemiBold',
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
