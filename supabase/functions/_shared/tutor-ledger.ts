// deno-lint-ignore no-explicit-any
type Client = any;

export type TutorReserveStatus =
  | 'reserved'
  | 'already_reserved'
  | 'daily_limit'
  | 'monthly_limit';
export type TutorSettleStatus = 'settled' | 'already_settled';

type SettlementInput = {
  observedSeconds: number;
  refundSeconds: number;
  refundCents: number;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function reserveTutorSession(
  supabase: Client,
  input: {
    sessionId: string;
    userId: string;
    dailyLimit: number;
    monthlyLimit: number;
  },
): Promise<TutorReserveStatus> {
  const { data, error } = await supabase.rpc('reserve_tutor_session', {
    p_session_id: input.sessionId,
    p_user_id: input.userId,
    p_daily_limit: input.dailyLimit,
    p_monthly_limit: input.monthlyLimit,
  });
  if (error) throw new Error(error.message ?? 'tutor reservation failed');
  const status = record(data)?.status;
  if (
    status !== 'reserved' && status !== 'already_reserved' &&
    status !== 'daily_limit' && status !== 'monthly_limit'
  ) {
    throw new Error('invalid tutor reservation response');
  }
  return status;
}

export async function settleTutorSession(
  supabase: Client,
  input: { sessionId: string; userId: string; settlement: SettlementInput },
): Promise<
  {
    status: TutorSettleStatus;
    observedSeconds: number;
    refundSeconds: number;
    refundCents: number;
  }
> {
  const wanted = input.settlement;
  const { data, error } = await supabase.rpc('settle_tutor_session', {
    p_session_id: input.sessionId,
    p_user_id: input.userId,
    p_observed_seconds: wanted.observedSeconds,
    p_refund_seconds: wanted.refundSeconds,
    p_refund_cents: wanted.refundCents,
  });
  if (error) throw new Error(error.message ?? 'tutor settlement failed');
  const value = record(data);
  const status = value?.status;
  const observedSeconds = Number(value?.observedSeconds);
  const refundSeconds = Number(value?.refundSeconds);
  const refundCents = Number(value?.refundCents);
  if (
    (status !== 'settled' && status !== 'already_settled') ||
    !Number.isInteger(observedSeconds) || !Number.isInteger(refundSeconds) ||
    !Number.isInteger(refundCents)
  ) {
    throw new Error('invalid tutor settlement response');
  }
  return { status, observedSeconds, refundSeconds, refundCents };
}

export async function recordTutorAnalysisFailure(
  supabase: Client,
  input: { sessionId: string; userId: string; error: unknown },
): Promise<number> {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const { data, error } = await supabase.rpc('record_tutor_analysis_failure', {
    p_session_id: input.sessionId,
    p_user_id: input.userId,
    p_error: message.slice(0, 500),
  });
  if (error) {
    throw new Error(error.message ?? 'could not record tutor analysis failure');
  }
  const attempts = Number(data);
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error('invalid tutor analysis failure response');
  }
  return attempts;
}
