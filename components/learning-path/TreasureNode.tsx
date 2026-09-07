import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface TreasureNodeProps {
  isOpen: boolean;
}

export function TreasureNode({ isOpen }: TreasureNodeProps) {
  const { c } = useUi2Theme();

  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        // The two rgba fills were a 15% gold wash and a 30% slate wash over a
        // dark ground. The tint tokens are the same idea resolved per scheme.
        backgroundColor: isOpen ? c.yellowTint : c.track,
      }}
    >
      <Ionicons
        name={isOpen ? 'gift' : 'gift-outline'}
        size={28}
        color={isOpen ? c.yellow : c.idle}
      />
    </View>
  );
}
