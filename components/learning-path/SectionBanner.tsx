import { Text, View } from 'react-native';
import { GradientBorderCard } from '../ui/GradientBorderCard';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface SectionBannerProps {
  sectionIndex: number;
  unitIndex: number;
  title: string;
}

export function SectionBanner({ sectionIndex, unitIndex, title }: SectionBannerProps) {
  const { c } = useUi2Theme();

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <GradientBorderCard>
        <View style={{ paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: c.ink,
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
