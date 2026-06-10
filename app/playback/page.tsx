import { stepPlaybackQueueAction } from '@/app/actions';
import { SiteNav } from '@/components/SiteNav';
import { isAdminAuthenticated } from '@/lib/session';
import { getActiveCompetitionBundle, getApprovedEntries, getCurrentPlaybackEntry } from '@/lib/server-data';
import { getYouTubeEmbedUrl } from '@/lib/youtube';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickMessage(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlaybackPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) ?? {};
  const error = pickMessage(params.error);
  const success = pickMessage(params.success);
  const bundle = await getActiveCompetitionBundle();
  const competition = bundle.competition;
  const currentEntry = getCurrentPlaybackEntry(bundle);
  const approvedEntries = getApprovedEntries(bundle.entries);
  const isAdmin = await isAdminAuthenticated();

  return (
    <main className="page-shell page-stack playback-shell">
      <SiteNav mutedText="OBS Browser Source · use this route for clean livestream playback" />
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">OBS Playback Route</p>
            <h2 style={{ margin: '8px 0 10px' }}>YouTube Queue Player</h2>
            <p className="muted">
              This route now reads the active playback entry from Supabase. The admin can step forward or backward
              through the approved queue while the stream runs.
            </p>
          </div>
          <span className="tag">/playback</span>
        </div>

        {success && <div className="card success-card"><strong>Success</strong><p className="muted">{success}</p></div>}
        {error && <div className="card error-card"><strong>Notice</strong><p className="muted">{error}</p></div>}

        {!competition && <p className="muted">No active competition found.</p>}
        {competition && !currentEntry && (
          <div className="card notice-card">
            <strong>Queue is empty</strong>
            <p className="muted">
              Approved entries found: {approvedEntries.length}. Competition status: {competition.status}.
            </p>
            <p className="muted">
              {approvedEntries.length === 0
                ? 'No entries have moderation status "Approved" yet. Go to /admin, set status to Approved, and Save.'
                : 'Approved entries exist but no current playback selected. Click "Send to /playback" in the admin queue panel.'}
            </p>
          </div>
        )}
        {competition && currentEntry && (
          <>
            <div className="card notice-card" style={{ marginBottom: 12 }}>
              <strong>Now playing</strong>
              <p className="muted">{currentEntry.title} · {currentEntry.entrantName}</p>
            </div>
            <iframe
              className="player"
              src={getYouTubeEmbedUrl(currentEntry.youtubeVideoId)}
              title={currentEntry.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </>
        )}

        {isAdmin && (
          <div className="toolbar" style={{ marginTop: 14 }}>
            <form action={stepPlaybackQueueAction}>
              <input type="hidden" name="direction" value="prev" />
              <button className="btn secondary" type="submit">Previous Entry</button>
            </form>
            <form action={stepPlaybackQueueAction}>
              <input type="hidden" name="direction" value="next" />
              <button className="btn primary" type="submit">Next Entry</button>
            </form>
          </div>
        )}

        <div className="list" style={{ marginTop: 16 }}>
          {approvedEntries.map((entry, index) => (
            <div className="card" key={entry.id}>
              <strong>{entry.title}</strong>
              <p className="muted">Queue #{entry.runningOrder ?? index + 1} · {entry.entrantName}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
