# Privacy & FERPA Alignment Statement

**Product:** Fluenci — AI-Powered Language Learning Platform
**Last Updated:** 2026-04-20
**Contact:** privacy@fluenci.app

---

## 1. Overview

Fluenci is designed to operate as a "school official" under FERPA's school official exception (34 CFR § 99.31(a)(1)(i)(B)). When deployed by an educational institution, Fluenci:

- Performs a service that the institution would otherwise use employees to provide
- Is under the direct control of the institution with respect to use and maintenance of education records
- Uses education records only for the purposes for which disclosure was made

---

## 2. Data Inventory

| Data Field | Category | Purpose | Retention |
|------------|----------|---------|-----------|
| Email address | PII | Authentication, account recovery | Duration of contract + 30 days |
| Display name | PII | In-app identification, teacher visibility | Duration of contract + 30 days |
| Organization membership | Educational record | Role-based access, classroom assignment | Duration of contract + 30 days |
| Learning progress (CEFR level, XP, streaks) | Educational record | Adaptive lesson delivery, teacher reporting | Duration of contract + 30 days |
| Chat messages (text conversations) | Educational record | AI tutoring, assignment grading, teacher review | Duration of contract + 30 days |
| Voice recordings (speaking exercises) | Educational record / Biometric | Pronunciation scoring, speaking assessment | 90 days after creation, then deleted |
| Assignment submissions | Educational record | Grading, progress tracking | Duration of contract + 30 days |
| Spaced repetition data | Educational record | Personalized review scheduling | Duration of contract + 30 days |
| Usage analytics (screens visited, session duration) | Operational | Product improvement, engagement metrics | Aggregated after 90 days (no PII retained) |
| Payment information | Financial | Subscription billing (institutional or individual) | Managed by Stripe; Fluenci stores only Stripe customer ID |

---

## 3. Purpose Limitation

Student data is used **exclusively** for:
1. Delivering personalized language instruction
2. Generating progress reports for the student and their institution
3. Enabling teacher oversight (grading, feedback, curriculum adjustment)
4. Improving the educational service (in aggregate, de-identified form only)

Student data is **never** used for:
- Advertising or marketing to students
- Sale or rental to third parties
- Building profiles for non-educational purposes
- Training AI models (Anthropic, Google, and OpenAI APIs are called with data-processing agreements that prohibit training on input data)

---

## 4. Subprocessor Inventory

| Subprocessor | Data Received | Purpose | DPA in Place | Student PII? |
|--------------|---------------|---------|-------------|-------------|
| **Supabase** (AWS) | All data at rest | Database, auth, file storage, edge compute | Yes | Yes |
| **Anthropic** (Claude API) | Chat messages, assignment text | AI tutoring, automated grading | Yes (API ToS) | Yes |
| **Google** (Gemini API) | Voice audio, conversation context | Real-time voice practice | Yes (API ToS) | Yes |
| **OpenAI** (Whisper API) | Voice audio | Speech-to-text transcription | Yes (API ToS) | Yes |
| **ElevenLabs** | Target language text only | Text-to-speech generation | Yes | No (no student identifiers sent) |
| **Stripe** | Email, subscription tier | Payment processing | Yes (Stripe DPA) | Minimal (email + plan only) |

All subprocessors with access to student PII have contractual commitments not to use data for model training or other purposes beyond service delivery.

---

## 5. Access Controls

- Students can only access their own data
- Teachers can only access data for students enrolled in their classrooms
- School administrators can only access data within their organization
- Fluenci engineering staff access production data only for support/debugging with audit logging
- No Fluenci employee can access student data without a logged reason

---

## 6. Data Deletion & Portability

### On-Demand Export
School administrators can export all organization data (members, classrooms, assignments, submissions, progress data) via the `export-org-data` API endpoint at any time.

### Contract-End Deletion
Upon contract termination or institutional request:
1. All PII is anonymized or deleted within 30 days
2. Deletion is executed via the `purge-org-data` API endpoint
3. Confirmation of deletion is provided to the institution
4. Anonymized aggregate data may be retained for service improvement

### Individual Student Deletion
Individual student records can be deleted upon request from the institution's authorized representative.

---

## 7. Parental Consent & Minors

- For students under 18, the institution acts as the consenting party under FERPA
- Content safety pipeline validates all AI-generated content before display to minors
- No direct marketing to students under 18
- Voice recordings for minors follow the same 90-day retention policy

---

## 8. Breach Notification

In the event of a confirmed data breach affecting student education records:
- **Notification timeline:** Within 72 hours of confirmation
- **Notification method:** Direct email to institutional IT contact + phone call for P1 severity
- **Content:** Nature of breach, data affected, remediation steps, recommended actions
- **Follow-up:** Full incident report within 14 days

---

## 9. Institutional Controls

Institutions retain the following controls:
- Add/remove students and teachers
- Export all organizational data at any time
- Request full data deletion
- Configure classroom settings and assignment parameters
- Access audit logs for all administrative actions within their organization
- Deactivate their organization (freezes all access)

---

## 10. Contact

**Privacy inquiries:** privacy@fluenci.app
**Data deletion requests:** privacy@fluenci.app
**DPA requests:** legal@fluenci.app
**Response SLA:** 48 hours for institutional requests
