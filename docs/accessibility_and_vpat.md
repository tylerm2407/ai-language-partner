# Accessibility Conformance & VPAT

**Product:** Fluenci — AI-Powered Language Learning Platform
**Last Updated:** 2026-04-20
**WCAG Version:** 2.1 Level AA (conformance goal)
**Contact:** accessibility@fluenci.app

---

## 1. Accessibility Commitment

Fluenci is committed to ensuring that all learners, including those with disabilities, can effectively use our language learning platform. We target WCAG 2.1 Level AA conformance and continuously improve accessibility as part of our development process.

---

## 2. Current Accessibility Features

### Visual Design
- **High contrast ratios:** Primary text achieves 16:1 contrast ratio (exceeds AAA requirement of 7:1)
- **Minimum touch targets:** All interactive elements meet Apple HIG's 44x44pt minimum
- **No reliance on color alone** for critical information (with known exceptions listed below)
- **Support for Dynamic Type:** Font sizes respond to system accessibility settings

### Screen Reader Support
- **VoiceOver (iOS):** Primary screen reader target; logical reading order maintained
- **Accessibility labels:** All interactive elements have descriptive `accessibilityLabel` properties
- **Accessibility roles:** Buttons, headers, links, and form elements properly annotated
- **Live regions:** Dynamic content changes announced to screen readers

### Motor Accessibility
- **Large touch targets** (44pt minimum) throughout the application
- **No time-dependent interactions** required (timer-based exercises have pause/extend options)
- **Swipe gesture alternatives:** All swipe actions have button alternatives

### Cognitive Accessibility
- **Clear, simple language** in UI text and instructions
- **Consistent navigation** patterns across all screens
- **Progress indicators** for multi-step workflows
- **Error messages** with clear remediation guidance

---

## 3. Known Gaps & Remediation Plan

| Issue | Location | WCAG Criterion | Severity | Remediation Status |
|-------|----------|---------------|----------|-------------------|
| Color-only due date indicators | `AssignmentCard.tsx` | 1.4.1 Use of Color | Medium | Fixed — text labels added alongside color |
| Stats cards missing accessible labels | `TeacherDashboard` | 1.1.1 Non-text Content | Medium | Fixed — `accessibilityLabel` added |
| Completion progress bar missing description | `StudentRow.tsx` | 1.1.1 Non-text Content | Medium | Fixed — `accessibilityValue` added |
| Audio-only content in voice exercises | Voice practice screens | 1.2.1 Audio-only | Low | Transcript provided after completion |
| Focus management on modal open | Assignment detail modals | 2.4.3 Focus Order | Low | Planned for next release |

---

## 4. Testing Approach

- **Manual testing:** VoiceOver (iOS) walkthrough of all primary user flows quarterly
- **Automated testing:** axe-core integration planned for CI pipeline
- **User testing:** Accessibility-focused user testing with assistive technology users (planned)
- **Developer training:** Accessibility checklist in PR review process

---

## 5. Voluntary Product Accessibility Template (VPAT)

### Based on WCAG 2.1 — Revised Section 508 Edition

**Evaluation Methods:**
- Manual inspection of source code
- VoiceOver testing on iOS
- Contrast ratio analysis of design system

---

### Table 1: WCAG 2.1 Level A

| Criteria | Conformance Level | Remarks |
|----------|-------------------|---------|
| **1.1.1 Non-text Content** | Partially Supports | All interactive elements labeled; decorative images hidden. Stats cards and progress bars now have accessible values. |
| **1.2.1 Audio-only and Video-only** | Partially Supports | Voice exercise audio has post-completion transcript. Real-time voice practice relies on audio. |
| **1.2.2 Captions** | Not Applicable | No pre-recorded video content |
| **1.2.3 Audio Description** | Not Applicable | No video content |
| **1.3.1 Info and Relationships** | Supports | Semantic structure via accessibility roles and headers |
| **1.3.2 Meaningful Sequence** | Supports | Logical reading order maintained |
| **1.3.3 Sensory Characteristics** | Supports | Instructions don't rely solely on sensory characteristics |
| **1.4.1 Use of Color** | Partially Supports | Due date indicators now include text labels. Some decorative color coding remains. |
| **1.4.2 Audio Control** | Supports | All audio playback user-initiated with stop controls |
| **2.1.1 Keyboard** | Supports | All functions available via touch/keyboard (no mouse-only) |
| **2.1.2 No Keyboard Trap** | Supports | No focus traps identified |
| **2.2.1 Timing Adjustable** | Supports | Timer exercises can be paused/extended |
| **2.2.2 Pause, Stop, Hide** | Supports | No auto-playing content |
| **2.3.1 Three Flashes** | Supports | No flashing content |
| **2.4.1 Bypass Blocks** | Supports | Tab navigation provides section-based access |
| **2.4.2 Page Titled** | Supports | All screens have descriptive titles |
| **2.4.3 Focus Order** | Partially Supports | Generally logical; modal focus management planned |
| **2.4.4 Link Purpose** | Supports | All links/buttons have descriptive labels |
| **2.5.1 Pointer Gestures** | Supports | Swipe gestures have button alternatives |
| **2.5.2 Pointer Cancellation** | Supports | Touch actions trigger on release |
| **3.1.1 Language of Page** | Supports | Language attribute set per screen |
| **3.2.1 On Focus** | Supports | No context changes on focus |
| **3.2.2 On Input** | Supports | No unexpected context changes |
| **3.3.1 Error Identification** | Supports | Form errors clearly identified |
| **3.3.2 Labels or Instructions** | Supports | All inputs labeled |
| **4.1.1 Parsing** | Supports | Valid component structure |
| **4.1.2 Name, Role, Value** | Supports | Accessibility properties set on all interactive elements |

### Table 2: WCAG 2.1 Level AA

| Criteria | Conformance Level | Remarks |
|----------|-------------------|---------|
| **1.3.4 Orientation** | Supports | App works in portrait and landscape |
| **1.3.5 Identify Input Purpose** | Supports | Input types properly declared |
| **1.4.3 Contrast (Minimum)** | Supports | All text exceeds 4.5:1 ratio (most exceed 7:1) |
| **1.4.4 Resize Text** | Supports | Dynamic Type support |
| **1.4.5 Images of Text** | Supports | No images of text used |
| **1.4.10 Reflow** | Supports | Single-column layout, no horizontal scrolling |
| **1.4.11 Non-text Contrast** | Supports | UI components meet 3:1 ratio |
| **1.4.12 Text Spacing** | Supports | No content clipping with increased spacing |
| **1.4.13 Content on Hover or Focus** | Not Applicable | No hover-triggered content (mobile app) |
| **2.4.5 Multiple Ways** | Supports | Tab navigation + search + direct links |
| **2.4.6 Headings and Labels** | Supports | Descriptive headings throughout |
| **2.4.7 Focus Visible** | Supports | Focus indicators visible on all interactive elements |
| **3.1.2 Language of Parts** | Supports | Target language content marked with appropriate language |
| **3.2.3 Consistent Navigation** | Supports | Tab bar consistent across screens |
| **3.2.4 Consistent Identification** | Supports | Components behave consistently |
| **3.3.3 Error Suggestion** | Supports | Correction suggestions provided |
| **3.3.4 Error Prevention** | Supports | Confirmation for destructive actions |
| **4.1.3 Status Messages** | Partially Supports | Most status changes announced; some toast notifications may be missed |

---

## 6. Feedback & Issue Reporting

If you encounter an accessibility barrier while using Fluenci:

**Email:** accessibility@fluenci.app
**Response SLA:** 5 business days for accessibility issues
**Remediation:** Critical accessibility barriers prioritized for next release cycle
