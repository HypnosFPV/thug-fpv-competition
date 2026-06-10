import { stepPlaybackQueueAction } from '@/app/actions';
import { SiteNav } from '@/components/SiteNav';
import { getJudgeSession, isAdminAuthenticated } from '@/lib/session';
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

  const isAdmin = await isAdminAuthenticated();
  const judgeSession = await getJudgeSession();
  const isAuthorized = isAdmin || Boolean(judgeSession);

  if (!isAuthorized) {
    return (
      <main className="page-shell page-stack playback-shell">
        <SiteNav mutedText="OBS playback is restricted to admin and judges" />
        <section className="panel narrow-panel">
          <div className="section-head">
            <h2>Restricted Access</h2>
            <span className="tag tag-action">Protected</span>
          </div>
          <p className="muted">This page is only visible to the admin and active judges.</p>
          <p className="muted">
            Log in as admin at <a className="inline-link" href="/admin">/admin</a> or as a judge at <a className="inline-link" href="/judge">/judge</a> first, then return here.
          </p>
        </section>
      </main>
    );
  }

  const bundle = await getActiveCompetitionBundle();
  const competition = bundle.competition;
  const currentEntry = getCurrentPlaybackEntry(bundle);
  const approvedEntries = getApprovedEntries(bundle.entries);

  return (
    <main className="page-shell page-stack playback-shell">
      <SiteNav mutedText="OBS Browser Source · admin/judge only" />
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">OBS Playback Route</p>
            <h2 style={{ margin: '8px 0 10px' }}>YouTube Queue Player</h2>
            <p className="muted">
              Approved entries appear here automatically. Admin can step forward or backward through the queue.
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
              Approved entries: {approvedEntries.length}. Competition status: {competition.status}.
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
