/**
 * Render tests for the hard paywall's review-safety escape.
 *
 * The 7c paywall is a gate with no skip button, which makes one failure mode
 * fatal: if the store has nothing to sell — no IAP on the build, the offerings
 * call failed, or the offering came back empty — the learner is standing in
 * front of a wall with no door. That is an App Review 3.1.1 rejection and a
 * dead app for anyone who hits it in the wild, so `blocked` is load-bearing
 * and deserves a test that does not depend on the device.
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
  const state = { subscription: null, refreshSubscription: jest.fn() };
  return {
    useAppStore: (selector?: (s: unknown) => unknown) =>
      typeof selector === 'function' ? selector(state) : state,
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
