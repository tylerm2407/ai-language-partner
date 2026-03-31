import { View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  variant?: 'standard' | 'exercise';
  style?: ViewStyle;
}

const variantClasses = {
  standard: 'bg-dark-card rounded-2xl p-5 shadow-card border border-dark-border',
  exercise: 'bg-dark-card rounded-[20px] p-6 min-h-[200px] shadow-card border border-dark-border',
};

export function Card({ children, variant = 'standard', style }: CardProps) {
  return (
    <View className={variantClasses[variant]} style={style}>
      {children}
    </View>
  );
}
