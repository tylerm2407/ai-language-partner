/**
 * Free-trial timeline — the "honest paywall" pattern.
 *
 * The most common complaint across this category's negative reviews is billing:
 * users who did not realise a trial would convert, could not find the cancel
 * path, or believed the app was free outright. Blinkist's published fix was to
 * stop hiding the mechanics and draw them — what happens today, when the
 * reminder lands, when the card is charged — and they reported materially
 * higher conversion alongside far fewer complaints, because the objection being
 * removed ("I'll forget and get charged") was the one actually blocking the sale.
 *
 * This module holds only the step math so it can be tested without rendering.
 */

export interface TrialStep {
  /** Day offset from the trial start. */
  day: number;
  /** Ionicons glyph name. */
  icon: string;
  title: string;
  detail: string;
}

/** Reminder lands two days before billing, or on day 1 for very short trials. */
export const REMINDER_LEAD_DAYS = 2;

/**
 * Build the three-step timeline for a trial of `trialDays`.
 *
 * @param trialDays Length of the free trial in days. Must be >= 1.
 * @param priceString Localized renewal price, e.g. "$59.99".
 */
export function trialTimelineSteps(trialDays: number, priceString: string): TrialStep[] {
  const days = Math.max(1, Math.floor(trialDays));
  // On a 1- or 2-day trial there is no room for a 2-day lead; land the reminder
  // on day 1 rather than emitting a step at day 0 or a negative day.
  const reminderDay = Math.max(1, days - REMINDER_LEAD_DAYS);

  return [
    {
      day: 0,
      icon: 'lock-open-outline',
      title: 'Today',
      detail: 'Full access starts. You are not charged.',
    },
    {
      day: reminderDay,
      icon: 'notifications-outline',
      title: `Day ${reminderDay}`,
      detail: 'We remind you the trial is ending, so nothing is a surprise.',
    },
    {
      day: days,
      icon: 'card-outline',
      title: `Day ${days}`,
      detail: `Your trial ends and ${priceString} is charged. Cancel any time before this.`,
    },
  ];
}

/** Convert a RevenueCat intro-price period into days. Returns null if not a trial. */
export function trialDaysFromPeriod(
  periodUnit: string | null | undefined,
  periodNumberOfUnits: number | null | undefined
): number | null {
  if (!periodUnit || !periodNumberOfUnits || periodNumberOfUnits <= 0) return null;
  switch (periodUnit.toUpperCase()) {
    case 'DAY':
      return periodNumberOfUnits;
    case 'WEEK':
      return periodNumberOfUnits * 7;
    case 'MONTH':
      return periodNumberOfUnits * 30;
    case 'YEAR':
      return periodNumberOfUnits * 365;
    default:
      return null;
  }
}
