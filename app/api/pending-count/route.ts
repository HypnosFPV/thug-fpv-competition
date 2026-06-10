import { NextResponse } from 'next/server';

import { getActiveCompetitionBundle } from '@/lib/server-data';
import { isAdminAuthenticated } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const bundle = await getActiveCompetitionBundle();
  const pending = bundle.entries.filter((entry) => entry.moderationStatus === 'Pending');
  const latestPending = pending.reduce<string | null>((latest, entry) => {
    const candidate = (entry as any).createdAt ?? null;
    if (!latest) return candidate;
    if (candidate && candidate > latest) return candidate;
    return latest;
  }, null);

  return NextResponse.json({
    ok: true,
    pendingCount: pending.length,
    pendingIds: pending.map((entry) => entry.id),
    latestPending,
    competitionId: bundle.competition?.id ?? null,
    competitionStatus: bundle.competition?.status ?? null,
    timestamp: new Date().toISOString()
  });
}
