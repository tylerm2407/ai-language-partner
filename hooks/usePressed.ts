/**
 * Press-state tracking for a `Pressable`, as a plain boolean.
 *
 * React Native's own answer to this is the callback form of the `style` prop —
 * `style={({ pressed }) => [...]}`. **Do not use it in this app.** NativeWind
 * (v4) wraps `Pressable` to do its className interop and drops the function
 * form on the floor: no error, no warning, the style object simply never
 * reaches the view. A row styled that way renders with no background, no
 * padding and no `flexDirection`, so its children stack vertically — which is
 * exactly how it shipped to the simulator before this hook existed.
 *
 * It survives a unit test, too: react-test-renderer calls the function itself
 * and sees the right props, so only running the app catches it.
 *
 * Usage — keep `style` a plain array and drive it off this flag:
 *
 *   const { pressed, pressHandlers } = usePressed();
 *   <Pressable {...pressHandlers} style={[styles.row, pressed && styles.rowPressed]}>
 */

import { useCallback, useState } from 'react';

export function usePressed() {
  const [pressed, setPressed] = useState(false);

  const onPressIn = useCallback(() => setPressed(true), []);
  const onPressOut = useCallback(() => setPressed(false), []);

  return { pressed, pressHandlers: { onPressIn, onPressOut } };
}
