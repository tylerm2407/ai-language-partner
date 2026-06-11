# Risk Register

**Product:** Fluenci — AI-Powered Language Learning Platform
**Last Updated:** 2026-04-23
**Owner:** Tyler Moore

---

## Risk Scoring Matrix

| | **Low Impact (1)** | **Medium Impact (2)** | **High Impact (3)** |
|---|---|---|---|
| **High Likelihood (3)** | 3 | 6 | 9 |
| **Medium Likelihood (2)** | 2 | 4 | 6 |
| **Low Likelihood (1)** | 1 | 2 | 3 |

**Score Thresholds:** 1-2 = Accept | 3-4 = Monitor | 6 = Mitigate | 9 = Urgent Action

---

## Risk Register

| Risk ID | Category | Risk Description | Likelihood | Impact | Score | Current Mitigations | Residual Risk | Owner |
|---------|----------|------------------|------------|--------|-------|---------------------|---------------|-------|
| R-001 | Operational | **Key person dependency.** Team of 2 creates single-point-of-failure risk. If Tyler (sole developer) is unavailable, all technical operations — incident response, deployments, bug fixes — halt. | High | High | 9 | Documented IRP with roles assigned; Owen can handle communications; infrastructure is managed (Supabase) reducing ops burden. | High — no backup developer for technical response. Hire or contract a part-time engineer. | Tyler Moore |
| R-002 | Compliance | **No SOC 2 certification.** Fluenci does not hold its own SOC 2 report. Some institutional procurement teams require vendor SOC 2 as a prerequisite, which may block or delay deals. | Medium | Medium | 4 | Supabase (infrastructure provider) holds SOC 2 Type II. Security Overview and HECVAT Lite documentation available for IT review. Compensating controls documented. | Medium — may lose deals with strict procurement. Plan SOC 2 readiness assessment in 2026 H2. | Tyler Moore |
| R-003 | Technical | **AI provider dependency.** Fluenci relies on third-party LLM APIs (Anthropic, Google, OpenAI) for lesson generation, grading, and conversational practice. An outage, pricing change, or API deprecation directly impacts core functionality. | Medium | High | 6 | Multi-provider architecture allows failover between providers. Pre-authored fallback exercises available for core lesson types. Retry logic with exponential backoff on API failures. | Medium — extended multi-provider outage would degrade AI features. Maintain pre-authored content coverage for critical paths. | Tyler Moore |
| R-004 | Security | **Data breach — unauthorized access to student PII.** Compromised credentials, RLS misconfiguration, or application vulnerability exposes student names, emails, learning data, or chat history. | Low | High | 3 | RLS enabled on all tables; JWT validation on every request; role-based access control; audit logging; Cloudflare WAF; no direct database access from public internet; secrets stored in Supabase Secrets Manager. | Low — strong controls in place, but no penetration test yet (see R-010). | Tyler Moore |
| R-005 | Technical | **Service availability — Supabase outage.** Fluenci is fully hosted on Supabase. A platform-wide outage would make the app completely unavailable. | Low | High | 3 | Supabase provides 99.9% uptime SLA on Pro plan; infrastructure runs on AWS with managed redundancy; Cloudflare CDN caches static assets. BCP/DR plan documented. | Low — single-platform dependency accepted at current scale. Monitor Supabase status; evaluate multi-cloud only if uptime SLA is breached. | Tyler Moore |
| R-006 | Compliance | **FERPA non-compliance.** A data handling error — misconfigured RLS policy, logging PII in plaintext, or improper data sharing — could constitute a FERPA violation, jeopardizing institutional contracts and trust. | Low | High | 3 | FERPA alignment documented; RLS enforces data isolation per organization; data export/deletion endpoints implemented; no PII in client logs; 72-hour breach notification process in IRP; audit logging of all admin actions. | Low — controls are strong but not independently audited. Schedule annual FERPA compliance review. | Tyler Moore |
| R-007 | Vendor | **Subprocessor risk — AI provider changes data handling terms.** An AI provider (Anthropic, Google, OpenAI) changes its data retention, training, or privacy terms in a way that conflicts with Fluenci's FERPA commitments or institutional DPAs. | Medium | Medium | 4 | Using zero-retention API tiers where available; DPA review before onboarding any new AI provider; multi-provider architecture enables rapid provider switch; contractual data processing terms documented. | Medium — terms changes may require rapid provider migration. Maintain provider-switching capability and monitor terms quarterly. | Tyler Moore |
| R-008 | Technical | **Single region deployment.** All infrastructure runs in AWS us-east-1. A regional failure (rare but possible) would cause total service unavailability with no geographic failover. | Low | High | 3 | Supabase manages infrastructure redundancy within the region; daily backups stored durably; PITR enables recovery to within 1 minute of failure. BCP/DR plan documents restoration procedures. | Low — acceptable risk at current scale. Evaluate multi-region when user base exceeds 10K or institutional SLAs require it. | Tyler Moore |
| R-009 | Security | **Secret compromise — API key leak or credential exposure.** An API key, service role key, or other credential is accidentally committed to version control, logged, or exposed in a client bundle. | Medium | High | 6 | Secrets stored in Supabase Secrets Manager (not in code); client-side uses only public anon key (restricted by RLS); service role key used only in Edge Functions; quarterly key rotation policy; no secrets in version control; `.gitignore` enforced. | Medium — human error remains possible. Implement pre-commit secret scanning (e.g., GitGuardian or gitleaks). | Tyler Moore |
| R-010 | Security | **No penetration test.** No external penetration test has been conducted. Undiscovered vulnerabilities in application logic, RLS policies, or Edge Functions may exist. | High | Medium | 6 | Code review on all changes; RLS enabled on all tables; `npm audit` on every build; Cloudflare WAF provides baseline protection; Supabase platform is independently audited. | Medium — application-layer vulnerabilities may exist. Schedule first penetration test before institutional launch. | Tyler Moore |

---

## Risk Response Actions

| Risk ID | Action | Target Date | Status |
|---------|--------|-------------|--------|
| R-001 | Identify and onboard a contract developer for backup coverage | 2026 Q3 | Not Started |
| R-002 | Complete SOC 2 readiness assessment | 2026 H2 | Not Started |
| R-003 | Expand pre-authored fallback exercise library to cover all CEFR levels | 2026 Q2 | In Progress |
| R-004 | Schedule external penetration test (see R-010) | 2026 Q2 | Not Started |
| R-009 | Implement pre-commit secret scanning in CI pipeline | 2026 Q2 | Not Started |
| R-010 | Engage third-party firm for initial penetration test | 2026 Q2 | Not Started |

---

## Review Schedule

This risk register is reviewed and updated:
- **Quarterly** as part of routine security review
- **After any P1 or P2 incident** (per the Incident Response Plan)
- **Before any new institutional contract** to ensure current risk posture is accurately represented

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-23 | Tyler Moore | Initial version |
