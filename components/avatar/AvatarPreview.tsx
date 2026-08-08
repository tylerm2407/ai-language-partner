import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AvatarConfig } from '../../types';
import { Avatar } from './Avatar';

interface AvatarPreviewProps {
  config: AvatarConfig;
}

export const AvatarPreview = React.memo(({ config }: AvatarPreviewProps) => {
  return (
    <View style={styles.container}>
      <Avatar config={config} size="large" expression="neutral" animated />
    </View>
  );
});

AvatarPreview.displayName = 'AvatarPreview';

const styles = StyleSheet.create({
  container: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#151921',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
