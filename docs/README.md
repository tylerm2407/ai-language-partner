# Fluenci — Compliance & Partnership Documentation

**For:** IT Security Teams, Procurement, and Academic Partners
**Product:** Fluenci — AI-Powered Language Learning Platform
**Vendor:** NovaWealth
**Contact:** security@fluenci.app | partnerships@fluenci.app

---

## Documentation Index

### Security & Privacy

| Document | Purpose | Audience |
|----------|---------|----------|
| [Security Overview](security_overview_for_it.md) | Infrastructure, encryption, access controls, vulnerability management | IT Security |
| [Privacy & FERPA Alignment](privacy_and_ferpa_alignment.md) | Data inventory, FERPA compliance, subprocessors, deletion rights | Legal / Privacy Officers |
| [Incident Response Plan](incident_response_plan.md) | Detection, containment, notification procedures (72hr SLA) | IT Security / CISO |

### Compliance Questionnaires

| Document | Purpose | Audience |
|----------|---------|----------|
| [HECVAT Lite](hecvat_lite.md) | Higher Education Community Vendor Assessment (pre-filled) | IT Procurement |

### Accessibility

| Document | Purpose | Audience |
|----------|---------|----------|
| [Accessibility & VPAT](accessibility_and_vpat.md) | WCAG 2.1 AA conformance, current state, VPAT table | Accessibility / Disability Services |

### Technical Architecture

| Document | Purpose | Audience |
|----------|---------|----------|
| [Architecture Diagrams](architecture_diagrams.md) | System architecture, data flow, PII paths, database schema | IT Security / Engineering |

### Partnership & Deployment

| Document | Purpose | Audience |
|----------|---------|----------|
| [Pilot Implementation Plan](pilot_implementation_plan.md) | 3-phase deployment plan, success metrics, support SLA, rollback | Academic Partners / IT |

---

## Quick Answers for Common Questions

| Question | Answer |
|----------|--------|
| Where is data hosted? | AWS us-east-1 (via Supabase) |
| Is data encrypted? | Yes — AES-256 at rest, TLS 1.2+ in transit |
| FERPA compliant? | Yes — school official exception (see Privacy doc) |
| Can we export our data? | Yes — full JSON export via admin API |
| Can we delete our data? | Yes — full purge within 30 days on request |
| Breach notification timeline? | 72 hours |
| SSO support? | Email-domain restriction today; SAML 2.0 available on request |
| Will you sign our DPA? | Yes |

---

## Request Additional Information

For security questionnaires, DPA review, or demo scheduling:

- **Security:** security@fluenci.app
- **Privacy:** privacy@fluenci.app
- **Partnerships:** partnerships@fluenci.app
- **Accessibility:** accessibility@fluenci.app
