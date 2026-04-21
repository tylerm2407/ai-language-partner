# Security Overview for IT Teams

**Product:** Fluenci — AI-Powered Language Learning Platform
**Last Updated:** 2026-04-20
**Contact:** security@fluenci.app

---

## 1. Infrastructure & Hosting

| Component | Provider | Location |
|-----------|----------|----------|
| Database | Supabase (managed PostgreSQL) | AWS us-east-1 |
| Authentication | Supabase Auth (JWT-based) | AWS us-east-1 |
| Edge Functions (API) | Supabase Edge Functions (Deno) | AWS us-east-1 |
| File Storage | Supabase Storage (S3-backed) | AWS us-east-1 |
| Mobile Client | React Native (Expo) | On-device |

---

## 2. Encryption

### At Rest
- **Database:** AES-256 encryption via Supabase KMS (AWS RDS encryption)
- **File Storage:** AES-256 server-side encryption (S3 SSE)
- **Backups:** Encrypted at rest using the same KMS keys

### In Transit
- **TLS 1.2+** enforced on all connections (API, database, storage)
- **HSTS** headers enabled on all endpoints
- **Certificate pinning** not currently enforced on mobile (Expo limitation)

---

## 3. Authentication & Access Control

### Authentication Flow
1. User authenticates via Supabase Auth (email/password or magic link)
2. JWT issued with user ID, role, and expiration
3. Every Edge Function request validates JWT before processing
4. Tokens expire after 1 hour; refresh tokens rotate automatically

### Authorization Model
- **Row Level Security (RLS):** Enabled on ALL database tables. Users can only access their own data unless explicitly granted via role.
- **Role-Based Access Control:** Three roles — `learner`, `teacher`, `school_admin`
- **Organization Scoping:** Teachers and admins can only access data within their assigned organization
- **Per-Resource Permission Checks:** Edge Functions verify classroom membership, teacher assignment, and org admin status before every mutation

### Role Hierarchy
| Role | Permissions |
|------|-------------|
| Learner | Own profile, own progress, own chat history, enrolled classrooms |
| Teacher | Above + classroom management, assignment CRUD, grading, student progress within own classrooms |
| School Admin | Above + organization management, teacher provisioning, audit log access, data export/deletion |

---

## 4. Secrets Management

- All API keys and secrets stored in **Supabase Secrets Manager** (Edge Function environment variables)
- No secrets in client-side code or version control
- Service role key used only server-side in Edge Functions
- Client-side uses only the public anon key (limited by RLS)

---

## 5. Data Backup & Recovery

| Feature | Detail |
|---------|--------|
| Automated Backups | Daily, managed by Supabase |
| Point-in-Time Recovery | 30-day window |
| Recovery Time Objective (RTO) | < 4 hours |
| Recovery Point Objective (RPO) | < 24 hours (daily backups), < 1 minute (PITR) |

---

## 6. Network Security

- All Supabase endpoints behind Cloudflare CDN/WAF
- Database not directly accessible from public internet (connection pooling via Supavisor)
- Edge Functions isolated per-invocation (Deno isolate sandbox)
- No VPN or direct server SSH access required for operation

---

## 7. Vulnerability Management

- **Dependency scanning:** `npm audit` run on every build
- **Platform patching:** Supabase manages PostgreSQL and infrastructure patching
- **Code review:** All changes reviewed before deployment
- **No known critical vulnerabilities** in production dependencies at time of writing

---

## 8. Incident Response

- Formal Incident Response Plan documented separately (see `docs/incident_response_plan.md`)
- **Notification timeline:** 72 hours for confirmed data breaches affecting student PII
- **Communication channel:** Direct email to institutional IT contact on file
- **Post-incident:** Root cause analysis and remediation shared with affected institutions

---

## 9. Compliance Posture

| Standard | Status |
|----------|--------|
| FERPA | Aligned (see `docs/privacy_and_ferpa_alignment.md`) |
| WCAG 2.1 AA | Conformance goal, partial compliance (see `docs/accessibility_and_vpat.md`) |
| SOC 2 | Planned (Supabase holds SOC 2 Type II for infrastructure) |
| GDPR | Data minimization + deletion endpoints implemented |
| COPPA | Age-gating in place; content safety pipeline for minors |

---

## 10. Audit Logging

All administrative and security-relevant actions are logged to an immutable audit table:
- Actor (user ID + role)
- Timestamp
- Action type (create, read, update, delete, grant, revoke)
- Resource type and ID
- IP address
- Metadata (JSONB)

Audit logs are queryable by org admins for their organization and retained indefinitely.

---

## 11. Questions & Contact

For security questionnaires, penetration test coordination, or additional documentation:

**Email:** security@fluenci.app
**Response SLA:** 48 hours for institutional inquiries
