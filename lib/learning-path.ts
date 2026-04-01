import type { Lesson, Unit } from '../types';

export type PathNodeType = 'lesson' | 'section_banner' | 'treasure';
export type PathNodeState = 'completed' | 'active' | 'locked';

export interface PathItem {
  type: PathNodeType;
  // For lesson nodes
  lesson?: Lesson;
  // For section banners
  unitTitle?: string;
  unitIndex?: number;
  sectionIndex?: number;
  // For treasure nodes
  sectionComplete?: boolean;
  // Layout
  x: number; // 0-1 fraction of screen width
  y: number; // absolute y position in pixels
  state: PathNodeState;
}

interface UnitWithLessons {
  unit: Unit;
  lessons: Lesson[];
}

type GetStateFn = (lessonId: string, allIds: string[]) => PathNodeState;

// Sinusoidal x positions: center -> right -> center -> left -> center -> right ...
const X_PATTERN = [0.5, 0.75, 0.5, 0.25] as const;

const VERTICAL_SPACING = 120;

/**
 * Generate a flat list of PathItems laid out in a winding snake pattern.
 *
 * @param unitData - Array of { unit, lessons } sorted by unit.orderIndex, lessons sorted by lesson.orderIndex
 * @param getState - Function returning 'completed' | 'active' | 'locked' for a given lessonId
 */
export function generatePathLayout(
  unitData: UnitWithLessons[],
  getState: GetStateFn
): PathItem[] {
  // Build flat ordered list of all lesson IDs for state resolution
  const allLessonIds: string[] = [];
  for (const { lessons } of unitData) {
    for (const lesson of lessons) {
      allLessonIds.push(lesson.id);
    }
  }

  const items: PathItem[] = [];
  let nodeIndex = 0; // global index for x-pattern cycling (only lesson nodes advance the pattern)
  let yPosition = 40; // start with some top padding

  for (let unitIdx = 0; unitIdx < unitData.length; unitIdx++) {
    const { unit, lessons } = unitData[unitIdx];

    // Section banner — centered
    const bannerState = determineSectionState(lessons, allLessonIds, getState);
    items.push({
      type: 'section_banner',
      unitTitle: unit.title,
      unitIndex: unitIdx,
      sectionIndex: unitIdx + 1,
      x: 0.5,
      y: yPosition,
      state: bannerState,
    });
    yPosition += VERTICAL_SPACING;

    // Lesson nodes
    for (const lesson of lessons) {
      const xFraction = X_PATTERN[nodeIndex % X_PATTERN.length];
      const state = getState(lesson.id, allLessonIds);

      items.push({
        type: 'lesson',
        lesson,
        x: xFraction,
        y: yPosition,
        state,
      });

      nodeIndex++;
      yPosition += VERTICAL_SPACING;
    }

    // Treasure node — centered
    const allComplete = lessons.every(
      (l) => getState(l.id, allLessonIds) === 'completed'
    );
    items.push({
      type: 'treasure',
      sectionComplete: allComplete,
      x: 0.5,
      y: yPosition,
      state: allComplete ? 'completed' : 'locked',
    });
    yPosition += VERTICAL_SPACING;
  }

  return items;
}

/**
 * Determine the overall state for a section banner based on its lessons.
 */
function determineSectionState(
  lessons: Lesson[],
  allLessonIds: string[],
  getState: GetStateFn
): PathNodeState {
  const states = lessons.map((l) => getState(l.id, allLessonIds));
  if (states.every((s) => s === 'completed')) return 'completed';
  if (states.some((s) => s === 'active' || s === 'completed')) return 'active';
  return 'locked';
}

/**
 * Get the icon name for a lesson based on its position in the overall sequence.
 */
export function getLessonIcon(globalIndex: number): string {
  if ((globalIndex + 1) % 5 === 0) return 'headphones';
  if ((globalIndex + 1) % 4 === 0) return 'layers';
  if ((globalIndex + 1) % 3 === 0) return 'mic';
  return 'star';
}
