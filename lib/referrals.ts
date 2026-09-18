/**
 * Referrals — the copy and the small rules the invite screen shows.
 *
 * Everything that decides money lives on the server (migration 148 and the
 * referral-rewards function). This file only explains it, so the numbers
 * here MUST match those: a 7-day hold, 30 days on Basic/Premium, 15 on VIP,
 * 30 days of Premium for anyone not paying.
 */
import type { ReferralRedeemError, ReferralReward } from '../types';
import { APP_STORE_URL } from '../config/app';

export const REFERRAL_HOLD_DAYS = 7;

/** Same alphabet as the server: no 0/O/1/I. */
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

/** Upper-case and strip spaces/dashes, the way the server reads it. */
export function normalizeReferralCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function isWellFormedReferralCode(input: string): boolean {
  return CODE_RE.test(normalizeReferralCode(input));
}

/** "ABCD2345" → "ABCD-2345", easier to read aloud. Display only. */
export function formatReferralCode(code: string): string {
  const c = normalizeReferralCode(code);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export function referralShareMessage(code: string): string {
  return (
    `I'm learning a language with Fluenci. Download it and enter my invite code ` +
    `${formatReferralCode(code)} when you join: ${APP_STORE_URL}`
  );
}

export function redeemErrorMessage(error: ReferralRedeemError): string {
  switch (error) {
    case 'INVALID_CODE':
      return "That code doesn't match anyone. Check it and try again.";
    case 'OWN_CODE':
      return "That's your own code. Share it with a friend instead.";
    case 'ALREADY_REFERRED':
      return "You've already used an invite code.";
    case 'ALREADY_SUBSCRIBED':
      return 'Invite codes are for new members, and you have already subscribed.';
    case 'TOO_LATE':
      return 'Invite codes can only be entered in your first 30 days.';
    case 'RATE_LIMITED':
      return 'Too many tries. Wait an hour and try again.';
  }
}

/** One line per earned reward, newest first on the screen. */
export function rewardLabel(reward: ReferralReward, now: Date = new Date()): string {
  switch (reward.status) {
    case 'holding': {
      const ms = Date.parse(reward.availableAt) - now.getTime();
      const days = Math.max(1, Math.ceil(ms / 86_400_000));
      return `A friend subscribed. Your reward arrives in ${days} ${days === 1 ? 'day' : 'days'}.`;
    }
    case 'ready':
    case 'delivering':
      return 'A friend subscribed. Your reward is on its way.';
    case 'delivered':
      if (reward.method === 'apple_extension' && reward.days) {
        return `${reward.days} free days added to your subscription.`;
      }
      return `${reward.days ?? 30} days of Premium added.`;
    case 'void':
      return 'A friend’s subscription was refunded, so this one didn’t count.';
    case 'needs_attention':
      return 'We’re sorting out this reward. Contact support if it hasn’t arrived in a few days.';
  }
}

/** The rules, as the learner reads them. */
export const REFERRAL_RULES: readonly string[] = [
  'Share your code. Your friend enters it when they join.',
  `When they start a paid plan, your reward arrives ${REFERRAL_HOLD_DAYS} days later.`,
  'On Basic or Premium: a month free. On VIP: half a month free.',
  'Not subscribed? You get a month of Premium.',
];
