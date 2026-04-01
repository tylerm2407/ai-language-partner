import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TreasureNodeProps {
  isOpen: boolean;
}

export function TreasureNode({ isOpen }: TreasureNodeProps) {
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isOpen ? 'rgba(251, 191, 36, 0.15)' : 'rgba(51, 58, 72, 0.3)',
      }}
    >
      <Ionicons
        name={isOpen ? 'gift' : 'gift-outline'}
        size={28}
        color={isOpen ? '#FBBF24' : '#333A48'}
      />
    </View>
  );
}
