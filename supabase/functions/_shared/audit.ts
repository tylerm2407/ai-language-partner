// Shared audit logging utility for Edge Functions.
// Call logAudit() after any mutation to record the action in the audit_log table.

export interface AuditParams {
  actorId: string;
  actorRole?: string;
  organizationId?: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'grant' | 'revoke';
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(
  supabase: any,
  params: AuditParams
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    actor_id: params.actorId,
    actor_role: params.actorRole ?? null,
    organization_id: params.organizationId ?? null,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId ?? null,
    metadata: params.metadata ?? {},
    ip_address: params.ipAddress ?? null,
  });

  if (error) {
    console.error('[audit] Failed to write audit log:', error.message);
  }
}

export function getClientIp(req: Request): string | undefined {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    undefined
  );
}
