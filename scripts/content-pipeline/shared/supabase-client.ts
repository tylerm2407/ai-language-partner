import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let _client: SupabaseClient | null = null;

/**
 * Load .env file from project root into process.env.
 * Mirrors the pattern used in ingest-gutenberg-bulk.ts.
 */
function loadEnvFile(): void {
  try {
    const envPath = resolve(__dirname, '..', '..', '..', '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file not found, fall back to env vars
  }
}

/**
 * Returns a Supabase client configured with the service-role key
 * for bypassing RLS during bulk ingestion operations.
 */
export function getServiceClient(): SupabaseClient {
  if (_client) return _client;

  loadEnvFile();

  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
  const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

  const key = serviceKey || anonKey;

  if (!url || !key) {
    console.error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env'
    );
    process.exit(1);
  }

  if (!serviceKey) {
    console.warn(
      'No SUPABASE_SERVICE_ROLE_KEY found — using anon key. Inserts may fail due to RLS.'
    );
  }

  _client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _client;
}
