/**
 * Render smoke tests for the Learn screen's Vocab-tab components.
 *
 * These assert the two things that are easy to break silently and impossible
 * to see in a type check: that every row state actually renders, and that each
 * one announces itself correctly to VoiceOver. The layout itself is verified on
 * device — this is the net under it.
 */

import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { LessonRow } from './LessonRow';
import { UnitCarousel } from './UnitCarousel';
import { CoursePills, TabPills } from './SelectorPills';
import { ReviewShortcut } from './ReviewShortcut';
import type { UnitProgress } from '../../lib/learn-progress';
import type { Course, Lesson, Unit } from '../../types';

// The icon set resolves its font asynchronously and setState()s afterwards,
// which lands after the test has already asserted. Nothing here depends on the
// glyph, so stand it down.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// UnitCarousel schedules a scrollToIndex a frame after mount. Under the test
// renderer there is no real scroll view behind it, so the timer must never run.
jest.useFakeTimers();

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

/** Host (not composite) nodes matching a predicate — a composite and the host
 *  it renders both carry the same props, so an unfiltered findAll doubles up. */
function hostNodes(
  renderer: TestRenderer.ReactTestRenderer,
  predicate: (node: ReactTestInstance) => boolean,
): ReactTestInstance[] {
  return renderer.root.findAll(
    (node: ReactTestInstance) => typeof node.type === 'string' && predicate(node),
    { deep: true },
  );
}

/** Every node carrying an accessibilityLabel, in tree order. */
function labels(renderer: TestRenderer.ReactTestRenderer): string[] {
  return hostNodes(renderer, (node) => typeof node.props?.accessibilityLabel === 'string').map(
    (node) => node.props.accessibilityLabel as string,
  );
}

/** Concatenated rendered text. */
function text(renderer: TestRenderer.ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
  };
  renderer.root
    .findAll((node: ReactTestInstance) => node.children.length > 0, { deep: true })
    .forEach((node) => walk(node.children));
  return out.join(' ');
}

const baseRowProps = {
  position: 3,
  title: 'Los números 1–20',
  isMilestone: false,
  score: null,
  xpReward: 20,
  estimatedMinutes: 5,
  onPress: () => {},
};

describe('LessonRow', () => {
  it('shows the score on a completed lesson', () => {
    const r = render(
      <LessonRow {...baseRowProps} state="completed" score={0.94} />,
    );
    expect(text(r)).toContain('94%');
    expect(labels(r)[0]).toBe('Lesson 3, Los números 1–20, completed, scored 94 percent');
  });

  it('falls back to DONE when a completion carries no score', () => {
    const r = render(<LessonRow {...baseRowProps} state="completed" score={null} />);
    expect(text(r)).toContain('DONE');
  });

  it('shows the GO call to action and meta on the active lesson', () => {
    const r = render(<LessonRow {...baseRowProps} state="active" />);
    const rendered = text(r);
    expect(rendered).toContain('GO');
    // Time, not points. XP is a server-side ledger the learner never sees, so
    // the row advertises the only cost that is real to them.
    expect(rendered).toContain('5 MIN');
    expect(rendered).not.toContain('XP');
    expect(labels(r)[0]).toBe('Lesson 3, Los números 1–20, next up, 5 minutes');
  });

  it('offers no reward on a locked lesson and blocks the tap', () => {
    const onPress = jest.fn();
    const r = render(<LessonRow {...baseRowProps} state="locked" onPress={onPress} />);

    // A locked row used to dangle "+20 XP" as the reason to come back. There is
    // no points economy to dangle any more.
    expect(text(r)).not.toContain('XP');

    const row = hostNodes(r, (node) => node.props?.accessibilityState?.disabled === true);
    expect(row.length).toBeGreaterThan(0);
    expect(row[0].props.accessibilityHint).toMatch(/Locked/);
  });

  it('labels a locked unit review as a milestone', () => {
    const r = render(<LessonRow {...baseRowProps} state="locked" isMilestone title="Repaso de unidad" />);
    expect(text(r)).toContain('MILESTONE');
    expect(labels(r)[0]).toContain('unit review');
  });

  it('drops the milestone tag once the review is reachable', () => {
    const r = render(<LessonRow {...baseRowProps} state="active" isMilestone title="Repaso de unidad" />);
    const rendered = text(r);
    expect(rendered).not.toContain('MILESTONE');
    expect(rendered).toContain('GO');
  });
});

// ─── Carousel ─────────────────────────────────────────────────────────────

function makeUnitProgress(index: number, completedCount: number): UnitProgress {
  const unit: Unit = {
    id: `u${index}`,
    courseId: 'c1',
    title: index === 0 ? 'Greetings & Basics' : 'Food & Dining',
    description: '',
    orderIndex: index,
    totalLessons: 6,
  };
  const lessons: Lesson[] = Array.from({ length: 6 }, (_, i) => ({
    id: `u${index}-l${i}`,
    unitId: unit.id,
    courseId: 'c1',
    title: `Lesson ${i + 1}`,
    description: '',
    orderIndex: i,
    estimatedMinutes: 5,
    xpReward: 20,
    exercises: [],
  }));
  return {
    unit,
    lessons,
    index,
    lessonStates: lessons.map((_, i) => (i < completedCount ? 'completed' : 'locked')),
    lessonScores: lessons.map((_, i) => (i < completedCount ? 1 : null)),
    completedCount,
    totalCount: 6,
    progress: completedCount / 6,
    mastery: completedCount / 6,
    hasActiveLesson: false,
  };
}

describe('UnitCarousel', () => {
  it('renders a card per unit with its lesson count', () => {
    const units = [makeUnitProgress(0, 3), makeUnitProgress(1, 0)];
    const r = render(<UnitCarousel units={units} selectedIndex={0} onSelect={() => {}} />);

    const rendered = text(r);
    expect(rendered).toContain('01');
    expect(rendered).toContain('02');
    expect(rendered).toContain('Greetings & Basics');
    expect(rendered).toContain('3/6');
    expect(labels(r)).toContain('Unit 1, Greetings & Basics');
  });

  it('marks only the selected card as selected', () => {
    const units = [makeUnitProgress(0, 3), makeUnitProgress(1, 0)];
    const r = render(<UnitCarousel units={units} selectedIndex={1} onSelect={() => {}} />);

    const cards = hostNodes(
      r,
      (node) =>
        typeof node.props?.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('Unit '),
    );
    expect(cards.map((c) => c.props.accessibilityState.selected)).toEqual([false, true]);
  });
});

// ─── Pills ────────────────────────────────────────────────────────────────

const course = (id: string, title: string, cefrLevel: string): Course => ({
  id,
  sourceLanguage: 'en',
  targetLanguage: 'es',
  title,
  description: '',
  imageUrl: null,
  totalUnits: 8,
  cefrLevel,
  isPublished: true,
  createdAt: '2026-01-01',
});

describe('CoursePills', () => {
  it('spells out the selected course and abbreviates the rest', () => {
    const courses = [
      course('a1', 'Spanish A1', 'A1'),
      course('a2', 'Spanish A2', 'A2'),
      course('b1', 'Spanish B1', 'B1'),
    ];
    const r = render(
      <CoursePills courses={courses} selectedCourseId="a1" onSelect={() => {}} />,
    );

    const rendered = text(r);
    expect(rendered).toContain('Spanish A1');
    expect(rendered).toContain('A2');
    expect(rendered).not.toContain('Spanish A2');
    // The abbreviated pills still announce their full course name — and, since
    // a 56pt pill cannot show a can-do line, what the level means as well.
    expect(labels(r)).toEqual([
      'Spanish A1. Level A1. Handle simple, everyday phrases and introductions.',
      'Spanish A2. Level A2. Handle short, routine exchanges on familiar topics.',
      'Spanish B1. Level B1. Handle most situations while travelling, and describe experiences.',
    ]);
  });

  it('captions the row with the selected course\'s can-do line', () => {
    const courses = [course('a1', 'Spanish A1', 'A1'), course('b2', 'Spanish B2', 'B2')];
    const r = render(
      <CoursePills courses={courses} selectedCourseId="b2" onSelect={() => {}} />,
    );
    // Without this the row is six letter codes and nothing explaining them.
    expect(text(r)).toContain('Discuss familiar and abstract topics with growing confidence');
  });

  it('renders nothing when there are no courses', () => {
    const r = render(<CoursePills courses={[]} selectedCourseId={null} onSelect={() => {}} />);
    expect(r.toJSON()).toBeNull();
  });
});

describe('TabPills', () => {
  it('marks the active tab', () => {
    const tabs = [
      { key: 'vocab' as const, label: 'Vocab' },
      { key: 'reading' as const, label: 'Reading' },
    ];
    const r = render(<TabPills tabs={tabs} activeKey="reading" onSelect={() => {}} />);

    const pills = hostNodes(r, (node) => node.props?.accessibilityRole === 'tab');
    expect(pills.map((p) => p.props.accessibilityState.selected)).toEqual([false, true]);
  });
});

describe('ReviewShortcut', () => {
  it('renders the due count', () => {
    const r = render(<ReviewShortcut count={12} onPress={() => {}} />);
    expect(text(r)).toContain('12 DUE');
    expect(labels(r)[0]).toBe('Review cards. 12 cards due.');
  });

  it('renders nothing when the queue is empty', () => {
    const r = render(<ReviewShortcut count={0} onPress={() => {}} />);
    expect(r.toJSON()).toBeNull();
  });
});
