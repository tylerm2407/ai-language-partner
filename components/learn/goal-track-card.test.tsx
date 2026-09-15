/**
 * Render tests for the goal-track card.
 *
 * Pins the things a type check cannot see: that each lesson state renders
 * what it claims to, that exactly one row is the primary target, and that the
 * rollup above the list matches the rows below it.
 */

import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { GoalTrackCard, GoalTrackPrompt } from './GoalTrackCard';
import type { GoalTrackLesson, GoalTrackProgress } from '../../lib/goal-track-progress';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

function hostNodes(
  renderer: TestRenderer.ReactTestRenderer,
  predicate: (node: ReactTestInstance) => boolean,
): ReactTestInstance[] {
  return renderer.root.findAll(
    (node: ReactTestInstance) => typeof node.type === 'string' && predicate(node),
    { deep: true },
  );
}

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

/**
 * Composite `Pressable` nodes matching a label predicate, one per label.
 *
 * `onPress` lives on the composite: the host View underneath it only carries
 * responder handlers, so a tap in a test has to go through the composite.
 * Labels dedupe the wrapper layers NativeWind adds around each Pressable.
 */
function pressables(
  renderer: TestRenderer.ReactTestRenderer,
  predicate: (label: string) => boolean,
): ReactTestInstance[] {
  const byLabel = new Map<string, ReactTestInstance>();
  renderer.root
    .findAll(
      (node: ReactTestInstance) =>
        typeof node.props?.onPress === 'function' &&
        typeof node.props?.accessibilityLabel === 'string' &&
        predicate(node.props.accessibilityLabel),
      { deep: true },
    )
    .forEach((node) => {
      if (!byLabel.has(node.props.accessibilityLabel)) byLabel.set(node.props.accessibilityLabel, node);
    });
  return [...byLabel.values()];
}

/** The lesson rows, in order — the only buttons whose label starts "Lesson". */
function rows(renderer: TestRenderer.ReactTestRenderer): ReactTestInstance[] {
  return pressables(renderer, (label) => label.startsWith('Lesson '));
}

function lesson(
  id: string,
  opts: { done?: number | null; state?: GoalTrackLesson['generationState'] } = {},
): GoalTrackLesson {
  return {
    id,
    title: `Order ${id}`,
    description: `Ask for ${id}`,
    orderIndex: Number(id),
    generationState: opts.state === undefined ? 'ready' : opts.state,
    completion:
      opts.done === undefined ? null : { score: opts.done, completedAt: '2026-09-13T10:00:00Z' },
  };
}

const track = (lessons: GoalTrackLesson[]): GoalTrackProgress => ({
  courseId: 'course-1',
  goalKey: 'fr:hospitality:restaurant:informal',
  title: 'Dinner in French',
  description: 'Order and chat your way through a meal.',
  scenarios: ['restaurant'],
  lessons,
});

const noop = { onOpenLesson: () => Promise.resolve(true), onNavigate: () => {} };

describe('GoalTrackCard', () => {
  it('shows the rollup, the score on a done lesson, and one GO target', () => {
    const r = render(
      <GoalTrackCard
        track={track([lesson('1', { done: 0.94 }), lesson('2'), lesson('3', { state: 'pending' })])}
        {...noop}
      />,
    );
    const rendered = text(r);
    expect(rendered).toContain('1 OF 3 DONE');
    expect(rendered).toContain('94%');
    // Exactly one GO: the next lesson, not every open one.
    expect(rendered.match(/\bGO\b/g)).toHaveLength(1);

    const labels = rows(r).map((n) => n.props.accessibilityLabel as string);
    expect(labels).toEqual([
      'Lesson 1, Order 1, completed, scored 94 percent',
      'Lesson 2, Order 2, next up',
      'Lesson 3, Order 3, Ask for 3',
    ]);

    const bar = hostNodes(r, (n) => n.props?.accessibilityRole === 'progressbar');
    expect(bar[0].props.accessibilityValue).toEqual({ min: 0, max: 3, now: 1 });
  });

  it('falls back to DONE when the completion carries no score', () => {
    const r = render(<GoalTrackCard track={track([lesson('1', { done: null })])} {...noop} />);
    expect(text(r)).toContain('DONE');
    expect(rows(r)[0].props.accessibilityLabel).toBe('Lesson 1, Order 1, completed');
  });

  it('disables a lesson somebody else is building and says so', () => {
    const r = render(
      <GoalTrackCard track={track([lesson('1', { state: 'generating' }), lesson('2')])} {...noop} />,
    );
    const [blocked, next] = rows(r);
    expect(blocked.props.accessibilityState.disabled).toBe(true);
    expect(blocked.props.accessibilityLabel).toContain('being prepared');
    expect(text(r)).toContain('Being prepared');
    // The target moves past it rather than pointing at a row that cannot be tapped.
    expect(next.props.accessibilityLabel).toBe('Lesson 2, Order 2, next up');
  });

  it('navigates straight into a ready lesson and builds a shell first', async () => {
    const onOpenLesson = jest.fn(() => Promise.resolve(true));
    const onNavigate = jest.fn();
    const r = render(
      <GoalTrackCard
        track={track([lesson('1'), lesson('2', { state: 'pending' })])}
        onOpenLesson={onOpenLesson}
        onNavigate={onNavigate}
      />,
    );
    const [ready, shell] = rows(r);

    await TestRenderer.act(async () => {
      ready.props.onPress();
    });
    expect(onOpenLesson).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenLastCalledWith('1');

    await TestRenderer.act(async () => {
      shell.props.onPress();
    });
    expect(onOpenLesson).toHaveBeenCalledWith('2');
    expect(onNavigate).toHaveBeenLastCalledWith('2');
  });

  it('shows the retry copy when a shell could not be built', async () => {
    const r = render(
      <GoalTrackCard
        track={track([lesson('1', { state: 'pending' })])}
        onOpenLesson={() => Promise.resolve(false)}
        onNavigate={() => {}}
      />,
    );
    await TestRenderer.act(async () => {
      rows(r)[0].props.onPress();
    });
    expect(text(r)).toContain("Couldn't prepare this one");
  });

  it('turns the rollup green when every lesson is done', () => {
    const r = render(
      <GoalTrackCard track={track([lesson('1', { done: 1 }), lesson('2', { done: 0.8 })])} {...noop} />,
    );
    expect(text(r)).toContain('2 OF 2 DONE');
    expect(text(r)).not.toMatch(/\bGO\b/);
  });
});

describe('GoalTrackPrompt', () => {
  it('quotes the goal and offers to build', () => {
    const onBuild = jest.fn();
    const r = render(
      <GoalTrackPrompt goalText="Order dinner without switching to English" isBuilding={false} error={null} onBuild={onBuild} />,
    );
    expect(text(r)).toContain('Order dinner without switching to English');
    const button = pressables(r, (label) => label === 'Build lessons for my goal');
    expect(button[0].props.accessibilityState.disabled).toBe(false);
    button[0].props.onPress();
    expect(onBuild).toHaveBeenCalled();
  });

  it('surfaces the error and disables the button while building', () => {
    const r = render(
      <GoalTrackPrompt goalText="x" isBuilding error="Goal lessons are part of a paid plan." onBuild={() => {}} />,
    );
    expect(text(r)).toContain('paid plan');
    const button = hostNodes(r, (n) => n.props?.accessibilityLabel === 'Build lessons for my goal');
    expect(button[0].props.accessibilityState.disabled).toBe(true);
  });
});
