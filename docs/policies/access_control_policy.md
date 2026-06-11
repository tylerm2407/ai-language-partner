# Access Control Policy

**Product:** Fluenci — AI-Powered Language Learning Platform
**Company:** NovaWealth
**Effective Date:** 2026-04-23
**Policy Owner:** Tyler Moore
**Review Cycle:** Annual
**Contact:** security@fluenci.app

---

## 1. Purpose

This policy governs how access to the Fluenci platform is granted, managed, reviewed, and revoked. It ensures that only authorized individuals access data and functionality appropriate to their role.

## 2. Scope

This policy applies to all Fluenci accounts across the following user populations:

- Platform users (learners, teachers, school administrators)
- NovaWealth engineering and support staff with access to production systems

## 3. Role Definitions

### Platform Roles

| Role | Permissions |
|------|-------------|
| **Learner** | Own profile, own progress data, own chat history, enrolled classrooms only |
| **Teacher** | All learner permissions + classroom management, assignment CRUD, grading, student progress within own classrooms |
| **School Admin** | All teacher permissions + organization management, teacher provisioning, audit log access, data export and deletion |

### Engineering Roles

| Role | Permissions |
|------|-------------|
| **Engineer** | Read-only production database access for support and debugging; deployment access to Edge Functions and application code |
| **Engineering Lead** | All engineer permissions + Supabase project configuration, secrets management, RLS policy changes |

## 4. Authentication Requirements

| Requirement | Detail |
|-------------|--------|
| **Methods** | Email/password or magic link via Supabase Auth |
| **Token Format** | JWT containing user ID, role, and expiration |
| **Token Expiry** | 1 hour; refresh tokens rotate automatically |
| **JWT Validation** | Every Edge Function request validates the JWT before processing |
| **MFA** | Required for school_admin and teacher roles; recommended for all users |
| **Password Policy** | Minimum complexity enforced at registration (length, character diversity) |

## 5. Authorization Model

- **RBAC (Role-Based Access Control):** Permissions are assigned by role, not by individual user. Roles are defined in Section 3.
- **RLS (Row Level Security):** Enabled on all database tables. Users can only query rows they are authorized to access based on their user ID, role, and organization membership.
- **Organization Scoping:** Teachers and school admins can only access data within their assigned organization. Cross-organization access is not permitted.
- **Per-Resource Checks:** Edge Functions verify classroom membership, teacher assignment, and org admin status before every read and write operation.

## 6. Account Provisioning

| Action | Process |
|--------|---------|
| **Learner enrollment** | Teachers enroll students into classrooms via the teacher dashboard. Students receive an invitation email or magic link. |
| **Teacher provisioning** | School admins create teacher accounts and assign them to the organization. |
| **School admin setup** | NovaWealth provisions the initial school admin during institutional onboarding. |
| **Bulk import** | School admins can import users via CSV upload. Imported records are validated before account creation. |
| **Engineering access** | Granted by the Engineering Lead via Supabase project member management. Requires business justification. |

## 7. Account Deprovisioning

| Scenario | Process |
|----------|---------|
| **Student removal** | Teacher or school admin removes the learner from a classroom. Learner loses access to classroom data. If removed from all classrooms, the account is deactivated. Progress data is retained per the data retention policy. |
| **Teacher removal** | School admin revokes the teacher's role. Classrooms are reassigned or archived. The teacher's account is downgraded to learner or deactivated. |
| **Organization deactivation** | NovaWealth deactivates the organization account upon contract termination. All associated teacher and learner accounts are suspended. Data is retained for the contractual retention period, then deleted upon request. |
| **Engineering offboarding** | Access is revoked from Supabase project within 24 hours of role change or departure. |

## 8. Access Reviews

- **Frequency:** Quarterly.
- **Scope:** All teacher and school admin accounts, all engineering staff with production access.
- **Process:** The Policy Owner reviews the list of privileged accounts, confirms each has a current business justification, and revokes access where justification no longer exists.
- **Documentation:** Review results and any access changes are recorded in the audit log.

## 9. Logging and Monitoring

All security-relevant actions are recorded in an immutable audit log:

| Field | Description |
|-------|-------------|
| Actor | User ID and role |
| Timestamp | UTC timestamp of the action |
| Action | Create, read, update, delete, grant, revoke |
| Resource | Type and ID of the affected resource |
| IP Address | Source IP of the request |
| Metadata | Additional context (JSONB) |

- Audit logs are accessible to school admins for their organization.
- Logs are retained indefinitely.
- NovaWealth monitors logs for anomalous access patterns (bulk data export, off-hours admin activity, repeated auth failures).

## 10. Production Data Access — Engineering Staff

- Engineers may access production data only for active support tickets or debugging confirmed issues.
- All production data access is audit-logged with the engineer's identity, timestamp, and reason.
- Engineers must not copy production data to local machines or non-production environments without anonymization.
- Direct database write access in production is prohibited; all changes go through Edge Functions or migration scripts with code review.
- Access is reviewed quarterly as part of the access review process (Section 8).
