import 'server-only';

import { cookies } from 'next/headers';

function decodeJwt(token: string): { sub?: string; email?: string; exp?: number } | null {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function readAuthTokenFromCookies() {
  const store = await cookies();
  // Supabase JS stores tokens under the configured storageKey when using localStorage on the browser,
  // but when the client is configured with cookies-only storage it falls back to this format.
  // We support both by scanning for any cookie that looks like a Supabase auth session.
  for (const cookie of store.getAll()) {
    if (!cookie.value) continue;
    if (cookie.name.includes('sb-') && cookie.name.endsWith('-auth-token')) {
      try {
        const parsed = JSON.parse(cookie.value);
        if (Array.isArray(parsed) && parsed[0]) return parsed[0] as string;
        if (parsed?.access_token) return parsed.access_token as string;
      } catch {
        // not JSON, ignore
      }
    }
  }
  return null;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const token = await readAuthTokenFromCookies();
  if (!token) return null;

  const payload = decodeJwt(token);
  if (!payload?.sub) return null;
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;

  return {
    id: payload.sub,
    email: payload.email ?? null
  };
}


