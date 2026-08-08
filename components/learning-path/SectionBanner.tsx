import { Text, View } from 'react-native';
import { GradientBorderCard } from '../ui/GradientBorderCard';

interface SectionBannerProps {
  sectionIndex: number;
  unitIndex: number;
  title: string;
}

export function SectionBanner({ sectionIndex, unitIndex, title }: SectionBannerProps) {
  return (
    <View style={{ paddingHorizontal: 16 }}>
      <GradientBorderCard>
        <View style={{ paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: '#E2E8F0',
              textTransform: 'uppercase',
              letterSpacing: 1,
              textAlign: 'center',
            }}
          >
            SECTION {sectionIndex}, UNIT {unitIndex + 1} — {title}
          </Text>
        </View>
      </GradientBorderCard>
    </View>
  );
}
