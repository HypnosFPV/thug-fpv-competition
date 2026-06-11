import { NextRequest, NextResponse } from 'next/server';

import { isAdminAuthenticated } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';

type Entry = {
  id: string;
  title?: string;
  entrant_name?: string;
  entrant_email?: string;
  youtube_url?: string;
  youtube_video_id?: string;
  moderation_status?: string;
  moderation_notes?: string | null;
  running_order?: number | null;
  approved_at?: string | null;
  created_at?: string;
  notes?: string | null;
};

type Score = {
  id?: string;
  entry_id: string;
  judge_slot_id: string;
  score: number;
  updated_at?: string;
};

type JudgeSlot = {
  id: string;
  code: string;
  display_name?: string | null;
};

type Competition = {
  id: string;
  name: string;
  status?: string;
  created_at?: string;
  archived_at?: string | null;
};

type Sponsor = {
  id: string;
  sponsor_name: string;
  contact_name: string | null;
  contact_email: string | null;
  website_url: string | null;
  prize_description: string;
  logo_url: string | null;
  approved: boolean;
  notes: string | null;
  created_at: string;
};

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const head = headers.map(csvEscape).join(',');
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  return body ? `${head}\n${body}\n` : `${head}\n`;
}

function average(nums: number[]): number | null {
  if (!nums.length) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return sum / nums.length;
}

function buildCsv(comp: Competition, judges: JudgeSlot[], entries: Entry[], scores: Score[], sponsors: Sponsor[] = []): string {
  const sections: string[] = [];

  // --- Header / metadata ---
  sections.push(
    rowsToCsv(
      ['Field', 'Value'],
      [
        ['Competition', comp.name],
        ['Competition ID', comp.id],
        ['Status', comp.status ?? ''],
        ['Created', comp.created_at ?? ''],
        ['Archived', comp.archived_at ?? ''],
        ['Exported', new Date().toISOString()],
        ['Total Entries', entries.length],
        ['Approved Entries', entries.filter((e) => e.moderation_status === 'Approved').length],
        ['Rejected Entries', entries.filter((e) => e.moderation_status === 'Rejected').length],
        ['Pending Entries', entries.filter((e) => e.moderation_status === 'Pending').length]
      ]
    )
  );

  // --- All entries ---
  const entriesHeaders = [
    'Entry ID',
    'Title',
    'Entrant Name',
    'Entrant Email',
    'YouTube URL',
    'YouTube Video ID',
    'Moderation Status',
    'Admin Comment',
    'Running Order',
    'Approved At',
    'Submitted At',
    'Notes'
  ];
  const entriesRows = entries.map((e) => [
    e.id,
    e.title ?? '',
    e.entrant_name ?? '',
    e.entrant_email ?? '',
    e.youtube_url ?? '',
    e.youtube_video_id ?? '',
    e.moderation_status ?? '',
    e.moderation_notes ?? '',
    e.running_order ?? '',
    e.approved_at ?? '',
    e.created_at ?? '',
    e.notes ?? ''
  ]);
  sections.push('\nALL ENTRIES\n' + rowsToCsv(entriesHeaders, entriesRows));

  // --- Individual judge scores per entry (wide table) ---
  const judgeCols = judges
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((j) => ({ id: j.id, label: `${j.code}${j.display_name ? ' (' + j.display_name + ')' : ''}` }));

  const approvedEntries = entries.filter((e) => e.moderation_status === 'Approved');

  const scoreLookup = new Map<string, Map<string, number>>();
  for (const s of scores) {
    if (!scoreLookup.has(s.entry_id)) scoreLookup.set(s.entry_id, new Map());
    scoreLookup.get(s.entry_id)!.set(s.judge_slot_id, s.score);
  }

  const scoreHeaders = ['Entry ID', 'Title', 'Entrant', 'YouTube URL', ...judgeCols.map((c) => c.label), 'Judges Scored', 'Sum', 'Average'];
  const leaderboardRows: { entry: Entry; sum: number; avg: number; count: number; cells: (string | number | null)[] }[] = [];

  for (const e of approvedEntries) {
    const cells: (string | number | null)[] = [];
    const nums: number[] = [];
    for (const c of judgeCols) {
      const v = scoreLookup.get(e.id)?.get(c.id);
      cells.push(v ?? null);
      if (typeof v === 'number') nums.push(v);
    }
    const avg = average(nums);
    const sum = nums.reduce((a, b) => a + b, 0);
    leaderboardRows.push({
      entry: e,
      sum,
      avg: avg ?? 0,
      count: nums.length,
      cells
    });
  }

  const scoresRows = leaderboardRows.map((r) => [
    r.entry.id,
    r.entry.title ?? '',
    r.entry.entrant_name ?? '',
    r.entry.youtube_url ?? '',
    ...r.cells,
    r.count,
    r.count ? r.sum.toFixed(2) : '',
    r.count ? r.avg.toFixed(3) : ''
  ]);
  sections.push('\nINDIVIDUAL JUDGE SCORES (Approved Entries)\n' + rowsToCsv(scoreHeaders, scoresRows));

  // --- Per-judge breakdown (long table) ---
  const longHeaders = ['Entry Title', 'Entrant', 'Judge Code', 'Judge Name', 'Score', 'Scored At'];
  const longRows: (string | number | null)[][] = [];
  for (const s of scores) {
    const e = entries.find((x) => x.id === s.entry_id);
    const j = judges.find((x) => x.id === s.judge_slot_id);
    if (!e || !j) continue;
    longRows.push([
      e.title ?? '',
      e.entrant_name ?? '',
      j.code,
      j.display_name ?? '',
      s.score,
      s.updated_at ?? ''
    ]);
  }
  sections.push('\nJUDGE-BY-JUDGE LOG\n' + rowsToCsv(longHeaders, longRows));

  // --- Final leaderboard / placements ---
  const ranked = leaderboardRows
    .filter((r) => r.count > 0)
    .sort((a, b) => b.avg - a.avg || b.sum - a.sum);

  const placementHeaders = ['Placement', 'Title', 'Entrant', 'YouTube URL', 'Average', 'Sum', 'Judges Scored'];
  const placementRows = ranked.map((r, i) => [
    i + 1,
    r.entry.title ?? '',
    r.entry.entrant_name ?? '',
    r.entry.youtube_url ?? '',
    r.avg.toFixed(3),
    r.sum.toFixed(2),
    r.count
  ]);
  sections.push('\nFINAL PLACEMENTS (by Average, tiebreak Sum)\n' + rowsToCsv(placementHeaders, placementRows));

  // --- Approved without any scores ---
  const unscored = approvedEntries.filter((e) => !scoreLookup.get(e.id) || scoreLookup.get(e.id)!.size === 0);
  if (unscored.length) {
    sections.push(
      '\nAPPROVED ENTRIES WITH NO SCORES\n' +
        rowsToCsv(
          ['Entry ID', 'Title', 'Entrant', 'YouTube URL'],
          unscored.map((e) => [e.id, e.title ?? '', e.entrant_name ?? '', e.youtube_url ?? ''])
        )
    );
  }

  // --- Sponsors ---
  const sponsorHeaders = [
    'Sponsor ID',
    'Sponsor Name',
    'Approved',
    'Prize',
    'Contact Name',
    'Contact Email',
    'Website',
    'Logo URL',
    'Admin Notes',
    'Submitted At'
  ];
  const sponsorRows = sponsors.map((s) => [
    s.id,
    s.sponsor_name,
    s.approved ? 'Yes' : 'No',
    s.prize_description,
    s.contact_name ?? '',
    s.contact_email ?? '',
    s.website_url ?? '',
    s.logo_url ?? '',
    s.notes ?? '',
    s.created_at
  ]);
  sections.push('\nSPONSORS\n' + rowsToCsv(sponsorHeaders, sponsorRows));

  return sections.join('\n');
}

function filename(compName: string, compId: string): string {
  const safe = (compName || 'competition')
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'competition';
  const stamp = new Date().toISOString().slice(0, 10);
  return `${safe}_${stamp}_${compId.slice(0, 8)}.csv`;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ competitionId: string }> }) {
  const admin = await isAdminAuthenticated();
  if (!admin) {
    return new NextResponse('Admin authentication required.', { status: 401 });
  }

  const { competitionId } = await ctx.params;
  if (!competitionId) {
    return new NextResponse('Missing competitionId.', { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return new NextResponse('Server not configured.', { status: 500 });
  }

  // 1) Try live competition
  const { data: liveComp } = await supabase
    .from('competitions')
    .select('id, name, status, created_at, archived_at')
    .eq('id', competitionId)
    .maybeSingle<Competition>();

  if (liveComp) {
    const [{ data: entries }, { data: scores }, { data: judges }, { data: sponsors }] = await Promise.all([
      supabase.from('entries').select('*').eq('competition_id', competitionId),
      supabase
        .from('scores')
        .select('id, entry_id, judge_slot_id, score, updated_at')
        .in(
          'entry_id',
          (await supabase.from('entries').select('id').eq('competition_id', competitionId)).data?.map((r) => r.id) ?? []
        ),
      supabase
        .from('judge_slots')
        .select('id, code, display_name')
        .eq('competition_id', competitionId),
      supabase
        .from('sponsors')
        .select('id, sponsor_name, contact_name, contact_email, website_url, prize_description, logo_url, approved, notes, created_at')
        .eq('competition_id', competitionId)
    ]);

    const csv = buildCsv(
      liveComp,
      (judges ?? []) as JudgeSlot[],
      (entries ?? []) as Entry[],
      (scores ?? []) as Score[],
      (sponsors ?? []) as Sponsor[]
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename(liveComp.name, liveComp.id)}"`,
        'Cache-Control': 'no-store'
      }
    });
  }

  // 2) Fall back to archive snapshot
  const { data: archive } = await supabase
    .from('competition_archives')
    .select('archived_competition_id, competition_name, archived_snapshot, created_at')
    .eq('archived_competition_id', competitionId)
    .maybeSingle<{
      archived_competition_id: string;
      competition_name: string;
      created_at: string;
      archived_snapshot: {
        competition: Competition;
        judgeSlots: JudgeSlot[];
        entries: Entry[];
        scores: Score[];
      };
    }>();

  if (!archive) {
    return new NextResponse('Competition not found.', { status: 404 });
  }

  const snap = archive.archived_snapshot as typeof archive.archived_snapshot & { sponsors?: Sponsor[] };
  const csv = buildCsv(
    snap.competition ?? {
      id: archive.archived_competition_id,
      name: archive.competition_name,
      status: 'Archived',
      archived_at: archive.created_at
    },
    snap.judgeSlots ?? [],
    snap.entries ?? [],
    snap.scores ?? [],
    snap.sponsors ?? []
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename(archive.competition_name, archive.archived_competition_id)}"`,
      'Cache-Control': 'no-store'
    }
  });
}
