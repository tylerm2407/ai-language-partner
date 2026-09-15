# Privacy Policy

**Fluenci — AI-Powered Language Learning Platform**
**Operated by NovaWealth**
**Effective Date: September 8, 2026**

---

Fluenci ("we," "us," or "our") is an AI-powered language learning platform operated by NovaWealth. This Privacy Policy describes how we collect, use, share, and protect information when you use the Fluenci application and related services (collectively, the "Service"). It applies to all users, including individual learners, students, teachers, and school administrators.

We are committed to protecting your privacy and complying with applicable laws, including the Family Educational Rights and Privacy Act (FERPA), the Children's Online Privacy Protection Act (COPPA), and applicable state student privacy laws. If you have questions after reading this policy, please contact us at [privacy@fluenciapp.com](mailto:privacy@fluenciapp.com).

---

## Table of Contents

1. [Information We Collect](#1-information-we-collect)
2. [How We Use Your Information](#2-how-we-use-your-information)
3. [How We Do Not Use Your Information](#3-how-we-do-not-use-your-information)
4. [Data Sharing and Subprocessors](#4-data-sharing-and-subprocessors)
5. [Data Retention](#5-data-retention)
6. [Your Rights](#6-your-rights)
7. [Children's Privacy and COPPA](#7-childrens-privacy-and-coppa)
8. [FERPA Compliance](#8-ferpa-compliance)
9. [Security Measures](#9-security-measures)
10. [Breach Notification](#10-breach-notification)
11. [International Users](#11-international-users)
12. [Changes to This Policy](#12-changes-to-this-policy)
13. [Contact Us](#13-contact-us)

---

## 1. Information We Collect

We collect information in the following categories:

### Account Information

- **Email address** — used for authentication and account recovery.
- **Display name** — used for in-app identification and teacher visibility within classrooms.

### Educational Records

When you use Fluenci through a school or educational institution, the following data constitutes education records under FERPA:

- **Organization membership** — your role (student, teacher, administrator) and classroom assignments.
- **Learning progress** — CEFR proficiency level, experience points (XP), streaks, and lesson completion data.
- **Chat messages** — text conversations with the AI tutor, used for tutoring and teacher review.
- **Voice and photo inputs** — microphone audio used for transcription or live tutoring, and photos you explicitly select for avatar generation. Fluenci does not store raw microphone audio after processing; generated avatar images and derived transcripts may be stored with your account.
- **Assignment submissions** — work submitted for grading and progress tracking.
- **Spaced repetition data** — review scheduling data that personalizes your learning experience.

### Operational Data

- **Usage analytics** — named product events, screens visited, session duration, feature engagement, app version, subscription tier, and an internal account identifier. Free-form lesson, chat, and voice content is excluded from analytics events.
- **Crash and error reports** — when the app crashes or encounters an unexpected error, we collect a technical report containing the error message, stack trace, app version, device model, operating system version, and your internal account identifier (a random ID, not your name or email). We use this solely to diagnose and fix defects. Reports never include lesson content, chat messages, or voice audio, and credentials are stripped before the report leaves the device.

### Payment Information

- **Subscription and billing data** — mobile purchases are processed by Apple or Google and managed through RevenueCat; Stripe may process web or institutional checkout. Fluenci stores provider customer/transaction identifiers, entitlement status, plan, and expiration metadata. We do not store full payment-card credentials.

---

## 2. How We Use Your Information

We use the information we collect exclusively for the following purposes:

1. **Delivering personalized language instruction** — adapting lessons, exercises, and review schedules to your proficiency level and learning goals.
2. **Generating progress reports** — providing performance data to you and, when applicable, to your educational institution and teachers.
3. **Enabling teacher oversight** — allowing teachers to grade work, provide feedback, and adjust curriculum for their classrooms.
4. **Improving the Service** — analyzing aggregated, de-identified usage data to improve product quality and educational outcomes. Individual student data is never used for this purpose in identifiable form.

---

## 3. How We Do Not Use Your Information

We want to be explicit about what we will never do with your data:

- **No advertising or marketing to students.** We do not use student data to advertise or market products or services.
- **No sale or rental of data.** We do not sell, rent, or lease personal information or education records to any third party, for any reason, under any circumstances.
- **No non-educational profiling.** We do not build behavioral profiles of students for purposes unrelated to their education.
- **No Fluenci model training on your content.** Fluenci does not use learner content to train its own models. Third-party AI processing is governed by the providers' applicable commercial/API data terms and any executed agreements; institutions should verify required contractual terms with us before deployment.

---

## 4. Data Sharing and Subprocessors

We share data only with the subprocessors listed below, solely to operate the Service. Each subprocessor is bound by a data processing agreement (DPA) that restricts use of data to service delivery only.

| Subprocessor | Data Received | Purpose | DPA in Place | Receives Student PII? |
|---|---|---|---|---|
| **Supabase** (hosted on AWS) | All data at rest | Database, authentication, file storage, edge compute | Yes | Yes |
| **Anthropic** | Typed messages, writing/assignment text, and client-reported tutor transcripts | AI tutoring, grading, and learner-facing debriefs | Commercial/API terms; institution-specific terms must be verified | Yes |
| **OpenAI** | Voice audio, live voice-session content, text for safety checks, and user-selected avatar photos | Transcription, live tutoring, content moderation, and avatar generation | Commercial/API terms; institution-specific terms must be verified | Yes |
| **Fish Audio and ElevenLabs** | Text to be spoken and voice configuration | Speech synthesis | Provider terms; institution-specific terms must be verified | Content may contain student text |
| **Upstash** | Internal account/session identifiers and short-lived lesson or tutor state | Redis rate limiting and temporary session state | Provider terms; institution-specific terms must be verified | Yes |
| **RevenueCat, Apple, and Google Play** | Internal account identifier, product, transaction, entitlement, and device/store metadata | Mobile subscription purchase and entitlement management | Provider/platform terms | Yes |
| **Apple and Google identity services** | Account identifier, email/name when supplied, and authentication metadata | Optional social sign-in | Provider/platform terms | Yes |
| **Stripe** | Verified account email, provider customer identifier, plan, and checkout metadata | Web or institutional payment processing | Provider terms | Yes |
| **PostHog** | Internal account identifier and allow-listed product events/properties; no free-form learning content | Product analytics | Provider terms | Yes |
| **Sentry** | Internal account identifier, error/stack data, app/device metadata; credentials are scrubbed | Crash reporting and diagnostics | Provider terms | Yes |

We use these providers only to operate, secure, bill, and improve the Service. If we add a new subprocessor that will receive student personal information, we will update this policy and provide any notice required by the applicable institutional agreement or law.

---

## 5. Data Retention

We retain data only as long as necessary to provide the Service. Retention periods vary by data type:

| Data Type | Retention Period |
|---|---|
| Account information (email, display name) | Duration of contract + 30 days |
| Organization membership and classroom data | Duration of contract + 30 days |
| Learning progress (CEFR level, XP, streaks) | Duration of contract + 30 days |
| Chat messages | Duration of contract + 30 days |
| Assignment submissions | Duration of contract + 30 days |
| Spaced repetition data | Duration of contract + 30 days |
| Raw microphone audio | Processed transiently and not stored by Fluenci after the request/live session; provider-side handling follows applicable provider terms |
| Client-reported live-tutor transcript buffer | Short-lived session buffer; derived debriefs may remain with the account |
| Usage analytics and crash reports | Retained according to the configured PostHog/Sentry project settings and then deleted or de-identified; exact production settings are reviewed before launch |
| Payment information | Retained by Apple, Google, RevenueCat, or Stripe under their terms; Fluenci retains identifiers and entitlement records as needed for billing, support, fraud prevention, and legal obligations |

Upon contract termination or at the institution's request, all PII is anonymized or permanently deleted within 30 days. Anonymized, aggregate data may be retained for service improvement purposes.

---

## 6. Your Rights

### For All Users

- **Access.** You may request a copy of the personal information we hold about you.
- **Correction.** You may request correction of inaccurate personal information.
- **Deletion.** You may request deletion of your personal information, subject to any legal obligations requiring retention.
- **Data export.** You may request an export of your data in a machine-readable format.

### For Educational Institutions

School administrators have additional controls:

- **Organization-wide data export** at any time via the Fluenci administrative dashboard.
- **Full data deletion** for any student, teacher, or the entire organization upon request.
- **Audit logs** for all administrative actions within the organization.
- **User management**, including the ability to add or remove students and teachers, configure classroom settings, and deactivate the organization.

Individual student deletion requests from institutions are fulfilled upon request from the institution's authorized representative.

### How to Exercise Your Rights

To make a request, contact us at [privacy@fluenciapp.com](mailto:privacy@fluenciapp.com). For institutional requests, we respond within 48 hours.

---

## 7. Children's Privacy and COPPA

Fluenci may be used by students under the age of 13 when deployed by an educational institution. In these cases:

- **The institution provides consent.** Under COPPA, when an educational institution contracts with Fluenci for use in a school setting, the institution may consent to the collection of student information on behalf of parents or guardians, consistent with the educational purpose.
- **Content safety.** All AI-generated content is processed through a content safety validation pipeline before being displayed to any user under 18.
- **No direct marketing.** We do not engage in any direct marketing to students under 18.
- **Voice recording retention.** Voice recordings for all users, including minors, follow the same 90-day deletion schedule.
- **Parental access.** Parents or guardians who wish to review their child's data, request corrections, or request deletion should contact their child's school. The school, as the contracting institution, manages these requests and may direct them to us.

We do not knowingly collect personal information from children under 13 outside of a school-contracted context. If you believe a child under 13 has provided us with personal information without appropriate consent, please contact us immediately at [privacy@fluenciapp.com](mailto:privacy@fluenciapp.com) and we will promptly delete the information.

---

## 8. FERPA Compliance

When Fluenci is deployed by an educational institution, we operate as a **"school official"** under the FERPA school official exception (34 CFR Section 99.31(a)(1)(i)(B)). This means:

1. **We perform a service that the institution would otherwise use its own employees to provide** — specifically, personalized language instruction, practice, and assessment.
2. **We are under the direct control of the institution with respect to use and maintenance of education records.** Institutions control which students and teachers have access, what data is collected through assignments, and can export or delete all data at any time.
3. **We use education records only for the purposes for which disclosure was authorized** — delivering language instruction and enabling institutional oversight. We do not repurpose education records for any other use.

### Access Controls Under FERPA

To protect the confidentiality of education records:

- **Students** can access only their own data.
- **Teachers** can access data only for students enrolled in their classrooms.
- **School administrators** can access data only within their own organization.
- **Fluenci personnel** access production data only when necessary for technical support or debugging, and all such access is subject to audit logging. No Fluenci employee may access student data without a documented reason.

### Institutional Rights Under FERPA

Institutions retain full control over education records held by Fluenci, including the right to:

- Inspect and review all education records we maintain on their behalf.
- Request amendment of records they believe to be inaccurate.
- Export all organizational data at any time.
- Request complete deletion of all data upon contract termination.
- Receive confirmation of deletion upon completion.

---

## 9. Security Measures

We implement the following technical and organizational safeguards to protect your information:

### Encryption

- **At rest:** All data stored in our database and file storage is encrypted using AES-256 encryption.
- **In transit:** All data transmitted between your device, our servers, and our subprocessors is encrypted using TLS 1.2 or higher. HSTS (HTTP Strict Transport Security) is enabled on all endpoints.

### Infrastructure

- Our database, authentication, file storage, and server-side compute are hosted on Supabase, which runs on AWS infrastructure in the us-east-1 region.
- Backups are encrypted at rest using the same encryption standards as primary data.

### Authentication and Authorization

- User authentication is handled via JWT-based sessions with role-based access control.
- Row-level security policies enforce data isolation between users, classrooms, and organizations at the database level.

### Operational Security

- All access to production systems and student data by Fluenci personnel is logged and auditable.
- We follow the principle of least privilege for all internal access.

---

## 10. Breach Notification

In the event of a confirmed data breach affecting education records or personal information:

- **Timing:** We will notify affected institutions within **72 hours** of confirming the breach.
- **Method:** Direct email to the institutional IT or privacy contact on file, supplemented by a phone call for high-severity incidents.
- **Content:** Our notification will include the nature of the breach, the categories of data affected, remediation steps we are taking, and recommended actions for the institution.
- **Follow-up:** A full written incident report will be provided within 14 days of the initial notification.

---

## 11. International Users

Fluenci's infrastructure is hosted in the United States (AWS us-east-1). If you access the Service from outside the United States, your information will be transferred to and processed in the United States.

For users in the European Economic Area (EEA), United Kingdom, or other jurisdictions with data transfer restrictions, by using the Service you acknowledge that your data will be transferred to the United States. We apply the same privacy protections described in this policy to all users regardless of location.

If you are an institution subject to GDPR or other international privacy regulations, please contact us at [privacy@fluenciapp.com](mailto:privacy@fluenciapp.com) to discuss applicable data transfer mechanisms and any supplementary agreements that may be needed.

---

## 12. Changes to This Policy

We may update this Privacy Policy from time to time to reflect changes in our practices, our subprocessors, or applicable law. When we make changes:

- We will update the "Effective Date" at the top of this policy.
- For material changes affecting how we handle education records or student data, we will notify affected institutions by email at least **30 days** before the changes take effect.
- The current version of this policy will always be available within the Fluenci application and on our website.

Continued use of the Service after the effective date of a revised policy constitutes acceptance of the updated terms.

---

## 13. Contact Us

If you have questions about this Privacy Policy, your data, or our privacy practices, please contact us:

- **Privacy inquiries:** [privacy@fluenciapp.com](mailto:privacy@fluenciapp.com)
- **Data deletion requests:** [privacy@fluenciapp.com](mailto:privacy@fluenciapp.com)
- **Data processing agreement (DPA) requests:** [legal@fluenciapp.com](mailto:legal@fluenciapp.com)
- **Response time:** 48 hours for institutional requests

**NovaWealth**
Operator of Fluenci
[privacy@fluenciapp.com](mailto:privacy@fluenciapp.com)

---

*This Privacy Policy is effective as of September 8, 2026.*
