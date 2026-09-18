import {
  formatReferralCode,
  isWellFormedReferralCode,
  normalizeReferralCode,
  redeemErrorMessage,
  referralShareMessage,
  rewardLabel,
} from './referrals';
import type { ReferralRedeemError, ReferralReward } from '../types';

const base: ReferralReward = {
  id: 'r1',
  status: 'holding',
  availableAt: '2026-09-24T12:00:00Z',
  deliveredAt: null,
  method: null,
  days: null,
};

describe('referral codes', () => {
  it('normalizes the way the server does', () => {
    expect(normalizeReferralCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(isWellFormedReferralCode('abcd 2345')).toBe(true);
  });

  it('rejects ambiguous characters and wrong lengths', () => {
    expect(isWellFormedReferralCode('ABCD0345')).toBe(false); // 0
    expect(isWellFormedReferralCode('ABCDI345')).toBe(false); // I
    expect(isWellFormedReferralCode('ABC2345')).toBe(false);
  });

  it('formats for reading aloud and puts it in the share text', () => {
    expect(formatReferralCode('ABCD2345')).toBe('ABCD-2345');
    expect(referralShareMessage('ABCD2345')).toContain('ABCD-2345');
    expect(referralShareMessage('ABCD2345')).toContain('https://apps.apple.com/');
  });
});

describe('redeemErrorMessage', () => {
  it('has copy for every refusal the server returns', () => {
    const all: ReferralRedeemError[] = [
      'INVALID_CODE', 'OWN_CODE', 'ALREADY_REFERRED', 'ALREADY_SUBSCRIBED', 'TOO_LATE', 'RATE_LIMITED',
    ];
    for (const e of all) expect(redeemErrorMessage(e).length).toBeGreaterThan(10);
  });
});

describe('rewardLabel', () => {
  const now = new Date('2026-09-17T12:00:00Z');

  it('counts down the hold in whole days', () => {
    expect(rewardLabel(base, now)).toContain('7 days');
    expect(rewardLabel({ ...base, availableAt: '2026-09-17T18:00:00Z' }, now)).toContain('1 day.');
  });

  it('says what was delivered', () => {
    expect(rewardLabel({ ...base, status: 'delivered', method: 'apple_extension', days: 15 }, now))
      .toBe('15 free days added to your subscription.');
    expect(rewardLabel({ ...base, status: 'delivered', method: 'revenuecat_promo', days: 30 }, now))
      .toBe('30 days of Premium added.');
  });

  it('explains a voided reward', () => {
    expect(rewardLabel({ ...base, status: 'void' }, now)).toContain('refunded');
  });
});
