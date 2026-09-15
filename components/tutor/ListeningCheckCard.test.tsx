/**
 * Tests for the post-session listening check.
 *
 * Three things break silently here and none of them is caught by the type
 * checker: a submission that goes out before every question is answered, a
 * second submission after the server has already graded the session, and an
 * option that announces its verdict by colour alone. The rest — spacing,
 * tints, the spinner — is verified on a device.
 *
 * The one property worth stating outright: this component never knows which
 * option was right. It sends answers and renders what the server says about
 * them, because the score moves a measured CEFR level and a check graded on
 * the phone would be self-assigned.
 */

import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';

import { ListeningCheckCard } from './ListeningCheckCard';
import type { TutorListeningPrompt } from '../../types';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));

const mockAnswer = jest.fn();
jest.mock('../../lib/tutor-api', () => ({
  answerListeningCheck: (...args: unknown[]) => mockAnswer(...args),
}));

const ITEMS: TutorListeningPrompt[] = [
  { question: 'Which day did the tutor suggest?', options: ['Thu', 'Fri', 'Sat', 'Sun'] },
  { question: 'What did the tutor offer?', options: ['A room', 'A car', 'A meal', 'A map'] },
];

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

// `Pressable` puts `onPress` on the COMPOSITE and hands the host View responder
// props instead, so the usual "host nodes only" filter finds elements that
// cannot be pressed — and a test that presses nothing passes for the wrong
// reason. Selecting on a callable `onPress` picks the composite exactly once.

/** Every option button, in render order. */
function options(renderer: TestRenderer.ReactTestRenderer): ReactTestInstance[] {
  return renderer.root.findAll(
    (node) =>
      node.props?.accessibilityRole === 'radio' && typeof node.props.onPress === 'function',
    { deep: true },
  );
}

function pressableByLabel(
  renderer: TestRenderer.ReactTestRenderer,
  label: string,
): ReactTestInstance | undefined {
  return renderer.root.findAll(
    (node) =>
      typeof node.props?.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.startsWith(label) &&
      typeof node.props.onPress === 'function',
    { deep: true },
  )[0];
}

/** Flatten every string rendered anywhere in the tree. */
function text(renderer: TestRenderer.ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: ReactTestInstance | string) => {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    (node.children ?? []).forEach((child) => walk(child as ReactTestInstance | string));
  };
  walk(renderer.root);
  // Joined without a separator and then normalised: JSX splits `{n} of {m}`
  // into three children, so a space-joined tree turns "1 of 2" into "1  of  2".
  return out.join('').replace(/\s+/g, ' ').trim();
}

async function press(node: ReactTestInstance) {
  await TestRenderer.act(async () => {
    node.props.onPress?.();
  });
}

beforeEach(() => mockAnswer.mockReset());

describe('ListeningCheckCard', () => {
  it('renders nothing when there are no questions', () => {
    // A short session produces no check. Rendering an empty section would put
    // a heading over nothing.
    const renderer = render(<ListeningCheckCard sessionId="s1" items={[]} />);
    expect(options(renderer)).toHaveLength(0);
  });

  it('renders one radio per option', () => {
    const renderer = render(<ListeningCheckCard sessionId="s1" items={ITEMS} />);
    expect(options(renderer)).toHaveLength(8);
    expect(text(renderer)).toContain('Which day did the tutor suggest?');
  });

  it('will not submit until every question is answered', async () => {
    const renderer = render(<ListeningCheckCard sessionId="s1" items={ITEMS} />);
    await press(options(renderer)[0]);

    const submit = pressableByLabel(renderer, 'Check answers');
    await press(submit!);
    // One of two answered: an unanswered question grades as wrong, so sending
    // early would quietly cost the learner a mark.
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  it('sends the chosen option indices and renders the server score', async () => {
    mockAnswer.mockResolvedValue({
      alreadyAnswered: false,
      correct: [true, false],
      correctCount: 1,
      total: 2,
    });
    const renderer = render(<ListeningCheckCard sessionId="s1" items={ITEMS} />);
    await press(options(renderer)[0]); // question 1, option 0
    await press(options(renderer)[6]); // question 2, option 2
    await press(pressableByLabel(renderer, 'Check answers')!);

    expect(mockAnswer).toHaveBeenCalledWith({ sessionId: 's1', answers: [0, 2] });
    expect(text(renderer)).toContain('1 of 2 right');
  });

  it('announces each verdict in words, never by colour alone', async () => {
    mockAnswer.mockResolvedValue({
      alreadyAnswered: false,
      correct: [true, false],
      correctCount: 1,
      total: 2,
    });
    const renderer = render(<ListeningCheckCard sessionId="s1" items={ITEMS} />);
    await press(options(renderer)[0]);
    await press(options(renderer)[6]);
    await press(pressableByLabel(renderer, 'Check answers')!);

    const labels = options(renderer).map((o) => o.props.accessibilityLabel);
    expect(labels).toContain('Thu, correct');
    expect(labels).toContain('A meal, incorrect');
    // Only the learner's own pick is marked. The server never says which
    // option was right, so marking any other one would be inventing the key.
    expect(labels.filter((l: string) => /correct$/.test(l))).toHaveLength(2);
  });

  it('locks the options once graded', async () => {
    mockAnswer.mockResolvedValue({ alreadyAnswered: false, correct: [true, true], correctCount: 2, total: 2 });
    const renderer = render(<ListeningCheckCard sessionId="s1" items={ITEMS} />);
    await press(options(renderer)[0]);
    await press(options(renderer)[4]);
    await press(pressableByLabel(renderer, 'Check answers')!);

    expect(options(renderer).every((o) => o.props.accessibilityState.disabled)).toBe(true);
    // And there is no button left to press: the server grades a session once,
    // so offering a second attempt would promise something it will refuse.
    expect(pressableByLabel(renderer, 'Check answers')).toBeUndefined();
  });

  it('says so when the session was already answered', async () => {
    mockAnswer.mockResolvedValue({ alreadyAnswered: true, correct: [], correctCount: 2, total: 3 });
    const renderer = render(<ListeningCheckCard sessionId="s1" items={ITEMS} />);
    await press(options(renderer)[0]);
    await press(options(renderer)[4]);
    await press(pressableByLabel(renderer, 'Check answers')!);

    expect(text(renderer)).toContain('2 of 3 right');
    expect(text(renderer)).toContain('You already answered this one.');
  });

  it('surfaces a failure with a retry rather than swallowing it', async () => {
    mockAnswer.mockRejectedValueOnce(new Error('network'));
    const renderer = render(<ListeningCheckCard sessionId="s1" items={ITEMS} />);
    await press(options(renderer)[0]);
    await press(options(renderer)[4]);
    await press(pressableByLabel(renderer, 'Check answers')!);

    expect(text(renderer)).toContain('your answers');
    const retry = pressableByLabel(renderer, 'Try again');
    expect(retry).toBeDefined();

    // Retrying is safe: the submission is idempotent server-side.
    mockAnswer.mockResolvedValue({ alreadyAnswered: false, correct: [true, true], correctCount: 2, total: 2 });
    await press(retry!);
    expect(text(renderer)).toContain('2 of 2 right');
  });

  it('reports the first grade to its caller exactly once', async () => {
    const onGraded = jest.fn();
    mockAnswer.mockResolvedValue({ alreadyAnswered: false, correct: [true, true], correctCount: 2, total: 2 });
    const renderer = render(<ListeningCheckCard sessionId="s1" items={ITEMS} onGraded={onGraded} />);
    await press(options(renderer)[0]);
    await press(options(renderer)[4]);
    await press(pressableByLabel(renderer, 'Check answers')!);

    expect(onGraded).toHaveBeenCalledTimes(1);
    expect(onGraded).toHaveBeenCalledWith(2, 2);
  });
});
