// Supabase Edge Function: School
// Handles classroom management, assignment CRUD, and submission workflow
// for the "Fluenci for Schools" feature.
// Deploy: npx supabase functions deploy school

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { logAudit, getClientIp } from '../_shared/audit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const GRADING_MODEL = 'claude-haiku-4-5-20251001';

interface SchoolRequest {
  action: string;
  [key: string]: unknown;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return errorResponse('Unauthorized', 401);
    const { userId, email: userEmail } = authUser;

    const body = (await req.json()) as SchoolRequest;
    const { action } = body;

    const ip = getClientIp(req);

    switch (action) {
      case 'create-classroom':
        return await createClassroom(supabase, userId, body, ip);
      case 'join-classroom':
        return await joinClassroom(supabase, userId, userEmail, body, ip);
      case 'leave-classroom':
        return await leaveClassroom(supabase, userId, body, ip);
      case 'create-assignment':
        return await createAssignment(supabase, userId, body, ip);
      case 'start-assignment':
        return await startAssignment(supabase, userId, body);
      case 'submit-assignment':
        return await submitAssignment(supabase, userId, body, ip);
      case 'grade-assignment':
        return await gradeAssignment(supabase, userId, body, ip);
      case 'bulk-enroll':
        return await bulkEnroll(supabase, userId, body, ip);
      default:
        return errorResponse(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error('[school] Error:', err);
    return errorResponse(err.message ?? 'Internal server error', 500);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────

async function requireTeacherRole(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['teacher', 'school_admin']);
  return (data ?? []).length > 0;
}

async function requireOrgTeacherOrAdmin(supabase: any, userId: string, organizationId: string): Promise<boolean> {
  const { data } = await supabase
    .from('organization_members')
    .select('org_role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .in('org_role', ['teacher', 'admin'])
    .limit(1);
  return (data ?? []).length > 0;
}

async function isClassroomTeacher(supabase: any, userId: string, classroomId: string): Promise<boolean> {
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('organization_id, teacher_id')
    .eq('id', classroomId)
    .single();
  if (!classroom) return false;
  if (classroom.teacher_id === userId) return true;
  return requireOrgTeacherOrAdmin(supabase, userId, classroom.organization_id);
}

async function isEnrolledStudent(supabase: any, userId: string, classroomId: string): Promise<boolean> {
  const { data } = await supabase
    .from('classroom_enrollments')
    .select('id')
    .eq('student_id', userId)
    .eq('classroom_id', classroomId)
    .is('dropped_at', null)
    .limit(1);
  return (data ?? []).length > 0;
}

// ─── Email Domain Validation ─────────────────────────────────────

async function getOrgAllowedDomains(supabase: any, organizationId: string): Promise<string[]> {
  const { data: org } = await supabase
    .from('organizations')
    .select('contract_config')
    .eq('id', organizationId)
    .single();
  return org?.contract_config?.allowed_email_domains ?? [];
}

function validateEmailDomain(email: string, allowedDomains: string[]): { valid: boolean; reason?: string } {
  if (allowedDomains.length === 0) return { valid: true };
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain) return { valid: false, reason: 'Could not determine email domain' };
  if (!allowedDomains.some((d: string) => d.toLowerCase() === domain)) {
    return { valid: false, reason: `Email domain @${domain} is not authorized for this organization. Required: @${allowedDomains.join(' or @')}` };
  }
  return { valid: true };
}

// ─── Actions ──────────────────────────────────────────────────────

async function createClassroom(supabase: any, userId: string, body: SchoolRequest, ip?: string): Promise<Response> {
  const { name, targetLanguage, level, organizationId } = body as any;
  if (!name || !targetLanguage || !level || !organizationId) {
    return errorResponse('Missing required fields: name, targetLanguage, level, organizationId');
  }

  const isTeacher = await requireTeacherRole(supabase, userId);
  if (!isTeacher) return errorResponse('Teacher role required', 403);

  const isOrgMember = await requireOrgTeacherOrAdmin(supabase, userId, organizationId);
  if (!isOrgMember) return errorResponse('Must be a teacher or admin in this organization', 403);

  // Generate invite code via RPC
  const { data: inviteCode, error: codeErr } = await supabase.rpc('generate_invite_code');
  if (codeErr) return errorResponse(`Failed to generate invite code: ${codeErr.message}`, 500);

  const { data: classroom, error } = await supabase
    .from('classrooms')
    .insert({
      name,
      target_language: targetLanguage,
      level,
      organization_id: organizationId,
      teacher_id: userId,
      invite_code: inviteCode,
      invite_code_active: true,
    })
    .select()
    .single();

  if (error) return errorResponse(`Failed to create classroom: ${error.message}`, 500);

  logAudit(supabase, {
    actorId: userId, actorRole: 'teacher', organizationId: organizationId as string,
    action: 'create', resourceType: 'classroom', resourceId: classroom.id, ipAddress: ip,
  });

  return jsonResponse({ classroom });
}

async function joinClassroom(supabase: any, userId: string, email: string, body: SchoolRequest, ip?: string): Promise<Response> {
  const { inviteCode } = body as any;
  if (!inviteCode) return errorResponse('Missing inviteCode');

  // Look up classroom by invite code
  const { data: classroom, error: lookupErr } = await supabase
    .from('classrooms')
    .select('id, name, organization_id, invite_code_active, archived_at, organizations!inner(id, is_active, max_seats)')
    .eq('invite_code', inviteCode)
    .single();

  if (lookupErr || !classroom) return errorResponse('Invalid invite code', 404);
  if (!classroom.invite_code_active) return errorResponse('Invite code is no longer active');
  if (classroom.archived_at) return errorResponse('Classroom has been archived');
  if (!classroom.organizations?.is_active) return errorResponse('Organization is not active');

  // Check seat limit
  const org = classroom.organizations;
  if (org.max_seats) {
    const { count } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', classroom.organization_id);
    if ((count ?? 0) >= org.max_seats) {
      return errorResponse('Organization seat limit reached');
    }
  }

  // Validate email domain
  const allowedDomains = await getOrgAllowedDomains(supabase, classroom.organization_id);
  const domainCheck = validateEmailDomain(email, allowedDomains);
  if (!domainCheck.valid) return errorResponse(domainCheck.reason!, 403);

  // Check if already enrolled
  const { data: existing } = await supabase
    .from('classroom_enrollments')
    .select('id, dropped_at')
    .eq('student_id', userId)
    .eq('classroom_id', classroom.id)
    .limit(1);

  let enrollment;
  if (existing && existing.length > 0 && !existing[0].dropped_at) {
    return errorResponse('Already enrolled in this classroom');
  } else if (existing && existing.length > 0 && existing[0].dropped_at) {
    // Re-enroll (clear dropped_at)
    const { data: updated, error: reErr } = await supabase
      .from('classroom_enrollments')
      .update({ dropped_at: null })
      .eq('id', existing[0].id)
      .select()
      .single();
    if (reErr) return errorResponse(`Failed to re-enroll: ${reErr.message}`, 500);
    enrollment = updated;
  } else {
    const { data: created, error: enrollErr } = await supabase
      .from('classroom_enrollments')
      .insert({
        student_id: userId,
        classroom_id: classroom.id,
      })
      .select()
      .single();
    if (enrollErr) return errorResponse(`Failed to enroll: ${enrollErr.message}`, 500);
    enrollment = created;
  }

  // Ensure organization_members row exists with student role
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', classroom.organization_id)
    .limit(1);

  if (!existingMember || existingMember.length === 0) {
    await supabase
      .from('organization_members')
      .insert({
        user_id: userId,
        organization_id: classroom.organization_id,
        org_role: 'student',
      });
  }

  logAudit(supabase, {
    actorId: userId, actorRole: 'student', organizationId: classroom.organization_id,
    action: 'create', resourceType: 'enrollment', resourceId: enrollment.id, ipAddress: ip,
  });

  return jsonResponse({
    enrollment,
    classroom: {
      id: classroom.id,
      name: classroom.name,
      organization_id: classroom.organization_id,
    },
  });
}

async function leaveClassroom(supabase: any, userId: string, body: SchoolRequest, ip?: string): Promise<Response> {
  const { classroomId } = body as any;
  if (!classroomId) return errorResponse('Missing classroomId');

  const enrolled = await isEnrolledStudent(supabase, userId, classroomId);
  if (!enrolled) return errorResponse('Not enrolled in this classroom', 403);

  const { error } = await supabase
    .from('classroom_enrollments')
    .update({ dropped_at: new Date().toISOString() })
    .eq('student_id', userId)
    .eq('classroom_id', classroomId)
    .is('dropped_at', null);

  if (error) return errorResponse(`Failed to leave classroom: ${error.message}`, 500);

  logAudit(supabase, {
    actorId: userId, actorRole: 'student',
    action: 'delete', resourceType: 'enrollment', metadata: { classroomId }, ipAddress: ip,
  });

  return jsonResponse({ success: true });
}

async function createAssignment(supabase: any, userId: string, body: SchoolRequest, ip?: string): Promise<Response> {
  const {
    classroomId, title, description, scenarioKey, customScenario,
    targetLanguage, level, minDurationMinutes, mode,
    vocabularyFocus, grammarFocus, instructions, dueAt, status,
  } = body as any;

  if (!classroomId || !title || !targetLanguage || !level) {
    return errorResponse('Missing required fields: classroomId, title, targetLanguage, level');
  }

  const isTeacher = await isClassroomTeacher(supabase, userId, classroomId);
  if (!isTeacher) return errorResponse('Must be teacher of this classroom', 403);

  const assignmentData: Record<string, unknown> = {
    classroom_id: classroomId,
    teacher_id: userId,
    title,
    description: description ?? null,
    scenario_key: scenarioKey ?? null,
    custom_scenario: customScenario ?? null,
    target_language: targetLanguage,
    level,
    min_duration_minutes: minDurationMinutes ?? null,
    mode: mode ?? 'conversation',
    vocabulary_focus: vocabularyFocus ?? null,
    grammar_focus: grammarFocus ?? null,
    instructions: instructions ?? null,
    due_at: dueAt ?? null,
    status: status ?? 'draft',
  };

  if (status === 'published') {
    assignmentData.published_at = new Date().toISOString();
  }

  const { data: assignment, error } = await supabase
    .from('assignments')
    .insert(assignmentData)
    .select()
    .single();

  if (error) return errorResponse(`Failed to create assignment: ${error.message}`, 500);

  // Get org ID for audit
  const { data: cls } = await supabase.from('classrooms').select('organization_id').eq('id', classroomId).single();
  logAudit(supabase, {
    actorId: userId, actorRole: 'teacher', organizationId: cls?.organization_id,
    action: 'create', resourceType: 'assignment', resourceId: assignment.id, ipAddress: ip,
  });

  return jsonResponse({ assignment });
}

async function startAssignment(supabase: any, userId: string, body: SchoolRequest): Promise<Response> {
  const { assignmentId } = body as any;
  if (!assignmentId) return errorResponse('Missing assignmentId');

  // Fetch assignment and verify enrollment
  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select('id, classroom_id, target_language, level, scenario_key, custom_scenario, title')
    .eq('id', assignmentId)
    .single();

  if (aErr || !assignment) return errorResponse('Assignment not found', 404);

  const enrolled = await isEnrolledStudent(supabase, userId, assignment.classroom_id);
  if (!enrolled) return errorResponse('Must be enrolled in the classroom', 403);

  // Check for existing submission
  const { data: existingSub } = await supabase
    .from('assignment_submissions')
    .select('id, chat_session_id, status')
    .eq('assignment_id', assignmentId)
    .eq('student_id', userId)
    .limit(1);

  if (existingSub && existingSub.length > 0) {
    const sub = existingSub[0];
    if (sub.status === 'in_progress') {
      return jsonResponse({ submission: sub, chatSessionId: sub.chat_session_id });
    }
    // Already submitted or graded — do not re-start
    if (sub.status === 'submitted' || sub.status === 'graded') {
      return errorResponse('Assignment already submitted');
    }
  }

  // Create a chat session linked to the assignment
  const { data: chatSession, error: csErr } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      assignment_id: assignmentId,
      classroom_id: assignment.classroom_id,
      target_language: assignment.target_language,
      level: assignment.level,
      topic: assignment.custom_scenario ?? assignment.scenario_key ?? assignment.title,
    })
    .select('id')
    .single();

  if (csErr) return errorResponse(`Failed to create chat session: ${csErr.message}`, 500);

  // Create or update submission
  const now = new Date().toISOString();
  const { data: submission, error: subErr } = await supabase
    .from('assignment_submissions')
    .upsert({
      assignment_id: assignmentId,
      student_id: userId,
      chat_session_id: chatSession.id,
      status: 'in_progress',
      started_at: now,
    }, { onConflict: 'assignment_id,student_id' })
    .select()
    .single();

  if (subErr) return errorResponse(`Failed to create submission: ${subErr.message}`, 500);

  return jsonResponse({ submission, chatSessionId: chatSession.id });
}

async function submitAssignment(supabase: any, userId: string, body: SchoolRequest, ip?: string): Promise<Response> {
  const { assignmentId } = body as any;
  if (!assignmentId) return errorResponse('Missing assignmentId');

  // Fetch submission
  const { data: submission, error: subErr } = await supabase
    .from('assignment_submissions')
    .select('id, chat_session_id, started_at, status')
    .eq('assignment_id', assignmentId)
    .eq('student_id', userId)
    .single();

  if (subErr || !submission) return errorResponse('No submission found for this assignment', 404);
  if (submission.status !== 'in_progress') return errorResponse('Assignment is not in progress');

  // Fetch assignment for grading context
  const { data: assignment } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', assignmentId)
    .single();

  if (!assignment) return errorResponse('Assignment not found', 404);

  const now = new Date().toISOString();

  // Calculate duration from chat session timestamps
  let conversationDurationMinutes = 0;
  if (submission.chat_session_id) {
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('chat_session_id', submission.chat_session_id)
      .order('created_at', { ascending: true });

    if (messages && messages.length >= 2) {
      const firstMsg = new Date(messages[0].created_at).getTime();
      const lastMsg = new Date(messages[messages.length - 1].created_at).getTime();
      conversationDurationMinutes = Math.round((lastMsg - firstMsg) / 60_000 * 100) / 100;
    }
  }

  // Check if late
  const isLate = assignment.due_at
    ? new Date(now) > new Date(assignment.due_at) && assignment.late_submission_allowed
    : false;

  // Run AI grading
  const aiFeedback = await gradeWithAI(supabase, assignment, submission, conversationDurationMinutes);

  // Update submission
  const { data: updated, error: updateErr } = await supabase
    .from('assignment_submissions')
    .update({
      status: 'submitted',
      submitted_at: now,
      is_late: isLate,
      conversation_duration_minutes: conversationDurationMinutes,
      ai_feedback: aiFeedback,
      auto_score: aiFeedback?.totalScore ?? null,
    })
    .eq('id', submission.id)
    .select()
    .single();

  if (updateErr) return errorResponse(`Failed to submit: ${updateErr.message}`, 500);

  // Audit log for submission
  const { data: asgn } = await supabase.from('assignments').select('classroom_id, classrooms!inner(organization_id)').eq('id', assignmentId).single();
  logAudit(supabase, {
    actorId: userId, actorRole: 'student', organizationId: (asgn?.classrooms as any)?.organization_id,
    action: 'create', resourceType: 'submission', resourceId: updated.id, ipAddress: ip,
  });

  return jsonResponse({ submission: updated });
}

async function gradeAssignment(supabase: any, userId: string, body: SchoolRequest, ip?: string): Promise<Response> {
  const { submissionId, teacherScore, teacherFeedback } = body as any;
  if (!submissionId) return errorResponse('Missing submissionId');

  // Fetch submission to get classroom
  const { data: submission, error: subErr } = await supabase
    .from('assignment_submissions')
    .select('id, assignment_id, assignments!inner(classroom_id)')
    .eq('id', submissionId)
    .single();

  if (subErr || !submission) return errorResponse('Submission not found', 404);

  const classroomId = (submission.assignments as any).classroom_id;
  const isTeacher = await isClassroomTeacher(supabase, userId, classroomId);
  if (!isTeacher) return errorResponse('Must be teacher of this classroom', 403);

  const { data: updated, error } = await supabase
    .from('assignment_submissions')
    .update({
      teacher_score: teacherScore ?? null,
      teacher_feedback: teacherFeedback ?? null,
      final_score: teacherScore ?? null,
      status: 'graded',
      graded_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (error) return errorResponse(`Failed to grade: ${error.message}`, 500);

  // Audit log for grading
  const { data: gradedAsgn } = await supabase.from('assignments').select('classroom_id, classrooms!inner(organization_id)').eq('id', submission.assignment_id).single();
  logAudit(supabase, {
    actorId: userId, actorRole: 'teacher', organizationId: (gradedAsgn?.classrooms as any)?.organization_id,
    action: 'update', resourceType: 'submission', resourceId: submissionId, ipAddress: ip,
    metadata: { teacherScore, action: 'grade' },
  });

  return jsonResponse({ submission: updated });
}

// ─── AI Grading ───────────────────────────────────────────────────

async function gradeWithAI(
  supabase: any,
  assignment: any,
  submission: any,
  conversationDurationMinutes: number,
): Promise<Record<string, unknown> | null> {
  if (!ANTHROPIC_API_KEY) {
    console.error('[school] ANTHROPIC_API_KEY not configured, skipping AI grading');
    return null;
  }

  // Load conversation messages
  let conversationText = '(No messages found)';
  if (submission.chat_session_id) {
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('chat_session_id', submission.chat_session_id)
      .order('created_at', { ascending: true });

    if (messages && messages.length > 0) {
      conversationText = messages
        .map((m: any) => `[${m.role}]: ${m.content}`)
        .join('\n');
    }
  }

  const scenarioDescription = assignment.custom_scenario ?? assignment.scenario_key ?? assignment.title ?? 'General conversation';
  const minDuration = assignment.min_duration_minutes ?? 0;

  const gradingPrompt = `You are grading a language learning conversation assignment.

Student was assigned to practice ${assignment.target_language} at ${assignment.level} level.
Topic: ${scenarioDescription}
Minimum duration: ${minDuration} minutes
Actual duration: ${conversationDurationMinutes} minutes

Here is the conversation:
---
${conversationText}
---

Grade this conversation on these rubrics (0-25 each):
1. Participation: Did the student actively engage with multiple turns?
2. Target language usage: Did they stay in the target language?
3. Grammar/vocabulary: Appropriate for their level?
4. Duration compliance: Did they meet the minimum time?

Return JSON:
{
  "participation": number,
  "languageUsage": number,
  "grammarVocabulary": number,
  "durationCompliance": number,
  "totalScore": number,
  "summary": "brief overall assessment",
  "strengths": ["strength1", "strength2"],
  "improvements": ["area1", "area2"]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: GRADING_MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: gradingPrompt }],
      }),
    });

    if (!response.ok) {
      console.error('[school] AI grading API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text ?? '';

    // Parse JSON from response
    const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      }
      console.error('[school] Failed to parse AI grading response:', rawText);
      return null;
    }
  } catch (err) {
    console.error('[school] AI grading error:', err);
    return null;
  }
}

// ─── Bulk Enroll ──────────────────────────────────────────────────

async function bulkEnroll(supabase: any, userId: string, body: SchoolRequest, ip?: string): Promise<Response> {
  const { classroomId, students } = body as any;
  if (!classroomId || !Array.isArray(students) || students.length === 0) {
    return errorResponse('Missing required fields: classroomId, students (array of {email, name?})');
  }

  if (students.length > 200) {
    return errorResponse('Maximum 200 students per bulk enroll request');
  }

  const isTeacher = await isClassroomTeacher(supabase, userId, classroomId);
  if (!isTeacher) return errorResponse('Must be teacher of this classroom', 403);

  // Get classroom org
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('organization_id')
    .eq('id', classroomId)
    .single();
  if (!classroom) return errorResponse('Classroom not found', 404);

  // Fetch allowed domains once for the org
  const allowedDomains = await getOrgAllowedDomains(supabase, classroom.organization_id);

  const enrolled: string[] = [];
  const errors: Array<{ email: string; reason: string }> = [];

  for (const student of students) {
    const email = student.email?.trim()?.toLowerCase();
    if (!email) {
      errors.push({ email: student.email ?? '(empty)', reason: 'Invalid email' });
      continue;
    }

    // Validate email domain
    const domainCheck = validateEmailDomain(email, allowedDomains);
    if (!domainCheck.valid) {
      errors.push({ email, reason: domainCheck.reason! });
      continue;
    }

    try {
      // Check if user exists
      const { data: { users } } = await supabase.auth.admin.listUsers({ filter: `email.eq.${email}` });
      let studentUserId: string;

      if (users && users.length > 0) {
        studentUserId = users[0].id;
      } else {
        // Create new user
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { display_name: student.name ?? email.split('@')[0] },
        });
        if (createErr || !newUser?.user) {
          errors.push({ email, reason: createErr?.message ?? 'Failed to create user' });
          continue;
        }
        studentUserId = newUser.user.id;
      }

      // Check if already enrolled
      const { data: existing } = await supabase
        .from('classroom_enrollments')
        .select('id, dropped_at')
        .eq('student_id', studentUserId)
        .eq('classroom_id', classroomId)
        .limit(1);

      if (existing && existing.length > 0 && !existing[0].dropped_at) {
        errors.push({ email, reason: 'Already enrolled' });
        continue;
      } else if (existing && existing.length > 0 && existing[0].dropped_at) {
        await supabase
          .from('classroom_enrollments')
          .update({ dropped_at: null })
          .eq('id', existing[0].id);
      } else {
        await supabase
          .from('classroom_enrollments')
          .insert({ student_id: studentUserId, classroom_id: classroomId });
      }

      // Ensure org membership
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', studentUserId)
        .eq('organization_id', classroom.organization_id)
        .limit(1);

      if (!existingMember || existingMember.length === 0) {
        await supabase
          .from('organization_members')
          .insert({ user_id: studentUserId, organization_id: classroom.organization_id, org_role: 'student' });
      }

      enrolled.push(email);
    } catch (err: any) {
      errors.push({ email, reason: err.message ?? 'Unknown error' });
    }
  }

  logAudit(supabase, {
    actorId: userId, actorRole: 'teacher', organizationId: classroom.organization_id,
    action: 'create', resourceType: 'enrollment', ipAddress: ip,
    metadata: { bulkEnroll: true, classroomId, enrolled: enrolled.length, errors: errors.length },
  });

  return jsonResponse({ enrolled: enrolled.length, enrolledEmails: enrolled, errors });
}
