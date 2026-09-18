import {
  actionForLockedTapped,
  advancePaywallTrip,
  canConfirmKeep,
  initialKeepSelection,
  lockedSubtitle,
  orderKeepSelection,
  outcomeForRefusal,
  previousStep,
  stepForAddTapped,
  switcherFooterNote,
  toggleKeep,
  upgradeReturnOutcome,
} from './language-limit-flow';
import { UNLIMITED_LANGUAGES, type LanguageAccess } from './language-access';
import { onLanguageAccessCheck, requestLanguageAccessCheck } from './language-access-events';

const free: LanguageAccess = { maxLanguages: 1, open: ['es'], locked: ['fr'], overLimit: false };
const paid: LanguageAccess = { maxLanguages: UNLIMITED_LANGUAGES, open: ['es'], locked: ['fr'], overLimit: false };
const lapsed: LanguageAccess = { maxLanguages: 1, open: ['ja', 'es', 'fr'], locked: [], overLimit: true };

describe('Add a language', () => {
  it('goes straight to the picker when the plan has room', () => {
    expect(stepForAddTapped(paid)).toBe('pick-language');
  });
  it('shows the limit step on the free plan', () => {
    expect(stepForAddTapped(free)).toBe('limit');
  });
  it('does not guess when the allowance is unknown', () => {
    expect(stepForAddTapped(null)).toBeNull();
  });
  it('the free plan with nothing open yet has room', () => {
    expect(stepForAddTapped({ ...free, open: [] })).toBe('pick-language');
  });
});

describe('tapping a locked language', () => {
  it('switches on a paid plan', () => {
    expect(actionForLockedTapped(paid)).toBe('switch');
  });
  it('shows the upgrade path on the free plan, never a doomed switch', () => {
    expect(actionForLockedTapped(free)).toBe('locked');
  });
  it('does nothing while the allowance is unknown', () => {
    expect(actionForLockedTapped(null)).toBeNull();
  });
});

describe('server refusals', () => {
  it('maps each code to its step or to the keep sheet', () => {
    expect(outcomeForRefusal('limit')).toEqual({ kind: 'step', step: 'limit' });
    expect(outcomeForRefusal('locked')).toEqual({ kind: 'step', step: 'locked' });
    expect(outcomeForRefusal('resolve')).toEqual({ kind: 'resolve' });
  });
});

describe('Back', () => {
  it('walks the switch-instead path back to the limit step', () => {
    expect(previousStep('confirm-lock', 'switch-instead')).toBe('pick-level');
    expect(previousStep('pick-level', 'switch-instead')).toBe('pick-language');
    expect(previousStep('pick-language', 'switch-instead')).toBe('limit');
  });
  it('an ordinary add goes back to the list', () => {
    expect(previousStep('pick-language', 'add')).toBe('list');
  });
  it('the wall steps go back to the list', () => {
    expect(previousStep('limit', 'add')).toBe('list');
    expect(previousStep('locked', 'add')).toBe('list');
    expect(previousStep('activating', 'add')).toBe('list');
  });
});

describe('coming back from the paywall', () => {
  it('resumes when the server now has room', () => {
    expect(upgradeReturnOutcome(paid, true, null)).toBe('resume');
  });
  it('says the upgrade is activating when the device is paid and the server is not', () => {
    expect(upgradeReturnOutcome(free, true, null)).toBe('activating');
  });
  it('returns to the wall when the learner did not buy', () => {
    expect(upgradeReturnOutcome(free, false, null)).toBe('declined');
  });
  it('resumes a locked language that something else already reopened', () => {
    expect(upgradeReturnOutcome({ ...free, open: ['fr'], locked: ['es'] }, false, 'fr')).toBe('resume');
  });
  it('is unknown when the re-read failed', () => {
    expect(upgradeReturnOutcome(null, true, null)).toBe('unknown');
  });
  it('never resumes into a lapsed plan', () => {
    expect(upgradeReturnOutcome(lapsed, true, 'fr')).toBe('activating');
  });
});

describe('copy', () => {
  it('a locked row says what reopening takes on this plan', () => {
    expect(lockedSubtitle(free)).toMatch(/paid plan/);
    expect(lockedSubtitle(paid)).toMatch(/Tap to reopen/);
    expect(lockedSubtitle(null)).toBe('Locked · level, lessons and reviews are saved');
  });
  it('the footer only states a limit that is known', () => {
    expect(switcherFooterNote(null)).not.toMatch(/at a time/);
    expect(switcherFooterNote(paid)).not.toMatch(/at a time/);
    expect(switcherFooterNote(free)).toMatch(/one language open at a time/);
    expect(switcherFooterNote({ ...free, maxLanguages: 3 })).toMatch(/up to 3 languages/);
  });
});

describe('pick what to keep', () => {
  it('preselects the active language', () => {
    expect(initialKeepSelection(lapsed, 'es')).toEqual(['es']);
  });
  it('falls back to the most recently practised when the active one is not open', () => {
    expect(initialKeepSelection(lapsed, 'de')).toEqual(['ja']);
    expect(initialKeepSelection(lapsed, null)).toEqual(['ja']);
  });
  it('fills up to the allowance, active first', () => {
    expect(initialKeepSelection({ ...lapsed, maxLanguages: 2 }, 'fr')).toEqual(['fr', 'ja']);
  });

  it('with an allowance of one, a tap replaces the choice', () => {
    expect(toggleKeep(['es'], 'ja', 1)).toEqual(['ja']);
  });
  it('with more, a full selection ignores a new tap rather than dropping one', () => {
    expect(toggleKeep(['es', 'ja'], 'fr', 2)).toEqual(['es', 'ja']);
  });
  it('adds while there is room and removes on a second tap', () => {
    expect(toggleKeep(['es'], 'ja', 2)).toEqual(['es', 'ja']);
    expect(toggleKeep(['es', 'ja'], 'es', 2)).toEqual(['ja']);
  });

  it('confirms only a non-empty selection within the allowance', () => {
    expect(canConfirmKeep([], 1)).toBe(false);
    expect(canConfirmKeep(['es'], 1)).toBe(true);
    expect(canConfirmKeep(['es', 'ja'], 1)).toBe(false);
  });

  it('sends the most recently practised first', () => {
    expect(orderKeepSelection(['fr', 'ja'], { ...lapsed, maxLanguages: 2 })).toEqual(['ja', 'fr']);
  });
});

describe('the paywall round trip', () => {
  it('waits for the paywall to appear before watching for the return', () => {
    // The render right after the tap: the push has not landed yet.
    expect(advancePaywallTrip('leaving', { onPaywall: false, hostFocused: true })).toEqual({
      trip: 'leaving',
      returned: false,
    });
    expect(advancePaywallTrip('leaving', { onPaywall: true, hostFocused: false })).toEqual({
      trip: 'away',
      returned: false,
    });
  });
  it('returns only once the host screen is focused again', () => {
    expect(advancePaywallTrip('away', { onPaywall: false, hostFocused: false })).toEqual({
      trip: 'away',
      returned: false,
    });
    expect(advancePaywallTrip('away', { onPaywall: false, hostFocused: true })).toEqual({
      trip: 'idle',
      returned: true,
    });
  });
  it('is inert when idle', () => {
    expect(advancePaywallTrip('idle', { onPaywall: true, hostFocused: true })).toEqual({
      trip: 'idle',
      returned: false,
    });
  });
});

describe('access re-check signal', () => {
  it('reaches every listener until it unsubscribes', () => {
    const a = jest.fn();
    const b = jest.fn();
    const offA = onLanguageAccessCheck(a);
    const offB = onLanguageAccessCheck(b);
    requestLanguageAccessCheck();
    offA();
    requestLanguageAccessCheck();
    offB();
    requestLanguageAccessCheck();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});
