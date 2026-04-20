// Supabase Edge Function: School Admin
// Handles organization management for the "Fluenci for Schools" feature.
// Only accessible by users with 'school_admin' role or listed in ADMIN_USER_IDS.
// Deploy: npx supabase functions deploy school-admin

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { logAudit, getClientIp } from '../_shared/audit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_USER_IDS = (Deno.env.get('ADMIN_USER_IDS') ?? '').split(',').filter(Boolean);

interface AdminRequest {
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

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  // Check env-based admin list
  if (ADMIN_USER_IDS.includes(userId)) return true;

  // Check user_roles table for school_admin role
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'school_admin')
    .limit(1);

  return (data ?? []).length > 0;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return errorResponse('Unauthorized', 401);
    const { userId } = authUser;

    const admin = await isAdmin(supabase, userId);
    if (!admin) return errorResponse('Admin access required', 403);

    const body = (await req.json()) as AdminRequest;
    const { action } = body;
    const ip = getClientIp(req);

    switch (action) {
      case 'create-organization':
        return await createOrganization(supabase, userId, body, ip);
      case 'update-contract':
        return await updateContract(supabase, userId, body, ip);
      case 'add-teacher':
        return await addTeacher(supabase, userId, body, ip);
      case 'deactivate-organization':
        return await deactivateOrganization(supabase, userId, body, ip);
      case 'export-org-data':
        return await exportOrgData(supabase, userId, body, ip);
      case 'purge-org-data':
        return await purgeOrgData(supabase, userId, body, ip);
      default:
        return errorResponse(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error('[school-admin] Error:', err);
    return errorResponse(err.message ?? 'Internal server error', 500);
  }
});

// ─── Actions ──────────────────────────────────────────────────────

async function createOrganization(supabase: any, userId: string, body: AdminRequest, ip?: string): Promise<Response> {
  const { name, slug, contactEmail, maxSeats, contractConfig, contractStart, contractEnd } = body as any;

  if (!name || !slug) return errorResponse('Missing required fields: name, slug');

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name,
      slug,
      contact_email: contactEmail ?? null,
      max_seats: maxSeats ?? null,
      contract_config: contractConfig ?? null,
      contract_start: contractStart ?? null,
      contract_end: contractEnd ?? null,
      created_by: userId,
      is_active: true,
    })
    .select()
    .single();

  if (error) return errorResponse(`Failed to create organization: ${error.message}`, 500);

  logAudit(supabase, {
    actorId: userId, actorRole: 'school_admin', organizationId: org.id,
    action: 'create', resourceType: 'organization', resourceId: org.id, ipAddress: ip,
  });

  return jsonResponse({ organization: org });
}

async function updateContract(supabase: any, userId: string, body: AdminRequest, ip?: string): Promise<Response> {
  const { organizationId, contractConfig, contractStart, contractEnd, maxSeats, isActive } = body as any;

  if (!organizationId) return errorResponse('Missing organizationId');

  const updates: Record<string, unknown> = {};
  if (contractConfig !== undefined) updates.contract_config = contractConfig;
  if (contractStart !== undefined) updates.contract_start = contractStart;
  if (contractEnd !== undefined) updates.contract_end = contractEnd;
  if (maxSeats !== undefined) updates.max_seats = maxSeats;
  if (isActive !== undefined) updates.is_active = isActive;

  if (Object.keys(updates).length === 0) return errorResponse('No fields to update');

  const { data: org, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', organizationId)
    .select()
    .single();

  if (error) return errorResponse(`Failed to update contract: ${error.message}`, 500);

  logAudit(supabase, {
    actorId: userId, actorRole: 'school_admin', organizationId,
    action: 'update', resourceType: 'organization', resourceId: organizationId, ipAddress: ip,
    metadata: { updatedFields: Object.keys(updates) },
  });

  return jsonResponse({ organization: org });
}

async function addTeacher(supabase: any, adminUserId: string, body: AdminRequest, ip?: string): Promise<Response> {
  const { organizationId, userEmail } = body as any;

  if (!organizationId || !userEmail) return errorResponse('Missing required fields: organizationId, userEmail');

  // Look up user by email in auth.users via admin API
  const { data: { users }, error: lookupErr } = await supabase.auth.admin.listUsers({
    filter: `email.eq.${userEmail}`,
  });
  if (lookupErr) return errorResponse(`Failed to look up users: ${lookupErr.message}`, 500);

  const user = users?.[0] ?? null;
  if (!user) return errorResponse(`No user found with email: ${userEmail}`, 404);

  const teacherUserId = user.id;

  // Upsert teacher role in user_roles
  await supabase
    .from('user_roles')
    .upsert(
      { user_id: teacherUserId, role: 'teacher' },
      { onConflict: 'user_id,role' }
    );

  // Add or update organization_members with teacher role
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', teacherUserId)
    .eq('organization_id', organizationId)
    .limit(1);

  if (existingMember && existingMember.length > 0) {
    await supabase
      .from('organization_members')
      .update({ org_role: 'teacher' })
      .eq('user_id', teacherUserId)
      .eq('organization_id', organizationId);
  } else {
    await supabase
      .from('organization_members')
      .insert({
        user_id: teacherUserId,
        organization_id: organizationId,
        org_role: 'teacher',
      });
  }

  logAudit(supabase, {
    actorId: adminUserId, actorRole: 'school_admin', organizationId,
    action: 'grant', resourceType: 'role', resourceId: teacherUserId, ipAddress: ip,
    metadata: { role: 'teacher', email: userEmail },
  });

  return jsonResponse({ success: true, userId: teacherUserId });
}

async function deactivateOrganization(supabase: any, userId: string, body: AdminRequest, ip?: string): Promise<Response> {
  const { organizationId } = body as any;

  if (!organizationId) return errorResponse('Missing organizationId');

  const { data: org, error } = await supabase
    .from('organizations')
    .update({ is_active: false })
    .eq('id', organizationId)
    .select()
    .single();

  if (error) return errorResponse(`Failed to deactivate organization: ${error.message}`, 500);

  logAudit(supabase, {
    actorId: userId, actorRole: 'school_admin', organizationId,
    action: 'update', resourceType: 'organization', resourceId: organizationId, ipAddress: ip,
    metadata: { action: 'deactivate' },
  });

  return jsonResponse({ organization: org });
}

// ─── Data Export ─────────────────────────────────────────────────

async function exportOrgData(supabase: any, userId: string, body: AdminRequest, ip?: string): Promise<Response> {
  const { organizationId } = body as any;
  if (!organizationId) return errorResponse('Missing organizationId');

  // Verify caller is org admin
  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();

  if (!membership || membership.org_role !== 'admin') {
    return errorResponse('Must be organization admin to export data', 403);
  }

  // Gather all org data
  const { data: organization } = await supabase.from('organizations').select('*').eq('id', organizationId).single();
  const { data: members } = await supabase.from('organization_members').select('*').eq('organization_id', organizationId);
  const { data: classrooms } = await supabase.from('classrooms').select('*').eq('organization_id', organizationId);

  const classroomIds = (classrooms ?? []).map((c: any) => c.id);

  let enrollments: any[] = [];
  let assignments: any[] = [];
  let submissions: any[] = [];
  let chatSessions: any[] = [];
  let chatMessages: any[] = [];

  if (classroomIds.length > 0) {
    const { data: e } = await supabase.from('classroom_enrollments').select('*').in('classroom_id', classroomIds);
    enrollments = e ?? [];

    const { data: a } = await supabase.from('assignments').select('*').in('classroom_id', classroomIds);
    assignments = a ?? [];

    const assignmentIds = assignments.map((a: any) => a.id);
    if (assignmentIds.length > 0) {
      const { data: s } = await supabase.from('assignment_submissions').select('*').in('assignment_id', assignmentIds);
      submissions = s ?? [];
    }

    const { data: cs } = await supabase.from('chat_sessions').select('*').in('classroom_id', classroomIds);
    chatSessions = cs ?? [];

    const sessionIds = (chatSessions ?? []).map((s: any) => s.id);
    if (sessionIds.length > 0) {
      const { data: cm } = await supabase.from('chat_messages').select('*').in('chat_session_id', sessionIds);
      chatMessages = cm ?? [];
    }
  }

  const { data: auditLogs } = await supabase.from('audit_log').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(10000);

  logAudit(supabase, {
    actorId: userId, actorRole: 'school_admin', organizationId,
    action: 'read', resourceType: 'organization', resourceId: organizationId, ipAddress: ip,
    metadata: { purpose: 'export' },
  });

  return jsonResponse({
    exportedAt: new Date().toISOString(),
    organization,
    members,
    classrooms,
    enrollments,
    assignments,
    submissions,
    chatSessions,
    chatMessages,
    auditLogs: auditLogs ?? [],
  });
}

// ─── Data Purge ──────────────────────────────────────────────────

async function purgeOrgData(supabase: any, userId: string, body: AdminRequest, ip?: string): Promise<Response> {
  const { organizationId, confirmationToken } = body as any;
  if (!organizationId) return errorResponse('Missing organizationId');
  if (!confirmationToken || confirmationToken !== `CONFIRM-DELETE-${organizationId}`) {
    return errorResponse('Invalid confirmation token. Send confirmationToken: "CONFIRM-DELETE-{organizationId}"');
  }

  // Verify caller is org admin
  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();

  if (!membership || membership.org_role !== 'admin') {
    return errorResponse('Must be organization admin to purge data', 403);
  }

  // Get all classrooms for this org
  const { data: classrooms } = await supabase.from('classrooms').select('id').eq('organization_id', organizationId);
  const classroomIds = (classrooms ?? []).map((c: any) => c.id);

  let deletedMessages = 0;
  let deletedSessions = 0;
  let deletedSubmissions = 0;
  let deletedAssignments = 0;
  let deletedEnrollments = 0;

  if (classroomIds.length > 0) {
    // Delete chat messages for classroom sessions
    const { data: sessions } = await supabase.from('chat_sessions').select('id').in('classroom_id', classroomIds);
    const sessionIds = (sessions ?? []).map((s: any) => s.id);

    if (sessionIds.length > 0) {
      const { count: msgCount } = await supabase.from('chat_messages').delete({ count: 'exact' }).in('chat_session_id', sessionIds);
      deletedMessages = msgCount ?? 0;

      const { count: sesCount } = await supabase.from('chat_sessions').delete({ count: 'exact' }).in('classroom_id', classroomIds);
      deletedSessions = sesCount ?? 0;
    }

    // Delete submissions
    const { data: assignments } = await supabase.from('assignments').select('id').in('classroom_id', classroomIds);
    const assignmentIds = (assignments ?? []).map((a: any) => a.id);
    if (assignmentIds.length > 0) {
      const { count: subCount } = await supabase.from('assignment_submissions').delete({ count: 'exact' }).in('assignment_id', assignmentIds);
      deletedSubmissions = subCount ?? 0;
    }

    // Delete assignments
    const { count: asnCount } = await supabase.from('assignments').delete({ count: 'exact' }).in('classroom_id', classroomIds);
    deletedAssignments = asnCount ?? 0;

    // Delete enrollments
    const { count: enrCount } = await supabase.from('classroom_enrollments').delete({ count: 'exact' }).in('classroom_id', classroomIds);
    deletedEnrollments = enrCount ?? 0;

    // Delete classrooms
    await supabase.from('classrooms').delete().in('id', classroomIds);
  }

  // Delete org members
  const { count: memberCount } = await supabase.from('organization_members').delete({ count: 'exact' }).eq('organization_id', organizationId);

  // Deactivate org (keep shell for audit trail)
  await supabase.from('organizations').update({ is_active: false, name: '[DELETED]', contact_email: null }).eq('id', organizationId);

  logAudit(supabase, {
    actorId: userId, actorRole: 'school_admin', organizationId,
    action: 'delete', resourceType: 'organization', resourceId: organizationId, ipAddress: ip,
    metadata: {
      deletedMessages, deletedSessions, deletedSubmissions,
      deletedAssignments, deletedEnrollments, deletedMembers: memberCount ?? 0,
    },
  });

  return jsonResponse({
    success: true,
    purgedAt: new Date().toISOString(),
    summary: {
      messages: deletedMessages,
      sessions: deletedSessions,
      submissions: deletedSubmissions,
      assignments: deletedAssignments,
      enrollments: deletedEnrollments,
      members: memberCount ?? 0,
      classrooms: classroomIds.length,
    },
  });
}
