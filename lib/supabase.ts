import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your values.'
  );
}

// Diagnostic: prints the key FORMAT (not the full secret) so we can confirm
// the runtime actually has the new publishable key. Expect "sb_publishable_…"
// or legacy-JWT prefix "eyJhbGc…". If it shows "eyJ…", Metro is still on a
// stale bundle or an EAS dev-client is shadowing .env.
const keyPrefix = supabaseAnonKey.slice(0, 20);
const keyFormat = supabaseAnonKey.startsWith('sb_publishable_')
  ? 'NEW publishable'
  : supabaseAnonKey.startsWith('eyJ')
    ? 'LEGACY JWT'
    : 'unknown';
console.log(`[supabase] URL: ${supabaseUrl}`);
console.log(`[supabase] anon key format: ${keyFormat} (prefix: ${keyPrefix}…)`);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // not needed for mobile
  },
});
