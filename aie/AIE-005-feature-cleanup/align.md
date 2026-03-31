# AIE-005 — Feature Cleanup — Align

## Problem

The app accumulated features that were either experimental, underused, or misaligned with the new structured learning approach: driving mode, voice sessions (LiveKit-based), standalone pronunciation practice, scenario-based conversations, tutor personalities, AI usage metering, CEFR badge display, and level-up celebrations. These added maintenance burden, dependency bloat, and UX confusion.

## Business Context

Pre-launch cleanup. Every unused feature is code to maintain, dependencies to update, and attack surface to secure. Removing 20+ files and their associated hooks/configs simplifies the codebase before App Store submission. The voice agent infrastructure (`fluenci-voice-agent/`) was a separate Python service that added deployment complexity with no clear path to launch readiness.

## Success Criteria

- All listed components, hooks, configs, and the voice agent directory removed
- No broken imports or references to deleted modules
- App builds and runs without errors after cleanup
- Bundle size reduced
