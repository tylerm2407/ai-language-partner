import { MASTERY_RATE, MIN_ITEMS_PER_BAND, MIN_MATURE_ITEMS_PER_BAND, type BandBreakdown } from './cefr-proficiency';
import { nextBandAfter, nextBandProgress } from './next-band-progress';

function band(partial: Partial<BandBreakdown> & { band: BandBreakdown['band'] }): BandBreakdown {
  return { seen: 0, mature: 0, retained: 0, retentionRate: 0, status: 'insufficient', ...partial };
}

describe('nextBandAfter', () => {
  it('walks the ladder and stops at C2', () => {
    expect(nextBandAfter('A1')).toBe('A2');
    expect(nextBandAfter('B2')).toBe('C1');
    expect(nextBandAfter('C2')).toBeNull();
  });
});

describe('nextBandProgress', () => {
  it('is 0 when the next band has never been touched', () => {
    expect(nextBandProgress('A2', [])).toEqual({ current: 'A2', next: 'B1', fraction: 0, percent: 0 });
  });

  it('is full only at the top band', () => {
    expect(nextBandProgress('C2', [])).toEqual({ current: 'C2', next: null, fraction: 1, percent: 100 });
  });

  it('gives each gate a third and caps each at full', () => {
    // Seen gate met twice over, nothing mature: exactly one third.
    const seenOnly = nextBandProgress('A2', [band({ band: 'B1', seen: MIN_ITEMS_PER_BAND * 2 })]);
    expect(seenOnly.percent).toBe(33);
    // Half the seen gate, nothing else: a sixth.
    const halfSeen = nextBandProgress('A2', [band({ band: 'B1', seen: MIN_ITEMS_PER_BAND / 2 })]);
    expect(halfSeen.percent).toBe(16);
  });

  it('measures retention against the mature set, as the band rule does', () => {
    const mature = MIN_MATURE_ITEMS_PER_BAND;
    const needed = Math.ceil(mature * MASTERY_RATE);
    const p = nextBandProgress('A2', [band({ band: 'B1', seen: MIN_ITEMS_PER_BAND, mature, retained: needed })]);
    // All three gates met on vocabulary — but the band is not confirmed, so never 100.
    expect(p.percent).toBe(99);
    expect(p.fraction).toBeLessThan(1);
  });

  it('never reaches 100 while a next band exists, whatever the counts say', () => {
    const p = nextBandProgress('B1', [band({ band: 'B2', seen: 10_000, mature: 10_000, retained: 10_000 })]);
    expect(p.percent).toBe(99);
  });

  it('floors rather than rounds up', () => {
    // 19 of 20 seen, nothing else: 0.95 / 3 = 0.3166… → 31, not 32.
    const p = nextBandProgress('A1', [band({ band: 'A2', seen: MIN_ITEMS_PER_BAND - 1 })]);
    expect(p.percent).toBe(31);
  });

  it('ignores breakdowns for other bands', () => {
    const p = nextBandProgress('A2', [band({ band: 'C1', seen: 999, mature: 999, retained: 999 })]);
    expect(p.percent).toBe(0);
  });
});
