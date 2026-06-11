# Information Security Policy

**Product:** Fluenci — AI-Powered Language Learning Platform
**Company:** NovaWealth
**Effective Date:** 2026-04-23
**Policy Owner:** Tyler Moore
**Review Cycle:** Annual
**Contact:** security@fluenci.app

---

## 1. Purpose

This policy establishes the information security requirements for the Fluenci platform, ensuring the confidentiality, integrity, and availability of all data processed, stored, and transmitted by the system. It applies to all personnel, contractors, and third-party service providers with access to Fluenci systems or data.

## 2. Scope

This policy covers all Fluenci infrastructure (Supabase, AWS us-east-1), application code, Edge Functions, mobile clients, administrative tools, and any data processed on behalf of institutional partners, teachers, and learners.

## 3. Data Classification

All data handled by Fluenci must be classified into one of the following tiers:

| Classification | Definition | Examples | Handling |
|----------------|-----------|----------|----------|
| **Public** | Non-sensitive, intended for public access | Marketing content, public documentation | No restrictions |
| **Internal** | Business data not intended for public release | Architecture docs, internal roadmaps, aggregate analytics | Share only with authorized personnel |
| **Confidential** | Sensitive data requiring protection | Student PII (names, emails), learning progress, chat history, teacher records | Encrypted at rest and in transit; access restricted by role |
| **Restricted** | Highest sensitivity; regulatory or contractual obligations | API keys, secrets, authentication tokens, service role keys, FERPA-protected education records | Encrypted, access logged, no client-side exposure, stored only in Supabase Secrets Manager |

## 4. Access Control Principles

- **Least Privilege:** Users and systems receive only the minimum permissions required for their function. RLS enforces data isolation at the database layer.
- **Need-to-Know:** Access to Confidential and Restricted data is granted only when a documented business need exists.
- **Separation of Duties:** No single individual can provision accounts, approve access, and audit access logs without oversight. Administrative actions are audit-logged.

## 5. Encryption Standards

| Layer | Standard | Implementation |
|-------|----------|----------------|
| Data at Rest | AES-256 | Supabase KMS (AWS RDS encryption), S3 SSE for file storage, encrypted backups |
| Data in Transit | TLS 1.2+ | Enforced on all API, database, and storage connections; HSTS headers enabled |
| Secrets | Environment-variable isolation | Stored in Supabase Secrets Manager; never in client code or version control |

## 6. Vulnerability Management

| Severity | Patching SLA | Action |
|----------|-------------|--------|
| Critical | 48 hours | Immediate triage, hotfix deployment, stakeholder notification |
| High | 7 days | Prioritized in current sprint |
| Medium | 30 days | Scheduled for next release cycle |
| Low | 90 days | Addressed during routine maintenance |

- `npm audit` runs on every build. Critical findings block deployment.
- Supabase manages PostgreSQL and infrastructure patching.
- All code changes require review before deployment.

## 7. Incident Response

Security incidents are handled per the Incident Response Plan (`docs/incident_response_plan.md`). Key commitments:

- Confirmed breaches affecting student PII are reported to affected institutions within 72 hours.
- Post-incident root cause analysis and remediation are shared with affected parties.
- All incidents are logged with timestamps, actors, and resolution details.

## 8. Employee and Contractor Responsibilities

All personnel with access to Fluenci systems must:

- Complete security awareness orientation before receiving system access.
- Never share credentials or authentication tokens.
- Report suspected security incidents to security@fluenci.app immediately.
- Use MFA for administrative and teacher-role accounts.
- Never store Restricted data on personal devices or in unapproved services.

## 9. Policy Review

This policy is reviewed annually or upon significant changes to infrastructure, regulatory requirements, or business operations. The Policy Owner is responsible for initiating and completing the review.

## 10. Exceptions

Exceptions to this policy require written approval from the Policy Owner, including:

- Business justification for the exception.
- Risk assessment of the deviation.
- Compensating controls to be applied.
- Expiration date (maximum 12 months; must be re-evaluated).

Approved exceptions are logged in the decision log (`decisions/log.md`).
