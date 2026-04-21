# Fluenci — School Readiness Gap Analysis

> **Date:** 2026-04-20
> **Author:** NovaWealth Engineering
> **Status:** Living document — update as gaps are closed

---

## Executive Summary

Fluenci's backend architecture is enterprise-grade for an early-stage product. The multi-tenant data model (organizations, classrooms, enrollments), row-level security on all seven school tables, role-based access control, assignment lifecycle with AI grading, and per-org contract configuration are exactly what higher-ed IT teams want to see in a vendor's stack.

**The primary gap is not code — it is documentation and compliance artifacts.** Schools will not evaluate the SQL migrations; they will evaluate whether the vendor can produce a security overview, FERPA alignment summary, accessibility statement, HECVAT answers, and a concrete pilot plan. Secondary gaps include SSO/SAML integration, audit logging, and data lifecycle endpoints that will be required before a production campus-wide deployment.

**Readiness level:** Pilot-ready with documentation work. Not yet production-ready for campus-wide rollout.

---

## Readiness Overview

| # | Dimension | Rating | Key Evidence |
|---|-----------|--------|-------------|
| 1 | **Architecture & Multi-tenancy** | **Strong** | `organizations` + `institution_id` scoping, RLS on all 7 school tables, `get_effective_limits()` merging personal + school contracts, per-org JSONB `contract_config` |
| 2 | **Security / HECVAT** | **Partial** | Encryption via Supabase defaults (AES-256 at rest, TLS in transit), JWT auth, but no HECVAT document, no security overview doc, `.env` contains live secret keys |
| 3 | **Privacy / FERPA** | **Partial** | RLS enforces data isolation, minimal PII collection (email, name, role), but no audit logging for student record access, no data deletion/export endpoints, no FERPA alignment document |
| 4 | **Identity / SSO** | **Missing** | Email/password only via Supabase Auth. No SAML 2.0, no OIDC federation, no Shibboleth/Okta integration |
| 5 | **Accessibility** | **Partial** | 427 `accessibilityLabel`/`accessibilityRole` usages across 94 files, documented color contrast ratios (16:1 AAA, 6:1 AA), but no VPAT, no formal WCAG audit, no accessibility statement |
| 6 | **Institutional Rollout** | **Adequate** | Full teacher portal, classroom management, assignment workflow (draft→published→closed), invite codes, but no bulk user import, no CSV/SIS integration |
| 7 | **Documentation / Compliance Artifacts** | **Partial** | Strong research docs (`selling-software-to-schools.md`, `technical_guide_for_schools.md`), but none of the deliverable artifacts schools actually request |

---

## Detailed Findings

### 1. Architecture & Multi-tenancy — Strong

**Current State**
- Seven dedicated school tables: `user_roles`, `organizations`, `organization_members`, `classrooms`, `classroom_enrollments`, `assignments`, `assignment_submissions` (`021_school_system.sql`)
- RLS enabled on all seven tables with granular policies — students see own data, teachers see their classrooms, org admins see org-wide
- Role hierarchy: `user_roles` table (`learner | teacher | school_admin`) + `org_role` on `organization_members` (`admin | teacher | student`)
- RPC permission functions: `is_classroom_teacher()`, `is_classroom_student()`, `is_org_admin()` — all `SECURITY DEFINER`
- Per-organization `contract_config` JSONB with feature limits (voice minutes, text messages, writing grades, etc.)
- `get_effective_limits()` RPC merges personal subscription tier with school contract, returning the MAX of each limit
- Comprehensive indexes on foreign keys and filtered indexes for active enrollments and published assignments
- Chat sessions linked to assignments via `assignment_id` FK, with teacher access policies on `chat_sessions` and `chat_messages`

**Gaps**
- No formal architecture diagram document (the mermaid diagram in `technical_guide_for_schools.md` is a template, not generated from the actual deployment)
- No data flow diagram showing exactly which subprocessors touch student data (Supabase, Google Gemini, OpenAI/Claude for grading, TTS provider)

**Recommendations**
- *Must-have:* Create `docs/architecture_diagrams.md` with actual system architecture and data flow diagrams reflecting the real Supabase + Edge Functions + AI provider stack
- *Nice-to-have:* Add a subprocessor inventory table listing every third-party service that processes student data

---

### 2. Security / HECVAT — Partial

**Current State**
- Encryption at rest: Supabase default (AES-256 with provider-managed keys)
- Encryption in transit: HTTPS enforced on all Supabase endpoints, TLS 1.2+
- Authentication: JWT-based via Supabase Auth, validated in `_shared/auth.ts` using `supabase.auth.getUser(token)`
- Service role key used only server-side in Edge Functions (never exposed to client)
- Rate limiting via `daily_usage` table with RPC-based limit checking

**Gaps**
- **No HECVAT document** — universities will ask for HECVAT Lite at minimum
- **No security overview document** — no single artifact describing encryption, access control, logging, and incident response
- **Secrets in `.env`** — live Stripe secret key, Supabase service role key, and API keys present; `.env` should never be committed
- **No incident response plan** — no documented breach notification process or timeline
- **No vulnerability management process** — no documented scanning, patching, or remediation SLAs
- **No penetration test results** — not required for a pilot, but strengthens credibility

**Recommendations**
- *Must-have:* Write `docs/security_overview_for_it.md` covering encryption, access control, vulnerability management, backup/recovery, and incident response (use the example answers from `technical_guide_for_schools.md` adapted to Fluenci's actual stack)
- *Must-have:* Rotate all secrets currently in `.env`, ensure `.env` is in `.gitignore`, move production secrets to a managed secret store or Supabase's built-in secrets management
- *Must-have:* Document an incident response plan with 72-hour breach notification commitment
- *Phase 1:* Complete HECVAT Lite questionnaire
- *Phase 2:* Pursue SOC 2 Type I readiness (not required for pilot, but accelerates campus-wide deals)

---

### 3. Privacy / FERPA — Partial

**Current State**
- RLS policies enforce strict data isolation — students cannot access other students' data, teachers only see their own classrooms
- Minimal PII collection: email, display name, role, learning progress
- No advertising, analytics resale, or third-party data sharing
- Chat history stored in `chat_sessions` + `chat_messages` with user ownership enforced by RLS

**Gaps**
- **No audit logging** — no application-level trail for who accessed which student records and when. This is a core FERPA expectation when a third party acts as a "school official"
- **No data deletion/export endpoints** — no way for an institution to request a full data export or purge at contract termination. FERPA and contract terms typically require this
- **No data retention policy** — no documented defaults for how long chat transcripts, grades, and progress data are kept
- **No FERPA alignment document** — no single artifact that explains data handling practices in FERPA-aware language for legal and privacy officer review
- **No data inventory** — no document listing every PII field collected, its purpose, and its retention period

**Recommendations**
- *Must-have:* Write `docs/privacy_and_ferpa_alignment.md` covering data collected, purpose limitation, retention, deletion, subprocessors, and FERPA "school official" exception alignment
- *Must-have (Phase 1):* Add an `audit_log` table that records actor, timestamp, action, and resource for all student record access (profiles, grades, submissions, chat transcripts)
- *Must-have (Phase 1):* Build admin endpoints for institution-scoped data export (JSON/CSV) and data deletion/anonymization
- *Nice-to-have:* Document retention windows (e.g., chat transcripts retained for 1 year after contract end, then purged)

---

### 4. Identity / SSO — Missing

**Current State**
- Email/password authentication only via Supabase Auth
- JWT tokens issued by Supabase, validated in Edge Functions via `getAuthenticatedUser()` in `_shared/auth.ts`
- No SAML, OIDC, or any federated identity support
- Classroom enrollment via invite code (not identity-provider-driven)

**Gaps**
- **No SAML 2.0 Service Provider** — universities with Shibboleth or Okta expect SAML SSO. This is often a hard requirement for campus IT approval
- **No OIDC support** — some institutions prefer OIDC over SAML
- **No automated user provisioning** — no SCIM or SIS-driven enrollment; all users must self-register
- **No attribute mapping** — no support for `eduPersonPrincipalName`, `eduPersonAffiliation`, or other standard higher-ed SAML attributes

**Recommendations**
- *Phase 1 (workaround):* For the initial pilot, propose email-based enrollment with institutional email domain validation (e.g., only `@school.edu` emails can join the org). This is acceptable for small pilots
- *Phase 2 (production):* Implement SAML 2.0 SP integration. Supabase supports SAML SSO on their Pro/Enterprise plans. Alternatively, add a custom SAML SP in front of Supabase Auth
- *Phase 2:* Map standard eduPerson attributes to Fluenci roles during SSO provisioning
- *Nice-to-have:* SCIM provisioning for automated user lifecycle management

---

### 5. Accessibility — Partial

**Current State**
- 427 accessibility annotations (`accessibilityLabel`, `accessibilityRole`) across 94 component and screen files — this is solid baseline coverage
- DESIGN.md documents color contrast ratios: `#111` on `#FFF` = 16:1 (AAA), `#666` on `#FFF` = 6:1 (AA), `#FFF` on `#6366F1` = 7:1 (AAA)
- Mobile UI rules in `.claude/rules/mobile-ui.md` require 44x44pt touch targets, VoiceOver support, and Dynamic Type
- Exercise components (multiple choice, cloze, sentence construction, etc.) include accessibility labels

**Gaps**
- **No VPAT** — schools increasingly require a Voluntary Product Accessibility Template documenting WCAG 2.1 AA conformance status per criterion
- **No formal WCAG audit** — no automated or manual accessibility audit has been run and documented
- **No accessibility statement** — no public or shareable statement describing conformance goals, known gaps, and feedback channel
- **No automated a11y testing in CI** — no axe, jest-axe, or Detox accessibility checks in the test pipeline

**Recommendations**
- *Must-have:* Write `docs/accessibility_and_vpat.md` with an accessibility statement (conformance goal: WCAG 2.1 AA, known gaps, contact for issues)
- *Must-have:* Run a Lighthouse/axe accessibility audit on key screens and document results
- *Phase 1:* Fix any critical a11y issues found (missing labels, insufficient contrast in edge cases, keyboard traps)
- *Phase 1:* Begin a VPAT table listing WCAG 2.1 AA criteria with current conformance status
- *Nice-to-have:* Add automated a11y checks to CI (e.g., `jest-axe` for component tests, Detox accessibility assertions for E2E)

---

### 6. Institutional Rollout — Adequate

**Current State**
- Full teacher portal with classroom CRUD (`supabase/functions/school/index.ts`)
- Assignment lifecycle: draft → published → closed, with due dates, late submission support, and mode selection (text/voice/either)
- AI auto-grading via Claude with `ai_feedback` JSONB + teacher override via `teacher_score` and `teacher_feedback`
- Rubric-based feedback with vocabulary focus, grammar focus, and custom scenario support
- Invite code system for classroom enrollment (8-character unique codes)
- Org admin portal (`supabase/functions/school-admin/index.ts`) for organization and contract management
- Max seats enforcement on organizations (`max_seats` column)

**Gaps**
- **No bulk user import** — no CSV upload or SIS integration for enrolling entire student cohorts. Teachers must share invite codes individually
- **No LMS integration** — no LTI support for embedding in Canvas, Blackboard, or Moodle
- **No training materials** — no quickstart guide, video walkthrough, or teacher onboarding documentation
- **No pilot plan document** — no formal scoped pilot offering with timeline, metrics, and rollback plan

**Recommendations**
- *Must-have:* Write `docs/pilot_implementation_plan.md` with phased rollout (technical setup → limited pilot → evaluation), success metrics, and support commitment
- *Phase 1:* Build a CSV import endpoint for bulk student enrollment (email, name, role)
- *Phase 1:* Create a teacher quickstart guide (can be in-app or a PDF)
- *Phase 2:* Explore LTI 1.3 integration for LMS embedding
- *Nice-to-have:* SIS/SCIM integration for automated enrollment syncing

---

### 7. Documentation / Compliance Artifacts — Partial

**Current State**
- `selling-software-to-schools.md` — comprehensive research on school procurement, FERPA, HECVAT, and deal structure
- `docs/technical_guide_for_schools.md` — detailed technical patterns guide covering backend models, security controls, FERPA design, SSO, accessibility, and pilot plans
- `DESIGN.md` — design system with documented contrast ratios
- `.claude/rules/mobile-ui.md` — accessibility and UX rules

**Gaps**
None of the actual deliverable artifacts exist yet:

| Artifact | Status | Schools Expect It? |
|----------|--------|-------------------|
| Security overview for IT | Missing | Yes — every IT meeting |
| FERPA / data handling summary | Missing | Yes — privacy officer review |
| Accessibility statement | Missing | Yes — a11y office review |
| VPAT (WCAG conformance table) | Missing | Often — especially higher-ed |
| Architecture diagram (actual) | Missing | Yes — IT meeting visual |
| HECVAT Lite (completed) | Missing | Yes — standard questionnaire |
| Pilot implementation plan | Missing | Yes — scoped rollout proposal |
| Incident response plan | Missing | Yes — security review |
| Subprocessor list | Missing | Yes — data governance |
| Data retention policy | Missing | Yes — contract terms |

**Recommendations**
- *Must-have (Phase 0):* Create the top 5 artifacts before any school meeting: security overview, FERPA alignment, accessibility statement, architecture diagram, pilot plan
- *Phase 1:* Complete HECVAT Lite, incident response plan, subprocessor list, data retention policy
- *Phase 2:* Formal VPAT, SOC 2 roadmap document

---

## Prioritized Roadmap

### Phase 0 — "Paper Readiness" (before the first school meeting)

**Goal:** Have all documentation artifacts needed to survive an IT intro meeting.

| # | Deliverable | Description | Effort |
|---|-------------|-------------|--------|
| 0.1 | `docs/security_overview_for_it.md` | Encryption (at rest + in transit), access control model, Supabase infrastructure, incident response summary, backup/recovery | 1 day |
| 0.2 | `docs/privacy_and_ferpa_alignment.md` | Data inventory, purpose limitation, retention policy, deletion commitment, subprocessor list, "school official" exception alignment | 1 day |
| 0.3 | `docs/accessibility_and_vpat.md` | Accessibility statement (WCAG 2.1 AA goal), current state summary, known gaps, contact for issues, initial VPAT table | 0.5 day |
| 0.4 | `docs/architecture_diagrams.md` | Actual system architecture diagram (clients → Supabase → Edge Functions → AI providers), data flow diagram showing PII paths | 0.5 day |
| 0.5 | `docs/pilot_implementation_plan.md` | Phased pilot plan: technical setup (2 weeks) → limited pilot (1 term) → evaluate. Success metrics, support model, rollback plan | 0.5 day |

**Total Phase 0 effort: ~3-4 days of writing, no code changes.**

---

### Phase 1 — "Pilot-Ready" (1-3 weeks after Phase 0)

**Goal:** Close the technical gaps that would block a real pilot deployment.

| # | Deliverable | Type | Effort |
|---|-------------|------|--------|
| 1.1 | Audit logging table + RPC | Code | Add `audit_log` table (actor, timestamp, action, resource_type, resource_id, ip_address). Log all student record reads/writes in Edge Functions | 2-3 days |
| 1.2 | Data deletion endpoints | Code | Admin-only endpoints to export all org data (JSON) and purge/anonymize institution data at contract end | 2 days |
| 1.3 | Secrets rotation + management | Ops | Rotate all keys currently in `.env`, ensure `.env` is gitignored, move production secrets to Supabase secrets or a vault | 0.5 day |
| 1.4 | Accessibility audit + fixes | Code | Run Lighthouse/axe on all key screens, fix critical issues (P0/P1), document results | 2-3 days |
| 1.5 | Bulk CSV student import | Code | Endpoint accepting CSV (email, name) to create accounts and enroll in a classroom | 1-2 days |
| 1.6 | HECVAT Lite completion | Doc | Fill out HECVAT Lite questionnaire using security overview answers | 1 day |
| 1.7 | Incident response plan | Doc | Formal IRP: detection → triage → containment → notification (72hr) → remediation → post-mortem | 0.5 day |

**Total Phase 1 effort: ~2-3 weeks.**

---

### Phase 2 — "Production-Ready" (1-3 months)

**Goal:** Meet the bar for campus-wide deployment and larger institutional contracts.

| # | Deliverable | Type | Effort |
|---|-------------|------|--------|
| 2.1 | SAML 2.0 SSO integration | Code | Implement SAML SP (via Supabase Enterprise SAML or custom integration). Map `eduPersonPrincipalName` and `eduPersonAffiliation` to Fluenci roles | 2-4 weeks |
| 2.2 | OIDC support | Code | Add OIDC provider support for institutions using Okta/Azure AD with OIDC | 1 week (if SAML done first) |
| 2.3 | Formal VPAT | Doc | Complete VPAT table with per-criterion WCAG 2.1 AA conformance status | 1-2 weeks |
| 2.4 | SOC 2 Type I roadmap | Doc + Ops | Document controls, engage auditor, begin evidence collection | Ongoing |
| 2.5 | LTI 1.3 integration | Code | Embed Fluenci assignments inside Canvas/Blackboard/Moodle via LTI | 2-3 weeks |
| 2.6 | SCIM provisioning | Code | Automated user provisioning/deprovisioning via SCIM protocol | 1-2 weeks |
| 2.7 | Penetration test | Ops | Engage third-party pen tester, document findings and remediations | 1-2 weeks + fixes |

---

## Appendix A — Mapping to Reference Reports

### Cross-reference: `selling-software-to-schools.md`

| Report Section | Requirement | Project Status |
|----------------|-------------|---------------|
| How Schools Buy Software | Internal champion + defined use case | **Met** — teacher portal provides clear use case |
| Security Review Expectations | HECVAT, encryption, access control, logging, monitoring | **Partial** — encryption and access control implemented; HECVAT, logging, and monitoring docs missing |
| FERPA Implications | Data inventory, purpose limitation, deletion, audit logging | **Partial** — RLS enforces isolation; audit logging, deletion endpoints, and FERPA doc missing |
| Accessibility | WCAG conformance, VPAT, keyboard nav, screen reader | **Partial** — good baseline annotations and contrast; no VPAT or formal audit |
| Identity / SSO | SAML 2.0, OIDC, campus IdP integration | **Missing** — email/password only |
| Compliance Signals | SOC 2, HECVAT, security policies, architecture docs | **Missing** — no compliance artifacts exist yet |
| Contract Terms | Data ownership, breach notice, deletion, subprocessors | **Partial** — `contract_config` exists in DB; no contract-ready documentation |
| Useful Trust Artifacts | Security overview, architecture diagram, privacy summary, VPAT, pilot plan | **Missing** — all artifacts need to be written |
| Founder Readiness Checklist (8 areas) | Product fit, security, privacy, identity, accessibility, contracting, procurement, operations | **3/8 partially met** (product fit, security infra, privacy infra); **5/8 missing** (docs, SSO, a11y artifacts, contracts, operations doc) |

### Cross-reference: `docs/technical_guide_for_schools.md`

| Guide Section | Requirement | Project Status |
|---------------|-------------|---------------|
| Backend Models | Multi-tenant with RLS, managed DB, encrypted | **Met** — pooled DB + `institution_id` + RLS on all school tables |
| Multi-tenant Data Models | Tenant isolation pattern documented | **Met** — exactly the recommended "Pooled DB + RLS" pattern |
| Architecture Diagrams | Actual system architecture and data flow | **Missing** — template exists in guide but no actual diagrams |
| Security / HECVAT Controls | Encryption, access control, vuln management, backups, IR | **Partial** — implemented via Supabase defaults; not documented |
| FERPA Technical Design | Data minimization, retention, deletion, audit logging | **Partial** — minimal PII; missing audit log, deletion endpoints, retention docs |
| Identity / SSO / Attribute Mapping | SAML SP, eduPerson attributes, SSO flow | **Missing** — no SSO implementation |
| Accessibility Deliverables | Statement, VPAT, implementation practices, testing | **Partial** — implementation practices in place; statement and VPAT missing |
| Campus Pilot Plan | 3-phase pilot (setup → pilot → evaluate) | **Missing** — no pilot plan document |
| Suggested Documentation Structure | 6 docs in `docs/` | **1/6 exists** (`technical_guide_for_schools.md`); 5 remaining to be created |

### Fluenci Status per Suggested Doc Structure

| Suggested File | Status |
|----------------|--------|
| `docs/selling_to_schools_overview.md` | **Exists** (as `selling-software-to-schools.md` in root) |
| `docs/technical_guide_for_schools.md` | **Exists** |
| `docs/architecture_diagrams.md` | **Missing** — Phase 0 deliverable |
| `docs/security_overview_for_it.md` | **Missing** — Phase 0 deliverable |
| `docs/privacy_and_ferpa_alignment.md` | **Missing** — Phase 0 deliverable |
| `docs/accessibility_and_vpat.md` | **Missing** — Phase 0 deliverable |
| `docs/pilot_implementation_plan.md` | **Missing** — Phase 0 deliverable |

---

## Appendix B — Key Files Referenced

| File | Contents |
|------|----------|
| `supabase/migrations/021_school_system.sql` | All 7 school tables, 20+ RLS policies, 5 RPCs, indexes |
| `supabase/migrations/020_chat_history.sql` | Chat sessions/messages with assignment linkage |
| `supabase/functions/_shared/auth.ts` | JWT validation, role fetching, enrollment resolution |
| `supabase/functions/_shared/plan-limits.ts` | Tier limits + school contract merging via `get_effective_limits()` |
| `supabase/functions/school/index.ts` | Classroom + assignment CRUD Edge Function |
| `supabase/functions/school-admin/index.ts` | Organization/contract management Edge Function |
| `DESIGN.md` | Design system with documented contrast ratios (16:1 AAA, 6:1 AA) |
| `selling-software-to-schools.md` | Procurement research, FERPA, HECVAT, deal structure |
| `docs/technical_guide_for_schools.md` | Technical patterns guide for school sales |
