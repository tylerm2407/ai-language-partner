# Fluenci — University Sales Readiness Assessment

**Date:** 2026-04-23
**Target:** Bryant University (bryant.edu) — First pilot partnership
**Assessed Against:** [Selling Software to Schools Report](../selling_software_to_schools_report.md) + HECVAT / FERPA / WCAG requirements

---

## How to Read This Document

This assessment compares Fluenci's current state against everything a university IT department, procurement office, privacy officer, and accessibility office will expect before approving a pilot. It is organized into three sections:

1. **What You Don't Have and Must Get** — gaps that will block or kill the deal
2. **What Would Be Beneficial But Not Strictly Required** — items that increase credibility and speed up procurement
3. **What You Currently Have That Is Strong** — your existing assets and how to leverage them

---

## Section 1: What You Do NOT Have and NEED

These are items that will be asked about in an IT meeting, security review, or contract negotiation and that you currently cannot deliver.

### 1.1 SSO / SAML 2.0 Integration

**Why it's needed:** The selling report explicitly states that universities "usually prefer products that fit into their existing identity stack." Bryant will almost certainly ask whether Fluenci supports SSO. Not having it is the single most common deal-blocker in higher-ed procurement.

**Your current state:** Email/password only via Supabase Auth. Your HECVAT Lite (question 3.2) states "Not currently; planned." Email domain restriction (`@bryant.edu`) is an interim workaround.

**What to do:**
- For the initial pilot meeting: Be transparent that SAML SSO is on the roadmap but not yet live. Position email-domain restriction as the pilot-phase authentication method.
- For pilot deployment: Email domain restriction is likely acceptable for a small 20-90 student cohort.
- Before campus-wide: SAML 2.0 SP must be implemented. Supabase supports SAML on Pro/Enterprise plans.

**Risk level:** Medium for pilot, high for campus-wide. Most universities will accept email-based auth for a small pilot but will require SSO for any production rollout.

---

### 1.2 Published Privacy Policy (Web)

**Why it's needed:** Your HECVAT Lite (question 2.8) says "Yes (in development for launch)." Every university procurement and legal team will want a link to your published privacy policy. The FERPA alignment doc is excellent internal documentation, but you need a public-facing privacy policy at a URL like `fluenci.app/privacy`.

**Your current state:** `docs/privacy_and_ferpa_alignment.md` exists with thorough content, but there is no published web privacy policy.

**What to do:**
- Convert the FERPA alignment doc into a public-facing privacy policy hosted at `fluenci.app/privacy`
- Must include: data collected, purpose, retention periods, subprocessors, deletion rights, contact info, FERPA alignment language

**Risk level:** High — procurement and legal will not sign a contract without a published privacy policy.

---

### 1.3 Published Terms of Service

**Why it's needed:** The selling report states that contracts commonly address "data ownership, confidentiality, breach notification timing, data deletion or return on termination, subcontractor restrictions, audit rights." You need vendor-side terms that universities can review or use as a starting point for redlining.

**Your current state:** HECVAT Lite (question 2.4) says "Yes — Terms of Service (in development)." No terms of service document exists.

**What to do:**
- Draft a Terms of Service covering: acceptable use, data ownership (institution owns their data), intellectual property, liability limitations, termination rights
- Consider having a lawyer review, even briefly, given the FERPA implications

**Risk level:** High — universities will not proceed to contract without published terms or a vendor agreement template.

---

### 1.4 Data Processing Agreement (DPA) Template

**Why it's needed:** The HECVAT Lite (question 7.8) says "Yes" to signing a DPA. Bryant's legal team will either send their DPA template or ask for yours. You need a ready-to-sign template.

**Your current state:** No DPA template exists. The FERPA alignment doc covers the content a DPA would contain, but it is not a legal agreement.

**What to do:**
- Draft a DPA template covering: data processor obligations, subprocessor list, breach notification (72 hours), data deletion at termination, audit rights, FERPA school official exception language
- The FERPA alignment doc gives you 90% of the content; it needs to be restructured into contract-ready language

**Risk level:** High — this is a contract prerequisite. Many universities will not even begin a pilot without a signed DPA.

---

### 1.5 Penetration Test

**Why it's needed:** The selling report mentions penetration testing as a HECVAT-style review topic. Your HECVAT Lite (question 6.3) states "Not yet — planned before general availability launch." While not always required for a small pilot, it significantly increases credibility and may be required by some IT teams.

**Your current state:** No penetration test has been performed.

**What to do:**
- Engage a third-party penetration tester (many offer affordable packages for startups — $2K-5K for a basic web/API pentest)
- Alternatively, run an automated security scan (OWASP ZAP, Burp Suite) and document findings/remediations
- Having even a self-conducted security assessment is better than nothing

**Risk level:** Medium — some IT teams will accept a pilot without it if other controls are documented, but it's increasingly expected.

---

### 1.6 Risk Register

**Why it's needed:** HECVAT Lite (question 2.5) says "In development." A risk register shows institutional maturity and is a standard ask in security reviews.

**Your current state:** No risk register exists.

**What to do:**
- Create a simple risk register (spreadsheet or markdown) documenting top risks: small team, no SOC 2, dependency on AI providers, data breach risk, availability risk
- Include likelihood, impact, and mitigation for each
- This can be a 1-page internal document

**Risk level:** Low-Medium — not a dealbreaker for a pilot, but shows maturity.

---

### 1.7 Business Continuity / Disaster Recovery Plan (Formal)

**Why it's needed:** HECVAT Lite (questions 2.6, 8.1) says "Partial — formal BCP in development." Universities want to know what happens if your service goes down for an extended period.

**Your current state:** Supabase provides automated backups and PITR. Your security overview documents RTO (<4 hours) and RPO (<1 minute for DB). But there is no formal BCP/DR document.

**What to do:**
- Write a 1-2 page BCP/DR plan covering: backup procedures, restore testing schedule, failover process, communication plan during outages, RTO/RPO targets
- Much of this content already exists in your security overview — it just needs to be a standalone document

**Risk level:** Low-Medium — the actual capabilities exist; the gap is documentation.

---

### 1.8 Backup Restoration Testing (Documented)

**Why it's needed:** HECVAT Lite (question 5.6) says "Planned for quarterly testing." IT teams will ask whether you've actually tested restoring from backup.

**Your current state:** No documented backup restoration test.

**What to do:**
- Perform a backup restoration test on your Supabase dev environment
- Document: date, method, data verified, time to restore, result (pass/fail)
- Put it on a quarterly schedule going forward

**Risk level:** Low — easy to do, and you can reference it verbally in the meeting.

---

### 1.9 Insurance (Cyber Liability / E&O)

**Why it's needed:** The selling report mentions "insurance and indemnity expectations." Some universities require vendors to carry cyber liability insurance, especially when handling student PII.

**Your current state:** No evidence of cyber liability or errors & omissions insurance.

**What to do:**
- Get a cyber liability insurance quote (many insurers offer policies for small SaaS companies starting at $500-1,500/year)
- This may not be required for a free/reduced-cost pilot, but larger contracts will require it

**Risk level:** Low for pilot, Medium-High for paid contracts.

---

### 1.10 Formal Security Policies (Standalone)

**Why it's needed:** HECVAT Lite (question 2.1) says "Yes — documented in security overview and internal policies." But the security overview is a summary for IT, not a formal information security policy.

**Your current state:** The security overview covers the topics, but there are no standalone policy documents (Information Security Policy, Acceptable Use Policy, Access Control Policy).

**What to do:**
- For the pilot meeting: Your security overview is likely sufficient as a reference
- For formal procurement: Draft brief standalone policies (1-2 pages each). Templates are widely available online and can be adapted quickly

**Risk level:** Low for pilot, Medium for formal procurement.

---

### 1.11 One-Page Product Overview / Use Case Summary

**Why it's needed:** The selling report's Founder Readiness Checklist lists "1-page use case summary tied to a campus pain point" as the first item. This is what you hand to the departmental champion and the IT team.

**Your current state:** No one-pager exists. You have extensive technical docs but nothing concise for a non-technical stakeholder.

**What to do:**
- Create a 1-page PDF: what Fluenci does, who it serves (language department students), the problem it solves (AI tutoring without a human tutor), key features, security/privacy headline stats, pilot offer
- This is your leave-behind document

**Risk level:** Medium — without it, the champion has nothing to circulate internally.

---

## Section 2: What Would Be BENEFICIAL But Not Strictly Required

These items would strengthen your position and speed up procurement but are unlikely to block a pilot deal.

### 2.1 SOC 2 Type I/II Certification

**Status:** Your HECVAT Lite says "Not yet (Supabase infrastructure holds SOC 2 Type II); planned for Fluenci when revenue supports it."

**Why it's beneficial:** SOC 2 is the most common trust signal for SaaS companies selling to institutions. Having it — or even a documented roadmap toward it — differentiates you from competitors.

**Recommendation:** Don't pursue it now (costs $15-50K+). Instead, mention that your infrastructure provider (Supabase) holds SOC 2 Type II and that you plan to pursue your own certification as the business scales. This is perfectly acceptable for a pilot.

---

### 2.2 LTI 1.3 Integration (Canvas / Blackboard / Moodle)

**Status:** HECVAT Lite (question 7.7) says "Not currently; planned for future release."

**Why it's beneficial:** Universities use LMS platforms extensively. Being able to embed Fluenci assignments directly inside Canvas or Blackboard makes adoption frictionless and reduces IT burden. Language departments especially value this.

**Recommendation:** Not needed for the pilot meeting, but mention it as a roadmap item. If Bryant uses Canvas (very common), ask what LMS they use in the meeting — it signals awareness of their workflow.

---

### 2.3 SCIM Provisioning

**Status:** HECVAT Lite (question 7.6) says "Not currently; planned for enterprise tier."

**Why it's beneficial:** Automated user provisioning/deprovisioning saves IT time and reduces orphaned accounts. For a small pilot, CSV import is fine.

**Recommendation:** Mention it as a future capability. Your existing CSV bulk enrollment is adequate for pilot-scale.

---

### 2.4 Automated Accessibility Testing in CI

**Status:** Your VPAT notes "axe-core integration planned for CI pipeline."

**Why it's beneficial:** Demonstrates ongoing commitment to accessibility, not just a one-time audit. Accessibility offices love to see this.

**Recommendation:** Add `jest-axe` or `@axe-core/react-native` to your test pipeline. It's a small effort with outsized credibility.

---

### 2.5 Geographic Redundancy / Multi-Region

**Status:** HECVAT Lite (question 8.4) says "Single region (us-east-1); Supabase provides availability zone redundancy within region."

**Why it's beneficial:** Multi-region deployment reduces single-point-of-failure risk. However, for a pilot with a single school, single-region with AZ redundancy is perfectly standard.

**Recommendation:** Not needed now. If asked, explain that AZ redundancy provides high availability within the region and that multi-region is on the roadmap for enterprise-scale deployments.

---

### 2.6 Certificate Pinning on Mobile

**Status:** Security overview notes "Certificate pinning not currently enforced on mobile (Expo limitation)."

**Why it's beneficial:** Prevents MITM attacks on mobile. Security teams occasionally ask about it.

**Recommendation:** Note it as a known limitation. TLS 1.2+ enforcement provides strong transport security even without pinning. This is unlikely to be a dealbreaker.

---

### 2.7 MFA Enforcement for Administrators

**Status:** HECVAT Lite (question 3.3) says "Supabase Auth supports MFA (TOTP); not currently enforced for students."

**Why it's beneficial:** Enforcing MFA for school_admin and teacher roles shows security maturity. Students typically don't need MFA for a language learning app.

**Recommendation:** Enable and enforce TOTP MFA for `school_admin` and `teacher` roles. Supabase supports this natively — it's a configuration change, not a code change.

---

### 2.8 Reference Customers / Testimonials

**Why it's beneficial:** The selling report says "Build trust with responsiveness, references, and operational maturity." Even one testimonial from a professor or student who used the app is valuable.

**Recommendation:** If you have any beta testers, professors who've seen the product, or early users — get a quote. Even "We tested Fluenci with 10 students in a Spanish course and saw..." is powerful.

---

### 2.9 Teacher/Student Onboarding Materials

**Status:** Pilot plan mentions "Quick-start guide (PDF) for students" and "30-min live walkthrough."

**Why it's beneficial:** Reduces IT support burden and shows operational maturity. Language professors especially want to see how easy it is for students to get started.

**Recommendation:** Create a 1-page quickstart PDF for students and a 2-page guide for teachers. These can be simple and visual.

---

### 2.10 Uptime/Status Page

**Why it's beneficial:** A public status page (e.g., via Instatus, Betteruptime, or UptimeRobot) shows transparency about availability. IT teams love being able to check service status independently.

**Recommendation:** Set up a simple status page at `status.fluenci.app`. Many services offer free tiers.

---

## Section 3: What You Currently Have That Is STRONG

These are significant assets. Know them, reference them in the meeting, and use them with confidence.

### 3.1 Complete Security Documentation Suite

**What you have:**
- `docs/security_overview_for_it.md` — comprehensive 11-section security overview covering infrastructure, encryption, auth, secrets, backups, network security, vulnerability management, incident response, compliance posture, audit logging
- `docs/incident_response_plan.md` — formal 5-phase IRP with severity classification, containment procedures, FERPA-specific breach notification template, roles, and preventive measures
- `docs/hecvat_lite.md` — pre-filled 9-section HECVAT Lite (the exact questionnaire most universities use)

**Why it's strong:** Most startups at your stage have *none* of this. You can hand the HECVAT to IT on day one, which immediately sets you apart. The breach notification template in the IRP is especially professional.

---

### 3.2 FERPA Alignment and Privacy Documentation

**What you have:**
- `docs/privacy_and_ferpa_alignment.md` — 10-section document covering data inventory (with retention periods per field), purpose limitation (what student data IS and IS NOT used for), subprocessor inventory with DPA status, access controls, data deletion/export procedures, breach notification, institutional controls

**Why it's strong:** The "school official" exception framing (34 CFR § 99.31(a)(1)(i)(B)) is exactly the legal framework universities use. The explicit statement that AI providers are contractually prohibited from training on student data addresses the #1 concern universities have about AI-powered tools right now.

---

### 3.3 Architecture and Data Flow Diagrams

**What you have:**
- `docs/architecture_diagrams.md` — 6 Mermaid diagrams: system architecture, PII data flow, subprocessor inventory, database schema, authentication flow, and school feature architecture

**Why it's strong:** The PII data flow diagram is exactly what security teams want to see — it shows every external service that touches student data and marks what data goes where. This is the diagram you pull up in the IT meeting.

---

### 3.4 Accessibility Statement and VPAT

**What you have:**
- `docs/accessibility_and_vpat.md` — accessibility commitment, current features (visual, screen reader, motor, cognitive), known gaps with remediation plan, testing approach, and a full VPAT table covering all WCAG 2.1 Level A and AA criteria

**Why it's strong:** Most startups have zero accessibility documentation. You have a criterion-by-criterion VPAT. The known gaps section is honest (which builds trust) and includes remediation plans (which shows commitment). The design system (DESIGN.md) documents contrast ratios at AAA level (14.6:1), which is exceptional.

---

### 3.5 Multi-Tenant Architecture with Row-Level Security

**What you have (in code):**
- 7 dedicated school tables with RLS on all of them
- Granular role hierarchy: `learner`, `teacher`, `school_admin`
- Organization scoping with `institution_id`
- Per-org `contract_config` with feature limits
- `get_effective_limits()` RPC merging personal + school contracts
- Permission functions: `is_classroom_teacher()`, `is_classroom_student()`, `is_org_admin()`

**Why it's strong:** This is production-grade multi-tenancy. Most startups bolt on school features as an afterthought. Your data model was designed for institutional deployment from the start.

---

### 3.6 Audit Logging (Implemented)

**What you have:**
- `audit_log` table (migration 022) with actor, action, resource_type, resource_id, organization_id, metadata, timestamp
- `supabase/functions/_shared/audit.ts` — shared audit logging utility used across Edge Functions
- `app/(teacher)/admin/audit-log.tsx` — admin UI for viewing audit logs

**Why it's strong:** Audit logging is a FERPA requirement and a HECVAT topic. Having it implemented *and* surfaced in the admin UI is exceptional for a pre-launch product.

---

### 3.7 Data Lifecycle Endpoints (Implemented)

**What you have:**
- `export-org-data` endpoint for full organization data export
- `purge-org-data` endpoint for data anonymization/deletion
- `app/(teacher)/admin/data-management.tsx` — admin UI for data export and deletion
- Documented 30-day post-contract deletion timeline
- Individual student record deletion capability

**Why it's strong:** Data portability and deletion are contract prerequisites. Having working endpoints (not just promises) is a significant differentiator.

---

### 3.8 Full Teacher Portal and Assignment Workflow

**What you have:**
- Classroom CRUD with invite codes
- Assignment lifecycle: draft → published → closed
- AI auto-grading with teacher override
- Rubric-based feedback
- Bulk CSV student enrollment
- Teacher dashboard with student progress visibility

**Why it's strong:** This demonstrates a complete institutional use case, not just a consumer app with "school mode" bolted on. The assignment workflow (create → students complete → AI grades → teacher reviews) is the exact story you tell the language department chair.

---

### 3.9 Pilot Implementation Plan

**What you have:**
- `docs/pilot_implementation_plan.md` — 3-phase plan (technical setup → limited pilot → evaluate), with weekly operations schedule, 7 tracked metrics with targets, go/no-go decision criteria, support model with SLAs, rollback/termination plan, and pricing structures

**Why it's strong:** This is the document that makes the university say "they've done this before" (even if you haven't). The decision criteria table (go/no-go signals) is especially strong because it shows you're accountable and willing to be measured.

---

### 3.10 Documentation Index and Professional Presentation

**What you have:**
- `docs/README.md` — clean index of all compliance docs with audience mapping
- Quick-answer table for the 8 most common IT questions
- Consistent professional formatting across all docs with contact emails by function (security@, privacy@, partnerships@, accessibility@)

**Why it's strong:** When you hand IT a link to your docs folder and they see a clean index with 8 documents organized by audience, it signals operational maturity far beyond a 2-person startup.

---

## Summary: Priority Action Items Before the Bryant Meeting

| # | Item | Type | Effort | Risk if Missing |
|---|------|------|--------|----------------|
| 1 | Published privacy policy (web URL) | Legal/Web | 1 day | **High** — legal will ask for it |
| 2 | Terms of Service (draft) | Legal | 1-2 days | **High** — contract blocker |
| 3 | DPA template | Legal | 1 day | **High** — contract prerequisite |
| 4 | 1-page product overview / use case PDF | Marketing | 0.5 day | **Medium** — champion needs leave-behind |
| 5 | Backup restoration test (documented) | Ops | 0.5 day | **Low** — easy credibility win |
| 6 | SSO position statement (for the meeting) | Talking point | 0 (verbal) | **Medium** — know your answer |
| 7 | MFA enforcement for admin/teacher roles | Config | 0.5 day | **Low** — easy security upgrade |
| 8 | Student/teacher quickstart guides | Content | 1 day | **Low** — nice to have at meeting |

**Bottom line:** Your technical architecture, security documentation, and compliance artifacts are exceptionally strong for a pre-launch startup. The remaining gaps are primarily legal documents (privacy policy, ToS, DPA) and sales collateral (one-pager, quickstart guides). These are writing tasks, not engineering tasks. The SSO gap is the only significant technical item, and it's acceptable for a pilot with the email-domain-restriction workaround.
