import { redirect } from 'next/navigation';

import { AuthBar } from '@/components/AuthBar';
import { SiteNav } from '@/components/SiteNav';
import { replaceMyEntryAction } from '@/app/actions';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSupabaseAdmin } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickMessage(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

interface MyEntryRow {
  id: string;
  title: string;
  moderation_status: string;
  moderation_notes: string | null;
  running_order: number | null;
  youtube_url: string;
  notes: string | null;
  created_at: string;
  status_token: string | null;
  competition_id: string;
  competitions: { name: string; status: string } | { name: string; status: string }[] | null;
}

function competitionInfo(row: MyEntryRow) {
  if (!row.competitions) return { name: null, status: null };
  if (Array.isArray(row.competitions)) {
    return { name: row.competitions[0]?.name ?? null, status: row.competitions[0]?.status ?? null };
  }
  return { name: row.competitions.name, status: row.competitions.status };
}

function statusTag(status: string, order: number | null) {
  if (status === 'Approved') return { label: order ? `APPROVED #${order}` : 'APPROVED', cls: 'tag tag-live' };
  if (status === 'Rejected') return { label: 'REJECTED', cls: 'tag tag-action' };
  return { label: status.toUpperCase(), cls: 'tag' };
}

export default async function MyEntriesPage({ searchParams }: { searchParams?: SearchParams }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login?next=/my-entries');
  }

  const params = (await searchParams) ?? {};
  const success = pickMessage(params.success);
  const error = pickMessage(params.error);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return (
      <main className="page-shell page-stack">
        <SiteNav mutedText="My entries" />
        <section className="panel narrow-panel">
          <h2>Server not configured</h2>
        </section>
      </main>
    );
  }

  const { data: dataRaw, error: queryError } = await supabase
    .from('entries')
    .select('id, title, moderation_status, moderation_notes, running_order, youtube_url, notes, created_at, status_token, competition_id, competitions(name, status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const data = dataRaw as MyEntryRow[] | null;

  return (
    <main className="page-shell page-stack">
      <SiteNav mutedText="My entries · only yours, no one else's" />
      <AuthBar />

      <section className="panel">
        <div className="section-head">
          <h2>My Entries</h2>
          <span className="tag">{user.email}</span>
        </div>

        {success && <div className="card success-card"><strong>Success</strong><p className="muted">{success}</p></div>}
        {error && <div className="card error-card"><strong>Notice</strong><p className="muted">{error}</p></div>}
        {queryError && <div className="card error-card"><strong>Could not load entries</strong><p className="muted">{queryError.message}</p></div>}

        {!queryError && (!data || data.length === 0) && (
          <div className="card notice-card">
            <strong>No entries yet</strong>
            <p className="muted">Head to <a className="inline-link" href="/submit">Submit Entry</a> to add one.</p>
          </div>
        )}

        {data && data.length > 0 && (
          <div className="list">
            {data.map((entry) => {
              const tag = statusTag(entry.moderation_status, entry.running_order);
              const { name: compName, status: compStatus } = competitionInfo(entry);
              const canReplace = compStatus === 'Submissions Open';

              return (
                <div key={entry.id} className={`card ${entry.moderation_status === 'Approved' ? 'queue-now-card' : entry.moderation_status === 'Rejected' ? 'error-card' : 'notice-card'}`}>
                  <div className="section-head" style={{ marginBottom: 6 }}>
                    <strong>{entry.title}</strong>
                    <span className={tag.cls}>{tag.label}</span>
                  </div>
                  {compName && <p className="muted">Competition: {compName} · Status: {compStatus}</p>}
                  <a className="muted inline-link" href={entry.youtube_url} target="_blank" rel="noopener noreferrer">Open YouTube Link</a>
                  {entry.moderation_status === 'Rejected' && entry.moderation_notes && (
                    <>
                      <p className="muted" style={{ marginTop: 10 }}>Admin comment:</p>
                      <blockquote className="reject-comment">{entry.moderation_notes}</blockquote>
                    </>
                  )}

                  {canReplace && (
                    <details className="replace-details" style={{ marginTop: 14 }}>
                      <summary className="btn secondary replace-summary">Replace this Entry</summary>
                      <form action={replaceMyEntryAction} className="form form-single" style={{ marginTop: 12 }}>
                        <input type="hidden" name="entryId" value={entry.id} />
                        <label className="field">
                          <span>Entry title</span>
                          <input className="input" name="title" defaultValue={entry.title} required />
                        </label>
                        <label className="field">
                          <span>YouTube URL</span>
                          <input className="input" name="youtubeUrl" defaultValue={entry.youtube_url} required />
                        </label>
                        <label className="field">
                          <span>Notes</span>
                          <textarea className="textarea" name="notes" defaultValue={entry.notes ?? ''} />
                        </label>
                        <label className="field checkbox-field">
                          <span className="checkbox-line">
                            <input name="consent" type="checkbox" value="yes" required />
                            <span>I confirm I own this content and allow livestream playback. Replacement will reset status to Pending and require admin re-verification.</span>
                          </span>
                        </label>
                        <button className="btn primary" type="submit">Replace & Re-Verify</button>
                      </form>
                    </details>
                  )}
                  {!canReplace && (
                    <p className="muted" style={{ marginTop: 10, fontSize: '.85rem' }}>
                      Replacement is only available while submissions are open.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
