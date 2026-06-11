# Data Processing Agreement

**Product:** Fluenci — AI-Powered Language Learning Platform
**Company:** NovaWealth dba Fluenci
**Last Updated:** 2026-04-23
**Contact:** legal@fluenci.app

> This agreement is a template and should be reviewed by legal counsel. NovaWealth is open to institution-specific modifications.

---

## 1. Parties

This Data Processing Agreement ("DPA") is entered into as of **[EFFECTIVE DATE]** by and between:

**Data Controller:**
[INSTITUTION NAME] ("Institution"), with its principal office at [INSTITUTION ADDRESS], represented by [INSTITUTION CONTACT NAME], [INSTITUTION CONTACT TITLE].

**Data Processor:**
NovaWealth dba Fluenci ("Processor"), with its principal office at [NOVAWEALTH ADDRESS], represented by Tyler Moore, Founder.

Together referred to as the "Parties."

---

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Education Records** | Records directly related to a student that are maintained by the Institution or by a party acting on behalf of the Institution, as defined under FERPA (20 U.S.C. § 1232g; 34 CFR Part 99). |
| **Personal Data** | Any information relating to an identified or identifiable natural person, including but not limited to name, email address, student ID, and online identifiers. |
| **Student Data** | Personal Data and Education Records belonging to students enrolled at the Institution, processed by the Processor in the course of providing the Service. |
| **Processing** | Any operation performed on Student Data, including collection, recording, organization, structuring, storage, adaptation, retrieval, consultation, use, disclosure by transmission, alignment, combination, restriction, erasure, or destruction. |
| **Subprocessor** | Any third party engaged by the Processor to process Student Data on behalf of the Institution. |
| **Data Breach** | A breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to Student Data. |
| **Service** | The Fluenci AI-powered language learning platform, including all features for personalized instruction, adaptive practice, conversational tutoring, progress reporting, and classroom management. |
| **FERPA** | The Family Educational Rights and Privacy Act (20 U.S.C. § 1232g; 34 CFR Part 99). |

---

## 3. Scope & Purpose

### 3.1 Scope of Processing

This DPA governs the Processor's processing of Student Data in connection with the Institution's use of the Fluenci platform under the parties' service agreement dated [SERVICE AGREEMENT DATE] (the "Service Agreement").

### 3.2 Purpose of Processing

Student Data is processed exclusively for the following educational purposes:

1. Delivering personalized language instruction adapted to each student's proficiency level
2. Generating progress reports for students, teachers, and institutional administrators
3. Enabling teacher oversight, including grading, feedback, and curriculum adjustment
4. Facilitating AI-powered tutoring, speaking practice, and automated grading
5. Administering accounts, authentication, and role-based access
6. Processing subscription payments (institutional or individual)

### 3.3 Legal Basis

Processing is conducted under the FERPA school official exception (34 CFR § 99.31(a)(1)(i)(B)). The Processor qualifies as a "school official" because it:

- Performs a service that the Institution would otherwise use employees to provide
- Is under the direct control of the Institution with respect to use and maintenance of education records
- Uses education records only for the purposes for which disclosure was authorized

Student Data is never used for advertising, marketing, profiling for non-educational purposes, or sale or rental to third parties.

---

## 4. Processor Obligations

The Processor shall:

1. **Process only on documented instructions.** Process Student Data solely in accordance with this DPA and the Institution's documented instructions. If the Processor believes an instruction infringes applicable law, the Processor will notify the Institution before processing.

2. **Ensure confidentiality.** Ensure that all personnel authorized to process Student Data have committed to confidentiality obligations or are under an appropriate statutory obligation of confidentiality.

3. **Implement security measures.** Maintain the technical and organizational security measures described in Section 7.

4. **Assist with data subject rights.** Assist the Institution in fulfilling its obligations to respond to requests from data subjects (students, parents, or guardians) exercising their rights under FERPA and applicable law.

5. **Assist with compliance obligations.** Provide reasonable assistance to the Institution in ensuring compliance with security, breach notification, and data protection impact assessment obligations.

6. **Delete or return data.** Upon termination of the Service Agreement, delete or return all Student Data to the Institution in accordance with Section 9.

7. **Make available information for audits.** Provide documentation and information necessary to demonstrate compliance with this DPA, as described in Section 10.

8. **Notify of government requests.** Notify the Institution promptly if the Processor receives a request from a government authority for access to Student Data, unless legally prohibited from doing so.

---

## 5. Data Inventory

The following table identifies all categories of Student Data processed by Fluenci:

| Data Field | Category | Purpose | Retention Period |
|------------|----------|---------|-----------------|
| Email address | PII | Authentication, account recovery | Duration of contract + 30 days |
| Display name | PII | In-app identification, teacher visibility | Duration of contract + 30 days |
| Organization membership | Education Record | Role-based access, classroom assignment | Duration of contract + 30 days |
| Learning progress (CEFR level, XP, streaks) | Education Record | Adaptive lesson delivery, teacher reporting | Duration of contract + 30 days |
| Chat messages (text conversations) | Education Record | AI tutoring, assignment grading, teacher review | Duration of contract + 30 days |
| Voice recordings (speaking exercises) | Education Record / Biometric | Pronunciation scoring, speaking assessment | 90 days after creation, then deleted |
| Assignment submissions | Education Record | Grading, progress tracking | Duration of contract + 30 days |
| Spaced repetition data | Education Record | Personalized review scheduling | Duration of contract + 30 days |
| Usage analytics (screens visited, session duration) | Operational | Product improvement, engagement metrics | Aggregated after 90 days (no PII retained) |
| Payment information | Financial | Subscription billing | Managed by Stripe; Fluenci stores only Stripe customer ID |

---

## 6. Subprocessors

### 6.1 Authorized Subprocessors

The Institution hereby grants general authorization for the Processor to engage the following subprocessors:

| # | Subprocessor | Data Received | Purpose | Retention by Provider | DPA in Place |
|---|-------------|---------------|---------|----------------------|--------------|
| 1 | **Supabase** (AWS us-east-1) | All application data | Database, authentication, compute, file storage | Per contract | Yes |
| 2 | **Anthropic** (Claude API) | Chat messages, assignment text, grading prompts | AI tutoring, automated grading | Not retained (API ToS) | Yes |
| 3 | **Google** (Gemini API) | Voice audio, conversation context | Real-time voice conversation practice | Not retained (API ToS) | Yes |
| 4 | **OpenAI** (Whisper API) | Voice audio recordings | Speech-to-text transcription | Not retained (API ToS) | Yes |
| 5 | **ElevenLabs** | Target language text only (no student identifiers) | Text-to-speech audio generation | Not retained | Yes |
| 6 | **Stripe** | Email, user ID, subscription tier | Payment processing | Per Stripe DPA | Yes |
| 7 | **RevenueCat** | Anonymous user ID, purchase events | In-app purchase management | Per RevenueCat DPA | Yes |

All subprocessors with access to Student Data have contractual commitments prohibiting the use of such data for model training or purposes beyond service delivery.

### 6.2 Changes to Subprocessors

The Processor shall notify the Institution at least **30 days** in advance before engaging any new subprocessor or replacing an existing subprocessor. Notification will be sent to [INSTITUTION CONTACT EMAIL].

The Institution may object to a new subprocessor within 15 days of notification. If the Institution raises a reasonable objection, the Parties will work in good faith to resolve the concern. If no resolution is reached, the Institution may terminate the affected portion of the Service Agreement without penalty.

---

## 7. Security Measures

The Processor maintains the following technical and organizational security measures:

### 7.1 Encryption

- **At rest:** AES-256 encryption for all data stored in PostgreSQL (Supabase)
- **In transit:** TLS 1.2+ for all data transmitted between client, server, and subprocessors

### 7.2 Access Controls

- **Row-Level Security (RLS):** Enforced at the database level; students access only their own data, teachers access only their classroom's data, administrators access only their organization's data
- **Role-Based Access Control (RBAC):** Distinct roles (student, teacher, school admin) with principle of least privilege
- **Authentication:** JWT-based authentication via Supabase Auth with 1-hour token expiry and refresh token rotation

### 7.3 Audit Logging

- All administrative actions (user management, data access, configuration changes) are recorded in an append-only audit log with actor ID, action, resource, organization, and timestamp
- Fluenci engineering staff may access production data only for support or debugging purposes, with a logged justification for each access

### 7.4 Infrastructure

- All data hosted on AWS (us-east-1) via Supabase
- Edge Functions (Deno runtime) for all AI service calls, ensuring Student Data passes through controlled intermediaries
- API keys stored in Supabase Secrets Manager; rotated quarterly or immediately upon suspected compromise

### 7.5 Personnel

- All personnel with access to Student Data are bound by confidentiality obligations
- Access to production systems is limited to essential personnel

---

## 8. Data Breach Notification

### 8.1 Notification Timeline

Upon becoming aware of a confirmed Data Breach affecting Student Data, the Processor shall:

1. **Within 72 hours** of confirmation, notify the Institution's designated IT contact via email and, for P1 (Critical) severity incidents, by phone call
2. **Within 14 days** of the initial notification, provide a full incident report

### 8.2 Notification Content

The breach notification shall include:

- Date of discovery
- Date or date range of the incident
- Nature and description of the incident
- Categories and approximate number of Student Data records affected
- Likely consequences of the breach
- Immediate containment actions taken
- Recommended actions for the Institution
- Contact information for follow-up inquiries (security@fluenci.app)

### 8.3 Breach Notification Template

```
Subject: Security Incident Notification — Fluenci

Dear [Institution IT Contact],

We are writing to inform you of a confirmed security incident affecting your
organization's data on the Fluenci platform.

Date of Discovery: [DATE]
Date of Incident: [DATE or RANGE]
Nature of Incident: [BRIEF DESCRIPTION]
Data Potentially Affected: [TYPES — e.g., email addresses, display names, chat history]
Number of Records Affected: [COUNT or RANGE]
Immediate Actions Taken: [CONTAINMENT STEPS]
Recommended Actions for Your Organization: [IF ANY]

We are continuing our investigation and will provide a full incident report
within 14 days.

If you have questions, please contact us at security@fluenci.app.

Sincerely,
Tyler Moore
Founder, Fluenci
```

### 8.4 Cooperation

The Processor shall cooperate with the Institution's investigation and provide reasonable assistance in the Institution's efforts to comply with its own notification obligations under FERPA and applicable state breach notification laws.

---

## 9. Data Retention & Deletion

### 9.1 Retention Schedule

Data retention follows the per-field periods defined in Section 5. In summary:

| Data Category | Retention Period |
|---------------|-----------------|
| PII (email, display name) | Duration of contract + 30 days |
| Education Records (progress, chat, assignments, spaced repetition, org membership) | Duration of contract + 30 days |
| Voice recordings | 90 days after creation |
| Usage analytics | Aggregated (de-identified) after 90 days |
| Payment data | Managed by Stripe; Fluenci retains only Stripe customer ID for duration of contract + 30 days |

### 9.2 Post-Termination Deletion

Upon termination or expiration of the Service Agreement:

1. The Processor will notify the Institution and provide a **30-day window** to export all organizational data
2. Data export is available via the `export-org-data` API endpoint in JSON format
3. After the 30-day export window, the Processor will permanently delete or anonymize all Student Data via the `purge-org-data` process
4. Written confirmation of deletion will be provided to the Institution upon completion
5. Anonymized, aggregated data with no PII may be retained for service improvement purposes

### 9.3 Individual Deletion

Individual student records can be deleted at any time upon written request from the Institution's authorized representative. Deletion requests are processed within **5 business days**.

---

## 10. Audit Rights

### 10.1 Documentation Review

The Institution may, no more than once per calendar year, request documentation of the Processor's security controls, data processing activities, and compliance with this DPA. The Processor shall provide such documentation within **15 business days** of a written request.

### 10.2 Audit Requests

The Institution may, with at least 30 days' written notice, conduct or commission an audit of the Processor's data processing activities relevant to this DPA. Audits shall:

- Be conducted during normal business hours
- Not unreasonably interfere with the Processor's operations
- Be subject to reasonable confidentiality obligations
- Be at the Institution's expense unless the audit reveals material non-compliance, in which case the Processor bears the cost

### 10.3 Audit Logs

The Institution's administrators have real-time access to audit logs for all administrative actions within their organization via the Fluenci platform.

---

## 11. Data Return & Portability

### 11.1 Export Format

All organizational data (members, classrooms, assignments, submissions, progress data, chat history) is exportable in **JSON format** via the `export-org-data` API endpoint.

### 11.2 Export Timeline

Data export requests are fulfilled within **5 business days** of request. School administrators may also initiate exports directly through the platform at any time.

### 11.3 Export Contents

Exported data includes:
- Student profiles and enrollment records
- Classroom configurations and assignments
- Assignment submissions and grades
- Chat session transcripts
- Learning progress data (CEFR levels, XP, streaks, spaced repetition state)
- Administrative audit logs for the organization

---

## 12. FERPA Compliance

### 12.1 School Official Designation

Pursuant to 34 CFR § 99.31(a)(1)(i)(B), the Processor is designated as a "school official" with a "legitimate educational interest" in the Student Data necessary to provide the Service. The Processor:

- Performs an institutional service or function for which the Institution would otherwise use its own employees
- Is under the direct control of the Institution with respect to the use and maintenance of education records
- Uses education records only for the purposes for which the disclosure was authorized
- Meets the criteria set forth in the Institution's annual FERPA notification regarding school officials

### 12.2 Use Limitations

The Processor shall:

- Use Student Data solely for the educational purposes described in Section 3.2
- Not disclose Student Data to any third party except as authorized in this DPA (subprocessors listed in Section 6) or as required by law
- Not use Student Data for advertising, marketing, or building non-educational user profiles
- Not sell or rent Student Data under any circumstances

### 12.3 Re-Disclosure Prohibition

The Processor shall not re-disclose Student Data received from the Institution to any third party not identified in this DPA without prior written consent from the Institution, except as required by law.

---

## 13. AI & Machine Learning

### 13.1 Prohibition on Model Training

The Processor **shall not** use Student Data to train, fine-tune, or improve any artificial intelligence or machine learning model, whether proprietary or third-party.

### 13.2 Subprocessor AI Commitments

All AI subprocessors (Anthropic, Google, OpenAI) are engaged under data processing agreements or API terms of service that explicitly prohibit the use of input data for model training. Specifically:

- **Anthropic (Claude API):** Input data is not retained or used for training per API Terms of Service
- **Google (Gemini API):** Input data is not retained or used for training per API Terms of Service
- **OpenAI (Whisper API):** Input data is not retained or used for training per API Terms of Service
- **ElevenLabs:** Receives only target-language text with no student identifiers; data is not retained

### 13.3 AI Processing Safeguards

- All AI-generated content is validated through a content safety pipeline before being displayed to students
- For students under 18, additional content safety checks are applied per the Processor's content safety policy
- AI providers receive only the minimum data necessary for the specific function (e.g., chat text for tutoring, audio for transcription)
- No student identifiers (name, email) are transmitted to AI providers; only content necessary for the educational function

---

## 14. Term & Termination

### 14.1 Term

This DPA is effective as of the Effective Date and shall remain in force for the duration of the Service Agreement between the Parties (the "Term").

### 14.2 Co-Termination

This DPA terminates automatically upon the expiration or termination of the Service Agreement, except that obligations relating to data deletion (Section 9), confidentiality, and audit rights survive termination until all Student Data has been deleted and deletion has been confirmed in writing.

### 14.3 Effect of Termination

Upon termination, the Processor shall:

1. Cease all processing of Student Data except as necessary for deletion
2. Provide the export window described in Section 9.2
3. Complete deletion of all Student Data within 30 days
4. Provide written confirmation of deletion to the Institution

---

## 15. General Provisions

### 15.1 Governing Law

This DPA shall be governed by the laws of the State of [GOVERNING STATE], without regard to conflict of law principles, and in compliance with FERPA (20 U.S.C. § 1232g).

### 15.2 Amendments

This DPA may be amended only by a written instrument signed by both Parties.

### 15.3 Conflicts

In the event of a conflict between this DPA and the Service Agreement, the terms of this DPA shall prevail with respect to the processing and protection of Student Data.

### 15.4 Notices

All notices under this DPA shall be sent to:

**Institution:**
[INSTITUTION CONTACT NAME]
[INSTITUTION CONTACT TITLE]
[INSTITUTION ADDRESS]
[INSTITUTION CONTACT EMAIL]
[INSTITUTION CONTACT PHONE]

**Processor:**
Tyler Moore, Founder
NovaWealth dba Fluenci
legal@fluenci.app

---

## 16. Signatures

By signing below, the Parties agree to the terms and conditions of this Data Processing Agreement.

**[INSTITUTION NAME]**

| | |
|---|---|
| Signature: | ______________________________ |
| Name: | [INSTITUTION CONTACT NAME] |
| Title: | [INSTITUTION CONTACT TITLE] |
| Date: | [DATE] |

**NovaWealth dba Fluenci**

| | |
|---|---|
| Signature: | ______________________________ |
| Name: | Tyler Moore |
| Title: | Founder |
| Date: | [DATE] |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-23 | Tyler Moore | Initial template |
