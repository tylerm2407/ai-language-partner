# AIE-001 — Route Restructuring — Align

## Problem

The app had a 5-tab navigation (Home, Learn, Review, Practice, Profile) with practice features scattered across their own tab. This created a fragmented learning experience — users had to context-switch between "Learn" and "Practice" tabs for closely related activities. Reading and writing were nested under Practice, disconnected from the core lesson flow.

## Business Context

A streamlined navigation reduces cognitive load and increases session depth. Consolidating related learning activities under a single "Learn" tab creates a more cohesive product that mirrors how competitors (Duolingo, Babbel) organize their UX. Fewer tabs also frees space for a dedicated Chat tab for AI tutoring.

## Success Criteria

- Navigation reduced from 5 tabs to 4: Home, Learn, Chat, Profile
- Reading and writing routes accessible under `/learn/`
- Practice tab retained but scoped to focused review/practice activities
- No dead routes or broken navigation links
- Swipe-back gesture preserved on all stack screens
