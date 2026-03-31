# AIE-006 — Edge Function Overhaul — Align

## Problem

Edge Functions had duplicated auth checking, CORS handling, and input validation across every function. Several functions (`ai-usage-check`, `news-sync`, `reading-help`, `tutor-message`, `voice-token`, `writing-feedback`) were tied to features being removed. The remaining functions needed plan-based rate limiting for the subscription model.

## Business Context

Supabase Edge Functions are the app's server-side compute layer. Shared utilities reduce code duplication and enforce consistent auth/CORS/validation patterns. A new `grade-writing` function supports the restructured writing module. Removing dead functions reduces deployment surface and cold-start time. Plan-based limits are essential for the freemium subscription model.

## Success Criteria

- `_shared/` directory with reusable auth, CORS, plan-limits, and validation utilities
- All surviving functions use shared utilities
- New `grade-writing` function operational with Claude Haiku
- 6 deprecated functions removed
- Plan-based rate limiting enforced on AI-powered endpoints
