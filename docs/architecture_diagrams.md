# Architecture Diagrams

**Product:** Fluenci — AI-Powered Language Learning Platform
**Last Updated:** 2026-04-20

---

## 1. System Architecture

```mermaid
graph TB
    subgraph Client ["Mobile Client (React Native / Expo)"]
        APP[Fluenci App]
        STORE[Zustand Stores]
        HOOKS[Custom Hooks]
    end

    subgraph Supabase ["Supabase Platform (AWS us-east-1)"]
        AUTH[Supabase Auth<br/>JWT Issuance]
        DB[(PostgreSQL<br/>+ RLS)]
        STORAGE[Supabase Storage<br/>Audio Files]

        subgraph EdgeFunctions ["Edge Functions (Deno)"]
            EF_CHAT[ai-chat]
            EF_TTS[tts]
            EF_VOICE[voice-proxy]
            EF_SCHOOL[school]
            EF_ADMIN[school-admin]
        end
    end

    subgraph AI ["AI Service Providers"]
        ANTHROPIC[Anthropic Claude<br/>Tutoring & Grading]
        GEMINI[Google Gemini<br/>Real-time Voice]
        WHISPER[OpenAI Whisper<br/>Speech-to-Text]
        ELEVENLABS[ElevenLabs<br/>Text-to-Speech]
    end

    subgraph Payments ["Payment Processing"]
        STRIPE[Stripe<br/>Subscriptions]
        REVENUECAT[RevenueCat<br/>In-App Purchases]
    end

    APP --> AUTH
    APP --> DB
    APP --> STORAGE
    APP --> EF_CHAT
    APP --> EF_TTS
    APP --> EF_VOICE
    APP --> EF_SCHOOL
    APP --> EF_ADMIN

    EF_CHAT --> ANTHROPIC
    EF_CHAT --> DB
    EF_VOICE --> GEMINI
    EF_TTS --> ELEVENLABS
    EF_SCHOOL --> ANTHROPIC
    EF_SCHOOL --> DB
    EF_ADMIN --> DB

    APP --> STRIPE
    APP --> REVENUECAT
```

---

## 2. Data Flow — PII Paths

```mermaid
flowchart LR
    subgraph Student ["Student Device"]
        INPUT[Text/Voice Input]
    end

    subgraph Supabase ["Supabase"]
        DB[(PostgreSQL)]
        EF[Edge Functions]
    end

    subgraph External ["External Processors"]
        ANTH[Anthropic Claude]
        GOOG[Google Gemini]
        OAI[OpenAI Whisper]
        EL[ElevenLabs]
    end

    INPUT -->|"Email, Name<br/>(auth)"| DB
    INPUT -->|"Chat text<br/>(via Edge Function)"| EF
    INPUT -->|"Voice audio<br/>(via Edge Function)"| EF

    EF -->|"Chat text + context"| ANTH
    EF -->|"Voice audio + context"| GOOG
    EF -->|"Voice audio only"| OAI
    EF -->|"Target language text<br/>(NO student PII)"| EL

    ANTH -->|"AI response"| EF
    GOOG -->|"AI voice response"| EF
    OAI -->|"Transcript text"| EF
    EL -->|"Audio file"| EF

    EF -->|"Store messages,<br/>progress, grades"| DB
    DB -->|"Encrypted at rest<br/>AES-256"| DB
```

**Key PII Flow Notes:**
- Student email and name stored only in Supabase PostgreSQL
- Chat messages pass through Edge Functions to Anthropic (transient, not stored by Anthropic per DPA)
- Voice audio passes through Edge Functions to Google/OpenAI (transient processing)
- ElevenLabs receives only target-language text with no student identifiers
- All transit encrypted with TLS 1.2+

---

## 3. Subprocessor Inventory

| # | Service | Provider | Data Received | Purpose | Retention by Provider | DPA |
|---|---------|----------|---------------|---------|----------------------|-----|
| 1 | Supabase | Supabase Inc (AWS) | All application data | Database, auth, compute, storage | Per contract | Yes |
| 2 | Claude API | Anthropic | Chat messages, assignment text, grading prompts | AI tutoring, automated grading | Not retained (API ToS) | Yes |
| 3 | Gemini API | Google | Voice audio, conversation context | Real-time voice conversation practice | Not retained (API ToS) | Yes |
| 4 | Whisper API | OpenAI | Voice audio recordings | Speech-to-text transcription | Not retained (API ToS) | Yes |
| 5 | ElevenLabs API | ElevenLabs | Target language text (no PII) | Text-to-speech audio generation | Not retained | Yes |
| 6 | Stripe | Stripe Inc | Email, user ID, plan tier | Subscription payment processing | Per Stripe DPA | Yes |
| 7 | RevenueCat | RevenueCat Inc | Anonymous user ID, purchase events | In-app purchase management | Per RevenueCat DPA | Yes |

---

## 4. Database Schema Overview

```mermaid
erDiagram
    users ||--o{ user_profiles : has
    users ||--o{ user_roles : has
    users ||--o{ organization_members : belongs_to
    users ||--o{ chat_sessions : creates
    users ||--o{ classroom_enrollments : enrolls_in

    organizations ||--o{ organization_members : contains
    organizations ||--o{ classrooms : has

    classrooms ||--o{ classroom_enrollments : has
    classrooms ||--o{ assignments : contains

    assignments ||--o{ assignment_submissions : receives

    chat_sessions ||--o{ chat_messages : contains
    chat_sessions ||--o| assignment_submissions : linked_to

    organizations {
        uuid id PK
        text name
        text slug
        text contact_email
        int max_seats
        jsonb contract_config
        boolean is_active
    }

    classrooms {
        uuid id PK
        uuid organization_id FK
        uuid teacher_id FK
        text name
        text target_language
        text level
        text invite_code
    }

    assignments {
        uuid id PK
        uuid classroom_id FK
        uuid teacher_id FK
        text title
        text mode
        text target_language
        text level
        timestamptz due_at
    }

    assignment_submissions {
        uuid id PK
        uuid assignment_id FK
        uuid student_id FK
        uuid chat_session_id FK
        text status
        jsonb ai_feedback
        int teacher_score
    }

    audit_log {
        uuid id PK
        uuid actor_id FK
        text action
        text resource_type
        uuid resource_id
        uuid organization_id FK
        jsonb metadata
        timestamptz created_at
    }
```

---

## 5. Authentication Flow

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant Auth as Supabase Auth
    participant EF as Edge Function
    participant DB as PostgreSQL

    App->>Auth: Sign in (email/password or magic link)
    Auth-->>App: JWT + Refresh Token

    App->>EF: API Request + JWT in Authorization header
    EF->>Auth: Verify JWT signature & expiry
    Auth-->>EF: User ID + claims

    EF->>DB: Query with RLS (auth.uid() = user_id)
    DB-->>EF: Filtered results (only user's data)
    EF-->>App: JSON response

    Note over App,Auth: Tokens expire after 1 hour
    App->>Auth: Refresh token rotation
    Auth-->>App: New JWT + new refresh token
```

---

## 6. School Feature Architecture

```mermaid
graph TB
    subgraph Roles ["User Roles"]
        ADMIN[School Admin]
        TEACHER[Teacher]
        STUDENT[Student/Learner]
    end

    subgraph Functions ["Edge Functions"]
        SA[school-admin<br/>Org management]
        SC[school<br/>Classroom & assignments]
    end

    subgraph Data ["Database Tables"]
        ORG[organizations]
        MEMBERS[organization_members]
        CLASS[classrooms]
        ENROLL[classroom_enrollments]
        ASSIGN[assignments]
        SUBMIT[assignment_submissions]
        AUDIT[audit_log]
    end

    ADMIN --> SA
    TEACHER --> SC
    STUDENT --> SC

    SA --> ORG
    SA --> MEMBERS
    SA --> AUDIT

    SC --> CLASS
    SC --> ENROLL
    SC --> ASSIGN
    SC --> SUBMIT
    SC --> AUDIT
```
