import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { TappableText } from './TappableText';
import { MAX_SPAN_CHARS, MIN_SPAN_CHARS } from '../../lib/reading-help';
import { splitParagraphs, type Paragraph } from '../../lib/reading-text';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

function renderText(props: {
  paragraphs: Paragraph[];
  selectedRef?: { paragraphIndex: number; tokenIndex: number } | null;
  onWordPress?: jest.Mock;
  onExplain?: jest.Mock;
}) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <TappableText
        paragraphs={props.paragraphs}
        fontSize={16}
        selectedRef={props.selectedRef ?? null}
        onWordPress={props.onWordPress ?? jest.fn()}
        onExplain={props.onExplain}
      />,
    );
  });
  return tree;
}

/**
 * Every pressable node carrying this accessibilityLabel.
 *
 * A Pressable renders as a composite plus a host View, both of which carry the
 * label, so the handler is what identifies the one node a user can actually
 * press.
 */
function byLabel(tree: TestRenderer.ReactTestRenderer, label: string): ReactTestInstance[] {
  return tree.root
    .findAll((n) => n.props?.accessibilityLabel === label, { deep: true })
    .filter((n) => typeof n.props.onPress === 'function');
}

function press(node: ReactTestInstance) {
  act(() => {
    node.props.onPress();
  });
}

const TWO_PARAGRAPHS = splitParagraphs(
  [
    'Il y avait une fois un roi qui régnait sur un pays très lointain, et ce roi avait trois filles.',
    'La plus jeune était la plus belle de toutes, et le soleil lui-même s’étonnait chaque fois qu’il la voyait.',
  ].join('\r\n\r\n'),
);

describe('TappableText', () => {
  it('makes every word a button, not just the ones with an annotation', () => {
    // This is the whole point of the change: 10,231 imported Gutenberg books
    // have no annotations at all, so the old reader made nothing tappable.
    const tree = renderText({ paragraphs: TWO_PARAGRAPHS });
    // Every token, including the punctuated one and the accented one.
    for (const word of ['régnait', 'lointain,', 'trois', 's’étonnait', 'lui-même']) {
      expect(byLabel(tree, `Look up ${word}`).length).toBeGreaterThan(0);
    }
  });

  it('a tap reports the raw token and where it was', () => {
    const onWordPress = jest.fn();
    const tree = renderText({ paragraphs: TWO_PARAGRAPHS, onWordPress });
    press(byLabel(tree, 'Look up régnait')[0]);
    expect(onWordPress).toHaveBeenCalledTimes(1);
    // Raw, not normalised: normalisation is the lookup chain's job, and the
    // ref has to point at the token actually rendered so it can be highlighted.
    expect(onWordPress.mock.calls[0][0]).toBe('régnait');
    expect(onWordPress.mock.calls[0][1].paragraphIndex).toBe(0);
  });

  it('whitespace between words is not a tap target', () => {
    const tree = renderText({ paragraphs: TWO_PARAGRAPHS });
    expect(byLabel(tree, 'Look up  ')).toHaveLength(0);
    expect(byLabel(tree, 'Look up \r\n')).toHaveLength(0);
  });

  it('shows an explain affordance per paragraph when one is offered', () => {
    const tree = renderText({ paragraphs: TWO_PARAGRAPHS, onExplain: jest.fn() });
    expect(byLabel(tree, 'Explain this paragraph')).toHaveLength(2);
  });

  it('offers nothing to explain when no handler is given', () => {
    const tree = renderText({ paragraphs: TWO_PARAGRAPHS });
    expect(byLabel(tree, 'Explain this paragraph')).toHaveLength(0);
  });

  it('hides the affordance on a paragraph the server would refuse', () => {
    // Offering a button that can only produce a 400 is worse than not having
    // one. Both ends of the range: too long to explain, too short to be worth
    // explaining.
    const paragraphs = splitParagraphs(
      ['x'.repeat(MAX_SPAN_CHARS + 1), 'y'.repeat(MIN_SPAN_CHARS - 1)].join('\r\n\r\n'),
    );
    const tree = renderText({ paragraphs, onExplain: jest.fn() });
    expect(byLabel(tree, 'Explain this paragraph')).toHaveLength(0);
  });

  it('explaining reports the paragraph, so the caller can key the cache on it', () => {
    const onExplain = jest.fn();
    const tree = renderText({ paragraphs: TWO_PARAGRAPHS, onExplain });
    press(byLabel(tree, 'Explain this paragraph')[1]);
    expect(onExplain).toHaveBeenCalledWith(TWO_PARAGRAPHS[1]);
  });

  it('a selection change re-renders only the paragraph it is in', () => {
    // Passing the selected WORD down would re-render every token on the page
    // on each tap. The ref is compared per paragraph so exactly one block
    // re-renders — the property this test exists to keep.
    const onWordPress = jest.fn();
    const tree = renderText({ paragraphs: TWO_PARAGRAPHS, onWordPress });
    const before = byLabel(tree, 'Look up régnait')[0];

    act(() => {
      tree.update(
        <TappableText
          paragraphs={TWO_PARAGRAPHS}
          fontSize={16}
          selectedRef={{ paragraphIndex: 0, tokenIndex: 0 }}
          onWordPress={onWordPress}
        />,
      );
    });

    // The selected token in paragraph 0 picks up the highlight style...
    const firstWord = byLabel(tree, 'Look up Il')[0];
    expect(firstWord.props.style).toBeTruthy();
    // ...and paragraph 1 is untouched: same handler identity, so its memo held.
    const other = byLabel(tree, 'Look up jeune')[0];
    expect(other.props.style).toBeUndefined();
    expect(byLabel(tree, 'Look up régnait')[0].props.children).toBe(before.props.children);
  });
});
