# Skill: Fix a Mobile-Specific Bug

## When to Use
When Tyler reports a layout issue, performance problem, crash, or iOS-specific bug.

## Steps

1. **Reproduce and understand**
   - Get the exact steps to reproduce, device/simulator, and iOS version.
   - Check if it's iOS-only, Android-only, or cross-platform.
   - Read the error message, crash log, or Sentry report in full.
   - Identify the screen/component where the bug occurs.

2. **Read the relevant code**
   - Read the screen file in `app/`.
   - Read the components it uses in `components/`.
   - Read hooks and lib modules involved.
   - Check for recent changes to these files (git log).

3. **Diagnose the root cause**
   - **Layout bugs:** Check safe area usage, flex properties, absolute positioning. Test with different screen sizes (iPhone SE vs Pro Max).
   - **Performance:** Check for unnecessary re-renders (React.memo missing), heavy computation on UI thread, large list rendering (use FlashList), unoptimized images/audio.
   - **Crashes:** Check for null/undefined access, unhandled promise rejections, native module issues. Read the full stack trace.
   - **Audio issues:** Check permissions, audio session configuration, background mode settings.
   - **Navigation:** Check Expo Router config, layout nesting, gesture conflicts.

4. **Fix with minimal changes**
   - Fix the root cause, not the symptom.
   - Don't refactor surrounding code unless it's directly related.
   - Keep the fix as small and focused as possible.

5. **Verify the fix**
   - Test the exact reproduction steps — bug should be gone.
   - Test related screens/flows for regressions.
   - Run `npx tsc --noEmit && npm test && npm run lint`.
   - If it was a crash: confirm no new crashes in a 5-minute test session.

6. **Propose a regression test**
   - Write a test that would have caught this bug.
   - Add it to the appropriate test file.

7. **Summarize for commit**
   - What was the bug, what caused it, what fixed it.
   - One-line commit message.
