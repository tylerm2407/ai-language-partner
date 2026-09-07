/**
 * Unit tests for the floating tab bar's geometry and its visibility rule.
 *
 * Both are pure functions on purpose. There is no component-render harness for
 * navigation in this project, so a wrong pill width or a tab bar left on top of
 * a live call is otherwise only discoverable by looking at a device — and the
 * call case is discoverable by stranding a peer connection while you look.
 */

import {
  tabPillWidth,
  floatingTabBarSpace,
  hidesTabBar,
  VISIBLE_TABS,
  TAB_ICONS,
  FULL_SCREEN_ROUTES,
  type FocusedRouteState,
} from './FloatingTabBar';

describe('pill geometry', () => {
  it('is 296px wide for the five tabs the app actually has', () => {
    expect(tabPillWidth(5)).toBe(296);
  });

  it('keeps the pre-tutor width for four', () => {
    // The four-icon entry stays measured so this arithmetic is comparable:
    // 240 gave a 12.8px gap, 296 gives 12.667. That near-identity is the
    // reason the other four tabs did not visibly move.
    expect(tabPillWidth(4)).toBe(240);
  });

  it('leaves a gap wide enough to keep two 40px circles apart', () => {
    // space-evenly: (width - count * 44) / (count + 1).
    const gap = (tabPillWidth(5) - 5 * 44) / 6;
    expect(gap).toBeCloseTo(12.667, 3);
    // 296 was chosen against 240, which would have left 3.33px here.
    expect(gap).toBeGreaterThan(8);
  });

  it('stays on the 8pt grid', () => {
    expect(tabPillWidth(5) % 8).toBe(0);
  });

  it('refuses a tab count nobody has measured', () => {
    // The point of the lookup: a sixth tab must not silently cramp the fifth.
    expect(() => tabPillWidth(6)).toThrow(/no measured pill width/);
  });

  it('reserves the same vertical space as before the pill was widened', () => {
    // Every screen that pins content to the bottom hard-codes nothing and
    // calls this instead; changing it would move all of them.
    expect(floatingTabBarSpace()).toBe(64);
  });
});

describe('tab membership', () => {
  it('has exactly five visible tabs', () => {
    expect(VISIBLE_TABS).toHaveLength(5);
  });

  it('includes the tutor tab', () => {
    expect(VISIBLE_TABS).toContain('tutor');
  });

  it.each(VISIBLE_TABS)('"%s" has an icon pair', (name) => {
    expect(TAB_ICONS[name]).toBeDefined();
    expect(typeof TAB_ICONS[name].active).toBe('string');
    expect(typeof TAB_ICONS[name].inactive).toBe('string');
  });

  it.each(VISIBLE_TABS)('"%s" switches glyph on focus rather than only recolouring', (name) => {
    // Design rule: the active state is a different icon, not the same icon in
    // a different colour. A colour-only change is the one that disappears for
    // anyone who cannot separate indigo from slate.
    expect(TAB_ICONS[name].active).not.toBe(TAB_ICONS[name].inactive);
  });

  it('has a measured pill width for the number of tabs it declares', () => {
    expect(() => tabPillWidth(VISIBLE_TABS.length)).not.toThrow();
  });
});

/** A tabs state with `focused` selected, optionally sitting on a nested screen. */
function tabsState(focused: string, nested?: string): FocusedRouteState {
  const index = VISIBLE_TABS.indexOf(focused);
  return {
    index,
    routes: VISIBLE_TABS.map((name) => ({
      name,
      state: name === focused && nested ? { index: 0, routes: [{ name: nested }] } : undefined,
    })),
  };
}

describe('hidesTabBar', () => {
  it('shows the bar on every tab root', () => {
    for (const name of VISIBLE_TABS) {
      expect(hidesTabBar(tabsState(name))).toBe(false);
    }
  });

  it('shows the bar in the tutor lobby', () => {
    expect(hidesTabBar(tabsState('tutor', 'index'))).toBe(false);
  });

  it('hides the bar on the live call screen', () => {
    expect(hidesTabBar(tabsState('tutor', 'call'))).toBe(true);
  });

  it('does not hide on a same-named screen under a different tab', () => {
    // The rule is path-based, not name-based: `chat/call` is not the tutor call.
    expect(hidesTabBar(tabsState('chat', 'call'))).toBe(false);
  });

  it('does not hide on a tutor screen that is not the call', () => {
    expect(hidesTabBar(tabsState('tutor', 'history'))).toBe(false);
  });

  it('falls back to the first route when a nested navigator has no index yet', () => {
    // Nested state is partial while the child navigator is still mounting.
    expect(
      hidesTabBar({ index: 2, routes: [...tabsState('tutor').routes.slice(0, 2), { name: 'tutor', state: { routes: [{ name: 'call' }] } }] }),
    ).toBe(true);
  });

  it('shows the bar for an empty or absent state rather than vanishing', () => {
    expect(hidesTabBar(undefined)).toBe(false);
    expect(hidesTabBar({ index: 0, routes: [] })).toBe(false);
  });

  it('lists the call screen as the only full-screen route', () => {
    expect(FULL_SCREEN_ROUTES).toEqual(['tutor/call']);
  });
});
