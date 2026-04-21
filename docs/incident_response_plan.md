# Incident Response Plan

**Product:** Fluenci — AI-Powered Language Learning Platform
**Last Updated:** 2026-04-20
**Plan Owner:** Tyler Moore (Founder)
**Contact:** security@fluenci.app

---

## 1. Purpose

This plan defines Fluenci's process for detecting, containing, and recovering from security incidents, with a focus on protecting student education records and personally identifiable information (PII).

---

## 2. Severity Classification

| Level | Definition | Examples | Response Time |
|-------|-----------|----------|---------------|
| **P1 — Critical** | Confirmed data breach, service completely down, active exploitation | Unauthorized access to student PII, database compromise, credential leak | Immediate (< 1 hour) |
| **P2 — Major** | Partial service degradation, potential data exposure, vulnerability actively exploited | Edge Function errors exposing data, auth bypass discovered, API key leaked | < 4 hours |
| **P3 — Minor** | Limited impact, no data exposure confirmed | Elevated error rates, failed login spikes, dependency vulnerability disclosed | < 24 hours |
| **P4 — Informational** | No immediate impact, proactive finding | Dependency audit finding, security researcher report, configuration improvement | < 72 hours |

---

## 3. Incident Response Phases

### Phase 1: Detection & Identification

**Detection Sources:**
- Supabase platform alerts (downtime, error spikes)
- User/teacher/admin reports via support channels
- Automated monitoring (Edge Function error logs)
- Security researcher disclosure
- Dependency vulnerability advisories (npm audit, GitHub Dependabot)

**Identification Steps:**
1. Confirm the incident is real (not a false positive)
2. Classify severity (P1-P4)
3. Identify affected systems, data, and users
4. Document initial findings in incident log

---

### Phase 2: Containment

**Immediate Actions (P1/P2):**

| Action | How |
|--------|-----|
| Revoke compromised credentials | Rotate API keys in Supabase Secrets Manager |
| Disable compromised accounts | Supabase Auth admin → ban user |
| Block malicious IPs | Supabase/Cloudflare WAF rules |
| Take affected function offline | Undeploy Edge Function if actively exploited |
| Preserve evidence | Export relevant logs before any remediation |

**Communication:**
- Internal: Notify all team members immediately (P1/P2)
- External: Prepare notification draft (do NOT send until confirmed)

---

### Phase 3: Eradication & Recovery

1. **Root cause analysis:** Identify how the incident occurred
2. **Fix the vulnerability:** Patch code, rotate secrets, update configurations
3. **Verify fix:** Confirm the attack vector is closed
4. **Restore service:** Redeploy fixed functions, re-enable accounts
5. **Monitor:** Elevated monitoring for 72 hours post-fix

---

### Phase 4: Notification

#### FERPA Breach Notification Requirements

If student education records are confirmed compromised:

| Stakeholder | Method | Timeline |
|-------------|--------|----------|
| Affected institution IT contact | Email + phone call | Within 72 hours of confirmation |
| Affected students (via institution) | Institution communicates per their policy | Per institution's timeline |
| Regulatory bodies (if applicable) | Written notification | Per jurisdiction requirements |

#### Notification Content Template

```
Subject: Security Incident Notification — Fluenci

Dear [Institution IT Contact],

We are writing to inform you of a confirmed security incident affecting your
organization's data on the Fluenci platform.

**Date of Discovery:** [DATE]
**Date of Incident:** [DATE or RANGE]
**Nature of Incident:** [BRIEF DESCRIPTION]
**Data Potentially Affected:** [TYPES — e.g., email addresses, display names, chat history]
**Number of Records Affected:** [COUNT or RANGE]
**Immediate Actions Taken:** [CONTAINMENT STEPS]
**Recommended Actions for Your Organization:** [IF ANY]

We are continuing our investigation and will provide a full incident report
within 14 days.

If you have questions, please contact us at security@fluenci.app.

Sincerely,
Tyler Moore
Founder, Fluenci
```

---

### Phase 5: Post-Incident Review

**Timeline:** Within 7 days of incident resolution

**Post-Mortem Document Includes:**
1. Timeline of events (detection → resolution)
2. Root cause analysis
3. Impact assessment (users affected, data exposed, duration)
4. What went well
5. What could be improved
6. Action items with owners and deadlines

**Follow-Up Report to Institution:** Full incident report within 14 days of notification.

---

## 4. Roles & Responsibilities

| Role | Person | Responsibilities |
|------|--------|-----------------|
| Incident Commander | Tyler Moore | Coordinate response, make go/no-go decisions, approve notifications |
| Technical Lead | Tyler Moore | Investigate, contain, fix, verify |
| Communications | Tyler Moore / Owen Ash | Draft notifications, communicate with institutions |
| Evidence Preservation | Tyler Moore | Export logs, document timeline |

*Note: As the team grows, these roles will be distributed across additional personnel.*

---

## 5. Preventive Measures

| Measure | Frequency |
|---------|-----------|
| Dependency audit (`npm audit`) | Every build |
| Review Supabase access logs | Weekly |
| Rotate API keys | Quarterly (or immediately if compromised) |
| Review Edge Function error logs | Daily |
| Test backup restoration | Quarterly |
| Update this IRP | Annually or after any P1/P2 incident |

---

## 6. Contact Information

| Purpose | Contact |
|---------|---------|
| Security incidents | security@fluenci.app |
| General support | support@fluenci.app |
| Founder (emergency) | Tyler Moore — direct contact on file with institution |

---

## 7. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-20 | Tyler Moore | Initial version |
