# iOS UX & Performance Checklist

Use this checklist when building or reviewing any screen in languageAI.

## Safe Areas & Layout

- [ ] Screen uses `SafeAreaView` or `useSafeAreaInsets()` for top-level container
- [ ] Content does not overlap with status bar, notch, or home indicator
- [ ] Landscape orientation handled (or explicitly locked to portrait in app.json)
- [ ] Keyboard does not obscure input fields (`KeyboardAvoidingView` with `behavior="padding"`)
- [ ] Tested on iPhone SE (small) and iPhone 15 Pro Max (large) screen sizes

## Navigation

- [ ] iOS swipe-back gesture works correctly (not blocked by custom gestures)
- [ ] Bottom tab bar is visible and does not overlap content
- [ ] Tab bar uses SF Symbols or consistent icon set
- [ ] Stack screens have proper header titles or custom headers
- [ ] Deep links work if applicable
- [ ] Navigation transitions are smooth (no janky frame drops)

## Typography & Accessibility

- [ ] Uses system font (San Francisco) or explicitly configured custom font
- [ ] Body text supports Dynamic Type (relative sizing)
- [ ] All interactive elements have `accessibilityLabel`
- [ ] All interactive elements meet 44x44pt minimum touch target
- [ ] Screen tested with VoiceOver enabled — logical reading order
- [ ] Color contrast meets WCAG AA (4.5:1 for text, 3:1 for large text)
- [ ] Screen tested with "Bold Text" and "Larger Accessibility Sizes" enabled
- [ ] No information conveyed by color alone (use icons/text too)

## Performance

- [ ] Screen renders at 60fps (check with Performance Monitor)
- [ ] Long lists use `FlashList` instead of `FlatList`
- [ ] Images are properly sized (not loading full-res for thumbnails)
- [ ] Audio files are lazy-loaded, not all loaded at mount
- [ ] No unnecessary re-renders (use `React.memo`, `useMemo`, `useCallback` where needed)
- [ ] Heavy computation runs off the UI thread (`InteractionManager` or async)
- [ ] Animations use Reanimated (worklet-based, runs on UI thread)

## Audio & Recording

- [ ] Audio playback works with silent mode off (proper audio session category)
- [ ] Recording shows clear permission prompt with explanation
- [ ] Recording indicator visible while mic is active
- [ ] Audio continues playing when screen locks (if intended) or stops (if not)
- [ ] Audio doesn't conflict with background music/podcasts unexpectedly
- [ ] Tested with AirPods / Bluetooth headphones connected

## Offline Behavior

- [ ] Screen shows appropriate loading state while data fetches
- [ ] Screen handles no-network gracefully (cached data or clear message)
- [ ] User can complete downloaded lessons without internet
- [ ] Review queue works offline (sync results when back online)
- [ ] No crashes or freezes on network timeout
- [ ] Retry mechanism for failed network requests

## Dark Mode

- [ ] All screens tested in both light and dark mode
- [ ] No hardcoded colors — uses semantic tokens or NativeWind dark: variants
- [ ] Images and icons have appropriate dark mode variants if needed
- [ ] Status bar style adapts to background color

## Battery & Resources

- [ ] Audio recording stops when leaving the screen
- [ ] No unnecessary background timers or polling
- [ ] Images and audio cached appropriately (not re-downloaded every session)
- [ ] Location services not used unless explicitly needed (they're not for this app)
