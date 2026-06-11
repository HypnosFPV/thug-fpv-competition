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

  // Primary: explicit cookie set from the browser AuthCookieSync component.
  const direct = store.get('thug-fpv-access-token')?.value;
  if (direct && direct.split('.').length === 3) return direct;

  // Fallback: scan Supabase's own cookie format if present.
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


