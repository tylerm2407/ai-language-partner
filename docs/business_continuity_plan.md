# Business Continuity & Disaster Recovery Plan

**Product:** Fluenci — AI-Powered Language Learning Platform
**Last Updated:** 2026-04-23
**Plan Owner:** Tyler Moore
**Contact:** security@fluenci.app

---

## 1. Purpose & Scope

This plan defines procedures for maintaining and restoring Fluenci's services following a disruption, whether caused by infrastructure failure, data corruption, security incident, or vendor outage. It covers all production systems and data stores that support the Fluenci platform.

**In scope:** Supabase PostgreSQL database, Supabase Edge Functions, Supabase Auth, Supabase Storage, Cloudflare CDN/WAF, third-party AI provider APIs, mobile application distribution.

**Out of scope:** Development environments, local workstations, source code repository availability (GitHub maintains its own SLAs).

---

## 2. Key Systems & Dependencies

| System | Provider | Function | Criticality |
|--------|----------|----------|-------------|
| PostgreSQL Database | Supabase (AWS RDS) | All user data, learning progress, lesson content, audit logs | Critical |
| Edge Functions | Supabase (Deno isolates) | API logic, AI orchestration, grading, content generation | Critical |
| Authentication | Supabase Auth | User login, JWT issuance, session management | Critical |
| File Storage | Supabase Storage (S3) | Audio files, user uploads, static assets | High |
| CDN / WAF | Cloudflare | Content delivery, DDoS protection, TLS termination | High |
| AI APIs | Anthropic, Google, OpenAI | Lesson generation, conversational practice, AI grading | High |
| Source Control | GitHub | Code repository, deployment pipeline | Medium |
| Mobile Distribution | Apple App Store, Google Play | App delivery to end users | Medium |

---

## 3. Recovery Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| **Recovery Time Objective (RTO)** | < 4 hours | Time from incident declaration to service restoration |
| **Recovery Point Objective (RPO) — Database** | < 1 minute | Via Supabase Point-in-Time Recovery (PITR) |
| **Recovery Point Objective (RPO) — File Storage** | < 24 hours | Daily backup cycle |
| **Recovery Point Objective (RPO) — Edge Functions** | 0 (no data loss) | Code is in Git; redeployable at any time |
| **Maximum Tolerable Downtime (MTD)** | 8 hours | Beyond this, institutional SLA commitments are at risk |

---

## 4. Backup Procedures

### 4.1 Database Backups

| Item | Detail |
|------|--------|
| Method | Supabase automated daily backups + continuous WAL archiving for PITR |
| Frequency | Daily full backup; continuous WAL streaming |
| PITR Window | 30 days |
| Encryption | AES-256 at rest via AWS KMS |
| What is backed up | All PostgreSQL schemas, tables, indexes, RLS policies, stored procedures, extensions |
| Verification | Quarterly restoration test (see Section 6) |

### 4.2 File Storage Backups

| Item | Detail |
|------|--------|
| Method | Supabase Storage (S3-backed) with S3 versioning |
| Frequency | Continuous (S3 durability: 99.999999999%) |
| What is backed up | Audio files, user-uploaded content, static assets |

### 4.3 Edge Function Code

| Item | Detail |
|------|--------|
| Method | All Edge Function source code stored in Git (GitHub) |
| Recovery | Redeploy from latest commit on the main branch |
| What is backed up | All function code, configuration, environment variable names (values stored separately in Supabase Secrets Manager) |

### 4.4 Configuration & Secrets

| Item | Detail |
|------|--------|
| Secrets | Stored in Supabase Secrets Manager; documented inventory maintained offline |
| RLS Policies | Defined in migration files, version-controlled in Git |
| Auth Configuration | Supabase dashboard settings; documented in internal runbook |

---

## 5. Disaster Scenarios & Response Procedures

### Scenario 1: Database Failure

**Trigger:** Supabase PostgreSQL becomes unresponsive or returns errors; data queries fail.

| Step | Action | Owner |
|------|--------|-------|
| 1 | Confirm outage via Supabase Dashboard and status page | Tyler |
| 2 | Check Supabase status (status.supabase.com) for platform-wide incidents | Tyler |
| 3 | If platform-wide: monitor Supabase status; proceed to communication plan | Tyler |
| 4 | If project-specific: initiate PITR restore via Supabase Dashboard to last known good timestamp | Tyler |
| 5 | Verify data integrity after restore (spot-check key tables, row counts, recent records) | Tyler |
| 6 | Confirm Edge Functions reconnect successfully | Tyler |
| 7 | Monitor for 4 hours post-restore | Tyler |

**RTO:** < 4 hours | **RPO:** < 1 minute (PITR)

---

### Scenario 2: Edge Function Failure

**Trigger:** One or more Edge Functions return 500 errors, timeout, or fail to deploy.

| Step | Action | Owner |
|------|--------|-------|
| 1 | Identify failing function(s) via Supabase Edge Function logs | Tyler |
| 2 | Check if failure is code-related or platform-related | Tyler |
| 3 | If code-related: revert to last known good commit and redeploy from Git | Tyler |
| 4 | If platform-related: escalate to Supabase support; monitor status page | Tyler |
| 5 | Verify function health after redeploy (test endpoints manually) | Tyler |

**RTO:** < 1 hour (code) / < 4 hours (platform) | **RPO:** 0 (code in Git)

---

### Scenario 3: Auth System Failure

**Trigger:** Users cannot log in; JWT validation fails; Supabase Auth returns errors.

| Step | Action | Owner |
|------|--------|-------|
| 1 | Confirm Auth service status via Supabase Dashboard | Tyler |
| 2 | Check Supabase status page for Auth-specific incidents | Tyler |
| 3 | Escalate to Supabase support with project reference and error details | Tyler |
| 4 | If prolonged (> 2 hours): activate communication plan; notify institutions | Tyler / Owen |
| 5 | Do NOT attempt to rebuild Auth configuration — wait for Supabase resolution | — |
| 6 | Once resolved: verify login flow, token issuance, and RLS enforcement | Tyler |

**RTO:** Dependent on Supabase | **RPO:** 0 (Auth state is persistent)

---

### Scenario 4: Complete Supabase Outage

**Trigger:** All Supabase services (DB, Auth, Edge Functions, Storage) are unavailable simultaneously.

| Step | Action | Owner |
|------|--------|-------|
| 1 | Confirm via status.supabase.com and Supabase support channels | Tyler |
| 2 | Activate communication plan (see Section 7) | Owen |
| 3 | Post status update to institutional contacts within 1 hour | Owen |
| 4 | Enable degraded mode in mobile app if supported (cached content, offline review) | Tyler |
| 5 | Monitor Supabase status for restoration updates; relay to stakeholders every 2 hours | Tyler / Owen |
| 6 | Once restored: verify all services (DB, Auth, Edge Functions, Storage) | Tyler |
| 7 | Send all-clear notification to institutional contacts | Owen |
| 8 | Conduct post-incident review within 48 hours | Tyler |

**RTO:** Dependent on Supabase | **RPO:** < 1 minute (DB via PITR), < 24 hours (Storage)

---

### Scenario 5: Data Corruption

**Trigger:** Application bug, failed migration, or malicious action causes data corruption (incorrect, missing, or inconsistent records).

| Step | Action | Owner |
|------|--------|-------|
| 1 | Identify scope of corruption (which tables, how many rows, time range) | Tyler |
| 2 | Immediately halt any running migrations or deployments | Tyler |
| 3 | Determine the latest clean timestamp (before corruption began) | Tyler |
| 4 | Initiate PITR restore to the pre-corruption timestamp via Supabase Dashboard | Tyler |
| 5 | Verify restored data integrity (compare row counts, spot-check affected records) | Tyler |
| 6 | If corruption was caused by code: fix the bug, test, and redeploy before resuming | Tyler |
| 7 | Document root cause and add regression test | Tyler |
| 8 | If student data was affected: assess whether breach notification is required per IRP | Tyler |

**RTO:** < 4 hours | **RPO:** < 1 minute (PITR to pre-corruption state)

---

## 6. Backup Restoration Testing Schedule

Backup restoration is tested quarterly to validate recovery procedures and data integrity.

| Quarter | Test Window | Scope |
|---------|-------------|-------|
| Q1 | January | Full database PITR restore to staging environment |
| Q2 | April | Full database PITR restore + Edge Function redeploy |
| Q3 | July | Full database PITR restore + Storage recovery verification |
| Q4 | October | Full DR simulation (all scenarios) |

### Test Procedure

1. Create a staging project on Supabase (or use existing staging instance).
2. Perform PITR restore of production database to staging.
3. Verify data integrity: row counts, schema correctness, RLS policy enforcement, recent records.
4. Redeploy Edge Functions to staging and verify endpoint health.
5. Document results, noting any failures or deviations from expected outcomes.
6. File test report in `docs/dr-test-reports/` with date, tester, results, and follow-up actions.

### Test Report Template

```
## DR Test Report — [DATE]
**Tester:** [NAME]
**Scope:** [WHAT WAS TESTED]
**Result:** PASS / FAIL
**PITR Restore Time:** [MINUTES]
**Data Integrity Check:** PASS / FAIL
**Edge Function Redeploy:** PASS / FAIL / N/A
**Issues Found:** [DESCRIPTION or NONE]
**Follow-Up Actions:** [ACTIONS or NONE]
```

---

## 7. Communication Plan During Outages

### Notification Thresholds

| Duration | Action |
|----------|--------|
| < 30 minutes | Internal team notification only |
| 30 min — 2 hours | Notify institutional IT contacts if during business hours |
| > 2 hours | Formal notification to all institutional contacts with ETA |
| > 4 hours (RTO exceeded) | Escalation notification with updated ETA and impact assessment |

### Notification Channels

| Audience | Channel | Responsible |
|----------|---------|-------------|
| Internal team (Tyler + Owen) | Phone / SMS / Discord | First responder |
| Institutional IT contacts | Email to IT contact on file | Owen Ash |
| End users (students/teachers) | In-app banner (when service restored) + email if > 4 hours | Tyler Moore |
| Supabase support | Supabase support portal | Tyler Moore |

### Notification Template (Institutional)

```
Subject: Fluenci Service Disruption — [DATE]

Dear [IT Contact],

We are currently experiencing a service disruption affecting the Fluenci platform.

**Start Time:** [TIME, TIMEZONE]
**Affected Services:** [LIST]
**Current Status:** [INVESTIGATING / IDENTIFIED / RESTORING]
**Estimated Resolution:** [ETA or "Under investigation"]

We will provide updates every [1-2] hours until resolution.

If you have questions, please contact us at security@fluenci.app.

Regards,
Fluenci Team
```

---

## 8. Roles & Responsibilities

| Role | Person | Responsibilities |
|------|--------|------------------|
| **Incident Commander** | Tyler Moore | Declare incident severity; coordinate response; approve communications; make go/no-go decisions on restore actions |
| **Technical Lead** | Tyler Moore | Diagnose root cause; execute restore procedures; verify recovery; redeploy services |
| **Communications Lead** | Owen Ash | Draft and send institutional notifications; manage inbound inquiries; post status updates |
| **Backup Technical** | Owen Ash | Monitor Supabase status page; relay updates to Tyler; assist with non-technical recovery tasks |

**Escalation path:** If Tyler is unreachable for > 1 hour during a P1 incident, Owen contacts Supabase support directly and follows the documented procedures in this plan.

---

## 9. Annual Review Schedule

This plan is reviewed and updated:

| Trigger | Action |
|---------|--------|
| **Annually (January)** | Full review of all sections; update systems, contacts, and procedures |
| **After any P1 or P2 incident** | Review and update affected procedures within 14 days |
| **After any DR test failure** | Immediate review of failed procedure; update and retest within 30 days |
| **When infrastructure changes** | Update Key Systems table and affected scenarios (e.g., new provider, new region) |
| **Before new institutional contract** | Confirm plan is current and accurate |

---

## 10. Related Documents

| Document | Location |
|----------|----------|
| Incident Response Plan | `docs/incident_response_plan.md` |
| Security Overview for IT | `docs/security_overview_for_it.md` |
| Privacy & FERPA Alignment | `docs/privacy_and_ferpa_alignment.md` |
| Risk Register | `docs/risk_register.md` |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-23 | Tyler Moore | Initial version |
