/**
 * The product rule this file guards: a bare CEFR code never ships alone.
 *
 * Every band must have a can-do line, every visible label must carry it, and
 * the badge-sized surfaces that can only fit the code must still hand VoiceOver
 * the full sentence. A missing entry here is not a cosmetic gap — it is a
 * screen that shows a learner two letters and no meaning.
 */
import {
  CEFR_CAN_DO,
  CEFR_BAND_COLORS,
  CEFR_BAND_COLORS_UNKNOWN,
  cefrCanDo,
  cefrLabel,
  cefrAccessibilityLabel,
  cefrBandColors,
} from './cefr-labels';
import { CEFR_LADDER } from './cefr-proficiency';

describe('CEFR can-do lines', () => {
  it('covers every band on the ladder', () => {
    for (const band of CEFR_LADDER) {
      expect(CEFR_CAN_DO[band]).toBeTruthy();
    }
    expect(Object.keys(CEFR_CAN_DO).sort()).toEqual([...CEFR_LADDER].sort());
  });

  it('says something different for every band', () => {
    const lines = new Set(Object.values(CEFR_CAN_DO));
    expect(lines.size).toBe(CEFR_LADDER.length);
  });

  it('names no target language — one table serves every course', () => {
    for (const line of Object.values(CEFR_CAN_DO)) {
      expect(line).not.toMatch(/Spanish|French|German|English|Italian|Japanese/i);
    }
  });
});

describe('cefrCanDo', () => {
  it('returns the bare sentence for each band', () => {
    expect(cefrCanDo('B1')).toBe(
      'Handle most situations while travelling, and describe experiences'
    );
    for (const band of CEFR_LADDER) {
      expect(cefrCanDo(band)).toBe(CEFR_CAN_DO[band]);
    }
  });

  it('reads the free-text tags that content actually carries', () => {
    expect(cefrCanDo('a2')).toBe(CEFR_CAN_DO.A2);
    expect(cefrCanDo('A2 ')).toBe(CEFR_CAN_DO.A2);
    expect(cefrCanDo('B1-B2')).toBe(CEFR_CAN_DO.B1);
  });
});

describe('cefrLabel', () => {
  it('pairs the code with its can-do line', () => {
    expect(cefrLabel('B1')).toBe(
      'B1 · Handle most situations while travelling, and describe experiences'
    );
  });

  it('always contains both halves, for every band', () => {
    for (const band of CEFR_LADDER) {
      const label = cefrLabel(band);
      expect(label.startsWith(`${band} · `)).toBe(true);
      expect(label).toContain(CEFR_CAN_DO[band]);
    }
  });
});

describe('cefrAccessibilityLabel', () => {
  it('spells the level out and punctuates the two clauses', () => {
    expect(cefrAccessibilityLabel('B1')).toBe(
      'Level B1. Handle most situations while travelling, and describe experiences.'
    );
  });

  it('covers every band', () => {
    for (const band of CEFR_LADDER) {
      expect(cefrAccessibilityLabel(band)).toBe(`Level ${band}. ${CEFR_CAN_DO[band]}.`);
    }
  });
});

describe('unknown or absent bands', () => {
  // Untagged content and half-finished profiles both reach these functions.
  // Throwing here would take down a book grid over a bad content tag.
  const unusable = [null, undefined, '', '   ', 'D1', 'intermediate', 'A3'];

  it('never throws', () => {
    for (const raw of unusable) {
      expect(() => cefrLabel(raw)).not.toThrow();
      expect(() => cefrCanDo(raw)).not.toThrow();
      expect(() => cefrAccessibilityLabel(raw)).not.toThrow();
      expect(() => cefrBandColors(raw)).not.toThrow();
    }
  });

  it('renders nothing rather than echoing an unusable tag back', () => {
    for (const raw of unusable) {
      expect(cefrLabel(raw)).toBe('');
      expect(cefrCanDo(raw)).toBe('');
    }
  });

  it('still gives VoiceOver something to say', () => {
    for (const raw of unusable) {
      expect(cefrAccessibilityLabel(raw)).toBe('Level not set.');
    }
  });

  it('falls back to the neutral chip', () => {
    for (const raw of unusable) {
      expect(cefrBandColors(raw)).toBe(CEFR_BAND_COLORS_UNKNOWN);
    }
  });
});

describe('band colours', () => {
  it('covers the whole ladder — C1 and C2 included', () => {
    for (const band of CEFR_LADDER) {
      expect(CEFR_BAND_COLORS[band]).toBeDefined();
      expect(cefrBandColors(band)).toBe(CEFR_BAND_COLORS[band]);
    }
  });

  it('gives no two bands the same swatch', () => {
    const swatches = CEFR_LADDER.map((band) => `${CEFR_BAND_COLORS[band].bg}/${CEFR_BAND_COLORS[band].text}`);
    expect(new Set(swatches).size).toBe(CEFR_LADDER.length);
  });

  it('does not reuse the unknown chip for a real band', () => {
    for (const band of CEFR_LADDER) {
      expect(CEFR_BAND_COLORS[band].text).not.toBe(CEFR_BAND_COLORS_UNKNOWN.text);
    }
  });
});
