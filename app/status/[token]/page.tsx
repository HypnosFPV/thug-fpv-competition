import { SiteNav } from '@/components/SiteNav';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type RouteParams = Promise<{ token: string }>;

interface EntryStatusRow {
  id: string;
  entrant_name: string;
  title: string;
  youtube_url: string;
  moderation_status: string;
  moderation_notes: string | null;
  running_order: number | null;
  created_at: string;
  approved_at: string | null;
  competitions: { name: string; status: string } | { name: string; status: string }[] | null;
}

function getCompetitionName(row: EntryStatusRow) {
  if (!row.competitions) return null;
  if (Array.isArray(row.competitions)) return row.competitions[0]?.name ?? null;
  return row.competitions.name ?? null;
}

function statusBadgeClass(status: string) {
  if (status === 'Approved') return 'tag tag-live';
  if (status === 'Rejected') return 'tag tag-action';
  return 'tag';
}

export default async function EntryStatusPage({ params }: { params: RouteParams }) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <main className="page-shell page-stack">
        <SiteNav mutedText="Private submission status" />
        <section className="panel narrow-panel">
          <div className="section-head"><h2>Status unavailable</h2></div>
          <p className="muted">Server not configured.</p>
        </section>
      </main>
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return (
      <main className="page-shell page-stack">
        <SiteNav mutedText="Private submission status" />
        <section className="panel narrow-panel">
          <div className="section-head"><h2>Status unavailable</h2></div>
          <p className="muted">Server error.</p>
        </section>
      </main>
    );
  }

  const { data: dataRaw, error } = await supabase
    .from('entries')
    .select('id, entrant_name, title, youtube_url, moderation_status, moderation_notes, running_order, created_at, approved_at, competitions!entries_competition_id_fkey(name, status)')
    .eq('status_token', token)
    .maybeSingle();

  const data = dataRaw as EntryStatusRow | null;

  if (error || !data) {
    return (
      <main className="page-shell page-stack">
        <SiteNav mutedText="Private submission status" />
        <section className="panel narrow-panel">
          <div className="section-head"><h2>Status link not recognized</h2></div>
          <p className="muted">This status link is invalid or the entry no longer exists.</p>
        </section>
      </main>
    );
  }

  const status = data.moderation_status;
  const competitionName = getCompetitionName(data);
  const friendlyMessage = (() => {
    if (status === 'Approved') {
      return `Your entry has been accepted${data.running_order ? ` and assigned queue position #${data.running_order}` : ''}.`;
    }
    if (status === 'Rejected') {
      return 'Your entry was not approved for this round. See the admin comment below.';
    }
    if (status === 'Playback Verified') {
      return 'Admin has verified your video playback. Final approval is pending.';
    }
    return 'Your entry is awaiting admin review. Check back later.';
  })();

  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="Private submission status" />
      <section className="panel narrow-panel">
        <div className="section-head">
          <h2>Submission Status</h2>
          <span className={statusBadgeClass(status)}>{status === 'Approved' && data.running_order ? `APPROVED #${data.running_order}` : status.toUpperCase()}</span>
        </div>

        <div className="list">
          <div className="card">
            <strong>{data.title}</strong>
            <p className="muted">Submitted by {data.entrant_name}</p>
            {competitionName && <p className="muted">Competition: {competitionName}</p>}
          </div>

          <div className={`card ${status === 'Approved' ? 'queue-now-card' : status === 'Rejected' ? 'error-card' : 'notice-card'}`}>
            <strong>{friendlyMessage}</strong>
            {status === 'Rejected' && data.moderation_notes && (
              <>
                <p className="muted" style={{ marginTop: 8 }}>Admin comment:</p>
                <blockquote className="reject-comment">{data.moderation_notes}</blockquote>
              </>
            )}
          </div>

          <p className="muted" style={{ fontSize: '.82rem' }}>
            Keep this link private. Anyone with the link can view this status.
          </p>
        </div>
      </section>
    </main>
  );
}
