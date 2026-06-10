import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const ADMIN_COOKIE = 'thug_admin_session';
const JUDGE_COOKIE = 'thug_judge_session';

interface SessionPayload {
  role: 'admin' | 'judge';
  competitionId?: string;
  judgeSlotId?: string;
  judgeCode?: string;
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || 'dev-insecure-session-secret-change-me';
}

function encode(payload: SessionPayload) {
  const raw = JSON.stringify(payload);
  const data = Buffer.from(raw).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function decode(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;

  const expected = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    return parsed;
  } catch {
    return null;
  }
}

export async function setAdminSession() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, encode({ role: 'admin' }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  const payload = decode(store.get(ADMIN_COOKIE)?.value);
  return payload?.role === 'admin';
}

export async function setJudgeSession(payload: { competitionId: string; judgeSlotId: string; judgeCode: string }) {
  const store = await cookies();
  store.set(
    JUDGE_COOKIE,
    encode({ role: 'judge', competitionId: payload.competitionId, judgeSlotId: payload.judgeSlotId, judgeCode: payload.judgeCode }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12
    }
  );
}

export async function clearJudgeSession() {
  const store = await cookies();
  store.delete(JUDGE_COOKIE);
}

export async function getJudgeSession() {
  const store = await cookies();
  const payload = decode(store.get(JUDGE_COOKIE)?.value);
  return payload?.role === 'judge' ? payload : null;
}
