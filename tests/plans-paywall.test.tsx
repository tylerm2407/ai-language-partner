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

jest.mock('react-native-purchases', () => ({ __esModule: true, default: {}, LOG_LEVEL: { WARN: 1 } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../components/ui/GlowBackground', () => ({ GlowLayer: 'GlowLayer' }));
jest.mock('../lib/analytics', () => ({ trackEvent: jest.fn() }));

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, canGoBack: mockCanGoBack }),
}));

jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
// The screen destructures the whole store; the selector form is supported too
// so this mock keeps working if that changes.
jest.mock('../stores/useAppStore', () => {
  const state = {
    subscription: null,
    entitledTier: null,
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

import PlansScreen from '../app/(app)/plans';

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
    // the link rather than discovered later on a locked screen.
    const all = texts(renderer);
    expect(all).toMatch(/Lessons, reviews, reading and the daily news stay free/);
    expect(all).toMatch(/AI tutor and voice practice don’t/);
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
