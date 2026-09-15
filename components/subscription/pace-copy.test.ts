/**
 * The T4 tier row's badge and line come from lib/plans.ts, never typed in.
 */
import { PLANS, paceCopy } from '../../lib/plans';

describe('paceCopy', () => {
  it('shows Basic’s real daily cap as the badge', () => {
    expect(paceCopy('basic')).toEqual({ badge: String(PLANS.basic.dailyNewCards), line: 'new words a day' });
    expect(paceCopy('basic').badge).toBe('20');
  });

  it('shows no ceiling above Basic', () => {
    expect(paceCopy('premium')).toEqual({ badge: '∞', line: 'no word ceiling' });
    expect(paceCopy('vip')).toEqual({ badge: '∞', line: 'no word ceiling' });
  });
});
