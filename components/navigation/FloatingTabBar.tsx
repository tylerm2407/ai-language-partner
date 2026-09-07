/**
 * FloatingTabBar — a 56px-tall pill, 40px active circle, 44pt hit targets.
 *
 * The BlurView + translucent fill are gone: the pill is an opaque `c.card`
 * with a 1px border, matching every other surface (and no longer smearing the
 * glow blobs behind it). That also drops the iOS/Android fork — both platforms
 * render identically.
 *
 * UI 2.0: the pill carries a 5px slab bottom edge. In dark, `card` already
 * separates from `bg` on its own; in LIGHT both are #FFFFFF, so a hairline
 * border is the only thing holding a white pill off a white screen. The slab
 * edge is how UI 2.0 makes depth everywhere else, and it is the reason the bar
 * still reads as a floating object once the phone is set to light. It eats 4px
 * of the pill's inner height (54 -> 50), which still clears the 44pt targets,
 * and it does not touch the width arithmetic below.
 *
 * The WIDTH is no longer a constant. It is a measured value per tab count
 * (`tabPillWidth`), because the pill spaces its buttons with `space-evenly`
 * and that only looks right when the leftover room divides into a gap wide
 * enough to keep two 40px circles apart. See tabPillWidth for the arithmetic.
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { radii, ui2Shape } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  index: { active: 'home', inactive: 'home-outline' },
  learn: { active: 'book', inactive: 'book-outline' },
  tutor: { active: 'mic', inactive: 'mic-outline' },
  chat: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

/**
 * Which routes get an icon. NOT the order they appear in — the bar filters
 * `state.routes`, which is in `<Tabs.Screen>` declaration order, so the order
 * lives in app/(app)/_layout.tsx. Changing this array changes membership only.
 */
export const VISIBLE_TABS = ['index', 'learn', 'tutor', 'chat', 'profile'];

/** Height of the pill itself. */
const TAB_BAR_HEIGHT = 56;

/**
 * Measured pill widths, by how many icons are in the bar.
 *
 * `space-evenly` divides the leftover width into (count + 1) equal gaps, so
 * the gap is (width − count × 44) / (count + 1):
 *
 *   4 icons in 240 → (240 − 176) / 5 = 12.8px gap,   56.8px pitch
 *   5 icons in 296 → (296 − 220) / 6 = 12.667px gap, 56.667px pitch
 *
 * Those two are visually indistinguishable, which is the whole reason 296 was
 * chosen: adding the tutor tab did not have to re-space the other four. It is
 * also 8 × 37, so the 8pt grid holds. Keeping 240 for five icons would have
 * left a 3.33px gap and put two 40px circles almost in contact.
 *
 * This is a lookup rather than a formula because each entry is a judgement
 * about how the bar LOOKS, not a derivation. A sixth tab therefore fails loudly
 * here rather than quietly cramping the fifth.
 */
const PILL_WIDTH_BY_TAB_COUNT: Readonly<Record<number, number>> = {
  4: 240,
  5: 296,
};

export function tabPillWidth(count: number): number {
  const width = PILL_WIDTH_BY_TAB_COUNT[count];
  if (width === undefined) {
    throw new Error(
      `[FloatingTabBar] no measured pill width for ${count} tabs. Pick a width ` +
        `where (width - ${count} * 44) / ${count + 1} lands near 12.7px, check it ` +
        `on a device, and add it to PILL_WIDTH_BY_TAB_COUNT.`,
    );
  }
  return width;
}

/**
 * Gap between the bottom of the pill and the bottom of the window.
 *
 * Deliberately small and NOT derived from the safe-area inset: the bar is
 * meant to sit just clear of the bottom edge, and floating it above the full
 * home-indicator inset pushed it visibly up into the content.
 */
const TAB_BAR_BOTTOM_GAP = 8;

/**
 * How much space the floating bar occupies above the bottom of the WINDOW.
 *
 * The bar is absolutely positioned and overlays whatever is beneath it, so any
 * screen that pins content to the bottom has to reserve this much or the bar
 * lands on top of it — which is exactly what happened to the lesson runner's
 * Previous/Next row. Exported so the geometry lives in one place rather than
 * being re-derived (and drifting) at each call site.
 *
 * Widening the pill did not change this: it is a vertical measurement, and
 * every screen that reserves it keeps the number it already had.
 */
export function floatingTabBarSpace(): number {
  return TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT;
}

/**
 * Nested routes that own the whole screen, written as `<tab>/<screen>`.
 *
 * The tutor call is the only one: it is a live WebRTC session, and the tab bar
 * has to be gone while it runs, for two separate reasons.
 *
 *   1. There is nowhere to put it. The root layout is `<Slot/>`, so there is no
 *      navigator ABOVE `<Tabs>` to push a full-screen route onto, and a child
 *      screen cannot z-index over the tabBar because the tabBar is its sibling,
 *      not its ancestor. Hiding the bar is the only lever available here.
 *   2. Leaving it visible invites the tap that breaks the call. Switching tabs
 *      mid-session unmounts the screen holding the peer connection and strands
 *      a live one — the user has to leave deliberately, through the call
 *      screen's own hang-up.
 */
export const FULL_SCREEN_ROUTES: readonly string[] = ['tutor/call'];

/**
 * The shape `hidesTabBar` reads out of a navigation state.
 *
 * Structural rather than `TabNavigationState`, because the nested state on a
 * route is a partial one (its `index` may be absent until the child navigator
 * has mounted) and because a pure function over plain objects is testable
 * without standing up a navigator.
 */
export type FocusedRouteState = {
  readonly index?: number;
  readonly routes: readonly {
    readonly name: string;
    readonly state?: FocusedRouteState;
  }[];
};

/** The focused leaf path, e.g. `tutor/call`, `learn/index`, `index`. */
function focusedRoutePath(state: FocusedRouteState | undefined): string {
  if (!state || state.routes.length === 0) return '';
  const route = state.routes[state.index ?? 0];
  if (!route) return '';
  const nested = focusedRoutePath(route.state);
  return nested ? `${route.name}/${nested}` : route.name;
}

/**
 * Whether the bar should render nothing at all for the currently focused
 * route. Pure and exported so the truth table is asserted in a test rather
 * than discovered on a device mid-call.
 */
export function hidesTabBar(state: FocusedRouteState | undefined): boolean {
  return FULL_SCREEN_ROUTES.includes(focusedRoutePath(state));
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  // The theme hook is called FIRST and unconditionally — the early return below
  // must never sit above a hook, or the hook order changes the moment the tutor
  // call is focused and React tears the tree down.
  const { c } = useUi2Theme();
  if (hidesTabBar(state)) return null;

  const bottomOffset = TAB_BAR_BOTTOM_GAP;
  const visibleRoutes = state.routes.filter((route) => VISIBLE_TABS.includes(route.name));

  const inner = (
    <View style={styles.tabRow}>
      {visibleRoutes.map((route) => {
        const realIndex = state.routes.indexOf(route);
        const isFocused = state.index === realIndex;
        const icons = TAB_ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
        const iconName = isFocused ? icons.active : icons.inactive;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabButton}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={descriptors[route.key]?.options.title ?? route.name}
          >
            {isFocused ? (
              <LinearGradient
                colors={[c.primary, c.slab]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.activeCircle}
              >
                <Ionicons name={iconName as any} size={22} color={c.onPrimary} />
              </LinearGradient>
            ) : (
              <View style={styles.inactiveCircle}>
                <Ionicons name={iconName as any} size={22} color={c.idle} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
      <View style={[styles.pill, { width: tabPillWidth(visibleRoutes.length), backgroundColor: c.card, borderColor: c.cardBorder }]}>{inner}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    // width comes from tabPillWidth(), applied inline — it depends on how many
    // tabs are actually mounted, which a static stylesheet cannot know.
    height: TAB_BAR_HEIGHT,
    borderRadius: radii.pill,
    borderWidth: 1,
    // The slab edge; fill and border colour are applied inline from the palette.
    borderBottomWidth: ui2Shape.slab,
    overflow: 'hidden',
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  tabButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
