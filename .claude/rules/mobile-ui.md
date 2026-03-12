# Mobile UI Rules (iOS-First)

## Safe Areas & Layout
- Always use `SafeAreaView` or `useSafeAreaInsets()` for top-level screen containers.
- Never hardcode status bar height. Use `expo-status-bar` for styling.
- Account for home indicator on iPhone X+ (bottom inset).
- Use `KeyboardAvoidingView` with `behavior="padding"` on iOS for forms.

## Navigation
- Use Expo Router's file-based routing. Tab navigation for main app sections.
- Bottom tabs: Home, Learn, Review, Practice, Profile (5 max).
- Stack navigation within each tab for drill-down screens.
- Support iOS swipe-back gesture — never disable it unless absolutely necessary.
- Use `react-native-screens` for native navigation performance.

## Typography & Accessibility
- Use system fonts (San Francisco on iOS) via `Platform.select` or NativeWind defaults.
- Support Dynamic Type: use relative font sizes, never fixed pixel values for body text.
- Minimum touch target: 44x44pt (Apple HIG requirement).
- All interactive elements must have `accessibilityLabel` and `accessibilityRole`.
- Support VoiceOver: logical reading order, meaningful labels, no decorative-only images without `accessibilityElementsHidden`.
- Test with "Bold Text" and "Larger Text" iOS settings enabled.

## Gestures & Interactions
- Use `react-native-gesture-handler` for custom gestures.
- Swipe gestures for card review (left = wrong, right = correct) with Reanimated spring animations.
- Haptic feedback via `expo-haptics` for correct/incorrect answers.
- Avoid gesture conflicts with navigation swipe-back.

## Performance
- Use `React.memo` for list items and cards that re-render frequently.
- Use `FlashList` instead of `FlatList` for long lists (lesson lists, vocabulary).
- Lazy-load images and audio. Pre-fetch next lesson's audio during current lesson.
- Animations run on the UI thread via Reanimated `useAnimatedStyle` — never use `Animated` from React Native core for complex animations.
- Profile with Flipper or React Native Performance Monitor. Target 60fps on all screens.

## Colors & Theming
- Support light and dark mode via NativeWind's dark: prefix or `useColorScheme()`.
- Use semantic color tokens (e.g., `text-primary`, `bg-surface`) not raw hex values.
- Correct/incorrect feedback: green (#22C55E) / red (#EF4444) with accessible contrast.

## Status Bar
- Use `<StatusBar style="auto" />` at root layout.
- Light content on dark backgrounds, dark content on light backgrounds.
- Translucent status bar — content should scroll behind it with proper insets.
