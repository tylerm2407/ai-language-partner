# HECVAT Lite — Higher Education Community Vendor Assessment Toolkit

**Vendor:** NovaWealth (dba Fluenci)
**Product:** Fluenci — AI-Powered Language Learning Platform
**Date Completed:** 2026-04-20
**Completed By:** Tyler Moore, Founder

---

## Section 1: Company Information

| # | Question | Response |
|---|----------|----------|
| 1.1 | Company legal name | NovaWealth |
| 1.2 | Product/service name | Fluenci |
| 1.3 | Company website | fluenci.app |
| 1.4 | Primary contact for security inquiries | security@fluenci.app |
| 1.5 | Year company was founded | 2026 |
| 1.6 | Number of employees | 2 |
| 1.7 | Number of customers in higher education | Pre-launch (0, seeking pilot partners) |
| 1.8 | Company headquarters location | United States (Eastern Time) |

---

## Section 2: Documentation & Policies

| # | Question | Response |
|---|----------|----------|
| 2.1 | Do you have a documented information security policy? | Yes — documented in security overview and internal policies |
| 2.2 | Do you have a documented incident response plan? | Yes — `docs/incident_response_plan.md` |
| 2.3 | Do you have a documented data classification policy? | Yes — data inventory with retention periods in FERPA alignment doc |
| 2.4 | Do you have a documented acceptable use policy? | Yes — Terms of Service (in development) |
| 2.5 | Do you maintain a risk register? | In development |
| 2.6 | Do you have a business continuity/disaster recovery plan? | Partial — Supabase provides automated backups with 30-day PITR; formal BCP in development |
| 2.7 | Are policies reviewed at least annually? | Yes |
| 2.8 | Do you have a privacy policy? | Yes (in development for launch) |

---

## Section 3: Access Control

| # | Question | Response |
|---|----------|----------|
| 3.1 | How do users authenticate? | Email/password or magic link via Supabase Auth |
| 3.2 | Do you support SSO (SAML/OIDC)? | Not currently; planned via email domain restriction as interim. SAML planned for enterprise tier. |
| 3.3 | Do you support multi-factor authentication? | Supabase Auth supports MFA (TOTP); not currently enforced for students |
| 3.4 | How is authorization managed? | Role-based (learner/teacher/school_admin) with Row Level Security on all tables |
| 3.5 | Can institutions manage their own user provisioning? | Yes — school admins can add/remove teachers; teachers can bulk-enroll students via CSV |
| 3.6 | Are administrative actions logged? | Yes — all mutations logged to audit_log table with actor, action, resource, timestamp, IP |
| 3.7 | Can institutions access audit logs? | Yes — org admins can query audit logs for their organization |
| 3.8 | Is there automatic session timeout? | Yes — JWT expires after 1 hour; refresh token rotation |
| 3.9 | Is principle of least privilege applied? | Yes — RLS ensures users only access data appropriate to their role |

---

## Section 4: Data Protection

| # | Question | Response |
|---|----------|----------|
| 4.1 | Where is data stored geographically? | AWS us-east-1 (United States) |
| 4.2 | Is data encrypted at rest? | Yes — AES-256 via Supabase/AWS KMS |
| 4.3 | Is data encrypted in transit? | Yes — TLS 1.2+ enforced on all connections |
| 4.4 | What data do you collect about students? | Email, display name, learning progress, chat messages, voice recordings, assignment submissions |
| 4.5 | Is student data shared with third parties? | Only with subprocessors for service delivery (Anthropic, Google, OpenAI, ElevenLabs) — all under DPAs |
| 4.6 | Is student data used for AI model training? | No — all AI API providers contractually prohibited from training on input data |
| 4.7 | Can institutions export their data? | Yes — `export-org-data` endpoint returns all org data as JSON |
| 4.8 | Can institutions request data deletion? | Yes — `purge-org-data` endpoint anonymizes/deletes all org PII within 30 days |
| 4.9 | What is your data retention policy? | Duration of contract + 30 days for PII; 90 days for voice recordings; aggregated analytics retained indefinitely |
| 4.10 | Do you have a data breach notification process? | Yes — 72-hour notification to institutional IT contact |

---

## Section 5: Infrastructure & Operations

| # | Question | Response |
|---|----------|----------|
| 5.1 | Where is your application hosted? | Supabase (managed platform on AWS) |
| 5.2 | Do you use a CDN/WAF? | Yes — Cloudflare (provided by Supabase) |
| 5.3 | Are environments separated (dev/staging/prod)? | Yes — separate Supabase projects for development and production |
| 5.4 | How are secrets managed? | Supabase Secrets Manager for Edge Functions; never in client code or version control |
| 5.5 | Do you perform regular backups? | Yes — automated daily backups with 30-day point-in-time recovery |
| 5.6 | Have you tested backup restoration? | Planned for quarterly testing |
| 5.7 | Do you have uptime monitoring? | Yes — Supabase platform monitoring + Edge Function error logging |
| 5.8 | What is your target SLA? | 99.9% uptime (aligned with Supabase platform SLA) |

---

## Section 6: Vulnerability Management

| # | Question | Response |
|---|----------|----------|
| 6.1 | Do you perform regular vulnerability scans? | Yes — `npm audit` on every build; GitHub Dependabot alerts |
| 6.2 | Do you have a patch management process? | Yes — critical patches applied within 48 hours; routine updates weekly |
| 6.3 | Have you had a penetration test? | Not yet — planned before general availability launch |
| 6.4 | Do you have a responsible disclosure policy? | Yes — security@fluenci.app |
| 6.5 | Do you perform code reviews? | Yes — all changes reviewed before deployment |

---

## Section 7: Compliance & Certifications

| # | Question | Response |
|---|----------|----------|
| 7.1 | Are you FERPA compliant? | Aligned — operates as "school official" under the school official exception (see FERPA alignment doc) |
| 7.2 | Do you have SOC 2 certification? | Not yet (Supabase infrastructure holds SOC 2 Type II); planned for Fluenci when revenue supports it |
| 7.3 | Are you GDPR compliant? | Yes — data minimization, purpose limitation, deletion endpoints, DPAs with subprocessors |
| 7.4 | Do you comply with COPPA? | Yes — age-gating, content safety pipeline for minors, no direct marketing to children |
| 7.5 | Are you WCAG 2.1 AA compliant? | Conformance goal; partial compliance (see accessibility statement and VPAT) |
| 7.6 | Do you support SCIM provisioning? | Not currently; planned for enterprise tier |
| 7.7 | Do you support LTI integration? | Not currently; planned for future release |
| 7.8 | Will you sign a Data Processing Agreement (DPA)? | Yes |
| 7.9 | Will you sign a Business Associate Agreement (BAA)? | Not applicable (not a HIPAA-covered service) |

---

## Section 8: Business Continuity

| # | Question | Response |
|---|----------|----------|
| 8.1 | Do you have a disaster recovery plan? | Partial — relies on Supabase automated backups and PITR; formal DR plan in development |
| 8.2 | What is your Recovery Time Objective (RTO)? | < 4 hours |
| 8.3 | What is your Recovery Point Objective (RPO)? | < 1 minute (PITR) for database; < 24 hours for other data |
| 8.4 | Do you have geographic redundancy? | Single region (us-east-1); Supabase provides availability zone redundancy within region |
| 8.5 | What happens to data if you go out of business? | 90-day notice to institutions with full data export opportunity; data deleted after export |

---

## Section 9: Additional Notes

- Fluenci is a pre-launch product actively seeking pilot partners in higher education
- Security and compliance posture is being formalized ahead of launch
- We are open to institution-specific security questionnaires and accommodate custom DPA requirements
- Architecture is intentionally simple (managed platform + serverless functions) to minimize attack surface
- As a two-person team, response times may vary but we prioritize security communications above all else

---

## Contact

| Purpose | Email |
|---------|-------|
| Security inquiries | security@fluenci.app |
| Privacy & data requests | privacy@fluenci.app |
| Partnership & pilot | partnerships@fluenci.app |
| General support | support@fluenci.app |
