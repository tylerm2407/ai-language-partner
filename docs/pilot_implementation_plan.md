# Pilot Implementation Plan

**Product:** Fluenci — AI-Powered Language Learning Platform
**Last Updated:** 2026-04-20
**Contact:** partnerships@fluenci.app

---

## Overview

This document outlines the structured approach for deploying Fluenci within an educational institution as a pilot program. The goal is to validate the product in a real classroom environment, gather feedback, and establish a foundation for broader adoption.

---

## Phase 1: Technical Setup (2 Weeks)

### Week 1: Organization Provisioning

| Task | Owner | Deliverable |
|------|-------|-------------|
| Create organization in Fluenci | Fluenci team | Org record with institution name, slug, contact |
| Configure seat limit | Fluenci team | Max seats set per contract terms |
| Provision admin account | Fluenci team + IT | School admin user with `school_admin` role |
| Configure email domain restriction | Fluenci team | Only `@school.edu` emails can self-register (if applicable) |
| Share IT security documentation | Fluenci team | Security overview, FERPA alignment, architecture diagrams |

### Week 2: Classroom Setup

| Task | Owner | Deliverable |
|------|-------|-------------|
| Add teacher accounts | School admin | Teachers provisioned via admin panel |
| Create classrooms | Teachers | 1-3 pilot classrooms configured with language, level, invite codes |
| Bulk import students (CSV) | Teachers | Students enrolled via bulk-enroll endpoint |
| Teacher training session | Fluenci team | 30-min live walkthrough of teacher dashboard, assignment creation, grading |
| Student onboarding materials | Fluenci team | Quick-start guide (PDF) for students |
| Test end-to-end flow | Fluenci + IT | Verify: login → assignment → submission → grading works |

---

## Phase 2: Limited Pilot (1 Academic Term)

### Scope
- **Classes:** 1-3 classrooms
- **Students:** 20-90 students
- **Duration:** 1 academic term (typically 10-16 weeks)

### Weekly Operations

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Assignment creation | 1-3 per week per class | Teacher |
| Student practice sessions | 3-5 per week per student | Students |
| Grade review & feedback | Weekly | Teacher |
| Usage monitoring | Weekly | Fluenci team |
| Support channel monitoring | Daily | Fluenci team |
| Check-in with teacher | Weekly (first month), biweekly after | Fluenci team |

### Metrics Tracked

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Student login rate | > 80% weekly active | Supabase analytics |
| Assignment completion rate | > 70% | Submission records |
| Average session duration | > 5 minutes | Chat session timestamps |
| Teacher satisfaction | > 4/5 | Mid-pilot and end-of-pilot survey |
| Student satisfaction | > 3.5/5 | End-of-pilot survey |
| Technical incidents | < 2 per month | Incident log |
| Support response time | < 24 hours | Support channel timestamps |

---

## Phase 3: Evaluate & Decide (2 Weeks Post-Pilot)

### Evaluation Activities

| Activity | Timeline | Output |
|----------|----------|--------|
| Export usage data | Day 1 | Analytics report |
| Teacher debrief interview | Day 3-5 | Qualitative feedback document |
| Student survey (optional) | Day 3-5 | Survey results |
| Outcome memo | Day 7-10 | Go/no-go recommendation |
| Expansion proposal (if go) | Day 10-14 | Pricing, scope, timeline for full deployment |

### Decision Criteria

| Signal | Go | No-Go |
|--------|-----|-------|
| Student engagement | > 70% weekly active by end of pilot | < 50% weekly active |
| Assignment completion | > 60% average | < 40% average |
| Teacher satisfaction | > 3.5/5 | < 3/5 |
| Technical reliability | < 5 total incidents | > 10 incidents or any P1 |
| Learning outcomes | Positive teacher assessment | Teacher reports no value |

---

## Support Model

### Dedicated Support Channel
- **Medium:** Dedicated Slack channel (or email thread, per institution preference)
- **Participants:** Fluenci team + pilot teachers + IT contact
- **Purpose:** Bug reports, feature requests, questions, weekly updates

### Response SLAs

| Severity | Definition | Response Time | Resolution Time |
|----------|-----------|---------------|-----------------|
| P1 — Critical | Service down, data loss | 1 hour | 4 hours |
| P2 — Major | Feature broken, workaround exists | 4 hours | 24 hours |
| P3 — Minor | Cosmetic issue, enhancement request | 24 hours | Next release |
| P4 — Informational | Question, feedback | 48 hours | N/A |

### Escalation Path
1. Support channel → Fluenci team
2. Fluenci team → Engineering lead (P1/P2)
3. Engineering lead → Founder (P1 with data impact)

---

## Rollback Plan

If the pilot is terminated early or the institution decides not to continue:

| Step | Timeline | Action |
|------|----------|--------|
| 1. Notification | Day 0 | Institution notifies Fluenci of termination |
| 2. Data export | Day 1-3 | Full organization data export provided to institution |
| 3. Access freeze | Day 3 | Organization deactivated, all logins disabled |
| 4. Data deletion | Day 30 | Full purge of organization data (anonymize/delete all PII) |
| 5. Confirmation | Day 31 | Written confirmation of deletion sent to institution |

---

## Pricing (Pilot Terms)

Pilot pricing is negotiated per institution. Typical structures:

| Model | Description |
|-------|-------------|
| Free pilot | No charge for pilot term; paid contract begins at expansion |
| Reduced rate | 50% discount during pilot; full rate at expansion |
| Per-seat monthly | $X/student/month with pilot-term commitment |

Final pricing confirmed in the institutional agreement prior to Phase 1 kickoff.

---

## Prerequisites

Before pilot can begin, the institution must:
- [ ] Sign data processing agreement (DPA)
- [ ] Designate IT contact for security review
- [ ] Designate 1-3 pilot teachers
- [ ] Identify target classrooms and student count
- [ ] Confirm acceptable authentication method (email/password or magic link)
- [ ] Complete security questionnaire review (IT team)

---

## Contact

**Partnerships:** partnerships@fluenci.app
**Technical Setup:** support@fluenci.app
**Security Questions:** security@fluenci.app
