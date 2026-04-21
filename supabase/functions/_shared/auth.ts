/**
 * Shared authentication utilities for Edge Functions.
 * Validates JWT from Authorization header and extracts user ID.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Extract and verify the authenticated user from the request.
 * Returns the user ID or null if unauthenticated.
 */
export async function getAuthenticatedUser(req: Request): Promise<{ userId: string; email: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return { userId: user.id, email: user.email ?? '' };
}

/**
 * Authenticate user and fetch their roles + school enrollments.
 * Returns null if unauthenticated.
 */
export async function getAuthenticatedUserWithRoles(req: Request): Promise<{
  userId: string;
  roles: string[];
  schoolEnrollments: { orgId: string; classroomId: string }[];
} | null> {
  const authResult = await getAuthenticatedUser(req);
  if (!authResult) return null;

  const { userId } = authResult;
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch user roles
  const { data: roleRows } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);

  // Fetch active school enrollments (not dropped, org active)
  const { data: enrollmentRows } = await serviceClient
    .from('classroom_enrollments')
    .select(`
      classroom_id,
      classrooms!inner (
        id,
        organization_id,
        organizations!inner (
          id,
          is_active
        )
      )
    `)
    .eq('student_id', userId)
    .is('dropped_at', null);

  const schoolEnrollments: { orgId: string; classroomId: string }[] = [];
  if (enrollmentRows) {
    for (const row of enrollmentRows) {
      const classroom = row.classrooms as any;
      if (classroom?.organizations?.is_active) {
        schoolEnrollments.push({
          orgId: classroom.organization_id,
          classroomId: classroom.id,
        });
      }
    }
  }

  return { userId, roles, schoolEnrollments };
}
