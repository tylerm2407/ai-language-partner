/**
 * The decisions behind the language switcher's paid-feature steps, and the
 * pick-what-to-keep sheet (migration 147). Pure, so every branch can be
 * asserted without rendering a sheet.
 *
 * THE RULES (decided by the owner, enforced by the server):
 *  - Free keeps one language open. Starting another locks the current one; a
 *    locked language keeps its level, lessons and deck but cannot be reopened
 *    on the free plan — only by upgrading.
 *  - A paid plan has no limit, and tapping a locked language just switches.
 *  - A paid plan that lapses with several open languages must pick which to
 *    keep before switching works again.
 *
 * The client never decides any of this. It reads `LanguageAccess` to choose
 * which step to SHOW, and when the server refuses anyway (its answer is the
 * one that holds) the refusal code picks the step instead.
 */
import {
  canOpenAnother,
  isUnlimitedLanguages,
  type LanguageAccess,
  type LanguageAccessRefusal,
} from './language-access';
import type { LanguageCode } from '../types';

/**
 * Where the switcher sheet is.
 *  - `limit`        adding is a paid feature: Upgrade, or switch instead
 *  - `locked`       a locked language the plan cannot reopen: Upgrade
 *  - `confirm-lock` the last step of "switch instead": says what gets locked
 *  - `activating`   back from a purchase the server has not seen yet
 */
export type SwitcherStep =
  | 'list'
  | 'pick-language'
  | 'pick-level'
  | 'limit'
  | 'locked'
  | 'confirm-lock'
  | 'activating';

/**
 * Why the learner is picking a new language: an ordinary add (the plan has
 * room), or the free plan's "switch instead", which locks the current one.
 */
export type AddMode = 'add' | 'switch-instead';

/**
 * What tapping "Add a language" does. Null while the allowance is unknown:
 * null access means the read has not landed or failed, and guessing either
 * way would be a claim about the learner's plan that nothing backs.
 */
export function stepForAddTapped(access: LanguageAccess | null): 'pick-language' | 'limit' | null {
  if (!access) return null;
  return canOpenAnother(access) ? 'pick-language' : 'limit';
}

/**
 * What tapping a locked language does: switch to it when the plan has room
 * (the server reopens it), otherwise show the upgrade path — never attempt a
 * switch the server is certain to refuse. Null while access is unknown.
 */
export function actionForLockedTapped(access: LanguageAccess | null): 'switch' | 'locked' | null {
  if (!access) return null;
  return canOpenAnother(access) ? 'switch' : 'locked';
}

/**
 * What a server refusal turns into. `resolve` is not a step of this sheet:
 * the plan lapsed, and the app-wide keep sheet takes over.
 */
export type RefusalOutcome =
  | { kind: 'step'; step: 'limit' | 'locked' }
  | { kind: 'resolve' };

export function outcomeForRefusal(refusal: LanguageAccessRefusal): RefusalOutcome {
  switch (refusal) {
    case 'limit':
      return { kind: 'step', step: 'limit' };
    case 'locked':
      return { kind: 'step', step: 'locked' };
    case 'resolve':
      return { kind: 'resolve' };
  }
}

/** The step Back leads to. */
export function previousStep(step: SwitcherStep, mode: AddMode): SwitcherStep {
  switch (step) {
    case 'pick-language':
      // "Switch instead" came from the limit step; going back there keeps
      // the choice in front of the learner rather than dropping it.
      return mode === 'switch-instead' ? 'limit' : 'list';
    case 'pick-level':
      return 'pick-language';
    case 'confirm-lock':
      return 'pick-level';
    default:
      return 'list';
  }
}

/**
 * What the sheet does after the learner comes back from the paywall and
 * access has been re-read.
 *  - `resume`     the plan now has room: carry on with what they wanted
 *  - `activating` the device holds a paid entitlement but the server still
 *                 says no — the RevenueCat webhook has not landed. Say so and
 *                 offer a retry, never the paywall again (that is a loop).
 *  - `declined`   still on the free plan: back to the step they left from
 *  - `unknown`    the re-read failed; the sheet shows its ordinary error
 */
export type UpgradeReturn = 'resume' | 'activating' | 'declined' | 'unknown';

export function upgradeReturnOutcome(
  access: LanguageAccess | null,
  devicePaid: boolean,
  lockedTarget: LanguageCode | null,
): UpgradeReturn {
  if (!access) return 'unknown';
  // A locked language the learner wanted back needs room like any add does.
  // The target is checked only for "still locked": if something else already
  // reopened it, resuming is still the right move.
  const room = canOpenAnother(access) || (lockedTarget !== null && access.open.includes(lockedTarget));
  if (room && !access.overLimit) return 'resume';
  return devicePaid ? 'activating' : 'declined';
}

/**
 * The line under a locked language. Says what was kept and, honestly, what
 * reopening it takes on this plan.
 */
export function lockedSubtitle(access: LanguageAccess | null): string {
  const kept = 'Locked · level, lessons and reviews are saved';
  if (!access) return kept;
  return canOpenAnother(access) ? `${kept}. Tap to reopen.` : `${kept}. Reopens with a paid plan.`;
}

/**
 * The note under the switcher's list. The first sentence is true on every
 * plan; the second is only said when the plan's allowance is known.
 */
export function switcherFooterNote(access: LanguageAccess | null): string {
  const base =
    'Your plan, your daily minutes and your reviews-per-day carry across every language you study. ' +
    'Each language keeps its own level, lessons and review deck.';
  if (!access || isUnlimitedLanguages(access)) return base;
  if (access.maxLanguages === 1) {
    return (
      `${base} Your plan keeps one language open at a time: starting another locks the one you are on, ` +
      'and studying several at once is part of the paid plans.'
    );
  }
  return `${base} Your plan keeps up to ${access.maxLanguages} languages open at a time.`;
}

// ─── Pick what to keep ──────────────────────────────────────────────────────

/**
 * The languages preselected when the keep sheet opens: the active one first
 * (it is what the learner is studying right now), then the most recently
 * practised, up to the allowance.
 */
export function initialKeepSelection(access: LanguageAccess, active: LanguageCode | null): LanguageCode[] {
  const ordered =
    active && access.open.includes(active) ? [active, ...access.open.filter((l) => l !== active)] : access.open;
  return ordered.slice(0, Math.max(1, access.maxLanguages));
}

/**
 * Toggle one language in the keep selection.
 *  - selected → deselected
 *  - unselected with room → added
 *  - unselected and full → with an allowance of one, it REPLACES the choice
 *    (a radio group); with more, nothing changes — silently dropping one the
 *    learner picked earlier would be a choice made for them.
 */
export function toggleKeep(selection: LanguageCode[], language: LanguageCode, max: number): LanguageCode[] {
  if (selection.includes(language)) return selection.filter((l) => l !== language);
  if (selection.length < max) return [...selection, language];
  if (max === 1) return [language];
  return selection;
}

export function canConfirmKeep(selection: LanguageCode[], max: number): boolean {
  return selection.length >= 1 && selection.length <= max;
}

/**
 * The order sent to `keep_languages`. The server moves the account to the
 * FIRST kept language when the active one is not kept, so the most recently
 * practised goes first rather than whichever was tapped first.
 */
export function orderKeepSelection(selection: LanguageCode[], access: LanguageAccess): LanguageCode[] {
  const rank = (l: LanguageCode) => {
    const i = access.open.indexOf(l);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...selection].sort((a, b) => rank(a) - rank(b));
}

// ─── The paywall round trip ─────────────────────────────────────────────────

/**
 * A sheet hides itself while the paywall is open (a Modal would cover the
 * screen) and has to notice when the learner comes back.
 *  - `idle`    not at the paywall
 *  - `leaving` the push was requested, the paywall is not on screen yet
 *  - `away`    the paywall is on screen
 * `leaving` exists because the push lands a render later: without it the
 * first render after the tap would read "not on the paywall" as "back".
 */
export type PaywallTrip = 'idle' | 'leaving' | 'away';

export function advancePaywallTrip(
  trip: PaywallTrip,
  signal: { onPaywall: boolean; hostFocused: boolean },
): { trip: PaywallTrip; returned: boolean } {
  if (trip === 'leaving' && signal.onPaywall) return { trip: 'away', returned: false };
  if (trip === 'away' && !signal.onPaywall && signal.hostFocused) return { trip: 'idle', returned: true };
  return { trip, returned: false };
}

/** The pathname `usePathname()` reports while the paywall is on screen. */
export const PAYWALL_PATHNAME = '/plans';
