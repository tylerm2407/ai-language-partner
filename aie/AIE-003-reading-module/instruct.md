# AIE-003 — Reading Module — Instruct

> *This is a retroactive AIE entry. The directive below is reconstructed from the implemented changes, not captured at the time of implementation.*

## Directive

Replace the chat-based reading experience with a structured reading flow:

1. **ReadingPassageViewer** — Renders passage text with word-level touch targets
2. **WordTooltip** — Shows translation, pronunciation, and "Add to Review" button on word tap
3. **ComprehensionQuestions** — Multiple-choice or short-answer questions about the passage
4. **useReadingPassage** — Hook managing passage fetch, annotation state, question flow, and progress persistence

### Route Structure

- `app/(app)/learn/reading/[passageId].tsx` — Main reading screen (replaces `[readingId].tsx`)
- `app/(app)/learn/reading/_layout.tsx` — Reading stack layout

## Constraints

- Word tooltips must not block the reading flow — dismiss on tap outside
- Annotations (user-tapped words) saved to `reading_annotations` table
- Comprehension questions sourced from `reading_questions` table, not generated on-the-fly
- Reading progress tracked in `user_reading_progress` table
