/**
 * What a language switch has to do to the NAVIGATION tree.
 *
 * Migration 133 made each language a durable enrollment, and
 * `switch_target_language` swaps the profile over cleanly — but the profile is
 * only the data. The navigator is a second, parallel piece of state that
 * nothing was touching, and it outlives the switch:
 *
 *   A learner part-way through a Russian lesson taps Home, switches to
 *   Spanish, then taps Learn. The tab navigator keeps each tab's stack, so the
 *   Russian `learn/[lessonId]` screen was still sitting on top of the learn
 *   stack — still mounted, with its restored mid-lesson snapshot. Tapping
 *   Learn did not open the Spanish lesson path; it returned to the Russian
 *   lesson the learner had just switched away from.
 *
 * So a switch pops every stack in the app back to its root and jumps to Home.
 * The learner asked to be somewhere else entirely; nothing from the language
 * they left should still be on screen or one back-gesture away. The Russian
 * lesson is not lost — its snapshot lives for a day
 * (lib/lesson-session-storage.ts) and resumes when they switch back and open
 * it again.
 *
 * Why pop every stack rather than only the ones known to hold language
 * content: "which screens are language-specific" is a list that would rot the
 * moment someone adds a screen. Popping all of them is the same answer for
 * every future screen, and a stack sitting at its root is unaffected.
 *
 * This module is pure so the walk can be tested without a navigator: it turns
 * a navigation state tree into the actions to dispatch. The dispatching lives
 * in hooks/useLanguageEnrollments.ts.
 */

/** The shape of a navigation state, narrowed to the parts this walk reads. */
export interface NavigationStateLike {
  key?: string;
  /** 'stack', 'tab', … — react-navigation's router type for the navigator. */
  type?: string;
  index?: number;
  routes?: NavigationRouteLike[];
}

export interface NavigationRouteLike {
  name: string;
  key?: string;
  /** Present once a nested navigator below this route has mounted. */
  state?: NavigationStateLike;
}

/**
 * A react-navigation action addressed at one navigator.
 *
 * Hand-rolled rather than imported from `@react-navigation/native`: these are
 * two plain objects, and the package is a transitive dependency of
 * expo-router rather than one this app declares (CLAUDE.md §6 — dependencies
 * ship in the binary).
 */
export type LanguageSwitchAction =
  | { type: 'POP_TO_TOP'; target: string }
  | { type: 'JUMP_TO'; payload: { name: string }; target: string };

/** The tab whose presence identifies the learner-facing tab navigator. */
const LEARNER_TAB = 'learn';
/** The tab a switch lands on. */
const HOME_TAB = 'index';

function eachNavigator(
  state: NavigationStateLike | undefined,
  visit: (state: NavigationStateLike) => void,
): void {
  if (!state?.routes) return;
  for (const route of state.routes) {
    // Depth first: a child stack is popped before the parent that holds it, so
    // a nested screen never renders a frame while its parent is being reset.
    eachNavigator(route.state, visit);
  }
  visit(state);
}

/**
 * The actions that drop every screen the learner was on, in dispatch order.
 *
 * Stacks already sitting at their root are skipped — dispatching POP_TO_TOP at
 * them is a no-op, but skipping keeps the action list an honest description of
 * what actually changes, which is what the tests assert against.
 *
 * Returns an empty list for a tree that is already at rest (nothing pushed,
 * Home selected), so a switch made from Home with no history dispatches
 * nothing at all.
 */
export function languageSwitchNavigationActions(
  state: NavigationStateLike | undefined,
): LanguageSwitchAction[] {
  const actions: LanguageSwitchAction[] = [];

  eachNavigator(state, (navigator) => {
    const routes = navigator.routes ?? [];
    const key = navigator.key;
    if (!key) return;

    if (navigator.type === 'stack' && routes.length > 1) {
      actions.push({ type: 'POP_TO_TOP', target: key });
      return;
    }

    // The learner-facing tabs: identified by holding the Learn tab rather than
    // by position, because the teacher area (app/(teacher)) is a second tab
    // navigator in the same tree and must be left alone.
    if (navigator.type === 'tab' && routes.some((r) => r.name === LEARNER_TAB)) {
      const home = routes.findIndex((r) => r.name === HOME_TAB);
      if (home !== -1 && navigator.index !== home) {
        actions.push({ type: 'JUMP_TO', payload: { name: HOME_TAB }, target: key });
      }
    }
  });

  return actions;
}
