// Shared middleware for all Supabase Edge Functions
// Provides: CORS, auth verification, rate limiting, error handling, logging

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS ---
// Fail closed: if ALLOWED_ORIGIN is not set, restrict to localhost only
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function handleCORS(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

// --- Auth ---
export interface AuthenticatedUser {
  id: string;
  email: string;
}

export async function verifyAuth(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new HttpError(401, "Missing authorization header");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new HttpError(401, "Invalid or expired token");
  }

  return { id: user.id, email: user.email ?? "" };
}

// --- Rate Limiting (in-memory, per-function instance) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  userId: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): void {
  const now = Date.now();
  const key = userId;
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    throw new HttpError(429, "Too many requests. Please try again later.");
  }
}

// --- Error Handling ---
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonResponse(
  data: unknown,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.message }, error.status);
  }

  // Log internal errors but never expose details to client
  console.error("[INTERNAL_ERROR]", error);
  return jsonResponse({ error: "Internal server error" }, 500);
}

// --- Logging ---
export function log(
  functionName: string,
  step: string,
  details?: Record<string, unknown>
): void {
  const entry = {
    fn: functionName,
    step,
    ts: new Date().toISOString(),
    ...details,
  };
  console.log(JSON.stringify(entry));
}

// --- Input Validation Helpers ---
export function requireString(
  value: unknown,
  name: string,
  maxLength: number = 5000
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${name} is required and must be a non-empty string`);
  }
  // Strip null bytes
  return value.replace(/\0/g, "").slice(0, maxLength);
}

export function requireArray(value: unknown, name: string, maxLength: number = 50): unknown[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${name} must be an array`);
  }
  return value.slice(0, maxLength);
}

// --- Cron Auth ---
export function verifyCronAuth(req: Request): void {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    throw new HttpError(503, "CRON_SECRET not configured");
  }
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    throw new HttpError(401, "Invalid cron authorization");
  }
}

// --- Supabase Admin Client ---
export function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

// --- Safe Origin ---
export function getSafeOrigin(): string {
  const origin = Deno.env.get("ALLOWED_ORIGIN");
  if (!origin) {
    throw new HttpError(503, "ALLOWED_ORIGIN not configured");
  }
  return origin;
}
