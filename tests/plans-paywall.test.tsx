/**
 * Render tests for the paywall's two ways out.
 *
 * 1. The deliberate one. A free tier exists, so declining is a supported
 *    choice and "Continue on the free plan" must be on screen from the first
 *    frame — no timer, no fade-in. That is both the product decision and the
 *    App Review 3.1.1 safe shape, and it is easy to lose in a redesign.
 *
 * 2. The failure one. If the store has nothing to sell — no IAP on the build,
 *    the offerings call failed, or the offering came back empty — the learner
 *    must still get through. `blocked` is what does that.
 *
 * eas.json still carries placeholder RevenueCat keys (LAUNCH-READINESS-AUDIT
 * P0), so "no IAP on this build" is the state that ships today.
 *
 * NOT colocated, unlike every other test in this repo: expo-router's
 * require.context globs *every* .tsx under app/ into the bundle (it excludes
 * only +api/+html/+middleware), so a `*.test.tsx` living beside the screen
 * ships to the device and dies on `jest.mock` at startup. Tests for anything
 * under app/ have to live outside it.
 */
import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';

import PlansScreen from '../app/(app)/plans';

jest.mock('react-native-purchases', () => ({ __esModule: true, default: {}, LOG_LEVEL: { WARN: 1 } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../components/ui/GlowBackground', () => ({ GlowLayer: 'GlowLayer' }));
jest.mock('../lib/analytics', () => ({ trackEvent: jest.fn() }));

// The UI 2.0 primitives the screen now uses animate and buzz, so they reach for
// two native modules that do not exist under jest. Same stand-ins as
// components/ui2/ui2-primitives.test.tsx: a shared value is a plain box, an
// animated style is its factory evaluated once, and a spring settles instantly.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withSpring: (to: number) => to,
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
  };
});

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, canGoBack: mockCanGoBack }),
}));

jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

/**
 * `idealL2Self` on the mocked profile is what picks between the screen's two
 * copy paths, so it is mutable per test rather than baked into the factory.
 * `null` — every account before migration 028, and anyone who skipped the
 * onboarding question — is the default, because that is the path that must
 * keep working unchanged.
 */
let mockIdealL2Self: string | null = null;

// The screen destructures the whole store; the selector form is supported too
// so this mock keeps working if that changes.
jest.mock('../stores/useAppStore', () => {
  const state = {
    subscription: null,
    entitledTier: null,
    get profile() {
      return { idealL2Self: mockIdealL2Self };
    },
    refreshSubscription: jest.fn(),
    setEntitledTier: jest.fn(),
  };
  return {
    useAppStore: (selector?: (s: unknown) => unknown) =>
      typeof selector === 'function' ? selector(state) : state,
    effectiveTier: () => 'starter',
  };
});

const mockGetOfferingPackages = jest.fn();
const mockIsPurchasesAvailable = jest.fn();
jest.mock('../lib/purchases', () => ({
  getOfferingPackages: (...a: unknown[]) => mockGetOfferingPackages(...a),
  isPurchasesAvailable: () => mockIsPurchasesAvailable(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  tierFromPackage: () => 'premium',
  isAnnualPackage: () => true,
  isMonthlyPackage: () => false,
  annualSavingsPercent: () => 0,
  reportPurchaseFailure: jest.fn(),
}));

// The copy itself — and the numbers inside it — is pinned against `PLANS` in
// lib/plan-pricing.test.ts. Importing rather than retyping it here keeps this
// file about WHERE the copy renders and on which path, not about its wording.
import { PLAN_PROOF, FREE_EXIT_LINE } from '../lib/plan-pricing';

function texts(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root
    .findAll((n: ReactTestInstance) => typeof n.type === 'string', { deep: true })
    .flatMap((n) => (Array.isArray(n.children) ? n.children : []))
    .filter((c): c is string => typeof c === 'string')
    .join(' ');
}

async function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(<PlansScreen />);
  });
  return renderer;
}

/**
 * The Pressable composite carrying this label — matched on the composite, not
 * the host node it renders: RN's Pressable turns onPress into responder props
 * on the host, so the host has no onPress to call.
 */
function byLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
  return renderer.root.find(
    (n: ReactTestInstance) =>
      n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function',
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(false);
  mockIdealL2Self = null;
});

describe('free-plan exit', () => {
  /** One monthly rung, enough for the screen to render its selling state. */
  const pkg = {
    identifier: 'premium_annual',
    product: { price: 99.99, priceString: '$99.99', title: 'Premium' },
  };

  it('offers the free plan immediately, with no delay to unlock it', async () => {
    mockIsPurchasesAvailable.mockReturnValue(true);
    mockGetOfferingPackages.mockResolvedValue([pkg]);

    const renderer = await render();

    // Present on the very first render, not after a timer: a skip that appears
    // only after N seconds is the pattern App Review rejects, and the free tier
    // is a real product rather than a grudging concession.
    expect(byLabel(renderer, 'Continue on the free plan')).toBeTruthy();
  });

  it('leaves for the app when the free plan is chosen', async () => {
    mockIsPurchasesAvailable.mockReturnValue(true);
    mockGetOfferingPackages.mockResolvedValue([pkg]);

    const renderer = await render();
    await TestRenderer.act(async () =>
      byLabel(renderer, 'Continue on the free plan').props.onPress(),
    );

    // canGoBack is false here, which is the setup path: avatar-setup REPLACES
    // into the paywall, so there is nothing beneath it and back() would be a
    // silent no-op.
    expect(mockReplace).toHaveBeenCalledWith('/(app)');
  });

  it('says what the free plan actually costs the learner', async () => {
    mockIsPurchasesAvailable.mockReturnValue(true);
    mockGetOfferingPackages.mockResolvedValue([pkg]);

    const renderer = await render();

    // Declining has to be an informed choice, so the trade is stated next to
    // the link rather than discovered later on a locked screen. The exact
    // wording — and the fact that its one number is the real free-tier cap —
    // is pinned in lib/plan-pricing.test.ts; here we only check it is on
    // screen, whole, beside the dismiss.
    expect(texts(renderer)).toContain(FREE_EXIT_LINE);
  });

  it('keeps the dismiss label neutral', async () => {
    mockIsPurchasesAvailable.mockReturnValue(true);
    mockGetOfferingPackages.mockResolvedValue([pkg]);
    mockIdealL2Self = 'Order dinner in Lyon without switching to English';

    const renderer = await render();

    // DESIGN.md §UX Psychology Principles §5 is binding: no guilt-labelled
    // escape hatch, on either copy path. Personalising the ask above must not
    // turn the way out into "I'll risk it".
    const all = texts(renderer);
    expect(all).toContain('Continue on the free plan');
    expect(all).not.toMatch(/risk|give up|lose your|miss out/i);
  });
});

/**
 * The two copy paths of the ask itself (design board P6).
 *
 * With an onboarding answer the screen leads with the learner's own sentence
 * and backs it with three claims about what a paid plan does WITH that
 * sentence. Without one — a pre-migration-028 account, or someone who skipped
 * the question — the generic advertising line has to survive untouched, which
 * is the half of this that a personalisation change quietly breaks.
 */
describe('headline and proof', () => {
  const pkg = {
    identifier: 'premium_annual',
    product: { price: 99.99, priceString: '$99.99', title: 'Premium' },
  };

  beforeEach(() => {
    mockIsPurchasesAvailable.mockReturnValue(true);
    mockGetOfferingPackages.mockResolvedValue([pkg]);
  });

  it('keeps the stock headline when there is no ideal-self answer', async () => {
    const renderer = await render();
    const all = texts(renderer);

    expect(all).toContain('Learning a language can now be done during your drive to work.');
    expect(all).toContain('HANDS-FREE VOICE PRACTICE');
    expect(all).not.toContain('YOUR PLAN IS READY');
  });

  it('keeps the old quote card when there is no ideal-self answer', async () => {
    const renderer = await render();
    const all = texts(renderer);

    expect(all).toContain('Learning a language has never been this easy.');
    expect(all).not.toContain(PLAN_PROOF[0].title);
  });

  it('keeps the universal title even when the learner gave a sentence (2026-09-11)', async () => {
    // The sentence used to become the headline. Tyler chose one title for
    // every learner; the sentence now only decides what sits under the tiers.
    mockIdealL2Self = 'Order dinner in Lyon without switching to English';

    const renderer = await render();
    const all = texts(renderer);

    expect(all).toContain('Learning a language can now be done during your drive to work.');
    expect(all).toContain('HANDS-FREE VOICE PRACTICE');
    expect(all).not.toContain('Order dinner in Lyon without switching to English');
    expect(all).not.toContain('YOUR PLAN IS READY');
  });

  it('never lets raw onboarding text reach the screen', async () => {
    // 300 chars of free text with newlines: with the headline universal it
    // must not appear anywhere, sanitised or not.
    mockIdealL2Self = `Talk to my\n\npartner’s   family ${'x'.repeat(300)}`;

    const renderer = await render();
    const all = texts(renderer);

    expect(all).not.toContain('Talk to my partner’s family');
    expect(all).not.toContain('\n\n');
  });

  it('swaps the quote card for the three proof rows', async () => {
    mockIdealL2Self = 'Order dinner in Lyon without switching to English';

    const renderer = await render();
    const all = texts(renderer);

    for (const row of PLAN_PROOF) {
      expect(all).toContain(row.title);
      expect(all).toContain(row.detail);
    }
    expect(all).not.toContain('Learning a language has never been this easy.');
  });

  it('reads each proof row as one label, with the tick silent', async () => {
    mockIdealL2Self = 'Order dinner in Lyon without switching to English';

    const renderer = await render();

    for (const row of PLAN_PROOF) {
      expect(
        renderer.root.findAll(
          (n: ReactTestInstance) =>
            n.props?.accessibilityLabel === `${row.title}. ${row.detail}`,
          { deep: true },
        ).length,
      ).toBeGreaterThan(0);
    }
  });

  it('adds no countdown, timer or delayed skip on either path', async () => {
    // Explicitly out of scope for this screen, and the pattern App Review
    // rejects under 3.1.1. Checked on the personalised path because that is
    // the one where urgency copy would be tempting.
    mockIdealL2Self = 'Order dinner in Lyon without switching to English';

    const renderer = await render();
    const all = texts(renderer);

    expect(all).not.toMatch(/\bends in\b|\bexpires\b|left today|limited time|\bhurry\b/i);
    expect(byLabel(renderer, 'Continue on the free plan')).toBeTruthy();
  });
});

describe('paywall review-safety escape', () => {
  it('lets the learner out when in-app purchase is unavailable on this build', async () => {
    mockIsPurchasesAvailable.mockReturnValue(false);
    mockGetOfferingPackages.mockResolvedValue([]);

    const renderer = await render();

    expect(texts(renderer)).toContain('Plans aren’t available right now');
    const cont = byLabel(renderer, 'Continue');
    await TestRenderer.act(async () => cont.props.onPress());
    expect(mockReplace).toHaveBeenCalledWith('/(app)');
  });

  it('lets the learner out when the offerings call fails', async () => {
    mockIsPurchasesAvailable.mockReturnValue(true);
    mockGetOfferingPackages.mockRejectedValue(new Error('network down'));

    const renderer = await render();

    expect(texts(renderer)).toContain('Plans aren’t available right now');
    expect(byLabel(renderer, 'Continue')).toBeTruthy();
  });

  it('lets the learner out when the offering is configured but empty', async () => {
    mockIsPurchasesAvailable.mockReturnValue(true);
    mockGetOfferingPackages.mockResolvedValue([]);

    const renderer = await render();

    expect(texts(renderer)).toContain('Plans aren’t available right now');
    expect(byLabel(renderer, 'Continue')).toBeTruthy();
  });

  it('prefers going back when there is somewhere to go back to', async () => {
    mockIsPurchasesAvailable.mockReturnValue(false);
    mockGetOfferingPackages.mockResolvedValue([]);
    mockCanGoBack.mockReturnValue(true);

    const renderer = await render();
    await TestRenderer.act(async () => byLabel(renderer, 'Continue').props.onPress());

    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows no purchase CTA at all while blocked', async () => {
    mockIsPurchasesAvailable.mockReturnValue(false);
    mockGetOfferingPackages.mockResolvedValue([]);

    const renderer = await render();

    // Nothing to buy means nothing that looks buyable — no trial promise, no
    // renewal disclosure, and no radio rungs.
    const all = texts(renderer);
    expect(all).not.toMatch(/free trial/i);
    expect(all).not.toMatch(/Cancel anytime/);
    expect(
      renderer.root.findAll(
        (n: ReactTestInstance) => n.props?.accessibilityRole === 'radio',
        { deep: true },
      ),
    ).toHaveLength(0);
  });
});
