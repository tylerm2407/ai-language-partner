import React from 'react';
import { View, Text, Pressable, Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../ui/GlassSurface';

interface InviteCodeDisplayProps {
  code: string;
  active: boolean;
  onRegenerate?: () => void;
}

export default function InviteCodeDisplay({ code, active, onRegenerate }: InviteCodeDisplayProps) {
  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my class on Fluenci! Use invite code: ${code}`,
      });
    } catch (_) {
      // User cancelled or share failed silently
    }
  };

  return (
    <GlassSurface innerStyle={{ padding: 20 }}>
      {/* Active / Inactive indicator */}
      <View className="flex-row items-center mb-3">
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: active ? '#22C55E' : '#64748B',
            marginRight: 6,
          }}
        />
        <Text
          style={{
            color: active ? '#22C55E' : '#64748B',
            fontSize: 12,
            fontFamily: 'Inter_500Medium',
          }}
        >
          {active ? 'Active' : 'Inactive'}
        </Text>
      </View>

      {/* Code display */}
      <View
        style={{
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 20,
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 28,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            letterSpacing: 4,
          }}
          selectable
          accessibilityLabel={`Invite code: ${code.split('').join(' ')}`}
        >
          {code}
        </Text>
      </View>

      {/* Action buttons */}
      <View className="flex-row items-center justify-center" style={{ gap: 12 }}>
        <Pressable
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityLabel="Copy invite code"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Ionicons name="copy-outline" size={16} color="#6366F1" />
          <Text
            style={{
              color: '#6366F1',
              fontSize: 14,
              fontFamily: 'Inter_600SemiBold',
              marginLeft: 6,
            }}
          >
            Copy
          </Text>
        </Pressable>

        <Pressable
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share invite code"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Ionicons name="share-outline" size={16} color="#6366F1" />
          <Text
            style={{
              color: '#6366F1',
              fontSize: 14,
              fontFamily: 'Inter_600SemiBold',
              marginLeft: 6,
            }}
          >
            Share
          </Text>
        </Pressable>

        {onRegenerate && (
          <Pressable
            onPress={onRegenerate}
            accessibilityRole="button"
            accessibilityLabel="Regenerate invite code"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Ionicons name="refresh-outline" size={16} color="#EF4444" />
            <Text
              style={{
                color: '#EF4444',
                fontSize: 14,
                fontFamily: 'Inter_600SemiBold',
                marginLeft: 6,
              }}
            >
              Regenerate
            </Text>
          </Pressable>
        )}
      </View>
    </GlassSurface>
  );
}
