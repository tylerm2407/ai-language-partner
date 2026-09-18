/**
 * What the field hands back is the whole point.
 *
 * The engines are tested in lib/script-input; this is about the wiring that
 * ruins them — a half-converted tail reaching the grader, a backspace deleting
 * a whole syllable, a candidate tap landing in the wrong place. Every
 * assertion here is on the string the PARENT receives, because that string is
 * what gets graded, stored and counted as evidence.
 */
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { ScriptInput } from './ScriptInput';
import { gradeAnswer } from '../../lib/grading';
import { Ui2VariantProvider } from '../../hooks/useUi2Theme';
import type { LanguageCode } from '../../types';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../lib/haptics', () => ({ haptic: jest.fn() }));

function mount(
  language: LanguageCode | null,
  context: string[] = [],
  trim?: { prefix: string; suffix: string },
) {
  const onChangeText = jest.fn();
  let value = '';
  let tree!: TestRenderer.ReactTestRenderer;

  const render = () =>
    TestRenderer.create(
      <Ui2VariantProvider variant="system">
        <ScriptInput
          language={language}
          value={value}
          context={context}
          trim={trim}
          onChangeText={(next) => {
            value = next;
            onChangeText(next);
          }}
        />
      </Ui2VariantProvider>,
    );

  act(() => {
    tree = render();
  });

  const field = () => tree.root.findAllByType(TextInput)[0];
  /** Types into the field the way the native side reports it: whole string. */
  const type = (text: string) => {
    act(() => {
      field().props.onChangeText(field().props.value + text);
    });
  };
  const backspace = () => {
    act(() => {
      const current: string = field().props.value;
      field().props.onChangeText(current.slice(0, -1));
    });
  };

  return { tree, field, type, backspace, onChangeText, latest: () => value };
}

describe('ScriptInput', () => {
  it('leaves a Latin-script course alone', () => {
    const f = mount('es');
    f.type('hola');
    expect(f.latest()).toBe('hola');
    // No bar, no keypad, no conversion: one plain field.
    expect(f.tree.root.findAllByType(TextInput)).toHaveLength(1);
  });

  it('hands the parent settled text, never the composing tail', () => {
    const f = mount('ru');
    f.type('privet');
    // `t` is held in composition because it could still become `ts` — but what
    // leaves the field is the whole word.
    expect(f.latest()).toBe('привет');
  });

  it('converts Japanese romaji as the learner types', () => {
    const f = mount('ja');
    f.type('sakana');
    expect(f.latest()).toBe('さかな');
  });

  it('composes Korean syllable blocks rather than loose jamo', () => {
    const f = mount('ko');
    f.type('hanguk');
    expect(f.latest()).toBe('한국');
  });

  it('deletes one keystroke at a time inside a composition', () => {
    const f = mount('ja');
    f.type('sakana');
    f.backspace();
    // `sakan` — the trailing n is not kana yet, so the settled value is さかん.
    expect(f.latest()).toBe('さかん');
    f.backspace();
    expect(f.latest()).toBe('さか');
  });

  it('commits a Chinese candidate when one is tapped', () => {
    const f = mount('zh', ['你好']);
    f.type('nihao');
    // Nothing is committed by typing alone: pinyin is not Chinese.
    expect(f.latest()).toBe('nihao');

    const candidate = f.tree.root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string'
        && n.props.accessibilityLabel.startsWith('你好'))
      .find((n) => typeof n.props.onPress === 'function');
    expect(candidate).toBeDefined();
    act(() => {
      candidate!.props.onPress();
    });
    expect(f.latest()).toBe('你好');
  });

  it('offers the missing PIECE of a fill-blank word, not the whole word', () => {
    // The prompt is 看_____ (Nurse) and the stored answer is 護師 — a fragment
    // no dictionary holds. The learner types the whole word's reading and the
    // bar hands back only what the blank is missing.
    const f = mount('ja', ['護師'], { prefix: '看', suffix: '' });
    f.type('kangoshi');

    const labels = f.tree.root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string'
        && n.props.onPress
        && n.props.accessibilityLabel.includes('かんごし'))
      .map((n) => n.props.accessibilityLabel as string);
    expect(labels.some((l) => l.startsWith('護師'))).toBe(true);
    expect(labels.some((l) => l.startsWith('看護師'))).toBe(false);
  });

  it('types a Japanese answer that the grader then marks correct', () => {
    // The whole journey in one assertion: an English keyboard, romaji, the
    // converter, the field, the grader. Both halves are tested apart from each
    // other; this is the seam between them, and the seam is where a learner
    // who did everything right gets told they were wrong.
    const f = mount('ja', ['魚']);
    f.type('sakana');
    expect(f.latest()).toBe('さかな');

    const grade = gradeAnswer(f.latest(), '魚', [], {
      exerciseHints: { language: 'ja', skillType: 'vocabulary', exerciseType: 'translate_to_target' },
    });
    expect(grade.isCorrect).toBe(true);
    expect(grade.explanation).toContain('魚');
  });

  it('types a Russian answer that the grader then marks correct', () => {
    const f = mount('ru');
    f.type('privet');
    const grade = gradeAnswer(f.latest(), 'Привет', [], {
      exerciseHints: { language: 'ru', skillType: 'vocabulary', exerciseType: 'translate_to_target' },
    });
    expect(grade.isCorrect).toBe(true);
  });

  it('turns autocorrect off wherever an input method is driving the field', () => {
    const ja = mount('ja');
    expect(ja.field().props.autoCorrect).toBe(false);
    expect(ja.field().props.autoCapitalize).toBe('none');
  });
});
