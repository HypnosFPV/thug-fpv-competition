import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

export function isSupabaseConfigured() {
  return Boolean(getEnv('NEXT_PUBLIC_SUPABASE_URL') && getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
