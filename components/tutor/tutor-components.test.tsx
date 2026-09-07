/**
 * Tests for the tutor call components.
 *
 * The split is deliberate. Everything that is a DECISION — which label a phase
 * gets, which turns group together, whether a duration is worth stating, what
 * actually gets sent when someone taps Send — lives in an exported pure
 * function and is tested exhaustively here. Layout, gradients and animation are
 * verified on a device; a test asserting a border radius only ever fails when
 * somebody deliberately changes it.
 *
 * The render tests that do exist assert the two things that break silently and
 * cannot be caught by the type checker: that a state renders at all, and that
 * it announces itself correctly to VoiceOver. Selection state and destructive
 * ordering are both accessibility contracts, not styling.
 */

import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';

import { CallControls, composerSubmission } from './CallControls';
import { CallStatusRing, clampLevel, phasePresentation, ringState } from './CallStatusRing';
import { CorrectionModeToggle, CORRECTION_MODE_OPTIONS } from './CorrectionModeToggle';
import {
  FIRST_SESSION_INVITATION,
  LastSessionCard,
  formatLastSession,
  formatSessionMinutes,
} from './LastSessionCard';
import {
  LiveTranscript,
  groupTurns,
  speakerLabel,
  turnAccessibilityLabel,
  turnStatusNote,
} from './LiveTranscript';
import { TutorPortrait, portraitGradient, tutorInitial } from './TutorPortrait';
import type { Ui2Palette } from '../../config/theme';
import type { TutorPhase } from '../../lib/realtime-session';
import type { TranscriptTurn } from '../../lib/tutor-transcript';

// The icon set resolves its font asynchronously and setState()s afterwards,
// which lands after the test has already asserted. Nothing here depends on the
// glyph, so stand it down.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
// CallStatusRing -> useMotion -> lib/motion-preference reaches for the native
// AsyncStorage module, which does not exist under jest.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));

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

/** Fire the press handler behind an accessibility label.
 *
 * Deliberately NOT filtered to host nodes: RN's Pressable renders a host View
 * whose press handling lives behind the responder system, so the host node has
 * no `onPress` to call. The composite above it does. */
function press(renderer: TestRenderer.ReactTestRenderer, label: string): void {
  const node = renderer.root.findAll(
    (n: ReactTestInstance) =>
      n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function',
    { deep: true },
  )[0];
  if (!node) throw new Error(`no pressable labelled "${label}"`);
  TestRenderer.act(() => {
    (node.props.onPress as () => void)();
  });
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

/** Every phase the reducer declares, including `error`, which it never enters
 *  but a host may still be handed. Listed literally so adding a phase to
 *  `TutorPhase` without deciding how it looks fails the type check here. */
const ALL_PHASES: readonly TutorPhase[] = [
  'idle',
  'preflight',
  'connecting',
  'greeting',
  'listening',
  'tutor_speaking',
  'interrupted',
  'paused',
  'reconnecting',
  'ending',
  'ended',
  'error',
];

function turn(partial: Partial<TranscriptTurn> & Pick<TranscriptTurn, 'id' | 'role' | 'text'>): TranscriptTurn {
  return {
    status: 'complete',
    fragments: [{ seq: 0, text: partial.text }],
    ...partial,
  };
}

// ─── TutorPortrait ───────────────────────────────────────────────────────

describe('tutorInitial', () => {
  it('takes the first letter of the name', () => {
    expect(tutorInitial('Mara', 'tutor-mara')).toBe('M');
    expect(tutorInitial('nico', 'tutor-nico')).toBe('N');
  });

  it('falls back to the id with its prefix stripped, not to T for every tutor', () => {
    // Without the strip, `tutor-mara` and `tutor-theo` both render "T" — which
    // defeats the entire point of having four distinguishable discs.
    expect(tutorInitial('', 'tutor-mara')).toBe('M');
    expect(tutorInitial('   ', 'tutor-theo')).toBe('T');
    expect(tutorInitial('🙂', 'tutor-amira')).toBe('A');
  });

  it('never renders an empty disc', () => {
    for (const [name, id] of [
      ['', ''],
      ['🙂', '🙂'],
      ['   ', '   '],
    ] as const) {
      expect(tutorInitial(name, id).length).toBeGreaterThan(0);
    }
  });

  it('keeps non-Latin scripts', () => {
    expect(tutorInitial('Ольга', 'tutor-olga')).toBe('О');
  });
});

describe('portraitGradient', () => {
  it('is deterministic for an id', () => {
    // The whole rapport argument depends on this: the same tutor must look the
    // same on every launch and every device.
    expect(portraitGradient('tutor-mara')).toEqual(portraitGradient('tutor-mara'));
  });

  it('only ever uses the two approved gradient stops', () => {
    // Palette KEYS since UI 2.0, not hexes: the disc has to answer to whichever
    // scheme the phone is in, and pinning colours here would pin one of them.
    const approved = new Set<keyof Ui2Palette>(['primary', 'slab']);
    for (const id of ['tutor-mara', 'tutor-nico', 'tutor-amira', 'tutor-theo', 'anything']) {
      for (const stop of portraitGradient(id).tones) {
        expect(approved.has(stop)).toBe(true);
      }
    }
  });

  it('tells the four shipped tutors apart', () => {
    const discs = ['tutor-mara', 'tutor-nico', 'tutor-amira', 'tutor-theo'].map((id) =>
      JSON.stringify(portraitGradient(id)),
    );
    expect(new Set(discs).size).toBeGreaterThan(1);
  });
});

describe('TutorPortrait', () => {
  it('is hidden from screen readers — the caller renders the name as text', () => {
    const renderer = render(<TutorPortrait portraitId="tutor-mara" name="Mara" size="hero" />);
    expect(labels(renderer)).toEqual([]);
    const hidden = hostNodes(renderer, (node) => node.props?.accessibilityElementsHidden === true);
    expect(hidden.length).toBeGreaterThan(0);
  });

  it('renders the initial at every size', () => {
    for (const size of ['hero', 'row', 'inline'] as const) {
      expect(text(render(<TutorPortrait portraitId="tutor-mara" name="Mara" size={size} />))).toContain('M');
    }
  });
});

// ─── CallStatusRing ──────────────────────────────────────────────────────

describe('phasePresentation', () => {
  it('gives every phase an icon AND a text label, never colour alone', () => {
    for (const phase of ALL_PHASES) {
      const presentation = phasePresentation(phase);
      expect(presentation.label.length).toBeGreaterThan(0);
      expect(presentation.icon.length).toBeGreaterThan(0);
      expect(presentation.tone.length).toBeGreaterThan(0);
    }
  });

  it('does not reuse one label for two states the learner must tell apart', () => {
    // "Listening" is shared by `listening` and `interrupted` on purpose — from
    // the learner's side both mean "your turn" — but the detail line must then
    // distinguish them, or a barge-in looks like nothing happened.
    expect(phasePresentation('interrupted').detail).not.toBe(phasePresentation('listening').detail);
  });

  it('never describes a failed call as one that is still working', () => {
    expect(phasePresentation('error').label).toBe(phasePresentation('ended').label);
    expect(phasePresentation('error').detail).not.toBeNull();
  });
});

describe('ringState', () => {
  it('buckets every phase', () => {
    for (const phase of ALL_PHASES) {
      expect(['preparing', 'listening', 'speaking', 'stopped']).toContain(ringState(phase));
    }
  });

  it('keeps a finished call out of the preparing bucket', () => {
    // Otherwise a dead call renders identically to one that is still dialling,
    // and the learner waits for something that is never coming.
    expect(ringState('ended')).toBe('stopped');
    expect(ringState('error')).toBe('stopped');
    expect(ringState('connecting')).toBe('preparing');
  });

  it('puts a barge-in on the learner side', () => {
    expect(ringState('interrupted')).toBe('listening');
    expect(ringState('tutor_speaking')).toBe('speaking');
  });
});

describe('clampLevel', () => {
  it('holds the amplitude inside 0..1', () => {
    expect(clampLevel(0.5)).toBe(0.5);
    expect(clampLevel(4)).toBe(1);
    expect(clampLevel(-1)).toBe(0);
  });

  it('treats a missing or broken level as silence rather than freezing the driver', () => {
    // NaN reaching Animated.timing pins the value forever — the ring would
    // stop responding for the rest of the call with no error anywhere.
    expect(clampLevel(undefined)).toBe(0);
    expect(clampLevel(Number.NaN)).toBe(0);
    expect(clampLevel(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('CallStatusRing', () => {
  it('renders the phase label as text for every phase', () => {
    for (const phase of ALL_PHASES) {
      const renderer = render(
        <CallStatusRing phase={phase} portraitId="tutor-mara" name="Mara" level={0.4} />,
      );
      expect(text(renderer)).toContain(phasePresentation(phase).label);
    }
  });

  it('announces phase changes to VoiceOver without a touch', () => {
    const renderer = render(<CallStatusRing phase="listening" portraitId="tutor-mara" name="Mara" />);
    const live = hostNodes(renderer, (node) => node.props?.accessibilityLiveRegion === 'polite');
    expect(live.length).toBeGreaterThan(0);
  });
});

// ─── CorrectionModeToggle ────────────────────────────────────────────────

describe('CorrectionModeToggle', () => {
  it('asks rather than pre-selecting when nothing has been chosen', () => {
    // The storage layer keeps "never chosen" distinct from either answer; a
    // highlighted row here would throw that away at the last moment.
    const renderer = render(<CorrectionModeToggle mode={null} onChange={jest.fn()} />);
    const radios = hostNodes(renderer, (node) => node.props?.accessibilityRole === 'radio');
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio.props.accessibilityState?.selected).toBe(false);
    }
    expect(text(renderer)).toContain('How should I correct you?');
  });

  it('marks exactly one radio selected once chosen', () => {
    const renderer = render(<CorrectionModeToggle mode="let_me_talk" onChange={jest.fn()} />);
    const radios = hostNodes(renderer, (node) => node.props?.accessibilityRole === 'radio');
    const selected = radios.filter((r) => r.props.accessibilityState?.selected === true);
    expect(selected).toHaveLength(1);
    expect(selected[0].props.accessibilityLabel).toBe('Just let me talk');
  });

  it('reports the chosen mode', () => {
    const onChange = jest.fn();
    const renderer = render(<CorrectionModeToggle mode={null} onChange={onChange} />);
    press(renderer, 'Correct me as I go');
    expect(onChange).toHaveBeenCalledWith('as_you_go');
  });

  it('keeps both labels and the group question in the compact call header', () => {
    // Compact drops the descriptions, not the labels — an icon-only correction
    // control mid-call is unreadable and unspeakable.
    const renderer = render(<CorrectionModeToggle mode="as_you_go" onChange={jest.fn()} compact />);
    const rendered = text(renderer);
    for (const option of CORRECTION_MODE_OPTIONS) {
      expect(rendered).toContain(option.label);
    }
    const group = hostNodes(renderer, (node) => node.props?.accessibilityRole === 'radiogroup');
    expect(group[0].props.accessibilityLabel).toContain('correct you');
  });
});

// ─── LiveTranscript ──────────────────────────────────────────────────────

describe('groupTurns', () => {
  it('collapses consecutive turns from the same speaker', () => {
    // The realtime layer segments one long utterance into several turns;
    // labelling each "You" would claim they were separate remarks.
    const groups = groupTurns([
      turn({ id: 'a', role: 'learner', text: 'Hola' }),
      turn({ id: 'b', role: 'learner', text: 'que tal' }),
      turn({ id: 'c', role: 'tutor', text: 'Muy bien' }),
      turn({ id: 'd', role: 'learner', text: 'Gracias' }),
    ]);
    expect(groups.map((g) => [g.role, g.turns.length])).toEqual([
      ['learner', 2],
      ['tutor', 1],
      ['learner', 1],
    ]);
  });

  it('keys a group on its first turn, so keys stay stable as it grows', () => {
    const first = groupTurns([turn({ id: 'a', role: 'tutor', text: 'Hi' })]);
    const grown = groupTurns([
      turn({ id: 'a', role: 'tutor', text: 'Hi' }),
      turn({ id: 'b', role: 'tutor', text: 'there' }),
    ]);
    expect(grown[0].key).toBe(first[0].key);
  });

  it('handles an empty transcript', () => {
    expect(groupTurns([])).toEqual([]);
  });

  it('does not mutate the turns it was given', () => {
    const turns = [turn({ id: 'a', role: 'tutor', text: 'Hi' })];
    groupTurns(turns);
    expect(turns).toHaveLength(1);
  });
});

describe('turnStatusNote', () => {
  it('marks only interrupted turns', () => {
    expect(turnStatusNote('interrupted')).not.toBeNull();
    expect(turnStatusNote('complete')).toBeNull();
    // A "still speaking" caption under visibly growing text is noise that
    // flickers away a moment later.
    expect(turnStatusNote('streaming')).toBeNull();
  });
});

describe('turnAccessibilityLabel', () => {
  it('names the speaker', () => {
    expect(turnAccessibilityLabel(turn({ id: 'a', role: 'learner', text: 'Hola' }))).toBe('You: Hola');
    expect(turnAccessibilityLabel(turn({ id: 'b', role: 'tutor', text: 'Hola' }))).toBe('Tutor: Hola');
  });

  it('tells a screen-reader user the tutor was cut off', () => {
    // Without this the learner reads a half sentence as the whole answer — the
    // exact failure `truncateCurrentTutorTurn` exists to prevent, undone in the
    // last layer.
    const label = turnAccessibilityLabel(
      turn({ id: 'c', role: 'tutor', text: 'El pretérito se', status: 'interrupted' }),
    );
    expect(label).toContain('Cut off');
  });

  it('agrees with the visible label', () => {
    expect(speakerLabel('learner')).toBe('You');
    expect(speakerLabel('tutor')).toBe('Tutor');
  });
});

describe('LiveTranscript', () => {
  it('says what the empty transcript is for rather than showing a blank box', () => {
    const renderer = render(<LiveTranscript transcript={{ turns: [] }} />);
    expect(text(renderer)).toContain('appear here');
  });

  it('renders an interrupted turn with a visible note, not just a colour', () => {
    const renderer = render(
      <LiveTranscript
        transcript={{
          turns: [turn({ id: 'a', role: 'tutor', text: 'El pretérito se', status: 'interrupted' })],
        }}
      />,
    );
    expect(text(renderer)).toContain('Cut off');
  });

  it('announces each turn once, with its speaker', () => {
    const renderer = render(
      <LiveTranscript
        transcript={{
          turns: [
            turn({ id: 'a', role: 'learner', text: 'Hola' }),
            turn({ id: 'b', role: 'tutor', text: 'Buenos días' }),
          ],
        }}
      />,
    );
    expect(labels(renderer)).toEqual(['You: Hola', 'Tutor: Buenos días']);
  });
});

// ─── CallControls ────────────────────────────────────────────────────────

describe('composerSubmission', () => {
  it('collapses whitespace', () => {
    expect(composerSubmission('  hola   que  tal ')).toBe('hola que tal');
    expect(composerSubmission('hola\nque tal')).toBe('hola que tal');
  });

  it('refuses an empty turn', () => {
    // An empty turn is still a paid model call, answered as though the learner
    // said "".
    expect(composerSubmission('')).toBeNull();
    expect(composerSubmission('   ')).toBeNull();
    expect(composerSubmission('\n\t')).toBeNull();
  });
});

describe('CallControls', () => {
  const props = {
    muted: false,
    onToggleMute: jest.fn(),
    onEnd: jest.fn(),
    onSendText: jest.fn(),
  };

  it('puts End last, after every other control', () => {
    // Reading order is the accessibility half of the divider: a VoiceOver user
    // swiping forward must reach mute and the composer before hang-up.
    const renderer = render(<CallControls {...props} />);
    const order = labels(renderer);
    expect(order[order.length - 1]).toBe('End call');
  });

  it('labels every control and hints at what it does', () => {
    const renderer = render(<CallControls {...props} />);
    const interactive = hostNodes(
      renderer,
      (node) =>
        node.props?.accessibilityRole === 'button' || node.props?.accessibilityLabel === 'Type your turn',
    );
    expect(interactive.length).toBeGreaterThanOrEqual(3);
    for (const node of interactive) {
      expect(typeof node.props.accessibilityLabel).toBe('string');
      expect(typeof node.props.accessibilityHint).toBe('string');
    }
  });

  it('says whether the mic is currently muted, not just what the button does', () => {
    expect(labels(render(<CallControls {...props} muted={false} />))).toContain('Mute your microphone');
    expect(labels(render(<CallControls {...props} muted />))).toContain('Unmute your microphone');
  });

  it('sends a typed turn once, cleaned, and clears the box', () => {
    const onSendText = jest.fn();
    const renderer = render(<CallControls {...props} onSendText={onSendText} />);
    const input = hostNodes(renderer, (node) => node.props?.accessibilityLabel === 'Type your turn')[0];
    TestRenderer.act(() => {
      input.props.onChangeText('  hola   ');
    });
    press(renderer, 'Send');
    expect(onSendText).toHaveBeenCalledTimes(1);
    expect(onSendText).toHaveBeenCalledWith('hola');

    // A second tap must not resend: the box is empty and Send is disabled.
    const sendAfter = hostNodes(renderer, (node) => node.props?.accessibilityLabel === 'Send')[0];
    expect(sendAfter.props.accessibilityState?.disabled).toBe(true);
    press(renderer, 'Send');
    expect(onSendText).toHaveBeenCalledTimes(1);
  });
});

// ─── LastSessionCard ─────────────────────────────────────────────────────

describe('formatSessionMinutes', () => {
  it('never renders a real call as zero minutes', () => {
    // Forty seconds of conversation is a call the learner had. "0 min" reads
    // as a failure that did not happen.
    expect(formatSessionMinutes(0.6)).toBe('Under a minute');
    expect(formatSessionMinutes(0)).toBe('Under a minute');
  });

  it('rounds to whole minutes', () => {
    expect(formatSessionMinutes(8)).toBe('8 min');
    expect(formatSessionMinutes(8.4)).toBe('8 min');
    expect(formatSessionMinutes(8.6)).toBe('9 min');
  });

  it('declines to state a duration it cannot trust', () => {
    expect(formatSessionMinutes(null)).toBeNull();
    expect(formatSessionMinutes(-3)).toBeNull();
    expect(formatSessionMinutes(Number.NaN)).toBeNull();
  });
});

describe('formatLastSession', () => {
  it('renders the full line', () => {
    expect(formatLastSession(8, 'you worked on the past tense')).toBe(
      'Last session: 8 min · you worked on the past tense',
    );
  });

  it('survives either half being missing', () => {
    expect(formatLastSession(8, null)).toBe('Last session: 8 min');
    expect(formatLastSession(null, 'you worked on the past tense')).toBe(
      'Last session: you worked on the past tense',
    );
    expect(formatLastSession(8, '   ')).toBe('Last session: 8 min');
  });

  it('has nothing to say when both halves are gone', () => {
    expect(formatLastSession(null, null)).toBeNull();
  });
});

describe('LastSessionCard', () => {
  it('welcomes a first-timer instead of showing an empty box', () => {
    const renderer = render(<LastSessionCard minutes={null} headline={null} loading={false} />);
    expect(text(renderer)).toContain(FIRST_SESSION_INVITATION);
  });

  it('keeps a labelled row while loading, so the lobby does not reflow', () => {
    const renderer = render(<LastSessionCard minutes={null} headline={null} loading />);
    expect(labels(renderer)).toContain('Loading your last session');
  });

  it('renders a real session and announces the same words it draws', () => {
    const renderer = render(
      <LastSessionCard minutes={8} headline="you worked on the past tense" loading={false} />,
    );
    const line = 'Last session: 8 min · you worked on the past tense';
    expect(text(renderer)).toContain(line);
    expect(labels(renderer)).toContain(line);
  });
});
