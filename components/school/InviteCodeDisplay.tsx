import React from 'react';
import { View, Text, Pressable, Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../ui2/SlabCard';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface InviteCodeDisplayProps {
  code: string;
  active: boolean;
  onRegenerate?: () => void;
}

export default function InviteCodeDisplay({ code, active, onRegenerate }: InviteCodeDisplayProps) {
  const { c } = useUi2Theme();
  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my class on Fluenci! Use invite code: ${code}`,
      });
    } catch {
      // User cancelled or share failed silently
    }
  };

  return (
    <SlabCard style={{ padding: 20 }}>
      {/* Active / Inactive indicator */}
      <View className="flex-row items-center mb-3">
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: active ? c.green : c.idle,
            marginRight: 6,
          }}
        />
        <Text
          style={{
            color: active ? c.ink : c.muted,
            fontSize: 12,
            fontFamily: 'Manrope_500Medium',
          }}
        >
          {active ? 'Active' : 'Inactive'}
        </Text>
      </View>

      {/* Code display */}
      <View
        style={{
          borderWidth: 1,
          borderColor: c.cardBorder,
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 20,
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: c.ink,
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
            backgroundColor: c.primaryTint,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Ionicons name="copy-outline" size={16} color={c.onTint} />
          <Text
            style={{
              color: c.onTint,
              fontSize: 14,
              fontFamily: 'Manrope_600SemiBold',
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
            backgroundColor: c.primaryTint,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Ionicons name="share-outline" size={16} color={c.onTint} />
          <Text
            style={{
              color: c.onTint,
              fontSize: 14,
              fontFamily: 'Manrope_600SemiBold',
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
              backgroundColor: c.pinkTint,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Ionicons name="refresh-outline" size={16} color={c.error} />
            <Text
              style={{
                color: c.error,
                fontSize: 14,
                fontFamily: 'Manrope_600SemiBold',
                marginLeft: 6,
              }}
            >
              Regenerate
            </Text>
          </Pressable>
        )}
      </View>
    </SlabCard>
  );
}
