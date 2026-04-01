import { useEffect, useRef, useMemo } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useLessonProgress } from '../../hooks/useLessonProgress';
import { generatePathLayout, getLessonIcon } from '../../lib/learning-path';
import { PathNode } from './PathNode';
import { PathConnector } from './PathConnector';
import { SectionBanner } from './SectionBanner';
import { TreasureNode } from './TreasureNode';
import type { Unit, Lesson } from '../../types';
import type { PathItem } from '../../lib/learning-path';

interface LearningPathProps {
  units: { unit: Unit; lessons: Lesson[] }[];
  courseId: string;
}

export function LearningPath({ units, courseId }: LearningPathProps) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { getLessonState, getScore, loading } = useLessonProgress(courseId);

  const pathItems = useMemo(() => {
    if (loading) return [];
    return generatePathLayout(units, getLessonState);
  }, [units, getLessonState, loading]);

  // Calculate total height
  const totalHeight = useMemo(() => {
    if (pathItems.length === 0) return 0;
    return pathItems[pathItems.length - 1].y + 160;
  }, [pathItems]);

  // Auto-scroll to active node on mount
  useEffect(() => {
    if (loading || pathItems.length === 0) return;
    const activeItem = pathItems.find(
      (item) => item.type === 'lesson' && item.state === 'active'
    );
    if (activeItem && scrollRef.current) {
      const scrollY = Math.max(0, activeItem.y - screenHeight / 3);
      // Small delay to ensure layout is measured
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: scrollY, animated: true });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, pathItems, screenHeight]);

  // Build lesson-only items for connector logic
  const lessonItems = useMemo(
    () => pathItems.filter((item) => item.type === 'lesson'),
    [pathItems]
  );

  // Track global lesson index for icon assignment
  let globalLessonIndex = 0;

  return (
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ height: totalHeight, position: 'relative' }}
    >
      {/* Render connectors between consecutive lesson nodes */}
      {lessonItems.map((item, idx) => {
        if (idx === 0) return null;
        const prev = lessonItems[idx - 1];
        const fromX = prev.x * screenWidth;
        const fromY = prev.y + 32; // bottom of previous node (64/2)
        const toX = item.x * screenWidth;
        const toY = item.y + 32; // center of current node
        const connectorState = item.state === 'completed' || prev.state === 'completed'
          ? 'completed'
          : 'locked';

        return (
          <PathConnector
            key={`conn-${idx}`}
            fromX={fromX}
            fromY={fromY}
            toX={toX}
            toY={toY}
            state={connectorState}
          />
        );
      })}

      {/* Render nodes */}
      {pathItems.map((item, idx) => {
        if (item.type === 'section_banner') {
          return (
            <View
              key={`banner-${idx}`}
              style={{
                position: 'absolute',
                top: item.y,
                left: 0,
                right: 0,
              }}
            >
              <SectionBanner
                sectionIndex={item.sectionIndex ?? 1}
                unitIndex={item.unitIndex ?? 0}
                title={item.unitTitle ?? ''}
              />
            </View>
          );
        }

        if (item.type === 'treasure') {
          return (
            <View
              key={`treasure-${idx}`}
              style={{
                position: 'absolute',
                top: item.y,
                left: item.x * screenWidth - 24, // center 48px node
                width: 48,
                height: 48,
              }}
            >
              <TreasureNode isOpen={item.sectionComplete ?? false} />
            </View>
          );
        }

        // Lesson node
        const lessonId = item.lesson?.id;
        if (!lessonId) return null;

        const currentLessonIndex = globalLessonIndex;
        globalLessonIndex++;

        const iconName = getLessonIcon(currentLessonIndex);
        const score = getScore(lessonId);

        return (
          <View
            key={`lesson-${lessonId}`}
            style={{
              position: 'absolute',
              top: item.y,
              left: item.x * screenWidth - 32, // center 64px node
              width: 64,
              height: 64,
            }}
          >
            <PathNode
              state={item.state}
              icon={iconName}
              score={score}
              isActive={item.state === 'active'}
              onPress={() => router.push(`/learn/${lessonId}` as any)}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}
